import { VisitorChart } from '@/components/VisitorChart';
import { DeltaStat } from '@/components/DeltaStat';
import { HourlyChart } from '@/components/HourlyChart';
import { SignupSparkline } from '@/components/SignupSparkline';
import { RankBars } from '@/components/RankBars';
import { DonutChart } from '@/components/DonutChart';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { deviceOf, fmtDate } from '@/lib/format';
import { KST_OFFSET_MS, kstDateKey, kstDateKeyShifted, kstDayStart } from '../../../shared/kst';

const DAY_MS = 86_400_000;

/** 접속 출처 라벨 — 행동 로그 페이지와 동일. */
const SOURCE_LABEL: Record<string, string> = { web: '웹', mobile: '앱', webview: '앱(웹뷰)' };

type SourceSplit = { web: number; mobile: number; webview: number };
function splitOf(rows: Array<{ source: string; n: bigint }>): SourceSplit {
  const get = (k: string) => Number(rows.find((r) => r.source === k)?.n ?? 0);
  return { web: get('web'), mobile: get('mobile'), webview: get('webview') };
}
function splitText(sp: SourceSplit): string {
  return `웹 ${sp.web.toLocaleString()} · 앱 ${sp.mobile.toLocaleString()} · 앱(웹뷰) ${sp.webview.toLocaleString()}`;
}

export const dynamic = 'force-dynamic';

async function one<T>(p: Promise<T>, fb: T): Promise<T> {
  try { return await p; } catch (e) { console.error('[admin.dashboard]', e); return fb; }
}

