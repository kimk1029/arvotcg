import { requireOptionalNativeModule } from 'expo-modules-core';
import { Linking, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { WebView } from 'react-native-webview';

import { useToast } from '@/components/ToastProvider';
import { SHOP_OPEN_LABEL, shopOpenState } from '@/lib/shopHours';
import { TMAP_WEB_URL, instagramEmbedUrl, instagramHandle, instagramUrl, naverMapRouteUrl, naverMapWebUrl, tmapRouteUrl } from '@/lib/shopLinks';

/**
 * 카드샵 상세 페이지 — Claude Design 'POKE30 커뮤니티' 프로토타입의 shop detail page
 * (리스트 항목 탭 → 전체 화면 모달, 뒤로가기로 닫힘). 웹 ShopDetail 과 페어.
 * 사진·진행 중 오리파는 데이터가 없어 히어로 타일 1장 + 정보 박스로 대신한다.
 * 인스타그램이 있으면 맨 아래 '최근 소식' 에 프로필 임베드 WebView(최근 게시물, 공개 계정만).
 */

export interface ShopDetailData {
  name: string;
  official?: boolean;
  addr: string;
  lat: number;
  lng: number;
  dist: string;
  rating: string;
  reviews: number;
  oripa: string;
  single: string;
  priceLv: string;
  tile: string;
  emoji: string;
  phone?: string;
  instagram?: string;
  hours?: string;
  closedDays?: string;
  intro?: string;
  tags?: string[];
}

interface Props {
  shop: ShopDetailData | null;
  onClose: () => void;
}

const INK = '#16161a';
const MUTED = '#9A9AA0';
const t = (fontSize: number, fontWeight: '500' | '600' | '700' | '800' | '900', color: string) => ({ fontSize, fontWeight, color });

/** 클립보드 — expo-clipboard 는 네이티브 모듈이라 [[ota-native-module-crash]] 규칙대로 존재 확인 후 require (없는 빌드는 false). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (!requireOptionalNativeModule('ExpoClipboard')) return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const C = require('expo-clipboard') as typeof import('expo-clipboard');
    return await C.setStringAsync(text);
  } catch {
    return false;
  }
}

/** 앱 스킴 → 실패(미설치)면 웹 폴백. */
function openWithFallback(scheme: string, web: string) {
  Linking.openURL(scheme).catch(() => Linking.openURL(web).catch(() => {}));
}

export function ShopDetail({ shop, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const open = shop ? shopOpenState(shop.hours, shop.closedDays) : null;
  const openLabel = open ? SHOP_OPEN_LABEL[open] : null;
  const ig = shop ? instagramHandle(shop.instagram) : null;

  const copyAddr = async () => {
    if (!shop) return;
    if (await copyText(shop.addr)) toast.success('주소가 복사되었습니다');
    else toast.error('복사에 실패했어요');
  };
  const share = () => {
    if (!shop) return;
    Share.share({ message: `${shop.name} · ${shop.addr}` }).catch(() => {});
  };
  const ActionBtn = ({ bg, fg, label, icon, onPress }: { bg: string; fg: string; label: string; icon: React.ReactNode; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {icon}
      <Text style={t(13, '800', fg)}>{label}</Text>
    </Pressable>
  );
  const Mark = ({ bg, label, size = 10 }: { bg: string; label: string; size?: number }) => (
    <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={t(size, '900', '#fff')}>{label}</Text></View>
  );

  return (
    <Modal visible={!!shop} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {shop && (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
          <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F2' }}>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="뒤로">
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M19 12H5" /><Path d="m12 19-7-7 7-7" /></Svg>
            </Pressable>
            <Text numberOfLines={1} style={[t(17, '800', INK), { flex: 1, letterSpacing: -0.3 }]}>{shop.name}</Text>
            <Pressable onPress={share} hitSlop={8} accessibilityLabel="공유">
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Circle cx={18} cy={5} r={3} /><Circle cx={6} cy={12} r={3} /><Circle cx={18} cy={19} r={3} /><Path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Svg>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
            {/* hero (사진 데이터 없음 — 타일 색·이모지) */}
            <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
              <View style={{ height: 150, borderRadius: 14, backgroundColor: shop.tile, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Text style={{ fontSize: 56 }}>{shop.emoji}</Text>
                <View style={{ position: 'absolute', left: 10, bottom: 9, backgroundColor: 'rgba(0,0,0,.45)', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7 }}>
                  <Text style={t(10.5, '800', '#fff')}>매장</Text>
                </View>
              </View>
            </View>
            {/* header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[t(20, '900', INK), { letterSpacing: -0.4, flexShrink: 1 }]}>{shop.name}</Text>
                {shop.official ? (
                  <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M12 1.5 14.8 4l3.7-.4 1 3.6 3.2 1.9-1.6 3.4 1.6 3.4-3.2 1.9-1 3.6-3.7-.4L12 22.5 9.2 20l-3.7.4-1-3.6-3.2-1.9 1.6-3.4L1.3 8.1l3.2-1.9 1-3.6 3.7.4z" fill="#2C8FFF" /><Path d="m9 12 2 2 4-4.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                <Text style={t(13, '800', INK)}><Text style={{ color: '#FFC53D' }}>★</Text> {shop.rating}</Text>
                <Text style={t(12, '600', MUTED)}>후기 {shop.reviews}</Text>
                {shop.dist ? <Text style={t(12, '600', MUTED)}>· {shop.dist}</Text> : null}
                {openLabel ? <Text style={t(11.5, '800', openLabel.color)}>{openLabel.label}</Text> : null}
              </View>
              {/* 주소 + 복사 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <Text style={[t(12.5, '500', '#8E8E93'), { flexShrink: 1 }]}>{shop.addr}</Text>
                <Pressable onPress={copyAddr} hitSlop={8} accessibilityLabel="주소 복사">
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Rect x={9} y={9} width={13} height={13} rx={2} /><Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>
                </Pressable>
              </View>
              {/* actions */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {shop.phone ? (
                  <ActionBtn bg={INK} fg="#fff" label="전화" onPress={() => Linking.openURL(`tel:${shop.phone!.replace(/[^\d+]/g, '')}`).catch(() => {})}
                    icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></Svg>} />
                ) : null}
                <ActionBtn bg="#F2F2F4" fg={INK} label="네이버지도" icon={<Mark bg="#03C75A" label="N" />}
                  onPress={() => openWithFallback(naverMapRouteUrl({ lat: shop.lat, lng: shop.lng, name: shop.name }), naverMapWebUrl(shop.addr))} />
                <ActionBtn bg="#F2F2F4" fg={INK} label="티맵" icon={<Mark bg="#E8412C" label="T" size={9} />}
                  onPress={() => openWithFallback(tmapRouteUrl({ lat: shop.lat, lng: shop.lng, name: shop.name }), TMAP_WEB_URL)} />
                {ig ? (
                  <ActionBtn bg="#F2F2F4" fg={INK} label="인스타" icon={<Mark bg="#E1306C" label="◎" />}
                    onPress={() => openWithFallback(`instagram://user?username=${ig}`, instagramUrl(ig))} />
                ) : null}
              </View>
            </View>
            {/* intro */}
            <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
              <Text style={[t(16, '800', INK), { marginBottom: 10 }]}>매장 소개</Text>
              <Text style={[t(13.5, '500', shop.intro ? '#4A4A50' : MUTED), { lineHeight: 23 }]}>{shop.intro || '소개가 아직 등록되지 않았어요.'}</Text>
              {shop.tags?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {shop.tags.map((tag) => (
                    <View key={tag} style={{ backgroundColor: '#F4F1FF', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14 }}>
                      <Text style={t(11.5, '700', '#5a3ad6')}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            {/* info */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
              <View style={{ backgroundColor: '#F7F7F9', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, gap: 9 }}>
                {([
                  ['영업시간', shop.hours || '-', null],
                  ['휴무', shop.closedDays || '-', null],
                  ['전화', shop.phone || '-', shop.phone ? () => Linking.openURL(`tel:${shop.phone!.replace(/[^\d+]/g, '')}`).catch(() => {}) : null],
                  ['인스타그램', ig ? `@${ig}` : '-', ig ? () => openWithFallback(`instagram://user?username=${ig}`, instagramUrl(ig)) : null],
                  ['싱글 카드', shop.single, null],
                  ['오리파 비중', shop.oripa, null],
                  ['가격대', shop.priceLv, null],
                ] as [string, string, (() => void) | null][]).map(([k, v, onPress]) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={t(12.5, '600', MUTED)}>{k}</Text>
                    <Text onPress={onPress ?? undefined} style={[t(12.5, '700', onPress && k === '인스타그램' ? '#5a3ad6' : INK), { flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            {/* 최근 소식 — 인스타그램 프로필 임베드 (공개 계정만 표시됨) */}
            {ig ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={t(16, '800', INK)}>최근 소식</Text>
                  <Text onPress={() => openWithFallback(`instagram://user?username=${ig}`, instagramUrl(ig))} style={t(12, '700', '#5a3ad6')}>@{ig} 인스타그램 →</Text>
                </View>
                <View style={{ height: 540, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F7F7F9' }}>
                  <WebView
                    source={{ uri: instagramEmbedUrl(ig) }}
                    style={{ flex: 1, backgroundColor: '#F7F7F9' }}
                    nestedScrollEnabled
                    setSupportMultipleWindows={false}
                    // 임베드 안 링크(게시물 클릭)는 인스타그램 앱/브라우저로 넘긴다
                    onShouldStartLoadWithRequest={(req) => {
                      if (req.url.includes('/embed')) return true;
                      Linking.openURL(req.url).catch(() => {});
                      return false;
                    }}
                  />
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}
