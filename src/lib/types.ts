export type TradeType = 'buy' | 'sell';

/** 거래 시 만남 장소 (지하철역, 카페 등). 페스타 혼잡도는 제거됨. */
export interface Place {
  id: string;
  name: string;
  emoji: string;
  bg: string;
}

export interface Trade {
  id: number;
  type: TradeType;
  status?: TradeStatus;
  title: string;
  place: string;
  time: string;
  price: string;
  kakaoId?: string | null;
  bumpCount?: number;
  /** 거래글에 1:1 쪽지를 보낸 unique 사용자 수 (작성자 제외) */
  chatCount?: number;
  // 작성자 정보 — 카드/상세 렌더용
  authorName?: string;
  authorEmoji?: string;   // 아바타 id (snapshot)
  authorBgId?: string;    // 배경 id (snapshot)
  authorFrameId?: string; // 프레임 id (snapshot)
  images?: string[];      // 첨부 사진 URL 배열
}

export type TradeStatus = 'open' | 'reserved' | 'done' | 'cancelled';

export interface TradeDetail extends Trade {
  body: string;
  status: TradeStatus;
  authorEmoji: string;
  authorBgId?: string;
  authorFrameId?: string;
  authorId?: string | null;
}

export interface FeedPost {
  id: number;
  text: string;
  time: string;
  createdAt: string;
  user: string;         // authorEmoji (아바타 id or 이모지)
  authorName?: string | null; // 사용자 닉네임 (FeedRow 아바타 아래 표시용)
  /** 작성자 id — 차단(신고) 기능용. null = 탈퇴/익명. */
  authorId?: string | null;
  authorBgId?: string;
  authorFrameId?: string;
  /** 글 카테고리 (shared/feedCategories.ts). null/undefined = 레거시 글 → 사진 유무로 추정. */
  category?: string | null;
  /** 첨부 사진 URL 배열. 빈 배열이거나 undefined 면 사진 없음. 펼침 시에만 렌더. */
  images?: string[];
  /** 댓글 수 (정렬·표시용). 서버 _count.comments. */
  commentCount?: number;
  /** 추천(북마크) 수 (정렬·표시용). 서버 _count.bookmarks. */
  likeCount?: number;
}

export type ShopCategory = 'charge' | 'ticket' | 'skin';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  emoji: string;
  bg: string;
  name: string;
  desc: string;
  price: number;
  tag?: 'hot' | 'new' | 'limited';
}

export type OripaTier = 'normal' | 'rare' | 'legend';

export interface OripaBox {
  id: string;
  tier: OripaTier;
  emoji: string;
  name: string;
  desc: string;
  price: number;
  odds: string;
  /** 미리보기용 상품 리스트 (가중치 → % 변환은 UI 측). DB 팩이면 채워짐. */
  prizes?: OripaBoxPrize[];
  /** 현재 100칸 중 등급별 뽑힘 현황 + 잔여. DB 팩에서만 계산됨. */
  stats?: OripaBoxStats;
}

export interface OripaBoxStats {
  total: number;
  remaining: number;
  drawn: { S: number; A: number; B: number; C: number };
}

export interface OripaBoxPrize {
  grade: 'S' | 'A' | 'B' | 'C';
  name: string;
  emoji: string;
  weight: number;
  bg?: string;
  imageUrl?: string;
}

/** 쿠지 등급 — S(잭팟) / A(상위) / B(중간) / C(기본) / last(라스원) */
export type OripaGrade = 'S' | 'A' | 'B' | 'C' | 'last';

export interface OripaPrize {
  id: string;
  grade: OripaGrade;
  name: string;
  emoji: string;
  bg: string;
  total: number;
  remaining: number;
  /** 환산가치 표기 (ex. "10,000P 상당") */
  value?: string;
}

export interface OripaMachine {
  id: string;
  title: string;
  subtitle: string;
  heroEmoji: string;
  pricePerPull: number;
  bundleCount: number;
  bundlePrice: number;
  totalTickets: number;
  remainingTickets: number;
  prizes: OripaPrize[];
}

export interface OripaTicket {
  index: number;
  drawn: boolean;
  grade?: OripaGrade;
  prizeName?: string;
  prizeEmoji?: string;
  prizeImageUrl?: string;
  drawnBy?: string;
  drawnAt?: string;
}

export interface OripaResult {
  id: number;
  user: string;
  box: string;
  reward: string;
  emoji: string;
  tier: OripaTier;
  time: string;
}

export type StarterId = 'bulbasaur' | 'charmander' | 'squirtle';

export interface MyProfile {
  name: string;
  avatar: string;
  starter: StarterId;
  title: string;
  level: number;
  maxLevel: number;
  xp: number;
  xpNeeded: number;
  rating: string;
  cardCount: number;
  tradeCount: number;
  savedCount: number;
  points: number;
}
