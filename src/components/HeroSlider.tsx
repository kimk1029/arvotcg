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
  /** 이미지 슬라이드: 배너 전체를 덮는 이미지 URL (visualType === 'image'). */
  fullImage?: string | null;
}

/** DB 가 비었을 때를 위한 폴백 — 어드민에서 모두 삭제해도 빈 화면이 되지 않도록. */
const FALLBACK_SLIDES: HeroSlideData[] = [
  {
    cls: 'slide-a',
    badge: '📈 실시간 시세',
    title: '카드 시세\n한눈에',
    sub: 'TCG 카드\n실시간 시세 검색',
    visualType: 'emoji',
    visualValue: '📈',
    onClick: null,
    linkUrl: '/cards',
    ctaHint: '👉 TAP',
  },
  {
    cls: 'slide-b',
    badge: '⚡ 실시간 거래 활성',
    title: '삽니다\n팝니다',
    sub: '카드 직거래 게시판\n쪽지로 빠르게 연결',
    visualType: 'emoji',
    visualValue: '💬',
    onClick: null,
    linkUrl: '/trade',
  },
  {
    cls: 'slide-c',
    badge: '💬 커뮤니티',
    title: '오늘의\n피드',
    sub: '카드 이야기와 정보를\n피드에서 나눠보세요',
    visualType: 'emoji',
    visualValue: '📣',
    onClick: null,
    linkUrl: '/feed',
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
    fullImage: s.visualType === 'image' ? s.visualValue : null,
  }));
  const [cur, setCur] = useState(0);
  const [showRally, setShowRally] = useState(false);
  const startX = useRef(0);
  const dragged = useRef(false);
  // 래퍼 높이를 "현재 슬라이드"의 실제 높이에 맞춘다 — 이미지 슬라이드는 어드민이 올린 이미지
  // 비율 그대로(좌우·상하 잘림/여백 없음), 텍스트 슬라이드는 자기 콘텐츠 높이. 전환 시 높이 트랜지션.
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [wrapH, setWrapH] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = slideRefs.current[cur];
    if (!el) return;
    const measure = () => setWrapH(el.offsetHeight);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    // 이미지 로드 후 높이가 정해지는 경우
    const img = el.querySelector('img');
    img?.addEventListener('load', measure);
    return () => { ro?.disconnect(); img?.removeEventListener('load', measure); };
  }, [cur, SLIDES.length]);
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
        style={wrapH ? { height: wrapH } : undefined}
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
              ref={(el) => { slideRefs.current[i] = el; }}
              className={`hero-slide ${sl.cls}${sl.onClick || sl.linkUrl ? ' clickable' : ''}${sl.fullImage ? ' hero-slide--image' : ''}`}
              onClick={() => handleSlideClick(sl)}
              role={sl.onClick || sl.linkUrl ? 'button' : undefined}
              tabIndex={sl.onClick || sl.linkUrl ? 0 : undefined}
            >
              {sl.fullImage ? (
                // 이미지 슬라이드 — 어드민 업로드 이미지가 배너 전체를 꽉 채운다(문구는 이미지 안에).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sl.fullImage} alt={sl.badge} className="hero-bg" draggable={false} />
              ) : (
              <>
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
              </>
              )}
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
