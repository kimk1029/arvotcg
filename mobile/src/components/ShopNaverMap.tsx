import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TurboModuleRegistry, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Shop 지도 — 네이버 지도 **네이티브 SDK**(Mobile Dynamic Map, @mj-studio/react-native-naver-map)
 * (웹 ShopNaverMap = Web Dynamic Map v3 와 페어 — 핀 칩 모양·선택 색·프레이밍 규칙 동일).
 *
 * 키(NCP Key ID)는 app.json 플러그인이 AndroidManifest/Info.plist 에 굽는다. 앱 식별은
 * 패키지명·번들ID(com.arvotcg.app, NCP 콘솔 Mobile Dynamic Map 등록)로 하므로 JS 에 키가 없다.
 *
 * **구 바이너리 안전장치:** 이 파일이 OTA 로 지도 모듈이 없는 스토어 빌드(≤1.1.6)에 내려가도
 * 죽지 않도록, require 전에 TurboModuleRegistry.get 으로 네이티브 모듈 존재를 확인한다
 * (라이브러리 index 가 getEnforcing 으로 유틸 모듈을 즉시 요구 → try/catch 로 못 잡는 치명 오류.
 *  AdBanner 와 같은 사고 유형, [[ota-native-module-crash]]). 없으면 HAS_NAVER_MAP_KEY=false 로
 * 부모(CommunityShop)가 일러스트 지도 폴백.
 *
 * 좌표: 서버(/api/shops)가 주는 lat/lng 그대로. 네이티브 SDK 엔 지오코더가 없어 주소 보정은
 * 서버가 NCP Geocoding 으로 채운다(server/routes/shops.ts).
 */

export interface ShopMapPin {
  id: string;
  name: string;
  emoji: string;
  addr: string;
  lat: number;
  lng: number;
}

/** 지역 탭 포커스 — 핀이 없을 때 지도를 옮길 중심/줌 (정본 shared/shopRegions.REGION_FOCUS). */
export interface MapFocus {
  lat: number;
  lng: number;
  zoom: number;
}

type NaverMapModule = typeof import('@mj-studio/react-native-naver-map');
let cached: NaverMapModule | null | undefined;
function loadNaverMap(): NaverMapModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (!TurboModuleRegistry.get('RNCNaverMapUtil')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@mj-studio/react-native-naver-map') as NaverMapModule;
  } catch {
    cached = null;
  }
  return cached;
}
/** 네이티브 지도 모듈이 이 바이너리에 있으면 true (이름은 웹 페어 유지 — 부모 분기 키). */
export const HAS_NAVER_MAP_KEY = loadNaverMap() !== null;

// 핀 1개(또는 다닥다닥)일 때 최대 줌까지 들어가지 않게 — 웹 FIT_MAX_ZOOM 과 동일.
const FIT_MAX_ZOOM = 16;
const SEOUL = { latitude: 37.5665, longitude: 126.978 };
// 커스텀 뷰 마커는 width/height 가 필수(라이브러리 주의사항) — 라벨 길이로 폭을 잡는다.
const PIN_H = 36;
function pinWidth(label: string): number {
  return Math.min(170, 44 + label.length * 11);
}

interface Props {
  pins: ShopMapPin[];
  /** 지역 탭 중심. null 이면 핀 전체 프레이밍. */
  focus?: MapFocus | null;
  selId: string;
  onSelect: (id: string) => void;
}

export function ShopNaverMap({ pins, focus = null, selId, onSelect }: Props) {
  const NM = loadNaverMap();
  if (!NM) return null;
  return <NativeShopMap NM={NM} pins={pins} focus={focus} selId={selId} onSelect={onSelect} />;
}

