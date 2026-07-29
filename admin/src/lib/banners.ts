/** 히어로 배너 입력 검증 — server/routes/admin.ts 의 validateBanner 와 동일 규칙. */
export const SLIDE_CLASSES = ['slide-a', 'slide-b', 'slide-c', 'slide-d'] as const;

/**
 * 기본(폴백) 배너 — 웹 HeroSlider.tsx 의 FALLBACK_SLIDES 와 동일.
 * 어드민 "기본 배너 채우기" 로 DB 가 비어있을 때 시드한다.
 */
export const DEFAULT_BANNERS = [
  {
    // IP 이미지(잉어킹 프로모 카드) 사용 금지 — 이모지 비주얼로 대체(2026-07).
    sortOrder: 10, slideClass: 'slide-a', badge: '★ 팬 프로젝트',
    title: '스탬프\n랠리!', sub: '성수 6곳 스탬프 랠리\n탭해서 이벤트 상세 보기',
    ctaHint: '👉 TAP', visualType: 'emoji', visualValue: '🎪',
    onClick: 'stamp-rally', linkUrl: null, active: true,
  },
  {
    sortOrder: 20, slideClass: 'slide-b', badge: '⚡ 실시간 거래 활성',
    title: '삽니다\n팝니다', sub: '성수 현장 직거래\n장소 태그로 빠르게 연결',
    ctaHint: null, visualType: 'emoji', visualValue: '💬',
    onClick: null, linkUrl: null, active: true,
  },
  {
    sortOrder: 30, slideClass: 'slide-c', badge: '📢 30초 제보',
    title: '지금\n제보하기', sub: '방금 본 현장 상황을\n다른 트레이너에게 알려주세요',
    ctaHint: null, visualType: 'emoji', visualValue: '📢',
    onClick: null, linkUrl: null, active: true,
  },
  // 오리파 슬라이드는 서비스 숨김 상태(2026-07)라 기본 배너에서 제외.
] as const;
export const VISUAL_TYPES = ['emoji', 'image'] as const;
export const ON_CLICKS = ['stamp-rally', 'oripa'] as const;

export interface BannerInput {
  sortOrder?: number;
  slideClass?: string;
  badge?: string;
  title?: string;
  sub?: string;
  ctaHint?: string | null;
  visualType?: string;
  visualValue?: string;
  onClick?: string | null;
  linkUrl?: string | null;
  active?: boolean;
}

export function parseBannerInput(
  input: Record<string, unknown>,
  partial: boolean,
): { ok: true; data: BannerInput } | { ok: false; error: string } {
  const out: BannerInput = {};

  if (input.slideClass !== undefined) {
    if (!(SLIDE_CLASSES as readonly string[]).includes(String(input.slideClass))) {
      return { ok: false, error: `slideClass must be one of ${SLIDE_CLASSES.join(',')}` };
    }
    out.slideClass = String(input.slideClass);
  } else if (!partial) return { ok: false, error: 'slideClass is required' };

  for (const key of ['badge', 'title', 'sub'] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'string' || !(input[key] as string).trim()) {
        return { ok: false, error: `${key} required` };
      }
      out[key] = input[key] as string;
    } else if (!partial) return { ok: false, error: `${key} required` };
  }

  if (input.ctaHint !== undefined) out.ctaHint = (input.ctaHint as string) || null;

  if (input.visualType !== undefined) {
    if (!(VISUAL_TYPES as readonly string[]).includes(String(input.visualType))) {
      return { ok: false, error: `visualType must be one of ${VISUAL_TYPES.join(',')}` };
    }
    out.visualType = String(input.visualType);
  } else if (!partial) out.visualType = 'emoji';

  if (input.visualValue !== undefined) {
    if (typeof input.visualValue !== 'string' || !input.visualValue.trim()) {
      return { ok: false, error: 'visualValue required' };
    }
    out.visualValue = input.visualValue;
  } else if (!partial) out.visualValue = '✨';

  if (input.onClick !== undefined) {
    if (input.onClick === null || input.onClick === '') out.onClick = null;
    else if (!(ON_CLICKS as readonly string[]).includes(String(input.onClick))) {
      return { ok: false, error: `onClick must be null or one of ${ON_CLICKS.join(',')}` };
    } else out.onClick = String(input.onClick);
  }

  if (input.linkUrl !== undefined) {
    if (input.linkUrl === null || input.linkUrl === '') out.linkUrl = null;
    else if (typeof input.linkUrl !== 'string') {
      return { ok: false, error: 'linkUrl must be a string' };
    } else {
      const trimmed = input.linkUrl.trim();
      if (!/^\/(?!\/)/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
        return { ok: false, error: "linkUrl must start with '/' or 'http(s)://'" };
      }
      out.linkUrl = trimmed;
    }
  }

  if (input.sortOrder !== undefined) {
    const n = Number(input.sortOrder);
    if (!Number.isFinite(n)) return { ok: false, error: 'sortOrder must be a number' };
    out.sortOrder = Math.trunc(n);
  } else if (!partial) out.sortOrder = 0;

  if (input.active !== undefined) out.active = !!input.active;
  else if (!partial) out.active = true;

  return { ok: true, data: out };
}
