#!/usr/bin/env bash
# OTA 를 **모든 런타임**(main + release/ota-* 워크트리)에 한 번에 게시하고 서빙 결과를 검증한다.
#
#   scripts/ota-all.sh "27차: 무엇을 바꿨는지"
#
# 왜: runtimeVersion=appVersion 이라 main 에서 `eas update` 를 쏘면 현재 app.json 버전(예 1.1.7)
#     런타임에만 나간다. 스토어 빌드가 1.1.3~1.1.6 인 사용자는 각 버전 워크트리에서 따로 쏴야 받는데,
#     이걸 빠뜨려 "적용 안 됨" 이 반복됐다(2026-09-08·09·10·12). 그래서 main 에서 직접 `eas update` 금지,
#     항상 이 스크립트로.
#
# 동작:
#   1. main(mobile/)에서 eas update.
#   2. 각 워크트리(/home/kimk1029/dev/pf30-ota-<rt>): mobile/.ota-base 에 적힌 main 커밋 이후의
#      mobile/shared 누적 diff(app.json·version.ts·lock 제외)를 `git apply --3way` 로 적용 → 충돌이면 중단
#      → 커밋(.ota-base 를 main HEAD 로 갱신) → eas update.
#   3. u.expo.dev 에 런타임×플랫폼별로 물어 방금 게시한 update id 와 같은지 표로 검증. 하나라도 다르면 exit 1.
#
# 주의: 네이티브 모듈이 필요한 JS 는 반드시 requireOptionalNativeModule / TurboModuleRegistry.get 가드
#       ([[ota-native-module-crash]]) — 구 런타임엔 그 모듈이 없다. 이 스크립트는 그걸 검사하지 않는다.
set -euo pipefail

MSG="${1:-}"
if [ -z "$MSG" ]; then echo "usage: scripts/ota-all.sh \"<message>\"" >&2; exit 2; fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="$(python3 -c "import json;print(json.load(open('$ROOT/mobile/app.json'))['expo']['extra']['eas']['projectId'])")"
MAIN_HEAD="$(git -C "$ROOT" rev-parse --short=7 HEAD)"
LOG_DIR="${OTA_LOG_DIR:-/tmp/ota-all}"; mkdir -p "$LOG_DIR"
if [ -n "$(git -C "$ROOT" status --porcelain -- mobile shared)" ]; then
  echo "!! main 의 mobile/shared 에 커밋 안 된 변경이 있다. 먼저 커밋할 것." >&2; exit 2
fi

declare -A EXPECT_ANDROID EXPECT_IOS
publish() { # $1=dir(mobile), $2=runtime label
  local dir="$1" rt="$2" out
  echo "== eas update [$rt] ($dir)"
  out="$(cd "$dir" && eas update --branch production --non-interactive --message "$MSG ($rt)" 2>&1 | tee "$LOG_DIR/$rt.log" | grep -E 'Runtime version|Update group ID|Android update ID|iOS update ID|Error|error:' || true)"
  echo "$out" | sed 's/^/   /'
  EXPECT_ANDROID[$rt]="$(echo "$out" | grep -o 'Android update ID *[0-9a-f-]*' | grep -o '[0-9a-f-]\{36\}' || true)"
  EXPECT_IOS[$rt]="$(echo "$out" | grep -o 'iOS update ID *[0-9a-f-]*' | grep -o '[0-9a-f-]\{36\}' || true)"
  if [ -z "${EXPECT_ANDROID[$rt]}" ]; then echo "!! [$rt] 게시 실패 — $LOG_DIR/$rt.log" >&2; exit 1; fi
}

# 1) main
MAIN_RT="$(python3 -c "import json;print(json.load(open('$ROOT/mobile/app.json'))['expo']['version'])")"
publish "$ROOT/mobile" "$MAIN_RT"

# 2) 워크트리들
for WT in "$(dirname "$ROOT")"/pf30-ota-*; do
  [ -d "$WT/mobile" ] || continue
  RT="$(python3 -c "import json;print(json.load(open('$WT/mobile/app.json'))['expo']['version'])")"
  BASE_FILE="$WT/mobile/.ota-base"
  if [ ! -f "$BASE_FILE" ]; then echo "!! $BASE_FILE 없음 — 마지막으로 동기화한 main 커밋을 적어 둘 것" >&2; exit 2; fi
  BASE="$(tr -d '[:space:]' < "$BASE_FILE")"
  echo "== sync [$RT] $BASE..$MAIN_HEAD → $WT"
  if [ -n "$(git -C "$WT" status --porcelain)" ]; then echo "!! $WT 에 커밋 안 된 변경이 있다" >&2; exit 2; fi
  PATCH="$LOG_DIR/$RT.patch"
  git -C "$ROOT" diff "$BASE" "$MAIN_HEAD" -- mobile shared ':!shared/version.ts' ':!mobile/app.json' ':!mobile/.ota-base' ':!mobile/package-lock.json' > "$PATCH"
  if [ -s "$PATCH" ]; then
    if ! git -C "$WT" apply --3way "$PATCH"; then
      echo "!! [$RT] 패치 충돌 — $WT 에서 수동 해결 후 다시 실행 (git -C $WT status)" >&2; exit 1
    fi
    if grep -rl '^<<<<<<<' "$WT/mobile/src" "$WT/mobile/app" "$WT/shared" 2>/dev/null | head -1 | grep -q .; then
      echo "!! [$RT] 충돌 마커가 남아 있다" >&2; exit 1
    fi
    echo "$MAIN_HEAD" > "$BASE_FILE"
    git -C "$WT" add -A mobile shared
    git -C "$WT" commit -q -m "($RT) OTA sync main $BASE..$MAIN_HEAD — $MSG"
    (cd "$WT/mobile" && npx tsc --noEmit >/dev/null 2>&1) || { echo "!! [$RT] tsc 실패 — $WT/mobile 에서 확인" >&2; exit 1; }
  else
    echo "   (변경 없음 — 그래도 게시)"
  fi
  publish "$WT/mobile" "$RT"
done

# 3) 검증
echo "== verify (u.expo.dev)"
FAIL=0
for RT in "${!EXPECT_ANDROID[@]}"; do
  for PF in android ios; do
    GOT="$(curl -s "https://u.expo.dev/$PROJECT_ID" -H "expo-runtime-version:$RT" -H "expo-channel-name:production" -H "expo-platform:$PF" -H "accept: multipart/mixed" | grep -ao '"id":"[0-9a-f-]*"' | head -1 | grep -o '[0-9a-f-]\{36\}' || true)"
    if [ "$PF" = android ]; then WANT="${EXPECT_ANDROID[$RT]}"; else WANT="${EXPECT_IOS[$RT]}"; fi
    if [ "$GOT" = "$WANT" ]; then echo "   OK   $RT $PF $GOT"; else echo "   FAIL $RT $PF served=$GOT expected=$WANT"; FAIL=1; fi
  done
done
[ "$FAIL" = 0 ] && echo "== ALL RUNTIMES UP TO DATE ($MAIN_HEAD)" || { echo "!! 일부 런타임이 최신이 아니다" >&2; exit 1; }
