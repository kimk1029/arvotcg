/**
 * 예약형 이벤트 페이지 설정 — 웹 EventReserveScreen · 앱 WebView 래퍼 · 서버 eventKey 의 공통 정본.
 *
 * 카드쇼(cardshow)와 트레이드 데이(tradeday)는 같은 화면 컴포넌트(웹 src/components/event/
 * EventReserveScreen.tsx)를 쓰되, 여기 설정으로 제목·팔레트·회차(1부/2부)·안내 박스가 달라진다.
 * 슬롯/정원/행사 정보는 DB(CardShowSlot·CardShowEvent, eventKey 로 구분)에 있고 어드민이 관리한다.
 * 예약은 행사(eventKey)당 1건 — 카드쇼와 트레이드 데이를 각각 예약할 수 있다.
 */

export type EventKey = 'cardshow' | 'tradeday';
export const EVENT_KEYS: readonly EventKey[] = ['cardshow', 'tradeday'];
export const DEFAULT_EVENT_KEY: EventKey = 'cardshow';

export function isEventKey(v: unknown): v is EventKey {
  return v === 'cardshow' || v === 'tradeday';
}

/** 회차 구분 — 시작 시각(HH:mm)이 [from, to) 에 들면 그 회차. */
export interface EventSession {
  label: string;
  /** 표시용 시간 범위 (예: "11:00 ~ 15:00"). */
  range: string;
  from: string;
  to: string;
}

/** 안내 박스 — 제목 + 불릿 + (선택) 강조 문단 + (선택) 인용 문단. */
export interface EventNoticeBox {
  title: string;
  intro?: string;
  bullets: string[];
  /** 불릿 아래 별도 강조 줄(들). */
  footnotes?: string[];
  /** '>' 인용 스타일 줄. */
  quote?: string;
}

export interface EventPageConfig {
  key: EventKey;
  /** 웹 경로 (앱 WebView 도 같은 경로를 연다). */
  path: string;
  /** 상단 헤더 / 앱 AppBar 제목. */
  header: string;
  /** 어드민에 행사 정보가 없을 때 기본값. */
  fallback: { title: string; venue: string; hours: string; badges: string[]; date: string };
  /** 로그인 게이트 문구. */
  loginNote: string;
  /** 화면 스타일 — light(카드쇼) / night(트레이드 데이, 스타일리시 다크 그라디언트). */
  theme: 'light' | 'night';
  /** 회차 구분. 비어 있으면 회차 헤더 없이 한 목록. */
  sessions: EventSession[];
  /** 슬롯 카드에 '정원 N석 · N명 예약' 보조줄을 보일지. 트레이드 데이는 시간/잔여석/상태점만. */
  showSlotMeta: boolean;
  /** 요약 카드 세 번째 통계. */
  thirdStat: { label: string; value: string };
  /** 예약·입장 안내 박스(불릿 + 맺음 강조줄). null 이면 숨김. */
  visitNotice: { bullets: string[]; footer: string } | null;
  /** 요약 카드 바로 아래 안내 박스. */
  topNotice: EventNoticeBox | null;
  /** 타임테이블 맨 아래 안내 박스. */
  bottomNotice: EventNoticeBox | null;
  /** 예약 모달의 '입장 인원' 값 (null 이면 줄 숨김). */
  partyLine: string | null;
}

/** 잔여 상태 라벨 — 매진 대신 '마감' (2026-09-08 사용자 지시, 두 이벤트 공통). */
export const SLOT_STATE_LABEL = { soldout: '마감', tight: '마감임박', open: '여유' } as const;

