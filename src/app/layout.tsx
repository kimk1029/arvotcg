import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { ActionTracker } from '@/components/ActionTracker';
import { AdScripts } from '@/components/ads/AdScripts';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { UgcTermsGateHost } from '@/components/UgcTermsGate';
import { InAppBrowserNotice } from '@/components/InAppBrowserNotice';
import { InventoryProvider } from '@/components/InventoryProvider';
import { JsonLd } from '@/components/JsonLd';
import { PageviewBeacon } from '@/components/PageviewBeacon';
import { PhoneShell } from '@/components/PhoneShell';
import { Providers } from '@/components/Providers';
import { RouteProgress } from '@/components/RouteProgress';
import { CurrencyProvider } from '@/components/CurrencyProvider';
import { HomePrefsProvider } from '@/components/HomePrefsProvider';
import { GamePrefsProvider } from '@/components/GamePrefsProvider';
import { NavPrefsProvider } from '@/components/NavPrefsProvider';
import { PriceModeProvider } from '@/components/PriceModeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { UnreadProvider } from '@/components/UnreadProvider';
import 'galmuri/dist/galmuri.css';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.poke-30.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '아르보TCG — TCG 카드 시세·거래 커뮤니티',
    template: '%s · 아르보TCG',
  },
  description:
    '포켓몬·원피스·유희왕 TCG 카드 실시간 시세 검색과 박스별 힛카드 가격 확인, 카드 거래·컬렉션 관리까지. 아르보TCG(ARVOTCG)에서 한눈에.',
  keywords: [
    '아르보TCG', 'ARVOTCG', 'TCG 시세', '포켓몬 카드 시세', '포켓몬 TCG',
    '원피스 카드 시세', '유희왕 카드 시세', '카드 거래', '힛카드', '카드 시세 검색',
    'PSA 그레이딩', '카드 컬렉션',
  ],
  applicationName: '아르보TCG',
  authors: [{ name: 'ARVOTCG' }],
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  // 파비콘/터치 아이콘은 app/{icon.svg,icon.png,apple-icon.png} 파일 컨벤션이 담당한다
  // (Next 가 링크 태그를 자동 주입). 여기서 icons 를 선언하면 그쪽이 우선해 옛 아이콘이
  // 남으므로 선언하지 않는다.
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: '아르보TCG',
    title: '아르보TCG — TCG 카드 시세·거래 커뮤니티',
    description:
      '포켓몬·원피스·유희왕 카드 실시간 시세 검색 · 박스별 힛카드 가격 · 카드 거래·컬렉션 관리',
    images: [{ url: '/meta.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '아르보TCG — TCG 카드 시세·거래 커뮤니티',
    description: 'TCG 카드 실시간 시세 검색 · 힛카드 가격 · 카드 거래',
    images: ['/meta.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      'naver-site-verification':
        process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ?? '',
      'google-adsense-account': 'ca-pub-8606099213555265',
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F7F8FA',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=DotGothic16&family=Do+Hyeon&display=swap"
          rel="stylesheet"
        />
        {/* Pretendard — 클린(ARVOTCG) 테마 본문 폰트 */}
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
          rel="stylesheet"
        />
        {/* 앱 인앱 WebView(임베드) 부트스트랩 — hydration 전에 <html data-embed="1"> 을
            찍어 웹 하단 탭바가 첫 페인트부터 안 그려지게 한다(앱 탭바와 이중 표시 방지).
            판정 규칙은 shared/embed.ts 와 동일: ?embed=1 쿼리(→ sessionStorage 유지) 또는
            UA 의 ARVOTCG-App 토큰. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='pf30:embed';var q=new URLSearchParams(location.search).get('embed')==='1';if(q)sessionStorage.setItem(k,'1');if(q||sessionStorage.getItem(k)==='1'||navigator.userAgent.indexOf('ARVOTCG-App')>=0)document.documentElement.setAttribute('data-embed','1');}catch(e){}})();`,
          }}
        />
        {/* 테마 부트스트랩 — hydration 전에 동기 실행, FOUC 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var C={pokemon:'#F7F3E3',onepiece:'#F8ECD0',yugioh:'#F6ECD4',sports:'#F7F8EA',clean:'#FFFFFF',dark:'#0A0D13'};var t='clean';try{var s=localStorage.getItem('pokefesta-theme');if(s&&C[s])t=s;}catch(e){}document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m);}m.content=C[t];})();`,
          }}
        />
      </head>
      <body>
        <JsonLd
          data={[
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: '아르보TCG',
              alternateName: 'ARVOTCG',
              url: SITE_URL,
              logo: `${SITE_URL}/app-icon.png`,
              description:
                '포켓몬·원피스·유희왕 TCG 카드 시세 검색·카드 거래·컬렉션 관리 커뮤니티',
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: '아르보TCG — TCG 카드 시세·거래 커뮤니티',
              alternateName: 'ARVOTCG',
              url: SITE_URL,
              inLanguage: 'ko-KR',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${SITE_URL}/cards/search?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            },
          ]}
        />
        <GoogleAnalytics />
        <AdScripts />
        <Providers>
          <CurrencyProvider>
            <PriceModeProvider>
              <HomePrefsProvider>
              <GamePrefsProvider>
              <NavPrefsProvider>
              <ToastProvider>
                <InventoryProvider>
                  <UnreadProvider>
                <Suspense fallback={null}>
                  <RouteProgress />
                </Suspense>
                <PageviewBeacon />
                <ActionTracker />
                <InAppBrowserNotice />
                <UgcTermsGateHost />
                <PhoneShell>{children}</PhoneShell>
                  </UnreadProvider>
                </InventoryProvider>
              </ToastProvider>
              </NavPrefsProvider>
              </GamePrefsProvider>
              </HomePrefsProvider>
            </PriceModeProvider>
          </CurrencyProvider>
        </Providers>
      </body>
    </html>
  );
}
