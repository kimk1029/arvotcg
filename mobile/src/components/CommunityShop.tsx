import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { HAS_NAVER_MAP_KEY, ShopNaverMap } from '@/components/ShopNaverMap';

/**
 * 커뮤니티 Shop 모드 — Claude Design 'POKE30 커뮤니티' 프로토타입의 샵 화면 (네이티브).
 * 지도(핀 선택) · 선택 샵 요약 카드(오리파 도넛·후기 토글·지도앱 링크) ·
 * 후기 작성 폼 · 주변 카드샵 리스트 · 방문 후기 피드(무한 스크롤).
 * 샵/후기 데이터는 프로토타입 정적 편집 데이터. 웹 CommunityShop 과 페어.
 */

export interface ShopPalette {
  pageBg: string;
  cardBg: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  red: string;
  line: string;
  chip: string;
  chev: string;
}

type TsFn = (s: number, w: '400' | '500' | '600' | '700' | '800' | '900', c: string) => object;

const ORANGE = '#FF7A00';
const ORANGE_SOFT = '#FFF1E6';
const STAR = '#FFC53D';

export const SHOP_REGIONS = ['전체', '성수', '홍대', '강남', '왕십리'];

interface ShopInfo {
  id: string;
  name: string;
  official?: boolean;
  addr: string;
  dist: string;
  rating: string;
  reviews: number;
  oripa: string;
  single: string;
  priceLv: string;
  priceColor: string;
  tile: string;
  emoji: string;
  x: number; // 지도 내 % 위치
  y: number;
  /** 네이버 지도 좌표 (근사값 — Geocoder 가 주소 기준으로 보정) */
  lat: number;
  lng: number;
}

const SHOPS: ShopInfo[] = [
  { id: 's1', name: '포켓랩 성수점', official: true, addr: '서울 성동구 연무장길 21', dist: '320m', rating: '4.8', reviews: 214, oripa: '65%', single: '1,240종', priceLv: '저렴', priceColor: '#1E8E5A', tile: '#ff9a33', emoji: '🎁', x: 30, y: 38, lat: 37.5433, lng: 127.0512 },
  { id: 's2', name: '카드킹덤 홍대', official: true, addr: '서울 마포구 와우산로 105', dist: '1.2km', rating: '4.6', reviews: 158, oripa: '40%', single: '2,860종', priceLv: '보통', priceColor: '#16161a', tile: '#5595c8', emoji: '👑', x: 62, y: 30, lat: 37.5535, lng: 126.9256 },
  { id: 's3', name: 'TCG스테이션', addr: '서울 성동구 왕십리로 83', dist: '850m', rating: '4.4', reviews: 96, oripa: '80%', single: '420종', priceLv: '높음', priceColor: '#F5333F', tile: '#7169d9', emoji: '🚉', x: 46, y: 66, lat: 37.557, lng: 127.04 },
  { id: 's4', name: '몬스터카드샵', addr: '서울 광진구 아차산로 200', dist: '2.1km', rating: '4.2', reviews: 61, oripa: '25%', single: '3,150종', priceLv: '저렴', priceColor: '#1E8E5A', tile: '#25c486', emoji: '👾', x: 78, y: 58, lat: 37.5405, lng: 127.0715 },
];

const REVIEW_TAGS = ['오리파 알참', '가격 착함', '응대 친절', '매장 쾌적', '재고 많음'];

interface ReviewItem {
  sid: string;
  avatar: string;
  avBg: string;
  name: string;
  time: string;
  rating: string;
  text: string;
  tags: string[];
}

