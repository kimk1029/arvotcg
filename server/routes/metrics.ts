import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { optionalAuth } from '../middleware/requireAuth.js';
import { isEmbedUserAgent } from '../../shared/embed';
import { kstDateKey } from '../../shared/kst';

const router = Router();

/** 접속 출처 — 'web' | 'mobile'(앱 네이티브) | 'webview'(앱 인앱 WebView 안의 웹). */
export type MetricSource = 'web' | 'mobile' | 'webview';

const ALLOWED_NETWORKS = new Set(['adsense', 'adfit', 'house', 'offerwall']);

function clientIp(req: Request): string | null {
  // Express의 trust proxy 정책을 사용한다. 외부가 넣은 X-Forwarded-For 첫 값을 믿지 않는다.
  return req.ip?.slice(0, 64) || null;
}

function ua(req: Request): string | null {
  const v = (req.headers['user-agent'] as string | undefined) ?? '';
  return v.slice(0, 256) || null;
}

/**
 * 출처 판별 — 앱은 body.source='mobile' 로 자기 신고, 웹은 UA 에 앱 WebView 토큰(ARVOTCG-App)이
 * 있으면 'webview', 아니면 'web'. 클라이언트 신고값보다 UA 를 우선해 구버전 웹 번들도 정확히 분류.
 */
function resolveSource(bodySource: unknown, req: Request): MetricSource {
  if (bodySource === 'mobile') return 'mobile';
  if (isEmbedUserAgent(req.headers['user-agent'] as string | undefined)) return 'webview';
  return 'web';
}

/**
 * 일별 고유 방문(ip, day) upsert. 같은 IP 의 첫 방문이 익명(로그인 화면)이어도 나중에
 * 로그인한 요청이 오면 userId 를 채운다 — 예전엔 skipDuplicates 로 첫 행이 굳어 "오늘 로그인"이
 * 실제의 1% 수준으로 집계됐다(2026-09-09). day 는 KST 달력 날짜.
 */
/* 같은 IP·같은 날짜의 방문은 어차피 한 행(ON CONFLICT) — 매 요청 DB 를 때릴 이유가 없다.
 * 커넥션 풀 고갈의 상위 원인이라 메모리에서 먼저 걸러낸다(2026-09-10).
 * 단, 익명→로그인 전환은 userId 를 채워야 하므로 그때는 한 번 더 쓴다. */
const seenPageView = new Map<string, boolean>(); // key: ip|day → userId 채워졌는지
function pageViewAlreadyWritten(ip: string | null, day: string, userId: string | null): boolean {
  const key = `${ip ?? '-'}|${day}`;
  const hadUser = seenPageView.get(key);
  if (hadUser === undefined) {
    seenPageView.set(key, userId != null);
    return false;
  }
  if (!hadUser && userId != null) {
    seenPageView.set(key, true);
    return false; // 로그인 정보가 처음 붙는 순간만 한 번 더 기록
  }
  if (seenPageView.size > 20_000) seenPageView.clear();
  return true;
}


/* 행동 로그 버퍼 — 요청마다 createMany 를 던지면 커넥션이 남아나지 않는다.
 * 5초(또는 500건) 단위로 한 번에 기록한다. 유실은 통계 로그라 허용. */
interface ActionLogRow {
  type: string;
  path: string;
  target: string;
  source: MetricSource;
  userId: string | null;
  anonId: string | null;
  ip: string | null;
  ua: string | null;
  referer: string | null;
}
const actionLogBuffer: ActionLogRow[] = [];
let actionLogTimer: NodeJS.Timeout | null = null;

function flushActionLogs(): void {
  actionLogTimer = null;
  if (actionLogBuffer.length === 0) return;
  const batch = actionLogBuffer.splice(0, actionLogBuffer.length);
  prisma.actionLog.createMany({ data: batch }).catch((err) => console.error('[action-log]', err));
}

function queueActionLogs(rows: ActionLogRow[]): void {
  actionLogBuffer.push(...rows);
  if (actionLogBuffer.length >= 500) return flushActionLogs();
  if (actionLogTimer == null) {
    actionLogTimer = setTimeout(flushActionLogs, 5000);
    actionLogTimer.unref?.();
  }
}

