import type {
  CardItem,
  ChatMessage,
  FeedItem,
  MessageThread,
  MyProfile,
  OripaBox,
  OripaResult,
  OripaTicket,
  Place,
  ShopItem,
  Trade,
} from './types';

export const PLACES: Place[] = [
  { id: 'seongsu',  name: '성수역 부근',     emoji: '🚇', bg: '#E63946', level: 'full',   mins: 1,  count: 12 },
  { id: 'seoulsup', name: '서울숲역 부근',   emoji: '🌳', bg: '#4ADE80', level: 'empty',  mins: 3,  count: 8 },
  { id: 'secret',   name: '시크릿 포레스트', emoji: '🌲', bg: '#3A5BD9', level: 'normal', mins: 6,  count: 5 },
  { id: 'metamong', name: '메타몽 놀이터',   emoji: '🎪', bg: '#FFD23F', level: 'busy',   mins: 2,  count: 9 },
  { id: 'shoe',     name: '구두테마공원',     emoji: '👟', bg: '#FB923C', level: 'normal', mins: 14, count: 3 },
  { id: 'rainbow',  name: '무지개어린이공원', emoji: '🌈', bg: '#FAE8FF', level: 'empty',  mins: 32, count: 2 },
];

export const TRADES: Trade[] = [
  { id: 1, type: 'sell', title: '한정 프로모 코드 1장 판매합니다',     place: '성수역 부근',     time: '방금 전', price: '1.5만' },
  { id: 2, type: 'buy',  title: '한정 프로모 구해요! 서울숲 근처',     place: '서울숲역 부근',   time: '2분 전',  price: '제안' },
  { id: 3, type: 'sell', title: '프로모 + 굿즈 세트 양도 가능해요',       place: '시크릿 포레스트', time: '5분 전',  price: '2.2만' },
  { id: 4, type: 'buy',  title: '프로모만 삽니다 근처 직거래 희망',       place: '메타몽 놀이터',   time: '12분 전', price: '1만~' },
  { id: 5, type: 'sell', title: '여분 1장 정가 양도',                     place: '구두테마공원',     time: '28분 전', price: '정가' },
];

export const FEED: FeedItem[] = [
  { id: 1, place: '성수역 부근',     level: 'full',   text: '지금 줄이 역까지 이어져요… 40분은 각오!', time: '방금 전', user: '🐢' },
  { id: 2, place: '서울숲역 부근',   level: 'empty',  text: '지금 바로 받을 수 있어요! 사람 거의 없음', time: '3분 전',  user: '🦆' },
  { id: 3, place: '메타몽 놀이터',   level: 'busy',   text: '10명 정도 대기. 회전은 빠른 편',           time: '7분 전',  user: '🐿️' },
  { id: 4, place: '시크릿 포레스트', level: 'normal', text: '스탭 친절하고 대기 보통 수준',              time: '12분 전', user: '🐧' },
];

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
  cardCount: 32,
  tradeCount: 3,
  savedCount: 7,
  points: 1280,
};

export const ORIPA_BOXES: OripaBox[] = [
  { id: 'box-normal', tier: 'normal', emoji: '🎁', name: '노멀 박스',   desc: '오브 디자인 · 뱃지 조각', price: 200,  odds: '레전드 1% · 레어 15% · 노멀 84%' },
  { id: 'box-rare',   tier: 'rare',   emoji: '📦', name: '레어 박스',   desc: '프로필 프레임 · 푸시 알림권', price: 500,  odds: '레전드 5% · 레어 35% · 노멀 60%' },
  { id: 'box-legend', tier: 'legend', emoji: '💎', name: '레전드 박스', desc: '프리미엄 뱃지 · 프리미엄 스킨 보장', price: 1500, odds: '레전드 25% · 레어 50% · 노멀 25%' },
];

export const ORIPA_RESULTS: OripaResult[] = [
  { id: 1, user: '🦊', box: '레전드', reward: '골드 홀로 프레임', emoji: '🖼', tier: 'legend', time: '방금 전' },
  { id: 2, user: '🐻', box: '레어',   reward: '푸시 알림권 x3',     emoji: '📣', tier: 'rare',   time: '2분 전' },
  { id: 3, user: '🐤', box: '노멀',   reward: '오브 스킨',       emoji: '⚪', tier: 'normal', time: '5분 전' },
  { id: 4, user: '🦆', box: '레어',   reward: '프리미엄 뱃지',       emoji: '🏅', tier: 'rare',   time: '7분 전' },
  { id: 5, user: '🐢', box: '레전드', reward: '레인보우 프레임',     emoji: '🌈', tier: 'legend', time: '12분 전' },
];