const REVIEW_POOL: ReviewItem[] = [
  { sid: 's1', avatar: '🐹', avBg: '#ffd069', name: '포케사랑', time: '2시간 전', rating: '5.0', text: '오리파 구성이 진짜 알차요. 리자몽 SAR 뽑고 갑니다 ㅋㅋ 사장님도 친절하세요', tags: ['오리파 알참', '응대 친절'] },
  { sid: 's2', avatar: '🔮', avBg: '#7453bf', name: '뮤츠좋아', time: '5시간 전', rating: '4.5', text: '싱글 카드 종류가 많아서 좋았어요. 시세보다 살짝 저렴한 것도 꽤 있음', tags: ['재고 많음', '가격 착함'] },
  { sid: 's3', avatar: '🌙', avBg: '#2a2a34', name: '블래키킹', time: '어제', rating: '3.5', text: '오리파 위주 매장이라 싱글은 별로 없어요. 오리파는 재밌긴 한데 가격대가 좀 있는 편', tags: ['오리파 알참'] },
  { sid: 's1', avatar: '⚡', avBg: '#f9b52f', name: '피카매니아', time: '어제', rating: '4.5', text: '5만원 오리파에서 피카츄 AR 나왔어요! 구성 공개가 투명해서 믿고 사는 편', tags: ['오리파 알참', '매장 쾌적'] },
  { sid: 's4', avatar: '👾', avBg: '#25c486', name: '겟데이', time: '2일 전', rating: '4.0', text: '싱글 위주 매장. 스탠다드 카드 재고가 압도적으로 많아요. 시세 체크하고 가면 득템 가능', tags: ['재고 많음', '가격 착함'] },
  { sid: 's2', avatar: '🌸', avBg: '#dc99d8', name: '나나미짱', time: '2일 전', rating: '5.0', text: '매장이 넓고 쾌적해요. SR 이상 진열장 구경만 해도 재밌음. 홍대 오면 꼭 들르세요', tags: ['매장 쾌적', '응대 친절'] },
  { sid: 's3', avatar: '🐲', avBg: '#ff7a2f', name: '불꽃수집가', time: '3일 전', rating: '4.0', text: '1만원 오리파 가성비 괜찮아요. 꽝이어도 최소 보장이 있어서 부담 없음', tags: ['오리파 알참'] },
  { sid: 's1', avatar: '🦈', avBg: '#489dd9', name: '카드샤크', time: '3일 전', rating: '4.5', text: '그레이딩 카드 매입도 해줘서 편해요. 매입가도 시세 대비 양호한 편입니다', tags: ['가격 착함', '응대 친절'] },
  { sid: 's4', avatar: '🌊', avBg: '#54a3d2', name: '물타입장인', time: '4일 전', rating: '3.5', text: '오리파는 거의 없지만 싱글 컨디션이 좋아요. 카드 상태 직접 확인하고 살 수 있음', tags: ['재고 많음'] },
  { sid: 's2', avatar: '🌟', avBg: '#ecbe3a', name: '사나피버', time: '5일 전', rating: '4.5', text: 'SR 싱글 시세가 착해요. 여자친구랑 같이 갔는데 입문자한테도 친절하게 설명해주심', tags: ['응대 친절', '가격 착함'] },
];

function shopName(id: string): string {
  return SHOPS.find((s) => s.id === id)?.name ?? '';
}

