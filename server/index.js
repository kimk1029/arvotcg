import 'dotenv/config';
// WSL2 / some Linux environments route IPv6 to a black hole. Node's global
// fetch prefers IPv6 and times out (e.g. against api.tcgdex.net) — force the
// IPv4 family so outbound HTTPS works regardless of host networking quirks.
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

import express from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Tesseract path removed — only `shutdown` is kept to terminate any worker
// pre-loaded by older code. parseBottomLeft is still used by paddle.js.
import { shutdown } from './lib/ocr.js';
import { matchCandidates } from './lib/match.js';
import { visionExtract, visionAvailable } from './lib/vision.js';
import { paddleScan, paddleHealthcheck, paddleExtract } from './lib/paddle.js';
import { parseScannedCardCode, isUsableCardCode } from '../shared/cardCode.ts';
import { lookupCard, searchTcgdexByName } from './lib/lookup.js';
import { lookupIllustrator, searchTcgdexByIllustrator } from './lib/illustrator.js';
import { dominantNeonForUrl } from './lib/imageColor.js';
import { matchSnkrdunkForCard } from './lib/snkrdunkMatch.js';
import { prisma } from './lib/prisma.js';
import { CARD_CDN_DIR, startCardImageWarmer } from './lib/cardImageCache.js';
import { fetchApparelSingleJpy } from '@/lib/snkrdunkPrice';
import { buildCors } from './middleware/cors.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { requireAuth } from './middleware/requireAuth.js';
import { rateLimit } from './middleware/rateLimit.js';
import authRouter from './routes/auth.js';
import cardPacksRouter from './routes/cardPacks.ts';
import cardsRouter from './routes/cards.ts';
import snkrdunkRouter from './routes/snkrdunk.ts';
import kreamRouter from './routes/kream.ts';
import koreaPriceRouter from './routes/koreaPrice.ts';
import psaRouter from './routes/psa.ts';
import feedsRouter from './routes/feeds.ts';
import tradesRouter from './routes/trades.ts';
import meRouter from './routes/me.ts';
import fxRouter from './routes/fx.ts';
import messagesRouter from './routes/messages.ts';
import bookmarksRouter from './routes/bookmarks.ts';
import oripaRouter from './routes/oripa.ts';
import metricsRouter from './routes/metrics.ts';
import uploadRouter from './routes/upload.ts';
import adminRouter from './routes/admin.ts';
import bannersRouter from './routes/banners.ts';
import eventsRouter from './routes/events.ts';
import placesRouter from './routes/places.ts';
import shopsRouter from './routes/shops.ts';
import usersRouter from './routes/users.ts';
import searchLogRouter from './routes/searchLog.ts';
import reportsRouter from './routes/reports.ts';
import cardLangRouter from './routes/cardLang.ts';
import { startPriceAlertScheduler } from './lib/priceAlerts.ts';
import { startDailyPriceSnapshotScheduler } from './lib/dailyPriceSnapshot.ts';
import { startCollectionBackfill } from './lib/collectionBackfill.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG_DIR = join(__dirname, 'debug');
await mkdir(DEBUG_DIR, { recursive: true }).catch(() => {});

