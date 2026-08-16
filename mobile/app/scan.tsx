import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Pressable, TextInput, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelBall } from '@/components/PixelBall';
import { CardThumb } from '@/components/cv/CardThumb';
import { Chip } from '@/components/cv/Chip';
import { RarBadge } from '@/components/cv/RarBadge';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { CardScanner, type CapturedCard } from '@/components/cv/CardScanner';
import { ScanPreview } from '@/components/cv/ScanPreview';
import { BatchScanPreview } from '@/components/cv/BatchScanPreview';
import { useChrome } from '@/components/ChromeContext';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant, useTheme } from '@/components/ThemeProvider';
import { CARDS, GAMES, fmt, priceLabel, displayCardName, inferCardCurrency, cardProfit, type CardItem, type Game, type Rarity, type PriceCurrency } from '@/data/cardvault';
import { addCards } from '@/lib/collection';
import { usePriceMode } from '@/lib/priceMode';
import { lookupCardInfo } from '@/services/cardScanApi';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useAuthed } from '@/lib/useAuthed';
import { searchSnkrdunkByQuery } from '@/services/snkrdunk';
import { koToJaServer, jaToKoBatch, jaToKoCached } from '@/lib/cardLang';
import { api } from '@/lib/apiClient';
import { useNavPrefs } from '@/components/NavPrefsProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScanToSearch } from '@/lib/useScanToSearch';
import { CardRegisterForm, useManualPalette, type ManualPalette } from '@/components/CardRegisterForm';
import { parseCardStatics } from '../../shared/cardStatics';

/** "¥2,000" → 2000. 못 읽으면 0. */
function parseYen(t?: string): number {
  if (!t) return 0;
  const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ── 직접입력 결과 정렬/필터 — 웹 ManualAddForm 패리티 ── */

type ManSortKey = 'rel' | 'rarity' | 'price' | 'volume';

const MAN_SORT_LABEL: Record<ManSortKey, string> = {
  rel: '관련도순',
  rarity: '레어도순',
  price: '비싼순',
  volume: '거래량많은순',
};

/** 레어도 랭크 — 낮을수록 위. PROMO > UR > SAR > SR > AR > … (웹 RARITY_RANK 동일) */
const MAN_RARITY_RANK: Record<string, number> = {
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

/** 레어도 — 파싱된 rarityToken 우선, 없으면 카드명 토큰. 프로모(프로모/PROMO/세트코드 -P)는 PROMO 로. */
function manRarityOf(c: CardItem): string | null {
  if (c.rarityToken) return c.rarityToken.toUpperCase();
  const raw = c.name ?? '';
  const up = `${raw} ${c.set ?? ''}`.toUpperCase();
  if (/프로모|PROMO/.test(raw) || /-P[\s\]\)]|-P$/.test(up)) return 'PROMO';
  const m = up.match(/(?:^|[^A-Z0-9])(SAR|SSR|CSR|CHR|RRR|RR|UR|HR|AR|SR)(?![A-Z0-9])/);
  return m ? m[1] : null;
}

/** 레어도 배지 색 — 데이터 색이라 테마 무관 고정 (웹 RARITY_BADGE 동일). */
const MAN_RARITY_BADGE: Record<string, { fg: string; bg: string }> = {
  PROMO: { fg: '#F5333F', bg: '#FFECEC' },
  UR: { fg: '#2563EB', bg: '#E0EDFF' },
  SAR: { fg: '#7C5CFC', bg: '#F4F1FF' },
  SR: { fg: '#C2410C', bg: '#FFEDD5' },
  AR: { fg: '#1E8E5A', bg: '#E3F6EC' },
  HR: { fg: '#B8860B', bg: '#FBF3DA' },
  RR: { fg: '#8E44AD', bg: '#F3EAFB' },
};

/** 세트 키 — 입력한 세트코드 우선, 없으면 이름의 "[SV4a 201/165]" 대괄호에서 추출. */
function manSetKeyOf(c: CardItem): string | null {
  if (c.set && c.set !== '-') return c.set.trim().toUpperCase();
  const m = (c.name ?? '').toUpperCase().match(/\[([A-Z0-9\-]{2,10})[\s\]]/);
  return m ? m[1] : null;
}
import type { GuideRect, ScanLanguage } from '@/types/cardScan';

type Mode = 'choose' | 'camera' | 'preview' | 'batch' | 'manual' | 'register' | 'result' | 'batchResult';

export default function ScanScreen() {
  // 서버 /api/cards/scan 이 로그인 필수가 됨 — 미로그인은 게이트만 렌더.
  // 본체(Inner)는 로그인 시에만 마운트해 로그인 상태 전환에도 훅 순서가 안전.
  const authed = useAuthed();
  if (!authed) {
    return (
      <InlineLoginGate
        title="카드 스캔"
        feature="카드 스캔"
        description="AI 카드 인식 · 등록은 로그인 후 이용할 수 있어요"
        icon="📷"
      />
    );
  }
  return <ScanScreenInner />;
}