function OfficialBadge({ s = 15 }: { s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <Path d="M12 1.5 14.8 4l3.7-.4 1 3.6 3.2 1.9-1.6 3.4 1.6 3.4-3.2 1.9-1 3.6-3.7-.4L12 22.5 9.2 20l-3.7.4-1-3.6-3.2-1.9 1.6-3.4L1.3 8.1l3.2-1.9 1-3.6 3.7.4z" fill="#2C8FFF" />
      <Path d="m9 12 2 2 4-4.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const MAP_H = 230;
const PIN_W = 110;
const PIN_H = 35;

export function ShopSection({ P, ts }: { P: ShopPalette; ts: TsFn }) {
  const [shopId, setShopId] = useState('s1');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [myStars, setMyStars] = useState(0);
  const [myTags, setMyTags] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewCount, setReviewCount] = useState(5);
  const [mapW, setMapW] = useState(0);

  const shop = SHOPS.find((s) => s.id === shopId) ?? SHOPS[0];
  const donut = (parseInt(shop.oripa, 10) / 100) * 125.7;

  const selectShop = (id: string) => {
    setShopId(id);
    setReviewOpen(false);
    setSubmitted(false);
    setReviewFilter(id);
    setReviewCount(5);
  };

  // 방문 후기 — 필터된 풀을 3바퀴까지 반복(최대 30개), 스크롤로 4개씩 추가 로드.
  const base = reviewFilter === 'all' ? REVIEW_POOL : REVIEW_POOL.filter((r) => r.sid === reviewFilter);
  const total = Math.min(30, base.length * 3);
  const count = Math.min(reviewCount, total);
  const feedItems: ReviewItem[] = [];
  for (let i = 0; i < count; i++) {
    const r = base[i % base.length];
    feedItems.push({ ...r, time: i < base.length ? r.time : `${i - base.length + 6}일 전` });
  }
  const hasMore = count < total;

  const filters = [{ id: 'all', label: '전체' }, ...SHOPS.map((s) => ({ id: s.id, label: s.name }))];

  const card = { backgroundColor: P.cardBg, borderRadius: 16 } as const;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={120}
      onScroll={(e) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (hasMore && contentOffset.y + layoutMeasurement.height > contentSize.height - 140) {
          setReviewCount((c) => Math.min(30, c + 4));
        }
      }}
    >
      {/* map — 네이버 지도 (키 미설정 시 일러스트 지도 폴백) */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <View
          onLayout={(e) => setMapW(e.nativeEvent.layout.width)}
          style={{ position: 'relative', height: MAP_H, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E8EDE6' }}
        >
          {HAS_NAVER_MAP_KEY ? (
            <ShopNaverMap pins={SHOPS} selId={shopId} onSelect={selectShop} />
          ) : (
            <>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 74, height: 13, backgroundColor: '#fff' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 158, height: 9, backgroundColor: '#fff', transform: [{ rotate: '-4deg' }] }} />
          <View style={{ position: 'absolute', top: -20, bottom: -20, left: 96, width: 11, backgroundColor: '#fff', transform: [{ rotate: '6deg' }] }} />
          <View style={{ position: 'absolute', top: 0, bottom: 0, right: 104, width: 9, backgroundColor: '#fff' }} />
          <View style={{ position: 'absolute', left: 14, top: 16, width: 64, height: 44, borderRadius: 8, backgroundColor: '#D3DFCE' }} />
          <View style={{ position: 'absolute', right: 20, top: 104, width: 78, height: 40, borderRadius: 8, backgroundColor: '#C9DBEF' }} />
          <View style={{ position: 'absolute', left: 30, bottom: 18, width: 90, height: 34, borderRadius: 8, backgroundColor: '#D3DFCE' }} />
          {mapW > 0 && SHOPS.map((s) => {
            const sel = s.id === shopId;
            return (
              <Pressable
                key={s.id}
                onPress={() => selectShop(s.id)}
                style={{ position: 'absolute', left: (mapW * s.x) / 100 - PIN_W / 2, top: (MAP_H * s.y) / 100 - PIN_H, width: PIN_W, alignItems: 'center', zIndex: sel ? 6 : 5 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: sel ? '#16161a' : '#fff', borderWidth: 2, borderColor: '#fff', borderRadius: 16, paddingVertical: 4, paddingHorizontal: 9 }}>
                  <Text style={{ fontSize: 11 }}>{s.emoji}</Text>
                  <Text style={ts(11, '800', sel ? '#fff' : '#16161a')}>{s.name.split(' ')[0]}</Text>
                </View>
                <View style={{ width: 2, height: 7, backgroundColor: sel ? '#16161a' : '#fff' }} />
              </Pressable>
            );
          })}
          <View style={{ position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#16161a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </Svg>
          </View>
            </>
          )}
        </View>
      </View>

      {/* selected shop compact card */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <View style={[card, { paddingVertical: 12, paddingHorizontal: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <Svg width={52} height={52} viewBox="0 0 52 52">
              <Circle cx={26} cy={26} r={20} fill="none" stroke={P.chip} strokeWidth={7} />
              <Circle cx={26} cy={26} r={20} fill="none" stroke={ORANGE} strokeWidth={7} strokeDasharray={`${donut} 125.7`} transform="rotate(-90 26 26)" strokeLinecap="round" />
              <SvgText x={26} y={30} textAnchor="middle" fontSize={11} fontWeight="800" fill={P.ink}>{shop.oripa}</SvgText>
            </Svg>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text numberOfLines={1} style={[ts(14.5, '800', P.ink), { flexShrink: 1 }]}>{shop.name}</Text>
                {shop.official ? <OfficialBadge /> : null}
                <Text style={ts(12, '800', P.ink)}><Text style={{ color: STAR }}>★</Text> {shop.rating}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: ORANGE_SOFT, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6 }}>
                  <Text style={ts(10.5, '800', ORANGE)}>오리파 {shop.oripa}</Text>
                </View>
                <View style={{ backgroundColor: P.chip, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6 }}>
                  <Text style={ts(10.5, '700', P.ink3)}>싱글 {shop.single}</Text>
                </View>
                <View style={{ backgroundColor: P.chip, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6 }}>
                  <Text style={ts(10.5, '800', shop.priceColor)}>시세 {shop.priceLv}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={[ts(11, '600', P.ink3), { marginTop: 5 }]}>{shop.addr} · 후기 {shop.reviews}</Text>
            </View>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              <Pressable onPress={() => { setReviewOpen((v) => !v); setSubmitted(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.ink, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={P.cardBg} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 20h9" /><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </Svg>
                <Text style={ts(11.5, '800', P.cardBg)}>후기</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => Linking.openURL('https://tmap.life')} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#5f28da', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff', fontStyle: 'italic' }}>T</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL(`https://map.naver.com/p/search/${encodeURIComponent(shop.name)}`)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#03C75A', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={13} height={13} viewBox="0 0 24 24">
                    <Path d="M12 2C7.6 2 4 5.5 4 9.9c0 5.4 7 11.5 7.7 12.1a.5.5 0 0 0 .6 0C13 21.4 20 15.3 20 9.9 20 5.5 16.4 2 12 2Z" fill="#fff" />
                    <Circle cx={12} cy={10} r={3} fill="#03C75A" />
                  </Svg>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* review form (toggle) */}
      {reviewOpen ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          <View style={[card, { borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: '#FFE0C2' }]}>
            <Text style={ts(14.5, '800', P.ink)}>{shop.name} 후기 남기기</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setMyStars(n)} hitSlop={4}>
                  <Text style={{ fontSize: 26, color: n <= myStars ? STAR : '#E5E5EA' }}>★</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {REVIEW_TAGS.map((label) => {
                const on = !!myTags[label];
                return (
                  <Pressable key={label} onPress={() => setMyTags((t) => ({ ...t, [label]: !t[label] }))} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: on ? ORANGE_SOFT : P.cardBg, borderWidth: 1.5, borderColor: on ? ORANGE : '#E5E5EA' }}>
                    <Text style={ts(12, '700', on ? ORANGE : P.ink3)}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              placeholder="오리파 구성, 가격, 응대 등 경험을 알려주세요"
              placeholderTextColor={P.ink3}
              multiline
              style={[ts(13, '500', P.ink), { marginTop: 12, backgroundColor: P.pageBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64, textAlignVertical: 'top' }]}
            />
            <Pressable onPress={() => { if (myStars) setSubmitted(true); }} style={{ marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: submitted ? '#2BB673' : ORANGE, borderRadius: 12, paddingVertical: 12 }}>
              <Text style={ts(13.5, '800', '#fff')}>{submitted ? '후기 등록 완료!' : '후기 등록'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* shop list */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 }}>
        <Text style={ts(16, '800', P.ink)}>주변 카드샵 <Text style={{ color: P.ink3 }}>12</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={ts(12.5, '700', P.ink)}>평점순</Text>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="m6 9 6 6 6-6" /></Svg>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={[card, { overflow: 'hidden' }]}>
          {SHOPS.map((s, i) => {
            const sel = s.id === shopId;
            return (
              <Pressable key={s.id} onPress={() => selectShop(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: P.line, backgroundColor: sel ? '#FFF9F4' : P.cardBg }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: s.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 21 }}>{s.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={ts(14, '800', P.ink)}>{s.name}</Text>
                    {s.official ? <OfficialBadge s={14} /> : null}
                    <Text style={ts(11, '700', P.ink3)}>{s.dist}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Text style={ts(12, '800', P.ink)}><Text style={{ color: STAR }}>★</Text> {s.rating}</Text>
                    <Text style={ts(11.5, '600', P.ink3)}>후기 {s.reviews}</Text>
                    <View style={{ backgroundColor: ORANGE_SOFT, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6 }}>
                      <Text style={ts(11, '800', ORANGE)}>오리파 {s.oripa}</Text>
                    </View>
                  </View>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={P.chev} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="m9 6 6 6-6 6" /></Svg>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* visit review feed */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
        <Text style={ts(16, '800', P.ink)}>방문 후기</Text>
        <Text style={ts(12, '600', P.ink3)}>{reviewFilter === 'all' ? `전체 ${total}개` : `${shopName(reviewFilter)} ${total}개`}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingBottom: 12 }}>
        {filters.map((f) => {
          const on = reviewFilter === f.id;
          return (
            <Pressable key={f.id} onPress={() => { setReviewFilter(f.id); setReviewCount(5); }} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 16, backgroundColor: on ? P.ink : P.cardBg }}>
              <Text style={ts(12, '700', on ? P.cardBg : P.ink3)}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <View style={card}>
          {feedItems.map((rv, i) => (
            <View key={`${rv.sid}-${rv.name}-${i}`} style={{ paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: P.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: rv.avBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>{rv.avatar}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={ts(13, '800', P.ink)}>{rv.name}</Text>
                    <Text style={ts(11, '500', P.ink3)}>{rv.time}</Text>
                  </View>
                  <Text style={[ts(11.5, '700', ORANGE), { marginTop: 1 }]}>{shopName(rv.sid)}</Text>
                </View>
                <Text style={ts(12.5, '800', P.ink)}><Text style={{ color: STAR }}>★</Text> {rv.rating}</Text>
              </View>
              <Text style={[ts(13, '400', P.ink2), { marginTop: 9 }]}>{rv.text}</Text>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 9 }}>
                {rv.tags.map((tg) => (
                  <View key={tg} style={{ backgroundColor: P.chip, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 }}>
                    <Text style={ts(10.5, '700', P.ink3)}>{tg}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
        {hasMore ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingTop: 16, paddingBottom: 4 }}>
            {(['#D2D2D8', '#C2C2C8', '#B0B0B6'] as const).map((c, i) => (
              <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
            ))}
            <Text style={[ts(11.5, '600', P.ink3), { marginLeft: 4 }]}>스크롤하면 더 불러와요</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