async function loadStats() {
  // '오늘' 은 KST 달력일 기준 — 운영 서버(Vultr)는 UTC 라 setHours(0) 이면 09:00 KST 부터 하루로 잡혔다(2026-09-09 수정).
  const startToday = kstDayStart();
  const startYesterday = new Date(startToday.getTime() - DAY_MS);
  const start7d = new Date(startToday.getTime() - 6 * DAY_MS);
  const start14d = new Date(startToday.getTime() - 13 * DAY_MS);
  const start14dKey = kstDateKeyShifted(13);
  const yesterdayRange = { gte: startYesterday, lt: startToday };

  // 각 쿼리를 개별 try/catch — 하나 실패해도 나머지는 보여줌 (page_views/oripa_packs 테이블 미생성 시 graceful)
  const [
    users, feedsAll, feedsToday, trades, messagesAll, unread,
    viewsToday, uniqueIpsToday, uniqueUsersToday,
    topPaths, recentVisits, dailySeries,
    recentFeeds, recentUsers,
    signupsToday, signupsYesterday,
    visitorsYesterday, loginsYesterday, viewsYesterday,
    todayPageViews, signupRows,
    topClicksRaw, topSearchesRaw, topPages7dRaw, topActorsRaw,
    visitSplitRaw, loginSplitRaw, hourlyLoginsRaw,
  ] = await Promise.all([
    one(prisma.user.count(), 0),
    one(prisma.feed.count(), 0),
    one(prisma.feed.count({ where: { createdAt: { gte: startToday } } }), 0),
    one(prisma.trade.count(), 0),
    one(prisma.message.count(), 0),
    one(prisma.message.count({ where: { readAt: null } }), 0),
    one(prisma.pageView.count({ where: { createdAt: { gte: startToday } } }), 0),
    one(
      prisma.pageView.findMany({
        where: { createdAt: { gte: startToday }, ip: { not: null } },
        distinct: ['ip'],
        select: { ip: true },
      }).then((r) => r.length),
      0,
    ),
    // 오늘 로그인 = 오늘 행동 로그(웹+앱)에 찍힌 고유 회원. page_views 는 (ip,day) 1행이라 첫 방문이
    // 익명(로그인 화면)이면 userId 가 비어 실제의 1% 수준으로 나왔다(2026-09-09 수정).
    one(
      prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(DISTINCT "userId") AS n FROM action_logs
         WHERE "createdAt" >= ${startToday} AND "userId" IS NOT NULL
      `.then((r) => Number(r[0]?.n ?? 0)),
      0,
    ),
    one(
      (async () => {
        const rows = await prisma.pageView.groupBy({
          by: ['path'],
          where: { createdAt: { gte: startToday } },
          _count: { _all: true },
          orderBy: { _count: { path: 'desc' } },
          take: 10,
        });
        return rows as Array<{ path: string; _count: { _all: number } }>;
      })(),
      [] as Array<{ path: string; _count: { _all: number } }>,
    ),
    one(
      prisma.pageView.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, path: true, ip: true, ua: true, country: true, userId: true, source: true, createdAt: true },
      }),
      [] as Array<{ id: number; path: string; ip: string | null; ua: string | null; country: string | null; userId: string | null; source: string; createdAt: Date }>,
    ),
    one(
      // 방문자: (ip, day) 유니크 테이블이므로 count(*) = 일별 고유 방문자(웹+앱).
      // 로그인: 행동 로그의 KST 일별 고유 회원.
      prisma.$queryRaw<Array<{ day: Date; visitors: bigint; logins: bigint }>>`
        WITH pv AS (
          SELECT "day" AS day, count(*) AS visitors
            FROM page_views WHERE "day" >= ${start14dKey}::date GROUP BY 1
        ), al AS (
          SELECT ("createdAt" + interval '9 hours')::date AS day, count(DISTINCT "userId") AS logins
            FROM action_logs WHERE "createdAt" >= ${start14d} AND "userId" IS NOT NULL GROUP BY 1
        )
        SELECT COALESCE(pv.day, al.day) AS day,
               COALESCE(pv.visitors, 0)::bigint AS visitors,
               COALESCE(al.logins, 0)::bigint AS logins
          FROM pv FULL OUTER JOIN al ON al.day = pv.day
         ORDER BY 1 ASC
      `,
      [] as Array<{ day: Date; visitors: bigint; logins: bigint }>,
    ),
    one(
      prisma.feed.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, text: true, createdAt: true },
      }),
      [] as Array<{ id: number; text: string; createdAt: Date }>,
    ),
    one(
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true, points: true },
      }),
      [] as Array<{ id: string; name: string; createdAt: Date; points: number }>,
    ),
    // 오늘 / 어제 가입자
    one(prisma.user.count({ where: { createdAt: { gte: startToday } } }), 0),
    one(prisma.user.count({ where: { createdAt: yesterdayRange } }), 0),
    // 어제 접속 비교
    one(
      prisma.pageView.findMany({
        where: { createdAt: yesterdayRange, ip: { not: null } },
        distinct: ['ip'],
        select: { ip: true },
      }).then((r) => r.length),
      0,
    ),
    one(
      prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(DISTINCT "userId") AS n FROM action_logs
         WHERE "createdAt" >= ${startYesterday} AND "createdAt" < ${startToday} AND "userId" IS NOT NULL
      `.then((r) => Number(r[0]?.n ?? 0)),
      0,
    ),
    one(prisma.pageView.count({ where: { createdAt: yesterdayRange } }), 0),
    // 오늘 페이지뷰 원본 (시간대별 집계용)
    one(
      prisma.pageView.findMany({
        where: { createdAt: { gte: startToday } },
        select: { ip: true, userId: true, createdAt: true },
      }),
      [] as Array<{ ip: string | null; userId: string | null; createdAt: Date }>,
    ),
    // 최근 14일 가입 원본 (일별 집계용)
    one(
      prisma.user.findMany({
        where: { createdAt: { gte: start14d } },
        select: { createdAt: true },
      }),
      [] as Array<{ createdAt: Date }>,
    ),
    // ── 행동 로그 (최근 7일) ──────────────────────────────
    // 많이 클릭한 요소 (ActionLog type=click, target 별)
    one(
      prisma.actionLog.groupBy({
        by: ['target'],
        where: { type: 'click', createdAt: { gte: start7d }, target: { not: '' } },
        _count: { _all: true },
        orderBy: { _count: { target: 'desc' } },
        take: 12,
      }) as unknown as Promise<Array<{ target: string; _count: { _all: number } }>>,
      [] as Array<{ target: string; _count: { _all: number } }>,
    ),
    // 많이 검색한 검색어 (SearchLog query 별)
    one(
      prisma.searchLog.groupBy({
        by: ['query'],
        where: { createdAt: { gte: start7d }, query: { not: '' } },
        _count: { _all: true },
        orderBy: { _count: { query: 'desc' } },
        take: 12,
      }) as unknown as Promise<Array<{ query: string; _count: { _all: number } }>>,
      [] as Array<{ query: string; _count: { _all: number } }>,
    ),
    // 많이 들어간 페이지 (PageView path 별, 7일)
    one(
      prisma.pageView.groupBy({
        by: ['path'],
        where: { createdAt: { gte: start7d } },
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 12,
      }) as unknown as Promise<Array<{ path: string; _count: { _all: number } }>>,
      [] as Array<{ path: string; _count: { _all: number } }>,
    ),
    // 행동 많이 한 유저 (ActionLog userId 별, 7일)
    one(
      prisma.actionLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: start7d }, userId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 12,
      }) as unknown as Promise<Array<{ userId: string | null; _count: { _all: number } }>>,
      [] as Array<{ userId: string | null; _count: { _all: number } }>,
    ),
    // 오늘 접속자 출처 분리 (page_views.source: web/mobile/webview)
    one(
      prisma.$queryRaw<Array<{ source: string; n: bigint }>>`
        SELECT "source", count(*) AS n FROM page_views
         WHERE "createdAt" >= ${startToday} AND ip IS NOT NULL GROUP BY 1
      `,
      [] as Array<{ source: string; n: bigint }>,
    ),
    // 오늘 로그인 출처 분리 (한 회원이 웹·앱 둘 다 쓰면 양쪽에 셈)
    one(
      prisma.$queryRaw<Array<{ source: string; n: bigint }>>`
        SELECT "source", count(DISTINCT "userId") AS n FROM action_logs
         WHERE "createdAt" >= ${startToday} AND "userId" IS NOT NULL GROUP BY 1
      `,
      [] as Array<{ source: string; n: bigint }>,
    ),
    // 오늘 시간대별(KST) 로그인 고유 회원
    one(
      prisma.$queryRaw<Array<{ h: number; n: bigint }>>`
        SELECT extract(hour FROM ("createdAt" + interval '9 hours'))::int AS h, count(DISTINCT "userId") AS n
          FROM action_logs WHERE "createdAt" >= ${startToday} AND "userId" IS NOT NULL GROUP BY 1
      `,
      [] as Array<{ h: number; n: bigint }>,
    ),
  ]);

  // 행동 상위 유저의 이름/포인트 resolve
  const actorIds = topActorsRaw.map((a) => a.userId).filter((v): v is string => Boolean(v));
  const actorUsers = await one(
    prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, points: true },
    }),
    [] as Array<{ id: string; name: string; points: number }>,
  );
  const actorMap = new Map(actorUsers.map((u) => [u.id, u]));
  const topActors = topActorsRaw
    .map((a) => ({
      userId: a.userId as string,
      actions: a._count._all,
      name: actorMap.get(a.userId as string)?.name ?? '(탈퇴/미상)',
      points: actorMap.get(a.userId as string)?.points ?? 0,
    }));

  // ── 운영(모더레이션·활동) 지표 — 2차 배치 (기존 튜플 건드리지 않음) ──
  const [reportsByStatusRaw, blocksCount, cardsCount, scansToday, searchesToday, tradeByStatusRaw, recentReports, onlineRaw] =
    await Promise.all([
      one(prisma.contentReport.groupBy({ by: ['status'], _count: { _all: true } }),
        [] as Array<{ status: string; _count: { _all: number } }>),
      one(prisma.userBlock.count(), 0),
      one(prisma.userCard.count(), 0),
      one(prisma.scanLog.count({ where: { createdAt: { gte: startToday } } }), 0),
      one(prisma.searchLog.count({ where: { createdAt: { gte: startToday } } }), 0),
      one(prisma.trade.groupBy({ by: ['status'], _count: { _all: true } }),
        [] as Array<{ status: string; _count: { _all: number } }>),
      one(prisma.contentReport.findMany({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, targetType: true, targetId: true, reason: true, snapshot: true, createdAt: true },
      }), [] as Array<{ id: number; targetType: string; targetId: string; reason: string; snapshot: string | null; createdAt: Date }>),
      // 지금 활동중 — 최근 5분 내 행동 로그가 있는 사람 (/online 과 같은 기준)
      one(prisma.$queryRaw<Array<{ total: bigint; members: bigint }>>`
        SELECT count(DISTINCT COALESCE("userId", 'anon:' || COALESCE("anonId", ip, '?'))) AS total,
               count(DISTINCT "userId") AS members
          FROM action_logs WHERE "createdAt" > now() - interval '5 minutes'
      `, []),
    ]);
  const online = { total: Number(onlineRaw[0]?.total ?? 0), members: Number(onlineRaw[0]?.members ?? 0) };
  const countOf = (rows: Array<{ status: string; _count: { _all: number } }>, s: string) =>
    rows.find((r) => r.status === s)?._count._all ?? 0;

  // 회원 가입경로 분포 — 플랫폼(iOS/Android/웹/구앱)·SNS(구글/카카오/네이버/애플).
  // signupProvider 가 비어 있는 도입 전 회원은 UID 패턴으로 추정(회원 관리 페이지·deploy.yml 백필과 같은 규칙).
  const [platformMixRaw, providerMixRaw] = await Promise.all([
    one(prisma.$queryRaw<Array<{ key: string | null; n: bigint }>>`
      SELECT CASE WHEN "signupPlatform" IS NULL AND id LIKE 'apple\\_%' THEN 'ios' ELSE "signupPlatform" END AS key,
             count(*) AS n
        FROM users WHERE id NOT LIKE 'system%' GROUP BY 1`, []),
    one(prisma.$queryRaw<Array<{ key: string; n: bigint }>>`
      SELECT COALESCE("signupProvider", CASE
               WHEN id LIKE 'apple\\_%' THEN 'apple'
               WHEN id ~ '^[0-9]{1,12}$' THEN 'kakao'
               WHEN id ~ '^[0-9]{15,}$' THEN 'google'
               ELSE 'naver' END) AS key, count(*) AS n
        FROM users WHERE id NOT LIKE 'system%' GROUP BY 1`, []),
  ]);
  const mixOf = (rows: Array<{ key: string | null; n: bigint }>, key: string | null) =>
    Number(rows.find((r) => r.key === key)?.n ?? 0);
  const memberMix = {
    ios: mixOf(platformMixRaw, 'ios'),
    android: mixOf(platformMixRaw, 'android'),
    web: mixOf(platformMixRaw, 'web'),
    mobileLegacy: mixOf(platformMixRaw, 'mobile'),
    unknownPlatform: mixOf(platformMixRaw, null),
    google: mixOf(providerMixRaw, 'google'),
    kakao: mixOf(providerMixRaw, 'kakao'),
    naver: mixOf(providerMixRaw, 'naver'),
    apple: mixOf(providerMixRaw, 'apple'),
  };

  return {
    ok: true as const,
    memberMix,
    ops: {
      reportsOpen: countOf(reportsByStatusRaw, 'open'),
      reportsResolved: countOf(reportsByStatusRaw, 'resolved'),
      reportsDismissed: countOf(reportsByStatusRaw, 'dismissed'),
      blocksCount, cardsCount, scansToday, searchesToday, online,
      tradeOpen: countOf(tradeByStatusRaw, 'open'),
      tradeReserved: countOf(tradeByStatusRaw, 'reserved'),
      tradeDone: countOf(tradeByStatusRaw, 'done'),
      tradeCancelled: countOf(tradeByStatusRaw, 'cancelled'),
    },
    recentReports,
    stats: { users, feedsAll, feedsToday, trades, messagesAll, unread,
      viewsToday, uniqueIpsToday, uniqueUsersToday,
      signupsToday, signupsYesterday, visitorsYesterday, loginsYesterday, viewsYesterday,
      visitSplit: splitOf(visitSplitRaw), loginSplit: splitOf(loginSplitRaw) },
    topPaths, recentVisits, dailySeries, recentFeeds, recentUsers,
    hourly: buildHourly(todayPageViews, hourlyLoginsRaw),
    signups14: buildSignups14(signupRows),
    topClicks: topClicksRaw.map((r) => ({ label: r.target, value: r._count._all })),
    topSearches: topSearchesRaw.map((r) => ({ label: r.query, value: r._count._all })),
    topPages7d: topPages7dRaw.map((r) => ({ label: r.path, value: r._count._all })),
    topActors,
  };
}

