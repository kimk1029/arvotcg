/**
 * 카드 등록 payload — POST /api/me/cards 본문을 만드는 단일 소스.
 *
 * '내 카드 등록' 화면(ManualAddForm)과 시세상세 '내 컬렉션에 추가' 팝업
 * (CardRegisterSheet)이 같은 규칙으로 저장해야 등록가·손익이 어긋나지 않는다.
 * 등록가(구매가 미입력 시 적용될 시세)의 정본은 shared/snkrdunkPrice.registerBasisJpy.
 */
import type { RegisterCardInput } from '@/components/cards/CardRegisterSheet';

/** 등록 옵션 — 사용자가 채우는 부분(카드 정보는 RegisterCardInput). */
export interface RegisterOptions {
  /** 직접 뽑은 카드 — 구입가 대신 현재시세를 기준가로. */
  selfPulled: boolean;
  /** 구입가 입력값(숫자 문자열). 빈 값이면 등록가는 서버가 시세로 채운다. */
  buyPrice: string;
  buyCurrency: 'KRW' | 'JPY';
  /** YYYY-MM-DD. 빈 값이면 null. */
  buyDate: string;
  qty: number;
  region: 'jp' | 'kr' | 'en';
  graded: boolean;
  gradeCompany: string;
  gradeValue: string;
  memo: string;
}

/** 오늘 날짜 YYYY-MM-DD (로컬). */
export function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 기본 옵션 — 스캔이 등급을 추정했으면 등급 토글을 켠 채로 시작. */
export function defaultRegisterOptions(gradeEstimate?: string | null): RegisterOptions {
  return {
    selfPulled: false,
    buyPrice: '',
    buyCurrency: 'KRW',
    buyDate: todayStr(),
    qty: 1,
    region: 'jp',
    graded: !!gradeEstimate,
    gradeCompany: 'PSA',
    gradeValue: '',
    memo: '',
  };
}

/**
 * 직접뽑기일 때 기준가로 쓸 현재시세 (JPY 우선). 등급카드는 서버가 등급 시세로
 * 등록가를 산정하므로 여기서 값을 만들지 않는다.
 */
export function selfPulledBasis(
  card: RegisterCardInput,
  o: Pick<RegisterOptions, 'selfPulled' | 'graded'>,
): { price: number; cur: 'JPY' | 'KRW' } | null {
  if (!o.selfPulled || o.graded) return null;
  if (card.currentPriceJpy != null) return { price: Math.round(card.currentPriceJpy), cur: 'JPY' };
  if (card.currentPriceKrw != null) return { price: Math.round(card.currentPriceKrw), cur: 'KRW' };
  return null;
}

/** POST /api/me/cards 본문. */
export function buildRegisterPayload(
  card: RegisterCardInput,
  o: RegisterOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    cardId: card.cardId ?? null,
    ocrSetCode: card.setCode ?? null,
    // 서버는 "025/165" 가 아니라 앞 번호만 저장한다.
    ocrCardNumber: card.cardNumber ? card.cardNumber.split('/')[0] : null,
    snkrdunkApparelId: card.snkrdunkApparelId ?? null,
    nickname: card.name ?? null,
    // 스니덩크 카드는 서버가 자체 이미지를 쓰므로 photoUrl 을 보내지 않는다.
    photoUrl: card.snkrdunkApparelId ? null : card.imageUrl ?? null,
    gradeEstimate: card.gradeEstimate ?? null,
    centeringScore: card.centeringScore ?? null,
    buyDate: o.buyDate.trim() || null,
    qty: o.qty,
    region: o.region,
    selfPulled: o.selfPulled,
  };

  if (o.selfPulled) {
    const basis = selfPulledBasis(card, o);
    if (basis) {
      payload.buyPrice = basis.price;
      payload.buyCurrency = basis.cur;
    }
  } else {
    const bp = parseInt(o.buyPrice, 10);
    if (Number.isFinite(bp) && bp > 0) {
      payload.buyPrice = bp;
      payload.buyCurrency = o.buyCurrency;
    }
  }

  if (o.graded) {
    payload.graded = true;
    if (o.gradeCompany.trim()) payload.gradeCompany = o.gradeCompany.trim();
    if (o.gradeValue.trim()) payload.gradeValue = o.gradeValue.trim();
  }
  if (o.memo.trim()) payload.memo = o.memo.trim();
  return payload;
}

/** 등록 요청. 실패하면 사용자에게 보여줄 메시지를 담아 throw. */
export async function postMyCard(payload: Record<string, unknown>): Promise<void> {
  const r = await fetch('/api/me/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (r.status === 401) throw new Error('로그인이 필요해요');
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${r.status}`);
  }
}
