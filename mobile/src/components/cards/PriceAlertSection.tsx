/**
 * 시세상세 "가격 알림" 섹션 — 웹 CardDetailView 하단 '가격 알림 · 앱 전용' 자리의
 * 실제 구현(앱 전용 기능). 목표가(JPY)를 설정하면 시세가 그 이하로 내려올 때
 * 서버 주기 체커가 메시지로 알려준다. API: /api/me/price-alerts (GET/POST/DELETE).
 */
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { useToast } from '@/components/ToastProvider';
import { useThemeColors, useThemeTextVariant, useInputFont } from '@/components/ThemeProvider';
import { useAuthed } from '@/lib/useAuthed';
import {
  createPriceAlert,
  deletePriceAlert,
  fetchPriceAlerts,
  type PriceAlertRow,
} from '@/lib/myApi';

interface Props {
  apparelId: number;
  cardName: string;
  /** 현재 시세(JPY) — 입력 placeholder 힌트용. */
  currentPriceJpy?: number | null;
}

export function PriceAlertSection({ apparelId, cardName, currentPriceJpy }: Props) {
  // 클린·다크는 시스템 산세리프 — 인풋/placeholder 가 비트맵 폰트로 남지 않게.
  const inputFont = useInputFont();
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  const authed = useAuthed();

  const [alert, setAlert] = useState<PriceAlertRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [priceStr, setPriceStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authed) {
      setLoaded(true);
      return;
    }
    let alive = true;
    fetchPriceAlerts()
      .then((rows) => {
        if (!alive) return;
        setAlert(rows.find((r) => r.snkrdunkApparelId === apparelId) ?? null);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [authed, apparelId]);

  const save = async () => {
    const target = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(target) || target <= 0) {
      toast.info('목표가(엔화)를 입력해 주세요');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const r = await createPriceAlert({
        snkrdunkApparelId: apparelId,
        targetPriceJpy: target,
        cardName,
      });
      setAlert(r.data);
      setPriceStr('');
      toast.success(`¥${target.toLocaleString('ja-JP')} 이하로 내려오면 알려드릴게요`);
    } catch {
      toast.error('알림 설정에 실패했어요. 잠시 후 다시 시도해 주세요');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await deletePriceAlert(apparelId);
      setAlert(null);
      toast.success('가격 알림을 해제했어요');
    } catch {
      toast.error('해제에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={{ marginHorizontal: 14 }}>
        <SectHd title="가격 알림" />
      </View>
      <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
        <PixelFrame bg={tc.white} borderWidth={3} shadow={5}>
          <View style={{ padding: 12, gap: 10 }}>
            {!authed ? (
              <PixelText variant="ko" size={10} color={tc.ink3} style={{ lineHeight: 16 }}>
                🔔 로그인하면 목표가를 설정하고 시세가 도달했을 때 알림을 받을 수 있어요.
              </PixelText>
            ) : !loaded ? (
              <PixelText variant={txt} size={9} color={tc.ink3}>불러오는 중...</PixelText>
            ) : (
              <>
                {alert ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: tc.pap2,
                      borderColor: tc.ink,
                      borderWidth: 2,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                  >
                    <PixelText variant={txt} size={13}>🔔</PixelText>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <PixelText variant={txt} size={10} weight="bold" color={tc.ink}>
                        ¥{alert.targetPriceJpy.toLocaleString('ja-JP')} 이하 알림 {alert.triggeredAt ? '(발송됨)' : '중'}
                      </PixelText>
                      <PixelText variant="ko" size={8} color={tc.ink3} style={{ marginTop: 2 }}>
                        {alert.triggeredAt ? '다시 받으려면 목표가를 새로 설정하세요' : '도달 시 메시지로 알려드려요'}
                      </PixelText>
                    </View>
                    <Pressable onPress={remove} disabled={saving} hitSlop={6}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: tc.pap3, borderColor: tc.ink, borderWidth: 2, opacity: saving ? 0.5 : 1 }}>
                        <PixelText variant={txt} size={8} color={tc.ink}>해제</PixelText>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: tc.white,
                      borderColor: tc.ink,
                      borderWidth: 3,
                      paddingLeft: 12,
                    }}
                  >
                    <PixelText variant={txt} size={12} color={tc.ink2}>¥</PixelText>
                    <TextInput
                      value={priceStr}
                      onChangeText={setPriceStr}
                      placeholder={
                        currentPriceJpy && currentPriceJpy > 0
                          ? `목표가 (현재 ${currentPriceJpy.toLocaleString('ja-JP')})`
                          : '목표가 (엔화)'
                      }
                      placeholderTextColor={tc.ink4}
                      keyboardType="numeric"
                      style={{
                        flex: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontFamily: inputFont,
                        color: tc.ink,
                      }}
                    />
                  </View>
                  <Pressable onPress={save} disabled={saving}>
                    <View
                      style={{
                        height: '100%',
                        justifyContent: 'center',
                        paddingHorizontal: 14,
                        backgroundColor: tc.ink,
                        borderColor: tc.ink,
                        borderWidth: 3,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      <PixelText variant={txt} size={9} color={tc.gold}>
                        {alert ? '변경' : '설정'}
                      </PixelText>
                    </View>
                  </Pressable>
                </View>
                <PixelText variant="ko" size={8} color={tc.ink3} style={{ lineHeight: 13 }}>
                  시세(싱글 기준)가 목표가 이하로 내려오면 메시지로 알려드려요.
                </PixelText>
              </>
            )}
          </View>
        </PixelFrame>
      </View>
    </>
  );
}
