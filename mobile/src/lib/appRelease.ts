/**
 * 강제 업데이트 판정 — 서버 `/api/app-release` 에 자기 네이티브 빌드번호를 보내고
 * 차단 여부를 그대로 따른다. 판단 로직을 앱에 두지 않는 이유: 사고가 났을 때
 * 앱 배포 없이 서버 DB 의 `enforced` 만 꺼서 즉시 풀 수 있어야 하기 때문.
 *
 * **빌드번호는 반드시 네이티브 값을 쓴다.** `Constants.expoConfig` 의
 * versionCode/buildNumber 는 OTA 로 교체되는 JS 설정이라, OTA 를 받은 구 바이너리가
 * 새 빌드번호를 자칭하게 되어 비교가 무의미해진다.
 *
 * **`expo-application` 패키지를 import 하지 않는다** — 그 패키지의 JS 는 로드되는 순간
 * `requireNativeModule('ExpoApplication')` 을 호출하고, 네이티브 모듈이 없으면 던진다.
 * OTA 는 JS 만 교체하므로 이 코드가 구 바이너리로 내려가면 앱이 뜨자마자 죽는다
 * (2026-09-06 실제 사고). 대신 모든 바이너리에 들어 있는 expo-modules-core 의
 * `requireOptionalNativeModule` 로 직접 물어본다 — 없으면 던지지 않고 null 을 준다.
 *
 * 네이티브 모듈이 없는 구 바이너리는 빌드번호를 못 구한다 → build 를 안 보내고,
 * 서버가 fail-open 으로 통과시킨다. 강제 업데이트는 다음 스토어 빌드부터 실효.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { api } from './apiClient';

export interface AppReleaseCheck {
  updateRequired: boolean;
  latestBuild: number | null;
  version: string | null;
  storeUrl: string | null;
  message: string | null;
}

const PASS: AppReleaseCheck = {
  updateRequired: false,
  latestBuild: null,
  version: null,
  storeUrl: null,
  message: null,
};

/**
 * 이 바이너리의 네이티브 빌드번호 (android versionCode / ios buildNumber).
 * 네이티브 모듈이 없는 구 바이너리에서는 null — 던지지 않는다.
 */
export function nativeBuildNumber(): number | null {
  try {
    const mod = requireOptionalNativeModule<{ nativeBuildVersion?: string | null }>('ExpoApplication');
    const raw = mod?.nativeBuildVersion;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** 서버에 물어본다. 네트워크·서버 오류는 전부 통과 처리(앱을 막지 않는다). */
export async function checkAppRelease(): Promise<AppReleaseCheck> {
  // 전부 try 안에서 — 이 함수는 부팅 경로라 어떤 이유로도 던지면 안 된다.
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const build = nativeBuildNumber();
    const qs = build != null ? `platform=${platform}&build=${build}` : `platform=${platform}`;
    const j = await api<Partial<AppReleaseCheck>>(`/api/app-release?${qs}`, { auth: false });
    return {
      updateRequired: j.updateRequired === true,
      latestBuild: typeof j.latestBuild === 'number' ? j.latestBuild : null,
      version: typeof j.version === 'string' ? j.version : null,
      storeUrl: typeof j.storeUrl === 'string' ? j.storeUrl : null,
      message: typeof j.message === 'string' ? j.message : null,
    };
  } catch {
    return PASS;
  }
}
