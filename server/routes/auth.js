import { Router } from 'express';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../lib/prisma.js';
import { signSession, extractToken, verifySession } from '../lib/auth.js';
import { setSessionCookie, clearSessionCookie } from '../lib/cookies.js';
import { getProvider } from '../lib/oauth/index.js';
import { defaultNameFor } from '../lib/defaultName.js';

const router = Router();

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const MOBILE_SCHEME = process.env.MOBILE_DEEP_LINK_SCHEME ?? 'pokefesta30';
const STATE_TTL_MS = 10 * 60 * 1000;

// OAuth state 는 HMAC 서명만으로 검증한다 — 쿠키 기반 nonce 는 모바일 WebView
// 에서 Next rewrite 프록시 / cross-site 쿠키 격리 때문에 자주 손실됨.
// JWT_SECRET 으로 base64url(payload).base64url(sig) 형태로 묶고 콜백에서 검증.
function getStateSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not configured');
  return s;
}

function signState(payload) {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getStateSecret()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifyState(raw) {
  if (typeof raw !== 'string' || !raw.includes('.')) return null;
  const idx = raw.lastIndexOf('.');
  const b64 = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = createHmac('sha256', getStateSecret()).update(b64).digest('base64url');
  let a, b;
  try {
    a = Buffer.from(sig, 'base64url');
    b = Buffer.from(expected, 'base64url');
  } catch {
    return null;
  }
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function safeReturnPath(input) {
  if (!input || typeof input !== 'string') return '/';
  if (!input.startsWith('/') || input.startsWith('//')) return '/';
  return input;
}

router.get('/me', async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.json({ user: null });
  try {
    const session = await verifySession(token);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, avatar: true, avatarId: true },
    });
    if (!user) return res.json({ user: null });
    return res.json({
      user: { ...user, provider: session.provider ?? null },
    });
  } catch {
    return res.json({ user: null });
  }
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// 모바일 인앱 WebView 로그인 브리지.
// 콜백이 성공 시 이 https 경로로 리다이렉트하면, 앱의 WebView 가 이 URL 네비게이션
// 에서 token 을 가로채 세션을 저장한다(페이지는 실제로 로드하지 않음). 커스텀 스킴
// (pokefesta30://) 302 는 WebView 가 OS intent 로 넘겨 앱 라우팅이 깨지는 문제가 있어
// https 경로로 우회한다. WebView 가 실제로 로드하는 경우를 대비한 최소 페이지도 제공.
// 주의: 와일드카드 `/:provider` 보다 먼저 선언해야 매칭된다.
router.get('/app-callback', (_req, res) => {
  res
    .type('html')
    .send(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>로그인 완료</title>' +
        '<body style="font-family:sans-serif;text-align:center;padding-top:48px;color:#333">로그인 완료. 앱으로 돌아갑니다…</body>',
    );
});

// ── Sign in with Apple (네이티브) ─────────────────────────────────────────────
// App Store 심사 지침 4.8: 서드파티 소셜 로그인 제공 앱은 Apple 로그인 필수.
// 앱이 expo-apple-authentication 으로 받은 identityToken(JWT)을 보내면
// Apple 공개키(JWKS)로 서명·발급자·수신자(번들ID)를 검증하고 세션을 발급한다.
// 웹은 Apple Services ID 도메인 검증이 별도로 필요해 앱 전용 (플랫폼 예외).
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? 'com.arvotcg.app';

router.post('/apple/native', async (req, res) => {
  const body = req.body ?? {};
  const identityToken = typeof body.identityToken === 'string' ? body.identityToken : '';
  if (!identityToken) return res.status(400).json({ error: 'identityToken required' });
  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_BUNDLE_ID,
    });
    if (!payload.sub) return res.status(401).json({ error: 'missing sub' });
    const userId = `apple_${payload.sub}`;
    const email = typeof payload.email === 'string' ? payload.email : null;
    // Apple 은 이름을 "최초 승인 시 1회"만 앱에 준다 — create 에만 반영, update 시 보존.
    const givenName = typeof body.name === 'string' ? body.name.trim().slice(0, 20) : '';
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: email ? { email } : {},
      create: {
        id: userId,
        name: givenName || defaultNameFor(userId),
        ...(email ? { email } : {}),
      },
    });
    const token = await signSession({
      userId: user.id,
      provider: 'apple',
      email: user.email ?? undefined,
      name: user.name,
    });
    res.json({ token });
  } catch (err) {
    console.error('[auth.apple.native]', err);
    res.status(401).json({ error: 'invalid identity token' });
  }
});

router.get('/:provider', (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).json({ error: 'unknown provider' });

  const nonce = randomBytes(16).toString('hex');
  const platform = req.query.platform === 'mobile' ? 'mobile' : 'web';
  const returnTo = safeReturnPath(typeof req.query.redirect === 'string' ? req.query.redirect : '/');
  const stateValue = signState({ n: nonce, p: platform, r: returnTo, t: Date.now() });

  res.redirect(provider.buildAuthorizeUrl(stateValue));
});

router.get('/callback/:provider', async (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).send('unknown provider');

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !stateRaw) return res.status(400).send('missing code/state');

  const state = verifyState(stateRaw);
  if (!state) return res.status(400).send('state signature mismatch');
  if (typeof state.t !== 'number' || Date.now() - state.t > STATE_TTL_MS) {
    return res.status(400).send('state expired');
  }

  try {
    const accessToken = await provider.exchangeCode(code, stateRaw);
    const info = await provider.fetchUserInfo(accessToken);
    if (!info?.id) return res.status(400).send('userinfo missing id');

    const userId = info.id;
    const displayName = info.name?.trim() || defaultNameFor(userId);

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: info.email ? { email: info.email } : {},
      create: {
        id: userId,
        name: displayName,
        ...(info.email ? { email: info.email } : {}),
      },
    });

    const token = await signSession({
      userId: user.id,
      provider: provider.provider,
      email: user.email ?? undefined,
      name: user.name,
    });

    if (state.p === 'mobile') {
      // 앱 내부 WebView 가 가로챌 수 있도록 커스텀 스킴 대신 https 경로(같은 오리진)로
      // 리다이렉트. WebView 는 이 네비게이션에서 token 을 추출해 세션 저장 후 홈으로
      // 이동하며 페이지는 로드하지 않는다. (커스텀 스킴 302 → WebView intent → 404 회피)
      return res.redirect(`/auth/app-callback?token=${encodeURIComponent(token)}`);
    }

    setSessionCookie(res, token);
    const target = `${WEB_BASE_URL}${safeReturnPath(state.r)}`;
    return res.redirect(target);
  } catch (err) {
    console.error('[auth.callback]', err);
    return res.status(500).send('auth failed');
  }
});

export default router;
