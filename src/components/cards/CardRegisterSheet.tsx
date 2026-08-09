'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startRouteTransition } from '@/components/RouteProgress';
import { registerBasisJpy } from '@/lib/snkrdunkPrice';

/** 등록 시트에 채워질 카드 정보 — 스캔/직접입력 양쪽에서 동일 형태로 넘겨준다. */
export interface RegisterCardInput {
  /** CARDS_CATALOG id (매칭된 경우). */
  cardId?: string | null;
  setCode?: string | null;
  cardNumber?: string | null;
  /** 표시용 이름 (한국어 우선). */
  name?: string | null;
  /** 일본어 원문 이름 — 검색결과 상세표시용. */
  nameJa?: string | null;
  /** 레어도 토큰 (SAR/SR/OP 리더 등) — 이름 파싱(parseCardStatics) 결과. */
  rarity?: string | null;
  /** 표시/저장용 카드 이미지. snkrdunkApparelId 가 있으면 서버가 우선 사용. */
  imageUrl?: string | null;
  snkrdunkApparelId?: number | null;
  /** 스캔 자동 추정 등급 라벨 (예: "PSA 9 (Mint)"). */
  gradeEstimate?: string | null;
  centeringScore?: number | null;
  /** 현재시세 — 자동 채움/직접뽑기 기준가. */
  currentPriceJpy?: number | null;
  currentPriceKrw?: number | null;
  /** 등급별 현재시세 (JPY) — 등급카드 등록가 미리보기용. 시세상세에서 전달. */
  gradePrices?: { single: number; psa10: number; psa9: number; psa8: number } | null;
}

const GRADE_COMPANIES = ['PSA', 'BGS', 'CGC', 'SGC', 'ARS'];

/** 오늘 날짜 YYYY-MM-DD (로컬). */
function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fmtJpy(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `¥${Math.round(v).toLocaleString()}`;
}
function fmtKrw(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `₩${Math.round(v).toLocaleString()}`;
}

/**
 * 스캔/직접입력 공통 "카드 등록" 시트.
 * 이미지·세트·번호·등급·현재시세는 자동 표시, 사용자는 구매정보/등급/직접뽑기만 채운다.
 *
 * @param redirectOnSave 저장 후 /my/cards 로 이동할지. 모달 안에서 쓸 땐 false.
 * @param onSaved 저장 성공 시 콜백 (모달 닫기 등).
 */
