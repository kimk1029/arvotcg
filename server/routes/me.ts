import { DailyCache, DAY_MS } from '../lib/dailyCache';
import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { defaultNameFor } from '../lib/defaultName.js';
import {
  pickAvatar,
  pickBackground,
  pickFrame,
  buyAvatar,
  buyBackground,
  buyFrame,
} from '../lib/inventoryOps.js';
import { findCardEntry } from '@/lib/cardsCatalog';
import { levelFromPoints } from '@/lib/level';
import { isAdminEmail } from '../lib/admin.js';
import {
  countMyCards,
  deriveRegisterPriceJpy,
  getMyBookmarks,
  getMyCardPrices,
  getMyCardsWithPrices,
  getMyFavoritesWithPrices,
  getMyFeeds,
  getMyInventory,
  getMyTrades,
} from '../lib/queries.js';
import { fetchSnkrdunkApparel, fetchSnkrdunkSalesHistory, fetchSnkrdunkSalesChart } from '@/lib/snkrdunk';
import { computeApparelPrices, evaluationUnitJpy, headlineFromHistory, registerBasisJpy } from '../../shared/snkrdunkPrice';
import {
  ensureCatalogCard,
  isFreshEntry,
  loadCatalogEntries,
  recordPriceSnapshot,
  refreshApparelPrices,
  upsertCatalogCard,
} from '../lib/snkrdunkCatalog.js';
import { getJpyKrwRate } from '../lib/fxRate.js';
import { runDailyCheckIn } from '../lib/checkIn.js';
import { logPointChange } from '../lib/pointLog.js';
import { kstDateKey, kstDateKeyShifted } from '../../shared/kst';
import { flexToken } from './flex.js';
import { translateKnownCardNameToKo } from '../../shared/cardTranslate';
import { UGC_TERMS_VERSION } from '../../shared/ugcTerms';

const router = Router();
router.use(requireAuth);

