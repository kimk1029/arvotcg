# 모바일 앱 (mobile/) — 구조·설계 규칙

> Expo/RN 네이티브 앱 (WebView 아님). expo-router 파일 기반 라우팅(`mobile/app/**`).

## 빌드 프로파일 ↔ 붙는 서버

API 오리진은 **코드에 하드코딩하지 않는다**. 정본 표는 `/shared/apiEndpoints.ts`,
앱 쪽 진입점은 `mobile/src/lib/apiEnv.ts` 하나뿐이다 (`apiClient`·`cardScanApi` 모두 여기 경유).

| `eas build --profile` | `EXPO_PUBLIC_APP_ENV` | 붙는 서버 |
| --- | --- | --- |
| `stage` | `stage` | **NAS** (Synology `:3031`) |
| `production` | `production` | `EXPO_PUBLIC_API_ORIGIN_PROD`(Vultr) → 미설정 시 NAS 폴백 |
| `development` / `preview` | (없음) | production 과 동일 규칙 |

```bash
eas build --profile stage      --platform android   # → NAS(stage) 붙는 내부 APK
eas build --profile production --platform android   # → 운영
```

- 로컬 dev 는 종전대로 `EXPO_PUBLIC_API_BASE_URL` 이 **최우선** 오버라이드다.
- `stage` 는 `autoIncrement: false` + `distribution: internal` — 스토어 빌드 번호를 건드리지 않는다.
- Vultr 오리진이 확정되면 **코드 수정 없이** `eas.json` production 프로파일 env 에
  `EXPO_PUBLIC_API_ORIGIN_PROD` 만 추가하면 된다.
  전환 순서는 [[migration-order-web-then-app]] 규칙(웹 실측·확정 → 앱)을 따를 것.
- 웹도 같은 스위치를 쓴다(패리티): `NEXT_PUBLIC_APP_ENV=stage` → NAS, 그 외 `API_ORIGIN_PROD`.

## 로컬 시뮬레이터 빌드 (Apple Silicon)

Google ML Kit(`@react-native-ml-kit/text-recognition` → GoogleMLKit 8.0.0) iOS 프레임워크는
arm64 슬라이스가 **기기용뿐**이라 팟이 `EXCLUDED_ARCHS[sdk=iphonesimulator*]=arm64` 를 강제한다.
MLKit 이 링크된 채로는 시뮬레이터 빌드가 x86_64 로만 나와 Apple Silicon 시뮬레이터에 설치가 거부된다.
로컬 시뮬레이터는 ML Kit 네이티브 모듈을 빼고 빌드한다 (`mobile/react-native.config.js` 스위치,
스캔 OCR 은 서버 OCR 기본이라 개발 지장 없음):

