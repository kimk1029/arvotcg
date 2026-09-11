/**
 * 현재 위치 1회 취득 — 카드샵 '내 주변' 프레이밍용 (웹 CommunityShop 의 navigator.geolocation 페어).
 *
 * expo-location 은 네이티브 모듈이라 [[ota-native-module-crash]] 규칙대로 `requireOptionalNativeModule`
 * 로 존재를 먼저 확인하고 require 한다 — 모듈 없는 스토어 빌드(≤1.1.7)에 OTA 로 내려가도 null 만
 * 돌려주고(전체 프레이밍 폴백) 죽지 않는다. 권한 거부·타임아웃·오류도 전부 null.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface LatLng {
  lat: number;
  lng: number;
}

type LocationModule = typeof import('expo-location');

function loadLocation(): LocationModule | null {
  try {
    if (!requireOptionalNativeModule('ExpoLocation')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as LocationModule;
  } catch {
    return null;
  }
}

export async function getCurrentOrigin(): Promise<LatLng | null> {
  const L = loadLocation();
  if (!L) return null;
  try {
    const perm = await L.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const toOrigin = (p: { coords: { latitude: number; longitude: number } } | null) => (p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null);
    // 1) 5분 내 마지막 위치면 즉시 (지도 첫 프레이밍 지연 최소화)
    const fresh = await L.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    if (fresh) return toOrigin(fresh);
    // 2) 현재 위치 — 기기/에뮬레이터에 따라 영영 안 끝나는 경우가 있어 6초 타임아웃 (2026-09-12 실측: origin 이 안 들어와 전국 프레이밍)
    const cur = await Promise.race([
      L.getCurrentPositionAsync({ accuracy: L.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    if (cur) return toOrigin(cur);
    // 3) 오래된 마지막 위치라도 없는 것보단 낫다
    return toOrigin(await L.getLastKnownPositionAsync());
  } catch {
    return null;
  }
}
