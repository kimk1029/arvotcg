/**
 * 알림 목록 — 포인트 적립·회수·레벨업 (PointLog 원장, /api/me/notifications).
 * 진입 시 seen 처리 → 홈 드로어의 미확인 배지가 사라진다. 웹 NotificationsScreen 페어.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { LoadingState, RequireAuthEmpty } from '@/components/cv/ListState';
import { useThemeColors } from '@/components/ThemeProvider';
import { isAuthenticated } from '@/lib/session';
import {
  fetchNotifications,
  markNotificationsSeen,
  type NotificationRow,
} from '@/lib/myApi';
import { POINT_REASON_EMOJI, POINT_REASON_LABELS } from '@/lib/rewards';

function relTime(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins <= 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export default function NotificationsScreen() {
  const tc = useThemeColors();
  const [rows, setRows] = useState<NotificationRow[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) return;
    fetchNotifications().then(setRows);
    markNotificationsSeen();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="알림" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 110, paddingHorizontal: 14 }}>
        <RequireAuthEmpty title="로그인이 필요해요" message="알림은 로그인 후 이용할 수 있습니다." callbackPath="/my/notifications" />
        {!isAuthenticated() ? null : rows === null ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <View style={{ padding: 28, backgroundColor: tc.white, borderRadius: 12, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: tc.ink }}>아직 알림이 없어요.</Text>
            <Text style={{ fontSize: 11, color: tc.ink3, textAlign: 'center' }}>
              출석 체크·커뮤니티 글쓰기·거래로 포인트를 모으면 여기에 쌓여요.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {rows.map((n) => {
              const earn = n.delta > 0;
              return (
                <View
                  key={n.id}
                  style={{
                    backgroundColor: tc.white, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
                    borderLeftWidth: 3, borderLeftColor: n.unseen ? tc.gold : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22, width: 28, textAlign: 'center' }}>
                      {POINT_REASON_EMOJI[n.reason] ?? '🪙'}
                    </Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: tc.ink }}>
                        {POINT_REASON_LABELS[n.reason] ?? n.reason}
                      </Text>
                      <Text style={{ fontSize: 11, color: tc.ink3, marginTop: 3 }}>
                        {relTime(n.createdAt)} · 잔액 {n.balanceAfter.toLocaleString()}P
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14.5, fontWeight: '900', color: earn ? tc.grn : tc.red }}>
                      {earn ? '+' : ''}{n.delta.toLocaleString()}P
                    </Text>
                  </View>
                  {n.levelUp ? (
                    <View
                      style={{
                        marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
                        backgroundColor: tc.pap2, flexDirection: 'row', alignItems: 'center', gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>🎉</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: tc.ink }}>
                        LV.{n.levelUp.to} 달성! <Text style={{ color: tc.gold }}>{n.levelUp.title}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
