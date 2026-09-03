'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import {
  fetchPsaPop,
  registerPsaCert,
  PSA_REGISTER_ERROR_KO,
  type PsaGradeRow,
  type PsaPop,
} from '@/lib/psaPop';

/**
 * PSA 인구 리포트(POP) — 카드(setCode+번호)에 매핑된 등급별 그레이딩 수량.
 * 매핑이 없으면 PSA 인증번호(슬랩 라벨 숫자) 1건으로 등록 — 이후 모두에게 노출.
 * 서버에 PSA_API_TOKEN 이 없으면(status:disabled) 섹션 자체를 숨긴다.
 */

function gradeLabel(r: PsaGradeRow): string {
  if (r.grade === 0) return 'AUTH';
  if (r.grade != null) return `PSA ${r.grade}`;
  return r.label || '—';
}

function gradeColor(r: PsaGradeRow): string {
  if (r.grade === 10) return 'var(--red)';
  if (r.grade === 9) return 'var(--blu)';
  return 'var(--ink3)';
}

export function PsaPopPanel({
  setCode,
  cardNumber,
}: {
  setCode?: string | null;
  cardNumber?: string | null;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'unmapped' | 'hidden'>('loading');
  const [pop, setPop] = useState<PsaPop | null>(null);
  const [cert, setCert] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!setCode || !cardNumber) {
      setState('hidden');
      return;
    }
    const ctrl = new AbortController();
    setState('loading');
    fetchPsaPop(setCode, cardNumber, ctrl.signal)
      .then((r) => {
        if (r.status === 'ok') {
          setPop(r.pop);
          setState('ok');
        } else if (r.status === 'disabled') {
          setState('hidden');
        } else {
          setState('unmapped');
        }
      })
      .catch(() => setState('hidden'));
    return () => ctrl.abort();
  }, [setCode, cardNumber]);

  const rows = useMemo(() => {
    const g = pop?.grades ?? [];
    return [...g]
      .filter((r) => r.pop > 0 || r.popQ > 0)
      .sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1));
  }, [pop]);
  const maxPop = useMemo(() => Math.max(1, ...rows.map((r) => r.pop)), [rows]);

  if (state === 'hidden') return null;

  async function onRegister() {
    if (!setCode || !cardNumber || busy) return;
    const c = cert.replace(/[\s-]/g, '');
    if (!/^\d{5,12}$/.test(c)) {
      setErrMsg(PSA_REGISTER_ERROR_KO['bad-cert']);
      return;
    }
    setBusy(true);
    setErrMsg(null);
    const r = await registerPsaCert(c, setCode, cardNumber);
    setBusy(false);
    if (r.status === 'ok') {
      setPop(r.pop);
      setState('ok');
    } else if (r.status === 'disabled') {
      setState('hidden');
    } else {
      const reason = r.status === 'error' ? r.reason : 'save-failed';
      setErrMsg(PSA_REGISTER_ERROR_KO[reason] ?? PSA_REGISTER_ERROR_KO['save-failed']);
    }
  }

  return (
    <div className="sect">
      <div className="sect-hd">
        <h2>PSA 인구 리포트</h2>
        {state === 'ok' && pop && pop.total > 0 && (
          <span className="more">총 {pop.total.toLocaleString('ko-KR')}장</span>
        )}
      </div>

      <Panel style={{ padding: '10px 14px' }}>
        {state === 'loading' ? (
          <div style={ph}>PSA POP 조회 중…</div>
        ) : state === 'unmapped' ? (
          <div style={{ padding: '14px 0' }}>
            <div style={{ fontFamily: 'var(--f1)', fontSize: 10.5, color: 'var(--ink3)', lineHeight: 1.6 }}>
              아직 이 카드의 PSA POP 이 등록되지 않았어요.
              <br />
              PSA 슬랩 라벨의 <b style={{ color: 'var(--ink)' }}>인증번호</b>를 입력하면 등급별 인구가 등록돼요 (1회, 모두에게 공유).
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={cert}
                onChange={(e) => setCert(e.target.value)}
                inputMode="numeric"
                placeholder="PSA 인증번호 (예: 82345678)"
                style={{
                  flex: 1, minWidth: 0, fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 700,
                  padding: '9px 11px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--pap3)',
                  background: 'var(--white)', color: 'var(--ink)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={onRegister}
                disabled={busy}
                style={{
                  flex: 'none', fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                  padding: '9px 14px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: 'var(--ink)', color: 'var(--white)', opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? '조회 중…' : '등록'}
              </button>
            </div>
            {errMsg && (
              <div style={{ marginTop: 8, fontFamily: 'var(--f1)', fontSize: 10, fontWeight: 700, color: 'var(--red)' }}>
                {errMsg}
              </div>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div style={ph}>
            등급별 데이터 없음 — 총 {pop?.total ? pop.total.toLocaleString('ko-KR') : '—'}장 그레이딩
          </div>
        ) : (
          <>
            {rows.map((r, i) => {
              const c = gradeColor(r);
              return (
                <div
                  key={`${r.label}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--pap3)' : 'none',
                  }}
                >
                  <span
                    style={{
                      flex: 'none', minWidth: 58, textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10.5,
                      fontWeight: 800, padding: '4px 8px', borderRadius: 'var(--r-sm)',
                      background: r.grade === 10 || r.grade === 9 ? c : 'var(--pap2)',
                      color: r.grade === 10 || r.grade === 9 ? 'var(--white)' : 'var(--ink3)',
                    }}
                  >
                    {gradeLabel(r)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--pap2)', overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block', height: '100%', borderRadius: 4,
                        width: `${Math.max(2, Math.round((r.pop / maxPop) * 100))}%`,
                        background: c, opacity: r.grade === 10 || r.grade === 9 ? 1 : 0.45,
                      }}
                    />
                  </span>
                  <span style={{ flex: 'none', minWidth: 56, textAlign: 'right', fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 900, color: 'var(--ink)' }}>
                    {r.pop.toLocaleString('ko-KR')}
                    {r.popQ > 0 && (
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--ink3)' }}> +Q{r.popQ}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </Panel>

      {state === 'ok' && pop && (
        <div style={{ marginTop: 8, fontFamily: 'var(--f1)', fontSize: 8.5, color: 'var(--ink3)', letterSpacing: 0.2, lineHeight: 1.5 }}>
          · PSA 공식 인구 리포트 기준 — 등급별 그레이딩 수량이에요.
          {pop.subject ? ` ${pop.year ? pop.year + ' ' : ''}${pop.subject}${pop.variety ? ` (${pop.variety})` : ''} ·` : ''}{' '}
          {new Date(pop.fetchedAt).toLocaleDateString('ko-KR')} 갱신 (7일 캐시)
        </div>
      )}
    </div>
  );
}

const ph: React.CSSProperties = {
  padding: '24px 0', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)',
};
