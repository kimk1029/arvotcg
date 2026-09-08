import { prisma } from '../lib/prisma.js';
import { extractToken, verifySession } from '../lib/auth.js';

const verified = Symbol('verifiedSession');

export async function requireAuth(req, res, next) {
  if (req[verified]) return next();
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const session = await verifySession(token);
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    req.user = session;
    req[verified] = true;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = await verifySession(token);
  } catch {
    // Ignore — treat as anonymous
  }
  next();
}
