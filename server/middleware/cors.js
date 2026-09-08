import cors from 'cors';

export function allowedOrigins() {
  const configured = (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const defaults = ['https://arvotcg.com', 'https://www.arvotcg.com', 'https://admin.arvotcg.com', 'https://www.poke-30.com', 'https://poke-30.com'];
  if (process.env.NODE_ENV !== 'production') defaults.push('http://localhost:3000', 'http://localhost:3001');
  for (const value of [process.env.WEB_BASE_URL, process.env.ADMIN_BASE_URL]) {
    if (value) { try { defaults.push(new URL(value).origin); } catch { /* invalid config grants no access */ } }
  }
  return new Set([...defaults, ...configured]);
}

export function buildCors() {
  const allowed = allowedOrigins();
  return cors({
    origin(origin, cb) {
      // Native/server clients still must supply valid API authentication.
      if (!origin || allowed.has(origin)) return cb(null, true);
      const error = Object.assign(new Error('Origin not allowed'), { status: 403 });
      return cb(error);
    },
    credentials: true,
  });
}

/** 브라우저 쿠키를 자동 첨부하는 변경 요청은 정확한 Origin/Referer를 확인한다. */
export function protectCookieWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (!req.cookies?.[process.env.SESSION_COOKIE_NAME ?? 'pf30_session']) return next();
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch { /* deny below */ }
  }
  if (!origin || !allowedOrigins().has(origin)) return res.status(403).json({ error: 'invalid_origin' });
  return next();
}
