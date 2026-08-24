# /shared — 공통 로직 단일 소스 (정본)

> 웹(src/)·모바일(mobile/)·NAS 서버(server/)가 함께 쓰는 **플랫폼 무관 순수 TS**의 정본.
> **같은 로직을 두 번 구현하지 않는다** — 과거 모바일이 웹 시세 로직을 복제하며 규칙이
> 어긋나(같은 카드에 다른 가격) 버그가 났고, 2026-07-20 대통합으로 제거했다.

## 무엇이 어디에 있나

| 파일 | 내용 |
|---|---|
| `snkrdunk.ts` | 스니덩크 타입, raw→Apparel 변환, 싱글/박스 분류, **검색 SSR HTML 파서**, 일→한 로컬라이즈, 등급배지 판정, 차트 다운샘플 |
| `snkrdunkPrice.ts` | **시세 계산 규칙 전부** — computeApparelPrices(최근 7건 중앙값+등급오염 2.5배 컷), registerBasisJpy(등록가), headlinePriceFromHistory, trendChangePct |
| `cardTranslate.ts` | 카드명 한/영/일 번역 엔진 (작품별 TERMS_BY_GAME) |
| `cardStatics.ts` | 카드명/품번 → 게임·세트코드·카드번호·레어도 파싱 (**DB 적재용**) |
| `cardRarity.ts` | **게임별 등급 사다리**(RARITY_LADDER_BY_GAME — 포켓몬/원피스/유희왕 각각 높은등급순) + 라벨·색 표(RARITY_META) + 상품명에서 등급 토큰 추출 (**화면 표시용**: 필터 칩·배지) |
| `currency.ts` | 통화 모드(¥/₩)·환율 포맷 formatPrice |
| `numberFormat.ts` | 천단위 콤마 포맷 |
| `rewards.ts` | 활동별 포인트 보상표 |
| `kst.ts` | KST 날짜 유틸 (kstDayStart/kstDateKey/isSameKstDay/kstDayDiff) — 고정 +9h, DST 없음 |
| `util/shortenName.ts` | 카드명 축약 (기본 22자, maxLen 인자) |
| `util/kreamMatch.ts` `util/autoPriceSize.ts` `util/color.ts` | KREAM 매칭, 가격 폰트 자동축소, 색 혼합(mixHex) |
| `data/*` | 카드팩 메타, 포켓몬 한/일 이름, 세트코드 등 정적 데이터 |

## 규칙

1. **여기 있는 로직은 절대 재구현하지 않는다.** 특히 검색 HTML 파서와 시세 계산 —
   과거 중복 사본이 "API 미등록"·검색누락 버그의 원인.
2. **플랫폼 코드는 shim으로 접근한다.** `src/lib/snkrdunk.ts`(웹), `mobile/src/services/snkrdunk.ts`(앱)는
   `export * from '../../shared/...'` + 플랫폼 fetcher만 보유. **shim 파일 삭제 금지**
   (기존 import 경로 호환용).
3. **새 공용 로직이 생기면 여기에 먼저 만든다.** 순수 TS(브라우저/RN/Node API 미사용)만 —
   fetch 캐싱·localStorage·kvStore 등 플랫폼 의존부는 각 shim에 남긴다.
4. 여기 규칙(가격 산정 등)을 바꾸면 웹·앱·서버가 동시에 바뀐다 — 3곳 모두 영향 검토 후 수정.
5. 예외: `admin/src/lib/prices.ts`(아바타/배경/프레임 가격표)는 admin이 메인 코드를
   import하지 않는 독립 앱이라 아직 수동 미러 — 값 변경 시 양쪽 수정.
