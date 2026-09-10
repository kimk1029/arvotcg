import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '아르보TCG',
    short_name: '아르보TCG',
    description: '포켓몬·원피스·유희왕 TCG 카드 시세 검색, 카드 거래, 컬렉션 관리',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // 클린(ARVOTCG) 브랜드 — 틸 accent + 화이트 페이퍼 (구 픽셀 팔레트 색 제거)
    background_color: '#FFFFFF',
    theme_color: '#14A085',
    orientation: 'portrait',
    icons: [
      {
        src: '/app-icon-v2.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-v2.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