```bash
cd mobile
SIM_NO_MLKIT=1 npx pod-install          # 오토링킹에서 ML Kit 제외
SIM_NO_MLKIT=1 npx expo run:ios         # 또는 아래 xcodebuild 직접 빌드
# xcodebuild 가 시뮬레이터 대상을 못 찾을 때(2026-09-09 발생): 기기 지정 없이 빌드 후 simctl 설치
xcodebuild -workspace ios/TCG.xcworkspace -scheme TCG -configuration Debug \
  -sdk iphonesimulator -arch arm64 -derivedDataPath ios/build build
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/TCG.app
xcrun simctl launch booted com.arvotcg.app
xcrun simctl openurl booted "com.arvotcg.app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

- 실기기/EAS 빌드는 env 없이 `pod install` — ML Kit 포함. 실기기로 돌아갈 땐 env 없이 pod install 을 다시 할 것.
- 앱 코드는 ML Kit 을 지연 `require` 하므로(`src/lib/cardCodeOcr.ts`) 모듈이 없어도 부팅엔 영향 없다.

## OTA (EAS Update)

`expo-updates` 사용. `runtimeVersion.policy = appVersion` → **`mobile/app.json` 의 `expo.version`**
(1.1.2 …) 이 런타임 키다. (루트 package.json 을 올리는 pre-commit 훅과는 무관.)
채널은 빌드 프로파일과 1:1: `development` / `preview` / `stage` / `production`
(`production-apk` 도 `production` 채널을 공유).

```bash
cd mobile
npx expo export --platform android --platform ios --source-maps --clear --output-dir dist-ota
node scripts/verify-ota-export.mjs dist-ota android ios
eas update --channel production --input-dir dist-ota --skip-bundler --message "fix: ..."
eas update --channel stage      --message "..."        # 내부 stage APK
```

- OTA 로 갈 수 있는 것: `mobile/src`·`mobile/app`·`/shared` 의 TS/TSX, 이미지 등 번들 에셋.
- 운영 배포는 위 검사를 통과한 산출물을 `--skip-bundler`로 올린다. 환경 변수도 export 시 운영 값으로 설정한다.
  2026-09-08: 1.1.3 작업 폴더의 캐시된 Android 번들에서 앱 라우트 전체가 누락됐지만
  EAS 업로드는 성공했다. `--clear` 재번들링으로 복구했으며, 소스맵의 모든 라우트가
  현재 작업 폴더의 소스와 일치하는지 검사해 누락·오래된 코드 배포를 차단한다.
- **스토어 빌드가 필요한 것**: 네이티브 의존성 추가/버전 변경, app.json 의 plugins·permissions·
  splash·icon 변경, expo SDK 업그레이드. 이때 `expo.version` 을 올리면 런타임이 갈라져
  구버전 앱은 새 OTA 를 받지 않는다(안전). 버전을 안 올리고 네이티브를 바꾸면 크래시 위험.
- 첫 OTA 수신 가능 빌드: 이 설정이 들어간 이후의 `eas build` 부터 (iOS build 27 / Android vc21 이상).
- 앱은 시작 시 자동으로 확인·다운로드 → **다음 콜드 스타트**에 적용된다 (기본 `fallbackToCacheTimeout 0`).

## 레이어

- `mobile/app/**` — 화면(라우트). 데이터 조립 + 화면 고유 레이아웃만.
- `mobile/src/components/cv/**` — 공통 UI 컴포넌트 (아래 표).
- `mobile/src/services/**` — 외부 API fetcher. `snkrdunk.ts`는 `/shared` re-export shim +
  네이티브 fetcher + 모바일 전용 시세탭 헬퍼(PriceMode 등)만. **파서/시세 규칙 재구현 금지**
  → [architecture-shared.md](./architecture-shared.md).
- `mobile/src/lib/**` — 앱 내부 API(myApi 등) + `/shared` shim들(cardRarity/currency 등, 삭제 금지).

## 공통 UI 컴포넌트 (`src/components/cv/`) — 인라인 복붙 대신 이걸 쓴다

| 컴포넌트 | 용도 |
|---|---|
| `ThumbImage` | 썸네일 — 이미지 or 이모지 폴백. `children` 오버레이 슬롯. (CardThumb.tsx는 CardItem 전용 별개) |
| `SnkrdunkCardTile` | 카드 타일 — `variant='grid'|'row'`, priceText null→'시세 없음', priceChip/accentColor |
| `MarketListRow` | 마켓 가로 행(84×84 썸네일+제목 2줄+가격+메타). `fallbackEmoji`, `rightSlot`(찜 별 등) |
| `ListState` (`LoadingState`/`EmptyState`/`ErrorView`) | 로딩·빈·에러 상태 — 인라인 ActivityIndicator 금지 |
| `SectHd`, `PixelText`, `PixelPress`, `ABtn` 등 | 픽셀 UI 기본 요소 |

## 규칙

1. 테마 색은 `useThemeColors()`(tc)·`useThemeTextVariant()`(txt) 훅으로만. 색 하드코딩 금지.
2. 이미지 많은 비가상화 화면은 Fresco 메모리 고갈 유발 — `resizeMethod="resize"` 필수
   (ThumbImage가 기본 지원).
3. 홈은 `CleanHomeScreen.tsx` 하나 (index.tsx의 LegacyHome 함수는 죽은 참조용).
4. 소셜 로그인은 인앱 WebView 인터셉트 방식 — Google은 WebView에서 차단됨.
5. 테스트는 release 빌드로 (Metro 캐시/내장 번들 스테일 함정 — WSL 에뮬레이터 메모 참조).
6. 새 화면에서 3번째 같은 JSX를 복붙하게 되면 cv/ 컴포넌트로 뽑는다.
