'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { StatusBar } from '@/components/ui/StatusBar';
import { useTheme } from '@/components/ThemeProvider';
import { ComposedAvatar } from '@/components/ComposedAvatar';
import { BookmarkButton } from '@/components/BookmarkButton';
import { FeedComments, Lightbox } from '@/components/FeedRow';
import { ReportMenu } from '@/components/ReportMenu';
import { isAvatarId } from '@/lib/avatars';
import { ShopSection, SHOP_REGIONS } from '@/components/screens/CommunityShop';
import { isFeedCategory } from '@/lib/feedCategories';
import { feedHotScore, feedPostTitle, formatCount, rankBestPosts, rankHotPosts } from '@/lib/feedRanking';
import type { FeedPost, Trade } from '@/lib/types';
import { SegmentedTabs, SegIcons } from '@/components/ui/SegmentedTabs';
import { useUnread } from '@/components/UnreadProvider';

/**
 * 커뮤니티 — Claude Design 'ARVOTCG 커뮤니티' 프로토타입 레이아웃.
 *  헤더(커뮤니티+팔로잉/내게시글) · 카테고리 탭 · 인기글(불타는글/개념글) ·
 *  실시간 HOT 키워드 · 정렬 행 · 공지 · 글 목록('거래/나눔'=실제 마켓).
 * 모든 테마가 같은 레이아웃을 쓰고, 색/폰트만 테마별로 달라진다(클린은 프로토타입
 * 퍼플 팔레트 그대로, 그 외 테마는 CSS 변수 토큰).
 */

const PURPLE = '#6a3aff';
const RED = '#F5333F';

interface Palette {
  pageBg: string;
  cardBg: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentDk: string;
  accentSoft: string;
  kwBg: string;
  red: string;
  redSoft: string;
  line: string;
  chip: string;
  chev: string;
}

// 클린 = 프로토타입 퍼플 팔레트(승인된 모습 그대로).
const CLEAN_P: Palette = {
  pageBg: '#F7F7F9',
  cardBg: '#ffffff',
  ink: '#16161a',
  ink2: '#6B6B70',
  ink3: '#9A9AA0',
  accent: PURPLE,
  accentDk: '#5a3ad6',
  accentSoft: '#EFEBFF',
  kwBg: 'linear-gradient(120deg,#f0ecff,#f6f3ff)',
  red: RED,
  redSoft: '#FFECEC',
  line: '#F4F4F6',
  chip: '#F2F2F4',
  chev: '#C2C2C8',
};

// 그 외 테마 = 각 테마의 CSS 변수 토큰(테마별 색/폰트 자동 반영).
const VAR_P: Palette = {
  pageBg: 'var(--pap2)',
  cardBg: 'var(--paper)',
  ink: 'var(--ink)',
  ink2: 'var(--ink2)',
  ink3: 'var(--ink3)',
  accent: 'var(--gold)',
  accentDk: 'var(--gold)',
  accentSoft: 'var(--pap3)',
  kwBg: 'var(--pap3)',
  red: 'var(--red)',
  redSoft: 'var(--pap2)',
  line: 'var(--pap3)',
  chip: 'var(--pap2)',
  chev: 'var(--ink3)',
};

const GRAD = {
  zard: 'linear-gradient(150deg,#ff6a3d,#c81d25)',
  mew: 'linear-gradient(150deg,#f7a6c4,#b78cf0)',
  gard: 'linear-gradient(150deg,#9d6bd6,#4568dc)',
  umb: 'linear-gradient(150deg,#3a3a44,#16161a)',
  char: 'linear-gradient(150deg,#ff9a3c,#ff5a1f)',
  gengar: 'linear-gradient(150deg,#7b4bc4,#3a1f6e)',
  koi: 'linear-gradient(150deg,#5b86e5,#36d1dc)',
};

type CatId = '전체' | '자유' | '시세/정보' | '자랑' | '거래/나눔';
const CATS: CatId[] = ['전체', '자유', '시세/정보', '자랑', '거래/나눔'];

