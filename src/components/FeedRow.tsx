'use client';

import { useEffect, useState } from 'react';
import { BookmarkButton } from './BookmarkButton';
import { ComposedAvatar } from './ComposedAvatar';
import { ReportMenu } from './ReportMenu';
import { ensureUgcTerms } from './UgcTermsGate';
import { isAvatarId } from '@/lib/avatars';
import type { FeedPost } from '@/lib/types';

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

export function FeedRow({ post }: { post: FeedPost }) {
  const hasPixelAvatar = isAvatarId(post.user);
  const [expanded, setExpanded] = useState(false);
  // 한 번이라도 펼쳤으면 상세 콘텐츠를 유지 — 접힘도 높이 트랜지션으로 자연스럽게.
  const [opened, setOpened] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const images = post.images ?? [];
  const hasImages = images.length > 0;

  const toggle = () =>
    setExpanded((v) => {
      if (!v) setOpened(true);
      return !v;
    });

  return (
    <div
      className={`feed-item${expanded ? ' feed-item--expanded' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          flexShrink: 0,
        }}
      >
        <div className="fi-avatar">
          {hasPixelAvatar ? (
            <ComposedAvatar
              avatar={post.user}
              bg={post.authorBgId}
              frame={post.authorFrameId}
              size={56}
            />
          ) : (
            <span style={{ fontSize: 30, lineHeight: 1 }}>{post.user}</span>
          )}
        </div>
        {post.authorName && (
          <div
            style={{
              fontFamily: 'var(--f1)',
              fontSize: 9,
              color: 'var(--ink2)',
              letterSpacing: 0.3,
              maxWidth: 70,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
            title={post.authorName}
          >
            {post.authorName}
          </div>
        )}
      </div>
      <div className="fi-body">
        <div className="fi-top">
          <span
            className="tag tag-feed"
            style={{ fontSize: 10, padding: '2px 7px' }}
          >
            🗣 커뮤니티
          </span>
        </div>
        <div className="fi-text">{post.text}</div>
        {/* 상세 — 한 번 열리면 콘텐츠 유지, 래퍼의 grid-rows 트랜지션으로
            펼침/접힘 모두 높이가 자연스럽게 늘었다 줄었다 한다. */}
        <div className="fi-detail-wrap" data-open={expanded || undefined}>
          <div className="fi-detail-inner">
            {opened && (
              <>
        {/* 사진 — 클릭 시 lightbox 로 전체 보기. */}
        {hasImages && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`,
              gap: 6,
              marginTop: 8,
            }}
          >
            {images.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setLightboxIdx(i)}
                aria-label={`피드 사진 ${i + 1} 전체 보기`}
                style={{
                  display: 'block',
                  aspectRatio: '1/1',
                  overflow: 'hidden',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'zoom-in',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`피드 사진 ${i + 1}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    background: 'var(--pap2)',
                    boxShadow:
                      '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
                  }}
                />
              </button>
            ))}
          </div>
        )}
        {/* 댓글 — 헤더 한 줄에 작성일을 합쳐 구분선/메타 행을 줄였다. */}
        <FeedComments feedId={post.id} dateLabel={formatAbsolute(post.createdAt)} />
              </>
            )}
          </div>
        </div>
        {lightboxIdx !== null && (
          <Lightbox
            urls={images}
            startIdx={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
          />
        )}
      </div>
      <div className="fi-right" onClick={(e) => e.stopPropagation()}>
        <BookmarkButton feedId={post.id} />
        {/* 사진 인디케이터 — 좋아요 아래, 아이콘 + 갯수(오른쪽) */}
        {hasImages && (
          <div
            aria-label={`사진 ${images.length}장`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 4px',
              fontFamily: 'var(--f1)',
              color: 'var(--ink2)',
              letterSpacing: 0.3,
              lineHeight: 1,
            }}
          >
            <span style={{ fontSize: 17 }}>📷</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>
              {images.length}
            </span>
          </div>
        )}
        <span className="fi-time">{post.time}</span>
      </div>
    </div>
  );
}

interface FeedComment {
  id: number;
  text: string;
  authorId?: string | null;
  authorName: string;
  createdAt: string;
}

/**
 * 피드 댓글 — 상세 펼침 시 lazy 로드되는 미니멀 구성.
 * 헤더 한 줄("댓글 N · 작성일")로 메타를 합치고, 입력은 보더 없는 필 + 텍스트
 * 등록 버튼만 — 구분선/박스를 최소화한 감각적인 한 줄 디자인.
 * 부모(feed-item)가 클릭 토글이라 내부 클릭은 전파를 막는다.
 */
export function FeedComments({ feedId, dateLabel }: { feedId: number; dateLabel: string }) {
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/feeds/${feedId}/comments`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j: { data?: FeedComment[] }) => {
        if (alive) setComments(j.data ?? []);
      })
      .catch(() => {
        if (alive) setComments([]);
      });
    return () => {
      alive = false;
    };
  }, [feedId]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (!(await ensureUgcTerms())) return; // 커뮤니티 이용규칙 동의 게이트
    setSending(true);
    setHint(null);
    try {
      const r = await fetch(`/api/feeds/${feedId}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      if (r.status === 401) {
        setHint('댓글을 쓰려면 로그인이 필요해요');
        return;
      }
      if (!r.ok) {
        setHint('등록에 실패했어요. 잠시 후 다시 시도해주세요');
        return;
      }
      const j = (await r.json()) as { data: FeedComment };
      setComments((prev) => [...(prev ?? []), j.data]);
      setText('');
    } catch {
      setHint('등록에 실패했어요. 잠시 후 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ marginTop: 12 }}
    >
      {/* 헤더 한 줄 — 댓글 수 + 작성일 (별도 메타 행/구분선 없음) */}
      <div
        style={{
          fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)',
          letterSpacing: 0.2, marginBottom: 7,
        }}
      >
        댓글 {comments ? comments.length : '…'} <span style={{ opacity: 0.55 }}>· {dateLabel}</span>
      </div>
      {comments && comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 9 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--f1)', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {c.authorName}
              </span>
              <span style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6, wordBreak: 'break-word', flex: 1, minWidth: 0 }}>
                {c.text}
              </span>
              <ReportMenu targetType="feedComment" targetId={c.id} authorId={c.authorId} authorName={c.authorName} size={13} />
            </div>
          ))}
        </div>
      )}
      {/* 입력 — 보더 없는 필 인풋 + 텍스트 버튼만 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          value={text}
          maxLength={300}
          placeholder="댓글 달기…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') submit();
          }}
          style={{
            flex: 1, minWidth: 0, padding: '9px 14px',
            background: 'var(--pap2)', border: 'none', borderRadius: 999,
            fontFamily: 'var(--f1)', fontSize: 12, outline: 'none',
            boxShadow: 'none', color: 'var(--ink)',
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || !text.trim()}
          style={{
            flexShrink: 0, padding: '6px 2px',
            background: 'none', border: 'none',
            color: 'var(--blu)', fontFamily: 'var(--f1)',
            fontSize: 12, fontWeight: 700,
            opacity: sending || !text.trim() ? 0.4 : 1,
            cursor: 'pointer',
          }}
        >
          등록
        </button>
      </div>
      {hint && (
        <div style={{ marginTop: 6, fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--red)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * 사진 전체 보기 lightbox.
 * - 배경 클릭 또는 우상단 ✕ 로 닫힘
 * - 좌우 화살표 (≥2장) 로 이동
 * - Esc 키로 닫힘
 */
export function Lightbox({
  urls,
  startIdx,
  onClose,
}: {
  urls: string[];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const total = urls.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1);
      if (e.key === 'ArrowRight' && idx < total - 1) setIdx(idx + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [idx, total, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 전체 보기"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.92)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
        cursor: 'zoom-out',
      }}
    >
      {/* 닫기 버튼 — 항상 우상단 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="닫기"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          width: 44,
          height: 44,
          background: 'var(--ink)',
          color: 'var(--white)',
          border: '2px solid var(--white)',
          fontFamily: 'var(--f1)',
          fontSize: 19,
          letterSpacing: 0.5,
          cursor: 'pointer',
          zIndex: 1001,
        }}
      >
        ✕
      </button>

      {/* 이미지 — 배경 클릭은 닫기, 이미지 클릭은 무시 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[idx]}
        alt={`사진 ${idx + 1} / ${total}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          cursor: 'default',
        }}
      />

      {/* 좌우 이동 (≥2장일 때) */}
      {total > 1 && (
        <>
          {idx > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIdx(idx - 1);
              }}
              aria-label="이전 사진"
              style={navBtnStyle('left')}
            >
              ‹
            </button>
          )}
          {idx < total - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIdx(idx + 1);
              }}
              aria-label="다음 사진"
              style={navBtnStyle('right')}
            >
              ›
            </button>
          )}
          <div
            style={{
              position: 'fixed',
              bottom: 20,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: 'var(--f1)',
              fontSize: 11,
              color: 'rgba(255,255,255,.85)',
              letterSpacing: 0.5,
              pointerEvents: 'none',
            }}
          >
            {idx + 1} / {total}
          </div>
        </>
      )}
    </div>
  );
}

function navBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'fixed',
    top: '50%',
    [side]: 8,
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    background: 'rgba(0,0,0,.6)',
    color: 'var(--white)',
    border: '2px solid rgba(255,255,255,.5)',
    fontSize: 29,
    fontFamily: 'var(--f1)',
    cursor: 'pointer',
    zIndex: 1001,
    lineHeight: 1,
  };
}
