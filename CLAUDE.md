# ARVOTCG (pokefesta30) — 개발 규칙

TCG 카드 시세 서비스. 웹(Next.js, Vercel) + 모바일(Expo RN) + NAS 서버(Express) + Supabase DB.
인프라 식별자(pm2명·패키지ID 등)는 구명칭 pokefesta30 유지.

## 아키텍처 문서 — 코드 작성 전 해당 영역 문서를 먼저 따를 것

- 공통 로직(`/shared`): [docs/architecture-shared.md](docs/architecture-shared.md) — **모든 순수 로직의 정본. 재구현 절대 금지.**
- 웹(`src/`): [docs/architecture-web.md](docs/architecture-web.md)
- 모바일(`mobile/`): [docs/architecture-mobile.md](docs/architecture-mobile.md)
- 서버(`server/`): [docs/architecture-server.md](docs/architecture-server.md)

## 핵심 규칙 (요약)

0. **웹↔앱 완전 패리티 (모든 작업의 전제)**: 웹(Next.js)과 앱(Expo RN)은 **똑같은 UI,
   똑같은 프론트 로직, 똑같은 플로우**(로그인/인증 포함)로 구현한다. 서버는 공통 서버 하나.
   한쪽만 고치라는 지시여도 **반대쪽에 같은 변경을 같은 작업에서 함께 적용**한다.
   플랫폼 특성상 불가능한 것(iOS ATS, SEO 메타 등)만 예외이며 사유를 커밋에 남긴다.
1. **단일 소스**: 플랫폼 공통 순수 로직(시세 계산·파서·번역·KST·포맷)은 `/shared`에만.
   `src/lib/*`·`mobile/src/{lib,services}/*`의 shim(re-export) 파일은 삭제 금지.
2. **재사용 우선**: 화면 작성 시 기존 공통 컴포넌트(웹 `CardThumb`/`PackGridCard`/`PriceChip`,
   앱 `cv/ThumbImage`/`SnkrdunkCardTile`/`MarketListRow`/`ListState`)를 먼저 쓴다.
   같은 JSX를 3번째 복붙하게 되면 컴포넌트로 뽑는다.
3. **테마**: 웹은 CSS 변수, 앱은 tc/txt 훅 — 색 하드코딩 금지.
4. **배포**: main push = 자동 배포 (웹→Vercel, server→NAS, schema→Supabase).
   변경 후 검증(tsc 3개 워크스페이스: 루트/server/mobile 각각 `npx tsc --noEmit`) → 커밋 → push.
   **버전**: `githooks/pre-commit`이 커밋마다 package.json patch +1 → 상단 StatusBar `v1.1.x` 표시.
   클론 후 1회 `git config core.hooksPath githooks` 필요. 버전을 수동으로 만지지 말 것.
5. **스크레이퍼**: 안티봇 대상(KREAM 등)은 NAS server 라우트로만 (Vercel IP 차단됨).
6. **삭제**: importer 0 을 실제 검색으로 확인하기 전엔 파일 삭제 금지.
