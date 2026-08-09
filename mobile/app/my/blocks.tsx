/**
 * /my/blocks — 차단 관리 (App Store 심사 지침 1.2). 웹 /my/blocks 와 페어.
 * 차단한 사용자 목록 + 해제. 해제하면 즉시 목록에서 제거되고
 * 다음 목록 조회부터 서버 필터가 풀린다.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { LoadingState } from '@/components/cv/ListState';
import { useThemeColors } from '@/components/ThemeProvider';
import { fetchMyBlocks, unblockUser, type BlockedUser } from '@/lib/myApi';

export default function BlocksScreen() {
  const tc = useThemeColors();
  const [blocks, setBlocks] = useState<BlockedUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyBlocks()
      .then(setBlocks)
      .catch(() => setBlocks([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const unblock = (b: BlockedUser) => {
    if (busyId) return;
    Alert.alert(`${b.name}님 차단을 해제할까요?`, '해제하면 이 사용자의 글이 다시 보여요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        onPress: async () => {
          setBusyId(b.userId);
          try {
            await unblockUser(b.userId);
            setBlocks((prev) => (prev ?? []).filter((x) => x.userId !== b.userId));
          } catch {
            Alert.alert('실패', '차단 해제에 실패했어요. 잠시 후 다시 시도해 주세요.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="차단 관리" onBack={() => router.back()} />
      {blocks === null ? (
        <LoadingState />
      ) : blocks.length === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 13.5, color: tc.ink3, textAlign: 'center', lineHeight: 22 }}>
            차단한 사용자가 없어요.{'\n'}게시글·댓글의 ⋯ 메뉴에서 사용자를 차단할 수 있어요.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          {blocks.map((b) => (
            <View
              key={b.userId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: tc.pap3 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: tc.ink }}>
                  {b.name}
                </Text>
                <Text style={{ fontSize: 11, color: tc.ink3, marginTop: 2 }}>
                  {new Date(b.createdAt).toLocaleDateString('ko-KR')} 차단
                </Text>
              </View>
              <Pressable
                onPress={() => unblock(b)}
                disabled={busyId === b.userId}
                style={{ backgroundColor: tc.pap2, borderWidth: 1, borderColor: tc.pap3, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14, opacity: busyId === b.userId ? 0.5 : 1 }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: tc.ink2 }}>차단 해제</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
