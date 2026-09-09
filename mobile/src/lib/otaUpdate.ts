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
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { getApiOrigin } from './apiEnv';
const probe = (tag: string) => { fetch(`${getApiOrigin()}/health?probe=${tag}`).catch(() => {}); };
console.warn('[ota] module init');
probe('init');
let wrapperCalled = false;
// 진단: RootLayout 의 useState(false)/useEffect([bool]) 호출을 관찰 (React CJS exports 패치, 임시).
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react') as Record<string, (...a: unknown[]) => unknown>;
  const origUseState = R.useState;
  const origUseEffect = R.useEffect;
  let seenState = 0;
  let seenEffect = 0;
  const wrappedSetters = new WeakMap<object, unknown>();
  let seenSet = 0;
  R.useState = function (init: unknown) {
    const r = origUseState(init) as [unknown, (v: unknown) => void];
    if (init === false) {
      const orig = r[1] as unknown as object;
      let w = wrappedSetters.get(orig) as ((v: unknown) => void) | undefined;
      if (!w) {
        w = (v: unknown) => {
          if (v === true && seenSet++ < 6) {
            const st = String(new Error().stack ?? '').split('\n').slice(1, 6).join(' | ');
            console.warn('[ota] setState(true) from: ' + st);
          }
          (orig as (v: unknown) => void)(v);
        };
        wrappedSetters.set(orig, w);
      }
      return [r[0], w];
    }
    return r;
  };
  R.useEffect = function (fn: unknown, deps: unknown) {
    if (Array.isArray(deps) && deps.length === 1 && typeof deps[0] === 'boolean' && seenEffect++ < 8) {
      console.warn('[ota] useEffect([bool]) deps=' + String(deps[0]));
    }
    return origUseEffect(fn, deps);
  };
  console.warn('[ota] hook patch installed');
} catch (e) {
  console.warn('[ota] hook patch failed', e instanceof Error ? e.message : e);
}
setTimeout(() => { console.warn('[ota] 8s after module init: wrapperCalled=' + String(wrapperCalled)); probe('t8-' + String(wrapperCalled)); }, 8000);

interface ExpoUpdatesNative {
  isEnabled?: boolean;
  isEmbeddedLaunch?: boolean;
  updateId?: string;
  checkForUpdateAsync: () => Promise<{ isAvailable?: boolean; isRollBackToEmbedded?: boolean; reason?: string }>;
  fetchUpdateAsync: () => Promise<{ isNew?: boolean; isRollBackToEmbedded?: boolean }>;
  reload: (options?: unknown) => Promise<void>;
}

/**
 * 부팅 스피너를 잡아두는 최대 시간(확인+다운로드 합산). 넘기면 현재 번들로 진행하되,
 * 뒤늦게 도착한 결과는 버리지 않고 다음 백그라운드→포그라운드 복귀 때 적용한다.
 *
 * 왜 이렇게 하나 (2026-09-09 에뮬레이터 실측): 네이티브 시작 절차(checkOnLaunch=ALWAYS)가
 * 매니페스트 확인·다운로드 중이면 JS 의 checkForUpdateAsync 는 같은 직렬 큐 뒤에 줄을 서서
 * 그 절차가 끝나야 응답한다. 저속망에선 네이티브 확인만 15~20초라 고정 예산은 어떤 값이어도
 * 실패할 수 있고, 그러면 새 번들은 다음 콜드 스타트에만 붙어 앱을 완전히 종료하지 않는
 * 사용자에겐 영영 안 붙었다. 복귀 시점 적용은 사용자가 어차피 앱을 다시 여는 순간이라
 * 재시작이 자연스럽다(입력 중 강제 리로드 없음).
 */
const BOOT_BUDGET_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve('timeout'), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

let started = false;
let resumeArmed = false;

/** 다음 백그라운드→포그라운드 복귀 때 받아둔 번들로 reload (1회). */
function armReloadOnResume(mod: ExpoUpdatesNative) {
  if (resumeArmed) return;
  resumeArmed = true;
  // iOS 는 알림센터만 내려도 'inactive' 가 오므로 'background' 만 진짜 이탈로 본다.
  let wasBackground = false;
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'background') { wasBackground = true; return; }
    if (state !== 'active' || !wasBackground) return;
    sub.remove();
    console.log('[ota] applying pending update on resume');
    mod.reload(null).catch((e) => console.warn('[ota] resume reload failed', e instanceof Error ? e.message : e));
  });
}

/**
 * 새 OTA 가 있으면 받아서 reload 한다(이 경우 프로미스는 사실상 resolve 되지 않음).
 * 없거나·실패면 resolve → 호출측은 현재 번들로 진행. 예산 초과면 resolve 하되 결과는
 * 계속 기다렸다가 복귀 시 적용. 프로세스당 1회만 동작.
 */
export function applyPendingOtaOnBoot(): Promise<void> {
  wrapperCalled = true;
  console.warn('[ota] wrapper called (sync)');
  probe('wrapper');
  return applyPendingOtaOnBootAsync();
}

async function applyPendingOtaOnBootAsync(): Promise<void> {
  console.warn('[ota] applier enter');
  console.log('[ota] applier started=' + String(started) + ' dev=' + String(__DEV__));
  probe('enter');
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
  if (!mod || !mod.isEnabled) { probe(mod ? 'disabled' : 'nomod'); return; }
  probe('check');
  const m = mod;
  // 확인 → (있으면) 다운로드. isNew=false 여도 true 를 돌려준다 — 네이티브 백그라운드 다운로드가
  // 먼저 끝나 이미 DB 에 있으면 isNew 가 false 로 오는데, 그래도 reload 해야 지금 붙는다.
  const ready: Promise<boolean> = m.checkForUpdateAsync().then(async (check) => {
    if (!check.isAvailable) {
      console.log('[ota] no update (' + String(check.reason) + ')');
      return false;
    }
    const fetched = await m.fetchUpdateAsync();
    console.log('[ota] update fetched (isNew=' + String(fetched.isNew) + ')');
    return true;
  });
  try {
    const r = await withTimeout(ready, BOOT_BUDGET_MS);
    if (r === 'timeout') {
      console.log('[ota] boot budget exceeded — will apply on next resume');
      ready.then((ok) => { if (ok) armReloadOnResume(m); }).catch(() => {});
      return;
    }
    if (!r) return;
    console.log('[ota] reloading');
    await m.reload(null);
  } catch (e) {
    // 네트워크 없음·서버 오류 등 — 조용히 현재 번들로 진행.
    console.warn('[ota] boot check failed', e instanceof Error ? e.message : e);
  }
}
