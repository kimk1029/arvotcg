/**
 * 스토어 스크린샷 모드 전용 데모 데이터.
 *
 * 내 자산·마이 화면은 로그인 상태여야 렌더된다. 실계정으로 촬영하면 개인정보가
 * 스토어에 박히고, 계정 없이는 로그인 게이트만 찍힌다. SHOT 모드에서는
 * 세션을 가짜로 통과시키고([[shotMode]] + session.ts) 이 픽스처를 그대로 그린다.
 * 카드 이름·아트는 전부 자체 가상 데이터 — 제3자 IP 없음.
 */
import type {
  MyCardRow,
  MySummary,
  PortfolioSummary,
  PriceAlertRow,
} from './myApi';

const DAY = 86400_000;
/** 고정 기준일 — 매 실행 같은 차트가 나오도록 (스크린샷 재현성). */
const BASE = Date.UTC(2026, 7, 18);
const iso = (dayOffset: number) => new Date(BASE + dayOffset * DAY).toISOString().slice(0, 10);

interface DemoCard {
  name: string;
  code: string;
  num: string;
  cur: number;
  reg: number;
  graded?: boolean;
  grade?: string;
  region: string;
  series: string;
  game: string;
}

const DEMO: DemoCard[] = [
  { name: 'Ember Drake Full Art 118', code: 'SET-A3', num: '103/100', cur: 70888, reg: 41200, graded: true, grade: '10', region: 'jp', series: '오로라 리프트', game: 'pokemon' },
  { name: 'Aurora Fox Alt Art 042', code: 'SET-B7', num: '087/086', cur: 12400, reg: 9800, region: 'jp', series: '루나 워든', game: 'pokemon' },
  { name: 'Storm Falcon Holo 061', code: 'SET-C2', num: '109/098', cur: 8600, reg: 9400, region: 'jp', series: '스톰 팔콘', game: 'onepiece' },
  { name: 'Verdant Sprite 023', code: 'SET-A3', num: '045/165', cur: 5200, reg: 3100, graded: true, grade: '9', region: 'kr', series: '오로라 리프트', game: 'pokemon' },
  { name: 'Lunar Warden Foil 155', code: 'SET-D1', num: '012/072', cur: 3800, reg: 4300, region: 'jp', series: '프리즘 링스', game: 'yugioh' },
  { name: 'Crimson Wyrm 077', code: 'SET-B7', num: '158/172', cur: 2400, reg: 1900, region: 'en', series: '루나 워든', game: 'pokemon' },
  { name: 'Prism Golem Holo 009', code: 'SET-E4', num: '004/060', cur: 1900, reg: 1450, region: 'jp', series: '엠버 호라이즌', game: 'pokemon' },
];

export const SHOT_MY_CARDS: MyCardRow[] = DEMO.map((d, i) => ({
  id: 1000 + i,
  cardId: `demo-${i}`,
  ocrSetCode: d.code,
  ocrCardNumber: d.num,
  snkrdunkApparelId: 900000 + i,
  nickname: null,
  memo: null,
  gradeEstimate: null,
  centeringScore: null,
  photoUrl: null,
  createdAt: new Date(BASE - (i + 2) * 9 * DAY).toISOString(),
  snkrdunkName: d.name,
  // 이미지 URL 은 렌더 단계에서 자체 플레이스홀더로 교체된다 (shotSource).
  snkrdunkImageUrl: `shot://card/${i}`,
  latestPrice: d.cur,
  currentPriceJpy: d.cur,
  registerPriceJpy: d.reg,
  priceSingleJpy: d.cur,
  pricePsa10Jpy: d.graded ? d.cur : undefined,
  buyPrice: d.reg,
  buyCurrency: 'JPY',
  qty: 1,
  buyDate: iso(-((i + 2) * 9)),
  selfPulled: i % 3 === 0,
  graded: Boolean(d.graded),
  gradeCompany: d.graded ? 'GRADE' : null,
  gradeValue: d.grade ?? null,
  region: d.region,
  series: d.series,
  game: d.game,
  trend: [0.82, 0.85, 0.89, 0.92, 0.95, 0.98, 1].map((k) => Math.round(d.cur * k)),
}));

const TOTAL = SHOT_MY_CARDS.reduce((a, c) => a + (c.currentPriceJpy ?? 0), 0);

export const SHOT_PORTFOLIO: PortfolioSummary = {
  totalJpy: TOTAL,
  totalPsa10Jpy: Math.round(TOTAL * 1.18),
  pricedCount: SHOT_MY_CARDS.length,
  pricedPsa10Count: 2,
  totalCount: SHOT_MY_CARDS.length,
  yesterdayJpy: Math.round(TOTAL * 0.9968),
  changeAbsJpy: TOTAL - Math.round(TOTAL * 0.9968),
  changePct: 0.32,
  // 30일 추이 — 완만한 우상향에 잔물결 (실제 차트처럼 보이도록).
  history: Array.from({ length: 30 }, (_, i) => ({
    date: iso(i - 29),
    totalJpy: Math.round(TOTAL * (0.83 + (i / 29) * 0.17 + Math.sin(i / 3) * 0.012)),
  })),
  asOfDate: iso(0),
};

export const SHOT_SUMMARY: MySummary = {
  user: { id: 'demo-user', name: 'ARVO Collector', email: 'demo@arvotcg.app' },
  inventory: {
    avatar: 'default',
    avatarOwned: ['default'],
    bg: 'default',
    bgOwned: ['default'],
    frame: 'default',
    frameOwned: ['default'],
    points: 1840,
  },
  level: { level: 7, xp: 340, xpNeeded: 500, title: '컬렉터', maxLevel: 30 },
  counts: { tradeCount: 6, savedCount: 12, cardCount: SHOT_MY_CARDS.length },
};

export const SHOT_PRICE_ALERTS: PriceAlertRow[] = [
  {
    id: 'demo-alert-1',
    snkrdunkApparelId: 900001,
    targetPriceJpy: 9000,
    cardName: 'Aurora Fox Alt Art 042',
    triggeredAt: null,
    createdAt: new Date(BASE - 3 * DAY).toISOString(),
  },
  {
    id: 'demo-alert-2',
    snkrdunkApparelId: 900004,
    targetPriceJpy: 3200,
    cardName: 'Lunar Warden Foil 155',
    triggeredAt: null,
    createdAt: new Date(BASE - 11 * DAY).toISOString(),
  },
];

export const SHOT_UNREAD = 3;
