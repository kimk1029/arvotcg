/**
 * 홈 히어로 배너 — 웹의 HeroSlider(compact) 모바일 버전.
 * /api/banners 로 받은 슬라이드를 가로 페이징 + 자동 회전으로 보여준다.
 * 탭하면 linkUrl(내부/외부) 로 이동.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PixelText } from '@/components/PixelText';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { shotSource } from '@/lib/shotMode';

export interface HeroSlideData {
  cls: 'slide-a' | 'slide-b' | 'slide-c' | 'slide-d';
  badge: string;
  title: string;
  sub: string;
  visualType: 'emoji' | 'image';
  visualValue: string;
  onClick: 'stamp-rally' | 'oripa' | null;
  linkUrl?: string | null;
  ctaHint?: string | null;
}

// DB(어드민) 배너가 없을 때 폴백 — 웹 HeroSlider 와 동일.
const FALLBACK_SLIDES: HeroSlideData[] = [
  {
    cls: 'slide-a',
    badge: '📈 실시간 시세',
    title: '카드 시세 한눈에',
    sub: 'TCG 카드 · 실시간 시세 검색',
    visualType: 'emoji',
    visualValue: '📈',
    onClick: null,
    linkUrl: '/cards',
    ctaHint: '👉 TAP',
  },
  {
    cls: 'slide-b',
    badge: '⚡ 실시간 거래 활성',
    title: '삽니다 팝니다',
    sub: '카드 직거래 게시판 · 쪽지로 빠르게 연결',
    visualType: 'emoji',
    visualValue: '💬',
    onClick: null,
    linkUrl: '/trade',
  },
  {
    cls: 'slide-c',
    badge: '💬 커뮤니티',
    title: '오늘의 피드',
    sub: '카드 이야기와 정보를 피드에서 나눠보세요',
    visualType: 'emoji',
    visualValue: '📣',
    onClick: null,
    linkUrl: '/feed',
  },
  // 오리파 슬라이드는 서비스 숨김 상태(2026-07)라 폴백에서 제외. 웹 HeroSlider 동일.
];

const SLIDE_BG: Record<string, string> = {
  'slide-a': '#E63946',
  'slide-b': '#0E9488',
  'slide-c': '#7C5CDB',
  'slide-d': '#E07B39',
};

// 상대 경로(/promo/...) 이미지는 웹 오리진 기준으로 해석.
const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_OAUTH_ORIGIN ?? 'https://www.poke-30.com';
function imageUri(v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  return `${WEB_ORIGIN}${v.startsWith('/') ? '' : '/'}${v}`;
}

function hrefOf(s: HeroSlideData): string | null {
  if (s.linkUrl) return s.linkUrl;
  if (s.onClick === 'oripa') return '/my/oripa';
  return null;
}

export function HeroBanner({ slides }: { slides: HeroSlideData[] }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  // 웹 홈과 동일: 모든 테마에서 컨테이너 보더 없이 좌우 풀블리드 + 세로로 큰 배너
  // (색/폰트만 테마별로 다르게). 픽셀 프레임/작은 높이는 제거.
  const slideHeight = 176;
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const [idx, setIdx] = useState(0);
  // 풀블리드라 슬라이드 폭 = 화면 폭. onLayout 으로 실제 폭 재측정(페이징 정확도).
  const [width, setWidth] = useState(Dimensions.get('window').width);

  // DB 배너 없으면 폴백 슬라이드 (웹과 동일하게 항상 영역 노출).
  const data = slides.length > 0 ? slides : FALLBACK_SLIDES;

  // 자동 회전 (4초). 슬라이드 1개면 미적용.
  useEffect(() => {
    if (data.length <= 1) return;
    const t = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % data.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [data.length, width]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const go = (s: HeroSlideData) => {
    const href = hrefOf(s);
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      // http(s) 링크는 범용 인앱 웹뷰(/web)로 — 어드민이 배너에 URL 만 넣으면
      // 앱 업데이트 없이 새 이벤트 페이지를 열 수 있다 (우리 도메인엔 토큰 자동 첨부).
      router.push({ pathname: '/web', params: { url: href, title: s.badge ?? '이벤트' } } as never);
    } else {
      router.push(href as never);
    }
  };

  const track = (
    <View
      style={{ overflow: 'hidden' }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
      >
        {data.map((s, i) => {
          const bg = SLIDE_BG[s.cls] ?? tc.ink;
          return (
            <Pressable
              key={i}
              onPress={() => go(s)}
              style={({ pressed }) => ({
                width,
                height: slideHeight,
                backgroundColor: bg,
                paddingVertical: 20,
                paddingHorizontal: 20,
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              {/* badge */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 7, paddingVertical: 3, marginBottom: 9, borderRadius: 6 }}>
                  <PixelText variant={txt} size={10} weight="bold" color="#FFFFFF">{s.badge}</PixelText>
                </View>
                {s.ctaHint ? (
                  <PixelText variant={txt} size={10} weight="bold" color="rgba(255,255,255,0.9)">{s.ctaHint}</PixelText>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <PixelText variant={txt} size={18} weight="bold" color="#FFFFFF" numberOfLines={2} style={{ lineHeight: 24 }}>
                    {s.title.replace(/\n/g, ' ')}
                  </PixelText>
                  <PixelText variant={txt} size={12} color="rgba(255,255,255,0.85)" numberOfLines={2} style={{ marginTop: 7, lineHeight: 18 }}>
                    {s.sub.replace(/\n/g, ' ')}
                  </PixelText>
                </View>
                {s.visualType === 'image' ? (
                  <Image source={shotSource(imageUri(s.visualValue))} style={{ width: 86, height: 122, resizeMode: 'cover' }} />
                ) : (
                  <Text style={{ fontSize: 64, lineHeight: 72 }}>{s.visualValue}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ marginHorizontal: 0, marginBottom: 8 }}>
      {/* 웹 홈과 동일 — 컨테이너 보더 없이 좌우 풀블리드 슬라이드만 (모든 테마 공통). */}
      {track}
      {/* dots — 배너 내부 하단 중앙 오버레이. 슬라이드 1개여도 항상 표시. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 10,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 5,
        }}
      >
        {data.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === idx ? 14 : 6,
              height: 6,
              backgroundColor: i === idx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
              borderRadius: 3,
            }}
          />
        ))}
      </View>
    </View>
  );
}