router.get('/summary', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    const [inv, profile, tradeCount, savedCount, cardCount] = await Promise.all([
      getMyInventory(userId),
      prisma.user
        .findUnique({ where: { id: userId }, select: { name: true, email: true, isAdmin: true } })
        .catch(() => null),
      prisma.trade.count({ where: { authorId: userId } }).catch(() => 0),
      prisma.bookmark.count({ where: { userId } }).catch(() => 0),
      countMyCards(userId),
    ]);
    const email = profile?.email ?? req.user!.email ?? null;
    res.json({
      user: {
        id: userId,
        name: profile?.name ?? req.user!.name ?? null,
        email,
        isAdmin: (profile?.isAdmin ?? false) || isAdminEmail(email),
      },
      inventory: inv,
      level: levelFromPoints(inv.points),
      counts: { tradeCount, savedCount, cardCount },
    });
  } catch (err) {
    console.error('[me.summary]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/cards', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.userCard.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ data: rows });
  } catch (err) {
    console.error('[me.cards.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/cards', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const cardIdRaw = typeof body.cardId === 'string' ? body.cardId.trim() : '';
  const cardId = cardIdRaw && findCardEntry(cardIdRaw) ? cardIdRaw : null;
  const ocrSetCode = typeof body.ocrSetCode === 'string' ? body.ocrSetCode.trim().slice(0, 16) : null;
  const ocrCardNumber =
    typeof body.ocrCardNumber === 'string' ? body.ocrCardNumber.trim().slice(0, 16) : null;
  const snkrdunkApparelId =
    typeof body.snkrdunkApparelId === 'number' && Number.isInteger(body.snkrdunkApparelId)
      ? body.snkrdunkApparelId
      : null;

  if (!cardId && !ocrSetCode && !ocrCardNumber && !snkrdunkApparelId) {
    return res
      .status(400)
      .json({ error: 'cardId, OCR 식별자, snkrdunkApparelId 중 하나는 필요해요' });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 60) : null;
  const memo = typeof body.memo === 'string' ? body.memo.trim().slice(0, 500) : null;
  const gradeEstimate =
    typeof body.gradeEstimate === 'string' ? body.gradeEstimate.trim().slice(0, 60) : null;
  const centeringScore =
    typeof body.centeringScore === 'number' && Number.isFinite(body.centeringScore)
      ? Math.max(0, Math.min(100, body.centeringScore))
      : null;
  const photoUrl =
    typeof body.photoUrl === 'string' && /^https?:\/\//.test(body.photoUrl)
      ? body.photoUrl.slice(0, 500)
      : null;

  // 구매 정보 (구매가/통화/수량/구매시기)
  const buyPriceNum = Number(body.buyPrice);
  const buyPrice = Number.isFinite(buyPriceNum) && buyPriceNum > 0 ? Math.round(buyPriceNum) : null;
  const buyCurrency = body.buyCurrency === 'JPY' ? 'JPY' : 'KRW';
  const qtyNum = Number(body.qty);
  const qty = Number.isFinite(qtyNum) ? Math.max(1, Math.min(999, Math.round(qtyNum))) : 1;
  const buyDate = typeof body.buyDate === 'string' ? body.buyDate.trim().slice(0, 10) || null : null;
  // 발매 지역(에디션) — 'jp' | 'kr' | 'en' 만 허용.
  const region =
    body.region === 'jp' || body.region === 'kr' || body.region === 'en' ? body.region : null;

  // 직접뽑기 / 등급(그레이딩) 정보
  const selfPulled = body.selfPulled === true;
  const graded = body.graded === true;
  const gradeCompany =
    graded && typeof body.gradeCompany === 'string' ? body.gradeCompany.trim().slice(0, 16) || null : null;
  const gradeValue =
    graded && typeof body.gradeValue === 'string' ? body.gradeValue.trim().slice(0, 8) || null : null;

  // 등록가(JPY) — 등록 단계에서 확정 저장. 컬렉션의 "등록가격" + 등락률 기준값.
  //  · 구매가 입력: 사용자가 적은 buyPrice(통화 buyCurrency)를 JPY 환산.
  //    (직접뽑기(selfPulled)도 클라이언트가 buyPrice 에 현재시세를 담아 보냄.)
  //  · 구매가 미입력: 등록 당시 시세를 등급 기준으로 스냅 —
  //    PSA10/9/8 → 해당 등급 최근 체결가, 타사(BGS/CGC 등) → PSA10 기준,
  //    싱글(비등급) → raw 싱글가. (registerBasisJpy 규칙)
  // 그래도 산정 불가면 null → 최초 조회 시 보조 백필(getMyCardsWithPrices).
  let registerPriceJpy: number | null = null;
  if (buyPrice != null && buyPrice > 0) {
    const rate = buyCurrency === 'JPY' ? 1 : (await getJpyKrwRate().catch(() => null))?.rate ?? 0;
    registerPriceJpy = deriveRegisterPriceJpy(buyPrice, buyCurrency, 0, rate);
  } else if (snkrdunkApparelId) {
    try {
      const [a, hist, chart] = await Promise.all([
        fetchSnkrdunkApparel(snkrdunkApparelId),
        fetchSnkrdunkSalesHistory(snkrdunkApparelId).catch(() => null),
        fetchSnkrdunkSalesChart(snkrdunkApparelId).catch(() => null),
      ]);
      const prices = computeApparelPrices(hist?.history ?? [], chart?.points ?? [], a?.minPrice ?? 0);
      const basis = registerBasisJpy(prices, { graded, gradeCompany, gradeValue });
      registerPriceJpy = basis.price > 0 ? Math.round(basis.price) : null;
      // 이왕 받아온 시세는 스냅샷/카탈로그에 재적재 (응답 경로 밖, 실패 무시).
      if (a) {
        void upsertCatalogCard(a);
        const headline = headlineFromHistory(hist?.history ?? [], a.minPrice ?? 0);
        void recordPriceSnapshot(snkrdunkApparelId, {
          minPrice: a.minPrice ?? 0,
          listingCount: a.listingCount,
          headlinePrice: headline.price,
          headlineBasis: headline.basis,
          priceSingle: prices.single,
          pricePsa10: prices.psa10,
          pricePsa9: prices.psa9,
          pricePsa8: prices.psa8,
          trend: prices.trendJpy,
        });
      }
    } catch (err) {
      console.warn('[me.cards.POST] 등록가 시세 조회 실패', snkrdunkApparelId, err);
    }
  }

  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: defaultNameFor(userId) },
    });
    const created = await prisma.userCard.create({
      data: {
        userId,
        cardId,
        ocrSetCode,
        ocrCardNumber,
        snkrdunkApparelId,
        nickname,
        memo,
        gradeEstimate,
        centeringScore,
        photoUrl,
        buyPrice,
        buyCurrency,
        qty,
        buyDate,
        region,
        registerPriceJpy,
        selfPulled,
        graded,
        gradeCompany,
        gradeValue,
      },
    });
    res.status(201).json({ data: created });
    // 컬렉션에 추가된 카드의 정적 정보를 마스터 카탈로그에 적재 (응답 후, 실패 무시).
    if (snkrdunkApparelId) void ensureCatalogCard(snkrdunkApparelId);
  } catch (err) {
    // 디버깅용 — Prisma 에러 코드/메시지를 응답에도 실어준다.
    // (운영 중 발견된 500 원인 추적용. 향후 안정화되면 message 노출 빼도 됨.)
    const e = err as { code?: string; message?: string; name?: string };
    console.error('[me.cards.POST]', userId, 'err=', e?.name, e?.code, e?.message);
    res.status(500).json({
      error: 'internal',
      code: e?.code ?? null,
      name: e?.name ?? null,
      message: e?.message ?? null,
    });
  }
});

