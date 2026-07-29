'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StampRallyModal } from './StampRallyModal';
import { startRouteTransition } from './RouteProgress';

export type HeroSlideClass = 'slide-a' | 'slide-b' | 'slide-c' | 'slide-d';
export type HeroOnClick = 'stamp-rally' | 'oripa' | null;

/** DB 또는 폴백 상수에서 오는 직렬화 가능한 형태. visual 은 emoji/image 두 종류만. */
export interface HeroSlideData {
  cls: HeroSlideClass;
  badge: string;
  title: string;
  sub: string;
  visualType: 'emoji' | 'image';
  visualValue: string;
  onClick: HeroOnClick;
  /** 클릭 시 이동할 링크(내부 '/...' 또는 외부 'http...'). onClick 특수 액션이 없을 때만 사용. */
  linkUrl?: string | null;
  ctaHint?: string | null;
}

interface Slide {
  cls: HeroSlideClass;
  badge: string;
  title: string;
  sub: string;
  visual: ReactNode;
  onClick: HeroOnClick;
  linkUrl?: string | null;
  ctaHint?: string | null;
}

/** DB 가 비었을 때를 위한 폴백 — 어드민에서 모두 삭제해도 빈 화면이 되지 않도록. */
const FALLBACK_SLIDES: HeroSlideData[] = [
  {
    cls: 'slide-a',
    badge: '★ 팬 프로젝트',
    title: '스탬프\n랠리!',
    // IP 이미지(잉어킹 프로모 카드) 사용 금지 — 이모지 비주얼로 대체.
    sub: '성수 6곳 스탬프 랠리\n탭해서 이벤트 상세 보기',
    visualType: 'emoji',
    visualValue: '🎪',
    onClick: 'stamp-rally',
    ctaHint: '👉 TAP',
  },
  {
    cls: 'slide-b',
    badge: '⚡ 실시간 거래 활성',
    title: '삽니다\n팝니다',
    sub: '성수 현장 직거래\n장소 태그로 빠르게 연결',
    visualType: 'emoji',
    visualValue: '💬',
    onClick: null,
  },
  {
    cls: 'slide-c',
    badge: '📢 30초 제보',
    title: '지금\n제보하기',
    sub: '방금 본 현장 상황을\n다른 트레이너에게 알려주세요',
    visualType: 'emoji',
    visualValue: '📢',
    onClick: null,
  },
  // 오리파 슬라이드는 서비스 숨김 상태(2026-07)라 폴백에서 제외.
];

const AUTOPLAY_MS = 3500;

function renderVisual(s: HeroSlideData): ReactNode {
  if (s.visualType === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.visualValue} alt={s.badge} className="hero-promo-card" />
    );
  }
  return <div style={{ fontSize: 69, lineHeight: 1 }}>{s.visualValue}</div>;
}

interface HeroSliderProps {
  slides?: HeroSlideData[];
  /** 작게 한 줄로 — 메인(off) 레이아웃의 레벨 아래 컴팩트 배너. */
  compact?: boolean;
}

export function HeroSlider({ slides, compact = false }: HeroSliderProps = {}) {
  const router = useRouter();
  const { status } = useSession();
  const source = slides && slides.length > 0 ? slides : FALLBACK_SLIDES;
  const SLIDES: Slide[] = source.map((s) => ({
    cls: s.cls,
    badge: s.badge,
    title: s.title,
    sub: s.sub,
    visual: renderVisual(s),
    onClick: s.onClick,
    linkUrl: s.linkUrl ?? null,
    ctaHint: s.ctaHint ?? null,
  }));
  const [cur, setCur] = useState(0);
  const [showRally, setShowRally] = useState(false);
  const startX = useRef(0);
  const dragged = useRef(false);
  const tmr = useRef<ReturnType<typeof setInterval> | null>(null);
  const n = SLIDES.length;

  const go = useCallback((i: number) => setCur((i + n) % n), [n]);

  const reset = useCallback(() => {
    if (tmr.current) clearInterval(tmr.current);
    tmr.current = setInterval(() => setCur((c) => (c + 1) % n), AUTOPLAY_MS);
  }, [n]);

  useEffect(() => {
    tmr.current = setInterval(() => setCur((c) => (c + 1) % n), AUTOPLAY_MS);
    return () => {
      if (tmr.current) clearInterval(tmr.current);
    };
  }, [n]);

  const handleSlideClick = (slide: Slide) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (slide.onClick === 'stamp-rally') {
      setShowRally(true);
      if (tmr.current) clearInterval(tmr.current);
      return;
    }
    if (slide.onClick === 'oripa') {
      if (status === 'authenticated') {
        startRouteTransition();
        router.push('/my/oripa');
      } else {
        const ok = window.confirm(
          '오리파 뽑기는 로그인이 필요합니다.\n로그인하러 가시겠어요?',
        );
        if (ok) {
          startRouteTransition();
          router.push('/login?callbackUrl=/my/oripa');
        }
      }
      return;
    }
    // 특수 액션이 없으면 어드민에서 지정한 연결 링크로 이동.
    if (slide.linkUrl) {
      if (/^https?:\/\//i.test(slide.linkUrl)) {
        window.open(slide.linkUrl, '_blank', 'noopener,noreferrer');
      } else {
        startRouteTransition();
        router.push(slide.linkUrl);
      }
    }
  };

  return (
    <>
      <div
        className={`hero-wrap${compact ? ' hero-wrap--compact' : ''}`}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          dragged.current = false;
        }}
        onTouchMove={(e) => {
          const dx = Math.abs(e.touches[0].clientX - startX.current);
          if (dx > 8) dragged.current = true;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - startX.current;
          if (dx < -30) {
            go(cur + 1);
            reset();
          } else if (dx > 30) {
            go(cur - 1);
            reset();
          }
        }}
      >
        <div className="hero-track" style={{ transform: `translateX(${-cur * 100}%)` }}>
          {SLIDES.map((sl, i) => (
            <div
              key={i}
              className={`hero-slide ${sl.cls}${sl.onClick || sl.linkUrl ? ' clickable' : ''}`}
              onClick={() => handleSlideClick(sl)}
              role={sl.onClick || sl.linkUrl ? 'button' : undefined}
              tabIndex={sl.onClick || sl.linkUrl ? 0 : undefined}
            >
              <span className="hero-badge">{sl.badge}</span>
              {sl.ctaHint && <span className="hero-cta-hint">{sl.ctaHint}</span>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <h1>
                    {sl.title.split('\n').map((line, j) => (
                      <span key={j}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </h1>
                  <p>
                    {sl.sub.split('\n').map((line, j) => (
                      <span key={j}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </p>
                </div>
                {sl.visual}
              </div>
            </div>
          ))}
        </div>
        <div className="hero-dots">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`hdot ${i === cur ? 'on' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                go(i);
                reset();
              }}
            />
          ))}
        </div>
      </div>

      {showRally && <StampRallyModal onClose={() => setShowRally(false)} />}
    </>
  );
}
