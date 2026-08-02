/**
 * 카드 팩 카탈로그 — 웹 + 모바일 공통.
 *
 * 양쪽 클라이언트가 같은 스니커덩크 `apparelGroupId` / `searchQuery` 로 시세를
 * 조회하도록 단일 소스에서 관리한다. 웹은 추가로 `hits[]` 큐레이션 슬롯을 쓸
 * 수 있게 optional 로 정의해 두었다.
 */

export interface CardPackHit {
  /** snkrdunk apparelId. */
  apparelId: number;
  /** UI에 보일 이름 override (없으면 snkrdunk 응답의 localizedName 사용). */
  label?: string;
}

/** 카드 게임 구분 — 생략 시 'pokemon'. 웹 시세확인의 테마별 탭 필터에 사용. */
export type CardPackGame = 'pokemon' | 'onepiece' | 'yugioh' | 'sports';

export interface CardPackMeta {
  /** 팩 코드 — 라우팅 슬러그로도 쓰임 (예: 'sv8a'). */
  code: string;
  /**
   * 공식 세트코드 표시용 (예: 'OP16') — code 가 슬러그일 뿐 세트코드가 아닌
   * 팩(원피스 등)만 지정. 포켓몬은 code 자체가 세트코드라 생략.
   * 표시할 땐 packSetCode() 를 쓸 것.
   */
  setCode?: string;
  /** 카드 게임 — 생략하면 포켓몬. 모바일은 포켓몬 팩만 노출(필터)한다. */
  game?: CardPackGame;
  /** 풀 한국어 이름. */
  name: string;
  /** 카드 상단에 짧게 표시될 한국어 라벨. */
  shortName: string;
  /** 시각적 강조용 이모지. */
  emoji: string;
  /** 카드 상단 띠 배경 색 (theme tokens 의 hex 와 일관). */
  bg: string;
  /** 일본 출시일 (YYYY-MM-DD) — 정렬/표시. */
  releasedAt?: string;
  /** snkrdunk 검색 키워드 — `hits` 가 비어있을 때 자동 채움. */
  searchQuery: string;
  /**
   * snkrdunk apparel group id — 박스별 전체 수록 싱글카드 목록 조회.
   * 모바일 `resolvePack` 같은 함수가 required 로 가정해서 호출하므로 required.
   * 그룹 id 를 모르는 팩(비포켓몬 일부)은 0 — 조회 코드가 0 을 "그룹 없음" 으로
   * 처리하고 `searchQuery` 검색 폴백으로 카드를 채운다.
   */
  apparelGroupId: number;
  /**
   * 큐레이션된 카드 (apparelId 알면 박아둠).
   * 웹 전용 슬롯 — 모바일은 비워둔다. 모바일에서도 unused field 로 type 호환.
   */
  hits?: CardPackHit[];
}

