import type {
  MyProfile,
  OripaBox,
  OripaMachine,
  OripaResult,
  OripaTicket,
  ShopItem,
} from './types';

export const MY_PROFILE: MyProfile = {
  name: '트레이너_24',
  avatar: '🐣',
  starter: 'bulbasaur',
  title: '레어 헌터',
  level: 7,
  maxLevel: 10,
  xp: 340,
  xpNeeded: 500,
  rating: '★★★★☆',
  cardCount: 12,
  tradeCount: 3,
  savedCount: 7,
  points: 1280,
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'p-500',     category: 'charge',  emoji: '💎', bg: '#3A5BD9', name: '포인트 500P',    desc: '소량 충전',              price: 1000 },
  { id: 'p-1200',    category: 'charge',  emoji: '💠', bg: '#1B2E89', name: '포인트 1,200P',  desc: '+200P 보너스',            price: 2000, tag: 'hot' },
  { id: 'p-3500',    category: 'charge',  emoji: '🔷', bg: '#0D7377', name: '포인트 3,500P',  desc: '+500P 보너스',            price: 5000 },
  { id: 't-priority',category: 'ticket',  emoji: '🎫', bg: '#E63946', name: '우선 노출 티켓',  desc: '거래글 24시간 상단 고정',  price: 300, tag: 'new' },
  { id: 't-push',    category: 'ticket',  emoji: '📣', bg: '#FB923C', name: '푸시 알림권',     desc: '내 관심 장소 1일 알림',    price: 100 },
  { id: 'sk-ball',   category: 'skin',    emoji: '⚪', bg: '#FFFFFF', name: '오브 스킨',   desc: '프로필 아이콘 교체',       price: 500 },
  { id: 'sk-badge',  category: 'skin',    emoji: '🏅', bg: '#FFD23F', name: '프리미엄 뱃지',   desc: '닉네임 옆 영구 표시',      price: 800, tag: 'limited' },
  { id: 'sk-frame',  category: 'skin',    emoji: '🖼', bg: '#6B3FA0', name: '프로필 프레임',   desc: '레인보우 테두리',          price: 600 },
];

export const ORIPA_BOXES: OripaBox[] = [
  {
    id: 'box-normal',
    tier: 'normal',
    emoji: '🎁',
    name: '노멀 박스',
    desc: '오브 디자인 · 뱃지 조각',
    price: 200,
    odds: '레전드 1% · 레어 15% · 노멀 84%',
  },
  {
    id: 'box-rare',
    tier: 'rare',
    emoji: '📦',
    name: '레어 박스',
    desc: '프로필 프레임 · 푸시 알림권',
    price: 500,
    odds: '레전드 5% · 레어 35% · 노멀 60%',
  },
  {
    id: 'box-legend',
    tier: 'legend',
    emoji: '💎',
    name: '레전드 박스',
    desc: '프리미엄 뱃지 · 프리미엄 스킨 보장',
    price: 1500,
    odds: '레전드 25% · 레어 50% · 노멀 25%',
  },
];

export const ORIPA_RESULTS: OripaResult[] = [
  { id: 1, user: '🦊', box: '레전드',   reward: '골드 홀로 프레임', emoji: '🖼', tier: 'legend', time: '방금 전' },
  { id: 2, user: '🐻', box: '레어',     reward: '푸시 알림권 x3',     emoji: '📣', tier: 'rare',   time: '2분 전'  },
  { id: 3, user: '🐤', box: '노멀',     reward: '오브 스킨',       emoji: '⚪', tier: 'normal', time: '5분 전'  },
  { id: 4, user: '🦆', box: '레어',     reward: '프리미엄 뱃지',       emoji: '🏅', tier: 'rare',   time: '7분 전'  },
  { id: 5, user: '🐢', box: '레전드',   reward: '레인보우 프레임',     emoji: '🌈', tier: 'legend', time: '12분 전' },
];

