'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Panel } from '@/components/ui/Panel';
import { Price } from '@/components/Price';
import { SnkrdunkImageZoom } from '@/components/SnkrdunkImageZoom';
import { CardActions } from '@/components/CardActions';
import { KreamCompare } from '@/components/cards/KreamCompare';
import { MultiSourceKoPrice } from '@/components/cards/MultiSourceKoPrice';
import { PsaPopPanel } from '@/components/cards/PsaPopPanel';
import { downsamplePricePoints, isGradedSnkrdunkBadge } from '@/lib/snkrdunk';
import { boxHeadlineFromHistory, defaultGradeKey, gradeDisplayJpy, gradeUplift, priceChangeFromPoints, type SnkrGradeAgg } from '@/lib/snkrdunkPrice';

/**
 * 카드 시세 상세 — ARVOTCG '카드상세' 디자인 레이아웃.
 * 모든 테마 공통(색/라운드는 CSS 변수, 박스는 Panel). 데이터가 연결된 섹션은 실데이터,
 */

/** 정본 집계 타입 재수출 — 등급 집계는 shared gradeAgg 하나만 쓴다. */
export type GradeAgg = SnkrGradeAgg;

export interface TradeRow {
  price: number;
  date: string; // 한국어로 현지화된 거래일
  badge: string; // 등급/상태 라벨 (원문 기준 — 등급 필터에 사용)
}

interface Props {
  apparelId: number;
  /** 'box' 면 박스(미개봉 상품) 시세상세 — 등급(RAW/PSA)·PSA 팝·지역 비교 없이 BOX 라벨 + 세트코드. */
  kind?: 'single' | 'box';
  /** 박스 세트코드 라벨 (서버 카탈로그 보강값). */
  setCode?: string | null;
  /** 박스 소속 팩 코드 — '박스 힛카드 보러가기'(/cards/packs/{code}) 링크용. */
  packCode?: string | null;
  koName: string;
  jpName: string;
  category: string | null;
  imageUrl: string | null;
  minPrice: number;
  listingCountText: string;
  productNumber: string;
  grades: GradeAgg[];
  /**
   * 진입 시 열어둘 등급 탭 — 목록에서 `?grade=` 로 넘어온 값.
   * 목록(홈 HOT·내 컬렉션)이 보여준 가격과 첫 화면 헤드라인을 일치시킨다.
   * 해당 등급에 체결이 없으면 무시하고 기본 규칙(거래 최다 등급)을 쓴다.
   */
  initialGrade?: string | null;
  chartPoints: Array<[number, number]>;
  trades: TradeRow[];
  /** KREAM 매칭 힌트 — 콜렉터 번호. */
  kreamCardNumber?: string | null;
  /** KREAM 매칭 힌트 — 세트 코드. */
  kreamSetCode?: string | null;
  /** KREAM 매칭 힌트 — 등급 토큰. */
  kreamRarity?: string | null;
}

const GRADE_COLORS: Record<string, string> = {
  'PSA 10': 'var(--red)',
  'PSA 9': 'var(--blu)',
  'PSA 8': 'var(--pur)',
  RAW: 'var(--grn)',
};

const PSA_ANY_RE = /PSA\s*\d+/i;
function gradePredicate(key: string): (badge: string) => boolean {
  // RAW = 비등급만. PSA 외 타 등급사·"○以下" 버킷 제외(서버 집계와 동일 기준).
  if (key === 'RAW') return (b) => !isGradedSnkrdunkBadge(b);
  const n = key.replace(/[^\d]/g, '');
  const re = new RegExp(`PSA\\s*${n}\\b`, 'i');
  return (b) => re.test(b);
}

const RANGES: Array<{ label: string; days: number }> = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
  { label: '전체', days: 0 },
];

/** 등락 표시 (전일/주간). */
function Delta({ diff, pct }: { diff: number; pct: number | null }) {
  if (pct == null) return <span style={{ color: 'var(--ink3)' }}>—</span>;
  const up = diff >= 0;
  const color = up ? 'var(--red)' : 'var(--blu)';
  return (
    <span style={{ color }}>
      {up ? '+' : '−'} <Price jpy={Math.abs(diff)} /> ({up ? '+' : ''}
      {pct.toFixed(2)}%)
    </span>
  );
}