function NativeShopMap({ NM, pins, focus, selId, onSelect }: Props & { NM: NaverMapModule; focus: MapFocus | null }) {
  const { NaverMapView, NaverMapMarkerOverlay } = NM;
  const mapRef = useRef<import('@mj-studio/react-native-naver-map').NaverMapViewRef>(null);
  const [ready, setReady] = useState(false);

  // 웹 fitAll 과 동일: 핀이 있으면 전체 프레이밍(줌 상한), 없으면 지역 포커스 중심/줌.
  const fitAll = () => {
    const m = mapRef.current;
    if (!m) return;
    if (pins.length === 0) {
      m.animateCameraTo({ latitude: focus?.lat ?? SEOUL.latitude, longitude: focus?.lng ?? SEOUL.longitude, zoom: focus?.zoom ?? 12, duration: 300 });
      return;
    }
    const lats = pins.map((p) => p.lat);
    const lngs = pins.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    // 핀이 한 점에 몰려 있으면 두 좌표 프레이밍이 최대 줌까지 들어가므로 중심+상한 줌으로.
    if (maxLat - minLat < 0.003 && maxLng - minLng < 0.003) {
      m.animateCameraTo({ latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2, zoom: FIT_MAX_ZOOM, duration: 300 });
      return;
    }
    m.animateCameraWithTwoCoords({
      coord1: { latitude: minLat, longitude: minLng },
      coord2: { latitude: maxLat, longitude: maxLng },
      duration: 300,
    });
  };

  // 지역 탭 전환 → 핀 교체 + 프레이밍 (웹 syncMarkers 와 동일 동작)
  const pinsKey = pins.map((p) => p.id).join(',');
  useEffect(() => {
    if (ready) fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinsKey, focus?.lat, focus?.lng, focus?.zoom]);

  const first = pins[0];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <NaverMapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialCamera={{ latitude: first?.lat ?? focus?.lat ?? SEOUL.latitude, longitude: first?.lng ?? focus?.lng ?? SEOUL.longitude, zoom: focus?.zoom ?? 12 }}
        minZoom={9}
        maxZoom={19}
        // 웹 fitBounds 패딩과 동일 — 칩이 위로 뻗으므로 top 을 크게.
        mapPadding={{ top: 46, right: 50, bottom: 30, left: 50 }}
        isShowZoomControls={false}
        isShowScaleBar={false}
        isShowCompass={false}
        isShowLocationButton={false}
        isTiltGesturesEnabled={false}
        isRotateGesturesEnabled={false}
        // ScrollView 안 둥근 컨테이너(overflow hidden) — SurfaceView 는 클리핑이 안 돼 TextureView 로.
        isUseTextureViewAndroid
        onInitialized={() => setReady(true)}
      >
        {pins.map((p) => {
          const sel = p.id === selId;
          const label = p.name.split(' ')[0];
          const w = pinWidth(label);
          return (
            // 선택 전환 시 커스텀 뷰를 다시 찍도록 key 에 선택 상태 포함.
            <NaverMapMarkerOverlay
              key={`${p.id}${sel ? '-s' : ''}`}
              latitude={p.lat}
              longitude={p.lng}
              width={w}
              height={PIN_H}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={sel ? 6 : 5}
              isHideCollidedMarkers={false}
              isHideCollidedSymbols
              onTap={() => onSelect(p.id)}
            >
              <View style={{ width: w, height: PIN_H, alignItems: 'center', justifyContent: 'flex-end' }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: sel ? '#16161a' : '#fff', borderWidth: 2, borderColor: '#fff', borderRadius: 16,
                    paddingVertical: 4, paddingHorizontal: 9,
                  }}
                >
                  <Text style={{ fontSize: 11, lineHeight: 13 }}>{p.emoji}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 13, fontWeight: '800', color: sel ? '#fff' : '#16161a' }}>{label}</Text>
                </View>
                <View style={{ width: 2, height: 7, backgroundColor: sel ? '#16161a' : '#fff' }} />
              </View>
            </NaverMapMarkerOverlay>
          );
        })}
      </NaverMapView>
      <Pressable
        onPress={fitAll}
        style={{ position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3 }}
      >
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#16161a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </Svg>
      </Pressable>
    </View>
  );
}
