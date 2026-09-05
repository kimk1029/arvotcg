'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { startRouteTransition } from '@/components/RouteProgress';
import { ScanProgressOverlay } from '@/components/ScanProgressOverlay';
import { type RegisterCardInput } from '@/components/cards/CardRegisterSheet';
import { CardThumb } from '@/components/CardThumb';
import { useTheme } from '@/components/ThemeProvider';
import { translate, translateKnownCardNameToKo } from '@/lib/cardTranslate';
import { invalidateCollectionCaches } from '@/lib/collectionCache';
import { registerBasisJpy } from '@/lib/snkrdunkPrice';
import {
  buildRegisterPayload,
  defaultRegisterOptions,
  postMyCard,
  selfPulledBasis,
  type RegisterOptions,
} from '@/lib/registerCard';
import { parseCardStatics } from '../../shared/cardStatics';
import { cardCodeQuery } from '../../shared/cardCode';

/** snkrdunk 검색 결과 한 건. */
interface SnkSearchRow {
  apparelId: number;
  name: string;
  imageUrl: string | null;
  priceText?: string;
}

/** File → HTMLImageElement (스캔용 디코드) — HomeKoSearchBar 동일. */
function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
}

/** "¥2,000" → 2000. 못 읽으면 null. */
function parseYen(t?: string): number | null {
  if (!t) return null;
  const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface CatalogOption {
  id: string;
  name: string;
  emoji: string;
  grade: 'S' | 'A' | 'B' | 'C';
}

interface Props {
  catalog: CatalogOption[];
}

/** /api/cards/lookup 응답의 card 부분 (필요한 필드만). */
interface LookupCard {
  id?: string;
  name?: string;
  localName?: string | null;
  setName?: string;
  setCode?: string;
  number?: string;
  rarity?: string;
  imageSmall?: string | null;
  imageLarge?: string | null;
  priceSummary?: {
    byRegion?: { jpy?: number | null; krw?: number | null } | null;
  } | null;
}

/* ── 정렬/필터 ─────────────────────────────────────────────── */

type SortKey = 'rel' | 'rarity' | 'price' | 'volume';

const SORT_LABEL: Record<SortKey, string> = {
  rel: '관련도순',
  rarity: '레어도순',
  price: '비싼순',
  volume: '거래량많은순',
};

/** 레어도 랭크 — 낮을수록 위. PROMO > UR > SAR > SR > AR > … */
const RARITY_RANK: Record<string, number> = {
  PROMO: 0,
  UR: 1,
  SAR: 2,
  SR: 3,
  AR: 4,
  HR: 5,
  SSR: 6,
  CSR: 7,
  CHR: 8,
  RRR: 9,
  RR: 10,
};

/** 레어도 — 파싱된 rarity 필드 우선, 없으면 카드명 토큰. 프로모(프로모/PROMO/세트코드 -P)는 PROMO 로. */
function rarityOf(c: RegisterCardInput): string | null {
  if (c.rarity) return c.rarity.toUpperCase();
  const raw = c.name ?? '';
  const up = `${raw} ${c.setCode ?? ''}`.toUpperCase();
  if (/프로모|PROMO/.test(raw) || /-P[\s\]\)]|-P$/.test(up)) return 'PROMO';
  const m = up.match(/(?:^|[^A-Z0-9])(SAR|SSR|CSR|CHR|RRR|RR|UR|HR|AR|SR)(?![A-Z0-9])/);
  return m ? m[1] : null;
}

/** 레어도 배지 색 (프로토타입 팔레트) — 데이터 색이라 테마 무관 고정. */
const RARITY_BADGE: Record<string, { fg: string; bg: string }> = {
  PROMO: { fg: '#F5333F', bg: '#FFECEC' },
  UR: { fg: '#2563EB', bg: '#E0EDFF' },
  SAR: { fg: '#7C5CFC', bg: '#F4F1FF' },
  SR: { fg: '#C2410C', bg: '#FFEDD5' },
  AR: { fg: '#1E8E5A', bg: '#E3F6EC' },
  HR: { fg: '#B8860B', bg: '#FBF3DA' },
  RR: { fg: '#8E44AD', bg: '#F3EAFB' },
};

/** 세트 키 — 입력한 세트코드 우선, 없으면 이름의 "[SV4a 201/165]" 대괄호에서 추출. */
function setKeyOf(c: RegisterCardInput): string | null {
  if (c.setCode?.trim()) return c.setCode.trim().toUpperCase();
  const m = (c.name ?? '').toUpperCase().match(/\[([A-Z0-9\-]{2,10})[\s\]]/);
  return m ? m[1] : null;
}

/* ── 팔레트: Claude Design 'ARVOTCG 카드추가' 프로토타입.
   클린 = 프로토타입 색 그대로, 그 외 테마 = CSS 변수 토큰. ── */
interface Palette {
  pageBg: string;
  ink: string;
  ink2: string; // 라벨 (#8E8E93)
  ink3: string; // 보조 텍스트 (#9A9AA0)
  accent: string; // 오렌지 포인트
  accentSoft: string; // 선택 행 배경
  line: string; // 구분선 (#F0F0F2)
  fieldBg: string; // 입력 필드 배경 (#F7F7F9)
  fieldBd: string; // 입력 필드 테두리 (#E5E5EA)
  nameBg: string; // 카드이름 필드 배경 (#F2F2F4)
  radioBd: string; // 미선택 라디오 테두리 (#D2D2D8)
  btnBg: string; // 검정 버튼
  btnFg: string;
  disBg: string; // 비활성 버튼 배경
  disFg: string;
  barBg: string; // 하단 바 배경
}

const CLEAN_P: Palette = {
  pageBg: '#ffffff',
  ink: '#16161a',
  ink2: '#8E8E93',
  ink3: '#9A9AA0',
  accent: '#FF7A00',
  accentSoft: '#FFF6EE',
  line: '#F0F0F2',
  fieldBg: '#F7F7F9',
  fieldBd: '#E5E5EA',
  nameBg: '#F2F2F4',
  radioBd: '#D2D2D8',
  btnBg: '#16161a',
  btnFg: '#ffffff',
  disBg: '#F2F2F4',
  disFg: '#B0B0B6',
  barBg: 'rgba(255,255,255,.97)',
};

