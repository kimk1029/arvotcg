// Run after npm run build. Uses a local auth stub; never logs in to production.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const auth = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ user: req.headers.authorization === 'Bearer smoke-valid' ? { id: 'smoke-member' } : null }));
});
auth.listen(0, '127.0.0.1');
await once(auth, 'listening');
const portReservation = createServer();
portReservation.listen(0, '127.0.0.1');
await once(portReservation, 'listening');
const port = portReservation.address().port;
await new Promise(resolve => portReservation.close(resolve));
const web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
  env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${auth.address().port}` }, stdio: 'ignore',
});
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/icon.svg`)).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.equal(ready, true, 'production web server started');
  const ads = await fetch(`${base}/app-ads.txt`, { redirect: 'manual', headers: { 'User-Agent': 'Google-adstxt' } });
  assert.equal(ads.status, 200);
  assert.match(ads.headers.get('content-type') ?? '', /^text\/plain\b/);
  assert.equal(await ads.text(), 'google.com, pub-8606099213555265, DIRECT, f08c47fec0942fa0\n');
  console.log('AdMob app-ads.txt: anonymous crawler gets exact publisher record as text/plain');
  const cases = [
    ['/', {}, 307], ['/?embed=1', {}, 307],
    ['/event/cardshow?embed=1', {}, 307],
    ['/cards/fake.json', {}, 307],
    ['/', { 'user-agent': 'ARVOTCG-App' }, 307],
    ['/', { cookie: 'pf30_session=fake' }, 307],
    ['/', { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' }, 307],
    ['/', { 'x-middleware-subrequest': 'src/middleware:src/middleware:src/middleware:src/middleware:src/middleware' }, 307],
    ['/cards?_rsc=probe', { RSC: '1', 'Next-Router-Prefetch': '1' }, 307],
    ['/api/navercafe/list', {}, 401], ['/api/cards/lookup?embed=1', {}, 401],
    ['/event/cardshow?embed=1&token=fake', {}, 307],
    ['/event/cardshow?embed=1&token=smoke-valid', {}, 307],
    ['/event/cardshow?embed=1', { cookie: 'pf30_session=smoke-valid' }, 200],
  ];
  for (const [path, headers, expected] of cases) {
    const res = await fetch(`${base}${path}`, { headers, redirect: 'manual' });
    assert.equal(res.status, expected, path);
    if (expected === 307 && !path.includes('token=smoke-valid')) {
      assert.equal(new URL(res.headers.get('location'), base).pathname, '/login', path);
    }
    await res.arrayBuffer();
  }
  console.log(`Production HTTP access smoke: ${cases.length} cases passed`);
} finally {
  web.kill('SIGTERM');
  await once(web, 'exit');
  await new Promise(resolve => auth.close(resolve));
}
