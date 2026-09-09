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

/**
 * 부팅을 잡아두는 최대 시간 — 확인 15s, 다운로드 12s. 넘기면 현재 번들로 진행.
 * 확인이 15s 인 이유: 네이티브 시작 절차(checkOnLaunch=ALWAYS)가 이미 다운로드 중이면 JS 의
 * checkForUpdateAsync 는 같은 직렬 큐 뒤에 줄을 서서 그 다운로드가 끝나야 응답한다. 3s 였을 땐
 * 실기기 망에서 거의 항상 타임아웃 → 조용히 구 번들로 진행 → "OTA 반영 안 됨" (2026-09-09 실측).
 * 업데이트가 없을 땐 네이티브 확인이 1초 안에 끝나므로 평소 부팅은 느려지지 않는다.
 */
const CHECK_BUDGET_MS = 15000;
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
  console.log('[ota] boot applier: started=' + String(started) + ' dev=' + String(__DEV__));
  if (started) return;
  started = true;
  if (__DEV__) return;
  let mod: ExpoUpdatesNative | null = null;
  try {
    mod = requireOptionalNativeModule<ExpoUpdatesNative>('ExpoUpdates');
  } catch {
    mod = null;
  }
  console.log('[ota] module: ' + (mod ? 'enabled=' + String(mod.isEnabled) + ' embedded=' + String(mod.isEmbeddedLaunch) + ' updateId=' + String(mod.updateId) : 'missing'));
  if (!mod || !mod.isEnabled) {
    console.log('[ota] skip: module ' + (mod ? 'disabled' : 'missing'));
    return;
  }
  try {
    const check = await withTimeout(mod.checkForUpdateAsync(), CHECK_BUDGET_MS);
    if (check === 'timeout' || !check.isAvailable) {
      console.log('[ota] no reload: ' + (check === 'timeout' ? 'check timeout' : 'not available (' + String(check.reason) + ')'));
      return;
    }
    const fetched = await withTimeout(mod.fetchUpdateAsync(), FETCH_BUDGET_MS);
    if (fetched === 'timeout') {
      console.log('[ota] no reload: fetch timeout');
      return;
    }
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