function upsertPageView(input: {
  path: string;
  ip: string | null;
  ua: string | null;
  userId: string | null;
  country: string | null;
  referer: string | null;
  source: MetricSource;
}): void {
  const day = kstDateKey();
  if (pageViewAlreadyWritten(input.ip, day, input.userId)) return;
  prisma
    .$executeRaw`
      INSERT INTO page_views ("path", "ip", "ua", "userId", "country", "referer", "source", "day")
      VALUES (${input.path}, ${input.ip}, ${input.ua}, ${input.userId}, ${input.country}, ${input.referer}, ${input.source}, ${day}::date)
      ON CONFLICT ("ip", "day") DO UPDATE
        SET "userId" = COALESCE(page_views."userId", EXCLUDED."userId")
    `
    .catch((err) => console.error('[pageview]', err));
}

router.post('/pageview', optionalAuth, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { path?: string; referer?: string };
  const path = typeof body.path === 'string' ? body.path.slice(0, 500) : null;
  if (!path) return res.status(204).end();

  const country = (req.headers['x-vercel-ip-country'] as string | undefined) ?? null;
  const referer = body.referer?.slice(0, 500) ?? null;

  upsertPageView({
    path,
    ip: clientIp(req),
    ua: ua(req),
    userId: req.user?.userId ?? null,
    country,
    referer,
    source: resolveSource(undefined, req),
  });

  res.status(204).end();
});

router.post('/ad', optionalAuth, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { network?: string; slotId?: string };
  const network =
    typeof body.network === 'string' && ALLOWED_NETWORKS.has(body.network) ? body.network : null;
  const slotId = typeof body.slotId === 'string' ? body.slotId.slice(0, 64) : null;
  if (!network || !slotId) return res.status(204).end();

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  prisma.adEvent
    .create({
      data: {
        kind: 'impression',
        network,
        slotId,
        userId: req.user?.userId ?? null,
        ip: clientIp(req),
        ua: ua(req),
        day,
      },
    })
    .catch((err) => console.error('[ad-event]', err));

  res.status(204).end();
});

/**
 * POST /api/metrics/action — 사용자 행동(클릭/페이지이동 등) 배치 로깅.
 * body: { source?: 'web'|'mobile', anonId?: string, events: [{ type, path, target?, referer? }] }
 * 회원이면 optionalAuth 로 userId 첨부, 비회원은 anonId 로만 식별. 한 요청에 최대 50건.
 * 앱 WebView 안의 웹은 UA 토큰으로 'webview' 로 분류(어드민 행동로그 웹/앱/웹뷰 구분).
 * pageview 이벤트가 있으면 일별 고유 방문(page_views)도 함께 upsert — 앱은 /pageview 비콘을
 * 보내지 않으므로 이 경로가 앱 접속자·로그인 집계의 유일한 입구다.
 * 로깅 실패가 UX 를 막으면 안 되므로 항상 204 로 가볍게 응답한다.
 */
router.post('/action', optionalAuth, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    source?: string;
    anonId?: string;
    events?: Array<{ type?: string; path?: string; target?: string; referer?: string }>;
  };
  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length === 0) return res.status(204).end();

  const source = resolveSource(body.source, req);
  const anonId = typeof body.anonId === 'string' ? body.anonId.slice(0, 64) : null;
  const userId = req.user?.userId ?? null;
  const ip = clientIp(req);
  const agent = ua(req);

  const data = events
    .slice(0, 50)
    .map((e) => ({
      type: String(e.type ?? '').trim().slice(0, 32),
      path: String(e.path ?? '').slice(0, 500),
      target: String(e.target ?? '').slice(0, 300),
      source,
      userId,
      anonId,
      ip,
      ua: agent,
      referer: typeof e.referer === 'string' ? e.referer.slice(0, 500) : null,
    }))
    .filter((e) => e.type.length > 0);

  if (data.length > 0) queueActionLogs(data);

  const firstView = data.find((e) => e.type === 'pageview' && e.path);
  if (firstView) {
    upsertPageView({
      path: firstView.path,
      ip,
      ua: agent,
      userId,
      country: (req.headers['x-vercel-ip-country'] as string | undefined) ?? null,
      referer: firstView.referer,
      source,
    });
  }
  res.status(204).end();
});

export default router;