type SortId = '최신순' | '인기순' | '추천순' | '댓글순';
const SORTS: SortId[] = ['최신순', '인기순', '추천순', '댓글순'];

// 게시글 카테고리별 태그 색(클린). VAR 테마는 accent 톤으로 대체.
const TAG_COLOR: Record<string, { fg: string; bg: string }> = {
  '자유': { fg: '#5a3ad6', bg: '#EFEBFF' },
  '자랑': { fg: '#C2410C', bg: '#FFEDD5' },
  '거래/나눔': { fg: '#7C3AED', bg: '#F1EAFF' },
  '시세/정보': { fg: '#0369A1', bg: '#E0F2FE' },
};
function tagStyle(label: string, clean: boolean, P: Palette): { fg: string; bg: string } {
  if (clean) return TAG_COLOR[label] ?? TAG_COLOR['자유'];
  return { fg: P.accentDk, bg: P.accentSoft };
}

/** 글 카테고리 — DB category 우선, 레거시 글(NULL)은 사진 유무로 자랑/자유 추정.
 *  (PostRow 표시 로직과 동일 기준.) */
function postCat(p: FeedPost): CatId {
  if (isFeedCategory(p.category)) return p.category;
  return (p.images?.length ?? 0) > 0 ? '자랑' : '자유';
}

/* ---------------- 정적 편집 데이터 (인기글 / 키워드 / 공지) ---------------- */

interface FeatureItem {
  postId: number;
  rank: number;
  title: string;
  comments: number;
  likes: string;
  grad: string;
  emoji: string;
  thumb?: string;
  heat?: string;
}
// 인기글 타일 배경 — 순위별 순환.
const GRAD_CYCLE = [GRAD.zard, GRAD.gengar, GRAD.mew, GRAD.char, GRAD.umb, GRAD.gard, GRAD.koi];
const CAT_EMOJI: Record<string, string> = { '자유': '💬', '시세/정보': '📈', '자랑': '✨', '거래/나눔': '🤝' };
/** 실제 피드 → 인기글 행 (정본 shared/feedRanking). hot 은 점수 배지, best 는 배지 없음. */
function toFeatureItems(posts: FeedPost[], kind: 'hot' | 'best'): FeatureItem[] {
  const ranked = kind === 'hot' ? rankHotPosts(posts, 3) : rankBestPosts(posts, 3);
  return ranked.map((p, i) => ({
    postId: p.id,
    rank: i + 1,
    title: feedPostTitle(p.text),
    comments: p.commentCount ?? 0,
    likes: formatCount(p.likeCount ?? 0),
    grad: GRAD_CYCLE[i % GRAD_CYCLE.length],
    emoji: CAT_EMOJI[postCat(p)] ?? '💬',
    thumb: p.images?.[0],
    heat: kind === 'hot' && feedHotScore(p) > 0 ? formatCount(feedHotScore(p)) : undefined,
  }));
}

const KEYWORDS = ['# 신규발매', '# 그레이딩', '# 일본판', '# 시세폭등', '# 직거래', '# 컬렉션'];

interface Notice {
  badge: string;
  badgeRed?: boolean;
  title: string;
  author: string;
  date: string;
  comments: number;
  likes: number;
}
const NOTICES: Notice[] = [
  { badge: '공지', title: '커뮤니티 운영 규칙 안내', author: '관리자', date: '2024.05.20', comments: 123, likes: 999 },
  { badge: '필독', badgeRed: true, title: '시세 정보 글 작성 가이드 (필독)', author: '관리자', date: '2024.05.18', comments: 67, likes: 482 },
];

/* ---------------- 아이콘 ---------------- */

