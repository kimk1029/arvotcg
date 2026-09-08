import { SignJWT, jwtVerify } from 'jose';

const SECRET = (() => {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(raw);
})();

const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '30d';
const ISSUER = 'pokefesta30';

export async function signSession(payload) {
  return await new SignJWT({
    sub: payload.userId,
    provider: payload.provider,
    email: payload.email ?? null,
    name: payload.name ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET);
}

export async function verifySession(token) {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, algorithms: ['HS256'], requiredClaims: ['sub', 'iat', 'exp'] });
  if (!payload.sub) throw new Error('missing sub');
  return {
    userId: String(payload.sub),
    provider: typeof payload.provider === 'string' ? payload.provider : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'pf30_session';

export function extractToken(req) {
  const auth = req.headers.authorization ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.cookies?.[COOKIE_NAME] ?? null;
}

export const sessionCookieName = COOKIE_NAME;
