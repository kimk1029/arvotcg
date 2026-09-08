import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { SignJWT } from 'jose';

// 실제 서비스 비밀/DB를 사용하지 않는 인증 경계 통합 테스트.
process.env.JWT_SECRET = 'security-test-only-secret-not-for-production';
process.env.NODE_ENV = 'production';
const { signSession, verifySession } = await import('./lib/auth.js');
const { apiAccess } = await import('./middleware/apiAccess');
const { buildCors, protectCookieWrites } = await import('./middleware/cors.js');
const { prisma } = await import('./lib/prisma.js');

test('JWT rejects modified signature, expired tokens, missing expiry and wrong algorithm', async () => {
  const valid = await signSession({ userId: 'member' });
  assert.equal((await verifySession(valid)).userId, 'member');
  const parts = valid.split('.');
  parts[0] = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  await assert.rejects(() => verifySession(parts.join('.')));
  const changed = valid.split('.');
  changed[1] = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999, iss: 'pokefesta30' })).toString('base64url');
  await assert.rejects(() => verifySession(changed.join('.')));
  const key = new TextEncoder().encode(process.env.JWT_SECRET);
  const expired = await new SignJWT({ sub: 'member' }).setProtectedHeader({ alg: 'HS256' }).setIssuer('pokefesta30').setIssuedAt().setExpirationTime('0s').sign(key);
  await assert.rejects(() => verifySession(expired));
  const noExpiry = await new SignJWT({ sub: 'member' }).setProtectedHeader({ alg: 'HS256' }).setIssuer('pokefesta30').setIssuedAt().sign(key);
  await assert.rejects(() => verifySession(noExpiry));
  const wrongAlg = await new SignJWT({ sub: 'member' }).setProtectedHeader({ alg: 'HS384' }).setIssuer('pokefesta30').setIssuedAt().setExpirationTime('1h').sign(key);
  await assert.rejects(() => verifySession(wrongAlg));
});

test('Express API rejects anonymous/deleted users and CSRF, permits verified cookie/Bearer sessions', async () => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async ({ where }: { where: { id: string } }) => where.id === 'member' ? { id: 'member' } : null) as typeof original;
  const app = express();
  app.use(buildCors(), cookieParser(), protectCookieWrites);
  app.use('/api', apiAccess);
  app.all('/api/private', (_req, res) => res.set('Cache-Control', 'public, max-age=300').json({ ok: true }));
  app.post('/api/metrics/action', (_req, res) => res.sendStatus(204));
  app.use((err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.sendStatus(err.status ?? 500); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const valid = await signSession({ userId: 'member' });
  const deleted = await signSession({ userId: 'deleted' });
  try {
    for (const headers of [{}, { cookie: 'pf30_session=fake' }, { 'user-agent': 'ARVOTCG-App' }, { authorization: `Bearer ${deleted}` }]) {
      assert.equal((await fetch(`${base}/api/private?embed=1`, { headers })).status, 401);
    }
    const bearer = await fetch(`${base}/api/private`, { headers: { authorization: `Bearer ${valid}` } });
    assert.equal(bearer.status, 200);
    assert.equal(bearer.headers.get('cache-control'), 'private, no-store');
    assert.equal((await fetch(`${base}/api/private`, { method: 'POST', headers: { authorization: `Bearer ${valid}` } })).status, 200);
    const cookie = { cookie: `pf30_session=${valid}` };
    assert.equal((await fetch(`${base}/api/private`, { method: 'POST', headers: cookie })).status, 403);
    assert.equal((await fetch(`${base}/api/private`, { method: 'POST', headers: { ...cookie, Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${base}/api/private`, { method: 'POST', headers: { ...cookie, Origin: 'https://www.arvotcg.com' } })).status, 200);
    assert.equal((await fetch(`${base}/api/private`, { headers: cookie })).status, 200);
    assert.equal((await fetch(`${base}/api/metrics/action`, { method: 'POST' })).status, 204);
    assert.equal((await fetch(`${base}/api/new-feature`)).status, 401);
  } finally {
    prisma.user.findUnique = original;
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
