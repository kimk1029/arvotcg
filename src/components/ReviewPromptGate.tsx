'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hasEmbedQuery, isEmbedUserAgent } from '../../shared/embed';
import {
  INITIAL_REVIEW_STATE,
  STORE_REVIEW_URL,
  markAsked,
  shouldAskReview,
  storePlatformFromUa,
  type ReviewPromptState,
} from '../../shared/reviewPrompt';

const KEY = 'pf30:reviewPrompt';
const SESSION_KEY = 'pf30:reviewPrompt:visited';
/** 후기 요청을 띄우지 않는 경로 — 로그인·온보딩·공유/이벤트 페이지(앱 WebView 로 열리는 곳). */
const SKIP_PREFIXES = ['/login', '/onboarding', '/flex/', '/event/', '/auth'];

function load(): ReviewPromptState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...INITIAL_REVIEW_STATE, ...(JSON.parse(raw) as Partial<ReviewPromptState>) } : INITIAL_REVIEW_STATE;
  } catch {
    return INITIAL_REVIEW_STATE;
  }
}
function save(s: ReviewPromptState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 실패는 무시 */ }
}

/**
 * 3번째 방문에 한 번 "앱이 마음에 드세요?" 를 묻는 후기 요청창 — 앱 ReviewPromptGate 페어.
 * 방문 = 브라우저 세션 단위(sessionStorage). 좋아요 → 스토어 리뷰(OS 별 링크), 아쉬워요 → 의견 보내기(버그 제보).
 * 보상은 없다(스토어 정책). 앱 WebView 임베드에선 앱이 직접 띄우므로 여기선 건너뛴다.
 */
export function ReviewPromptGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isEmbedUserAgent(navigator.userAgent) || hasEmbedQuery(window.location.search)) return;
    if (SKIP_PREFIXES.some((p) => pathname?.startsWith(p))) return;
    let s = load();
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1');
        s = { ...s, visits: s.visits + 1 };
        save(s);
      }
    } catch { /* sessionStorage 불가 — 이번 방문은 세지 않는다 */ }
    if (!shouldAskReview(s)) return;
    setPlatform(storePlatformFromUa(navigator.userAgent));
    // 화면이 그려진 뒤 살짝 늦게.
    const t = setTimeout(() => {
      save(markAsked(load()));
      setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
    // 첫 마운트에서만 판단 — 경로 이동마다 다시 묻지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const finish = (status: ReviewPromptState['status']) => {
    save({ ...load(), status });
    setOpen(false);
  };
  const goReview = () => {
    const url = platform ? STORE_REVIEW_URL[platform] : STORE_REVIEW_URL.android;
    window.open(url, '_blank', 'noopener');
    finish('done');
  };
  const goFeedback = () => {
    finish('later');
    router.push('/my/bug-report');
  };

  return (
    <div className="cv-sheet-overlay" onClick={() => finish('later')} role="dialog" aria-modal="true">
      <div className="cv-sheet-modal" onClick={(e) => e.stopPropagation()} style={{ padding: '22px 20px 18px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⭐</div>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginTop: 8 }}>아르보TCG, 쓸 만하세요?</div>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 12.5, color: 'var(--ink3)', marginTop: 6, lineHeight: 1.6 }}>
            짧은 후기 하나가 다음 기능을 만드는 힘이 돼요.<br />아쉬운 점은 의견 보내기로 바로 알려주세요.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={goReview} style={{ height: 46, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'var(--ink)', color: 'var(--white)', fontFamily: 'var(--f1)', fontSize: 14, fontWeight: 800 }}>
            좋아요, 후기 남길게요 {platform === 'ios' ? '(App Store)' : platform === 'android' ? '(Google Play)' : ''}
          </button>
          <button type="button" onClick={goFeedback} style={{ height: 42, borderRadius: 12, border: '1.5px solid var(--pap3)', cursor: 'pointer', background: 'var(--white)', color: 'var(--ink)', fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 800 }}>
            아쉬운 점이 있어요 (의견 보내기)
          </button>
          <button type="button" onClick={() => finish('later')} style={{ height: 36, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink3)', fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 700 }}>
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
