/**
 * 강제 업데이트 판정 — 서버 `/api/app-release` 에 자기 네이티브 빌드번호를 보내고
 * 차단 여부를 그대로 따른다. 판단 로직을 앱에 두지 않는 이유: 사고가 났을 때
 * 앱 배포 없이 서버 DB 의 `enforced` 만 꺼서 즉시 풀 수 있어야 하기 때문.
 *
 * **빌드번호는 반드시 네이티브 값(expo-application)을 쓴다.** `Constants.expoConfig`
 * 의 versionCode/buildNumber 는 OTA 로 교체되는 JS 설정이라, OTA 를 받은 구 바이너리가
 * 새 빌드번호를 자칭하게 되어 비교가 무의미해진다.
 *
 * expo-application 이 없는 구 바이너리(이 기능 도입 이전 빌드)에서는 빌드번호를 못
 * 구한다 → build 를 안 보내고, 서버가 fail-open 으로 통과시킨다. 강제 업데이트는
 * 이 모듈이 들어간 다음 스토어 빌드부터 실효가 있다.
 */
import { Platform } from 'react-native';
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
 * 이 바이너리의 네이티브 빌드번호. 구 바이너리에는 expo-application 자체가 없어
 * require 가 실패하므로 반드시 try 로 감싼다(정적 import 로 두면 앱이 죽는다).
 */
export function nativeBuildNumber(): number | null {
  try {

    const mod = require('expo-application') as { nativeBuildVersion?: string | null };
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
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const build = nativeBuildNumber();
  const qs = new URLSearchParams({ platform });
  if (build != null) qs.set('build', String(build));
  try {
    const j = await api<Partial<AppReleaseCheck>>(`/api/app-release?${qs.toString()}`, { auth: false });
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
