/**
 * /my/favorites — 관심카드 전용 화면.
 * 본문은 내 자산(my/cards) '관심카드' 탭과 같은 FavoritesView 하나
 * (리스트 기본 + 우측 상단 아이콘으로 바둑판 토글). 여기서는 앱바만 얹는다.
 */
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { FavoritesView } from '@/components/FavoritesView';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useThemeColors } from '@/components/ThemeProvider';
import { useEffect, useState } from 'react';
import { isAuthenticated, subscribeSession } from '@/lib/session';

function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => subscribeSession(() => setAuthed(isAuthenticated())), []);
  return authed;
}

export default function FavoritesScreen() {
  const tc = useThemeColors();
  const authed = useAuthed();

  if (!authed) {
    return (
      <InlineLoginGate
        title="관심카드"
        feature="관심카드"
        description="관심 표시한 카드를 한눈에 보고, 시세 변동을 추적해보세요."
        icon="⭐"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="관심카드" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <FavoritesView />
      </ScrollView>
    </View>
  );
}
