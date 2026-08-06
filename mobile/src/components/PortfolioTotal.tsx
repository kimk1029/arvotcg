/**
 * 포트폴리오 총합 + 어제 대비 등락 + 30일 스파크라인.
 *
 * /api/me/portfolio 가 KST 정각 기준 일별 스냅샷을 upsert + 어제와 비교한
 * changeAbsJpy/changePct 와 history (최근 30일) 를 함께 반환. 통화 모드에 맞춰
 * ¥/₩ 자동 변환. 다크 히어로 안에 렌더 — 클린(플랫) 테마는 폰트/모서리만 플랫.
 */
import { useEffect, useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useCurrency } from './CurrencyProvider';
import { useTheme, useThemeColors } from './ThemeProvider';
import { fetchPortfolio, type PortfolioSummary } from '@/lib/myApi';
import { isFlatTheme } from '@/lib/theme';
import { fonts } from '@/theme/tokens';

type State =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error' }
  | { kind: 'ok'; data: PortfolioSummary };

function useFlat(): boolean {
  const { theme } = useTheme();
  return isFlatTheme(theme);
}

export function PortfolioTotal() {
  const { format } = useCurrency();
  const flat = useFlat();
  const tc = useThemeColors();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchPortfolio();
        if (!alive) return;
        if (!d || d.totalCount === 0) {
          setState({ kind: 'empty' });
          return;
        }
        setState({ kind: 'ok', data: d });
      } catch {
        if (alive) setState({ kind: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const label = (() => {
    if (state.kind === 'loading') return '계산 중…';
    if (state.kind === 'ok') return format(state.data.totalJpy);
    if (state.kind === 'empty') return '컬렉션 없음';
    return '시세 조회 실패';
  })();

  const titleSt: TextStyle = flat
    ? { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }
    : { fontFamily: fonts.pixel, fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4, marginBottom: 4 };
  const valueSt: TextStyle = flat
    ? { fontSize: 20, fontWeight: '800', color: tc.gold }
    : { fontFamily: fonts.pixel, fontSize: 17, color: tc.gold, letterSpacing: 0.3 };
  const countSt: TextStyle = flat
    ? { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.5)' }
    : { fontFamily: fonts.pixel, fontSize: 9, color: 'rgba(255,255,255,0.45)' };

  return (
    <View style={{ marginTop: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: flat ? 12 : 0 }}>
      <Text style={titleSt}>포트폴리오 평가액 (스니덩크 최저가 합계)</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <Text style={valueSt}>{label}</Text>
        {state.kind === 'ok' && state.data.changePct != null && (
          <DeltaBadge pct={state.data.changePct} absJpy={state.data.changeAbsJpy} format={format} />
        )}
        {state.kind === 'ok' && (
          <Text style={countSt}>
            {state.data.pricedCount}/{state.data.totalCount}장 반영
          </Text>
        )}
      </View>
      {state.kind === 'ok' && state.data.history.length >= 2 && (
        <Sparkline points={state.data.history.map((h) => h.totalJpy)} />
      )}
    </View>
  );
}

function DeltaBadge({
  pct, absJpy, format,
}: {
  pct: number;
  absJpy: number | null;
  format: (jpy: number) => string;
}) {
  const flat = useFlat();
  const up = pct >= 0;
  const sign = up ? '▲' : '▼';
  const color = up ? '#22C55E' : '#E63946';
  const pctStr = `${up ? '+' : ''}${pct.toFixed(1)}%`;
  const absStr = absJpy != null ? ` (${up ? '+' : '-'}${format(Math.abs(absJpy))})` : '';
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: color, borderRadius: flat ? 6 : 0 }}>
      <Text style={flat ? { color, fontSize: 11, fontWeight: '700' } : { color, fontFamily: fonts.pixel, fontSize: 10 }}>
        {sign} {pctStr}
        {absStr}
      </Text>
    </View>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const flat = useFlat();
  if (points.length < 2) return null;
  const W = 280;
  const H = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const step = W / (points.length - 1);
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = H - 2 - ((v - min) / span) * (H - 4);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const up = last >= first;
  const hintSt: TextStyle = flat
    ? { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.4)', marginTop: 3 }
    : { fontFamily: fonts.pixel, fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.3, marginTop: 3 };
  return (
    <View style={{ marginTop: 6 }}>
      <Svg width={W} height={H}>
        <Path d={d} fill="none" stroke={up ? '#22C55E' : '#E63946'} strokeWidth={2} strokeLinejoin="round" />
        <Line x1={0} y1={H - 2} x2={W} y2={H - 2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      </Svg>
      <Text style={hintSt}>최근 {points.length}일 (KST 정각 기준)</Text>
    </View>
  );
}