export function CardRegisterSheet({
  card,
  redirectOnSave = true,
  onSaved,
}: {
  card: RegisterCardInput;
  redirectOnSave?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selfPulled, setSelfPulled] = useState(false);
  const [buyPrice, setBuyPrice] = useState('');
  const [buyCurrency, setBuyCurrency] = useState<'KRW' | 'JPY'>('KRW');
  const [buyDate, setBuyDate] = useState(todayStr());
  const [qty, setQty] = useState(1);
  const [region, setRegion] = useState<'jp' | 'kr' | 'en'>('jp');
  const [graded, setGraded] = useState(!!card.gradeEstimate);
  const [gradeCompany, setGradeCompany] = useState('PSA');
  const [gradeValue, setGradeValue] = useState('');
  const [memo, setMemo] = useState('');

  const hasCurrentPrice = card.currentPriceJpy != null || card.currentPriceKrw != null;

  // 직접뽑기면 현재시세를 기준가로. (JPY 우선, 없으면 KRW)
  // 단, 등급카드는 서버가 등급 시세로 등록가를 산정하므로 여기선 제외.
  const effectiveBasis = useMemo(() => {
    if (!selfPulled || graded) return null;
    if (card.currentPriceJpy != null) return { price: Math.round(card.currentPriceJpy), cur: 'JPY' as const };
    if (card.currentPriceKrw != null) return { price: Math.round(card.currentPriceKrw), cur: 'KRW' as const };
    return null;
  }, [selfPulled, graded, card.currentPriceJpy, card.currentPriceKrw]);

  // 구매가 미입력 시 적용될 등록가 미리보기 — 서버 registerBasisJpy 와 동일 규칙.
  //  · 등급카드: PSA10/9/8 → 해당 등급 시세, 타사(BGS 등)·데이터 없음 → PSA10 → 싱글.
  //  · 싱글/직접뽑기: 현재 싱글 시세.
  const registerPreview = useMemo(() => {
    const gp = card.gradePrices;
    if (!gp) return null;
    const b = registerBasisJpy(
      { single: gp.single, psa10: gp.psa10, psa9: gp.psa9, psa8: gp.psa8, trendJpy: [] },
      { graded, gradeCompany, gradeValue },
    );
    return b.price > 0 ? b : null;
  }, [card.gradePrices, graded, gradeCompany, gradeValue]);

  const onSave = async () => {
    if (saving || saved) return;
    setErr(null);

    const payload: Record<string, unknown> = {
      cardId: card.cardId ?? null,
      ocrSetCode: card.setCode ?? null,
      ocrCardNumber: card.cardNumber ? card.cardNumber.split('/')[0] : null,
      snkrdunkApparelId: card.snkrdunkApparelId ?? null,
      nickname: card.name ?? null,
      photoUrl: card.snkrdunkApparelId ? null : card.imageUrl ?? null,
      gradeEstimate: card.gradeEstimate ?? null,
      centeringScore: card.centeringScore ?? null,
      buyDate: buyDate.trim() || null,
      qty,
      region,
      selfPulled,
    };

    if (selfPulled) {
      if (effectiveBasis) {
        payload.buyPrice = effectiveBasis.price;
        payload.buyCurrency = effectiveBasis.cur;
      }
    } else {
      const bp = parseInt(buyPrice, 10);
      if (Number.isFinite(bp) && bp > 0) {
        payload.buyPrice = bp;
        payload.buyCurrency = buyCurrency;
      }
    }

    if (graded) {
      payload.graded = true;
      if (gradeCompany.trim()) payload.gradeCompany = gradeCompany.trim();
      if (gradeValue.trim()) payload.gradeValue = gradeValue.trim();
    }
    if (memo.trim()) payload.memo = memo.trim();

    setSaving(true);
    try {
      const r = await fetch('/api/me/cards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.status === 401) {
        setErr('로그인이 필요해요');
        return;
      }
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      setSaved(true);
      onSaved?.();
      if (redirectOnSave) {
        startRouteTransition();
        router.push('/my/cards');
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cv-reg-sheet">
      {/* 카드 미리보기 — 이미지/이름/세트·번호/등급/현재시세 자동 */}
      <div className="cv-reg-preview">
        <div className="cv-reg-thumb">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt={card.name ?? '카드'} />
          ) : (
            <span style={{ fontSize: 30 }}>🃏</span>
          )}
        </div>
        <div className="cv-reg-meta">
          <div className="cv-reg-name">{card.name ?? '이름 미상'}</div>
          <div className="cv-reg-sub">
            {[card.setCode?.toUpperCase(), card.cardNumber].filter(Boolean).join(' · ') || '세트/번호 미상'}
          </div>
          {card.gradeEstimate && <div className="cv-reg-grade-auto">자동 추정 {card.gradeEstimate}</div>}
          <div className="cv-reg-price">
            현재시세 {fmtJpy(card.currentPriceJpy)}
            {card.currentPriceKrw != null && (
              <span className="cv-reg-price-krw"> · {fmtKrw(card.currentPriceKrw)}</span>
            )}
          </div>
        </div>
      </div>

      {/* 직접뽑기 */}
      <label className={`cv-reg-check${selfPulled ? ' on' : ''}`}>
        <input type="checkbox" checked={selfPulled} onChange={(e) => setSelfPulled(e.target.checked)} />
        <span>직접 뽑은 카드예요 (구입가 대신 현재시세를 기준가로)</span>
      </label>

      {/* 구입가격 — 라벨 우측 통화 토글, 인풋 안에 단위 표시 */}
      <div className="cv-reg-field">
        <div className="cv-reg-label cv-reg-label-row">
          <span>구입가격</span>
          {!selfPulled && (
            <div className="cv-cur-toggle">
              {(['KRW', 'JPY'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={buyCurrency === c ? 'on' : ''}
                  onClick={() => setBuyCurrency(c)}
                >
                  {c === 'JPY' ? '¥ 엔화' : '₩ 원화'}
                </button>
              ))}
            </div>
          )}
        </div>
        {selfPulled ? (
          <div className="cv-reg-selfprice">
            {effectiveBasis
              ? `현재시세 ${effectiveBasis.cur === 'JPY' ? fmtJpy(effectiveBasis.price) : fmtKrw(effectiveBasis.price)} 적용`
              : graded && registerPreview
                ? `${registerPreview.basis} 시세 ${fmtJpy(registerPreview.price)} 적용`
                : '현재시세 정보가 없어 기준가는 비워둡니다'}
          </div>
        ) : (
          <div className="cv-price-wrap">
            <span className="cv-price-unit">{buyCurrency === 'JPY' ? '¥' : '₩'}</span>
            <input
              className="cv-manual-input cv-price-input"
              inputMode="numeric"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={buyCurrency === 'JPY' ? '엔화 금액' : '원화 금액'}
            />
          </div>
        )}
      </div>

      {/* 구입날짜 + 수량 */}
      <div className="cv-manual-row">
        <div className="cv-reg-field">
          <div className="cv-reg-label">구입 날짜</div>
          <input
            type="date"
            className="cv-manual-input"
            value={buyDate}
            onChange={(e) => setBuyDate(e.target.value)}
          />
        </div>
        <div className="cv-reg-field">
          <div className="cv-reg-label">수량</div>
          <div className="cv-qty">
            <button type="button" className="cv-qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="cv-qty-val">{qty}</span>
            <button type="button" className="cv-qty-btn" onClick={() => setQty((q) => Math.min(999, q + 1))}>
              ＋
            </button>
          </div>
        </div>
      </div>

      {/* 발매 지역(에디션) */}
      <div className="cv-reg-field">
        <div className="cv-reg-label">발매 지역</div>
        <div className="cv-reg-companies">
          {([
            { k: 'jp', label: '일본판' },
            { k: 'kr', label: '한국판' },
            { k: 'en', label: '영문판' },
          ] as const).map((r) => (
            <button
              key={r.k}
              type="button"
              className={`cv-manual-cat-btn${region === r.k ? ' on' : ''}`}
              onClick={() => setRegion(r.k)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 등급여부 */}
      <label className={`cv-reg-check${graded ? ' on' : ''}`}>
        <input type="checkbox" checked={graded} onChange={(e) => setGraded(e.target.checked)} />
        <span>등급(그레이딩) 카드예요</span>
      </label>
      {graded && (
        <div className="cv-manual-row">
          <div className="cv-reg-field">
            <div className="cv-reg-label">등급사</div>
            <div className="cv-reg-companies">
              {GRADE_COMPANIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cv-manual-cat-btn${gradeCompany === c ? ' on' : ''}`}
                  onClick={() => setGradeCompany(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="cv-reg-field">
            <div className="cv-reg-label">등급</div>
            <div className="cv-reg-companies">
              {['10', '9', '8'].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`cv-manual-cat-btn${gradeValue === v ? ' on' : ''}`}
                  onClick={() => setGradeValue(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <input
              className="cv-manual-input"
              maxLength={6}
              value={gradeValue}
              onChange={(e) => setGradeValue(e.target.value)}
              placeholder="예) 10"
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
      )}
      {/* 구매가 미입력 시 적용될 등록가 안내 — 등급카드는 등급 시세, 싱글은 싱글 시세. */}
      {!selfPulled && !buyPrice.trim() && (
        <div className="cv-reg-selfprice">
          {registerPreview
            ? `구매가 미입력 시 ${registerPreview.basis} 시세 ${fmtJpy(registerPreview.price)}(등록 시점 기준)로 등록돼요`
            : graded
              ? '구매가 미입력 시 등급 시세(타사 등급은 PSA10 기준)로 등록돼요'
              : '구매가 미입력 시 현재 싱글 시세로 등록돼요'}
        </div>
      )}

      {/* 메모 */}
      <div className="cv-reg-field">
        <div className="cv-reg-label">메모 (선택)</div>
        <textarea
          className="cv-manual-input cv-manual-textarea"
          maxLength={500}
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="구입 경로, 보관 위치, 컨디션 등"
        />
      </div>

      {err && <div className="cv-manual-err">⚠ {err}</div>}

      <button type="button" className="cv-manual-submit" disabled={saving || saved} onClick={onSave}>
        {saved ? '✓ 컬렉션에 등록됨' : saving ? '저장 중...' : '＋ 컬렉션에 등록'}
      </button>

      {saved && (
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: 10 }}>
          <Link href="/my/cards" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
            내 컬렉션 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
