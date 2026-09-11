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
#   1. 각 워크트리(/home/kimk1029/dev/pf30-ota-<rt>): mobile/node_modules 를 main 의 **하드링크 복사본**으로 맞춘다
#      (심링크 금지 — expo-router 가 app 루트를 실경로 기준으로 계산해 라우트 0개 번들이 나와 실행 즉시 크래시,
#      2026-09-12 사고). main package-lock 이 바뀌었으면 다시 복사.
#   2. 워크트리에 mobile/.ota-base(마지막 동기화 main 커밋) 이후의 mobile/shared 누적 diff 를 3way 적용 → 커밋.
#   3. 런타임마다 `expo export --source-maps` → 소스맵에 app 라우트·src 파일이 있는지 검사(0이면 중단)
#      → `eas update --skip-bundler --input-dir dist` 로 게시.
#   4. u.expo.dev 에 런타임×플랫폼별로 물어 방금 게시한 update id 와 같은지 표로 검증. 다르면 exit 1.
#
# 주의: 네이티브 모듈이 필요한 JS 는 반드시 requireOptionalNativeModule / TurboModuleRegistry.get 가드
#       ([[ota-native-module-crash]]) — 구 런타임엔 그 모듈이 없다. 이 스크립트는 그걸 검사하지 않는다.
#       게시 후엔 구 스토어 APK(store-assets/apk) 를 에뮬레이터에 깔아 첫 실행 OTA 적용·크래시 없음을 확인할 것.
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

# 소스맵에 app 라우트/src 가 들어 있는지 — 0 이면 라우트 없는 껍데기 번들(실행 즉시 "No routes found" 크래시)
check_bundle() { # $1=dist dir, $2=runtime label
  local dist="$1" rt="$2" pf map
  for pf in android ios; do
    map="$(ls "$dist"/_expo/static/js/$pf/*.hbc.map 2>/dev/null | head -1)"
    if [ -z "$map" ]; then echo "!! [$rt] $pf 소스맵 없음" >&2; return 1; fi
    python3 - "$map" "$rt" "$pf" <<'EOF' || return 1
import json, sys
src = json.load(open(sys.argv[1])).get('sources', [])
routes = [s for s in src if '/app/' in s and 'node_modules' not in s]
code = [s for s in src if '/src/' in s and 'node_modules' not in s]
print(f"   [{sys.argv[2]}] {sys.argv[3]}: sources={len(src)} routes={len(routes)} src={len(code)}")
if len(routes) < 10 or len(code) < 10:
    print(f"!! [{sys.argv[2]}] {sys.argv[3]} 번들에 라우트/src 가 없다 — node_modules 심링크? (routes={len(routes)}, src={len(code)})", file=sys.stderr)
    sys.exit(1)
EOF
  done
}

publish() { # $1=dir(mobile), $2=runtime label
  local dir="$1" rt="$2" out
  echo "== export [$rt] ($dir)"
  (cd "$dir" && rm -rf dist && npx expo export -p android -p ios --source-maps --output-dir dist > "$LOG_DIR/$rt.export.log" 2>&1) || { echo "!! [$rt] export 실패 — $LOG_DIR/$rt.export.log" >&2; exit 1; }
  check_bundle "$dir/dist" "$rt" || exit 1
  echo "== eas update [$rt]"
  out="$(cd "$dir" && eas update --branch production --non-interactive --skip-bundler --input-dir dist --message "$MSG ($rt)" 2>&1 | tee "$LOG_DIR/$rt.log" | grep -E 'Runtime version|Update group ID|Android update ID|iOS update ID|Error|error:' || true)"
  echo "$out" | sed 's/^/   /'
  EXPECT_ANDROID[$rt]="$(echo "$out" | grep -o 'Android update ID *[0-9a-f-]*' | grep -o '[0-9a-f-]\{36\}' || true)"
  EXPECT_IOS[$rt]="$(echo "$out" | grep -o 'iOS update ID *[0-9a-f-]*' | grep -o '[0-9a-f-]\{36\}' || true)"
  if [ -z "${EXPECT_ANDROID[$rt]}" ] || [ -z "${EXPECT_IOS[$rt]}" ]; then echo "!! [$rt] 게시 실패 — $LOG_DIR/$rt.log" >&2; exit 1; fi
}

# 워크트리 node_modules — main 의 하드링크 복사본(심링크 금지). lock 이 바뀌었으면 다시 복사.
sync_node_modules() { # $1=worktree mobile dir
  local dir="$1" nm="$1/node_modules" marker="$1/node_modules/.ota-lock-marker" src="$ROOT/mobile/node_modules"
  if [ -L "$nm" ]; then rm "$nm"; fi
  if [ -d "$nm" ] && [ -f "$marker" ] && cmp -s "$marker" "$ROOT/mobile/package-lock.json"; then return 0; fi
  echo "   node_modules 복사 (hardlink) ← $src"
  rm -rf "$nm"; cp -al "$src" "$nm"; cp "$ROOT/mobile/package-lock.json" "$marker"
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
  sync_node_modules "$WT/mobile"
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