/** 수익 인증 공유 링크 — 내 컬렉션에 있는 카드만, 소유자에게만 토큰을 발급한다. */
router.post('/flex-link', async (req: Request, res: Response) => {
  const apparelId = Number((req.body as { snkrdunkApparelId?: unknown } | undefined)?.snkrdunkApparelId);
  if (!Number.isInteger(apparelId)) return res.status(400).json({ error: 'snkrdunkApparelId required' });
  try {
    const card = await prisma.userCard.findFirst({
      where: { userId: req.user!.userId, snkrdunkApparelId: apparelId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!card) return res.status(404).json({ error: '내 컬렉션에 없는 카드예요' });
    res.json({ data: { token: flexToken(card.id) } });
  } catch (err) {
    console.error('[me.flex-link]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ── 버그 제보 ────────────────────────────────────────────────────────
 * 사용자는 작성만 한다. 목록 열람은 어드민 대시보드(DB 직접 조회) 전용 —
 * 다른 사람의 제보가 앱/웹에 노출되지 않는다.
 */
router.post('/bug-reports', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 4000) : '';
  if (title.length < 2) return res.status(400).json({ error: '제목을 2자 이상 입력해 주세요' });
  if (content.length < 5) return res.status(400).json({ error: '내용을 5자 이상 입력해 주세요' });
  const platform =
    body.platform === 'web' || body.platform === 'ios' || body.platform === 'android'
      ? body.platform
      : null;
  const appVersion = typeof body.appVersion === 'string' ? body.appVersion.trim().slice(0, 20) || null : null;
  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 120) || null : null;
  try {
    const row = await prisma.bugReport.create({
      data: { userId, title, content, platform, appVersion, contact },
      select: { id: true, createdAt: true },
    });
    res.status(201).json({ data: { id: row.id, createdAt: row.createdAt.toISOString() } });
  } catch (err) {
    console.error('[me.bug-reports.POST]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** 내가 낸 제보 목록 — 본인 것만. (남의 제보는 어드민만 본다.) */
router.get('/bug-reports', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.bugReport.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, title: true, status: true, createdAt: true },
    });
    res.json({ data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    console.error('[me.bug-reports.GET]', err);
    res.status(500).json({ data: [], error: 'internal' });
  }
});

router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.favoriteCard.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ data: rows });
  } catch (err) {
    console.error('[me.favorites.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// 관심카드 + 스니덩 시세/이미지 enrich. 관심카드 페이지 전용.
router.get('/favorites/with-prices', async (req: Request, res: Response) => {
  try {
    const data = await getMyFavoritesWithPrices(req.user!.userId, 200);
    res.json({ data });
  } catch (err) {
    console.error('[me.favorites.with-prices]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/favorites', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const apparelId = Number((req.body as { snkrdunkApparelId?: unknown } | null)?.snkrdunkApparelId);
  if (!Number.isInteger(apparelId) || apparelId <= 0) {
    return res.status(400).json({ error: 'snkrdunkApparelId 필요' });
  }
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: defaultNameFor(userId) },
    });
    const row = await prisma.favoriteCard.upsert({
      where: { userId_snkrdunkApparelId: { userId, snkrdunkApparelId: apparelId } },
      update: {},
      create: { userId, snkrdunkApparelId: apparelId },
    });
    res.status(201).json({ data: row });
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string };
    console.error('[me.favorites.POST]', userId, 'err=', e?.name, e?.code, e?.message);
    res.status(500).json({
      error: 'internal',
      code: e?.code ?? null,
      name: e?.name ?? null,
      message: e?.message ?? null,
    });
  }
});

router.delete('/favorites/:apparelId', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const apparelId = Number(req.params.apparelId);
  if (!Number.isInteger(apparelId)) return res.status(400).json({ error: 'invalid apparelId' });
  try {
    await prisma.favoriteCard.deleteMany({
      where: { userId, snkrdunkApparelId: apparelId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[me.favorites.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── 가격 알림 (price alerts) ────────────────────────────────────────────────
// 카드 시세가 목표가(JPY) 이하로 내려오면 알림. 서버 주기 체커가 트리거 후 Message 발송.

router.get('/price-alerts', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.priceAlert.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ data: rows });
  } catch (err) {
    console.error('[me.price-alerts.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/price-alerts', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as {
    snkrdunkApparelId?: unknown;
    targetPriceJpy?: unknown;
    cardName?: unknown;
  };
  const apparelId = Number(body.snkrdunkApparelId);
  const target = Number(body.targetPriceJpy);
  if (!Number.isInteger(apparelId) || apparelId <= 0) {
    return res.status(400).json({ error: 'snkrdunkApparelId 필요' });
  }
  if (!Number.isFinite(target) || target <= 0) {
    return res.status(400).json({ error: 'targetPriceJpy 필요(양수)' });
  }
  const cardName =
    typeof body.cardName === 'string' && body.cardName.trim()
      ? body.cardName.trim().slice(0, 120)
      : null;
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: defaultNameFor(userId) },
    });
    // 목표가를 바꾸면 다시 활성화(triggeredAt 초기화)되도록 upsert.
    const row = await prisma.priceAlert.upsert({
      where: { userId_snkrdunkApparelId: { userId, snkrdunkApparelId: apparelId } },
      update: { targetPriceJpy: Math.round(target), cardName, triggeredAt: null },
      create: { userId, snkrdunkApparelId: apparelId, targetPriceJpy: Math.round(target), cardName },
    });
    res.status(201).json({ data: row });
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string };
    console.error('[me.price-alerts.POST]', userId, 'err=', e?.name, e?.code, e?.message);
    res.status(500).json({
      error: 'internal',
      code: e?.code ?? null,
      name: e?.name ?? null,
      message: e?.message ?? null,
    });
  }
});