const Ic = {
  search: (c: string, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  ),
  // 쪽지(편지봉투) — 헤더 우측 아이콘. 이동 대상이 /my/messages 라 벨(알림)이 아닌 쪽지가 맞다.
  mail: (c: string, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m3 7 8.1 5.6a1.6 1.6 0 0 0 1.8 0L21 7" /></svg>
  ),
  edit: (c: string, s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
  ),
  chat: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
  ),
  like: (stroke: string, fill: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
  ),
  chevR: (c: string, s = 13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
  ),
  chevD: (c: string, s = 13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  ),
  refresh: (c: string, s = 13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
  ),
};

interface Props {
  initialFeed: FeedPost[];
  trades: Trade[];
}

export function CommunityScreen({ initialFeed, trades }: Props) {
  const { theme } = useTheme();
  // 헤더 쪽지 배지 — 실제 안 읽은 쪽지 수 (앱 feed.tsx fetchUnreadCount 페어).
  const { count: unread } = useUnread();
  const clean = theme === 'clean';
  const P = clean ? CLEAN_P : VAR_P;

  const [mode, setMode] = useState<'feed' | 'shop'>('feed');
  // 드로어 '카드샵' 딥링크 — /feed?tab=shop 진입 시 Shop 모드로 시작.
  // (하이드레이션 불일치를 피하려고 마운트 후 전환. 앱 feed.tsx 와 동일 규칙.)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'shop') setMode('shop');
  }, []);
  const [region, setRegion] = useState('전체');
  const [cat, setCat] = useState<CatId>('전체');
  const [sort, setSort] = useState<SortId>('최신순');
  const [feature, setFeature] = useState<'hot' | 'best'>('hot');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState<string[]>(KEYWORDS);
  const isShop = mode === 'shop';

  const isMarket = cat === '거래/나눔';
  const writeHref = isMarket ? '/write/trade' : '/write/feed';
  const featureItems = useMemo(() => toFeatureItems(initialFeed, feature), [initialFeed, feature]);

  // 인기글 행 탭 → 아래 목록에서 그 글을 펼친 채로 스크롤 이동 (글 상세 라우트 없음, 앱 동일).
  const [focusId, setFocusId] = useState<number | null>(null);
  const focusPost = (id: number) => {
    setCat('전체');
    setQuery('');
    setFocusId(id);
    setTimeout(() => document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  // 더보기 → 해당 기준 정렬로 바꾸고 목록으로 이동 (불타는 글=인기순, 개념글=추천순).
  const showMoreFeature = () => {
    setCat('전체');
    setSort(feature === 'hot' ? '인기순' : '추천순');
    setTimeout(() => document.getElementById('feed-sort-row')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // 검색어 + 카테고리 필터 + 정렬을 실제 목록에 적용.
  // (전체=모두, 그 외 탭=해당 카테고리만 / 최신순=작성시각, 추천순=북마크수, 댓글순=댓글수)
  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? initialFeed.filter(
          (p) =>
            (p.text ?? '').toLowerCase().includes(q) ||
            (p.authorName ?? '').toLowerCase().includes(q),
        )
      : initialFeed;
    if (cat !== '전체') list = list.filter((p) => postCat(p) === cat);
    const sorted = [...list];
    if (sort === '인기순') sorted.sort((a, b) => feedHotScore(b) - feedHotScore(a) || b.createdAt.localeCompare(a.createdAt));
    else if (sort === '추천순') sorted.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
    else if (sort === '댓글순') sorted.sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [initialFeed, query, sort, cat]);

  // 카테고리 탭 — 선택 탭 위치를 측정해 슬라이딩 밑줄(인디케이터)을 이동.
  // 탭 자체엔 보더가 없어 클릭 전/후 잔여 보더가 생기지 않는다.
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const firstTabMeasure = useRef(true);
  const [indicator, setIndicator] = useState<{ left: number; width: number; animate: boolean }>({ left: 0, width: 0, animate: false });
  useEffect(() => {
    const measure = () => {
      const el = tabRefs.current[cat];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth, animate: !firstTabMeasure.current });
      firstTabMeasure.current = false;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [cat]);

  // 새로고침 — 키워드 순서를 섞어 갱신감을 준다(편집 데이터라 셔플로 대체).
  const shuffleKeywords = () =>
    setKeywords((prev) => {
      const a = [...prev];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });

  return (
    <>
      <StatusBar />
      <div className="pagebg" style={{ fontFamily: 'var(--f1)', background: P.pageBg }}>
        {/* header */}
        <div style={{ background: P.cardBg, position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px' }}>
            {/* 커뮤니티 ↔ Shop 모드 토글 — 활성 타이틀이 왼쪽 큰 자리로, 비활성이
                오른쪽 작은 자리로 서로 위치를 교환하며 애니메이션 */}
            <SegmentedTabs
              items={[
                { id: 'feed', label: '커뮤니티', icon: SegIcons.chat },
                { id: 'shop', label: 'Shop', icon: SegIcons.pin },
              ]}
              value={mode}
              onChange={setMode}
              track={P.chip}
              activeBg={P.ink}
              activeFg={P.cardBg}
              inactiveFg={P.ink3}
            />
            <div style={{ flex: 1 }} />
            {!isShop && <button type="button" aria-label="검색" onClick={() => setSearchOpen((v) => !v)} style={{ display: 'block', color: searchOpen ? P.accent : P.ink, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{Ic.search(searchOpen ? P.accent : P.ink)}</button>}
            <Link href="/my/messages" aria-label="쪽지" style={{ position: 'relative', display: 'block', color: P.ink }}>
              {Ic.mail(P.ink)}
              {unread > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px', background: P.red, borderRadius: 8, color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${P.cardBg}` }}>{unread > 99 ? '99+' : unread}</span>
              )}
            </Link>
            <Link href={writeHref} aria-label="글쓰기" style={{ width: 32, height: 32, borderRadius: 10, background: clean ? 'linear-gradient(150deg,#9d6bff,#6a3aff)' : P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: clean ? '0 3px 8px rgba(106,58,255,.35)' : 'none' }}>
              {Ic.edit('#fff')}
            </Link>
          </div>

          {/* search bar (검색 아이콘 토글) */}
          {!isShop && searchOpen && (
            <div style={{ padding: '4px 16px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: P.chip, borderRadius: 12, padding: '9px 12px' }}>
                {Ic.search(P.ink3, 18)}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="제목·내용·작성자 검색"
                  style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 14, fontWeight: 600, color: P.ink, fontFamily: 'var(--f1)' }}
                />
                {query && (
                  <button type="button" aria-label="지우기" onClick={() => setQuery('')} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: P.ink3, fontSize: 16, fontWeight: 800, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>
            </div>
          )}

          {/* shop 모드: 지역 칩 / feed 모드: 카테고리 탭 */}
          {isShop ? (
            <div className="cv-hrow" style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', padding: '4px 16px 12px', borderBottom: `1px solid ${P.line}` }}>
              {SHOP_REGIONS.map((rg) => {
                const on = region === rg;
                return (
                  <button key={rg} type="button" onClick={() => setRegion(rg)} style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 18, cursor: 'pointer', border: 'none', background: on ? P.ink : P.chip, color: on ? P.cardBg : P.ink3 }}>{rg}</button>
                );
              })}
            </div>
          ) : (
          <div className="cv-hrow" style={{ display: 'flex', alignItems: 'center', gap: 18, overflowX: 'auto', padding: '4px 16px 0', position: 'relative' }}>
            {CATS.map((c) => {
              const on = cat === c;
              return (
                <button
                  key={c}
                  ref={(el) => { tabRefs.current[c] = el; }}
                  type="button"
                  onClick={() => setCat(c)}
                  style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 15, fontWeight: on ? 800 : 600, color: on ? P.accent : P.ink2, padding: '8px 1px 12px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {c}
                </button>
              );
            })}
            {/* 슬라이딩 밑줄 인디케이터 — 선택 탭 위치로 부드럽게 이동 */}
            <span
              aria-hidden
              style={{
                position: 'absolute', bottom: 0, left: indicator.left, width: indicator.width, height: 2.5,
                background: P.accent, borderRadius: 2, pointerEvents: 'none',
                transition: indicator.animate ? 'left .28s cubic-bezier(.4,0,.2,1), width .28s cubic-bezier(.4,0,.2,1)' : 'none',
              }}
            />
          </div>
          )}
        </div>

        {isShop ? (
          <ShopSection P={P} region={region} />
        ) : (
        <>
        {/* 전체 탭에서만 인기글 + HOT 키워드 노출. 그 외 카테고리는 목록만. */}
        {cat === '전체' && (
          <>
        {/* feature card (불타는 글 / 개념글) */}
        <div style={{ padding: '16px 16px 4px' }}>
          <div style={{ background: P.cardBg, borderRadius: 18, padding: '16px 16px 10px', boxShadow: clean ? '0 2px 10px rgba(0,0,0,.05)' : 'none', border: clean ? 'none' : `1px solid ${P.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 7 }}>
                {([['hot', '🔥 불타는 글'], ['best', '👍 개념글']] as Array<['hot' | 'best', string]>).map(([id, lb]) => {
                  const on = feature === id;
                  return (
                    <button key={id} type="button" onClick={() => setFeature(id)} style={{ fontSize: 13.5, fontWeight: 800, padding: '8px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: on ? P.ink : P.chip, color: on ? (clean ? '#fff' : P.cardBg) : P.ink3 }}>{lb}</button>
                  );
                })}
              </div>
              <button type="button" onClick={showMoreFeature} style={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, fontWeight: 700, color: P.ink3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>더보기{Ic.chevR(P.ink3, 12)}</button>
            </div>
            {featureItems.length === 0 && (
              <div style={{ padding: '14px 0 6px', fontSize: 12.5, color: P.ink3, fontWeight: 600, borderTop: `1px solid ${P.line}` }}>아직 인기글이 없어요. 첫 글을 남겨보세요.</div>
            )}
            {featureItems.map((f) => (
              <button type="button" key={f.postId} onClick={() => focusPost(f.postId)} style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', color: 'inherit', display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderTop: `1px solid ${P.line}`, cursor: 'pointer' }}>
                <div style={{ fontSize: 19, fontWeight: 900, color: f.heat ? P.red : P.ink, width: 15, flex: 'none', textAlign: 'center' }}>{f.rank}</div>
                <div style={{ width: 46, height: 62, borderRadius: 7, background: f.grad, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 3px 7px rgba(0,0,0,.16)', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.thumb ? <img src={f.thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <Meta icon={Ic.chat(P.chev, 12)} label={String(f.comments)} P={P} />
                    <Meta icon={Ic.like(P.chev, 'none', 12)} label={String(f.likes)} P={P} />
                  </div>
                </div>
                {f.heat && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 800, color: P.red, flex: 'none', background: P.redSoft, padding: '5px 9px', borderRadius: 14 }}>🔥 {f.heat}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* HOT keyword */}
        <div style={{ padding: '10px 16px 4px' }}>
          <div style={{ background: P.kwBg, borderRadius: 16, padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 14.5, fontWeight: 900, color: P.accent }}>실시간 HOT 키워드</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink3 }}>지금 가장 많이 언급되는 키워드에요</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13 }}>
              <div style={{ overflow: 'hidden', flex: 1, maskImage: 'linear-gradient(90deg,transparent,#000 16px,#000 calc(100% - 16px),transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 16px,#000 calc(100% - 16px),transparent)' }}>
                <div className="pf-kw-track">
                  {[...keywords, ...keywords].map((k, i) => (
                    <span key={`${k}-${i}`} style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700, color: clean ? '#5a3ad6' : P.ink, background: P.cardBg, padding: '8px 13px', borderRadius: 18, boxShadow: clean ? '0 1px 3px rgba(106,58,255,.1)' : 'none', marginRight: 7 }}>{k}</span>
                  ))}
                </div>
              </div>
              <button type="button" aria-label="키워드 새로고침" onClick={shuffleKeywords} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, color: P.ink3, background: P.cardBg, borderRadius: '50%', border: 'none', cursor: 'pointer' }}>{Ic.refresh(P.ink3, 15)}</button>
            </div>
          </div>
        </div>
          </>
        )}

        {/* sort row */}
        <div id="feed-sort-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px 10px' }}>
          {SORTS.map((s, i) => {
            const on = sort === s;
            return (
              <button key={s} type="button" onClick={() => setSort(s)} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? P.accent : P.ink3, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {s}{i === 0 && Ic.chevD(on ? P.accent : P.ink3, 13)}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <Link href="/my/feeds" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: P.ink3, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            <span style={{ width: 16, height: 16, border: `1.5px solid ${P.chev}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            내가 쓴 글 보기
          </Link>
        </div>

        {/* post list */}
        <div style={{ background: P.cardBg }}>
          {cat === '전체' && NOTICES.map((n) => (
            <Link key={n.title} href="/my/notices" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', borderBottom: `1px solid ${P.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: n.badgeRed ? P.red : P.accent, padding: '3px 8px', borderRadius: 7, flex: 'none' }}>{n.badge}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, fontSize: 12, color: P.ink3, fontWeight: 600 }}><span>{n.author}</span><span>{n.date}</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 'none' }}>
                <Meta icon={Ic.chat(P.chev)} label={String(n.comments)} P={P} />
                <Meta icon={Ic.like(P.chev, 'none')} label={String(n.likes)} P={P} />
              </div>
            </Link>
          ))}

          {isMarket ? (
            <MarketList list={trades} P={P} clean={clean} />
          ) : (
            <FeedList posts={visiblePosts} P={P} clean={clean} focusId={focusId} />
          )}

          <div style={{ height: 20 }} />
        </div>
        </>
        )}

        <div className="bggap" />
      </div>
    </>
  );
}

function Meta({ icon, label, P }: { icon: ReactNode; label: string; P: Palette }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: P.ink3 }}>{icon}{label}</span>
  );
}

/* ---------------- feed ---------------- */

function FeedList({ posts, P, clean, focusId }: { posts: FeedPost[]; P: Palette; clean: boolean; focusId?: number | null }) {
  if (posts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '46px 20px', color: P.ink3, fontSize: 14 }}>
        아직 글이 없어요.
        <br />
        <Link href="/write/feed" style={{ color: P.accent, fontWeight: 700, textDecoration: 'none' }}>＋ 첫 번째가 되어보세요</Link>
      </div>
    );
  }
  return (
    <>
      {posts.map((p) => (
        <PostRow key={p.id} post={p} P={P} clean={clean} focused={focusId === p.id} />
      ))}
    </>
  );
}

function PostRow({ post, P, clean, focused }: { post: FeedPost; P: Palette; clean: boolean; focused?: boolean }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  // 인기글에서 넘어온 글 — 펼친 상태로 시작.
  useEffect(() => {
    if (focused) { setOpen(true); setOpened(true); }
  }, [focused]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const images = post.images ?? [];
  const hasThumb = images.length > 0;
  const cat = postCat(post);
  const ts = tagStyle(cat, clean, P);
  const hasPixelAvatar = isAvatarId(post.user);

  const toggle = () => setOpen((v) => { if (!v) setOpened(true); return !v; });

  return (
    <div
      id={`post-${post.id}`}
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
      style={{ display: 'flex', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${P.line}`, cursor: 'pointer' }}
    >
      {/* avatar */}
      <div style={{ flex: 'none', width: 40 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: P.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>
          {hasPixelAvatar ? <ComposedAvatar avatar={post.user} bg={post.authorBgId} frame={post.authorFrameId} size={40} /> : <span>{post.user || '🙂'}</span>}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: ts.fg, background: ts.bg, padding: '2px 8px', borderRadius: 6, flex: 'none' }}>{cat}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.authorName ?? '회원'}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: P.ink3, flex: 'none' }}>{post.time}</span>
        </div>
        <div style={{ display: 'flex', gap: 11, marginTop: 9 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: P.ink2, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: open ? 99 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.text}</div>
          </div>
          {hasThumb && !open && (
            <div style={{ width: 62, height: 84, borderRadius: 8, background: P.accentSoft, flex: 'none', overflow: 'hidden', boxShadow: '0 3px 8px rgba(0,0,0,.18)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>

        {/* expand: images + comments */}
        {opened && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: open ? 'block' : 'none' }}>
            {hasThumb && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`, gap: 6, marginTop: 11 }}>
                {images.map((url, i) => (
                  <button key={url} type="button" onClick={() => setLightbox(i)} style={{ display: 'block', aspectRatio: '1/1', overflow: 'hidden', padding: 0, border: 'none', background: P.accentSoft, borderRadius: 8, cursor: 'zoom-in' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`사진 ${i + 1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
            <FeedComments feedId={post.id} dateLabel={formatAbs(post.createdAt)} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 11 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={toggle} aria-label="댓글" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: P.ink3, background: 'none', border: 'none', cursor: 'pointer' }}>{Ic.chat(P.chev, 15)}댓글{post.commentCount ? ` ${post.commentCount}` : ''}</button>
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BookmarkButton feedId={post.id} />
            {(post.likeCount ?? 0) > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink3 }}>{post.likeCount}</span>}
          </span>
          {hasThumb && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 700, color: P.ink3 }}>📷 {images.length}</span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <ReportMenu targetType="feed" targetId={post.id} authorId={post.authorId} authorName={post.authorName} />
          </span>
        </div>
      </div>

      {lightbox !== null && <Lightbox urls={images} startIdx={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function formatAbs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- market (거래/나눔) ---------------- */

function MarketList({ list, P, clean }: { list: Trade[]; P: Palette; clean: boolean }) {
  if (list.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '46px 20px', color: P.ink3, fontSize: 14 }}>
        거래/나눔 글이 없어요.
        <br />
        <Link href="/write/trade" style={{ color: P.accent, fontWeight: 700, textDecoration: 'none' }}>＋ 거래글 작성</Link>
      </div>
    );
  }
  return (
    <>
      {list.map((t) => {
        const isSell = t.type === 'sell';
        return (
          <Link key={t.id} href={`/trade/${t.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${P.line}` }}>
            <div style={{ width: 62, height: 84, borderRadius: 8, background: P.accentSoft, flex: 'none', overflow: 'hidden', position: 'relative', boxShadow: '0 3px 8px rgba(0,0,0,.14)' }}>
              {t.images && t.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.images[0]} alt={t.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{isSell ? '🏷' : '🛒'}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: P.ink, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: isSell ? P.red : (clean ? '#2563EB' : 'var(--blu)'), padding: '2px 8px', borderRadius: 6, flex: 'none' }}>{isSell ? '팝니다' : '삽니다'}</span>
                {t.place && <span style={{ fontSize: 12, color: P.ink3, fontWeight: 600 }}>📍 {t.place}</span>}
                <span style={{ fontSize: 12, color: P.ink3, fontWeight: 500 }}>{t.time}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 900, color: clean ? '#0A7A56' : 'var(--grn-dk)', letterSpacing: '-.2px' }}>{t.price}</span>
                <span style={{ fontSize: 11.5, color: P.ink3, fontWeight: 600 }}>{typeof t.bumpCount === 'number' && t.bumpCount > 0 ? `↑ ${t.bumpCount} · ` : ''}{t.authorName ?? '회원'}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </>
  );
}
