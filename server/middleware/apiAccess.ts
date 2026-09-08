import type { Request, Response, NextFunction } from 'express';
import { isPublicApi, hasIndependentApiAuth } from '../../shared/accessPolicy';
import { requireAuth } from './requireAuth.js';

/** /api 마운트에 사용. 라우트 추가 시에도 기본값은 로그인 필수다. */
export function apiAccess(req: Request, res: Response, next: NextFunction) {
  const path = `/api${req.path}`;
  if (isPublicApi(path, req.method) || hasIndependentApiAuth(path, req.method)) return next();
  // 기존 조회 라우트의 public 캐시 헤더도 덮어써 인증 응답의 공용 캐시를 막는다.
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (name, value) => setHeader(name,
    name.toLowerCase() === 'cache-control' ? 'private, no-store' : value);
  res.setHeader('Cache-Control', 'private, no-store');
  return requireAuth(req, res, next);
}
