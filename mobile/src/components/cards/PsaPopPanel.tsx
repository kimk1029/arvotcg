/**
 * PSA 인구 리포트(POP) — 웹 PsaPopPanel 패리티.
 * 카드(setCode+번호)에 매핑된 등급별 그레이딩 수량. 매핑이 없으면
 * PSA 인증번호(슬랩 라벨 숫자) 1건으로 등록 — 이후 모두에게 공유.
 * 서버에 PSA_API_TOKEN 이 없으면(status:disabled) 섹션 자체를 숨긴다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import {
  fetchPsaPop,
  registerPsaCert,
  PSA_REGISTER_ERROR_KO,
  type PsaGradeRow,
  type PsaPop,
} from '@/lib/psaPop';

function gradeLabel(r: PsaGradeRow): string {
  if (r.grade === 0) return 'AUTH';
  if (r.grade != null) return `PSA ${r.grade}`;
  return r.label || '—';
}

export function PsaPopPanel({
  setCode,
  cardNumber,
}: {
  setCode?: string | null;
  cardNumber?: string | null;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
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
    <>
      <View style={{ marginHorizontal: 14, marginTop: 2 }}>
        <SectHd
          title="PSA 인구 리포트"
          more={state === 'ok' && pop && pop.total > 0 ? `총 ${pop.total.toLocaleString('ko-KR')}장` : undefined}
        />
      </View>
      <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
        <PixelFrame bg={tc.white}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            {state === 'loading' ? (
              <PixelText variant={txt} size={10} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 24 }}>
                PSA POP 조회 중…
              </PixelText>
            ) : state === 'unmapped' ? (
              <View style={{ paddingVertical: 8 }}>
                <PixelText variant={txt} size={10} color={tc.ink3} style={{ lineHeight: 16 }}>
                  아직 이 카드의 PSA POP 이 등록되지 않았어요. PSA 슬랩 라벨의 인증번호를 입력하면 등급별 인구가 등록돼요 (1회, 모두에게 공유).
                </PixelText>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TextInput
                    value={cert}
                    onChangeText={setCert}
                    keyboardType="number-pad"
                    placeholder="PSA 인증번호 (예: 82345678)"
                    placeholderTextColor={tc.ink3}
                    style={{
                      flex: 1, minWidth: 0, fontSize: 12, fontWeight: '700', color: tc.ink,
                      paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1.5, borderColor: tc.pap3,
                      backgroundColor: tc.white,
                    }}
                  />
                  <Pressable
                    onPress={onRegister}
                    disabled={busy}
                    style={{ paddingHorizontal: 14, justifyContent: 'center', backgroundColor: tc.ink, opacity: busy ? 0.6 : 1 }}
                  >
                    <PixelText variant={txt} size={11} weight="bold" color={tc.white}>
                      {busy ? '조회 중…' : '등록'}
                    </PixelText>
                  </Pressable>
                </View>
                {errMsg ? (
                  <PixelText variant={txt} size={10} weight="bold" color={tc.red} style={{ marginTop: 8 }}>
                    {errMsg}
                  </PixelText>
                ) : null}
              </View>
            ) : rows.length === 0 ? (
              <PixelText variant={txt} size={10} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 24 }}>
                등급별 데이터 없음 — 총 {pop?.total ? pop.total.toLocaleString('ko-KR') : '—'}장 그레이딩
              </PixelText>
            ) : (
              rows.map((r, i) => {
                const hi = r.grade === 10 || r.grade === 9;
                const c = r.grade === 10 ? tc.red : r.grade === 9 ? tc.blu : tc.ink3;
                return (
                  <View
                    key={`${r.label}-${i}`}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
                      borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: tc.pap3,
                    }}
                  >
                    <View style={{ minWidth: 58, alignItems: 'center', backgroundColor: hi ? c : tc.pap2, paddingVertical: 4, paddingHorizontal: 8 }}>
                      <PixelText variant={txt} size={10} weight="bold" color={hi ? tc.white : tc.ink3}>
                        {gradeLabel(r)}
                      </PixelText>
                    </View>
                    <View style={{ flex: 1, height: 8, backgroundColor: tc.pap2, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.max(2, Math.round((r.pop / maxPop) * 100))}%`,
                          backgroundColor: c, opacity: hi ? 1 : 0.45,
                        }}
                      />
                    </View>
                    <PixelText variant={txt} size={13} weight="bold" color={tc.ink} style={{ minWidth: 56, textAlign: 'right' }}>
                      {r.pop.toLocaleString('ko-KR')}
                      {r.popQ > 0 ? ` +Q${r.popQ}` : ''}
                    </PixelText>
                  </View>
                );
              })
            )}
          </View>
        </PixelFrame>
        {state === 'ok' && pop ? (
          <PixelText variant={txt} size={8} color={tc.ink3} style={{ marginTop: 8, lineHeight: 13 }}>
            · PSA 공식 인구 리포트 기준 — 등급별 그레이딩 수량이에요.
            {pop.subject ? ` ${pop.year ? pop.year + ' ' : ''}${pop.subject}${pop.variety ? ` (${pop.variety})` : ''} ·` : ''}{' '}
            {new Date(pop.fetchedAt).toLocaleDateString('ko-KR')} 갱신 (7일 캐시)
          </PixelText>
        ) : null}
      </View>
    </>
  );
}
