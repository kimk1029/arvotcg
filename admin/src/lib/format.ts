import { KST_OFFSET_MS } from '../../../shared/kst';
import { isEmbedUserAgent } from '../../../shared/embed';

/** KST 'YYYY-MM-DD HH:mm' — 운영 어드민은 UTC 서버라 로컬 시간을 쓰면 9시간 어긋난다. */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '-';
  const k = new Date(dt.getTime() + KST_OFFSET_MS);
  return `${k.toISOString().slice(0, 10)} ${k.toISOString().slice(11, 16)}`;
}

/**
 * 로그 줄 시각 — KST 'MM-DD HH:mm:ss'.
 * 운영 서버가 UTC 라 pm2 원문(atIso 없이)은 9시간 어긋난다. 실제 시점(atIso)만 변환한다.
 */
export function fmtLogTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const k = new Date(t + KST_OFFSET_MS).toISOString();
  return `${k.slice(5, 10)} ${k.slice(11, 19)}`;
}

/** UA 한 줄 요약 — 'iOS' | 'Android' | 'PC' (+ ' 웹뷰'), 방문 기록 기기 열. */
export function deviceOf(ua: string | null | undefined): string {
  if (!ua) return '-';
  // 앱 네이티브 UA: iOS 는 'CFNetwork/… Darwin/…', Android 는 'okhttp/…'
  const os = /iPhone|iPad|iPod|CFNetwork|Darwin/.test(ua) ? 'iOS' : /Android|okhttp/.test(ua) ? 'Android' : 'PC';
  return isEmbedUserAgent(ua) ? `${os} 웹뷰` : os;
}

/** referer 의 호스트만 (자기 도메인·없음은 '-'). */
export function refererHost(ref: string | null | undefined): string {
  if (!ref) return '-';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    return /arvotcg\.com$|poke-30\.com$/.test(h) ? '-' : h;
  } catch {
    return '-';
  }
}

export function trunc(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function parseIntParam(v: string | null | undefined, def: number, min = 1, max = 1_000_000): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.floor(n), min), max);
}