function buildOripaTickets(): OripaTicket[] {
  const drawnIdx = new Set<number>();
  let seed = 13579;
  while (drawnIdx.size < 53) {
    seed = (seed * 9301 + 49297) % 233280;
    drawnIdx.add(seed % 100);
  }
  const grades = [
    { g: 'C' as const, name: '스티커 팩',     emoji: '🌟', weight: 60 },
    { g: 'B' as const, name: '오브 스킨', emoji: '⚪', weight: 25 },
    { g: 'A' as const, name: '프리미엄 뱃지', emoji: '🏅', weight: 12 },
    { g: 'S' as const, name: '골드 홀로',   emoji: '🖼', weight: 3 },
  ];
  function pick(i: number) {
    let r = (i * 31 + 17) % 100;
    for (const g of grades) {
      if (r < g.weight) return g;
      r -= g.weight;
    }
    return grades[0];
  }
  const ppl = ['🦊', '🐻', '🐤', '🦆', '🐢', '🐿️', '🐺', '🐧', '🐳', '🦁'];
  return Array.from({ length: 100 }, (_, i) => {
    const drawn = drawnIdx.has(i);
    if (!drawn) return { index: i, drawn: false };
    const g = pick(i);
    return {
      index: i,
      drawn: true,
      grade: g.g,
      prizeName: g.name,
      prizeEmoji: g.emoji,
      drawnBy: ppl[i % ppl.length],
      drawnAt: `${(i % 30) + 1}분 전`,
    };
  });
}

export const ORIPA_TICKETS = buildOripaTickets();

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'p-500',      category: 'charge', emoji: '💎', bg: '#3A5BD9', name: '포인트 500P',   desc: '소량 충전',                price: 1000 },
  { id: 'p-1200',     category: 'charge', emoji: '💠', bg: '#1B2E89', name: '포인트 1,200P', desc: '+200P 보너스',             price: 2000, tag: 'hot' },
  { id: 'p-3500',     category: 'charge', emoji: '🔷', bg: '#0D7377', name: '포인트 3,500P', desc: '+500P 보너스',             price: 5000 },
  { id: 't-priority', category: 'ticket', emoji: '🎫', bg: '#E63946', name: '우선 노출 티켓',desc: '거래글 24시간 상단 고정',  price: 300,  tag: 'new' },
  { id: 't-push',     category: 'ticket', emoji: '📣', bg: '#FB923C', name: '푸시 알림권',   desc: '내 관심 장소 1일 알림',     price: 100 },
  { id: 'sk-ball',    category: 'skin',   emoji: '⚪', bg: '#FFFFFF', name: '오브 스킨', desc: '프로필 아이콘 교체',        price: 500 },
  { id: 'sk-badge',   category: 'skin',   emoji: '🏅', bg: '#FFD23F', name: '프리미엄 뱃지', desc: '닉네임 옆 영구 표시',       price: 800,  tag: 'limited' },
  { id: 'sk-frame',   category: 'skin',   emoji: '🖼', bg: '#6B3FA0', name: '프로필 프레임', desc: '레인보우 테두리',           price: 600 },
];

export const MESSAGE_THREADS: MessageThread[] = [
  { peerId: 'u1', peerName: '갸라_도스',     peerAvatar: '🐉', lastText: '아 그 시간이면 가능해요',   lastAt: '방금 전', unread: 2 },
  { peerId: 'u2', peerName: '잉어왕초',       peerAvatar: '🐟', lastText: '거래 위치 어디로 잡을까요?', lastAt: '8분 전',  unread: 0 },
  { peerId: 'u3', peerName: '메타몽덕후',     peerAvatar: '🌀', lastText: '사진 한장만 더 부탁해요',   lastAt: '24분 전', unread: 1 },
  { peerId: 'u4', peerName: '카드수집가',     peerAvatar: '⚡', lastText: '확인 감사합니다!',           lastAt: '1시간 전', unread: 0 },
];

