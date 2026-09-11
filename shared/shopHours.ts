/**
 * 카드샵 상세 — 영업시간/휴무 텍스트에서 지금 영업 상태를 읽는다 (웹·앱 공통 정본).
 * 어드민이 자유 텍스트로 넣으므로 관대하게 파싱한다:
 *  · hours: 첫 두 HH:MM 을 열고/닫는 시각으로 ("10:00 - 21:00", "10:00~21:00", "10시~21시" 는 미지원→null)
 *  · closedDays: 오늘 요일이 "월요일"/"매주 월" 처럼 들어 있으면 휴무, "연중무휴" 면 휴무 없음
 * 판단 불가면 null (UI 는 라벨을 숨긴다).
 */
import { KST_OFFSET_MS } from './kst';

export type ShopOpenState = 'open' | 'closed' | 'dayoff';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** "a, b, c" → ['a','b','c'] (빈 항목 제거). 어드민 태그 입력 정본 파서. */
export function parseTags(s: string | null | undefined): string[] {
  return (s ?? '').split(/[,，\n]/).map((t) => t.trim()).filter(Boolean);
}

export function shopOpenState(hours: string | null | undefined, closedDays: string | null | undefined, now: number | Date = Date.now()): ShopOpenState | null {
  const t = new Date((typeof now === 'number' ? now : now.getTime()) + KST_OFFSET_MS);
  const wd = WEEKDAYS[t.getUTCDay()];
  const off = (closedDays ?? '').trim();
  if (off && !/연중\s*무휴/.test(off)) {
    // "월요일" · "매주 월" · "월, 화" — 오늘 요일 글자가 요일 문맥으로 들어 있으면 휴무
    if (new RegExp(`${wd}(요일|\\s*[,、/]|\\s*$)`).test(off) || new RegExp(`매주\\s*${wd}`).test(off)) return 'dayoff';
  }
  const m = (hours ?? '').match(/(\d{1,2}):(\d{2})/g);
  if (!m || m.length < 2) return null;
  const toMin = (s: string) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };
  const open = toMin(m[0]);
  const close = toMin(m[1]);
  const cur = t.getUTCHours() * 60 + t.getUTCMinutes();
  // 자정을 넘기는 영업(예: 14:00 - 02:00)
  const isOpen = close > open ? cur >= open && cur < close : cur >= open || cur < close;
  return isOpen ? 'open' : 'closed';
}

export const SHOP_OPEN_LABEL: Record<ShopOpenState, { label: string; color: string }> = {
  open: { label: '영업 중', color: '#1E8E5A' },
  closed: { label: '영업 종료', color: '#9A9AA0' },
  dayoff: { label: '오늘 휴무', color: '#F5333F' },
};
