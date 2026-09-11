/**
 * 카드샵 상세 — 외부 앱 링크 정본 (웹·앱 공통).
 *  · 네이버지도 길안내: nmap://route/car (앱 스킴, 문서 https://guide.ncloud-docs.com/docs/maps-url-scheme)
 *    → 미설치/데스크톱 폴백은 네이버지도 웹 검색(주소)
 *  · 티맵 길안내: tmap://route (앱 스킴) → 폴백 https://tmap.life (웹 길안내 URL 없음)
 *  · 인스타그램: 어드민이 "@handle" / "handle" / 프로필 URL 어느 것을 넣어도 handle 로 정규화
 */

export interface RouteTarget {
  lat: number;
  lng: number;
  name: string;
}

/** 앱 식별자 — 네이버지도 스킴의 appname 파라미터(패키지/번들 ID). */
const APP_NAME = 'com.arvotcg.app';

export function naverMapRouteUrl(t: RouteTarget): string {
  return `nmap://route/car?dlat=${t.lat}&dlng=${t.lng}&dname=${encodeURIComponent(t.name)}&appname=${APP_NAME}`;
}

export function naverMapWebUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

export function tmapRouteUrl(t: RouteTarget): string {
  return `tmap://route?goalx=${t.lng}&goaly=${t.lat}&goalname=${encodeURIComponent(t.name)}`;
}

export const TMAP_WEB_URL = 'https://tmap.life';

/** "@poke_lab" · "poke_lab" · "https://www.instagram.com/poke_lab/?hl=ko" → "poke_lab". 비어 있거나 못 읽으면 null. */
export function instagramHandle(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  const h = (m ? m[1] : raw.replace(/^@/, '')).replace(/\/+$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null;
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

/** 프로필 임베드(최근 게시물 그리드) — 공개 계정만 표시된다. */
export function instagramEmbedUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/embed/`;
}

/** 카드샵 이미지 표시 URL — 서버 리사이즈·webp·디스크 캐시 프록시(/api/img). 상대경로라 앱은 absApiUrl 로 절대화. */
export type ShopImageWidth = 96 | 200 | 400 | 800;
export function shopImageUrl(imageUrl: string | null | undefined, w: ShopImageWidth): string | null {
  const u = (imageUrl ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  return `/api/img?u=${encodeURIComponent(u)}&w=${w}`;
}