export function CardDetailView({
  apparelId,
  kind = 'single',
  setCode = null,
  packCode = null,
  koName,
  jpName,
  category,
  imageUrl,
  minPrice,
  listingCountText,
  productNumber,
  grades,
  initialGrade,
  chartPoints,
  trades,
  kreamCardNumber,
  kreamSetCode,
  kreamRarity,
}: Props) {
  const isBox = kind === 'box';
  // 목록에서 넘어온 등급이 있으면 그 탭으로 연다(목록 가격 == 첫 화면 가격).
  // 없거나 그 등급에 체결이 없으면 데이터가 가장 많은 등급(기본 규칙).
  const requested = grades.find((g) => g.key === initialGrade && g.count > 0)?.key;
  const defaultGrade = requested ?? defaultGradeKey(grades);
  const [gradeKey, setGradeKey] = useState<string>(defaultGrade);
  const [region, setRegion] = useState<string>('일본판');
  const [rangeIdx, setRangeIdx] = useState<number>(4); // 전체

  const sel = grades.find((g) => g.key === gradeKey) ?? grades[0];
  // 정본 gradeDisplayJpy — 홈 HOT·내 컬렉션 목록가와 같은 통계(최근 체결 중앙값).
  // 박스는 등급 집계 대신 전체 체결 중앙값(정본 boxHeadlineFromHistory).
  const headlinePrice = isBox ? boxHeadlineFromHistory(trades, minPrice) : gradeDisplayJpy(sel, minPrice);
  // KREAM 비교 기준 = RAW(비등급) 최근 거래가. 없으면 최저매물.
  const rawGrade = grades.find((g) => g.key === 'RAW');
  // 등급별 투자 수익률 — RAW 평균가 → PSA10 평균가 상승폭 (정본 shared gradeUplift).
  const uplift = gradeUplift(rawGrade?.avg ?? 0, grades.find((g) => g.key === 'PSA 10')?.avg ?? 0);
  const rawRecent = gradeDisplayJpy(rawGrade, minPrice);

  // 등록 팝업의 등급별 등록가 미리보기용 — PSA10/9는 집계 재사용, PSA8은 거래내역에서.
  const gradePrices = useMemo(() => {
    const pick = (key: string) => {
      const g = grades.find((x) => x.key === key);
      return g?.median || g?.avg || 0;
    };
    const psa8 = trades.find((t) => /PSA\s*8\b/i.test(t.badge))?.price ?? 0;
    return { single: rawRecent, psa10: pick('PSA 10'), psa9: pick('PSA 9'), psa8 };
  }, [grades, trades, rawRecent]);

  // 전일/주간 변동 — 전체 차트 기준 (정본 shared priceChangeFromPoints, 앱 동일).
  const change = useMemo(() => priceChangeFromPoints(chartPoints), [chartPoints]);

  // 차트 — 기간 필터 후 다운샘플.
  const chartData = useMemo(() => {
    const pts = [...chartPoints].sort((a, b) => a[0] - b[0]);
    const days = RANGES[rangeIdx].days;
    const filtered =
      days > 0 && pts.length > 0
        ? pts.filter((p) => p[0] >= pts[pts.length - 1][0] - days * 86_400_000)
        : pts;
    return downsamplePricePoints(filtered.length >= 2 ? filtered : pts);
  }, [chartPoints, rangeIdx]);

  // 최근 거래내역 — 선택 등급으로 필터(빈 등급이면 전체 표시).
  const filteredTrades = useMemo(() => {
    if (isBox) return trades.slice(0, 20);
    const pred = gradePredicate(gradeKey);
    const m = trades.filter((t) => pred(t.badge));
    return (m.length > 0 ? m : trades).slice(0, 20);
  }, [trades, gradeKey, isBox]);

  // 거래가 있는 등급만 — 거래내역 등급 토글 노출용(PSA10·RAW 등 전환).
  const tradeGrades = useMemo(() => grades.filter((g) => g.count > 0), [grades]);
  // 헤드라인 위 등급 전환 탭 — 체결이 있는 등급만. 선택 상태는 아래 등급 카드와 공유.
  const headlineTabs = tradeGrades;

  return (
    <>
      {/* ── HERO ───────────────────────────────────────────── */}
      <div style={{ padding: '4px var(--gap) 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <SnkrdunkImageZoom src={imageUrl} alt={koName} width={188} height={262} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 18, fontWeight: 900, color: 'var(--ink)', letterSpacing: 0.3, lineHeight: 1.3, wordBreak: 'keep-all' }}>
            {koName}
          </div>
          {jpName && jpName !== koName && (
            <div style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink3)', marginTop: 5, letterSpacing: 0.2 }}>
              {jpName}
            </div>
          )}
        </div>

        {/* 태그 칩 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
          <Chip>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', flex: 'none' }} />
            일본판
          </Chip>
          {(isBox || category) && (
            <span
              style={{
                fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800, color: 'var(--white)',
                background: 'var(--pur)', padding: '6px 12px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
              }}
            >
              {isBox ? 'BOX' : category}
            </span>
          )}
          {/* 박스: 상품번호 대신 소속 세트코드 라벨 */}
          {isBox ? (setCode && <Chip muted>{setCode.toUpperCase()}</Chip>) : (productNumber && <Chip muted>{productNumber}</Chip>)}
          {/* 박스 → 수록 카드(힛카드) 목록 = 시세확인의 해당 박스 페이지(/cards/packs/{code}). 앱 동일. */}
          {isBox && packCode && (
            <Link
              href={`/cards/packs/${packCode}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800,
                color: 'var(--pur)', background: 'var(--pap2)', padding: '6px 11px', borderRadius: 'var(--r-pill)',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              {setCode ? `${setCode.toUpperCase()} ` : ''}힛카드 →
            </Link>
          )}
        </div>

        {/* 가격 박스 */}
        <Panel style={{ marginTop: 16, padding: 18 }}>
          {/* 헤드라인 등급 탭 — 목록에서 넘어온 기준이 기본 선택. 바로 옆에서 RAW ↔ PSA 10
              을 전환할 수 있어야 한다는 요구. 체결이 있는 등급만 노출(빈 탭 방지). */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 700, color: 'var(--ink3)', flex: 'none' }}>
              최근 체결가{isBox || headlineTabs.length > 1 ? '' : ` (${gradeKey})`}
            </div>
            {!isBox && headlineTabs.length > 1 && (
              <div style={{ display: 'flex', gap: 3, background: 'var(--pap2)', borderRadius: 'var(--r-pill)', padding: 3, overflowX: 'auto' }}>
                {headlineTabs.map((g) => {
                  const on = g.key === gradeKey;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGradeKey(g.key)}
                      style={{
                        flex: 'none', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                        borderRadius: 'var(--r-pill)', padding: '5px 11px',
                        fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800,
                        background: on ? (GRADE_COLORS[g.key] ?? 'var(--ink)') : 'transparent',
                        color: on ? 'var(--white)' : 'var(--ink3)',
                      }}
                    >
                      {g.key}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 28, fontWeight: 900, color: 'var(--ink)', letterSpacing: 0.2, marginTop: 4 }}>
            <Price jpy={headlinePrice} empty="—" autoSizeBase={28} autoSizeMin={16} />
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--pap3)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>전일 대비</div>
              <div style={{ fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 800, marginTop: 5 }}>
                <Delta diff={change.prevDiff} pct={change.prevPct} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>7일 변동률</div>
              <div style={{ fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 800, marginTop: 5 }}>
                <Delta diff={change.wkDiff} pct={change.wkPct} />
              </div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', marginTop: 12, letterSpacing: 0.2 }}>
            최저매물 <Price jpy={minPrice} empty="—" />
            {listingCountText ? ` · 매물 ${listingCountText}건` : ''}
          </div>
        </Panel>
      </div>

      {/* ── 액션 ───────────────────────────────────────────── */}
      <div style={{ height: 12 }} />
      <CardActions
        apparelId={apparelId}
        cardName={koName}
        imageUrl={imageUrl}
        currentPriceJpy={(isBox ? headlinePrice : rawRecent) || minPrice || null}
        gradePrices={isBox ? null : gradePrices}
      />


      {/* 박스는 지역 탭·한국판 비교 없음(등급/카드번호 매칭 기반) */}
      {!isBox && (
      <>
      {/* ── 지역 탭 (일본판 스니덩크 / 한국판 멀티소스) ───────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '6px var(--gap) 0', borderBottom: '1px solid var(--pap3)' }}>
        {['일본판', '한국판'].map((r) => {
          const ready = true;
          const active = region === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => ready && setRegion(r)}
              disabled={!ready}
              style={{
                background: 'none', border: 'none', cursor: ready ? 'pointer' : 'default',
                padding: '9px 8px 12px', marginBottom: -1,
                fontFamily: 'var(--f1)', fontSize: 13, fontWeight: active ? 800 : 600,
                color: active ? 'var(--ink)' : 'var(--ink3)', opacity: ready ? 1 : 0.5,
                borderBottom: `2.5px solid ${active ? 'var(--ink)' : 'transparent'}`, whiteSpace: 'nowrap',
              }}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* 한국판 — 멀티소스 체결/판매가 집계 (코드+번호+등급 매칭) */}
      {region === '한국판' && (
        <MultiSourceKoPrice
          name={koName}
          setCode={kreamSetCode}
          cardNumber={kreamCardNumber}
          rarity={kreamRarity}
        />
      )}

      {/* 일본판 — SNKRDUNK 등급·차트·거래내역 */}
      </>
      )}

      {region === '일본판' && (
        <>
      {!isBox && (
      <>
      {/* ── 등급 카드 (가로 스크롤) ─────────────────────────── */}
      <div className="hrow" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px var(--gap) 6px' }}>
        {grades.map((g) => {
          const isSel = g.key === gradeKey;
          const c = GRADE_COLORS[g.key] ?? 'var(--ink)';
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setGradeKey(g.key)}
              style={{
                flex: 'none', width: 168, textAlign: 'left', cursor: 'pointer',
                background: 'var(--white)', padding: 15,
                border: `2px solid ${isSel ? c : 'var(--pap3)'}`, borderRadius: 'var(--r)',
              }}
            >
              <span style={{ display: 'inline-block', fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800, color: 'var(--white)', background: c, padding: '4px 10px', borderRadius: 'var(--r-sm)' }}>
                {g.key}
              </span>
              <div style={{ fontFamily: 'var(--f1)', fontSize: 19, fontWeight: 900, color: 'var(--ink)', marginTop: 11 }}>
                <Price jpy={g.median} empty="—" autoSizeBase={19} autoSizeMin={12} />
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <GradeRow label="최근 체결" value={<Price jpy={g.recent} empty="—" />} />
                <GradeRow label="평균가" value={<Price jpy={g.avg} empty="—" />} />
                <GradeRow label="최근 최저" value={<Price jpy={g.low} empty="—" />} />
                <GradeRow label="거래 건수" value={g.count > 0 ? `${g.count}건` : '—'} />
                <GradeRow
                  label="최저매물"
                  value={g.key === 'RAW' ? <Price jpy={minPrice} empty="—" /> : '—'}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── PSA 인구 리포트 (등급별 pop — cert 1회 등록 후 공유) ── */}
      <PsaPopPanel setCode={kreamSetCode} cardNumber={kreamCardNumber} />

      {/* ── 시세 비교 (SNKRDUNK vs 크림) ────────────────────── */}
      <KreamCompare
        query={koName}
        snkrPriceJpy={rawRecent}
        cardNumber={kreamCardNumber}
        setCode={kreamSetCode}
        rarity={kreamRarity}
      />

      </>
      )}

      {/* ── 가격 추이 (실데이터 + 기간 탭) ───────────────────── */}
      <div className="sect">
        <div className="sect-hd">
          <h2>가격 추이</h2>
          <span className="more">{RANGES[rangeIdx].label}</span>
        </div>
        <div className="hrow" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10 }}>
          {RANGES.map((r, i) => {
            const active = i === rangeIdx;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setRangeIdx(i)}
                style={{
                  flex: 'none', whiteSpace: 'nowrap', fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 700,
                  padding: '7px 14px', borderRadius: 'var(--r-pill)', cursor: 'pointer', border: 'none',
                  background: active ? 'var(--ink)' : 'var(--pap2)', color: active ? 'var(--white)' : 'var(--ink3)',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <Panel style={{ padding: 14 }}>
          <MiniChart points={chartData} />
        </Panel>
      </div>

      {/* ── 최근 거래 내역 (실데이터, 등급 전환) ─────────────── */}
      <div className="sect">
        <div className="sect-hd">
          <h2>최근 거래 내역</h2>
          <span className="more">{filteredTrades.length}건</span>
        </div>
        {/* 등급 토글 — 거래가 있는 등급(PSA10/RAW 등)만 노출, 바꿔서 볼 수 있게. */}
        {!isBox && tradeGrades.length > 1 && (
          <div className="hrow" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10 }}>
            {tradeGrades.map((g) => {
              const active = g.key === gradeKey;
              const c = GRADE_COLORS[g.key] ?? 'var(--ink)';
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGradeKey(g.key)}
                  style={{
                    flex: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
                    fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800, letterSpacing: 0.2,
                    padding: '6px 13px', borderRadius: 'var(--r-pill)',
                    border: `1.5px solid ${active ? c : 'var(--pap3)'}`,
                    background: active ? c : 'transparent',
                    color: active ? 'var(--white)' : 'var(--ink3)',
                  }}
                >
                  {g.key} · {g.count}건
                </button>
              );
            })}
          </div>
        )}
        <Panel style={{ padding: '6px 14px' }}>
          {filteredTrades.length > 0 ? (
            filteredTrades.map((t, i, arr) => {
              const isPsa = PSA_ANY_RE.test(t.badge);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--pap3)' : 'none',
                  }}
                >
                  <span
                    style={{
                      flex: 'none', minWidth: 52, textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 9, fontWeight: 700,
                      padding: '3px 6px', borderRadius: 'var(--r-sm)',
                      background: isPsa ? 'var(--gold-soft,var(--pap2))' : 'var(--pap2)',
                      color: isPsa ? 'var(--gold-dk)' : 'var(--ink3)',
                    }}
                  >
                    {t.badge || '일반'}
                  </span>
                  <span style={{ flex: 1, fontFamily: 'var(--f1)', fontSize: 14, fontWeight: 800, color: i === 0 ? 'var(--red)' : 'var(--ink)' }}>
                    <Price jpy={t.price} empty="—" />
                  </span>
                  <span style={{ flex: 'none', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>{t.date}</span>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>
              거래내역이 없습니다
            </div>
          )}
        </Panel>
      </div>

      {!isBox && (
      <>
      {/* ── 등급별 투자 수익률 — RAW 평균가 → PSA10 평균가 상승폭 (정본 shared gradeUplift) ── */}
      <div className="sect">
        <div className="sect-hd">
          <h2>등급별 투자 수익률</h2>
          <span className="more">RAW → PSA 10</span>
        </div>
        <Panel style={{ padding: 16 }}>
          {uplift ? (
            <>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                <div style={{ flex: 1, background: 'var(--pap2)', borderRadius: 'var(--r-sm, 0px)', padding: '10px 12px' }}>
                  <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', fontWeight: 700 }}>RAW 평균가</div>
                  <div style={{ fontFamily: 'var(--f1)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginTop: 5 }}>
                    <Price jpy={uplift.rawAvg} />
                  </div>
                </div>
                <div style={{ alignSelf: 'center', fontFamily: 'var(--f1)', fontSize: 15, color: 'var(--ink3)', flex: 'none' }}>→</div>
                <div style={{ flex: 1, background: 'var(--gold-soft, var(--pap2))', borderRadius: 'var(--r-sm, 0px)', padding: '10px 12px' }}>
                  <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--gold-dk, var(--ink3))', fontWeight: 700 }}>PSA 10 평균가</div>
                  <div style={{ fontFamily: 'var(--f1)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginTop: 5 }}>
                    <Price jpy={uplift.psa10Avg} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', fontWeight: 600 }}>그레이딩 상승폭</span>
                <span style={{ fontFamily: 'var(--f1)', fontSize: 16, fontWeight: 900, color: uplift.diff >= 0 ? 'var(--red)' : 'var(--blu)' }}>
                  {uplift.diff >= 0 ? '+' : '−'}<Price jpy={Math.abs(uplift.diff)} /> ({uplift.diff >= 0 ? '+' : ''}{uplift.pct.toFixed(1)}%)
                </span>
              </div>
              <div style={{ marginTop: 8, fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', lineHeight: 1.5 }}>
                최근 거래 평균 기준 단순 시세차 — 그레이딩 비용·수수료·기간은 반영되지 않아요.
              </div>
            </>
          ) : (
            <div style={{ padding: '18px 0', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>
              RAW·PSA 10 거래 데이터가 모두 있어야 계산할 수 있어요
            </div>
          )}
        </Panel>
      </div>
      </>
      )}
        </>
      )}


    </>
  );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
        fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 700,
        color: muted ? 'var(--ink3)' : 'var(--ink)', background: 'var(--pap2)',
        padding: '6px 12px', borderRadius: 'var(--r-pill)',
      }}
    >
      {children}
    </span>
  );
}

function GradeRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
      <span style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

/** SVG 라인 차트 — Y축 눈금 라벨 + 호버 툴팁/가이드. 테마 색(var) 사용. */
function MiniChart({ points }: { points: Array<[number, number]> }) {
  const [hover, setHover] = useState<number | null>(null);
  const { theme } = useTheme();
  // 픽셀 폰트(pokemon·sports)는 폭이 넓어 Y축 라벨이 컨테이너 밖으로 나간다 → -2pt.
  const axisFont = theme === 'pokemon' || theme === 'sports' ? 6.5 : 8.5;

  if (points.length < 2) {
    return (
      <div style={{ height: 184, display: 'grid', placeItems: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>
        시세 이력이 부족합니다
      </div>
    );
  }
  const W = 800;
  const H = 184;
  const PAD_T = 14;
  const PAD_B = 14;
  const innerH = H - PAD_T - PAD_B;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const rangeX = maxX - minX || 1;
  const xOf = (v: number) => (rangeX === 0 ? 0 : ((v - minX) / rangeX) * W);
  const yOf = (v: number) => PAD_T + (1 - (v - minY) / rangeY) * innerH;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p[0]).toFixed(1)},${yOf(p[1]).toFixed(1)}`).join(' ');
  const area = `${line} L${xOf(maxX).toFixed(1)},${PAD_T + innerH} L${xOf(minX).toFixed(1)},${PAD_T + innerH} Z`;
  const up = ys[ys.length - 1] >= ys[0];
  const color = up ? 'var(--red)' : 'var(--blu)';
  const fmtDate = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  // Y축 눈금 (위=최고 → 아래=최저).
  const TICKS = [0, 0.25, 0.5, 0.75, 1];
  const tickValue = (t: number) => maxY - t * rangeY;

  // 호버 — 마우스/터치 X → 가장 가까운 데이터 인덱스.
  const n = points.length;
  const pickX = (clientX: number, rect: DOMRect) => {
    const rel = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
    setHover(Math.round(rel * (n - 1)));
  };
  const hp = hover != null ? points[hover] : null;
  const hxPct = hp ? (hover! / (n - 1)) * 100 : 0;
  const hyPx = hp ? yOf(hp[1]) : 0; // viewBox y == px (SVG 높이 H 고정)
  const tipFlip = hxPct > 58;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Y축 라벨 */}
        <div style={{ position: 'relative', width: 48, height: H, flex: 'none' }}>
          {TICKS.map((t) => (
            <div
              key={t}
              style={{
                position: 'absolute', right: 6, top: PAD_T + t * innerH, transform: 'translateY(-50%)',
                fontFamily: 'var(--f1)', fontSize: axisFont, color: 'var(--ink3)', whiteSpace: 'nowrap', letterSpacing: 0.2,
              }}
            >
              <Price jpy={tickValue(t)} />
            </div>
          ))}
        </div>

        {/* 차트 영역 */}
        <div
          style={{ position: 'relative', flex: 1, height: H, cursor: 'crosshair' }}
          onMouseMove={(e) => pickX(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => e.touches[0] && pickX(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => e.touches[0] && pickX(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        >
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }} aria-label="가격 추이 차트">
            {TICKS.map((t) => (
              <line key={t} x1={0} y1={PAD_T + t * innerH} x2={W} y2={PAD_T + t * innerH} stroke="var(--pap3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <defs>
              <linearGradient id="cdArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#cdArea)" />
            <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={xOf(maxX)} cy={yOf(ys[ys.length - 1])} r="4" fill={color} stroke="var(--white)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* 호버 가이드 + 점 + 툴팁 (HTML 오버레이) */}
          {hp && (
            <>
              <div style={{ position: 'absolute', left: `${hxPct}%`, top: 0, bottom: 0, width: 1, background: 'var(--ink3)', opacity: 0.45, transform: 'translateX(-0.5px)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: `${hxPct}%`, top: hyPx, width: 9, height: 9, borderRadius: '50%', background: color, border: '2px solid var(--white)', transform: 'translate(-50%, -50%)', pointerEvents: 'none', boxShadow: '0 0 0 1px var(--pap3)' }} />
              <div
                style={{
                  position: 'absolute', left: `${hxPct}%`, top: 2,
                  transform: `translateX(${tipFlip ? '-104%' : '4%'})`,
                  background: 'var(--ink)', color: 'var(--white)', fontFamily: 'var(--f1)',
                  padding: '5px 8px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2,
                }}
              >
                <div style={{ fontSize: 8.5, opacity: 0.8, letterSpacing: 0.3 }}>{fmtDate(hp[0])}</div>
                <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}><Price jpy={hp[1]} /></div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginLeft: 48, fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', letterSpacing: 0.3 }}>
        <span>{fmtDate(minX)} ~ {fmtDate(maxX)}</span>
        <span>최저 <Price jpy={minY} /> · 최고 <Price jpy={maxY} /></span>
      </div>
    </div>
  );
}
