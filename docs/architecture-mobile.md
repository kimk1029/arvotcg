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

## OTA (EAS Update)

`expo-updates` 사용. `runtimeVersion.policy = appVersion` → **`mobile/app.json` 의 `expo.version`**
(1.1.2 …) 이 런타임 키다. (루트 package.json 을 올리는 pre-commit 훅과는 무관.)
채널은 빌드 프로파일과 1:1: `development` / `preview` / `stage` / `production`
(`production-apk` 도 `production` 채널을 공유).

```bash
cd mobile
eas update --channel production --message "fix: ..."   # JS/에셋만 바뀐 배포 → 스토어 없이 반영
eas update --channel stage      --message "..."        # 내부 stage APK
```

- OTA 로 갈 수 있는 것: `mobile/src`·`mobile/app`·`/shared` 의 TS/TSX, 이미지 등 번들 에셋.
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