export const CARD_PACKS: CardPackMeta[] = [
  { code: 'm6', name: '스톰 에메랄다', shortName: '스톰 에메랄다', emoji: '⛈️', bg: '#059669', releasedAt: '2026-07-31', searchQuery: 'ストームエメラルダ', apparelGroupId: 3662 },
  { code: 'm5', name: '어비스아이', shortName: '어비스아이', emoji: '🌑', bg: '#312E81', releasedAt: '2026-05-22', searchQuery: 'アビスアイ', apparelGroupId: 3453 },
  { code: 'm4', name: '닌자 스피너', shortName: '닌자 스피너', emoji: '🥷', bg: '#2563EB', releasedAt: '2026-03-13', searchQuery: 'ニンジャスピナー', apparelGroupId: 3320 },
  { code: 'm3', name: '무니키스 제로', shortName: '무니키스 제로', emoji: '🧬', bg: '#7C2D12', releasedAt: '2026-01-23', searchQuery: 'ムニキスゼロ', apparelGroupId: 3259 },
  { code: 'm2a', name: 'MEGA 드림 ex', shortName: 'MEGA 드림 ex', emoji: '💫', bg: '#C026D3', releasedAt: '2025-11-28', searchQuery: 'MEGAドリームex', apparelGroupId: 3113 },
  { code: 'm2', name: '인페르노 X', shortName: '인페르노 X', emoji: '🔥', bg: '#DC2626', releasedAt: '2025-09-26', searchQuery: 'インフェルノX', apparelGroupId: 3074 },
  { code: 'm1s', name: '메가심포니아', shortName: '메가심포니아', emoji: '🎼', bg: '#DB2777', releasedAt: '2025-08-01', searchQuery: 'メガシンフォニア', apparelGroupId: 3046 },
  { code: 'm1l', name: '메가브레이브', shortName: '메가브레이브', emoji: '⚔️', bg: '#E63946', releasedAt: '2025-08-01', searchQuery: 'メガブレイブ', apparelGroupId: 3045 },
  { code: 'sv11w', name: '화이트플레어', shortName: '화이트플레어', emoji: '⚪', bg: '#475569', releasedAt: '2025-06-06', searchQuery: 'ホワイトフレア', apparelGroupId: 2914 },
  { code: 'sv11b', name: '블랙볼트', shortName: '블랙볼트', emoji: '⚫', bg: '#111827', releasedAt: '2025-06-06', searchQuery: 'ブラックボルト', apparelGroupId: 2913 },
  { code: 'sv10', name: '로켓단의 영광', shortName: '로켓단의 영광', emoji: '🚀', bg: '#991B1B', releasedAt: '2025-04-18', searchQuery: 'ロケット団の栄光', apparelGroupId: 2700 },
  { code: 'sv9a', name: '열풍의 아리나', shortName: '열풍의 아리나', emoji: '🌪️', bg: '#F97316', releasedAt: '2025-03-14', searchQuery: '熱風のアリーナ', apparelGroupId: 2621 },
  { code: 'sv9', name: '배틀 파트너즈', shortName: '배틀 파트너즈', emoji: '🤝', bg: '#3A5BD9', releasedAt: '2025-01-24', searchQuery: 'バトルパートナーズ', apparelGroupId: 2455 },
  { code: 'sv8a', name: '테라스타르 페스티벌 ex', shortName: '테라스타르 ex', emoji: '✨', bg: '#7C3AED', releasedAt: '2024-12-06', searchQuery: 'テラスタルフェスティバル', apparelGroupId: 2295 },
  { code: 'sv8', name: '슈퍼일렉트릭 브레이커', shortName: '일렉트릭 브레이커', emoji: '⚡', bg: '#FFD23F', releasedAt: '2024-10-18', searchQuery: '超電ブレイカー', apparelGroupId: 2081 },
  { code: 'sv7a', name: '낙원 드라고나', shortName: '낙원 드라고나', emoji: '🐉', bg: '#22C55E', releasedAt: '2024-09-13', searchQuery: '楽園ドラゴーナ', apparelGroupId: 1884 },
  { code: 'sv7', name: '스텔라 미라클', shortName: '스텔라 미라클', emoji: '🌌', bg: '#0D9488', releasedAt: '2024-07-19', searchQuery: 'ステラミラクル', apparelGroupId: 1469 },
  { code: 'sv6a', name: '나이트 원더러', shortName: '나이트 원더러', emoji: '🌙', bg: '#1B2E89', releasedAt: '2024-06-07', searchQuery: 'ナイトワンダラー', apparelGroupId: 1162 },
  { code: 'sv6', name: '변환의 가면', shortName: '변환의 가면', emoji: '🎭', bg: '#16A34A', releasedAt: '2024-04-26', searchQuery: '変幻の仮面', apparelGroupId: 812 },
  { code: 'sv5a', name: '크림슨 헤이즈', shortName: '크림슨 헤이즈', emoji: '🔥', bg: '#F97316', releasedAt: '2024-03-22', searchQuery: 'クリムゾンヘイズ', apparelGroupId: 739 },
  { code: 'sv5m', name: '사이버 저지', shortName: '사이버 저지', emoji: '🔷', bg: '#2563EB', releasedAt: '2024-01-26', searchQuery: 'サイバージャッジ', apparelGroupId: 611 },
  { code: 'sv5k', name: '와일드 포스', shortName: '와일드 포스', emoji: '🟤', bg: '#92400E', releasedAt: '2024-01-26', searchQuery: 'ワイルドフォース', apparelGroupId: 610 },
  { code: 'sv4a', name: '샤이니 트레저 ex', shortName: '샤이니 트레저', emoji: '💎', bg: '#0891B2', releasedAt: '2023-12-01', searchQuery: 'シャイニートレジャーex', apparelGroupId: 558 },
  { code: 'sv4m', name: '미래의 일섬', shortName: '미래의 일섬', emoji: '🤖', bg: '#4F46E5', releasedAt: '2023-10-27', searchQuery: '未来の一閃', apparelGroupId: 546 },
  { code: 'sv4k', name: '고대의 포효', shortName: '고대의 포효', emoji: '🦖', bg: '#B45309', releasedAt: '2023-10-27', searchQuery: '古代の咆哮', apparelGroupId: 545 },
  { code: 'sv3a', name: '레이징 서프', shortName: '레이징 서프', emoji: '🌊', bg: '#0284C7', releasedAt: '2023-09-22', searchQuery: 'レイジングサーフ', apparelGroupId: 520 },
  { code: 'sv3', name: '흑염의 지배자', shortName: '흑염의 지배자', emoji: '🖤', bg: '#7F1D1D', releasedAt: '2023-07-28', searchQuery: '黒炎の支配者', apparelGroupId: 504 },
  { code: 'sv2a', name: '포켓몬 카드 151', shortName: '카드 151', emoji: '1️⃣', bg: '#F59E0B', releasedAt: '2023-06-16', searchQuery: 'ポケモンカード151', apparelGroupId: 493 },
  { code: 'sv2d', name: '클레이버스트', shortName: '클레이버스트', emoji: '🌋', bg: '#A16207', releasedAt: '2023-04-14', searchQuery: 'クレイバースト', apparelGroupId: 471 },
  { code: 'sv2p', name: '스노해저드', shortName: '스노해저드', emoji: '❄️', bg: '#0EA5E9', releasedAt: '2023-04-14', searchQuery: 'スノーハザード', apparelGroupId: 470 },
  { code: 'sv1a', name: '트리플렛 비트', shortName: '트리플렛 비트', emoji: '🎵', bg: '#65A30D', releasedAt: '2023-03-10', searchQuery: 'トリプレットビート', apparelGroupId: 464 },
  { code: 'sv1v', name: '바이올렛 ex', shortName: '바이올렛 ex', emoji: '🟣', bg: '#6D28D9', releasedAt: '2023-01-20', searchQuery: 'バイオレットex', apparelGroupId: 458 },
  { code: 'sv1s', name: '스칼렛 ex', shortName: '스칼렛 ex', emoji: '🔴', bg: '#DC2626', releasedAt: '2023-01-20', searchQuery: 'スカーレットex', apparelGroupId: 457 },
  { code: 's12a', name: 'VSTAR 유니버스', shortName: 'VSTAR 유니버스', emoji: '⭐', bg: '#0F766E', releasedAt: '2022-12-02', searchQuery: 'VSTARユニバース', apparelGroupId: 1193 },
  { code: 's12', name: '패러다임 트리거', shortName: '패러다임 트리거', emoji: '🌀', bg: '#4338CA', releasedAt: '2022-10-21', searchQuery: 'パラダイムトリガー', apparelGroupId: 453 },
  { code: 's11', name: '로스트 어비스', shortName: '로스트 어비스', emoji: '🌌', bg: '#581C87', releasedAt: '2022-07-15', searchQuery: 'ロストアビス', apparelGroupId: 369 },
  { code: 's10b', name: 'Pokemon GO', shortName: 'Pokemon GO', emoji: '📍', bg: '#0369A1', releasedAt: '2022-06-17', searchQuery: 'Pokemon GO', apparelGroupId: 435 },
  { code: 's8b', name: 'VMAX 클라이맥스', shortName: 'VMAX 클라이맥스', emoji: '🏆', bg: '#BE123C', releasedAt: '2021-12-03', searchQuery: 'VMAXクライマックス', apparelGroupId: 301 },
  { code: 's6a', name: '이브이 히어로즈', shortName: '이브이 히어로즈', emoji: '🦊', bg: '#EA580C', releasedAt: '2021-05-28', searchQuery: 'イーブイヒーローズ', apparelGroupId: 450 },
  { code: 's4a', name: '샤이니 스타 V', shortName: '샤이니 스타 V', emoji: '🌟', bg: '#7C3AED', releasedAt: '2020-11-20', searchQuery: 'シャイニースターV', apparelGroupId: 1565 },

  // ── 원피스 카드게임 (웹 시세확인 테마 탭 전용 — 모바일 미노출) ──
  // apparelGroupId 는 snkrdunk /v1/apparel-groups/{id} 스캔으로 확인한 값. 0 = 검색 폴백.
  { code: 'op-kessen', setCode: 'OP16', game: 'onepiece', name: '결전의 시각', shortName: '결전의 시각', emoji: '⚔️', bg: '#B22D36', releasedAt: '2026-05-30', searchQuery: '決戦の刻', apparelGroupId: 3479 },
  { code: 'op-will', setCode: 'OP13', game: 'onepiece', name: '계승되는 의지', shortName: '계승되는 의지', emoji: '🔥', bg: '#C2410C', searchQuery: '受け継がれる意志', apparelGroupId: 0 },
  { code: 'op-island', setCode: 'OP15', game: 'onepiece', name: '신의 섬의 모험', shortName: '신의 섬 모험', emoji: '🏝️', bg: '#15803D', searchQuery: '神の島の冒険', apparelGroupId: 0 },
  { code: 'op-fist', setCode: 'OP11', game: 'onepiece', name: '신속의 주먹', shortName: '신속의 주먹', emoji: '👊', bg: '#0E7490', searchQuery: '神速の拳', apparelGroupId: 0 },
  { code: 'op-royal', setCode: 'OP10', game: 'onepiece', name: '왕족의 혈통', shortName: '왕족의 혈통', emoji: '👑', bg: '#7C2D12', releasedAt: '2024-11-29', searchQuery: '王族の血統', apparelGroupId: 2246 },
  { code: 'op-emperor', setCode: 'OP09', game: 'onepiece', name: '새로운 황제', shortName: '새로운 황제', emoji: '🏴‍☠️', bg: '#1D4ED8', releasedAt: '2024-08-30', searchQuery: '新たなる皇帝', apparelGroupId: 1782 },
  { code: 'op-newera', setCode: 'OP05', game: 'onepiece', name: '신시대의 주역', shortName: '신시대의 주역', emoji: '🌅', bg: '#DC2626', searchQuery: '新時代の主役', apparelGroupId: 0 },
  { code: 'op-best2', game: 'onepiece', name: 'CARD THE BEST vol.2', shortName: 'THE BEST v2', emoji: '🏆', bg: '#B8860B', releasedAt: '2025-07-25', searchQuery: 'ONE PIECE CARD THE BEST', apparelGroupId: 3040 },
  { code: 'op-romance', setCode: 'OP01', game: 'onepiece', name: '로맨스 던', shortName: '로맨스 던', emoji: '⛵', bg: '#0B3F70', releasedAt: '2022-07-21', searchQuery: 'ロマンスドーン', apparelGroupId: 1235 },

  // ── 유희왕 OCG ──
  { code: 'yg-chaos', game: 'yugioh', name: '카오스 오리진즈', shortName: '카오스 오리진즈', emoji: '🌀', bg: '#4C1D95', releasedAt: '2026-04-24', searchQuery: 'カオス・オリジンズ', apparelGroupId: 3422 },
  { code: 'yg-rivals', game: 'yugioh', name: '리미트오버 더 라이벌즈', shortName: '더 라이벌즈', emoji: '⚡', bg: '#1F2937', releasedAt: '2026-03-19', searchQuery: 'リミットオーバーコレクション ザ ライバルズ', apparelGroupId: 3352 },
  { code: 'yg-blazing', game: 'yugioh', name: '블레이징 도미니언', shortName: '블레이징', emoji: '🔥', bg: '#DC2626', releasedAt: '2026-01-23', searchQuery: 'ブレイジング・ドミニオン', apparelGroupId: 3264 },
  { code: 'yg-premium26', game: 'yugioh', name: '프리미엄 팩 2026', shortName: '프리미엄 2026', emoji: '💎', bg: '#B8860B', releasedAt: '2025-12-19', searchQuery: 'プレミアムパック 2026', apparelGroupId: 3231 },
  { code: 'yg-terminal3', game: 'yugioh', name: '터미널 월드 3', shortName: '터미널 월드 3', emoji: '🌐', bg: '#0F766E', releasedAt: '2025-11-21', searchQuery: 'ターミナルワールド3', apparelGroupId: 3111 },
  { code: 'yg-burst', game: 'yugioh', name: '버스트 프로토콜', shortName: '버스트 프로토콜', emoji: '💥', bg: '#2563EB', releasedAt: '2025-10-24', searchQuery: 'バースト・プロトコル', apparelGroupId: 3090 },
  { code: 'yg-phantom', game: 'yugioh', name: '팬텀 리벤저스', shortName: '팬텀 리벤저스', emoji: '👻', bg: '#581C87', releasedAt: '2025-08-22', searchQuery: 'ファントム・リベンジャーズ', apparelGroupId: 3058 },
  { code: 'yg-doom', game: 'yugioh', name: '둠 오브 디멘션즈', shortName: '둠 오브 디멘션즈', emoji: '🕳️', bg: '#111827', releasedAt: '2025-07-25', searchQuery: 'ドゥーム・オブ・ディメンションズ', apparelGroupId: 3042 },

  // ── 스포츠 (Topps/MLB — 대부분 그룹 미확인이라 검색 폴백) ──
  { code: 'sp-topps-s1', game: 'sports', name: 'Topps 시리즈1 베이스볼', shortName: 'Topps 시리즈1', emoji: '⚾', bg: '#1B5E94', searchQuery: 'トップス シリーズ1', apparelGroupId: 0 },
  { code: 'sp-ohtani', game: 'sports', name: '오타니 쇼헤이 Topps', shortName: '오타니 Topps', emoji: '🌟', bg: '#DC2626', searchQuery: '大谷翔平 トップス', apparelGroupId: 0 },
  { code: 'sp-tokyo', game: 'sports', name: 'MLB 도쿄 시리즈', shortName: 'MLB 도쿄', emoji: '🗼', bg: '#0F766E', searchQuery: 'MLB ワールドツアー 東京シリーズ', apparelGroupId: 0 },
  { code: 'sp-chrome', game: 'sports', name: 'Topps Chrome', shortName: 'Topps Chrome', emoji: '✨', bg: '#6D28D9', searchQuery: 'トップスクローム', apparelGroupId: 0 },
  { code: 'sp-wwe', game: 'sports', name: 'WWE Topps Chrome', shortName: 'WWE Chrome', emoji: '🤼', bg: '#991B1B', releasedAt: '2025-04-16', searchQuery: 'トップスクローム WWE', apparelGroupId: 2718 },
];

export function getCardPack(code: string): CardPackMeta | undefined {
  return CARD_PACKS.find((p) => p.code === code);
}

/**
 * 박스명 옆에 표시할 세트코드 — setCode 지정분(원피스 OP16 등) 우선,
 * 없으면 code 를 대문자로(포켓몬 SV11B/M2A 등). 세트코드가 아닌 커스텀 슬러그
 * (yg-, sp-, op- 접두 슬러그)는 표시하지 않도록 null.
 */
export function packSetCode(pack: Pick<CardPackMeta, 'code' | 'setCode'>): string | null {
  if (pack.setCode) return pack.setCode;
  if (/^(yg|sp|op)-/.test(pack.code)) return null;
  return pack.code.toUpperCase();
}
