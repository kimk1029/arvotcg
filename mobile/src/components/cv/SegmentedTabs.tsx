/**
 * 상단 전환 세그먼트 컨트롤 — Claude Design 'POKE30 커뮤니티' 시안 (웹 SegmentedTabs 페어).
 * 회색 트랙 안에서 선택된 항목만 진한 알약(아이콘+라벨)으로 떠오른다.
 * 커뮤니티(커뮤니티↔Shop)·내 자산(내 자산↔관심카드)이 공유.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export interface SegItem<T extends string> {
  id: T;
  label: string;
  /** 라벨 왼쪽 아이콘 — stroke 색을 받아 그린다. */
  icon: (color: string) => ReactNode;
}

interface Props<T extends string> {
  items: [SegItem<T>, SegItem<T>];
  value: T;
  onChange: (id: T) => void;
  /** 트랙(배경) 색 */
  track: string;
  /** 선택 알약 배경 / 글자색 */
  activeBg: string;
  activeFg: string;
  /** 비선택 글자색 */
  inactiveFg: string;
}

export function SegmentedTabs<T extends string>({
  items, value, onChange, track, activeBg, activeFg, inactiveFg,
}: Props<T>) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: track, borderRadius: 14, padding: 4, gap: 2, alignSelf: 'flex-start' }}>
      {items.map((it) => {
        const on = it.id === value;
        const fg = on ? activeFg : inactiveFg;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 8, paddingHorizontal: 15, borderRadius: 11,
              backgroundColor: on ? activeBg : 'transparent',
              // 선택 알약만 살짝 떠 보이게 (시안의 box-shadow 대응)
              ...(on
                ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }
                : null),
            }}
          >
            {it.icon(fg)}
            <Text style={{ fontSize: 14, fontWeight: '800', letterSpacing: -0.3, color: fg }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* 시안에서 쓰는 아이콘들 — 각 화면이 골라 쓴다. */
export const SegIcons = {
  chat: (c: string) => (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  ),
  pin: (c: string) => (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z" />
      <Circle cx={12} cy={9} r={2.5} />
    </Svg>
  ),
  wallet: (c: string) => (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
      <Path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Svg>
  ),
  star: (c: string) => (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </Svg>
  ),
};