export const EVENT_PAGES: Record<EventKey, EventPageConfig> = {
  cardshow: {
    key: 'cardshow',
    path: '/event/cardshow',
    header: '카드쇼 사전예약',
    fallback: { title: 'ARVO 카드쇼', venue: '', hours: '', badges: ['사전예약', '무료 입장'], date: '' },
    loginNote: '카드쇼 예약은 로그인한 회원만 가능해요.',
    theme: 'light',
    sessions: [],
    showSlotMeta: true,
    thirdStat: { label: '입장 인원', value: '1인 + 동반 1인' },
    visitNotice: {
      bullets: [
        '1인 예약 시 동반 1인까지 함께 입장 가능합니다.',
        '자녀는 동반 1인 인원과 별도로 함께 입장 가능합니다.',
        '예약 시간에 방문하셔도 현장 상황에 따라 대기가 발생할 수 있습니다.',
        '사전 예약 없이 현장 방문도 가능합니다.',
        '현장 방문 고객은 도착 순서대로 순차 입장 안내드립니다.',
      ],
      footer: '원활한 이용을 위해 예약 후 방문을 권장드립니다.',
    },
    topNotice: null,
    bottomNotice: null,
    partyLine: '1인 + 동반 1인',
  },
  tradeday: {
    key: 'tradeday',
    path: '/event/tradeday',
    header: '트레이드 데이 사전예약',
    fallback: {
      title: '제 1회 트레이드 데이',
      venue: 'SNP 컴퍼니 (서울 강남구 논현동 73-39)',
      hours: '11:00 ~ 20:00',
      badges: ['사전예약', '트레이드 데이'],
      date: '2026-09-19',
    },
    loginNote: '트레이드 데이 예약은 로그인한 회원만 가능해요.',
    theme: 'night',
    sessions: [
      { label: '1부', range: '11:00 ~ 15:00', from: '11:00', to: '15:00' },
      { label: '2부', range: '15:00 ~ 20:00', from: '15:00', to: '20:00' },
    ],
    showSlotMeta: false,
    thirdStat: { label: '회차 정원', value: '30명' },
    // 카드쇼 블록과 같은 형식 — 동반 1인 규칙은 트레이드 데이(회차 정원제)에 없어 제외.
    visitNotice: {
      bullets: [
        '예약 시간에 방문하셔도 현장 상황에 따라 대기가 발생할 수 있습니다.',
        '사전 예약 없이 현장 방문도 가능합니다.',
        '현장 방문 고객은 도착 순서대로 순차 입장 안내드립니다.',
        '회차별 정원(30명) 초과 시 1부 / 2부 교대로 입장이 진행됩니다.',
      ],
      footer: '원활한 이용을 위해 예약 후 방문을 권장드립니다.',
    },
    topNotice: {
      title: '시간표 운영안내',
      intro: '행사 운영 상황에 따라 1부(11:00 ~ 15:00) / 2부(15:00 ~ 20:00)로 구분하여 운영됩니다.',
      bullets: [
        '각 회차별 정원은 30명이며, 정원 초과 시 1부 / 2부 교대 운영이 진행됩니다.',
        '1부 회원의 안전 퇴장 안내 후 2부 회원의 입장이 진행됩니다.',
        '모든 회원은 본인 회차 종료 시각까지 자유롭게 교류·교환 하시면 됩니다.',
        '장기 체류로 인한 매점매석 / 무단 판매행위는 제한되며, 참가자 전원이 돌아가며 이용할 수 있도록 운영됩니다.',
      ],
      footnotes: ['종료 안내는 현장 운영팀이 직접 안내드립니다.'],
      quote: '1부·2부에 사전 예약 참가자 및 현장 참가자 수가 여유로울 시 2부제 운영은 종료되며, 상시로 머물 수 있게 됩니다.',
    },
    bottomNotice: {
      title: '오리파 운영 안내',
      intro: '본 트레이드 데이에서는 오리파(개인제작/판매 카드 팩)를 운영하지 않습니다.',
      bullets: [
        '개인 제작 오리파는 확률 조작 등 분쟁 소지가 있어 주최 측 관리 범위 밖입니다.',
        '카드 교환 / 구매는 참가자 간 자유롭게 진행해 주세요.',
        '판매 / 재판매 행위는 제한될 수 있으며, 현장 운영팀의 안내를 따라주세요.',
      ],
    },
    partyLine: null,
  },
};

/** 슬롯 시작 시각이 속한 회차 인덱스 (-1 = 회차 없음). */
export function sessionIndexFor(config: EventPageConfig, time: string): number {
  return config.sessions.findIndex((s) => time >= s.from && time < s.to);
}
