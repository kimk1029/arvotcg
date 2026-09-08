/**
 * 히어로 배너 입력 검증 — server/routes/admin.ts 의 validateBanner 와 동일 규칙.
 *
 * 문구 규칙(2026-09-08): 이미지 배너(visualType 'image')는 이미지가 배너 전체를 덮고 문구를
 * 그리지 않으므로 뱃지·제목·설명이 모두 선택(빈 값 허용, 관리용 메모). 이모지 배너는 제목만 필수.
 * 예전엔 셋 다 필수라 이미지 배너 저장이 400('badge required')으로 막혔다.
 */
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

const TEXT_LABEL = { badge: '뱃지', title: '제목', sub: '설명' } as const;

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

  // 문구 필수 여부는 비주얼 타입에 달렸으므로 먼저 판정한다.
  if (input.visualType !== undefined) {
    if (!(VISUAL_TYPES as readonly string[]).includes(String(input.visualType))) {
      return { ok: false, error: `비주얼 타입은 ${VISUAL_TYPES.join(', ')} 중 하나여야 합니다` };
    }
    out.visualType = String(input.visualType);
  } else if (!partial) out.visualType = 'emoji';
  const isImage = out.visualType === 'image';

  if (input.slideClass !== undefined) {
    if (!(SLIDE_CLASSES as readonly string[]).includes(String(input.slideClass))) {
      return { ok: false, error: `슬라이드 색상은 ${SLIDE_CLASSES.join(', ')} 중 하나여야 합니다` };
    }
    out.slideClass = String(input.slideClass);
  } else if (!partial) return { ok: false, error: '슬라이드 색상을 선택해 주세요' };

  // 뱃지·설명은 항상 선택. 제목은 이모지 배너(문구를 그리는 배너)에서만 필수.
  for (const key of ['badge', 'title', 'sub'] as const) {
    if (input[key] !== undefined && input[key] !== null) {
      if (typeof input[key] !== 'string') return { ok: false, error: `${TEXT_LABEL[key]}은(는) 문자열이어야 합니다` };
      out[key] = input[key] as string;
    } else if (!partial) out[key] = '';
  }
  if (!partial && !isImage && !(out.title ?? '').trim()) {
    return { ok: false, error: '제목을 입력해 주세요 (이모지 배너는 제목이 화면에 표시됩니다)' };
  }

  if (input.ctaHint !== undefined) out.ctaHint = (input.ctaHint as string) || null;

  if (input.visualValue !== undefined) {
    if (typeof input.visualValue !== 'string' || !input.visualValue.trim()) {
      return { ok: false, error: isImage ? '이미지를 업로드하거나 이미지 URL 을 입력해 주세요' : '이모지를 입력해 주세요' };
    }
    out.visualValue = input.visualValue;
  } else if (!partial) out.visualValue = '✨';

  if (input.onClick !== undefined) {
    if (input.onClick === null || input.onClick === '') out.onClick = null;
    else if (!(ON_CLICKS as readonly string[]).includes(String(input.onClick))) {
      return { ok: false, error: `클릭 동작은 비우거나 ${ON_CLICKS.join(', ')} 중 하나여야 합니다` };
    } else out.onClick = String(input.onClick);
  }

  if (input.linkUrl !== undefined) {
    if (input.linkUrl === null || input.linkUrl === '') out.linkUrl = null;
    else if (typeof input.linkUrl !== 'string') {
      return { ok: false, error: '연결 링크는 문자열이어야 합니다' };
    } else {
      const trimmed = input.linkUrl.trim();
      if (!/^\/(?!\/)/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
        return { ok: false, error: "연결 링크는 '/' 로 시작하는 경로나 http(s):// URL 이어야 합니다" };
      }
      out.linkUrl = trimmed;
    }
  }

  if (input.sortOrder !== undefined) {
    const n = Number(input.sortOrder);
    if (!Number.isFinite(n)) return { ok: false, error: '정렬값은 숫자여야 합니다' };
    out.sortOrder = Math.trunc(n);
  } else if (!partial) out.sortOrder = 0;

  if (input.active !== undefined) out.active = !!input.active;
  else if (!partial) out.active = true;

  return { ok: true, data: out };
}
