import { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { router, usePathname } from 'expo-router';
import { colors } from '@/theme/tokens';
import { PixelText } from './PixelText';
import { PokeballSpinner } from './PokeballSpinner';
import { SportsBall } from './SportsBall';
import { StrawHatBall } from './StrawHatBall';
import { TabIcon, type TabIconName } from './TabIcon';
import { useTheme, useThemeColors, useThemeTextVariant } from './ThemeProvider';
import { useNavPrefs } from './NavPrefsProvider';
import { isFlatTheme } from '@/lib/theme';

type TabId = 'home' | 'collection' | 'fab' | 'community' | 'my';

interface Tab {
  id: TabId;
  label: string;
  icon?: TabIconName;
  href: string;
  fab?: boolean;
}

const TABS: Tab[] = [
  { id: 'home', label: '홈', icon: 'home', href: '/' },
  { id: 'collection', label: '컬렉션', icon: 'collection', href: '/my/cards' },
  { id: 'fab', label: '추가', href: '/cards/add', fab: true },
  { id: 'community', label: '커뮤니티', icon: 'community', href: '/feed' },
  { id: 'my', label: '마이', icon: 'my', href: '/my' },
];

function activeId(pathname: string): TabId | '' {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/my/cards')) return 'collection';
  if (pathname.startsWith('/cards/add')) return 'fab';
  if (pathname.startsWith('/cards/grading')) return 'fab';
  if (pathname.startsWith('/scan')) return 'fab';
  if (pathname.startsWith('/feed') || pathname.startsWith('/trade')) return 'community';
  if (pathname.startsWith('/my')) return 'my';
  return '';
}

export function Tabbar() {
  const pathname = usePathname();
  const active = activeId(pathname);
  const { theme } = useTheme();
  const c = useThemeColors();
  const flat = isFlatTheme(theme);
  const { navStyle } = useNavPrefs();
  const textVariant = useThemeTextVariant();
  const floating = navStyle === 'floating';

  const barBg = flat ? c.paper : theme === 'onepiece' ? c.bluDk : c.ink;

  // ── 분리형(플로팅) ── 아이콘 + 작은 한글 라벨 + 가운데 강조 버튼을 바 안으로(돌출 X).
  // 웹 .tabbar--floating 과 동일하게 전 테마 공통 '어두운 잉크 반투명' 바 —
  // 클린 테마에서 흰 바가 흰 콘텐츠·시스템 네비게이션과 한 덩어리로 보이던 문제 해결.
  // (RN 은 backdrop blur 미지원이라 웹 60%+blur 대신 가독성 있는 88% 불투명.)
  if (floating) {
    const iconOn = flat ? c.white : c.gold;
    const iconOff = 'rgba(255,255,255,0.55)';
    const floatBg = theme === 'onepiece' ? c.bluDk : flat ? '#16161acc' : c.ink;
    return (
      <View style={[styles.bar, styles.barFloating, { backgroundColor: floatBg, shadowColor: '#000' }]}>
        {TABS.map((t) => {
          const isOn = active === t.id;
          return (
            <Pressable
              key={t.id}
              style={styles.tabFloat}
              onPress={() => router.push(t.href as never)}
              hitSlop={6}
            >
              {t.fab ? (
                <View style={[styles.fabMini, { backgroundColor: c.red }]}>
                  <TabIcon name="plus" color={c.white} size={22} />
                </View>
              ) : (
                <>
                  <TabIcon name={t.icon!} color={isOn ? iconOn : iconOff} size={24} />
                  <PixelText
                    variant={textVariant}
                    size={10}
                    color={isOn ? iconOn : iconOff}
                    style={{ marginTop: 3, letterSpacing: 0.3 }}
                  >
                    {t.label}
                  </PixelText>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: barBg, borderTopColor: c.pap3 },
      ]}
    >
      <View pointerEvents="none" style={[styles.topAccent, { backgroundColor: flat ? c.pap3 : c.gold, height: flat ? 1 : undefined }]} />
      {TABS.map((t) => {
        const isOn = active === t.id;
        if (t.fab) return <FabTab key={t.id} on={isOn} label={t.label} href={t.href} />;
        return (
          <TabBtn
            key={t.id}
            on={isOn}
            label={t.label}
            icon={t.icon!}
            href={t.href}
          />
        );
      })}
    </View>
  );
}

interface TabBtnProps {
  on: boolean;
  label: string;
  icon: TabIconName;
  href: string;
}

function TabBtn({ on, label, icon, href }: TabBtnProps) {
  const c = useThemeColors();
  const { theme } = useTheme();
  const textVariant = useThemeTextVariant();
  const flat = isFlatTheme(theme);
  const onColor = flat ? (theme === 'dark' ? c.blu : c.ink) : c.gold;
  const offColor = flat ? c.ink3 : c.pap3;
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, { toValue: 0.86, useNativeDriver: true, friction: 6, tension: 240 }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 200 }).start();
  return (
    <Pressable
      style={styles.tab}
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={() => router.push(href as never)}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        {on ? <View style={[styles.activeDot, { backgroundColor: onColor }]} /> : null}
        <TabIcon name={icon} color={on ? onColor : offColor} size={24} />
        <PixelText
          variant={textVariant}
          size={11}
          color={on ? onColor : offColor}
          style={{ marginTop: 5, letterSpacing: 0.5 }}
        >
          {label}
        </PixelText>
      </Animated.View>
    </Pressable>
  );
}

interface FabProps {
  on: boolean;
  label: string;
  href: string;
}

function FabTab({ on, label, href }: FabProps) {
  const { theme } = useTheme();
  const c = useThemeColors();
  const flat = isFlatTheme(theme);
  const textVariant = useThemeTextVariant();
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Squash → 크게 부풀어오름 → 스프링 복귀. 회전·살짝 점프와 병행해
  // 단순한 spin 대비 훨씬 더 다이나믹.
  const onPress = () => {
    spin.setValue(0);
    scale.setValue(1);
    lift.setValue(0);
    stretch.setValue(0);
    const scaleSequence = theme === 'onepiece'
      ? Animated.sequence([
          Animated.timing(scale, {
            toValue: 0.74,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.34,
            duration: 210,
            easing: Easing.out(Easing.back(2.4)),
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
            tension: 95,
          }),
        ])
      : Animated.sequence([
          Animated.timing(scale, {
            toValue: 0.72,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 220,
            easing: Easing.out(Easing.back(2.2)),
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
            tension: 90,
          }),
        ]);
    Animated.parallel([
      scaleSequence,
      // 점프 — 위로 솟구쳤다 내려옴
      Animated.sequence([
        Animated.timing(lift, {
          toValue: -16,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(lift, {
          toValue: 0,
          useNativeDriver: true,
          friction: 4,
          tension: 110,
        }),
      ]),
      theme === 'onepiece'
        ? Animated.sequence([
            Animated.timing(stretch, {
              toValue: 1,
              duration: 260,
              easing: Easing.out(Easing.back(1.8)),
              useNativeDriver: true,
            }),
            Animated.timing(stretch, {
              toValue: 0,
              duration: 360,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        : Animated.timing(spin, {
            toValue: 1,
            duration: 780,
            easing: Easing.bezier(0.12, 0.85, 0.25, 1),
            useNativeDriver: true,
          }),
    ]).start(() => {
      if (isMounted.current) router.push(href as never);
    });
  };

  const rotate = theme === 'onepiece'
    ? stretch.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-13deg', '10deg'] })
    : spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
  const hatScaleX = theme === 'onepiece'
    ? stretch.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.22, 0.96] })
    : 1;
  const hatScaleY = theme === 'onepiece'
    ? stretch.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0.82, 1.06] })
    : 1;
  const armScale = stretch.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1.7] });
  const armOpacity = stretch.interpolate({ inputRange: [0, 0.12, 0.76, 1], outputRange: [0, 1, 0.9, 0] });

  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Animated.View
        style={[
          styles.fabCircle,
          { transform: [{ translateY: lift }, { scale }, { scaleX: hatScaleX }, { scaleY: hatScaleY }, { rotate }] },
        ]}
      >
        {theme === 'onepiece' ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rubberArm,
              {
                backgroundColor: c.ornLt,
                borderColor: c.ink,
                opacity: armOpacity,
                transform: [{ scaleX: armScale }],
              },
            ]}
          />
        ) : null}
        {flat ? (
          // 클린·다크 — 픽셀 포켓볼 대신 에메랄드 라운드 FAB + 추가 아이콘
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 20,
              backgroundColor: c.grn,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#0A5C4B',
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <TabIcon name="plus" size={28} color="#FFFFFF" />
          </View>
        ) : theme === 'onepiece' ? (
          <StrawHatBall size={62} />
        ) : theme === 'sports' ? (
          <SportsBall size={62} />
        ) : (
          <PokeballSpinner size={62} />
        )}
      </Animated.View>
      <PixelText
        variant={textVariant}
        size={11}
        color={on ? c.gold : c.pap3}
        style={{ marginTop: 38, letterSpacing: 0.5 }}
      >
        {label}
      </PixelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.ink,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 4,
    minHeight: 88,
    borderTopWidth: 3,
    borderTopColor: colors.ink,
    position: 'relative',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.gold,
  },
  // 분리형(플로팅) — 양옆/아래 여백 + 둥근 모서리 + 그림자. 컴팩트(아이콘만).
  barFloating: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 26,
    borderTopWidth: 0,
    minHeight: 0,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 12,
  },
  tabFloat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  fabMini: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    minHeight: 56,
    position: 'relative',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -8,
    width: 5,
    height: 5,
    backgroundColor: colors.gold,
  },
  fabCircle: {
    position: 'absolute',
    top: -36,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rubberArm: {
    position: 'absolute',
    width: 78,
    height: 8,
    borderWidth: 2,
  },
});