export const CHAT_THREAD: Record<string, ChatMessage[]> = {
  u1: [
    { id: 1, mine: false, text: '안녕하세요! 거래 가능한가요?',          time: '14:01' },
    { id: 2, mine: true,  text: '네 가능합니다! 어디서 만날까요?',        time: '14:03' },
    { id: 3, mine: false, text: '성수역 2번 출구 어떠세요?',              time: '14:05' },
    { id: 4, mine: true,  text: '좋아요. 오후 3시쯤 가능?',              time: '14:06' },
    { id: 5, mine: false, text: '아 그 시간이면 가능해요',                time: '14:07' },
  ],
  u2: [
    { id: 1, mine: false, text: '거래 위치 어디로 잡을까요?',              time: '13:50' },
  ],
  u3: [
    { id: 1, mine: false, text: '사진 한장만 더 부탁해요',                time: '13:34' },
  ],
  u4: [
    { id: 1, mine: false, text: '확인 감사합니다!',                       time: '12:58' },
  ],
};

export const CARDS: CardItem[] = [
  { id: 'karp-promo', name: 'Aurora Carp',     set: 'ARV PROMO',     price: 15000,  delta: 5,  history: [12000, 12500, 13000, 13800, 14200, 14500, 14800, 15000], owned: true, game: '포켓몬', rar: 'R',  grade: 9,    emoji: '🐟' },
  { id: 'gyara-vs',   name: 'Tidal Serpent',   set: 'BUDDY VS',       price: 32000,  delta: -2, history: [33000, 33500, 33200, 32800, 32500, 32400, 32200, 32000], owned: true, game: '포켓몬', rar: 'SR', grade: null, emoji: '🐉' },
  { id: 'liza-v',     name: 'Ember Drake',     set: 'CRIMSON DAWN', price: 78500,  delta: 12, history: [70000, 71500, 72000, 73500, 75000, 76800, 77500, 78500], owned: true, game: '포켓몬', rar: 'HR', grade: 10,   emoji: '🔥' },
  { id: 'mew-union',  name: 'Lunar Warden',   set: 'PROMO',          price: 120000, delta: 0,  history: [120000, 120000, 119500, 120000, 121000, 120500, 120000, 120000], owned: true, game: '포켓몬', rar: 'S',  grade: 10,   emoji: '🧬' },
  { id: 'pika-illu',  name: 'Aurora Fox',      set: 'ILLUSTRATION',   price: 88000,  delta: 8,  history: [80000, 81000, 82000, 83500, 85000, 86500, 87500, 88000], owned: true, game: '포켓몬', rar: 'SR', grade: 9,    emoji: '⚡' },
  { id: 'kaiba-rare', name: '카이바 슈라이',   set: 'YGO LEGEND',     price: 22000,  delta: 4,  history: [20000, 20500, 20800, 21000, 21300, 21800, 22000, 22000], owned: true, game: '유희왕', rar: 'R',  grade: null, emoji: '🐲' },
  { id: 'lufy-strw',  name: 'Storm Falcon',    set: 'SF-PROMO',       price: 41000,  delta: -1, history: [42000, 42000, 41800, 41500, 41200, 41100, 41000, 41000], owned: true, game: '원피스', rar: 'SR', grade: 8,    emoji: '🏴‍☠️' },
  { id: 'mtg-rare',   name: 'Black Lotus',     set: 'MTG LEGEND',     price: 95000,  delta: 6,  history: [90000, 91000, 92000, 92500, 93000, 94000, 94500, 95000], owned: true, game: 'MTG',    rar: 'S',  grade: null, emoji: '🌑' },
];

export const HERO_SLIDES = [
  {
    id: 'a',
    bg: '#5E0B15',
    badge: 'EVENT',
    title: '한정 프로모',
    desc: '성수 카드 페스타 한정 배포 중',
    accent: '#FFD23F',
  },
  {
    id: 'b',
    bg: '#0D7377',
    badge: 'LIVE',
    title: '실시간 혼잡도',
    desc: '트레이너들의 제보로 매장 혼잡도 확인',
    accent: '#FFE987',
  },
  {
    id: 'c',
    bg: '#6B3FA0',
    badge: 'TRADE',
    title: '카드 거래',
    desc: '근처 트레이너와 안전하게 거래해 보세요',
    accent: '#FFE987',
  },
] as const;
