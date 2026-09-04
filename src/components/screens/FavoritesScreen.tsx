'use client';

/**
 * /my/favorites — 관심카드 전용 화면.
 * 본문은 내 자산 '관심카드' 탭과 같은 FavoritesView 하나(리스트 기본 + 바둑판 토글).
 * 여기서는 앱바/뒤로가기만 얹는다.
 */
import { FavoritesView } from '@/components/screens/FavoritesView';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import type { MyFavoriteRow } from '@/lib/queries';

export function FavoritesScreen({ favorites }: { favorites: MyFavoriteRow[] }) {
  return (
    <>
      <StatusBar />
      <AppBar title="관심카드" showBack backHref="/my" />
      <div style={{ height: 12 }} />
      <FavoritesView initial={favorites} />
      <div className="bggap" />
    </>
  );
}
