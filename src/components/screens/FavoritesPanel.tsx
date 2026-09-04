'use client';

/**
 * 관심카드 패널 — 내 자산(컬렉션) 화면의 '관심카드' 탭 본문.
 * 화면 본체는 /my/favorites 와 같은 단일 컴포넌트(FavoritesView) 하나다 —
 * 두 진입점이 다른 화면을 보여주지 않게 통합됨(리스트 기본 + 바둑판 토글).
 */
export { FavoritesView as FavoritesPanel } from '@/components/screens/FavoritesView';
