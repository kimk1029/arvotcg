/**
 * 구입 날짜 선택 필드 — 탭하면 달력(월 이동 + 일 그리드) 모달. 값은 YYYY-MM-DD.
 * 네이티브 date picker 모듈은 스토어 빌드가 필요해 순수 JS 달력으로 구현(OTA 가능).
 * 웹은 <input type="date"> 가 같은 역할.
 */
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import type { ManualPalette } from '@/components/CardRegisterForm';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function DatePickerField({ value, onChange, P }: { value: string; onChange: (v: string) => void; P: ManualPalette }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const init = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : today;
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());

  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: Array<number | null> = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const move = (d: number) => {
    const t = new Date(y, m + d, 1);
    setY(t.getFullYear());
    setM(t.getMonth());
  };
  const pick = (d: number) => {
    onChange(ymd(y, m, d));
    setOpen(false);
  };
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: P.pageBg, borderWidth: 1.5, borderColor: P.fieldBd, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 }}
      >
        <PixelText variant="ko" size={13} weight="bold" color={value ? P.ink : P.ink3}>{value || '날짜 선택'}</PixelText>
        <PixelText variant="ko" size={12} color={P.ink3}>📅</PixelText>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 340, backgroundColor: P.pageBg, borderRadius: 16, padding: 14 }}>
            {/* 월 이동 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Pressable onPress={() => move(-1)} hitSlop={10} style={{ padding: 6 }}><PixelText variant="ko" size={16} weight="bold" color={P.ink}>‹</PixelText></Pressable>
              <PixelText variant="ko" size={14} weight="bold" color={P.ink}>{`${y}년 ${m + 1}월`}</PixelText>
              <Pressable onPress={() => move(1)} hitSlop={10} style={{ padding: 6 }}><PixelText variant="ko" size={16} weight="bold" color={P.ink}>›</PixelText></Pressable>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {WEEK.map((w, i) => (
                <View key={w} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
                  <PixelText variant="ko" size={10} weight="bold" color={i === 0 ? P.red : P.ink3}>{w}</PixelText>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((d, i) => {
                const key = d ? ymd(y, m, d) : '';
                const on = !!d && key === value;
                const isToday = !!d && key === todayStr;
                return (
                  <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>
                    {d ? (
                      <Pressable onPress={() => pick(d)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? P.btnBg : 'transparent', borderWidth: isToday && !on ? 1.5 : 0, borderColor: P.accent }}>
                        <PixelText variant="ko" size={13} weight={on ? 'bold' : undefined} color={on ? P.btnFg : i % 7 === 0 ? P.red : P.ink}>{String(d)}</PixelText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <Pressable onPress={() => { onChange(todayStr); setOpen(false); }} hitSlop={8}>
                <PixelText variant="ko" size={12} weight="bold" color={P.accent}>오늘</PixelText>
              </Pressable>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <PixelText variant="ko" size={12} weight="bold" color={P.ink3}>닫기</PixelText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