const VAR_P: Palette = {
  pageBg: 'var(--paper)',
  ink: 'var(--ink)',
  ink2: 'var(--ink2)',
  ink3: 'var(--ink3)',
  accent: 'var(--gold)',
  accentSoft: 'var(--pap2)',
  line: 'var(--pap3)',
  fieldBg: 'var(--pap2)',
  fieldBd: 'var(--pap3)',
  nameBg: 'var(--pap2)',
  radioBd: 'var(--ink3)',
  btnBg: 'var(--ink)',
  btnFg: 'var(--paper)',
  disBg: 'var(--pap2)',
  disFg: 'var(--ink3)',
  barBg: 'var(--paper)',
};

/* ── 아이콘 (프로토타입 SVG) ── */
function IcBack({ c }: { c: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}
/** 홈 검색 인풋(HomeKoSearchBar)과 동일한 카메라 아이콘. */
function IcCamera({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
function IcSearch({ c, size = 18, w = 2.2 }: { c: string; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function IcFilter({ c }: { c: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}
function IcCaret({ c, size = 14 }: { c: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ── 검색 기준(카드이름/세트코드/카드번호) ─────────────────────────
   프로토타입은 입력칸 3개 대신 "기준 칩 + 입력 한 줄"이다. 칩을 누르면 그 기준을
   입력 중으로 바꾸고(포커스), 값이 들어간 기준은 체크 표시로 남아 검색에 함께 쓰인다. */
type FieldKey = 'name' | 'set' | 'num';

/** 등급사 — 등록 옵션의 그레이딩사 선택 (CardRegisterSheet 와 동일 목록). */
const GRADE_COMPANIES = ['PSA', 'BGS', 'CGC', 'SGC', 'ARS'];

const FIELDS: Array<{ key: FieldKey; label: string; color: string; placeholder: string; hint: string; max: number }> = [
  // 카드번호가 가장 확실한 단서라 첫 번째이자 기본 선택 (사용자 지시 2026-09-06).
  { key: 'num', label: '카드번호', color: '#1E8E5A', placeholder: '예) 025/165', hint: '세트코드 바로 옆 번호예요.', max: 16 },
  { key: 'name', label: '카드이름', color: '#FF7A00', placeholder: '예) 피카츄', hint: '이름 일부만 입력해도 돼요.', max: 60 },
  { key: 'set', label: '세트코드', color: '#2563EB', placeholder: '예) SV4a', hint: '카드 왼쪽 하단의 코드예요.', max: 16 },
];

/**
 * 내 카드 등록 — Claude Design 'ARVO 카드등록' 프로토타입 레이아웃.
 *
 * 검색(기준 칩 + 입력 한 줄 + 스캔) → 결과 단일 선택 → 하단 바에서 바로 등록까지
 * **한 화면**에서 끝난다. 이전에는 결과를 고르면 별도의 '카드 등록' 화면으로
 * 넘어갔는데, 그 단계를 없애고 등록 옵션(구입가·수량·등급·메모)을 같은 화면의
 * 접이식 패널로 옮겼다. 저장 규칙(payload)의 정본은 src/lib/registerCard.ts —
 * 시세상세 '내 컬렉션에 추가' 팝업과 같은 함수를 쓴다. 앱 scan.tsx manual 모드와 페어.
 */
export function ManualAddForm(_props: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const clean = theme === 'clean';
  const P = clean ? CLEAN_P : VAR_P;

  /* ── 검색 입력 ── */
  const [setCode, setSetCode] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [name, setName] = useState('');
  const [field, setField] = useState<FieldKey>('num');
  const inputRef = useRef<HTMLInputElement>(null);

  const valueOf = (k: FieldKey) => (k === 'name' ? name : k === 'set' ? setCode : cardNumber);
  const setValueOf = (k: FieldKey, v: string) => {
    if (k === 'name') setName(v);
    else if (k === 'set') setSetCode(v.toUpperCase());
    else setCardNumber(v);
  };
  const filled = FIELDS.filter((f) => valueOf(f.key).trim().length > 0);
  const cur = FIELDS.find((f) => f.key === field) ?? FIELDS[0];

  /* ── 스캔(촬영 → OCR → 기준 자동 채움 → 검색) ── */
  const [scanning, setScanning] = useState(false);
  const camFileRef = useRef<HTMLInputElement>(null);

  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<RegisterCardInput[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // 정렬/필터 — 관련도순 = 검색 API가 준 순서 그대로.
  const [sort, setSort] = useState<SortKey>('rel');
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [setFilter, setSetFilter] = useState<string | null>(null);
  const [menu, setMenu] = useState<'set' | 'rarity' | 'sort' | null>(null);
  // 거래량많은순 — 카탈로그 스냅샷의 출품수(listingCount). apparelId → count.
  const [volumes, setVolumes] = useState<Record<number, number>>({});
  const volFetchedRef = useRef<Set<number>>(new Set());
  // "더보기" 페이지네이션 상태 — 검색 쿼리/중복셋/다음 페이지를 유지해 이어서 로드.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pagingRef = useRef<{ queries: string[]; seen: Set<number>; nextPage: number }>({
    queries: [],
    seen: new Set(),
    nextPage: 1,
  });

  /* ── 등록(같은 화면에서 처리 — 별도 '카드 등록' 화면 없음) ── */
  const [optOpen, setOptOpen] = useState(false);
  const [opts, setOpts] = useState<RegisterOptions>(() => defaultRegisterOptions());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const patch = (p: Partial<RegisterOptions>) => setOpts((o) => ({ ...o, ...p }));
  /** snkrdunk 한 페이지 로드 — 새 항목만 반환. */
  const fetchSnkPage = async (queries: string[], page: number, seen: Set<number>) => {
    const items: RegisterCardInput[] = [];
    let anyRows = false;
    for (const q of queries) {
      if (!q) continue;
      try {
        const sr = await fetch(`/api/snkrdunk/search?q=${encodeURIComponent(q)}&page=${page}`, {
          cache: 'no-store',
        });
        const sj = (await sr.json().catch(() => null)) as { results?: SnkSearchRow[] } | null;
        const rows = sj?.results ?? [];
        if (rows.length > 0) anyRows = true;
        for (const row of rows) {
          if (!row?.apparelId || seen.has(row.apparelId)) continue;
          seen.add(row.apparelId);
          // 일본어 원문에서 세트코드/카드번호/레어도 파싱 (포켓몬·원피스 공통).
          const parsed = parseCardStatics(row.name);
          items.push({
            snkrdunkApparelId: row.apparelId,
            // 일본어 원문 → 한국어(사전+음역) — 결과 리스트/등록 별칭 모두 한글로.
            name: translateKnownCardNameToKo(row.name) || row.name,
            nameJa: row.name,
            imageUrl: row.imageUrl ?? null,
            currentPriceJpy: parseYen(row.priceText),
            setCode: parsed.setCode ?? null,
            cardNumber: parsed.cardNumber ?? null,
            rarity: parsed.rarity,
          });
        }
      } catch {
        // snkrdunk 실패는 무시 — lookup/다른 쿼리 결과만으로도 진행
      }
    }
    return { items, anyRows };
  };

  /** 실제 검색 — 스캔 결과처럼 상태 반영 전 값으로도 돌 수 있도록 인자로 받는다. */
  const runSearchWith = async (nameV: string, setCodeV: string, cardNumberV: string) => {
    if (searching) return;
    setErr(null);
    setSaved(false);
    setSaveErr(null);
    setUseFallback(false);
    // 세트코드·카드번호·카드이름 중 하나만 있어도 검색 가능.
    // 정확 매칭(lookup)은 코드+번호가 모두 있을 때만, 스니덩크 검색은 있는 것만 합쳐서.
    const hasCode = !!setCodeV.trim() && !!cardNumberV.trim();
    const hasName = !!nameV.trim();
    const codeQuery = cardCodeQuery({ setCode: setCodeV.trim(), cardNumber: cardNumberV.trim() });
    if (!codeQuery && !hasName) {
      setErr('세트코드, 카드번호, 카드이름 중 하나 이상 입력해 주세요');
      return;
    }
    setSearching(true);
    setSearched(false);
    setResults([]);
    setSelectedIdx(null);
    setHasMore(false);
    setRarityFilter(null);
    setSetFilter(null);
    setMenu(null);
    try {
      const list: RegisterCardInput[] = [];

      // 1) TCGdex 정확 매칭 (setCode-번호) + 로컬 DB — 코드+번호가 있을 때만.
      if (hasCode) {
        const qs = new URLSearchParams({ setCode: setCodeV.trim(), number: cardNumberV.trim() });
        if (nameV.trim()) qs.set('name', nameV.trim());
        const r = await fetch(`/api/cards/lookup?${qs.toString()}`, { cache: 'no-store' });
        const data = (await r.json().catch(() => null)) as
          | { ok?: boolean; found?: boolean; card?: LookupCard | null }
          | null;
        if (data?.found && data.card) {
          list.push(lookupToRegister(data.card));
        }
      }

      // 2) snkrdunk 검색(1페이지) — 세트코드/번호(있는 것만)로, 이름이 있으면 한→일 번역해서 검색.
      const queries: string[] = [];
      if (codeQuery) queries.push(codeQuery);
      if (hasName) {
        const ja = translate(nameV.trim(), 'ja');
        queries.push(ja || nameV.trim());
      }
      const seen = new Set<number>();
      const { items, anyRows } = await fetchSnkPage(queries, 1, seen);
      list.push(...items);
      pagingRef.current = { queries, seen, nextPage: 2 };
      setHasMore(anyRows);

      setResults(list);
      setSearched(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '검색 실패');
    } finally {
      setSearching(false);
    }
  };

  /** "더보기" — 다음 페이지를 이어서 로드해 append. 새 항목이 없으면 버튼 숨김. */
  const loadMore = async () => {
    if (loadingMore || searching) return;
    setLoadingMore(true);
    try {
      const { queries, seen, nextPage } = pagingRef.current;
      const { items, anyRows } = await fetchSnkPage(queries, nextPage, seen);
      pagingRef.current.nextPage = nextPage + 1;
      if (items.length > 0) setResults((prev) => [...prev, ...items]);
      // 서버 page 상한(50) 또는 빈 페이지/새 항목 없음 → 더보기 종료.
      setHasMore(anyRows && items.length > 0 && nextPage < 50);
    } finally {
      setLoadingMore(false);
    }
  };

  // 거래량많은순 선택 시 — 현재 결과의 카탈로그 스냅샷(출품수)을 배치로 로드.
  useEffect(() => {
    if (sort !== 'volume') return;
    const ids = results
      .map((c) => c.snkrdunkApparelId)
      .filter((n): n is number => typeof n === 'number' && n > 0)
      .filter((n) => !volFetchedRef.current.has(n));
    if (ids.length === 0) return;
    ids.forEach((n) => volFetchedRef.current.add(n));
    fetch(`/api/snkrdunk/catalog-entries?ids=${ids.join(',')}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { entries?: Record<string, { listingCount: number | null }> }) => {
        const add: Record<number, number> = {};
        for (const [id, e] of Object.entries(j?.entries ?? {})) {
          if (e?.listingCount != null) add[Number(id)] = e.listingCount;
        }
        if (Object.keys(add).length > 0) setVolumes((prev) => ({ ...prev, ...add }));
      })
      .catch(() => {
        // 카탈로그 미조회 실패 — 거래량 데이터 없이 원래 순서 유지
      });
  }, [sort, results]);

  // 필터 옵션 — 현재 결과에서 발견된 세트/레어도만 노출.
  const setOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of results) {
      const k = setKeyOf(c);
      if (k) s.add(k);
    }
    return [...s].sort();
  }, [results]);
  const rarityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of results) {
      const k = rarityOf(c);
      if (k) s.add(k);
    }
    return [...s].sort((a, b) => (RARITY_RANK[a] ?? 99) - (RARITY_RANK[b] ?? 99));
  }, [results]);

  // 표시 리스트 — 필터 → 정렬. idx 는 results 원본 인덱스(선택 상태 유지용).
  const displayed = useMemo(() => {
    let rows = results.map((c, idx) => ({ c, idx }));
    if (setFilter) rows = rows.filter((r) => setKeyOf(r.c) === setFilter);
    if (rarityFilter) rows = rows.filter((r) => rarityOf(r.c) === rarityFilter);
    if (sort === 'rarity') {
      rows = [...rows].sort((a, b) => {
        const ra = RARITY_RANK[rarityOf(a.c) ?? ''] ?? 99;
        const rb = RARITY_RANK[rarityOf(b.c) ?? ''] ?? 99;
        return ra - rb || a.idx - b.idx;
      });
    } else if (sort === 'price') {
      rows = [...rows].sort(
        (a, b) => (b.c.currentPriceJpy ?? -1) - (a.c.currentPriceJpy ?? -1) || a.idx - b.idx,
      );
    } else if (sort === 'volume') {
      rows = [...rows].sort((a, b) => {
        const va = a.c.snkrdunkApparelId != null ? (volumes[a.c.snkrdunkApparelId] ?? -1) : -1;
        const vb = b.c.snkrdunkApparelId != null ? (volumes[b.c.snkrdunkApparelId] ?? -1) : -1;
        return vb - va || a.idx - b.idx;
      });
    }
    return rows;
  }, [results, setFilter, rarityFilter, sort, volumes]);


  /** 검색 초기화 — 기준·값·결과·선택을 모두 비운다 (프로토타입 '초기화'). */
  const clearSearch = () => {
    setName(''); setSetCode(''); setCardNumber('');
    setField('name');
    setSearched(false); setResults([]); setSelectedIdx(null);
    setHasMore(false); setRarityFilter(null); setSetFilter(null); setMenu(null);
    setErr(null); setSaved(false); setSaveErr(null); setOptOpen(false);
  };

  /** 촬영 → OCR → 읽어낸 이름/세트/번호를 기준에 채우고 그대로 검색. */
  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    setScanning(true);
    try {
      const img = await fileToImage(file);
      const { recognizeCard } = await import('@/components/grading/cardOcr');
      const r = await recognizeCard(img, null, { useAi: true, language: 'ko' });
      const num = r.cardNumber?.left ?? '';
      if (!r.setCode && !num && !r.name) {
        setErr('카드 정보를 읽지 못했어요. 더 또렷한 사진으로 다시 시도해 주세요.');
        return;
      }
      // 인식된 항목만 채운다 — 프로토타입의 "스캔 완료 → 기준 자동 선택 → 결과" 흐름.
      if (r.name) setName(r.name);
      if (r.setCode) setSetCode(r.setCode.toUpperCase());
      if (num) setCardNumber(num);
      setField(r.setCode ? 'set' : r.name ? 'name' : 'num');
      setErr(null);
      // 상태 반영 후 검색 — 최신 값으로 돌도록 다음 틱에.
      setTimeout(() => { void runSearchWith(r.name ?? '', r.setCode ?? '', num); }, 0);
    } catch {
      setErr('스캔에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setScanning(false);
    }
  }

  const runSearch = () => runSearchWith(name, setCode, cardNumber);

  /* ── 등록 ── */
  const selected = selectedIdx != null ? (results[selectedIdx] ?? null) : null;
  // 검색에 안 잡혀도 입력한 정보 그대로 등록할 수 있는 폴백 카드.
  const fallbackCard: RegisterCardInput = {
    setCode: setCode.trim() || null,
    cardNumber: cardNumber.trim() || null,
    name: name.trim() || null,
    imageUrl: null,
  };
  const [useFallback, setUseFallback] = useState(false);
  const target = useFallback ? fallbackCard : selected;

  // 구매가 미입력 시 적용될 등록가 미리보기 — 서버 registerBasisJpy 와 동일 규칙.
  const registerPreview = useMemo(() => {
    const gp = target?.gradePrices;
    if (!gp) return null;
    const b = registerBasisJpy(
      { single: gp.single, psa10: gp.psa10, psa9: gp.psa9, psa8: gp.psa8, trendJpy: [] },
      { graded: opts.graded, gradeCompany: opts.gradeCompany, gradeValue: opts.gradeValue },
    );
    return b.price > 0 ? b : null;
  }, [target, opts.graded, opts.gradeCompany, opts.gradeValue]);
  const basis = target ? selfPulledBasis(target, opts) : null;

  const onRegister = async () => {
    if (!target || saving || saved) return;
    setSaveErr(null);
    setSaving(true);
    try {
      await postMyCard(buildRegisterPayload(target, opts));
      // 내 컬렉션/홈 헤더 세션 캐시 무효화 — 안 비우면 재진입 시 낡은 총액이 먼저 그려진다.
      invalidateCollectionCaches();
      setSaved(true);
      setOptOpen(false);
      // 프로토타입처럼 '등록 완료!' 를 잠깐 보여준 뒤 내 컬렉션으로.
      setTimeout(() => {
        startRouteTransition();
        router.push('/my/cards');
        router.refresh();
      }, 700);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch();
  };

  return (
    <div className="pagebg" style={{ background: P.pageBg, display: 'flex', flexDirection: 'column' }}>
      <ScanProgressOverlay visible={scanning} />

      {/* ── 헤더 + 검색 폼 (스크롤 시 상단 고정) ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: P.pageBg, borderBottom: `1px solid ${P.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px 10px' }}>
          <Link href="/my/cards" aria-label="뒤로가기" style={{ display: 'flex', alignItems: 'center', margin: -8, padding: 8 }}>
            <IcBack c={clean ? '#16161a' : 'var(--ink)'} />
          </Link>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: P.ink, letterSpacing: -0.3 }}>내 카드 등록</div>
        </div>

        {/* 기준 칩 — 셋 중 하나만 골라도 검색된다. 값이 든 기준엔 체크. */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.ink3, marginBottom: 6 }}>
            셋 중 하나만 골라도 검색됩니다
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {FIELDS.map((f) => {
              const has = valueOf(f.key).trim().length > 0;
              const on = field === f.key;
              const c = clean ? f.color : P.accent;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { setField(f.key); inputRef.current?.focus(); }}
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                    fontSize: 12, fontWeight: 800, padding: '8px 2px', borderRadius: 16, cursor: 'pointer',
                    background: has ? c : P.pageBg,
                    color: has ? '#fff' : on ? c : P.ink2,
                    border: `1.5px solid ${has || on ? c : P.fieldBd}`,
                    whiteSpace: 'nowrap', overflow: 'hidden', fontFamily: 'inherit',
                  }}
                >
                  {has && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* 입력 한 줄 — 라벨 칩은 지금 입력 중인 기준, 값은 그 기준의 값. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
            <div
              style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7,
                background: P.pageBg, border: `1.5px solid ${clean ? cur.color : P.accent}`,
                borderRadius: 12, padding: '10px 12px', overflow: 'hidden',
              }}
            >
              <span
                style={{
                  flex: 'none', fontSize: 10.5, fontWeight: 800, color: '#fff',
                  background: clean ? cur.color : P.accent, padding: '3px 8px', borderRadius: 7, whiteSpace: 'nowrap',
                }}
              >
                {cur.label}
              </span>
              <input
                ref={inputRef}
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, color: P.ink, padding: 0, fontFamily: 'inherit' }}
                maxLength={cur.max}
                value={valueOf(field)}
                onChange={(e) => setValueOf(field, e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={cur.placeholder}
              />
              {valueOf(field) && (
                <button
                  type="button"
                  onClick={() => setValueOf(field, '')}
                  aria-label="지우기"
                  style={{ flex: 'none', display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill={clean ? '#C7C7CC' : 'var(--ink3)'}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" stroke={clean ? '#fff' : 'var(--paper)'} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={searching}
              onClick={runSearch}
              style={{
                flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: filled.length > 0 ? P.btnBg : P.disBg, borderRadius: 12, padding: '0 18px',
                border: 'none', cursor: searching ? 'default' : 'pointer',
                boxShadow: filled.length > 0 ? '0 4px 12px rgba(0,0,0,.16)' : 'none',
                opacity: searching ? 0.6 : 1, fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: filled.length > 0 ? P.btnFg : P.disFg, whiteSpace: 'nowrap' }}>
                {searching ? '검색 중' : '검색'}
              </span>
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: P.ink3 }}>{cur.hint}</div>
          {err && (
            <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: clean ? '#F5333F' : 'var(--red)' }}>⚠ {err}</div>
          )}
        </div>

        {/* 또는 — 스캔으로 바로 채우기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 12px' }}>
          <div style={{ flex: 1, height: 1, background: P.line }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: P.ink3 }}>또는</span>
          <div style={{ flex: 1, height: 1, background: P.line }} />
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          <input ref={camFileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} style={{ display: 'none' }} />
          <button
            type="button"
            disabled={scanning}
            onClick={() => camFileRef.current?.click()}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              border: `1.5px dashed ${P.accent}`, background: P.accentSoft, borderRadius: 14,
              padding: '12px 14px', cursor: scanning ? 'default' : 'pointer', textAlign: 'left',
              opacity: scanning ? 0.6 : 1, fontFamily: 'inherit',
            }}
          >
            <span style={{ width: 40, height: 40, borderRadius: 12, background: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: '0 4px 10px rgba(255,122,0,.3)' }}>
              <IcCamera c="#fff" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: P.ink }}>
                {scanning ? '카드를 읽는 중…' : '카드 스캔으로 바로 등록'}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: P.ink3, fontWeight: 600, marginTop: 2 }}>
                카드를 찍으면 이름·세트코드·번호를 자동 인식해요
              </span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div style={{ flex: 1 }}>
        {/* 검색 전 안내 — 카드의 어느 위치를 보고 입력하면 되는지 (프로토타입 튜토리얼) */}
        {!searched && !searching && <CardGuide P={P} clean={clean} />}

        {searched && (
          <>
            {menu && <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />}

            {/* 적용된 기준 칩 + 결과 수 + 초기화 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px 8px' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {filled.map((f) => (
                  <span
                    key={f.key}
                    style={{
                      fontSize: 11, fontWeight: 800, color: '#fff', background: clean ? f.color : P.accent,
                      padding: '3px 9px', borderRadius: 12, whiteSpace: 'nowrap',
                      maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {f.label.replace('카드', '')} {valueOf(f.key)}
                  </span>
                ))}
                <span style={{ fontSize: 13, color: P.ink2, fontWeight: 600 }}>
                  결과 <span style={{ color: P.ink, fontWeight: 800 }}>{displayed.length}</span>개
                </span>
              </div>
              <button
                type="button"
                onClick={clearSearch}
                style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: P.ink3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                초기화
              </button>
            </div>

            {/* 필터 칩 + 정렬 — 결과가 많을 때 좁히는 용도 */}
            {results.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 10px', flexWrap: 'wrap' }}>
                <Chip P={P} active={!setFilter && !rarityFilter} onClick={() => { setSetFilter(null); setRarityFilter(null); setMenu(null); }}>
                  <IcFilter c={!setFilter && !rarityFilter ? P.btnFg : P.ink} />
                  전체
                </Chip>
                {setOptions.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <Chip P={P} active={!!setFilter} onClick={() => setMenu(menu === 'set' ? null : 'set')}>
                      {setFilter ?? '세트'}
                      <IcCaret c={setFilter ? P.btnFg : P.ink} size={12} />
                    </Chip>
                    {menu === 'set' && (
                      <Menu P={P}>
                        <MenuItem P={P} active={!setFilter} onClick={() => { setSetFilter(null); setMenu(null); }}>전체 세트</MenuItem>
                        {setOptions.map((s) => (
                          <MenuItem key={s} P={P} active={setFilter === s} onClick={() => { setSetFilter(s); setMenu(null); }}>{s}</MenuItem>
                        ))}
                      </Menu>
                    )}
                  </div>
                )}
                {rarityOptions.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <Chip P={P} active={!!rarityFilter} onClick={() => setMenu(menu === 'rarity' ? null : 'rarity')}>
                      {rarityFilter ?? '레어도'}
                      <IcCaret c={rarityFilter ? P.btnFg : P.ink} size={12} />
                    </Chip>
                    {menu === 'rarity' && (
                      <Menu P={P}>
                        <MenuItem P={P} active={!rarityFilter} onClick={() => { setRarityFilter(null); setMenu(null); }}>전체 레어도</MenuItem>
                        {rarityOptions.map((r) => (
                          <MenuItem key={r} P={P} active={rarityFilter === r} onClick={() => { setRarityFilter(r); setMenu(null); }}>
                            {r === 'PROMO' ? '프로모' : r}
                          </MenuItem>
                        ))}
                      </Menu>
                    )}
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setMenu(menu === 'sort' ? null : 'sort')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: P.ink, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {SORT_LABEL[sort]} <IcCaret c={P.ink} />
                  </button>
                  {menu === 'sort' && (
                    <Menu P={P} right>
                      {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                        <MenuItem key={k} P={P} active={sort === k} onClick={() => { setSort(k); setMenu(null); }}>{SORT_LABEL[k]}</MenuItem>
                      ))}
                    </Menu>
                  )}
                </div>
              </div>
            )}

            {/* 결과 리스트 (단일 선택) */}
            <div style={{ padding: '0 16px 10px' }}>
              {displayed.map(({ c, idx }) => {
                const sel = !useFallback && selectedIdx === idx;
                const sub = [c.setCode?.toUpperCase(), c.cardNumber].filter(Boolean).join(' · ');
                const rar = rarityOf(c);
                const rarC = rar ? (RARITY_BADGE[rar] ?? { fg: '#8E8E93', bg: '#F2F2F4' }) : null;
                return (
                  <div
                    key={idx}
                    onClick={() => { setUseFallback(false); setSelectedIdx(sel ? null : idx); setSaved(false); setSaveErr(null); }}
                    role="radio"
                    aria-checked={sel}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13, padding: 12, borderRadius: 14, marginBottom: 8,
                      cursor: 'pointer', background: sel ? P.accentSoft : P.pageBg,
                      border: `1.5px solid ${sel ? P.accent : P.line}`,
                    }}
                  >
                    <CardThumb
                      style={{ position: 'relative', width: 52, height: 72, borderRadius: 8, background: P.fieldBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden', boxShadow: '0 3px 8px rgba(0,0,0,.14)' }}
                      src={c.imageUrl}
                      alt={c.name ?? '카드'}
                      emojiSize={26}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name ?? '이름 미상'}
                      </div>
                      {c.nameJa && c.nameJa !== c.name && (
                        <div style={{ fontSize: 11, color: P.ink3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nameJa}</div>
                      )}
                      {sub && (
                        <div style={{ fontSize: 12, color: P.ink3, fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7 }}>
                        {rar && rarC && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: rarC.fg, background: rarC.bg, padding: '2px 7px', borderRadius: 6 }}>
                            {rar === 'PROMO' ? '프로모' : rar}
                          </span>
                        )}
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: P.ink2, border: `1px solid ${P.fieldBd}`, padding: '2px 7px', borderRadius: 6 }}>일본판</span>
                        {c.currentPriceJpy != null && (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: P.ink, marginLeft: 2 }}>
                            ¥{Math.round(c.currentPriceJpy).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${sel ? P.accent : P.radioBd}`, background: P.pageBg }}>
                      {sel && <div style={{ width: 12, height: 12, borderRadius: '50%', background: P.accent }} />}
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={loadMore}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: `1.5px solid ${P.fieldBd}`, background: P.pageBg, fontSize: 13, fontWeight: 700, color: P.ink, cursor: 'pointer', marginBottom: 4, fontFamily: 'inherit' }}
                >
                  {loadingMore ? '불러오는 중...' : '↓ 결과 더보기'}
                </button>
              )}

              {/* 검색에 안 잡혀도 입력한 정보 그대로 등록 */}
              <div style={{ textAlign: 'center', padding: '12px 0 8px', fontSize: 13, fontWeight: 700, color: P.ink3 }}>
                찾는 카드가 없나요?{' '}
                <span
                  onClick={() => { setUseFallback(true); setSelectedIdx(null); setOptOpen(true); }}
                  style={{ color: P.accent, cursor: 'pointer', textDecoration: useFallback ? 'underline' : 'none' }}
                >
                  직접 입력하기
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 등록 옵션 (같은 화면의 접이식 패널 — 별도 '카드 등록' 화면 없음) ── */}
      {target && optOpen && (
        <div
          className="addbar-sticky"
          style={{ position: 'sticky', zIndex: 21, background: P.pageBg, borderTop: `1px solid ${P.line}`, padding: '14px 18px 4px', maxHeight: '58vh', overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, fontSize: 14.5, fontWeight: 800, color: P.ink }}>등록 옵션</div>
            <button type="button" onClick={() => setOptOpen(false)} aria-label="옵션 닫기" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5, fontWeight: 700, color: P.ink3, fontFamily: 'inherit' }}>
              접기 ⌄
            </button>
          </div>

          <OptCheck P={P} on={opts.selfPulled} onClick={() => patch({ selfPulled: !opts.selfPulled })}
            label="직접 뽑은 카드예요" sub="구입가 대신 현재시세를 기준가로" />

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: P.ink2 }}>구입가격</span>
              {!opts.selfPulled && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['KRW', 'JPY'] as const).map((c) => (
                    <button key={c} type="button" onClick={() => patch({ buyCurrency: c })}
                      style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 8, border: 'none', cursor: 'pointer', background: opts.buyCurrency === c ? P.btnBg : P.fieldBg, color: opts.buyCurrency === c ? P.btnFg : P.ink2, fontFamily: 'inherit' }}>
                      {c === 'JPY' ? '¥ 엔화' : '₩ 원화'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {opts.selfPulled ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: P.ink3, background: P.fieldBg, borderRadius: 11, padding: '10px 12px' }}>
                {basis
                  ? `현재시세 ${basis.cur === 'JPY' ? '¥' : '₩'}${basis.price.toLocaleString()} 적용`
                  : registerPreview
                    ? `${registerPreview.basis} 시세 ¥${registerPreview.price.toLocaleString()} 적용`
                    : '현재시세 정보가 없어 기준가는 비워둡니다'}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: P.fieldBg, border: `1.5px solid ${P.fieldBd}`, borderRadius: 11, padding: '10px 12px' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: P.ink3 }}>{opts.buyCurrency === 'JPY' ? '¥' : '₩'}</span>
                <input
                  inputMode="numeric"
                  value={opts.buyPrice}
                  onChange={(e) => patch({ buyPrice: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder={opts.buyCurrency === 'JPY' ? '엔화 금액' : '원화 금액'}
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, color: P.ink, padding: 0, fontFamily: 'inherit' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 5 }}>구입 날짜</div>
              <input
                type="date"
                value={opts.buyDate}
                onChange={(e) => patch({ buyDate: e.target.value })}
                style={{ width: '100%', background: P.fieldBg, border: `1.5px solid ${P.fieldBd}`, borderRadius: 11, padding: '9px 12px', fontSize: 13.5, fontWeight: 700, color: P.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 'none' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 5 }}>수량</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: P.fieldBg, border: `1.5px solid ${P.fieldBd}`, borderRadius: 11, padding: '3px 4px' }}>
                <QtyBtn P={P} onClick={() => patch({ qty: Math.max(1, opts.qty - 1) })}>−</QtyBtn>
                <span style={{ minWidth: 30, textAlign: 'center', fontSize: 14, fontWeight: 800, color: P.ink }}>{opts.qty}</span>
                <QtyBtn P={P} onClick={() => patch({ qty: Math.min(999, opts.qty + 1) })}>＋</QtyBtn>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 5 }}>발매 지역</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([{ k: 'jp', label: '일본판' }, { k: 'kr', label: '한국판' }, { k: 'en', label: '영문판' }] as const).map((r) => (
                <OptSeg key={r.k} P={P} active={opts.region === r.k} onClick={() => patch({ region: r.k })}>{r.label}</OptSeg>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <OptCheck P={P} on={opts.graded} onClick={() => patch({ graded: !opts.graded })} label="등급(그레이딩) 카드예요" />
          </div>
          {opts.graded && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 5 }}>등급사</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {GRADE_COMPANIES.map((c) => (
                    <OptSeg key={c} P={P} compact active={opts.gradeCompany === c} onClick={() => patch({ gradeCompany: c })}>{c}</OptSeg>
                  ))}
                </div>
              </div>
              <div style={{ flex: 'none', width: 118 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 5 }}>등급</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['10', '9', '8'].map((v) => (
                    <OptSeg key={v} P={P} compact active={opts.gradeValue === v} onClick={() => patch({ gradeValue: v })}>{v}</OptSeg>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 구매가 미입력 시 적용될 등록가 안내 */}
          {!opts.selfPulled && !opts.buyPrice.trim() && (
            <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: P.ink3, lineHeight: 1.6 }}>
              {registerPreview
                ? `구매가 미입력 시 ${registerPreview.basis} 시세 ¥${registerPreview.price.toLocaleString()}(등록 시점 기준)로 등록돼요`
                : opts.graded
                  ? '구매가 미입력 시 등급 시세(타사 등급은 PSA10 기준)로 등록돼요'
                  : '구매가 미입력 시 현재 싱글 시세로 등록돼요'}
            </div>
          )}

          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 5 }}>메모 (선택)</div>
            <textarea
              rows={2}
              maxLength={500}
              value={opts.memo}
              onChange={(e) => patch({ memo: e.target.value })}
              placeholder="구입 경로, 보관 위치, 컨디션 등"
              style={{ width: '100%', background: P.fieldBg, border: `1.5px solid ${P.fieldBd}`, borderRadius: 11, padding: '10px 12px', fontSize: 13.5, fontWeight: 600, color: P.ink, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}

      {/* ── 하단 고정 등록 바 ── */}
      {searched && (
        <div
          className="addbar-sticky"
          style={{
            position: 'sticky', zIndex: 20, background: P.barBg, backdropFilter: 'blur(12px)',
            borderTop: `1px solid ${P.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
          }}
        >
          <div style={{ flex: 'none', maxWidth: 104, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: P.ink3, fontWeight: 600 }}>선택한 카드</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: P.ink, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {target?.name ?? '선택 안 됨'}
            </div>
          </div>
          {target && !saved && (
            <button
              type="button"
              onClick={() => setOptOpen((v) => !v)}
              aria-label="등록 옵션"
              style={{ flex: 'none', height: 50, padding: '0 12px', borderRadius: 14, border: `1.5px solid ${P.fieldBd}`, background: P.pageBg, cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: P.ink, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              옵션 {optOpen ? '⌄' : '⌃'}
            </button>
          )}
          <button
            type="button"
            disabled={!target || saving || saved}
            onClick={onRegister}
            style={{
              flex: 1, height: 50, borderRadius: 14, border: 'none',
              background: saved ? '#2BB673' : target ? P.btnBg : P.disBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: target && !saving && !saved ? 'pointer' : 'default',
              boxShadow: target && !saved ? '0 6px 16px rgba(0,0,0,.18)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            {saved && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            )}
            <span style={{ fontSize: 15.5, fontWeight: 800, color: saved || target ? '#fff' : P.disFg }}>
              {saved ? '등록 완료!' : saving ? '등록 중…' : target ? '내 카드로 등록' : '카드를 선택하세요'}
            </span>
          </button>
        </div>
      )}
      {saveErr && (
        <div style={{ padding: '0 18px 10px', fontSize: 12.5, fontWeight: 700, color: clean ? '#F5333F' : 'var(--red)', background: P.barBg }}>⚠ {saveErr}</div>
      )}
    </div>
  );
}

/** 등록 옵션 체크 행. */
function OptCheck({ P, on, onClick, label, sub }: { P: Palette; on: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12,
        background: on ? P.accentSoft : P.fieldBg, border: `1.5px solid ${on ? P.accent : P.fieldBd}`,
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <span style={{ width: 20, height: 20, flex: 'none', borderRadius: 6, border: `2px solid ${on ? P.accent : P.radioBd}`, background: on ? P.accent : P.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {on && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: P.ink }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: P.ink3, marginTop: 2 }}>{sub}</span>}
      </span>
    </button>
  );
}

/** 등록 옵션 세그먼트 버튼. */
function OptSeg({ P, active, compact, onClick, children }: { P: Palette; active: boolean; compact?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: compact ? 'none' : 1, padding: compact ? '7px 11px' : '10px 0', borderRadius: 11, cursor: 'pointer',
        background: active ? P.btnBg : P.pageBg, color: active ? P.btnFg : P.ink,
        border: `1.5px solid ${active ? P.btnBg : P.fieldBd}`, fontSize: compact ? 11.5 : 12.5, fontWeight: 800, fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function QtyBtn({ P, onClick, children }: { P: Palette; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: P.pageBg, color: P.ink, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
    >
      {children}
    </button>
  );
}

/**
 * 검색 전 안내 — 카드의 어느 위치에서 이름/세트코드/카드번호를 읽으면 되는지.
 * 실제 카드 이미지는 저작권 문제가 있어 샘플 일러스트로 그린다(프로토타입 동일).
 */
function CardGuide({ P, clean }: { P: Palette; clean: boolean }) {
  const NAME_C = clean ? '#FF7A00' : P.accent;
  const SET_C = clean ? '#2563EB' : P.ink;
  const NUM_C = clean ? '#1E8E5A' : P.ink;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 20px 26px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink3, marginBottom: 12 }}>
        카드에서 이 위치를 확인하세요
      </div>
      <div
        style={{
          position: 'relative', width: 196, height: 274, borderRadius: 11, padding: 7,
          background: 'linear-gradient(150deg,#f5d442,#d4a800 70%,#b08800)',
          boxShadow: '0 10px 26px rgba(0,0,0,.18)', overflow: 'hidden',
        }}
      >
        {/* 샘플 워터마크 — 콜아웃보다 먼저 깔아 색 표시가 흐려지지 않게 한다. */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: 'rgba(22,22,26,.22)', letterSpacing: 5, transform: 'rotate(-24deg)' }}>SAMPLE</span>
        </div>

        {/* 카드이름 — 실제 이름 글자를 그대로 테두리로 감싸고 배지를 바로 옆에 붙인다. */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              fontSize: 11.5, fontWeight: 900, color: '#16161a', whiteSpace: 'nowrap',
              border: `2px solid ${NAME_C}`, borderRadius: 5, padding: '1px 5px', background: 'rgba(255,255,255,.55)',
            }}
          >
            피카츄 ex
          </span>
          <Tag color={NAME_C}>카드이름</Tag>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 7, fontWeight: 800, color: '#b3261e' }}>HP</span>
          <span style={{ fontSize: 11.5, fontWeight: 900, color: '#16161a' }}>200</span>
        </div>

        <div style={{ position: 'relative', height: 138, marginTop: 5, border: '3px solid #c9a000', borderRadius: 4, overflow: 'hidden', background: 'radial-gradient(120% 100% at 50% 30%,#fff3b0 0%,#ffd76e 45%,#e8a800 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54 }}>⚡</div>
        </div>
        <div style={{ position: 'relative', marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5, padding: '0 2px' }}>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,.12)' }} />
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,.12)', width: '76%' }} />
        </div>

        {/* 세트코드 · 카드번호 — 카드 하단 실제 표기를 각각 감싸고 배지를 바로 위에 둔다. */}
        <div style={{ position: 'absolute', left: 7, right: 7, bottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Tag color={SET_C}>세트코드</Tag>
            <Tag color={NUM_C}>카드번호</Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#16161a', border: `2px solid ${SET_C}`, borderRadius: 4, padding: '1px 4px', background: 'rgba(255,255,255,.55)' }}>SV4a</span>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#16161a', border: `2px solid ${NUM_C}`, borderRadius: 4, padding: '1px 4px', background: 'rgba(255,255,255,.55)' }}>025/165</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: P.ink3, fontWeight: 600, marginTop: 10 }}>· 설명용 샘플 이미지입니다</div>
    </div>
  );
}

/** 콜아웃 배지 — 가리키는 항목 바로 옆/위에 붙는 작은 색 라벨. */
function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9, fontWeight: 800, color: '#fff', background: color,
        padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', lineHeight: 1.3,
      }}
    >
      {children}
    </span>
  );
}
function Chip({
  P,
  active,
  onClick,
  children,
}: {
  P: Palette;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
        fontSize: 13,
        fontWeight: 700,
        padding: '8px 14px',
        borderRadius: 11,
        background: active ? P.btnBg : P.pageBg,
        color: active ? P.btnFg : P.ink,
        border: `1px solid ${active ? P.btnBg : P.fieldBd}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

/** 칩/정렬 드롭다운 패널. 부모는 position:relative 여야 한다. */
function Menu({ P, right, children }: { P: Palette; right?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        ...(right ? { right: 0 } : { left: 0 }),
        zIndex: 40,
        minWidth: 130,
        maxHeight: 260,
        overflowY: 'auto',
        background: P.pageBg,
        border: `1px solid ${P.fieldBd}`,
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,.14)',
        padding: '5px 0',
      }}
    >
      {children}
    </div>
  );
}

function MenuItem({
  P,
  active,
  onClick,
  children,
}: {
  P: Palette;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: active ? 800 : 700,
        color: active ? P.accent : P.ink,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function lookupToRegister(card: LookupCard): RegisterCardInput {
  return {
    cardId: null,
    setCode: card.setCode ?? null,
    cardNumber: card.number ?? null,
    name: card.localName || card.name || null,
    imageUrl: card.imageLarge || card.imageSmall || null,
    currentPriceJpy: card.priceSummary?.byRegion?.jpy ?? null,
    currentPriceKrw: card.priceSummary?.byRegion?.krw ?? null,
  };
}