router.delete('/price-alerts/:apparelId', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const apparelId = Number(req.params.apparelId);
  if (!Number.isInteger(apparelId)) return res.status(400).json({ error: 'invalid apparelId' });
  try {
    await prisma.priceAlert.deleteMany({ where: { userId, snkrdunkApparelId: apparelId } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[me.price-alerts.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/**
 * 포트폴리오 합계 — userCard 중 snkrdunkApparelId 가 있는 항목을 실시간 시세로
 * 합산해 JPY 총합을 반환. 관심카드(FavoriteCard) 는 의도적으로 제외 — 사용자가
 * "관심"으로 표시한 카드까지 자산으로 포함하면 부풀려진 자산이 됨.
 *
 * 추가로:
 *   - 오늘자 KST 일자 키로 PortfolioDailySnapshot upsert (정각이 되면 새 키)
 *   - 어제 일자 스냅샷이 있으면 등락 (절대값 + %) 반환
 *   - 최근 30 일 히스토리 반환 (차트용)
 */
const portfolioHistory = new DailyCache<Array<{ date: string; totalJpy: number }>>(DAY_MS, 2000);

router.get('/portfolio', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    // 스니덩크 상품이 연결되지 않은 카드(OCR·수동 등록)도 포함 — 등록가로라도 합산한다.
    const cards = await prisma.userCard.findMany({
      where: { userId },
      select: {
        id: true,
        snkrdunkApparelId: true,
        createdAt: true,
        qty: true,
        nickname: true,
        registerPriceJpy: true,
        buyPrice: true,
        buyCurrency: true,
        graded: true,
        gradeCompany: true,
        gradeValue: true,
      },
    });
    const totalCount = await countMyCards(userId);
    const today = kstDateKey();

    let totalJpy = 0;
    let totalPsa10Jpy = 0;
    let pricedCount = 0;
    let pricedPsa10Count = 0;
    // 어제 대비 등락 계산용 — '오늘 추가한 카드'는 어제 스냅샷에 없으므로 제외.
    // (오늘 추가분을 포함하면 자산 유입이 가격 상승처럼 잡혀 등락이 부풀려짐)
    let comparableTodayJpy = 0;
    // 누적 수익률(등록가 대비) — 컬렉션 화면과 같은 산식의 합계.
    let investedJpy = 0;
    let currentJpy = 0;
    // 카드 추가 이벤트 — 차트에서 "이 날 무엇이 들어와 금액이 뛰었는지" 표시용(등록일 KST 기준).
    const addedByDate = new Map<string, string[]>();
    // 카드 리스트와 동일한 sales-chart 기준 등락. 오늘 추가분 제외, 어제부터 보유분만.
    let heldPrevChart = 0; // 어제(직전 거래 포인트) 시세 합
    let heldLastChart = 0; // 오늘(최신 포인트) 시세 합
    if (cards.length > 0) {
      // 같은 apparelId 가 여러 번 들어 있을 수 있으니 fetch 는 한 번만.
      const uniqueApparelIds: number[] = Array.from(
        new Set<number>(
          cards
            .map((c) => c.snkrdunkApparelId)
            .filter((v): v is number => typeof v === 'number'),
        ),
      );
      // 시세 계산 정본은 shared computeApparelPrices (refreshApparelPrices 내부) —
      // 예전 인라인 계산(raw 중앙값·rawCeil 차트 필터·등급 오염 방지)과 같은 규칙이다.
      // 카탈로그 스냅샷 우선 + stale-while-revalidate: 계산된 스냅샷이 있으면(오래됐어도)
      // 즉시 그 값으로 합산하고 갱신은 백그라운드로. 라이브 조회를 기다리는 카드는
      // 풀 스냅샷이 없는 경우뿐이라, 포트폴리오 응답이 스크레이프 N건에 안 묶인다.
      const priceByApparel = new Map<
        number,
        { single: number; psa10: number; psa9: number; psa8: number; chartPrev: number; chartLast: number }
      >();
      const fromTrend = (p: { single: number; psa10: number; psa9: number; psa8: number; trend: number[] }) => ({
        single: p.single,
        psa10: p.psa10,
        psa9: p.psa9,
        psa8: p.psa8,
        chartLast: p.trend.length >= 1 ? p.trend[p.trend.length - 1] : 0,
        chartPrev: p.trend.length >= 2 ? p.trend[p.trend.length - 2] : 0,
      });
      const catalog = await loadCatalogEntries(uniqueApparelIds);
      const blockingIds: number[] = [];
      for (const id of uniqueApparelIds) {
        const s = catalog.get(id)?.snapshot;
        // priceSingle/pricePsa10 이 계산된 풀 스냅샷만 사용 — 목록 수집 스냅샷(minPrice만)
        // 으로 합산하면 자산이 0 으로 빠지므로 그런 카드는 라이브 조회로 넘긴다.
        if (s && (s.priceSingle > 0 || s.pricePsa10 > 0)) {
          priceByApparel.set(
            id,
            fromTrend({ single: s.priceSingle, psa10: s.pricePsa10, psa9: s.pricePsa9, psa8: s.pricePsa8, trend: s.trend }),
          );
          if (!isFreshEntry(catalog.get(id))) void refreshApparelPrices(id);
        } else {
          blockingIds.push(id);
        }
      }
      for (const id of blockingIds) {
        void refreshApparelPrices(id);
        const min = catalog.get(id)?.snapshot?.minPrice ?? 0;
        if (min > 0) priceByApparel.set(id, fromTrend({ single: min, psa10: 0, psa9: 0, psa8: 0, trend: [] }));
      }
      // 누적 수익률용 환율 — 구매가가 원화인 카드만 JPY 환산에 쓴다(실패 시 등록가로 폴백).
      const jpyKrw = (await getJpyKrwRate().catch(() => null))?.rate ?? 0;
      for (const c of cards) {
        const p = c.snkrdunkApparelId != null ? priceByApparel.get(c.snkrdunkApparelId) : null;
        const addedDate = kstDateKey(c.createdAt);
        const addedToday = addedDate === today;
        const rawName = c.snkrdunkApparelId != null ? catalog.get(c.snkrdunkApparelId)?.name ?? null : null;
        const names = addedByDate.get(addedDate) ?? [];
        names.push(rawName ? translateKnownCardNameToKo(rawName) : c.nickname || '카드');
        addedByDate.set(addedDate, names);
        const qty = Math.max(1, c.qty || 1);
        // 누적 수익률 — 등록(매입) 시점 기준가 대비 오늘 등급 일치 시세. 웹/앱 컬렉션 화면과 같은 규칙.
        const basisJpy =
          deriveRegisterPriceJpy(c.buyPrice, c.buyCurrency, 0, jpyKrw) ??
          (c.registerPriceJpy != null && c.registerPriceJpy > 0 ? c.registerPriceJpy : null);
        // 등급 일치 현재가(컬렉션 목록의 currentPriceJpy 와 같은 값).
        const gradeJpy = p
          ? registerBasisJpy(
              { single: p.single, psa10: p.psa10, psa9: p.psa9, psa8: p.psa8, trendJpy: [] },
              { graded: c.graded, gradeCompany: c.gradeCompany, gradeValue: c.gradeValue },
            ).price
          : 0;
        if (basisJpy && basisJpy > 0 && gradeJpy > 0) {
          investedJpy += basisJpy * qty;
          currentJpy += gradeJpy * qty;
        }
        // 총 자산 단가 — 정본 evaluationUnitJpy(등급가 → 싱글 → PSA10 → 등록가).
        // 시세를 아직 못 받은 카드(스냅샷 없음·라이브 실패·상품 미연결)도 등록가로 반드시 합산한다.
        const unitJpy = evaluationUnitJpy({
          gradeJpy,
          singleJpy: p?.single,
          psa10Jpy: p?.psa10,
          basisJpy,
        });
        if (unitJpy > 0) {
          totalJpy += unitJpy * qty;
          // '시세 반영'은 실제 시세를 받은 카드만 — 등록가 폴백은 합계에만 들어간다.
          if (gradeJpy > 0 || (p && (p.single > 0 || p.psa10 > 0))) pricedCount += 1;
          if (!addedToday) comparableTodayJpy += unitJpy * qty;
        }
        if (p && p.psa10 > 0) {
          totalPsa10Jpy += p.psa10 * qty;
          pricedPsa10Count += 1;
        } else if (unitJpy > 0) {
          // PSA10 시세가 없으면 총액이 비어 보이지 않게 대표 단가로 채운다.
          totalPsa10Jpy += unitJpy * qty;
        }
        // 등락(차트 기준): 어제부터 보유 + 직전/최신 포인트 둘 다 있는 카드만.
        if (p && !addedToday && p.chartPrev > 0 && p.chartLast > 0) {
          heldPrevChart += p.chartPrev * qty;
          heldLastChart += p.chartLast * qty;
        }
      }
    }

    // 오늘자 스냅샷 upsert — KST 정각 넘어가면 새 행. 같은 날 호출은 update.
    let yesterdayJpy: number | null = null;
    let history: Array<{ date: string; totalJpy: number }> = [];
    try {
      const rows = await portfolioHistory.get(`${userId}:${today}`, async () => {
        await prisma.portfolioDailySnapshot.upsert({
          where: { userId_date: { userId, date: today } }, update: {},
          create: { userId, date: today, totalJpy, pricedCount, totalCount },
        });
        return prisma.portfolioDailySnapshot.findMany({ where: { userId }, orderBy: { date: 'desc' },
          take: 365, select: { date: true, totalJpy: true } });
      });
      yesterdayJpy = rows.find(r => r.date < today)?.totalJpy ?? null;
      history = [...rows].reverse().map(r => ({ date: r.date, totalJpy: r.date === today ? totalJpy : r.totalJpy }));
    } catch (err) {
      console.warn('[me.portfolio] snapshot upsert/read failed', err);
    }

    // 등락 — 오늘 추가분 제외. 우선순위:
    //  1) sales-chart 기준(카드 리스트와 동일): 어제부터 보유분의 직전→최신 포인트 합 비교
    //  2) 차트가 없으면 일일 스냅샷 폴백(comparableTodayJpy vs 어제 스냅샷)
    let changeAbsJpy: number | null = null;
    let changePct: number | null = null;
    if (heldPrevChart > 0) {
      changeAbsJpy = heldLastChart - heldPrevChart;
      changePct = ((heldLastChart - heldPrevChart) / heldPrevChart) * 100;
    } else if (yesterdayJpy != null && yesterdayJpy > 0) {
      changeAbsJpy = comparableTodayJpy - yesterdayJpy;
      changePct = ((comparableTodayJpy - yesterdayJpy) / yesterdayJpy) * 100;
    }

    // 누적 수익률 — 전일 대비(changePct)와 별개. 마이페이지·포트폴리오 헤더가 쓴다.
    const profitAbsJpy = investedJpy > 0 ? currentJpy - investedJpy : null;
    const profitPct = investedJpy > 0 ? ((currentJpy - investedJpy) / investedJpy) * 100 : null;

    // 차트 마커 — 히스토리 구간 안의 등록일만, 날짜순. 이름은 최대 3개까지.
    const historyDates = new Set(history.map((h) => h.date));
    const additions = Array.from(addedByDate.entries())
      .filter(([date]) => historyDates.has(date))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, names]) => ({ date, count: names.length, names: names.slice(0, 3) }));

    res.json({
      data: {
        totalJpy,
        investedJpy,
        profitAbsJpy,
        profitPct,
        pricedCount,
        totalCount,
        totalPsa10Jpy,
        pricedPsa10Count,
        yesterdayJpy,
        changeAbsJpy,
        changePct,
        history,
        additions,
        asOfDate: today,
      },
    });
  } catch (err) {
    console.error('[me.portfolio]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// NOTE: 정적 경로 (/cards/with-prices) 는 파라미터 경로 (/cards/:id) 보다
// 먼저 등록해야 한다. Express 가 등록 순서대로 매치하므로, 반대 순서면
// `:id = "with-prices"` 로 잡혀 컬렉션 페이지가 400 으로 깨진다.
router.get('/cards/with-prices', async (req: Request, res: Response) => {
  try {
    const data = await getMyCardsWithPrices(req.user!.userId, 200);
    res.json({ data });
  } catch (err) {
    console.error('[me.cards.with-prices]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// 가격만 델타 응답 — 클라이언트가 카드 정적 데이터를 캐시하고 오늘의 금액만 갱신.
// 스냅샷만 읽어 즉시 응답(라이브 대기 0), stale 은 백그라운드 갱신.
// (/cards/:id 보다 먼저 등록 — with-prices 와 같은 이유.)
router.get('/cards/prices', async (req: Request, res: Response) => {
  try {
    const data = await getMyCardPrices(req.user!.userId, 200);
    res.json({ data });
  } catch (err) {
    console.error('[me.cards.prices]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/cards/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const row = await prisma.userCard.findUnique({ where: { id } });
    if (!row || row.userId !== req.user!.userId) {
      return res.status(404).json({ error: 'not found' });
    }
    res.json({ data: row });
  } catch (err) {
    console.error('[me.cards.GET id]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.delete('/cards/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const row = await prisma.userCard.findUnique({ where: { id } });
    if (!row || row.userId !== req.user!.userId) {
      return res.status(404).json({ error: 'not found' });
    }
    await prisma.userCard.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[me.cards.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/feeds', async (req: Request, res: Response) => {
  try {
    const data = await getMyFeeds(req.user!.userId);
    res.json({ data });
  } catch (err) {
    console.error('[me.feeds]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/trades', async (req: Request, res: Response) => {
  try {
    const data = await getMyTrades(req.user!.userId);
    res.json({ data });
  } catch (err) {
    console.error('[me.trades]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/bookmarks', async (req: Request, res: Response) => {
  try {
    const data = await getMyBookmarks(req.user!.userId);
    res.json({ data });
  } catch (err) {
    console.error('[me.bookmarks]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.patch('/name', async (req: Request, res: Response) => {
  const raw = (req.body as { name?: unknown })?.name;
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: '닉네임은 2~20자' });
  }
  if (!/^[\p{L}\p{N}_\s.·-]+$/u.test(name)) {
    return res.status(400).json({ error: '사용할 수 없는 문자가 포함됨' });
  }
  try {
    const user = await prisma.user.upsert({
      where: { id: req.user!.userId },
      update: { name },
      create: { id: req.user!.userId, name },
      select: { id: true, name: true },
    });
    res.json({ data: user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[me.name]', msg);
    if (msg.includes('Unique constraint')) {
      return res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
    }
    res.status(500).json({ error: '서버 오류: ' + msg });
  }
});

router.get('/inventory', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    const checkIn = await runDailyCheckIn(userId).catch(() => null);
    const inventory = await getMyInventory(userId);
    res.json({ inventory, checkIn });
  } catch (err) {
    console.error('[me.inventory]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ── 알림 (포인트 적립·회수·레벨업) — PointLog 원장 기반 ─────────────── */

router.get('/notifications', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    const [rows, u] = await Promise.all([
      prisma.pointLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } }),
    ]);
    const seenAt = u?.notificationsSeenAt ?? null;
    const data = rows.map((r) => {
      // 레벨업 파생 — 잔액과 증감량만으로 계산 (별도 기록 불필요).
      const before = levelFromPoints(r.balanceAfter - r.delta);
      const after = levelFromPoints(r.balanceAfter);
      return {
        id: r.id,
        delta: r.delta,
        reason: r.reason,
        balanceAfter: r.balanceAfter,
        createdAt: r.createdAt.toISOString(),
        unseen: seenAt == null || r.createdAt > seenAt,
        levelUp:
          r.delta > 0 && after.level > before.level
            ? { from: before.level, to: after.level, title: after.title }
            : null,
      };
    });
    res.json({ data });
  } catch (err) {
    console.error('[me.notifications]', err);
    res.status(500).json({ data: [], error: 'internal' });
  }
});

router.get('/notifications/unread', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationsSeenAt: true },
    });
    const count = await prisma.pointLog.count({
      where: {
        userId,
        ...(u?.notificationsSeenAt ? { createdAt: { gt: u.notificationsSeenAt } } : {}),
      },
    });
    res.json({ count });
  } catch (err) {
    console.error('[me.notifications.unread]', err);
    res.json({ count: 0 });
  }
});

router.post('/notifications/seen', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { notificationsSeenAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[me.notifications.seen]', err);
    res.status(500).json({ ok: false });
  }
});

router.post('/points/spend', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const amountRaw = (req.body as { amount?: unknown } | null)?.amount;
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid amount' });
  }
  try {
    // 조건부 차감 — 잔액 확인과 차감을 한 쿼리로 (check-then-write 경쟁 방지)
    const charged = await prisma.user.updateMany({
      where: { id: userId, points: { gte: amount } },
      data: { points: { decrement: amount } },
    });
    if (charged.count === 0) {
      const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) return res.status(404).json({ ok: false, error: 'user not found' });
      return res.status(400).json({ ok: false, error: '포인트 부족' });
    }
    await logPointChange(prisma, userId, -amount, 'manual_spend');
    const inv = await getMyInventory(userId);
    res.json({ ok: true, inv });
  } catch (err) {
    console.error('[me.points.spend]', err);
    res.status(500).json({ ok: false, error: 'internal' });
  }
});

router.post('/inventory/buy', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as {
    action?: 'buy' | 'pick';
    kind?: 'avatar' | 'bg' | 'frame';
    id?: string;
    price?: number;
  };
  const { action, kind, id, price } = body;
  if (!action || !kind || !id) {
    return res.status(400).json({ ok: false, error: 'missing fields' });
  }
  try {
    if (action === 'pick') {
      const r =
        kind === 'avatar' ? await pickAvatar(userId, id)
        : kind === 'bg' ? await pickBackground(userId, id)
        : kind === 'frame' ? await pickFrame(userId, id)
        : { ok: false as const, error: 'invalid kind' };
      return res.json(r);
    }
    if (action === 'buy') {
      const p = Number(price ?? 0);
      const r =
        kind === 'avatar' ? await buyAvatar(userId, id, p)
        : kind === 'bg' ? await buyBackground(userId, id, p)
        : kind === 'frame' ? await buyFrame(userId, id, p)
        : { ok: false as const, error: 'invalid kind' };
      return res.json(r);
    }
    res.status(400).json({ ok: false, error: 'invalid action' });
  } catch (err) {
    console.error('[me.inventory.buy]', err);
    res.status(500).json({ ok: false, error: 'internal' });
  }
});

// ───── 외부 매물 관심목록 (MVC 경매 / 번개장터) ─────

const LISTING_SOURCES = new Set(['mvc', 'bunjang']);

/** GET /api/me/listing-favorites?source=mvc|bunjang (source 생략 시 전체) */
router.get('/listing-favorites', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  if (source && !LISTING_SOURCES.has(source)) {
    return res.status(400).json({ error: 'invalid source' });
  }
  try {
    const rows = await prisma.listingFavorite.findMany({
      where: { userId, ...(source ? { source } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ data: rows });
  } catch (err) {
    console.error('[me.listing-favorites.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** POST /api/me/listing-favorites — { source, externalId, title?, imageUrl?, price?, url? } */
router.post('/listing-favorites', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as {
    source?: string;
    externalId?: string | number;
    title?: string;
    imageUrl?: string | null;
    price?: number | null;
    url?: string;
  };
  const source = String(body.source ?? '');
  const externalId = String(body.externalId ?? '').trim();
  if (!LISTING_SOURCES.has(source) || !externalId) {
    return res.status(400).json({ error: 'source, externalId 필요' });
  }
  const price =
    typeof body.price === 'number' && Number.isFinite(body.price) ? Math.round(body.price) : null;
  const data = {
    title: (body.title ?? '').slice(0, 300),
    imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 1000) : null,
    price,
    url: (body.url ?? '').slice(0, 1000),
  };
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: defaultNameFor(userId) },
    });
    const row = await prisma.listingFavorite.upsert({
      where: { userId_source_externalId: { userId, source, externalId } },
      update: data,
      create: { userId, source, externalId, ...data },
    });
    res.status(201).json({ data: row });
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string };
    console.error('[me.listing-favorites.POST]', userId, e?.code, e?.message);
    res.status(500).json({ error: 'internal', code: e?.code ?? null });
  }
});

/** DELETE /api/me/listing-favorites/:source/:externalId */
router.delete('/listing-favorites/:source/:externalId', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { source, externalId } = req.params;
  if (!LISTING_SOURCES.has(source) || !externalId) {
    return res.status(400).json({ error: 'invalid params' });
  }
  try {
    await prisma.listingFavorite.deleteMany({ where: { userId, source, externalId } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[me.listing-favorites.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── 커뮤니티 이용규칙(UGC EULA) 동의 (App Store 심사 지침 1.2) ─────────────
// 글·댓글 작성 전 클라이언트가 GET 으로 확인 → 미동의/구버전이면 동의 게이트 → POST.
// 규칙 정본·버전: shared/ugcTerms.ts

/** GET /api/me/ugc-terms — { agreed, agreedAt, version, currentVersion } */
router.get('/ugc-terms', async (req: Request, res: Response) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { ugcTermsAgreedAt: true, ugcTermsVersion: true },
    });
    const agreed = !!u?.ugcTermsAgreedAt && (u.ugcTermsVersion ?? 0) >= UGC_TERMS_VERSION;
    res.json({
      agreed,
      agreedAt: u?.ugcTermsAgreedAt ?? null,
      version: u?.ugcTermsVersion ?? 0,
      currentVersion: UGC_TERMS_VERSION,
    });
  } catch (err) {
    console.error('[me.ugc-terms.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** POST /api/me/ugc-terms — 현재 버전 규칙에 동의 기록. */
router.post('/ugc-terms', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: { ugcTermsAgreedAt: new Date(), ugcTermsVersion: UGC_TERMS_VERSION },
      create: {
        id: userId,
        name: defaultNameFor(userId),
        ugcTermsAgreedAt: new Date(),
        ugcTermsVersion: UGC_TERMS_VERSION,
      },
    });
    res.json({ ok: true, agreed: true, version: UGC_TERMS_VERSION });
  } catch (err) {
    console.error('[me.ugc-terms.POST]', userId, err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── 사용자 차단 (App Store 심사 지침 1.2) ─────────────────────────────────
// 차단하면 피드·거래글·댓글 목록에서 해당 작성자 콘텐츠가 나에게 숨겨진다.

/** GET /api/me/blocks — 내가 차단한 사용자 목록. */
router.get('/blocks', async (req: Request, res: Response) => {
  try {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: { id: true, name: true, avatarId: true } } },
      take: 500,
    });
    res.json({
      data: rows.map((r) => ({
        userId: r.blockedId,
        name: r.blocked?.name ?? '탈퇴한 사용자',
        avatarId: r.blocked?.avatarId ?? null,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('[me.blocks.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** POST /api/me/blocks { userId } — 사용자 차단. */
router.post('/blocks', async (req: Request, res: Response) => {
  const blockerId = req.user!.userId;
  const blockedId = String((req.body as { userId?: unknown } | null)?.userId ?? '').trim();
  if (!blockedId) return res.status(400).json({ error: 'userId 필요' });
  if (blockedId === blockerId) return res.status(400).json({ error: '자신은 차단할 수 없어요' });
  try {
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
    // 차단자 User 행 보장 (소셜 로그인 직후 미생성 케이스 — 기존 upsert 패턴).
    await prisma.user.upsert({
      where: { id: blockerId },
      update: {},
      create: { id: blockerId, name: defaultNameFor(blockerId) },
    });
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[me.blocks.POST]', blockerId, blockedId, err);
    res.status(500).json({ error: 'internal' });
  }
});

/** DELETE /api/me/blocks/:userId — 차단 해제. */
router.delete('/blocks/:userId', async (req: Request, res: Response) => {
  try {
    await prisma.userBlock.deleteMany({
      where: { blockerId: req.user!.userId, blockedId: req.params.userId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[me.blocks.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/**
 * DELETE /api/me — 회원 탈퇴 (App Store 5.1.1(v) 계정 삭제 요건).
 * 익명 UGC를 허용하지 않으므로 작성한 피드·댓글·거래글·이벤트 글도 함께 삭제한다.
 * 나머지 개인 데이터는 User 삭제 시 스키마의 Cascade 정책으로 삭제된다.
 */
router.delete('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    await prisma.$transaction(async (tx) => {
      // 부모 글 삭제 전에 다른 사용자의 글에 남긴 댓글부터 제거한다.
      await tx.feedComment.deleteMany({ where: { authorId: userId } });
      await tx.eventPostComment.deleteMany({ where: { authorId: userId } });
      await tx.feed.deleteMany({ where: { authorId: userId } });
      await tx.trade.deleteMany({ where: { authorId: userId } });
      await tx.eventPost.deleteMany({ where: { authorId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    res.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string };
    // P2025 = 이미 없는 사용자 (소셜 로그인 후 User 행 미생성 등) — 탈퇴 목적은 달성.
    if (e?.code === 'P2025') return res.json({ ok: true });
    console.error('[me.DELETE]', userId, err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