/** 오늘 페이지뷰를 KST 24시간 버킷으로 — 시간대별 고유 IP/PV, 로그인은 행동 로그 고유 회원. */
function buildHourly(
  rows: Array<{ ip: string | null; userId: string | null; createdAt: Date }>,
  logins: Array<{ h: number; n: bigint }>,
) {
  const ipSets = Array.from({ length: 24 }, () => new Set<string>());
  const views = new Array(24).fill(0);
  for (const r of rows) {
    const h = new Date(r.createdAt.getTime() + KST_OFFSET_MS).getUTCHours();
    views[h] += 1;
    if (r.ip) ipSets[h].add(r.ip);
  }
  const loginAt = new Map(logins.map((l) => [Number(l.h), Number(l.n)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    visitors: ipSets[hour].size,
    logins: loginAt.get(hour) ?? 0,
    views: views[hour],
  }));
}

/** 최근 14일 일별 가입자 — 빈 날은 0. */
function buildSignups14(rows: Array<{ createdAt: Date }>) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = kstDateKey(r.createdAt);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const out: Array<{ day: string; signups: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const key = kstDateKeyShifted(i);
    out.push({ day: key.slice(5), signups: map.get(key) ?? 0 });
  }
  return out;
}

export default async function Page() {
  const data = await loadStats();
  const { stats, ops, memberMix, recentReports, topPaths, recentVisits, dailySeries, recentFeeds, recentUsers, hourly, signups14,
    topClicks, topSearches, topPages7d, topActors } = data;
  const appTotal = memberMix.ios + memberMix.android;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  // 14일 시리즈: DB 에 없는 날은 0 으로 채워 차트에 빈 칸 안 생기게
  const series14 = build14Days(dailySeries);

  return (
    <>
      <h1 className="admin-h1">대시보드</h1>
      <p className="admin-sub">오늘 가입·접속 현황 + 전체 운영 통계 · 오늘/어제는 KST 00시 기준, 접속자·로그인은 웹+앱 합산</p>

      <h2 style={{ fontSize: 14, color: '#475569', margin: '4px 0 10px', letterSpacing: 0.3 }}>🟢 오늘 현황 <span style={{ fontSize: 11, color: '#94A3B8' }}>(어제 대비)</span></h2>
      <div className="grid-stats">
        <Link href="/online" style={{ display: 'contents' }}>
          <Stat label="🟢 지금 활동중" value={ops.online.total} sub={`최근 5분 · 회원 ${ops.online.members.toLocaleString()} · 비회원 ${(ops.online.total - ops.online.members).toLocaleString()}`} />
        </Link>
        <DeltaStat label="오늘 가입자" value={stats.signupsToday} prev={stats.signupsYesterday} accent="#2563EB" sub="신규 회원" />
        <DeltaStat label="오늘 접속자" value={stats.uniqueIpsToday} prev={stats.visitorsYesterday} accent="#0EA5E9" sub={`고유 IP · ${splitText(stats.visitSplit)}`} />
        <DeltaStat label="오늘 로그인" value={stats.uniqueUsersToday} prev={stats.loginsYesterday} accent="#10B981" sub={`고유 유저 · ${splitText(stats.loginSplit)}`} />
        <DeltaStat label="오늘 페이지뷰" value={stats.viewsToday} prev={stats.viewsYesterday} sub="전체 PV" />
        <Stat label="오늘 검색" value={ops.searchesToday} sub="카드 검색 실행" />
        <Stat label="오늘 스캔" value={ops.scansToday} sub="카드 카메라 인식" />
      </div>

      {/* ── 회원 현황: 가입 플랫폼 · SNS 비율 ───────────────────── */}
      <h2 style={{ fontSize: 14, color: '#475569', margin: '20px 0 10px', letterSpacing: 0.3 }}>
        👥 회원 현황 <span style={{ fontSize: 11, color: '#94A3B8' }}>(전체 {stats.users.toLocaleString()}명 · 시스템 계정 제외)</span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <section className="card">
          <h2>📱 가입 플랫폼 (iOS · AOS)</h2>
          <DonutChart
            centerLabel="회원"
            slices={[
              { label: 'iOS', value: memberMix.ios, color: '#2a78d6' },
              { label: 'Android', value: memberMix.android, color: '#1baf7a' },
              { label: '웹', value: memberMix.web, color: '#eb6834' },
              { label: '앱(구버전·OS 미상)', value: memberMix.mobileLegacy, color: '#4a3aa7' },
            ]}
          />
          <div className="muted" style={{ marginTop: 10 }}>
            앱 가입 {appTotal.toLocaleString()}명 중 iOS {pct(memberMix.ios, appTotal)}% · AOS {pct(memberMix.android, appTotal)}%
            {memberMix.unknownPlatform > 0 ? ` · 가입경로 기록 없는 ${memberMix.unknownPlatform.toLocaleString()}명(컬럼 도입 전 가입)은 제외` : ''}
          </div>
        </section>
        <section className="card">
          <h2>🔑 가입 SNS</h2>
          <DonutChart
            centerLabel="회원"
            slices={[
              { label: '구글', value: memberMix.google, color: '#e34948' },
              { label: '카카오', value: memberMix.kakao, color: '#eda100' },
              { label: '네이버', value: memberMix.naver, color: '#008300' },
              { label: '애플', value: memberMix.apple, color: '#4a3aa7' },
            ]}
          />
          <div className="muted" style={{ marginTop: 10 }}>SNS 기록이 없는 회원은 UID 패턴으로 추정 · 상세는 회원 관리</div>
        </section>
      </div>

      {/* ── 운영 알림 & 상태 분포 ─────────────────────────────── */}
      <h2 style={{ fontSize: 14, color: '#475569', margin: '20px 0 10px', letterSpacing: 0.3 }}>
        🛡 운영 현황 {ops.reportsOpen > 0 ? <span style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', padding: '2px 8px', borderRadius: 999, marginLeft: 6 }}>신고 {ops.reportsOpen}건 대기</span> : <span style={{ fontSize: 11, color: '#15803D' }}>· 대기 신고 없음</span>}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <section className="card">
          <h2>🤝 거래글 상태 분포</h2>
          <DonutChart
            centerLabel="거래글"
            slices={[
              { label: '거래 중', value: ops.tradeOpen, color: '#3B82F6' },
              { label: '예약 중', value: ops.tradeReserved, color: '#F59E0B' },
              { label: '거래 완료', value: ops.tradeDone, color: '#10B981' },
              { label: '취소', value: ops.tradeCancelled, color: '#CBD5E1' },
            ]}
          />
        </section>
        <section className="card">
          <h2>🚩 신고 처리 현황</h2>
          <DonutChart
            centerLabel="신고"
            slices={[
              { label: '접수(대기)', value: ops.reportsOpen, color: '#EF4444' },
              { label: '조치됨', value: ops.reportsResolved, color: '#10B981' },
              { label: '기각', value: ops.reportsDismissed, color: '#CBD5E1' },
            ]}
          />
          <div className="muted" style={{ marginTop: 10 }}>차단 관계 {ops.blocksCount.toLocaleString()}건 · 조치는 웹 /admin/reports 에서</div>
        </section>
        <section className="card">
          <h2>⏳ 최근 접수 신고</h2>
          {recentReports.length === 0 ? (
            <div className="muted" style={{ padding: 12 }}>대기 중인 신고가 없어요 🎉</div>
          ) : (
            <table className="tbl">
              <tbody>
                {recentReports.map((r) => (
                  <tr key={r.id}>
                    <td style={{ width: 90 }}><span className="tag tag-report">{r.targetType}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.reason}</div>
                      <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{r.snapshot ?? `#${r.targetId}`}</div>
                    </td>
                    <td className="muted" style={{ width: 84, textAlign: 'right' }}>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 16, marginTop: 6 }}>
        <section className="card">
          <h2>⏰ 오늘 24시간 접속 분포</h2>
          <HourlyChart hours={hourly} />
        </section>
        <section className="card">
          <h2>🧑‍🤝‍🧑 최근 14일 가입자</h2>
          <SignupSparkline days={signups14} />
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>📈 최근 14일 방문자 · 로그인</h2>
        <VisitorChart points={series14} />
      </section>

      <h2 style={{ fontSize: 14, color: '#475569', margin: '24px 0 10px', letterSpacing: 0.3 }}>🔥 행동 로그 <span style={{ fontSize: 11, color: '#94A3B8' }}>(최근 7일)</span></h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <section className="card">
          <h2>🖱️ 많이 클릭한 요소</h2>
          <RankBars items={topClicks} color="#6366F1" empty="클릭 로그 없음" />
        </section>
        <section className="card">
          <h2>🔎 인기 검색어</h2>
          <RankBars items={topSearches} color="#0EA5E9" unit="회" empty="검색 로그 없음" />
        </section>
        <section className="card">
          <h2>📄 많이 들어간 페이지</h2>
          <RankBars items={topPages7d} color="#10B981" mono empty="방문 로그 없음" />
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>🏃 행동 많이 한 유저 (Top 12)</h2>
        {topActors.length === 0 ? (
          <div className="muted">행동 로그 없음</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>유저</th>
                <th style={{ textAlign: 'right' }}>행동 수 (7일)</th>
                <th style={{ textAlign: 'right' }}>포인트</th>
              </tr>
            </thead>
            <tbody>
              {topActors.map((u, i) => (
                <tr key={u.userId}>
                  <td className="mono" style={{ color: i < 3 ? '#6366F1' : '#94A3B8', fontWeight: 700 }}>{i + 1}</td>
                  <td>{u.name}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{u.actions.toLocaleString()}</td>
                  <td className="mono muted" style={{ textAlign: 'right' }}>{u.points.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <h2 style={{ fontSize: 14, color: '#475569', margin: '20px 0 10px', letterSpacing: 0.3 }}>📊 서비스</h2>
      <div className="grid-stats">
        <Stat label="회원" value={stats.users} />
        <Stat label="전체 피드" value={stats.feedsAll} />
        <Stat label="오늘 피드" value={stats.feedsToday} />
        <Stat label="거래글" value={stats.trades} />
        <Stat label="쪽지" value={stats.messagesAll} sub={`미읽음 ${stats.unread}건`} />
        <Stat label="컬렉션 카드" value={ops.cardsCount} sub="등록된 보유 카드" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 16, marginTop: 20 }}>
        <section className="card">
          <h2>오늘 상위 경로 (Top 10)</h2>
          {topPaths.length === 0 ? (
            <div className="muted">방문 없음</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>경로</th><th style={{ textAlign: 'right' }}>PV</th></tr></thead>
              <tbody>
                {topPaths.map((p) => (
                  <tr key={p.path}>
                    <td className="mono">{p.path}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{p._count._all.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>최근 방문 (20) <Link href="/visitors" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>전체 방문 기록 →</Link></h2>
          {recentVisits.length === 0 ? (
            <div className="muted">방문 없음</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>경로</th><th>출처</th><th>기기</th><th>회원</th><th>IP</th><th>국가</th><th>시각(KST)</th></tr></thead>
              <tbody>
                {recentVisits.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.path}</td>
                    <td><span className="tag">{SOURCE_LABEL[v.source] ?? v.source}</span></td>
                    <td>{deviceOf(v.ua)}</td>
                    <td>{v.userId ? <Link href={`/users?q=${encodeURIComponent(v.userId)}`}>{v.userId.slice(0, 10)}</Link> : <span className="muted">비회원</span>}</td>
                    <td className="mono">{v.ip ?? '-'}</td>
                    <td className="mono">{v.country ?? '-'}</td>
                    <td className="mono muted">{fmtDate(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <h2 style={{ fontSize: 14, color: '#475569', margin: '24px 0 10px', letterSpacing: 0.3 }}>🕘 최근 활동</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 16 }}>
        <section className="card">
          <h2>최근 피드 (5)</h2>
          {recentFeeds.length === 0 ? (
            <div className="muted">없음</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>#</th><th>내용</th><th>시각</th></tr></thead>
              <tbody>
                {recentFeeds.map((f) => (
                  <tr key={f.id}>
                    <td className="mono">{f.id}</td>
                    <td>{f.text.length > 40 ? f.text.slice(0, 40) + '…' : f.text}</td>
                    <td className="mono muted">{fmtDate(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>최근 가입 회원 (5)</h2>
          {recentUsers.length === 0 ? (
            <div className="muted">없음</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>이름</th><th>포인트</th><th>가입</th></tr></thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="mono">{u.points.toLocaleString()}</td>
                    <td className="mono muted">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="lbl">{label}</div>
      <div className="val">{value.toLocaleString()}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function build14Days(rows: Array<{ day: Date; visitors: bigint; logins: bigint }>) {
  const map = new Map<string, { visitors: number; logins: number }>();
  for (const r of rows) {
    const key = r.day.toISOString().slice(0, 10);
    map.set(key, { visitors: Number(r.visitors), logins: Number(r.logins) });
  }
  const out: Array<{ day: string; visitors: number; logins: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const key = kstDateKeyShifted(i);
    const v = map.get(key) ?? { visitors: 0, logins: 0 };
    out.push({ day: key.slice(5), visitors: v.visitors, logins: v.logins });
  }
  return out;
}
