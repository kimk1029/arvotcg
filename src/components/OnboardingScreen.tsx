'use client';

/**
 * 온보딩 — 첫 방문 4장 슬라이드 (앱 app/onboarding.tsx 와 동일 디자인/플로우).
 * 디자인 원본: Claude Design 'ARVO 온보딩' (벡터 SVG + CSS keyframes ob*, globals.css).
 *
 *  · 건너뛰기 → 마지막 장.  다음 → 다음 장.  도트 클릭 → 해당 장.
 *  · 'ARVO TCG 시작하기' / '로그인' 링크 → 열람 플래그 저장 → 로그인돼 있으면 홈, 아니면 /login.
 * 게이트 규칙 정본은 shared/onboarding.ts.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import {
  ONBOARDING_CTA_NEXT,
  ONBOARDING_CTA_START,
  ONBOARDING_DOT_OFF,
  ONBOARDING_HAVE_ACCOUNT,
  ONBOARDING_LOGIN,
  ONBOARDING_SKIP,
  ONBOARDING_SLIDES,
  markOnboardingSeen,
  onboardingNextRoute,
} from '@/lib/onboarding';

const INK = '#16161a';

export function OnboardingScreen() {
  const router = useRouter();
  const { status } = useSession();
  const [i, setI] = useState(0);
  const last = i === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[i];

  const finish = () => {
    markOnboardingSeen();
    // 세션 판정이 아직이면 로그인으로 — /login 은 이미 로그인된 유저를 서버에서 홈으로 돌려보낸다.
    router.replace(onboardingNextRoute(status === 'authenticated'));
  };

  return (
    <div className="ob-screen">
      {/* 건너뛰기 */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 22 }}>
        {!last && (
          <button type="button" className="ob-skip" onClick={() => setI(ONBOARDING_SLIDES.length - 1)}>
            {ONBOARDING_SKIP}
          </button>
        )}
      </div>

      {/* 슬라이드 — key 로 리마운트해 등장 애니메이션을 매번 재생 */}
      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', minHeight: 0 }}>
        <div className="ob-art">
          {i === 0 && <PortfolioArt />}
          {i === 1 && <CollectionArt />}
          {i === 2 && <BoxArt />}
          {i === 3 && <CommunityArt />}
        </div>
        <div style={{ marginTop: 34, textAlign: 'center', animation: 'obIn .5s .1s both' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: slide.accent, letterSpacing: 1 }}>{slide.eyebrow}</div>
          <div style={{ fontSize: 27, fontWeight: 900, color: INK, letterSpacing: -0.9, lineHeight: 1.32, marginTop: 10, whiteSpace: 'pre-line' }}>{slide.title}</div>
          <div style={{ fontSize: 14.5, color: '#8E8E93', fontWeight: 500, lineHeight: 1.6, marginTop: 12, whiteSpace: 'pre-line' }}>{slide.desc}</div>
        </div>
      </div>

      {/* 하단: 도트 + CTA + 로그인 링크 */}
      <div style={{ padding: '0 28px calc(34px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 24 }}>
          {ONBOARDING_SLIDES.map((s, n) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${n + 1}번째 슬라이드`}
              onClick={() => setI(n)}
              style={{ width: n === i ? 26 : 7, height: 7, borderRadius: 4, background: n === i ? s.accent : ONBOARDING_DOT_OFF, border: 'none', padding: 0, cursor: 'pointer', transition: 'all .25s ease' }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={last ? finish : () => setI(i + 1)}
          style={{ width: '100%', height: 54, borderRadius: 16, border: 'none', background: slide.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: `0 8px 22px ${slide.accentShadow}`, fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{last ? ONBOARDING_CTA_START : ONBOARDING_CTA_NEXT}</span>
          {!last && (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16 }}>
          <span style={{ fontSize: 13, color: '#9A9AA0', fontWeight: 500 }}>{ONBOARDING_HAVE_ACCOUNT}</span>
          <button type="button" onClick={finish} style={{ fontSize: 13, color: INK, fontWeight: 800, cursor: 'pointer', border: 'none', background: 'none', padding: 0, fontFamily: 'inherit' }}>
            {ONBOARDING_LOGIN}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── 일러스트 (디자인 원본 SVG/HTML 그대로) ───────── */

function PortfolioArt() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', background: 'radial-gradient(circle,#FFE6CC,#FFF6EE 70%)', animation: 'obPulse 3.4s ease-in-out infinite' }} />
      <svg viewBox="0 0 220 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect x="30" y="46" width="160" height="128" rx="14" fill="#fff" stroke="#EFE3D6" strokeWidth="2" />
        <line x1="30" y1="80" x2="190" y2="80" stroke="#F4EEE7" strokeWidth="1.5" />
        <line x1="30" y1="112" x2="190" y2="112" stroke="#F4EEE7" strokeWidth="1.5" />
        <line x1="30" y1="144" x2="190" y2="144" stroke="#F4EEE7" strokeWidth="1.5" />
        <g>
          <rect x="46" y="132" width="16" height="30" rx="4" fill="#FFD9B3" style={{ transformOrigin: '54px 162px', animation: 'obRise .9s .1s cubic-bezier(.2,.9,.3,1) both' }} />
          <rect x="74" y="116" width="16" height="46" rx="4" fill="#FFC48A" style={{ transformOrigin: '82px 162px', animation: 'obRise .9s .22s cubic-bezier(.2,.9,.3,1) both' }} />
          <rect x="102" y="126" width="16" height="36" rx="4" fill="#FFD9B3" style={{ transformOrigin: '110px 162px', animation: 'obRise .9s .34s cubic-bezier(.2,.9,.3,1) both' }} />
          <rect x="130" y="98" width="16" height="64" rx="4" fill="#FF9A4D" style={{ transformOrigin: '138px 162px', animation: 'obRise .9s .46s cubic-bezier(.2,.9,.3,1) both' }} />
          <rect x="158" y="74" width="16" height="88" rx="4" fill="#FF7A00" style={{ transformOrigin: '166px 162px', animation: 'obRise .9s .58s cubic-bezier(.2,.9,.3,1) both' }} />
        </g>
        <path d="M54 140 L82 122 L110 130 L138 100 L166 72" fill="none" stroke="#F5333F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="420" style={{ animation: 'obDraw 1.5s .5s ease-out both' }} />
        <circle cx="166" cy="72" r="6" fill="#F5333F" />
        <circle cx="166" cy="72" r="9" fill="none" stroke="#F5333F" strokeWidth="2.5" style={{ transformOrigin: '166px 72px', animation: 'obPing 1.9s 1.6s ease-out infinite' }} />
      </svg>
      <div style={{ position: 'absolute', top: 6, right: -2, background: INK, borderRadius: 12, padding: '7px 12px', boxShadow: '0 8px 20px rgba(0,0,0,.2)', animation: 'obFloat 4s ease-in-out infinite' }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: '#FF9A4D', whiteSpace: 'nowrap' }}>+17.4% ▲</span>
      </div>
      <div style={{ position: 'absolute', left: -6, bottom: 2, width: 92, height: 70 }}>
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: 44, height: 60, borderRadius: 7, background: 'linear-gradient(150deg,#9d6bd6,#4568dc)', boxShadow: '0 6px 14px rgba(0,0,0,.18)', animation: 'obFloat2 5s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💎</div>
        <div style={{ position: 'absolute', left: 22, bottom: 6, width: 44, height: 60, borderRadius: 7, background: 'linear-gradient(150deg,#f9d423,#ff8a3c)', boxShadow: '0 6px 14px rgba(0,0,0,.18)', animation: 'obFloat 4.4s .3s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚡</div>
        <div style={{ position: 'absolute', left: 44, bottom: 0, width: 44, height: 60, borderRadius: 7, background: 'linear-gradient(150deg,#ff8a3c,#e11d2a)', boxShadow: '0 6px 14px rgba(0,0,0,.18)', animation: 'obFloat2 4.8s .6s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔥</div>
        <div style={{ position: 'absolute', right: -16, top: -6, background: '#fff', borderRadius: 10, padding: '4px 8px', boxShadow: '0 4px 12px rgba(0,0,0,.14)', animation: 'obBob 3s ease-in-out infinite', whiteSpace: 'nowrap' }}><span style={{ fontSize: 10.5, fontWeight: 900, color: INK }}>132장</span></div>
      </div>
    </>
  );
}

function CollectionArt() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', background: 'radial-gradient(circle,#E7E2FF,#F5F3FF 70%)', animation: 'obPulse 3.8s ease-in-out infinite' }} />
      {/* 피카츄 */}
      <div style={{ position: 'absolute', left: 34, top: 52, width: 88, height: 122, borderRadius: 11, padding: 5, background: '#f2c531', boxShadow: '0 10px 24px rgba(60,40,140,.28)', animation: 'obFloat2 5.2s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 7, background: 'linear-gradient(160deg,#fff7c2,#ffd54a 60%,#f0a500)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 5, left: 6, right: 6, display: 'flex', justifyContent: 'space-between', fontSize: 6.5, fontWeight: 900, color: '#3a2a00' }}><span>피카츄 ex</span><span>HP 190</span></div>
          <div style={{ position: 'absolute', top: 18, left: 6, right: 6, height: 54, borderRadius: 4, background: 'radial-gradient(circle at 50% 45%,#fff,#ffe58a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>⚡</div>
          <div style={{ position: 'absolute', bottom: 14, left: 6, right: 6, height: 3, borderRadius: 2, background: 'rgba(58,42,0,.25)' }} />
          <div style={{ position: 'absolute', bottom: 8, left: 6, height: 3, borderRadius: 2, background: 'rgba(58,42,0,.18)', width: '60%' }} />
          <div style={{ position: 'absolute', bottom: 3, right: 6, fontSize: 5.5, fontWeight: 900, color: '#3a2a00' }}>025/165 SAR</div>
        </div>
      </div>
      {/* 루피 */}
      <div style={{ position: 'absolute', left: 82, top: 38, width: 88, height: 122, borderRadius: 11, padding: 5, background: INK, boxShadow: '0 12px 28px rgba(60,40,140,.26)', animation: 'obFloat 4.4s .3s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 7, background: 'linear-gradient(160deg,#c9262d,#7a0d16)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', color: '#c9262d', fontSize: 7, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</span><span style={{ fontSize: 6, fontWeight: 900, color: '#fff' }}>LEADER</span></div>
          <div style={{ position: 'absolute', top: 22, left: 6, right: 6, height: 56, borderRadius: 4, background: 'radial-gradient(circle at 50% 40%,#ffb37a,#c9262d 75%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🏴‍☠️</div>
          <div style={{ position: 'absolute', bottom: 14, left: 6, fontSize: 6.5, fontWeight: 900, color: '#fff' }}>몽키 D. 루피</div>
          <div style={{ position: 'absolute', bottom: 4, left: 6, right: 6, display: 'flex', justifyContent: 'space-between', fontSize: 5.5, fontWeight: 800, color: 'rgba(255,255,255,.75)' }}><span>OP01-003</span><span>SEC</span></div>
        </div>
      </div>
      {/* 리자몽 */}
      <div style={{ position: 'absolute', left: 128, top: 54, width: 88, height: 122, borderRadius: 11, padding: 5, background: '#e11d2a', boxShadow: '0 10px 24px rgba(160,40,30,.3)', animation: 'obFloat2 4.8s .6s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 7, background: 'linear-gradient(160deg,#ffb37a,#ff6a3d 55%,#c81d25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 5, left: 6, right: 6, display: 'flex', justifyContent: 'space-between', fontSize: 6.5, fontWeight: 900, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}><span>리자몽 ex</span><span>HP 330</span></div>
          <div style={{ position: 'absolute', top: 18, left: 6, right: 6, height: 54, borderRadius: 4, background: 'radial-gradient(circle at 50% 45%,#ffe0b3,#ff7a4d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🔥</div>
          <div style={{ position: 'absolute', bottom: 14, left: 6, right: 6, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.4)' }} />
          <div style={{ position: 'absolute', bottom: 8, left: 6, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.3)', width: '55%' }} />
          <div style={{ position: 'absolute', bottom: 3, right: 6, fontSize: 5.5, fontWeight: 900, color: '#fff' }}>201/165 SAR</div>
        </div>
      </div>
      <svg viewBox="0 0 220 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <g fill="none" stroke="#6a3aff" strokeWidth="4" strokeLinecap="round">
          <path d="M50 178 L50 194 L66 194" /><path d="M170 178 L170 194 L154 194" />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 52, right: 52, top: 56, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,transparent,#6a3aff,transparent)', boxShadow: '0 0 14px rgba(106,58,255,.7)', animation: 'obSweep 2.6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 14, padding: '8px 14px', boxShadow: '0 8px 22px rgba(0,0,0,.14)', display: 'flex', alignItems: 'center', gap: 7, animation: 'obBob 3.2s ease-in-out infinite' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2BB673', animation: 'obGlow 1.6s ease-in-out infinite' }} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>132장 등록됨</span>
      </div>
    </>
  );
}

function BoxArt() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: 'radial-gradient(circle,#DCEBFF,#F2F7FF 70%)', animation: 'obPulse 3.2s ease-in-out infinite' }} />
      <svg viewBox="0 0 220 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g style={{ animation: 'obFloat 4.8s ease-in-out infinite' }}>
          <path d="M54 118 L54 168 L110 190 L110 140 Z" fill="#3f6bcc" />
          <path d="M166 118 L166 168 L110 190 L110 140 Z" fill="#2f56a8" />
          <path d="M54 118 L110 140 L166 118 L110 96 Z" fill="#5b86e5" />
          <path d="M54 118 L32 100 L88 78 L110 96 Z" fill="#7aa3f0" />
          <path d="M166 118 L188 100 L132 78 L110 96 Z" fill="#6b94e6" />
        </g>
        <circle cx="110" cy="120" r="34" fill="none" stroke="#3B7BF6" strokeWidth="2" strokeDasharray="5 8" style={{ transformOrigin: '110px 120px', animation: 'obSpin 18s linear infinite' }} />
      </svg>
      <div style={{ position: 'absolute', left: 52, top: 26, width: 44, height: 62, borderRadius: 6, padding: 3, background: '#f2c531', boxShadow: '0 8px 18px rgba(0,0,0,.2)', animation: 'obFloat2 4.4s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 4, background: 'linear-gradient(160deg,#fff7c2,#f0a500)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}><span style={{ fontSize: 20 }}>⚡</span><span style={{ fontSize: 6, fontWeight: 900, color: '#3a2a00', background: '#fff', padding: '1px 4px', borderRadius: 3 }}>SAR</span></div>
      </div>
      <div style={{ position: 'absolute', left: 88, top: 12, width: 44, height: 62, borderRadius: 6, padding: 3, background: 'linear-gradient(135deg,#e6e6ef,#b8b8c8)', boxShadow: '0 10px 22px rgba(0,0,0,.22)', animation: 'obFloat 4s .3s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 4, background: 'linear-gradient(160deg,#ffffff,#d6d9e8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}><span style={{ fontSize: 20 }}>💎</span><span style={{ fontSize: 6, fontWeight: 900, color: '#fff', background: INK, padding: '1px 4px', borderRadius: 3 }}>SSR</span></div>
      </div>
      <div style={{ position: 'absolute', left: 124, top: 26, width: 44, height: 62, borderRadius: 6, padding: 3, background: INK, boxShadow: '0 8px 18px rgba(0,0,0,.22)', animation: 'obFloat2 4.8s .6s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 4, background: 'linear-gradient(160deg,#2b2b36,#0e0e12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}><span style={{ fontSize: 20 }}>🌙</span><span style={{ fontSize: 6, fontWeight: 900, color: INK, background: '#fff', padding: '1px 4px', borderRadius: 3 }}>BWR</span></div>
      </div>
      <div style={{ position: 'absolute', top: 60, right: -10, width: 96, background: INK, borderRadius: 12, padding: '8px 10px', boxShadow: '0 8px 20px rgba(0,0,0,.22)', animation: 'obFloat2 4.6s ease-in-out infinite' }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap' }}>TCG 인덱스</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}><span style={{ fontSize: 12.5, fontWeight: 900, color: '#fff' }}>1,284.6</span><span style={{ fontSize: 9.5, fontWeight: 900, color: '#FF7A6B' }}>+2.8%</span></div>
        <svg viewBox="0 0 80 26" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 24, marginTop: 5 }}>
          <path d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,4 L80,26 L0,26 Z" fill="rgba(255,122,0,.25)" />
          <path d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,4" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="140" style={{ animation: 'obDraw 1.6s .4s ease-out both' }} vectorEffect="non-scaling-stroke" />
          <circle cx="80" cy="4" r="2.5" fill="#FF7A00" />
        </svg>
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: -4, display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 14, padding: '8px 13px', boxShadow: '0 8px 20px rgba(0,0,0,.14)', animation: 'obBob 3s ease-in-out infinite' }}>
        <span style={{ fontSize: 14 }}>✨</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>히트카드 6종</span>
      </div>
    </>
  );
}

function CommunityArt() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', background: 'radial-gradient(circle,#DCF3E6,#F1FBF5 70%)', animation: 'obPulse 3.6s ease-in-out infinite' }} />
      <svg viewBox="0 0 220 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect x="28" y="84" width="164" height="112" rx="16" fill="#EAF6EE" stroke="#CDEBDA" strokeWidth="2" />
        <path d="M28 130 L192 130" stroke="#fff" strokeWidth="7" />
        <path d="M96 84 L96 196" stroke="#fff" strokeWidth="7" />
        <path d="M28 160 L192 160" stroke="#fff" strokeWidth="5" />
        <path d="M150 84 L150 196" stroke="#fff" strokeWidth="5" />
        <rect x="40" y="96" width="42" height="22" rx="4" fill="#DCEFE2" />
        <rect x="106" y="140" width="34" height="14" rx="3" fill="#DCEFE2" />
        <rect x="160" y="168" width="24" height="20" rx="3" fill="#DCEFE2" />
        <g style={{ transformOrigin: '66px 148px', animation: 'obBob 3s ease-in-out infinite' }}>
          <path d="M66 162 C56 150 56 142 66 136 C76 142 76 150 66 162 Z" fill="#9A9AA0" /><circle cx="66" cy="144" r="3.5" fill="#fff" />
        </g>
        <g style={{ transformOrigin: '170px 118px', animation: 'obBob 3.4s .6s ease-in-out infinite' }}>
          <path d="M170 132 C160 120 160 112 170 106 C180 112 180 120 170 132 Z" fill="#9A9AA0" /><circle cx="170" cy="114" r="3.5" fill="#fff" />
        </g>
        <g style={{ transformOrigin: '124px 118px', animation: 'obBob 2.6s .3s ease-in-out infinite' }}>
          <circle cx="124" cy="122" r="9" fill="none" stroke="#2BB673" strokeWidth="2.5" style={{ transformOrigin: '124px 122px', animation: 'obPing 2s ease-out infinite' }} />
          <path d="M124 134 C110 118 110 108 124 100 C138 108 138 118 124 134 Z" fill="#2BB673" /><circle cx="124" cy="111" r="4.5" fill="#fff" />
        </g>
        <g style={{ animation: 'obFloat 4.6s ease-in-out infinite' }}>
          <rect x="36" y="22" width="92" height="42" rx="13" fill="#fff" stroke="#D6EEE0" strokeWidth="2" />
          <path d="M56 64 L56 76 L70 64 Z" fill="#fff" stroke="#D6EEE0" strokeWidth="2" />
          <circle cx="58" cy="43" r="4" fill="#2BB673" /><circle cx="74" cy="43" r="4" fill="#9ADCBB" /><circle cx="90" cy="43" r="4" fill="#CDEBDA" />
        </g>
      </svg>
      <div style={{ position: 'absolute', top: 150, left: 118, width: 104, background: '#fff', borderRadius: 11, padding: '7px 9px', boxShadow: '0 10px 22px rgba(0,0,0,.16)', animation: 'obFloat2 4.4s .4s ease-in-out infinite' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><span style={{ fontSize: 10, fontWeight: 900, color: INK }}>성수 카드샵</span><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B7BF6', color: '#fff', fontSize: 6.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, whiteSpace: 'nowrap' }}><span style={{ fontSize: 9, color: '#F0A500' }}>★★★★★</span><span style={{ fontSize: 8.5, fontWeight: 800, color: INK }}>4.8</span><span style={{ fontSize: 8, color: '#9A9AA0' }}>후기 128</span></div>
        <div style={{ display: 'flex', gap: 3, marginTop: 5 }}><span style={{ fontSize: 7, fontWeight: 800, color: '#2BB673', background: '#E3F6EC', padding: '2px 5px', borderRadius: 5, whiteSpace: 'nowrap' }}>오리파 多</span><span style={{ fontSize: 7, fontWeight: 800, color: '#6a3aff', background: '#EFEBFF', padding: '2px 5px', borderRadius: 5, whiteSpace: 'nowrap' }}>싱글 판매</span></div>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 2, width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(150deg,#ffe08a,#ffb347)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, boxShadow: '0 8px 18px rgba(0,0,0,.14)', animation: 'obBob 3s ease-in-out infinite' }}>🐹</div>
      <div style={{ position: 'absolute', top: 56, right: 36, width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(150deg,#9d6bff,#6a3aff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, boxShadow: '0 8px 18px rgba(0,0,0,.14)', animation: 'obBob 3.6s .5s ease-in-out infinite' }}>👾</div>
    </>
  );
}
