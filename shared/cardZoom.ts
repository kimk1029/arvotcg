/**
 * 시세상세 카드 이미지 확대 보기 — 실물 카드 크기 정본 (웹 SnkrdunkImageZoom ↔ 앱 CardImageZoom).
 *
 * 표준 TCG 카드(포켓몬·원피스·MTG 공통) 63 × 88 mm, 모서리 반경 ≈ 3 mm.
 * 컨테이너는 실물 치수(1in = pxPerInch)로 잡되 화면을 넘지 않게 축소하고,
 * 이미지는 스니덩크 프레임의 투명 여백을 잘라 카드가 컨테이너를 꽉 채우도록 깐다.
 */
export const TCG_CARD = { widthMm: 63, heightMm: 88, cornerMm: 3 } as const;
export const MM_PER_INCH = 25.4;

/**
 * 스니덩크 카드 이미지 프레임: 가로 720×526(또는 398×291) 투명 배경, 카드가 정중앙에 높이의 ~83.8%.
 * 2026-09-08 포켓몬·원피스 16장 실측 0.835~0.842. 박스 이미지는 프레임이 달라(≈0.64) 트림하지 않는다.
 */
export const SNKRDUNK_CARD_FRAME = { aspect: 720 / 526, cardHeightFrac: 0.838 } as const;

export type CardZoomKind = 'card' | 'box';

export interface CardZoomLayout {
  /** 컨테이너(카드) 크기·모서리 */
  width: number;
  height: number;
  radius: number;
  /** 컨테이너 안에 절대 배치할 이미지 박스(컨테이너보다 크면 여백이 잘려 나감) */
  imageWidth: number;
  imageHeight: number;
  imageLeft: number;
  imageTop: number;
  /**
   * 컨테이너 크기(contain)로 그린 이미지를 가운데 기준으로 키울 배율 — 프레임 투명 여백을 밖으로
   * 밀어내 카드가 컨테이너를 꽉 채운다. (절대배치 대신 transform scale — 플랫폼별 클리핑 차이 없음)
   */
  imageScale: number;
}

export function cardZoomLayout(opts: {
  viewportWidth: number;
  viewportHeight: number;
  /** 1in 당 논리 픽셀 — RN dp/iOS pt = 160, 데스크톱 CSS px = 96 */
  pxPerInch: number;
  kind?: CardZoomKind;
  /** 좌우 최소 여백(px), 상하 안내문·닫기 버튼 몫(px) */
  marginX?: number;
  reservedY?: number;
}): CardZoomLayout {
  const { viewportWidth, viewportHeight, pxPerInch, kind = 'card', marginX = 12, reservedY = 150 } = opts;
  const maxW = Math.max(120, viewportWidth - marginX * 2);
  const maxH = Math.max(160, viewportHeight - reservedY);

  if (kind === 'box') {
    // 박스: 카드 비율 강제 없이 이미지 프레임 비율대로 화면에 맞춤.
    const aspect = SNKRDUNK_CARD_FRAME.aspect;
    const width = Math.min(maxW, maxH * aspect);
    const height = width / aspect;
    return { width, height, radius: Math.round(width * 0.02), imageWidth: width, imageHeight: height, imageLeft: 0, imageTop: 0, imageScale: 1 };
  }

  const ratio = TCG_CARD.widthMm / TCG_CARD.heightMm;
  const realW = (TCG_CARD.widthMm / MM_PER_INCH) * pxPerInch;
  const width = Math.min(realW, maxW, maxH * ratio);
  const height = width / ratio;
  const radius = width * (TCG_CARD.cornerMm / TCG_CARD.widthMm);
  // 카드 높이(= 컨테이너 높이)가 프레임 높이의 cardHeightFrac 이 되도록 이미지를 키우고 가운데 정렬.
  const imageHeight = height / SNKRDUNK_CARD_FRAME.cardHeightFrac;
  const imageWidth = imageHeight * SNKRDUNK_CARD_FRAME.aspect;
  // contain 으로 컨테이너(세로 카드 비율)에 넣으면 가로 프레임은 폭에 맞고(drawnH = W/aspect),
  // 그 안의 카드 높이 = frac·drawnH → 컨테이너 높이까지 키우는 배율.
  const drawnH = Math.min(height, width / SNKRDUNK_CARD_FRAME.aspect);
  const imageScale = height / (SNKRDUNK_CARD_FRAME.cardHeightFrac * drawnH);
  return { width, height, radius, imageWidth, imageHeight, imageLeft: (width - imageWidth) / 2, imageTop: (height - imageHeight) / 2, imageScale };
}

/** 확대 보기 하단 안내문 (웹·앱 동일) */
export const cardZoomCaption = (kind: CardZoomKind = 'card') =>
  kind === 'box' ? '탭하면 닫힘' : `실제 카드 크기 ${TCG_CARD.widthMm} × ${TCG_CARD.heightMm}mm · 탭하면 닫힘`;