function ScanScreenInner() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { theme } = useTheme();
  const { navStyle } = useNavPrefs();
  const insets = useSafeAreaInsets();
  // 우상단 카메라 — 홈 검색 인풋 카메라와 동일한 촬영→OCR→검색 플로우.
  const { scanBusy: camSearchBusy, scanToSearch: camSearch } = useScanToSearch();
  // 직접입력 팔레트 — 정본은 CardRegisterForm.useManualPalette (등록 폼과 공유).
  const MP = useManualPalette();
  const params = useLocalSearchParams<{
    mode?: string;
    regApparelId?: string;
    regName?: string;
    regImage?: string;
    regPrice?: string;
  }>();
  const initRef = useRef(false);
  const [mode, setMode] = useState<Mode>('choose');
  const [found, setFound] = useState<CardItem | null>(null);
  const [batchFound, setBatchFound] = useState<CardItem[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{
    guideRect: GuideRect;
    imageWidth: number;
    imageHeight: number;
    capturedAt: string;
  } | null>(null);
  const [captures, setCaptures] = useState<CapturedCard[]>([]);
  // PaddleOCR (server-side, free) is dramatically more accurate than Tesseract
  // on stylized italic numbers / Korean titles. Always ON — toggle removed
  // since Tesseract path can't reliably read m1L-era set badges.
  const useAi = true;
  // Card-name language. Routes server OCR to a single worker for speed + accuracy.
  const [scanLang, setScanLang] = useState<ScanLanguage>('ko');
  const { setHidden } = useChrome();
  useEffect(() => {
    setHidden(mode === 'camera');
    return () => setHidden(false);
  }, [mode, setHidden]);
  const { mode: priceMode } = usePriceMode();
  const [manName, setManName] = useState('');
  const [manSet, setManSet] = useState('');
  const [manNum, setManNum] = useState('');
  const [manGame, setManGame] = useState<Game>('포켓몬');
  const [manRar, setManRar] = useState<Rarity>('R');
  // 직접입력 검색 상태 — 세트코드+번호로 조회한 결과 리스트.
  const [manSearching, setManSearching] = useState(false);
  const [manSearched, setManSearched] = useState(false);
  const [manErr, setManErr] = useState<string | null>(null);
  const [manResults, setManResults] = useState<CardItem[]>([]);
  // "더보기" 페이지네이션 — 검색 쿼리/중복셋/다음 페이지를 유지해 이어서 로드.
  const [manHasMore, setManHasMore] = useState(false);
  const [manLoadingMore, setManLoadingMore] = useState(false);
  const manPagingRef = useRef<{ queries: string[]; seen: Set<number>; nextPage: number }>({
    queries: [],
    seen: new Set(),
    nextPage: 1,
  });
  // 정렬/필터/단일 선택 — 웹 ManualAddForm 패리티. 관련도순 = 검색 API 순서 그대로.
  const [manSort, setManSort] = useState<ManSortKey>('rel');
  const [manRarityFilter, setManRarityFilter] = useState<string | null>(null);
  const [manSetFilter, setManSetFilter] = useState<string | null>(null);
  const [manMenu, setManMenu] = useState<'set' | 'rarity' | 'sort' | null>(null);
  const [manSelectedIdx, setManSelectedIdx] = useState<number | null>(null);
  // 거래량많은순 — 카탈로그 스냅샷의 출품수(listingCount). apparelId → count.
  const [manVolumes, setManVolumes] = useState<Record<number, number>>({});
  const manVolFetchedRef = useRef<Set<number>>(new Set());

  // 5단계 — 구매정보 입력(등록 폼) 대상 카드. 폼 자체는 CardRegisterForm 공용 컴포넌트.
  const [pendingCard, setPendingCard] = useState<CardItem | null>(null);
  const [pendingFrom, setPendingFrom] = useState<'scan' | 'manual'>('scan');

  /** 스캔/직접입력 카드 확정 → 시세상세(카드정보)로 — 등록은 상세의 '내 컬렉션에
   *  추가'에서(웹과 통일). 스니덩크 매칭 없으면 코드+번호 검색 목록으로,
   *  둘 다 없으면 기존 등록 시트 폴백. */
  const goCardInfo = (card: CardItem, from: 'scan' | 'manual') => {
    if (card.snkrdunkApparelId) {
      router.push(`/cards/snkrdunk/${card.snkrdunkApparelId}` as never);
      return;
    }
    const q = [card.set && card.set !== '-' ? card.set : '', card.num && card.num !== '-' ? card.num.split('/')[0] : '']
      .filter(Boolean)
      .join(' ')
      .trim();
    if (q) {
      router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(q)}` as never);
      return;
    }
    openRegister(card, from);
  };

  /** 확정된 카드를 받아 구매정보 입력 단계로 (입력값 초기화는 CardRegisterForm 마운트 시). */
  const openRegister = (card: CardItem, from: 'scan' | 'manual') => {
    setPendingCard(card);
    setPendingFrom(from);
    setMode('register');
  };

  // 진입 파라미터 처리 (한 번만):
  // - regApparelId: 시세 상세 "내 컬렉션" → 해당 카드로 바로 등록 시트
  // - mode=manual: 직접 입력 진입
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (params.regApparelId) {
      const apparelId = parseInt(String(params.regApparelId), 10);
      const priceJpy = params.regPrice ? parseInt(String(params.regPrice), 10) : 0;
      if (Number.isFinite(apparelId) && apparelId > 0) {
        openRegister(
          {
            id: Date.now(),
            name: params.regName ? String(params.regName) : '카드',
            set: '-',
            num: '-',
            game: '포켓몬',
            rar: 'R',
            grade: null,
            price: priceJpy > 0 ? priceJpy : 0,
            priceSingle: priceJpy > 0 ? priceJpy : undefined,
            priceCurrency: 'JPY',
            trend: [],
            emoji: '🃏',
            owned: true,
            snkrdunkApparelId: apparelId,
            imageUrl: params.regImage ? String(params.regImage) : undefined,
          },
          'manual',
        );
      }
    } else if (params.mode === 'manual') {
      setMode('manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 6단계로 — 등록 폼(CardRegisterForm) 저장 완료 시 결과 화면으로. */
  const onRegisterSaved = (card: CardItem) => {
    setFound(card);
    setMode('result');
  };

  /** 입력값(또는 lookup 결과)으로 CardItem 구성. */
  const buildManualCard = (over?: Partial<CardItem>): CardItem => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: manName || '무제 카드',
    set: manSet || '-',
    num: manNum || '-',
    game: manGame,
    rar: manRar,
    grade: null,
    price: 0,
    trend: [],
    emoji: '🃏',
    owned: true,
    ...over,
  });

  /** snkrdunk 한 페이지 로드 → 한글 번역까지 마친 CardItem 목록. (더보기 공용) */
  const fetchManPage = async (
    queries: string[],
    page: number,
    seen: Set<number>,
  ): Promise<{ items: CardItem[]; anyRows: boolean }> => {
    const matched: Array<{ apparelId: number; name: string; imageUrl?: string | null; priceText?: string }> = [];
    let anyRows = false;
    for (const q of queries) {
      if (!q) continue;
      const rows = await searchSnkrdunkByQuery(q, page).catch(() => []);
      if (rows.length > 0) anyRows = true;
      for (const row of rows) {
        if (!row?.apparelId || seen.has(row.apparelId)) continue;
        seen.add(row.apparelId);
        matched.push(row);
      }
    }
    // 일본어 카드명 → 한국어 일괄 번역(서버 공통 엔진, 실패 시 로컬 캐시 폴백).
    const koNames = await jaToKoBatch(matched.map((r) => r.name)).catch(() => new Map<string, string>());
    const items = matched.map((row) => {
      const price = parseYen(row.priceText);
      // 일본어 원문에서 세트코드/카드번호/레어도 파싱 (포켓몬·원피스 공통, 웹 동일).
      const parsed = parseCardStatics(row.name);
      return buildManualCard({
        name: koNames.get(row.name) || jaToKoCached(row.name) || row.name,
        nameJa: row.name,
        set: manSet || parsed.setCode || '-',
        num: manNum || parsed.cardNumber || '-',
        rarityToken: parsed.rarity ?? undefined,
        price,
        priceSingle: price > 0 ? price : undefined,
        priceCurrency: 'JPY',
        snkrdunkApparelId: row.apparelId,
        imageUrl: row.imageUrl ?? undefined,
      });
    });
    return { items, anyRows };
  };

  /** 세트코드+카드번호 또는 카드 이름으로 검색 → 결과 리스트. 다음 페이지는 "더보기". */
  const runManualSearch = async () => {
    if (manSearching) return;
    setManErr(null);
    const hasCode = !!manSet.trim() && !!manNum.trim();
    const hasName = !!manName.trim();
    // 세트코드+번호 또는 이름 중 하나만 있으면 검색 가능 (웹 ManualAddForm 동일).
    if (!hasCode && !hasName) {
      setManErr('세트 코드+카드 번호 또는 카드 이름을 입력해 주세요');
      return;
    }
    setManSearching(true);
    setManSearched(false);
    setManResults([]);
    setManHasMore(false);
    setManSelectedIdx(null);
    setManRarityFilter(null);
    setManSetFilter(null);
    setManMenu(null);
    try {
      const list: CardItem[] = [];
      // 1) TCGdex 정확 매칭 + 로컬 DB — 코드+번호가 있을 때만.
      if (hasCode) {
        const res = await lookupCardInfo({
          setCode: manSet.trim(),
          cardNumber: manNum.trim().split('/')[0],
          name: manName.trim() || undefined,
        });
        if (res.found && res.card) {
          const c = res.card;
          const jpy = c.priceSummary?.byRegion?.jpy ?? null;
          const krw = c.priceSummary?.byRegion?.krw ?? null;
          const priceCur: PriceCurrency = jpy != null ? 'JPY' : 'KRW';
          const priceVal = jpy != null ? jpy : krw ?? 0;
          list.push(
            buildManualCard({
              name: c.localName || c.name || manName || '무제 카드',
              set: c.setCode || manSet || '-',
              num: c.number || manNum || '-',
              price: Math.round(priceVal),
              priceSingle: Math.round(priceVal),
              priceCurrency: priceCur,
              imageUrl: c.imageLarge || c.imageSmall || undefined,
            }),
          );
        }
      }

      // 2) snkrdunk 검색(1페이지) — 코드+번호로, 이름이 있으면 한→일 번역해서도 검색.
      //    (이름만 입력 시 이 경로가 메인 검색이 된다)
      const seen = new Set<number>();
      const queries: string[] = [];
      if (hasCode) queries.push(`${manSet.trim()} ${manNum.trim()}`.trim());
      if (hasName) queries.push((await koToJaServer(manName.trim())) || manName.trim());
      const { items, anyRows } = await fetchManPage(queries, 1, seen);
      list.push(...items);
      manPagingRef.current = { queries, seen, nextPage: 2 };
      setManHasMore(anyRows);

      setManResults(list);
      setManSearched(true);
    } catch (e) {
      setManErr(e instanceof Error ? e.message : '검색 실패');
    } finally {
      setManSearching(false);
    }
  };

  // 거래량많은순 선택 시 — 현재 결과의 카탈로그 스냅샷(출품수)을 배치로 로드.
  useEffect(() => {
    if (manSort !== 'volume') return;
    const ids = manResults
      .map((c) => c.snkrdunkApparelId)
      .filter((n): n is number => typeof n === 'number' && n > 0)
      .filter((n) => !manVolFetchedRef.current.has(n));
    if (ids.length === 0) return;
    ids.forEach((n) => manVolFetchedRef.current.add(n));
    api<{ entries?: Record<string, { listingCount: number | null }> }>(
      `/api/snkrdunk/catalog-entries?ids=${ids.join(',')}`,
      { auth: false },
    )
      .then((j) => {
        const add: Record<number, number> = {};
        for (const [id, e] of Object.entries(j?.entries ?? {})) {
          if (e?.listingCount != null) add[Number(id)] = e.listingCount;
        }
        if (Object.keys(add).length > 0) setManVolumes((prev) => ({ ...prev, ...add }));
      })
      .catch(() => {
        // 카탈로그 미조회 실패 — 거래량 데이터 없이 원래 순서 유지
      });
  }, [manSort, manResults]);

  // 필터 옵션 — 현재 결과에서 발견된 세트/레어도만 노출.
  const manSetOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of manResults) {
      const k = manSetKeyOf(c);
      if (k) s.add(k);
    }
    return [...s].sort();
  }, [manResults]);
  const manRarityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of manResults) {
      const k = manRarityOf(c);
      if (k) s.add(k);
    }
    return [...s].sort((a, b) => (MAN_RARITY_RANK[a] ?? 99) - (MAN_RARITY_RANK[b] ?? 99));
  }, [manResults]);

  // 표시 리스트 — 필터 → 정렬. idx 는 manResults 원본 인덱스(선택 상태 유지용).
  const manDisplayed = useMemo(() => {
    let rows = manResults.map((c, idx) => ({ c, idx }));
    if (manSetFilter) rows = rows.filter((r) => manSetKeyOf(r.c) === manSetFilter);
    if (manRarityFilter) rows = rows.filter((r) => manRarityOf(r.c) === manRarityFilter);
    if (manSort === 'rarity') {
      rows = [...rows].sort((a, b) => {
        const ra = MAN_RARITY_RANK[manRarityOf(a.c) ?? ''] ?? 99;
        const rb = MAN_RARITY_RANK[manRarityOf(b.c) ?? ''] ?? 99;
        return ra - rb || a.idx - b.idx;
      });
    } else if (manSort === 'price') {
      rows = [...rows].sort((a, b) => (b.c.price || -1) - (a.c.price || -1) || a.idx - b.idx);
    } else if (manSort === 'volume') {
      rows = [...rows].sort((a, b) => {
        const va = a.c.snkrdunkApparelId != null ? (manVolumes[a.c.snkrdunkApparelId] ?? -1) : -1;
        const vb = b.c.snkrdunkApparelId != null ? (manVolumes[b.c.snkrdunkApparelId] ?? -1) : -1;
        return vb - va || a.idx - b.idx;
      });
    }
    return rows;
  }, [manResults, manSetFilter, manRarityFilter, manSort, manVolumes]);

  const manSelected = manSelectedIdx != null ? (manResults[manSelectedIdx] ?? null) : null;

  /** "더보기" — 다음 페이지를 이어서 로드해 append. 새 항목이 없으면 버튼 숨김. */
  const loadMoreManual = async () => {
    if (manLoadingMore || manSearching) return;
    setManLoadingMore(true);
    try {
      const { queries, seen, nextPage } = manPagingRef.current;
      const { items, anyRows } = await fetchManPage(queries, nextPage, seen);
      manPagingRef.current.nextPage = nextPage + 1;
      if (items.length > 0) setManResults((prev) => [...prev, ...items]);
      // 빈 페이지/새 항목 없음 또는 서버 page 상한(50) → 더보기 종료.
      setManHasMore(anyRows && items.length > 0 && nextPage < 50);
    } finally {
      setManLoadingMore(false);
    }
  };

  if (mode === 'camera') {
    return (
      <CardScanner
        onCancel={() => setMode('choose')}
        onCaptured={(items) => {
          if (items.length === 0) {
            setMode('choose');
            return;
          }
          if (items.length === 1) {
            setPhotoUri(items[0].uri);
            setPhotoMeta(items[0].meta);
            setMode('preview');
          } else {
            setCaptures(items);
            setMode('batch');
          }
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar
        onBack={() => {
          if (mode === 'choose') {
            router.replace('/my/cards' as never);
            return;
          }
          if (mode === 'register') {
            setMode(pendingFrom === 'manual' ? 'manual' : 'choose');
            return;
          }
          if (mode === 'batchResult' || mode === 'batch') {
            setBatchFound([]);
            setCaptures([]);
          }
          setMode('choose');
        }}
        title={mode === 'manual' ? '카드 추가' : '카드 등록'}
        right={
          mode === 'manual' ? (
            <Pressable
              onPress={camSearch}
              disabled={camSearchBusy}
              hitSlop={6}
              accessibilityLabel="카드 사진 스캔"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: MP.btnBg, alignItems: 'center', justifyContent: 'center', opacity: camSearchBusy ? 0.5 : 1 }}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={MP.btnFg} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M14.5 4h-5L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2.5-3Z" />
                <Circle cx={12} cy={13} r={3.2} />
              </Svg>
            </Pressable>
          ) : undefined
        }
      />
      {mode === 'preview' && photoUri && photoMeta ? (
        <ScanPreview
          uri={photoUri}
          guideRect={photoMeta.guideRect}
          imageWidth={photoMeta.imageWidth}
          imageHeight={photoMeta.imageHeight}
          capturedAt={photoMeta.capturedAt}
          useAi={useAi}
          language={scanLang}
          onRetake={() => setMode('camera')}
          onConfirm={(card) => goCardInfo(card, 'scan')}
        />
      ) : mode === 'batch' ? (
        <BatchScanPreview
          captures={captures}
          useAi={useAi}
          language={scanLang}
          onRetake={() => setMode('camera')}
          onConfirm={(cards) => {
            addCards(cards);
            setBatchFound(cards);
            setMode('batchResult');
          }}
        />
      ) : mode === 'batchResult' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: navStyle === 'floating' ? insets.bottom + 82 + 40 : 40 }}>
          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
            <PixelText variant={txt} size={12} color={tc.grnDk} weight="bold" style={{ letterSpacing: 1 }}>
              ✓ {batchFound.length}장 인식 완료
            </PixelText>
            <PixelText variant="ko" size={10} color={tc.ink3} style={{ marginTop: 4 }}>
              아래 카드들을 컬렉션에 추가했습니다.
            </PixelText>
          </View>
          <View style={{ marginHorizontal: 14, gap: 8, marginBottom: 14 }}>
            {batchFound.map((c) => (
              <PixelFrame key={c.id} borderWidth={3} shadow={5}>
                <View style={{ flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center' }}>
                  <View style={{ width: 48, height: 64, borderColor: tc.ink, borderWidth: 2 }}>
                    <CardThumb card={c} height={60} emojiSize={22} showLabel={false} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PixelText variant="ko" size={12} weight="bold">{displayCardName(c.name)}</PixelText>
                    <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 3 }}>
                      {c.set} · {c.num}
                    </PixelText>
                    <PixelText
                      variant={txt}
                      size={10}
                      color={c.price > 0 ? tc.grnDk : tc.ink3}
                      style={{ marginTop: 3 }}
                    >
                      {priceLabel(c.price, inferCardCurrency(c))}
                    </PixelText>
                  </View>
                  <RarBadge rar={c.rar} />
                </View>
              </PixelFrame>
            ))}
          </View>
          <View style={{ marginHorizontal: 14, flexDirection: 'row', gap: 8 }}>
            <PixelPress wrapStyle={{ flex: 1 }} onPress={() => { setBatchFound([]); setCaptures([]); setMode('choose'); }}>
              <View style={{ paddingVertical: 11, alignItems: 'center' }}>
                <PixelText variant={txt} size={10}>처음으로</PixelText>
              </View>
            </PixelPress>
            <PixelPress
              wrapStyle={{ flex: 1 }}
              onPress={() => router.push('/my/cards' as never)}
              bg={tc.gold}
              hi={tc.goldLt}
              lo={tc.goldDk}
            >
              <View style={{ paddingVertical: 11, alignItems: 'center' }}>
                <PixelText variant={txt} size={10}>컬렉션으로 ✓</PixelText>
              </View>
            </PixelPress>
          </View>
        </ScrollView>
      ) : (
      <>
      {/* 플로팅 탭바(마진 12 + 바 ≈58 + 제스처 인셋)가 스크롤 하단을 덮으므로 여백 확보.
          단, manual 검색 후엔 하단 고정 바가 이미 그 마진을 갖고 있어 중복 불필요. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 14,
          paddingBottom:
            navStyle === 'floating' && !(mode === 'manual' && manSearched) ? insets.bottom + 82 + 40 : 40,
        }}
      >
        {mode === 'choose' && (
          <>
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
              <PixelBall size={80} />
              <PixelText variant={txt} size={13} style={{ marginTop: 6, letterSpacing: 2 }}>
                카드 추가
              </PixelText>
              <PixelText variant={txt} size={10} color={tc.ink3} style={{ letterSpacing: 0.5 }}>
                방법을 선택하세요
              </PixelText>
            </View>

            <View style={{ marginHorizontal: 14, gap: 12 }}>
              <PixelPress
                onPress={() => setMode('camera')}
                bg={tc.ink2}
                borderWidth={4}
                shadow={7}
                hi="rgba(255,255,255,0.08)"
                lo="rgba(0,0,0,0.4)"
                inner={3}
              >
                <View
                  style={{
                    padding: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      backgroundColor: tc.grn,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderColor: tc.ink,
                      borderWidth: 3,
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>📷</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PixelText variant={txt} size={12} color={tc.white} style={{ marginBottom: 7, letterSpacing: 1 }}>
                      사진으로 스캔
                    </PixelText>
                    <PixelText variant={txt} size={9} color="rgba(255,255,255,0.5)" style={{ lineHeight: 16 }}>
                      카드를 촬영하면 자동으로{`\n`}카드 정보를 인식합니다
                    </PixelText>
                  </View>
                  <PixelText variant={txt} size={16} color={tc.gold}>
                    ▶
                  </PixelText>
                </View>
              </PixelPress>

              {/* Card-name language — pick one so the server runs only that
                  language's OCR worker. Cuts time + drops cross-language hallucination. */}
              <View
                style={{
                  flexDirection: 'row',
                  borderColor: tc.ink,
                  borderWidth: 2,
                  backgroundColor: tc.white,
                }}
              >
                {(
                  [
                    { v: 'ko', label: '한국어' },
                    { v: 'jp', label: '일본어' },
                    { v: 'en', label: 'English' },
                  ] as const
                ).map((opt, i) => (
                  <Pressable
                    key={opt.v}
                    onPress={() => setScanLang(opt.v)}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      alignItems: 'center',
                      backgroundColor: scanLang === opt.v ? tc.gold : 'transparent',
                      borderLeftWidth: i === 0 ? 0 : 2,
                      borderLeftColor: tc.ink,
                    }}
                  >
                    <PixelText variant={txt} size={11} color={scanLang === opt.v ? tc.ink : tc.ink3}>
                      {opt.label}
                    </PixelText>
                  </Pressable>
                ))}
              </View>
              <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: -4, marginBottom: -2, marginLeft: 2 }}>
                카드 이름이 어느 언어인지 골라주세요
              </PixelText>

              <PixelPress onPress={() => setMode('manual')} borderWidth={4} shadow={7}>
                <View
                  style={{
                    padding: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      backgroundColor: tc.gold,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderColor: tc.ink,
                      borderWidth: 3,
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>✏️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PixelText variant={txt} size={12} style={{ marginBottom: 7, letterSpacing: 1 }}>
                      직접 입력
                    </PixelText>
                    <PixelText variant={txt} size={9} color={tc.ink3} style={{ lineHeight: 16 }}>
                      카드 이름·세트·번호 등{`\n`}정보를 직접 입력해 등록합니다
                    </PixelText>
                  </View>
                  <PixelText variant={txt} size={16}>
                    ▶
                  </PixelText>
                </View>
              </PixelPress>
            </View>
          </>
        )}

        {mode === 'manual' && (
          <View style={{ paddingHorizontal: 16 }}>
            {/* ── 입력 폼 — 웹 ManualAddForm 프로토타입 레이아웃 (세트코드+번호 → 카드이름 → 검색) ── */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PixelText variant="ko" size={10} weight="bold" color={MP.ink2} style={{ marginBottom: 5, paddingLeft: 2 }}>세트코드</PixelText>
                <View style={{ backgroundColor: MP.fieldBg, borderWidth: 1.5, borderColor: MP.fieldBd, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <TextInput
                    value={manSet}
                    onChangeText={(t) => setManSet(t.toUpperCase())}
                    placeholder="예) SV4a"
                    placeholderTextColor={MP.ink3}
                    autoCapitalize="characters"
                    maxLength={16}
                    style={{ fontSize: 14, fontWeight: '700', color: MP.ink, padding: 0 }}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <PixelText variant="ko" size={10} weight="bold" color={MP.ink2} style={{ marginBottom: 5, paddingLeft: 2 }}>카드번호</PixelText>
                <View style={{ backgroundColor: MP.fieldBg, borderWidth: 1.5, borderColor: MP.fieldBd, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <TextInput
                    value={manNum}
                    onChangeText={setManNum}
                    placeholder="예) 201/165"
                    placeholderTextColor={MP.ink3}
                    maxLength={16}
                    style={{ fontSize: 14, fontWeight: '700', color: MP.ink, padding: 0 }}
                  />
                </View>
              </View>
            </View>
            <View style={{ marginTop: 9 }}>
              <PixelText variant="ko" size={10} weight="bold" color={MP.ink2} style={{ marginBottom: 5, paddingLeft: 2 }}>카드이름</PixelText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: MP.nameBg, borderWidth: 1.5, borderColor: MP.accent, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11 }}>
                <PixelText variant="ko" size={13} color={MP.ink}>🔍</PixelText>
                <TextInput
                  value={manName}
                  onChangeText={setManName}
                  placeholder="예) 리자몽 ex"
                  placeholderTextColor={MP.ink3}
                  maxLength={60}
                  style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: MP.ink, padding: 0 }}
                />
                {manName ? (
                  <Pressable onPress={() => setManName('')} hitSlop={6}>
                    <PixelText variant="ko" size={13} color={MP.ink3}>ⓧ</PixelText>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {manErr ? (
              <PixelText variant="ko" size={11} weight="bold" color={MP.red} style={{ marginTop: 8 }}>⚠ {manErr}</PixelText>
            ) : null}
            <Pressable
              disabled={manSearching}
              onPress={runManualSearch}
              style={{ marginTop: 11, height: 44, borderRadius: 12, backgroundColor: MP.btnBg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, opacity: manSearching ? 0.6 : 1 }}
            >
              <PixelText variant="ko" size={13} weight="bold" color={MP.btnFg}>{manSearching ? '검색 중...' : '🔍 카드 검색'}</PixelText>
            </Pressable>

            {!manSearched && !manSearching ? (
              <PixelText variant="ko" size={12} color={MP.ink3} style={{ textAlign: 'center', paddingVertical: 46, lineHeight: 20 }}>
                세트코드+카드번호 또는 카드이름으로 검색해 보세요.{'\n'}이름만 입력해도 검색돼요.
              </PixelText>
            ) : null}

            {/* ── 검색 결과 — 필터 칩(드롭다운 메뉴) → 결과 수+정렬 → 라디오 행 리스트 ── */}
            {manSearched ? (
              <>
                {manResults.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 14, paddingBottom: 8 }}>
                    <MChip P={MP} active={!manSetFilter && !manRarityFilter} onPress={() => { setManSetFilter(null); setManRarityFilter(null); setManMenu(null); }} label="전체" />
                    {manSetOptions.length > 0 ? (
                      <MChip P={MP} active={!!manSetFilter} onPress={() => setManMenu(manMenu === 'set' ? null : 'set')} label={`${manSetFilter ?? '세트'} ▾`} />
                    ) : null}
                    {manRarityOptions.length > 0 ? (
                      <MChip P={MP} active={!!manRarityFilter} onPress={() => setManMenu(manMenu === 'rarity' ? null : 'rarity')} label={`${manRarityFilter ?? '레어도'} ▾`} />
                    ) : null}
                  </View>
                ) : null}
                {manMenu === 'set' ? (
                  <MMenu P={MP}>
                    <MMenuItem P={MP} active={!manSetFilter} onPress={() => { setManSetFilter(null); setManMenu(null); }} label="전체 세트" />
                    {manSetOptions.map((sOpt) => (
                      <MMenuItem key={sOpt} P={MP} active={manSetFilter === sOpt} onPress={() => { setManSetFilter(sOpt); setManMenu(null); }} label={sOpt} />
                    ))}
                  </MMenu>
                ) : null}
                {manMenu === 'rarity' ? (
                  <MMenu P={MP}>
                    <MMenuItem P={MP} active={!manRarityFilter} onPress={() => { setManRarityFilter(null); setManMenu(null); }} label="전체 레어도" />
                    {manRarityOptions.map((rOpt) => (
                      <MMenuItem key={rOpt} P={MP} active={manRarityFilter === rOpt} onPress={() => { setManRarityFilter(rOpt); setManMenu(null); }} label={rOpt === 'PROMO' ? '프로모' : rOpt} />
                    ))}
                  </MMenu>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 2 }}>
                  <PixelText variant="ko" size={12} color={MP.ink3}>
                    검색 결과 <PixelText variant="ko" size={12} weight="bold" color={MP.ink}>{manDisplayed.length}</PixelText>개
                    {manDisplayed.length !== manResults.length ? ` (전체 ${manResults.length})` : ''}
                  </PixelText>
                  <Pressable onPress={() => setManMenu(manMenu === 'sort' ? null : 'sort')} hitSlop={6}>
                    <PixelText variant="ko" size={12} weight="bold" color={MP.ink}>{MAN_SORT_LABEL[manSort]} ▾</PixelText>
                  </Pressable>
                </View>
                {manMenu === 'sort' ? (
                  <MMenu P={MP}>
                    {(Object.keys(MAN_SORT_LABEL) as ManSortKey[]).map((k) => (
                      <MMenuItem key={k} P={MP} active={manSort === k} onPress={() => { setManSort(k); setManMenu(null); }} label={MAN_SORT_LABEL[k]} />
                    ))}
                  </MMenu>
                ) : null}

                {manDisplayed.map(({ c, idx }) => {
                  const sel = manSelectedIdx === idx;
                  const rar = manRarityOf(c);
                  const rarC = rar ? (MAN_RARITY_BADGE[rar] ?? { fg: '#8E8E93', bg: '#F2F2F4' }) : null;
                  const sub = [c.set && c.set !== '-' ? c.set : '', c.num && c.num !== '-' ? c.num : ''].filter(Boolean).join(' · ');
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setManSelectedIdx(sel ? null : idx)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 14, marginBottom: 8,
                        backgroundColor: sel ? MP.accentSoft : MP.pageBg,
                        borderWidth: 1.5, borderColor: sel ? MP.accent : MP.line,
                      }}
                    >
                      <View style={{ width: 52, height: 72, borderRadius: 8, overflow: 'hidden', backgroundColor: MP.fieldBg, elevation: 3, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 4, shadowOffset: { width: 0, height: 3 } }}>
                        <CardThumb card={c} height={72} emojiSize={24} showLabel={false} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <PixelText variant="ko" size={13} weight="bold" color={MP.ink} numberOfLines={1}>{displayCardName(c.name)}</PixelText>
                        {c.nameJa && c.nameJa !== c.name ? (
                          <PixelText variant="ko" size={10} color={MP.ink3} numberOfLines={1} style={{ marginTop: 2 }}>{c.nameJa}</PixelText>
                        ) : null}
                        {sub ? (
                          <PixelText variant="ko" size={11} color={MP.ink3} numberOfLines={1} style={{ marginTop: 3 }}>{sub}</PixelText>
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                          {rar && rarC ? (
                            <View style={{ backgroundColor: rarC.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                              <PixelText variant="ko" size={9} weight="bold" color={rarC.fg}>{rar === 'PROMO' ? '프로모' : rar}</PixelText>
                            </View>
                          ) : null}
                          <View style={{ borderWidth: 1, borderColor: MP.fieldBd, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                            <PixelText variant="ko" size={9} weight="bold" color={MP.ink2}>일본판</PixelText>
                          </View>
                          {c.price > 0 ? (
                            <PixelText variant="ko" size={10} weight="bold" color={MP.ink} style={{ marginLeft: 2 }}>
                              {priceLabel(c.price, inferCardCurrency(c))}
                            </PixelText>
                          ) : null}
                        </View>
                      </View>
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: sel ? MP.accent : MP.radioBd, alignItems: 'center', justifyContent: 'center', backgroundColor: MP.pageBg }}>
                        {sel ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: MP.accent }} /> : null}
                      </View>
                    </Pressable>
                  );
                })}

                {manHasMore ? (
                  <Pressable
                    disabled={manLoadingMore}
                    onPress={loadMoreManual}
                    style={{ paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: MP.fieldBd, backgroundColor: MP.pageBg, alignItems: 'center', marginBottom: 4 }}
                  >
                    <PixelText variant="ko" size={12} weight="bold" color={MP.ink}>{manLoadingMore ? '불러오는 중...' : '↓ 결과 더보기'}</PixelText>
                  </Pressable>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingTop: 12, paddingBottom: 8 }}>
                  <PixelText variant="ko" size={12} weight="bold" color={MP.ink3}>찾는 카드가 없나요?</PixelText>
                  <Pressable onPress={() => openRegister(buildManualCard(), 'manual')} hitSlop={6}>
                    <PixelText variant="ko" size={12} weight="bold" color={MP.accent}>직접 입력하기</PixelText>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* ── 카드 등록 — 공용 폼(CardRegisterForm). 시세상세 팝업과 동일 내용 ── */}
        {mode === 'register' && pendingCard && (
          <View style={{ paddingHorizontal: 16 }}>
            <CardRegisterForm key={pendingCard.id} card={pendingCard} onSaved={onRegisterSaved} />
          </View>
        )}

        {mode === 'result' && found && (
          <>
            <View style={{ marginHorizontal: 14, marginBottom: 14 }}>
            <PixelFrame borderWidth={4} shadow={6}>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                padding: 14,
                alignItems: 'flex-start',
              }}
            >
              <View style={{ width: 68, height: 96, borderColor: tc.ink, borderWidth: 2 }}>
                <CardThumb card={found} height={92} emojiSize={32} showLabel={false} />
              </View>
              <View style={{ flex: 1 }}>
                <PixelText variant={txt} size={10} color={tc.grn} style={{ marginBottom: 6 }}>
                  ✓ 인식 완료!
                </PixelText>
                <PixelText variant={txt} size={12} style={{ marginBottom: 5, lineHeight: 18 }}>
                  {displayCardName(found.name)}
                </PixelText>
                <PixelText variant={txt} size={9} color={tc.ink3} style={{ lineHeight: 16 }}>
                  {found.set} · {found.num}
                  {`\n`}
                  {found.game}
                </PixelText>
                <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <RarBadge rar={found.rar} />
                  <PixelText
                    variant={txt}
                    size={10}
                    color={found.price > 0 ? tc.grnDk : tc.ink3}
                  >
                    {priceLabel(found.price, inferCardCurrency(found))}
                  </PixelText>
                </View>
              </View>
            </View>
            </PixelFrame>
            </View>
            {(() => {
              const p = cardProfit(found, priceMode);
              return (
                <View style={{ marginHorizontal: 14, marginBottom: 14 }}>
                  <PixelFrame borderWidth={3} shadow={4} bg={tc.pap3}>
                    <View style={{ padding: 12, gap: 6 }}>
                      <PixelText variant={txt} size={10} color={tc.ink3} style={{ marginBottom: 2, letterSpacing: 1 }}>
                        📈 수익률
                      </PixelText>
                      {p.hasBuy ? (
                        <>
                          <ProfitRow
                            label={`구매가${p.qty > 1 ? ` ×${p.qty}` : ''}`}
                            value={priceLabel(p.investedKrw, 'KRW')}
                          />
                          <ProfitRow label="현재 시세" value={priceLabel(p.currentKrw, 'KRW')} />
                          <View style={{ height: 1, backgroundColor: tc.ink4, marginVertical: 2 }} />
                          <ProfitRow
                            label="손익"
                            value={`${p.profitKrw >= 0 ? '+' : '-'}₩${fmt(Math.abs(p.profitKrw))} (${
                              p.ratePct != null ? `${p.ratePct >= 0 ? '+' : ''}${p.ratePct.toFixed(1)}%` : '—'
                            })`}
                            color={p.profitKrw >= 0 ? tc.grnDk : tc.red}
                            bold
                          />
                        </>
                      ) : (
                        <PixelText variant={txt} size={10} color={tc.ink3} style={{ lineHeight: 16 }}>
                          현재 시세 {priceLabel(p.currentKrw, 'KRW')}
                          {`\n`}구매가를 입력하면 수익률이 표시됩니다
                        </PixelText>
                      )}
                    </View>
                  </PixelFrame>
                </View>
              );
            })()}
            <View style={{ marginHorizontal: 14, flexDirection: 'row', gap: 8 }}>
              <PixelPress wrapStyle={{ flex: 1 }} onPress={() => setMode('choose')}>
                <View style={{ paddingVertical: 11, alignItems: 'center' }}>
                  <PixelText variant={txt} size={10}>
                    처음으로
                  </PixelText>
                </View>
              </PixelPress>
              <PixelPress
                wrapStyle={{ flex: 1 }}
                onPress={() => router.push('/my/cards' as never)}
                bg={tc.gold}
                hi={tc.goldLt}
                lo={tc.goldDk}
              >
                <View style={{ paddingVertical: 11, alignItems: 'center' }}>
                  <PixelText variant={txt} size={10}>
                    컬렉션 추가 ✓
                  </PixelText>
                </View>
              </PixelPress>
            </View>
          </>
        )}
      </ScrollView>
      {/* 하단 고정 추가 바 — 웹 ManualAddForm sticky bar 와 동일 */}
      {mode === 'manual' && manSearched && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: MP.line,
            backgroundColor: MP.pageBg,
            borderBottomWidth: navStyle === 'floating' ? 1 : 0,
            borderBottomColor: MP.line,
            // 플로팅 탭바(마진 12 + 바 ≈58 + 제스처 인셋)가 하단을 덮으므로 그 위로 띄운다.
            marginBottom: navStyle === 'floating' ? insets.bottom + 82 : 0,
          }}
        >
          <View style={{ maxWidth: 120 }}>
            <PixelText variant="ko" size={10} color={MP.ink3}>선택한 카드</PixelText>
            <PixelText variant="ko" size={13} weight="bold" color={MP.ink} numberOfLines={1} style={{ marginTop: 1 }}>
              {manSelected ? displayCardName(manSelected.name) : '선택 안 됨'}
            </PixelText>
          </View>
          <Pressable
            disabled={!manSelected}
            onPress={() => manSelected && openRegister(manSelected, 'manual')}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 14,
              backgroundColor: manSelected ? MP.btnBg : MP.disBg,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: manSelected ? 4 : 0,
              shadowColor: '#000',
              shadowOpacity: manSelected ? 0.18 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <PixelText variant="ko" size={13} weight="bold" color={manSelected ? MP.btnFg : MP.disFg}>
              {manSelected ? '내 컬렉션에 추가' : '카드를 선택하세요'}
            </PixelText>
          </Pressable>
        </View>
      )}
      </>
      )}
    </View>
  );
}

/* ── 직접입력 전용 — 웹 ManualAddForm 의 Chip/Menu/MenuItem 미러 ── */
function MChip({ P, active, onPress, label }: { P: ManualPalette; active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        backgroundColor: active ? P.btnBg : P.pageBg,
        borderWidth: 1.5, borderColor: active ? P.btnBg : P.fieldBd,
      }}
    >
      <PixelText variant="ko" size={11} weight="bold" color={active ? P.btnFg : P.ink}>{label}</PixelText>
    </Pressable>
  );
}

function MMenu({ P, children }: { P: ManualPalette; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: P.pageBg, borderRadius: 14, borderWidth: 1, borderColor: P.line,
        marginBottom: 8, paddingVertical: 4, overflow: 'hidden',
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      }}
    >
      {children}
    </View>
  );
}

function MMenuItem({ P, active, onPress, label }: { P: ManualPalette; active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 11, backgroundColor: active ? P.accentSoft : 'transparent' }}>
      <PixelText variant="ko" size={12} weight={active ? 'bold' : 'normal'} color={active ? P.accent : P.ink}>{label}</PixelText>
    </Pressable>
  );
}

function ToggleRow({
  on,
  onPress,
  label,
  hint,
}: {
  on: boolean;
  onPress: () => void;
  label: string;
  hint?: string;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: on ? tc.gold : tc.white,
        borderColor: tc.ink,
        borderWidth: 3,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? tc.ink : tc.pap3,
          borderColor: tc.ink,
          borderWidth: 2,
        }}
      >
        {on && <PixelText variant={txt} size={12} color={tc.gold}>✓</PixelText>}
      </View>
      <View style={{ flex: 1 }}>
        <PixelText variant={txt} size={11} color={tc.ink}>
          {label}
        </PixelText>
        {hint && (
          <PixelText variant={txt} size={8} color={on ? tc.ink2 : tc.ink3} style={{ marginTop: 3 }}>
            {hint}
          </PixelText>
        )}
      </View>
    </Pressable>
  );
}

function ProfitRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <PixelText variant={txt} size={10} color={tc.ink3}>
        {label}
      </PixelText>
      <PixelText variant={txt} size={bold ? 12 : 10} color={color ?? tc.ink} weight={bold ? 'bold' : undefined}>
        {value}
      </PixelText>
    </View>
  );
}

const inputStyle = {
  backgroundColor: colors.white,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 17,
  fontFamily: 'Galmuri11',
  color: colors.ink,
  borderColor: colors.ink,
  borderWidth: 3,
} as const;