/* ============================================================
 * Oripa Machine — 쿠지 스타일 소개 + 티켓 현황판 mock
 * ========================================================== */

export const ORIPA_MACHINE: OripaMachine = {
  id: 'karp-premium',
  title: '프리미엄 박스',
  subtitle: '레전드 프레임 · 한정 뱃지 · 라스원상 포함',
  heroEmoji: '🐟',
  pricePerPull: 500,
  bundleCount: 10,
  bundlePrice: 4500,
  totalTickets: 100,
  remainingTickets: 47,
  prizes: [
    { id: 'pr-s1', grade: 'S',    name: '골드 홀로 프레임', emoji: '🖼', bg: '#6B3FA0', total: 1,  remaining: 1,  value: '10,000P 상당' },
    { id: 'pr-a1', grade: 'A',    name: '레인보우 프레임',     emoji: '🌈', bg: '#3A5BD9', total: 3,  remaining: 2,  value: '3,000P 상당' },
    { id: 'pr-a2', grade: 'A',    name: '프리미엄 뱃지',       emoji: '🏅', bg: '#0D7377', total: 3,  remaining: 2 },
    { id: 'pr-b1', grade: 'B',    name: '오브 스킨',       emoji: '⚪', bg: '#E63946', total: 10, remaining: 6 },
    { id: 'pr-b2', grade: 'B',    name: '황금 배지',           emoji: '🥇', bg: '#FFD23F', total: 10, remaining: 7 },
    { id: 'pr-c1', grade: 'C',    name: '푸시 알림권 ×3',      emoji: '📣', bg: '#FB923C', total: 30, remaining: 13 },
    { id: 'pr-c2', grade: 'C',    name: '스티커 팩',           emoji: '🌟', bg: '#4ADE80', total: 42, remaining: 16 },
    { id: 'pr-last', grade: 'last', name: '골드 특별상', emoji: '🏆', bg: '#FFD23F', total: 1, remaining: 1, value: '라스원 한정 · 마지막 티켓 당첨자에게 보장' },
  ],
};

/**
 * 100칸 티켓 배열 mock — remaining=47 이므로 drawn=53.
 * 고정 시드(아이덱스)로 생성해서 SSR/CSR 렌더 일치.
 */
function buildTickets(): OripaTicket[] {
  const drawnIdx = new Set<number>();
  // 고정 난수: 53개의 drawn 인덱스 (시드 기반)
  let seed = 13579;
  while (drawnIdx.size < 53) {
    seed = (seed * 9301 + 49297) % 233280;
    drawnIdx.add(seed % 100);
  }
  const grades: Array<{ g: 'S' | 'A' | 'B' | 'C'; name: string; emoji: string; weight: number }> = [
    { g: 'C', name: '스티커 팩',       emoji: '🌟', weight: 60 },
    { g: 'B', name: '오브 스킨',   emoji: '⚪', weight: 25 },
    { g: 'A', name: '프리미엄 뱃지',   emoji: '🏅', weight: 12 },
    { g: 'S', name: '골드 홀로 프레임', emoji: '🖼', weight: 3 },
  ];
  function pickGrade(i: number) {
    let r = (i * 31 + 17) % 100;
    for (const g of grades) {
      if (r < g.weight) return g;
      r -= g.weight;
    }
    return grades[0];
  }
  const names = ['🦊', '🐻', '🐤', '🦆', '🐢', '🐿️', '🐺', '🐧', '🐳', '🦁'];
  return Array.from({ length: 100 }, (_, i) => {
    const drawn = drawnIdx.has(i);
    if (!drawn) return { index: i, drawn: false };
    const g = pickGrade(i);
    return {
      index: i,
      drawn: true,
      grade: g.g,
      prizeName: g.name,
      prizeEmoji: g.emoji,
      drawnBy: names[i % names.length],
      drawnAt: `${(i % 30) + 1}분 전`,
    };
  });
}

export const ORIPA_TICKETS: OripaTicket[] = buildTickets();