const PORT = Number(process.env.PORT ?? 3030);
const app = express();
app.set('trust proxy', 1);
app.use(buildCors());
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));
app.use('/auth', authRouter);
app.use('/api/card-packs', cardPacksRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/snkrdunk', snkrdunkRouter);
app.use('/api/kream', kreamRouter);
app.use('/api/korea-price', koreaPriceRouter);
app.use('/api/psa', psaRouter);
app.use('/api/search-log', searchLogRouter);
app.use('/api/card-lang', cardLangRouter);
app.use('/api/feeds', feedsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/me', meRouter);
app.use('/api/fx', fxRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/oripa', oripaRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/places', placesRouter);
app.use('/api/shops', shopsRouter);
app.use('/api/users', usersRouter);

const NAVER_IMAGE_HOST_SUFFIX = '.pstatic.net';
const NAVER_IMAGE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

app.get('/api/navercafe/img', async (req, res) => {
  const rawUrl = typeof req.query.u === 'string' ? req.query.u : '';
  if (!rawUrl) return res.status(400).send('missing u');

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return res.status(400).send('bad url');
  }

  if (target.protocol !== 'https:' || !target.hostname.endsWith(NAVER_IMAGE_HOST_SUFFIX)) {
    return res.status(403).send('forbidden host');
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': NAVER_IMAGE_UA,
        Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok || !upstream.body) {
      return res.status(502).send(`upstream ${upstream.status}`);
    }

    res.status(200);
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch {
    return res.status(502).send('fetch failed');
  }
});

app.use(express.static(join(__dirname, 'public')));
// 자체 CDN: 카드 아트 webp 캐시. /api/cdn/cards/<apparelId>.webp (Vercel→NAS 프록시 경유).
// 콘텐츠는 apparelId 당 불변이라 길게 캐싱.
app.use('/api/cdn', express.static(CARD_CDN_DIR, { maxAge: '7d', immutable: true }));
// /debug/* 는 최근 사용자가 업로드한 스캔 원본 사진(last-orig.jpg)·OCR 결과를
// 노출하므로 관리자 세션에서만 접근 가능.
app.use('/debug', requireAdmin, express.static(DEBUG_DIR));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

app.get('/health', async (_req, res) => {
  const paddleUp = await paddleHealthcheck();
  // - tesseract: always on (built-in)
  // - paddle: free Korean-tuned OCR via Python sidecar (port 3002)
  // - visionEnabled: GPT-4o-mini opt-in path
  res.json({
    ok: true,
    tesseract: true,
    paddle: paddleUp,
    visionEnabled: visionAvailable(),
  });
});

app.get('/last', requireAdmin, (_req, res) => {
  // Quick browser view of the most recent scan's crops + OCR text.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><body style="font-family:system-ui;padding:16px">
    <h2>Last scan debug</h2>
    <p>${new Date().toISOString()}</p>
    <h3>Original</h3><img src="/debug/last-orig.jpg" style="max-width:480px;border:2px solid #000">
    <h3>Card crop (detected)</h3><img src="/debug/last-card.jpg" style="max-width:480px;border:2px solid #000">
    <h3>Bottom-left ROI (binarized — Tesseract input)</h3><img src="/debug/last-bl.jpg" style="max-width:480px;border:2px solid #000;background:#fff">
    <h3>Top-name ROI (Tesseract input)</h3><img src="/debug/last-tn.jpg" style="max-width:480px;border:2px solid #000;background:#fff">
    <h3>OCR raw text</h3><pre id="t" style="background:#0f172a;color:#fff;padding:12px;white-space:pre-wrap">loading...</pre>
    <script>fetch('/debug/last.json').then(r=>r.json()).then(j=>document.getElementById('t').textContent=JSON.stringify(j,null,2))</script>
  </body></html>`);
});

/**
 * Card-info lookup. Once /scan returns the 3 ID fields (setCode + number +
 * total + rarity), the mobile client (or any other consumer) calls here to
 * fetch enriched data — image, name, prices — from local DB or pokemontcg.io.
 *
 * GET /api/cards/lookup?setCode=sv6&number=71&total=101&rarity=U
 */
app.get('/api/cards/lookup', async (req, res) => {
  const setCode = String(req.query.setCode ?? req.query.set ?? '');
  const cardNumber = String(req.query.number ?? req.query.cardNumber ?? '');
  const totalNumber = String(req.query.total ?? req.query.totalNumber ?? '');
  const rarity = String(req.query.rarity ?? '');
  const name = String(req.query.name ?? '');
  const language = String(req.query.language ?? req.query.lang ?? '');

  if (!setCode || !cardNumber) {
    return res.status(400).json({
      ok: false,
      message: 'setCode와 number는 필수입니다.',
    });
  }

  const result = await lookupCard({ setCode, cardNumber, totalNumber, rarity, name, language });
  res.json({ ok: true, ...result });
});

/**
 * GET /api/cards/by-illustrator
 *   ?q=신지칸다              (한/영/일 어느 표기든)
 *   ?limit=30
 *
 * 한국어/일본어 입력은 [[shared/data/illustrators.json]] 사전으로 영문 정식
 * 이름(예: "Shinji Kanda") 으로 변환 후 TCGdex (JA → EN) 의 cards?illustrator=eq:..
 * 호출. 매칭 안 된 입력은 그대로 검색 (영문 직접 입력 케이스 대응).
 */
app.get('/api/cards/by-illustrator', async (req, res) => {
  const q = String(req.query.q ?? req.query.name ?? '').trim();
  const limit = Math.max(1, Math.min(Number(req.query.limit ?? 30), 100));
  if (!q) {
    return res.status(400).json({ ok: false, message: 'q (일러스트레이터 이름) 가 필요합니다.' });
  }
  const lookup = lookupIllustrator(q);
  try {
    // TCGdex(목록+상세 다발 호출)가 매달려도 응답은 반드시 돌아가게 전체 30초 가드.
    const cards = await Promise.race([
      searchTcgdexByIllustrator(lookup.tcgdexName, limit),
      new Promise((_, reject) => setTimeout(() => reject(new Error('tcgdex timeout')), 30_000)),
    ]);
    res.json({
      ok: true,
      query: q,
      resolvedName: lookup.tcgdexName,
      matched: lookup.matched ? { en: lookup.matched.en, ja: lookup.matched.ja ?? null, koAliases: lookup.matched.koAliases } : null,
      count: cards.length,
      cards,
    });
  } catch (e) {
    console.warn('[by-illustrator] failed:', e?.message ?? e);
    res.status(500).json({ ok: false, message: '일러스트레이터 검색에 실패했습니다.' });
  }
});

/**
 * GET /api/cards/dominant-color?url=https://...
 *
 * 카드 이미지 URL 의 가장 두드러진 hue 를 뽑아 네온 톤(HSL S=100%, L=60%) hex
 * 로 돌려준다. URL 별 LRU 캐시 — 같은 카드 이미지는 다시 분석 안 함.
 *
 * 응답: { ok, hex, fromCache, fallback }
 */
app.get('/api/cards/dominant-color', async (req, res) => {
  const url = String(req.query.url ?? '').trim();
  if (!url) return res.status(400).json({ ok: false, message: 'url 파라미터가 필요합니다.' });
  // 외부 URL 만 허용 (SSRF 회피) — http/https 스킴만.
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, message: 'http/https URL 만 허용됩니다.' });
  }
  try {
    const r = await dominantNeonForUrl(url);
    res.json({ ok: true, ...r });
  } catch (e) {
    console.warn('[dominant-color] failed:', e?.message ?? e);
    res.status(500).json({ ok: false, message: '색 추출 실패' });
  }
});

// 스캔은 유료 OpenAI Vision 호출 + sharp CPU 작업 — 로그인 필수 + 유저당 분당 제한
const scanRateLimit = rateLimit({ windowMs: 10 * 60_000, max: 30, name: 'scan' });

/**
 * 스캔 1건을 scan_logs 테이블에 기록 (어드민 "스캔 로그" 화면용).
 * - engine: vision(OpenAI) > paddle(무료) > none
 * - request: 모델 파라미터 + 클라이언트가 보낸 요청 메타(useAi, guideRect, dims)
 * - extracted/candidates: 인식 결과 + 후보 요약(상위 12건)
 * 어떤 실패도 스캔 응답에 영향 주지 않도록 호출부에서 catch.
 */
async function recordScanLog({
  req, startedAt, extracted, usedVision, usedPaddle, visionMeta,
  langHint, confidence, candidates, success, snkrdunk,
}) {
  const platform = String(req.body?.platform ?? 'web');
  const source = platform === 'web' ? 'web' : 'app';
  const engine = usedVision ? 'vision' : usedPaddle ? 'paddle' : 'none';
  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const guideRect = (() => {
    try {
      return req.body?.guideRect ? JSON.parse(req.body.guideRect) : null;
    } catch {
      return null;
    }
  })();
  const candSummary = (candidates ?? []).slice(0, 12).map((c) => ({
    id: c.id,
    source: c.source,
    name: c.localName || c.name,
    number: c.number,
    setCode: c.setCode,
    rarity: c.rarity,
    price: c.price?.marketPrice ?? c.priceSummary?.value ?? null,
    currency: c.price?.currency ?? c.priceSummary?.currency ?? null,
  }));
  await prisma.scanLog.create({
    data: {
      userId: req.user?.userId ?? null,
      source,
      engine,
      model: usedVision ? (visionMeta?.model ?? null) : null,
      langHint: langHint || null,
      durationMs: Date.now() - startedAt,
      success: Boolean(success),
      confidence: typeof confidence === 'number' ? confidence : null,
      candidateCount: (candidates ?? []).length,
      imageWidth: toInt(req.body?.imageWidth),
      imageHeight: toInt(req.body?.imageHeight),
      promptTokens: visionMeta?.usage?.prompt ?? null,
      completionTokens: visionMeta?.usage?.completion ?? null,
      totalTokens: visionMeta?.usage?.total ?? null,
      request: {
        useAi: req.body?.useAi === 'true' || req.body?.useAi === true,
        guideRect,
        capturedAt: req.body?.capturedAt ?? null,
        vision: visionMeta
          ? {
              fullDetail: visionMeta.fullDetail,
              zoomDetail: visionMeta.zoomDetail,
              maxTokens: visionMeta.maxTokens,
              maxDim: visionMeta.maxDim,
              durationMs: visionMeta.durationMs,
              error: visionMeta.error ?? null,
            }
          : null,
      },
      prompt: usedVision ? (visionMeta?.prompt ?? null) : null,
      extracted: extracted ?? null,
      candidates: candSummary,
      snkrdunkId: snkrdunk?.apparelId ?? null,
      errorMessage: !success ? (visionMeta?.error ?? null) : null,
    },
  });
}

/**
 * 코드 전용 경량 스캔 — 카메라 fast path 의 **서버 폴백**.
 *
 * 앱은 카드 좌하단만 잘라 온디바이스(ML Kit)로 먼저 읽고, 실패했을 때만 그 조각을
 * 여기로 보낸다. 전체 /scan 과 달리 이름·일러스트·TCGdex·스니덩 매칭을 전혀 하지
 * 않고 **세트코드/카드번호/레어도만** 돌려준다 (뒤 검색은 /api/snkrdunk/by-code 가 함).
 */
app.post('/api/cards/scan-code', requireAuth, scanRateLimit, upload.single('image'), async (req, res) => {
  const startedAt = Date.now();
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, code: null, message: 'image 파일이 필요합니다.' });

  /** @type {string[]} */
  let lines = [];
  let engine = 'none';
  try {
    const r = await paddleExtract(file.buffer);
    if (r?.lines?.length) {
      lines = r.lines.map((l) => String(l.text ?? '')).filter(Boolean);
      engine = 'paddle';
    }
  } catch (e) {
    console.warn('[scan-code] paddle 실패:', e?.message ?? e);
  }
  // Paddle 사이드카가 없거나 아무것도 못 읽었으면 Vision 으로 한 번 더 (설정된 경우).
  if (lines.length === 0 && visionAvailable()) {
    try {
      const v = await visionExtract(file.buffer);
      const d = v?.data;
      if (d) {
        lines = [d.setCode, d.cardNumber && d.totalNumber ? `${d.cardNumber}/${d.totalNumber}` : d.cardNumber, d.rarity]
          .filter(Boolean)
          .map(String);
        engine = 'vision';
      }
    } catch (e) {
      console.warn('[scan-code] vision 실패:', e?.message ?? e);
    }
  }

  const code = parseScannedCardCode(lines);
  const ok = isUsableCardCode(code);
  console.log(`[scan-code] ${Date.now() - startedAt}ms engine=${engine} set=${code.setCode} num=${code.cardNumber} rar=${code.rarity} ok=${ok}`);
  res.json({ ok, engine, code, durationMs: Date.now() - startedAt });
});

app.post('/api/cards/scan', requireAuth, scanRateLimit, upload.single('image'), async (req, res) => {
  const startedAt = Date.now();
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, candidates: [], needsUserSelection: false, message: 'image 파일이 필요합니다.' });

  // Language hint from the registration UI: 'ko' | 'jp' | 'en'.
  const langHint = (() => {
    const v = String(req.body?.language ?? '').toLowerCase();
    return v === 'ko' || v === 'jp' || v === 'en' ? v : '';
  })();
  let extracted = null;
  let usedVision = false;
  let usedPaddle = false;
  let visionMeta = null;
  // Tesseract path was removed — AI is the only OCR engine. We keep these
  // names for backward-compatible debug/log shape but they stay empty.
  const blText = '';
  const nameText = '';
  const dims = null;
  const roiResults = [];
  const bestRoi = null;

  // AI-only OCR. Vision (paid GPT) takes priority when configured, then
  // PaddleOCR (free, server-side). If both fail we return an error rather
  // than falling back to Tesseract — Tesseract can't read modern stylized
  // Pokémon cards anyway.
  if (visionAvailable()) {
    try {
      const v = await visionExtract(file.buffer);
      visionMeta = v?.meta ?? null;
      if (v?.data) {
        extracted = v.data;
        usedVision = true;
      }
    } catch (e) {
      console.warn('vision path failed:', e?.message ?? e);
    }
  }
  if (!extracted) {
    try {
      const paddleExtracted = await paddleScan(file.buffer, langHint);
      if (paddleExtracted && (paddleExtracted.name || paddleExtracted.cardNumber || paddleExtracted.setCode)) {
        extracted = paddleExtracted;
        usedPaddle = true;
      }
    } catch (e) {
      console.warn('paddle path failed:', e?.message ?? e);
    }
  }
  if (!extracted) {
    return res.status(503).json({
      success: false,
      candidates: [],
      needsUserSelection: false,
      message: 'AI OCR 서버를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
    });
  }
  // Save the original for the /last debug view (helpful even on AI path).
  await writeFile(join(DEBUG_DIR, 'last-orig.jpg'), file.buffer).catch(() => {});

  // PROMO normalization — Vision / Paddle sometimes emits totalNumber="M-P"
  // or setCode="020/M-P" because promo cards use a literal suffix (M-P,
  // L-P, S-P, SV-P) instead of a numeric total. Re-route into setCode and
  // clear totalNumber so downstream lookups don't search by a bogus total.
  normalizePromoFields(extracted);

  // Set-code inference: the white-on-black set badge is too small for
  // both PaddleOCR and Tesseract to read reliably. When OCR didn't return
  // a set code but we have a confident totalNumber, look up the unique set
  // for that (language, total) pair.
  if (extracted && !extracted.setCode && extracted.totalNumber) {
    const lang = extracted.language || langHint || '';
    const totalNum = Number(String(extracted.totalNumber).replace(/^0+(?=\d)/, ''));
    const inferred = lang ? TOTAL_TO_SET_BY_LANG[lang]?.[totalNum] : undefined;
    if (inferred) {
      extracted.setCode = inferred;
      extracted.setInferred = true;
    }
  }
  // Fill in totalNumber from SET_TOTAL_MAP only when the OCR missed it.
  // Previously this UNCONDITIONALLY overwrote, which corrupted accurate
  // vision reads (e.g. AR cards numbered 112/106 in sv8 got rewritten to
  // 112/101 because of a stale total in the map, then lookup 404'd).
  if (extracted?.setCode && SET_TOTAL_MAP[extracted.setCode] && !extracted.totalNumber) {
    extracted.totalNumber = String(SET_TOTAL_MAP[extracted.setCode]).padStart(3, '0');
  }

  const { candidates, confidence } = matchCandidates({
    cardNumber: extracted.cardNumber,
    totalNumber: extracted.totalNumber,
    setCode: extracted.setCode,
    rarity: extracted.rarity,
    name: extracted.name,
  });

  const rawText = `${nameText ? nameText.trim() + ' | ' : ''}${blText.trim()}`.trim() ||
    `${extracted.name} ${extracted.cardNumber}/${extracted.totalNumber} ${extracted.setCode} ${extracted.rarity}`.trim();

  // Build an initial candidate list from the local DB match (top scoring rows
  // that hit on setCode + cardNumber). These come with Korean names and KRW
  // marketPrice; we'll merge in TCGdex art + cardmarket pricing below.
  // KO mode: LOCAL_DB 의 imageSmall/imageLarge 가 있으면 그걸 그대로 사용. 한국판
  // 일러스트가 일본판 fallback 으로 덮어쓰이지 않도록.
  /** @type {Array<any>} */
  let responseCandidates = candidates.map((c) => ({
    id: c.id,
    source: 'internal',
    name: c.name,
    setName: c.setName,
    setCode: c.setCode,
    number: `${c.number}/${c.totalNumber}`,
    rarity: c.rarity,
    language: c.language,
    imageSmall: c.imageSmall ?? null,
    imageLarge: c.imageLarge ?? null,
    price: { marketPrice: c.marketPrice, currency: 'KRW', source: 'internal', updatedAt: new Date().toISOString() },
  }));

  // 사용자가 "한국어" 로 명시했고 LOCAL_DB 가 정확히 hit 된 경우 — 일본판 enrichment
  // 를 skip. TCGdex name-search / Snkrdunk 매칭은 일본판 일러스트와 일본판 마켓
  // 데이터를 가져와 한국판 카드와 시각적으로 어긋난다. 사용자가 명시한 ko 신호를
  // 존중해 한국판만 보여주는 것이 단일 진실의 원천.
  const koExactHit =
    langHint === 'ko' &&
    extracted?.setCode &&
    extracted?.cardNumber &&
    responseCandidates.some(
      (c) =>
        String(c.setCode ?? '').toLowerCase() === String(extracted.setCode).toLowerCase() &&
        pad(String(c.number ?? '').split('/')[0] ?? '') === pad(extracted.cardNumber),
    );

  // Server-side TCGdex enrichment — the mobile UI requires image + price for
  // every candidate it shows. Doing the lookup here (in parallel with the
  // name search) means the mobile only has to make a single /scan call and
  // gets ready-to-render candidates back.
  const enrichTasks = [];
  // (a) Exact match — TCGdex `setCode-cardNumber`. Highest-priority candidate.
  // 한국어 모드 + LOCAL_DB exact hit 일 때는 skip — 한국판이 우선이므로 일본판
  // 일러스트를 받아 와도 사용자에게 혼란만 줌.
  if (extracted?.setCode && extracted?.cardNumber && !koExactHit) {
    enrichTasks.push(
      lookupCard({
        setCode: extracted.setCode,
        cardNumber: extracted.cardNumber,
        totalNumber: extracted.totalNumber,
        rarity: extracted.rarity,
        name: extracted.name,
        language: extracted.language,
      }).then((r) => (r.found && r.card ? [tcgdexCardToCandidate(r.card, 'tcgdex-exact')] : [])),
    );
  }
  // (b) Name search — when the exact match misses (typical for AR/SAR cards
  // numbered beyond a set's base count), search TCGdex by JA Pokémon name.
  // Returns siblings of the same Pokémon (same Pokémon, different prints),
  // each with image + EUR pricing — gives the user real alternatives instead
  // of a dead-end "시세 미확인". 한국어 모드 + 한국판 hit 이면 skip.
  if (extracted?.nameJa && !koExactHit) {
    enrichTasks.push(
      searchTcgdexByName(extracted.nameJa, extracted.setCode, 5).then((cards) =>
        cards.map((c) => tcgdexCardToCandidate(c, 'tcgdex-search')),
      ),
    );
  }
  const enrichedArrays = await Promise.all(enrichTasks);
  const enriched = enrichedArrays.flat();

  // Merge: local DB candidates first (Korean names + curated KRW prices),
  // then TCGdex exact match, then TCGdex name-search siblings. De-dupe on
  // composite key (setCode-number) — local + tcgdex-exact may collide and
  // we want the merged shape with both Korean name and TCGdex image.
  const byKey = new Map();
  const keyOf = (c) => `${(c.setCode ?? '').toLowerCase()}-${pad(String(c.number ?? '').split('/')[0] ?? '')}`;
  for (const c of responseCandidates) byKey.set(keyOf(c), c);
  for (const e of enriched) {
    const k = keyOf(e);
    const existing = byKey.get(k);
    if (existing) {
      // Local DB wins on Korean name + KRW price; TCGdex wins on image + EUR
      // pricing summary. Merge.
      byKey.set(k, {
        ...e,
        ...existing,
        imageSmall: e.imageSmall ?? existing.imageSmall ?? null,
        imageLarge: e.imageLarge ?? existing.imageLarge ?? null,
        priceSummary: existing.priceSummary ?? e.priceSummary ?? null,
        localName: existing.name && /[가-힣]/.test(existing.name) ? existing.name : e.localName,
      });
    } else {
      byKey.set(k, e);
    }
  }
  responseCandidates = Array.from(byKey.values());

  // Final fallback: if no API hit at all but OCR has signal, surface what we
  // read so the user can confirm a manual save. No image, no price — the UI
  // shows "시세 미확인" + emoji placeholder.
  const hasSignal = Boolean(extracted.cardNumber || extracted.setCode);
  if (responseCandidates.length === 0 && hasSignal) {
    const cleanName = sanitizeName(extracted.name);
    responseCandidates = [{
      id: `extracted-${Date.now()}`,
      source: 'unknown',
      name: cleanName || '인식된 카드 (API 미등록)',
      setName: extracted.setCode ? `세트 ${extracted.setCode}` : '세트 정보 없음',
      setCode: extracted.setCode || '',
      number: extracted.cardNumber
        ? `${pad(extracted.cardNumber)}${extracted.totalNumber ? '/' + pad(extracted.totalNumber) : ''}`
        : '',
      rarity: extracted.rarity || '',
      language: extracted.language ?? 'ko',
      price: undefined,
    }];
  }

  // Snkrdunk lookup — use OCR'd cardNumber/totalNumber/setCode (+ optional
  // JP name) to find the matching apparel. Successful matches are cached on
  // disk, so repeat scans skip the search and hit the JSON-only fast path.
  // 한국어 모드 + LOCAL_DB hit 일 때는 skip — Snkrdunk 는 일본 마켓이라 일본판
  // 일러스트/가격을 가져온다. 한국판 사용자에겐 카드도 다르고 시세도 의미 다름.
  let snkrdunk = null;
  let snkrdunkTrace = null;
  try {
    if (koExactHit) {
      snkrdunkTrace = { skipped: 'ko-local-hit' };
    } else {
    const raw = await matchSnkrdunkForCard({
      cardNumber: extracted.cardNumber,
      totalNumber: extracted.totalNumber,
      setCode: extracted.setCode,
      rarity: extracted.rarity,
    });
    if (raw?.miss) {
      snkrdunkTrace = raw.trace;
    } else if (raw) {
      snkrdunk = raw;
      snkrdunkTrace = raw.trace;
    }
    } // end else
  } catch (e) {
    console.warn('[snkrdunk] match failed:', e?.message ?? e);
  }

  if (snkrdunk) {
    // 가격은 "최저 매물가(minPrice)" 대신 "최근 raw 체결 중앙값" 으로 — 내 컬렉션/
    // 포트폴리오(getMyCardsWithPrices)와 같은 함수([[snkrdunkPrice]])를 써서 같은
    // 카드에 같은 시세를 보인다. 체결 데이터가 없으면 매칭이 준 minPrice 로 폴백.
    const medianJpy = await fetchApparelSingleJpy(snkrdunk.apparelId).catch(() => 0);
    const snkrPriceJpy = medianJpy > 0 ? medianJpy : (snkrdunk.priceJpy ?? 0);

    // Build a dedicated snkrdunk-match candidate at the top of the list,
    // sourced entirely from snkrdunk (image, JPY price, JP localized name).
    // This stops the previous "smear over all candidates" behavior that
    // made unrelated TCGdex siblings look like the scanned card.
    const snkrCandidate = {
      id: `snkr-${snkrdunk.apparelId}`,
      source: 'snkrdunk-match',
      name: snkrdunk.localizedName || extracted.name || extracted.nameJa || 'snkrdunk 카드',
      localName: null,
      nameJa: extracted.nameJa ?? null,
      setName: extracted.setCode ? `세트 ${extracted.setCode.toUpperCase()}` : '',
      setCode: extracted.setCode ?? '',
      number: extracted.cardNumber
        ? (extracted.totalNumber ? `${pad(extracted.cardNumber)}/${extracted.totalNumber}` : pad(extracted.cardNumber))
        : '',
      rarity: extracted.rarity ?? 'PROMO',
      language: 'ja',
      imageSmall: snkrdunk.imageUrl ?? null,
      imageLarge: snkrdunk.imageUrl ?? null,
      priceSummary: snkrPriceJpy > 0
        ? {
            source: 'snkrdunk',
            value: snkrPriceJpy,
            currency: 'JPY',
            low: null,
            trend: null,
            byRegion: {
              jpy: snkrPriceJpy,
              krw: null,
              eur: null,
              usd: null,
            },
          }
        : null,
      price: snkrPriceJpy > 0
        ? {
            marketPrice: snkrPriceJpy,
            currency: 'JPY',
            source: 'snkrdunk',
            updatedAt: new Date().toISOString(),
          }
        : undefined,
      snkrdunk,
    };

    // Drop other candidates whose setCode-cardNumber clearly doesn't match
    // the OCR'd card code — they're TCGdex name-search siblings (e.g. 5
    // unrelated Pikachus from sv4a when the scanned card is M-P 020). If
    // we kept them they'd render with their own art but next to a confident
    // snkrdunk hit, the user just gets confused.
    if (extracted.cardNumber) {
      const ocCardNum = pad(extracted.cardNumber);
      const ocSet = (extracted.setCode || '').toLowerCase();
      responseCandidates = responseCandidates.filter((c) => {
        const candNum = pad(String(c.number ?? '').split('/')[0] ?? '');
        const candSet = String(c.setCode ?? '').toLowerCase();
        // Keep only candidates that align with the OCR'd card code.
        if (!candNum) return false;
        if (candNum !== ocCardNum) return false;
        if (ocSet && candSet && candSet !== ocSet) return false;
        return true;
      });
    } else {
      responseCandidates = [];
    }

    // snkrdunk match always leads the list.
    responseCandidates = [snkrCandidate, ...responseCandidates];
  }

  const needsUserSelection = responseCandidates.length > 1;
  const success = responseCandidates.length > 0;

  // Persist a debug snapshot
  const debug = {
    at: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    vision: usedVision,
    paddle: usedPaddle,
    dims,
    blText,
    nameText,
    parsed: extracted,
    matched: responseCandidates,
  };

  let snkrLog = '';
  if (snkrdunk) {
    const pick = snkrdunkTrace?.pick;
    const qLabel = pick?.q ? ` q="${pick.q}"` : '';
    const scoreLabel = pick?.score != null ? ` score=${pick.score}` : '';
    snkrLog = ` snkr=${snkrdunk.apparelId}${snkrdunk.cacheHit ? '(cache)' : ''}${qLabel}${scoreLabel}${snkrdunk.priceJpy ? ` ¥${snkrdunk.priceJpy}` : ''}`;
  } else if (snkrdunkTrace) {
    const tried = snkrdunkTrace.queries.map((q) => q.q).join(' | ');
    snkrLog = ` snkr=miss tries=[${tried}]`;
  }
  console.log(
    `[scan] ${debug.durationMs}ms lang=${langHint || '-'} vision=${usedVision} paddle=${usedPaddle} num=${extracted.cardNumber} set=${extracted.setCode} rar=${extracted.rarity} name="${(extracted.name||'').slice(0,20)}" → ${responseCandidates.length} cand${snkrLog}`,
  );
  debug.snkrdunk = snkrdunk;
  debug.snkrdunkTrace = snkrdunkTrace;

  debug.roi = roiResults.map((r) => ({ name: r.name, score: r.score, text: r.text, parsed: r.parsed }));
  debug.bestRoi = bestRoi?.name ?? null;
  await writeFile(join(DEBUG_DIR, 'last.json'), JSON.stringify(debug, null, 2)).catch(() => {});

  // 어드민 "스캔 로그" 화면용 영구 기록 — 응답 지연을 피하려 fire-and-forget.
  // 로깅 실패가 스캔 UX 를 막으면 안 되므로 catch 로 삼킨다.
  recordScanLog({
    req,
    startedAt,
    extracted,
    usedVision,
    usedPaddle,
    visionMeta,
    langHint,
    confidence,
    candidates: responseCandidates,
    success,
    snkrdunk,
  }).catch((e) => console.warn('[scan-log] failed:', e?.message ?? e));

  res.json({
    success,
    scanId: `s-${Date.now()}`,
    confidence,
    usedAi: usedVision || usedPaddle,
    usedPaddle,
    usedVision,
    extracted: {
      rawText,
      cardNumber: extracted.cardNumber,
      totalNumber: extracted.totalNumber,
      setCode: extracted.setCode,
      rarity: extracted.rarity,
      language: extracted.language,
      name: extracted.name,
      nameJa: extracted.nameJa,
      // Vision 이 추출한 카드 외곽/내곽 4코너 (image 기준 normalized 0..1).
      // sanity 체크 통과한 경우만 객체 배열, 아니면 null. paddle 경로는 항상 null.
      outerQuad: extracted.outerQuad ?? null,
      innerQuad: extracted.innerQuad ?? null,
    },
    candidates: responseCandidates,
    snkrdunk: snkrdunk ?? null,
    needsUserSelection,
    message: !success ? '좌측 하단의 카드번호가 잘 보이게 다시 촬영해주세요.' : undefined,
  });
});

// Centralized error handler — catches throws from any route handler so a single
// failing endpoint can't crash the whole process. Keep this LAST.
app.use((err, _req, res, _next) => {
  console.error('[express.error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal' });
});

/**
 * 주기 작업은 **단일 인스턴스 전제**로 짜여 있다(in-process setInterval, 별도 크론 없음).
 * NAS↔Vultr 동시 배포 기간에는 두 서버가 같은 Supabase 를 보므로, 양쪽에서 돌면
 * 가격알림이 사용자에게 **중복 발송**된다(스냅샷·워밍은 멱등이지만 업스트림을 두 배로 두드린다).
 *
 * 그래서 스케줄러 기동을 SERVER_ROLE 로 잠근다:
 *   primary (기본) — 스케줄러 실행. 지금은 NAS.
 *   standby        — API 는 정상 서빙, 주기 작업만 끔. 지금은 Vultr.
 * 이전이 끝나 트래픽을 넘길 때 두 서버의 SERVER_ROLE 을 맞바꾸면 된다.
 */
const SERVER_ROLE = (process.env.SERVER_ROLE || 'primary').trim().toLowerCase();
const SCHEDULERS_ENABLED = SERVER_ROLE !== 'standby';

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`OCR server listening http://localhost:${PORT}  vision=${visionAvailable() ? 'on' : 'off'}  role=${SERVER_ROLE}`);
  if (!SCHEDULERS_ENABLED) {
    console.log('[scheduler] SERVER_ROLE=standby — 주기 작업(가격알림/이미지워밍/일일스냅샷) 미기동');
    return;
  }
  // 가격 알림 주기 점검 시작(단일 서버 인스턴스 내 setInterval).
  startPriceAlertScheduler();
  // 카드 이미지 자체 CDN 워밍 — 부팅 후 + 매일, 미캐싱 카드 점진 backfill.
  startCardImageWarmer();
  // 일일 시세 스냅샷 — 매일 새벽 3시(KST) 카탈로그 전체 순회, 가격 통계용 히스토리 적재.
  startDailyPriceSnapshotScheduler();
  // 컬렉션 카드 DB 보증 — 스냅샷이 없는 보유 카드를 부팅 후/주기적으로 메운다.
  startCollectionBackfill();
});

const exit = async () => {
  console.log('\nShutting down...');
  await shutdown().catch(() => {});
  server.close(() => process.exit(0));
};
process.on('SIGINT', exit);
process.on('SIGTERM', exit);

// Fallback for when OCR can't read totalNumber (rare since the two-image
// vision call). Values verified against TCGdex `cardCount.official`.
// Outdated entries here used to corrupt correctly-read totals — see the
// guard above. Add new sets as they land.
const SET_TOTAL_MAP = {
  // Mega Evolution era (KR/JP 2025+)
  m1: 63, m1l: 63, m1s: 63,
  m2: 102, m2a: 71,
  m3: 174, m4: 80,
  // Scarlet & Violet
  sv1s: 78, sv1v: 78, sv1a: 73,
  sv2d: 71, sv2p: 71, sv2a: 165,
  sv3: 108, sv3a: 71,
  sv4k: 66, sv4m: 66, sv4a: 230,
  sv5k: 71, sv5m: 71, sv5a: 66,
  sv6: 101, sv6a: 73,
  sv7: 102, sv7a: 70,
  sv8: 106, sv8a: 187,
  sv9: 100, sv9a: 71,
  sv10: 98,
  sv11b: 174, sv11w: 174,
  // Sword & Shield
  s10b: 71, s11: 100, s11a: 68, s12: 98, s12a: 211, sm12: 184,
};

// Reverse lookup by language → total → set code. The white-on-black set badge
// is too small for OCR to read reliably, so when totalNumber is detected we
// infer the set code from this map. Per-language because Korean / Japanese
// / English sets share total values across regions.
//
// Only include totals UNIQUE within a language. If two sets share a total,
// leave both out — better to return no setCode than the wrong one. Order
// the dictionary so newer sets win when extending.
const TOTAL_TO_SET_BY_LANG = {
  ko: {
    63: 'm1l',
    // 71 is ambiguous (m2l vs sv3a vs s10b) — not inferred
    78: 'sv5a',
    98: 'sv7a-or-s12', // ambiguous - skip
    100: 's11',         // also sv5 — keep most recent Korean release
    101: 'sv6',
    102: 'sv4',
    105: 'sv7',
    108: 'sv3',
    165: 'sv2a',        // also sv1, sv2 — newest wins
    230: 'sv4a',
  },
  jp: {
    63: 'm1l',
    71: 'sv3a',
    100: 'sv5',
    101: 'sv6',
    102: 'sv4',
    105: 'sv7',
    108: 'sv3',
    165: 'sv2a',
    230: 'sv4a',
  },
};
// Strip ambiguity sentinels so lookups don't return them.
for (const lang of Object.keys(TOTAL_TO_SET_BY_LANG)) {
  for (const k of Object.keys(TOTAL_TO_SET_BY_LANG[lang])) {
    if (TOTAL_TO_SET_BY_LANG[lang][k].includes('-or-')) delete TOTAL_TO_SET_BY_LANG[lang][k];
  }
}

function looksLikeKorean(s) {
  if (!s) return false;
  const total = s.replace(/\s/g, '').length;
  if (total < 2) return false;
  const hangul = (s.match(/[가-힣]/g) ?? []).length;
  return hangul / total > 0.4;
}

function looksLikeJapanese(s) {
  if (!s) return false;
  const total = s.replace(/\s/g, '').length;
  if (total < 2) return false;
  const jp = (s.match(/[\u3040-\u30ff\u3400-\u9fff]/g) ?? []).length;
  return jp / total > 0.35;
}

function bestNameCandidate(text, langHint = '') {
  if (!text) return '';
  const candidates = text
    .split(/[\/\n]/)
    .map((s) => sanitizeName(s, langHint))
    .filter(Boolean)
    .sort((a, b) => nameScore(b, langHint) - nameScore(a, langHint));
  return candidates[0] ?? '';
}

function nameScore(s, langHint = '') {
  let score = 0;
  const letters = (s.match(/[가-힣A-Za-z\u3040-\u30ff\u3400-\u9fff]/g) ?? []).length;
  const noise = (s.match(/[^가-힣A-Za-z0-9\u3040-\u30ff\u3400-\u9fff .&'’-]/g) ?? []).length;
  if (looksLikeKorean(s)) score += langHint === 'ko' ? 60 : 30;
  if (looksLikeJapanese(s)) score += langHint === 'jp' ? 60 : 30;
  if (/^[A-Za-z][A-Za-z0-9 .&'’-]{2,}$/.test(s)) score += langHint === 'en' ? 50 : 18;
  score += Math.min(letters, 18);
  score -= noise * 8;
  score -= Math.max(0, s.length - 32);
  return score;
}

/** Trim OCR card-name noise. Returns '' for gibberish, otherwise a clean candidate.
 *  When langHint is set we only emit tokens in that script, so an English name
 *  like "Charizard ex" isn't dropped because no Korean tokens existed. */
function sanitizeName(s, langHint = '') {
  if (!s) return '';
  const tokens = s
    .replace(/[^가-힣A-Za-z0-9\u3040-\u30ff\u3400-\u9fff\s.&'’-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (langHint === 'ko') {
    return tokens.find((t) => /^[가-힣]{2,}$/.test(t)) ?? '';
  }
  if (langHint === 'jp') {
    return tokens.find((t) => /^[\u3040-\u30ff\u3400-\u9fff]{2,}$/.test(t)) ?? '';
  }
  if (langHint === 'en') {
    const englishRun = tokens
      .filter((t) => /^[A-Za-z][A-Za-z0-9.&'’-]*$/.test(t))
      .slice(0, 4)
      .join(' ');
    return englishRun || '';
  }
  const hangulRun = tokens.find((t) => /^[가-힣]{2,}$/.test(t));
  if (hangulRun) return hangulRun;
  const japanese = tokens.find((t) => /^[\u3040-\u30ff\u3400-\u9fff]{2,}$/.test(t));
  if (japanese) return japanese;
  const english = tokens.find((t) => /^[A-Za-z][A-Za-z0-9 .&'’-]{2,}$/.test(t));
  if (english) return english;
  return '';
}

function pad(n) {
  const s = String(n).replace(/^0+/, '');
  return s.length >= 3 ? s : s.padStart(3, '0');
}

/** PROMO suffix re-routing. Vision/Paddle often emits
 *  - totalNumber="M-P" / "L-P" / "SV-P" (literal promo suffix, not a count)
 *  - setCode="020/M-P"   (cardNumber bled into setCode because of the slash)
 *  Push these into setCode and clear totalNumber so downstream lookups
 *  don't search by the bogus values. Force rarity=PROMO when seen. */
function normalizePromoFields(ex) {
  if (!ex) return;
  const promoTotalRe = /^([a-z]+)-?p$/i;
  // Case 1: totalNumber is "M-P" / "L-P" / "S-P" / "SV-P"
  if (ex.totalNumber && promoTotalRe.test(String(ex.totalNumber).trim())) {
    const match = String(ex.totalNumber).trim().match(promoTotalRe);
    ex.setCode = (match[1] + '-p').toLowerCase();
    ex.totalNumber = '';
    ex.rarity = ex.rarity || 'PROMO';
    return;
  }
  // Case 2: setCode was returned as "020/m-p" (cardNumber bled in)
  if (ex.setCode && String(ex.setCode).includes('/')) {
    const parts = String(ex.setCode).split('/');
    if (parts.length === 2 && promoTotalRe.test(parts[1].trim())) {
      const match = parts[1].trim().match(promoTotalRe);
      ex.setCode = (match[1] + '-p').toLowerCase();
      if (!ex.cardNumber) ex.cardNumber = parts[0];
      ex.totalNumber = '';
      ex.rarity = ex.rarity || 'PROMO';
    }
  }
}

/**
 * Convert a TCGdex normalized card (from lookup.js `normalizeCard`) into the
 * `ScanCandidate` shape the mobile UI consumes. Pulls image + pricing
 * directly off the API response — no FX guessing in this layer.
 */
function tcgdexCardToCandidate(card, source) {
  return {
    id: card.id,
    source,
    name: card.localName ?? card.name,
    localName: card.localName ?? null,
    nameJa: card.name,
    setName: card.setName,
    setCode: (card.setCode ?? '').toLowerCase(),
    number: card.totalNumber ? `${card.number}/${card.totalNumber}` : String(card.number ?? ''),
    rarity: card.rarity,
    language: card.sourceLang ?? 'ja',
    imageSmall: card.imageSmall ?? null,
    imageLarge: card.imageLarge ?? null,
    priceSummary: card.priceSummary ?? null,
    price: card.priceSummary?.byRegion
      ? (() => {
          // 값과 통화 라벨을 일치시킨다 — jpy 우선, 없으면 krw. (이전엔 krw 값에도
          // 'JPY' 라벨이 붙어 ¥ 로 잘못 표시되던 버그)
          const br = card.priceSummary.byRegion;
          const jpy = br.jpy ?? null;
          const krw = br.krw ?? null;
          const useJpy = typeof jpy === 'number' && jpy > 0;
          const marketPrice = useJpy ? jpy : krw;
          if (marketPrice == null) return undefined;
          return {
            marketPrice,
            currency: useJpy ? 'JPY' : 'KRW',
            source: card.priceSummary.source,
            updatedAt: new Date().toISOString(),
          };
        })()
      : undefined,
  };
}
