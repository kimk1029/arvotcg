/**
 * OTA(EAS Update) 부팅 적용.
 *
 * expo-updates 기본 동작은 "구 번들로 뜨고 → 백그라운드 다운로드 → **다음** 실행에 적용"이라
 * 사용자는 한 번 더 완전 종료·재실행해야 새 번들을 본다(iOS 27 "OTA 안 됨" 문의, 2026-09-06).
 * 여기서는 부팅 스피너 동안 직접 확인·다운로드하고 새 번들이 있으면 즉시 reload 해서
 * **첫 실행에** 반영한다. 시간 예산을 넘기면 현재 번들로 그냥 진행(네이티브 백그라운드
 * 다운로드는 계속되므로 늦어도 다음 실행엔 적용).
 *
 * 네이티브 모듈 접근은 [[ota-native-module-crash]] 규칙대로 expo-modules-core 의
 * `requireOptionalNativeModule('ExpoUpdates')` 로만 한다 — expo-updates 패키지 JS 는
 * 로드 시 `requireNativeModule` 을 호출해 모듈 없는 바이너리에서 던진다.
 * (OTA 채널이 있는 빌드 = iOS 27+/Android vc21+ 는 전부 expo-updates 를 내장하지만, 방어적으로.)
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

interface ExpoUpdatesNative {
  isEnabled?: boolean;
  isEmbeddedLaunch?: boolean;
  updateId?: string;
  checkForUpdateAsync: () => Promise<{ isAvailable?: boolean; isRollBackToEmbedded?: boolean; reason?: string }>;
  fetchUpdateAsync: () => Promise<{ isNew?: boolean; isRollBackToEmbedded?: boolean }>;
  reload: (options?: unknown) => Promise<void>;
}

/** 부팅을 잡아두는 최대 시간 — 확인 3s, 다운로드 12s. 넘기면 현재 번들로 진행. */
const CHECK_BUDGET_MS = 3000;
const FETCH_BUDGET_MS = 12000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve('timeout'), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

let started = false;

/**
 * 새 OTA 가 있으면 받아서 reload 한다(이 경우 프로미스는 사실상 resolve 되지 않음).
 * 없거나·실패·시간 초과면 resolve → 호출측은 현재 번들로 진행.
 * 프로세스당 1회만 동작.
 */
export async function applyPendingOtaOnBoot(): Promise<void> {
  if (started) return;
  started = true;
  if (__DEV__) return;
  let mod: ExpoUpdatesNative | null = null;
  try {
    mod = requireOptionalNativeModule<ExpoUpdatesNative>('ExpoUpdates');
  } catch {
    mod = null;
  }
  if (!mod || !mod.isEnabled) return;
  try {
    const check = await withTimeout(mod.checkForUpdateAsync(), CHECK_BUDGET_MS);
    if (check === 'timeout' || !check.isAvailable) return;
    const fetched = await withTimeout(mod.fetchUpdateAsync(), FETCH_BUDGET_MS);
    if (fetched === 'timeout') return;
    // isNew=false 여도 reload 한다 — 네이티브 백그라운드 다운로드가 먼저 끝나 이미 DB 에 있으면
    // isNew 가 false 로 오는데, 그때 건너뛰면 새 번들은 '다음 콜드 스타트'에만 붙고 앱을
    // 백그라운드로만 보내는 사용자에겐 영영 안 붙는다 (2026-09-09 에뮬레이터 실측).
    console.log('[ota] update fetched (isNew=' + String(fetched.isNew) + ') — reloading');
    await mod.reload(null);
  } catch (e) {
    // 네트워크 없음·서버 오류 등 — 조용히 현재 번들로 진행.
    console.warn('[ota] boot check failed', e instanceof Error ? e.message : e);
  }
}
