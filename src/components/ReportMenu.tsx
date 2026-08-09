'use client';

import { useState } from 'react';
import { useSession } from '@/lib/session';

/**
 * 게시글/댓글 "⋯" 신고·차단 메뉴 (App Store 심사 지침 1.2 요건).
 * 앱 mobile/src/components/ReportMenu.tsx 와 페어 — 같은 플로우:
 * ⋯ → [신고하기 | 사용자 차단] → 신고면 사유 선택 → POST /api/reports.
 * 차단은 POST /api/me/blocks 후 목록 새로고침(서버 필터가 글을 숨김).
 * 내 글(authorId === 세션 id)에는 렌더하지 않는다.
 */

export type ReportTargetType = 'trade' | 'feed' | 'feedComment' | 'eventPost' | 'eventPostComment';

/** 신고 사유 선택지 — 서버 REPORT_REASONS 와 동일 목록. */
export const REPORT_REASONS = [
  '스팸/광고',
  '욕설/비하',
  '사기 의심',
  '음란/부적절한 콘텐츠',
  '개인정보 노출',
  '기타',
] as const;

interface Props {
  targetType: ReportTargetType;
  targetId: number;
  /** 대상 작성자 — 있으면 차단 옵션 노출. null/undefined 면 신고만. */
  authorId?: string | null;
  authorName?: string | null;
  /** 차단 완료 후 처리 — 기본은 페이지 새로고침(서버 필터 반영). */
  onBlocked?: () => void;
  /** 트리거 글자 크기 (기본 18). */
  size?: number;
}

export function ReportMenu({ targetType, targetId, authorId, authorName, onBlocked, size = 18 }: Props) {
  const { user, status } = useSession();
  const [step, setStep] = useState<'closed' | 'menu' | 'reasons'>('closed');
  const [busy, setBusy] = useState(false);

  // 내 글이면 메뉴 자체를 숨김.
  if (authorId && user?.id === authorId) return null;

  const requireLogin = (): boolean => {
    if (status !== 'authenticated') {
      window.alert('로그인이 필요해요.');
      return true;
    }
    return false;
  };

  const submitReport = async (reason: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      if (r.status === 401) {
        window.alert('로그인이 필요해요.');
      } else if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        window.alert(j?.error ?? '신고 접수에 실패했어요.');
      } else {
        window.alert('신고가 접수되었습니다. 운영팀이 검토 후 조치할게요.');
      }
    } catch {
      window.alert('신고 접수에 실패했어요.');
    } finally {
      setBusy(false);
      setStep('closed');
    }
  };

  const blockAuthor = async () => {
    if (busy || !authorId) return;
    if (requireLogin()) return;
    const label = authorName ?? '이 사용자';
    if (!window.confirm(`${label}님을 차단할까요?\n차단하면 이 사용자의 글과 댓글이 더 이상 보이지 않아요.\n(마이페이지 > 차단 관리에서 해제 가능)`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/me/blocks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authorId }),
      });
      if (!r.ok) throw new Error('block failed');
      window.alert('차단했어요. 이 사용자의 글이 목록에서 숨겨집니다.');
      setStep('closed');
      if (onBlocked) onBlocked();
      else window.location.reload();
    } catch {
      window.alert('차단에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
      setStep('closed');
    }
  };

  const overlay = (children: React.ReactNode) => (
    <div
      onClick={(e) => { e.stopPropagation(); setStep('closed'); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 320, background: '#fff', borderRadius: 20, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );

  const itemStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'center', padding: '15px 16px', background: 'none',
    border: 'none', borderTop: '1px solid #F4F4F6', cursor: 'pointer', fontSize: 14.5, fontWeight: 700, color: '#16161a', fontFamily: 'inherit',
  };

  return (
    <>
      <button
        type="button"
        aria-label="더보기 (신고/차단)"
        onClick={(e) => { e.stopPropagation(); if (!requireLogin()) setStep('menu'); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: size, lineHeight: 1, color: '#C2C2C8', fontWeight: 800 }}
      >
        ⋯
      </button>

      {step === 'menu' &&
        overlay(
          <>
            <div style={{ padding: '16px 16px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#8E8E93' }}>이 콘텐츠에 대해</div>
            <button type="button" style={{ ...itemStyle, color: '#F5333F' }} onClick={() => setStep('reasons')}>🚩 신고하기</button>
            {authorId && (
              <button type="button" style={{ ...itemStyle, color: '#F5333F' }} onClick={blockAuthor}>
                🚫 {authorName ?? '이 사용자'} 차단하기
              </button>
            )}
            <button type="button" style={{ ...itemStyle, color: '#8E8E93' }} onClick={() => setStep('closed')}>취소</button>
          </>,
        )}

      {step === 'reasons' &&
        overlay(
          <>
            <div style={{ padding: '16px 16px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#8E8E93' }}>신고 사유를 선택해 주세요</div>
            {REPORT_REASONS.map((reason) => (
              <button key={reason} type="button" style={itemStyle} disabled={busy} onClick={() => submitReport(reason)}>
                {reason}
              </button>
            ))}
            <button type="button" style={{ ...itemStyle, color: '#8E8E93' }} onClick={() => setStep('closed')}>취소</button>
          </>,
        )}
    </>
  );
}
