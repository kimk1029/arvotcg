# App Store 메타데이터 (ARVOTCG)

App Store Connect 에 넣는 문구 모음. **심사 없이 언제든 수정 가능한 항목**(프로모션 텍스트)과
버전 심사에 포함되는 항목(새로운 기능)을 구분해 둔다.

> 특정 TCG IP(포켓몬 등)를 연상시키는 표현은 쓰지 않는다 — 2026-08 Guideline 4.1(a)
> Copycats 지적 이후 규칙. 카드 상품명이 데이터로 노출되는 것은 무관하나, **스토어 문구**에는
> 넣지 않는다.

## 프로모션 텍스트 (최대 170자)

설명글 맨 위에 노출. **심사 없이 언제든 교체 가능** — 이벤트 기간엔 이벤트 문구로 바꿔 쓴다.
(App Store Connect → 해당 버전 → 프로모션 텍스트, 로케일별 개별 입력)

### 한국어 — 채택본 (91자)

```
관심 카드의 오늘 등락을 한눈에. 카드를 스캔해 컬렉션에 담고 내 자산 가치를 매일 확인하세요. 시세 비교부터 직거래·커뮤니티까지, 트레이딩 카드 관리의 모든 것.
```

대안:

- 질문형 (85자) — `찜한 카드가 오늘 얼마나 올랐을까? 스캔 한 번으로 컬렉션에 담고, 자산 가치와 하루 등락을 바로 확인하세요. 실시간 시세·직거래·커뮤니티를 한 앱에서.`
- 간결형 (83자) — `내 카드가 지금 얼마인지 궁금하다면. 스캔으로 간편 등록하고 자산 가치와 등락을 매일 확인하세요. 관심 카드 알림, 시세 비교, 직거래까지 한 번에.`

### English — 채택본 (161자)

```
See how your watchlist moved today. Scan cards into your collection, track portfolio value daily, and compare live prices, trade, and talk shop — all in one app.
```

대안 (148자) — `Know what your cards are worth. Scan to add them, follow daily price moves on your watchlist, and buy, sell, and trade with collectors in one place.`

## 이 버전의 새로운 기능 — 1.1.0

### 한국어

```
• 커뮤니티·내 자산 상단 전환 버튼을 새 디자인으로 개선했어요.
• 관심카드 탭이 생겼어요 — 찜한 카드의 하루 등락을 한눈에 확인하세요.
• 알림함이 새로 생겼어요 — 포인트 적립·사용과 레벨업 소식을 모아 봅니다.
• 카드쇼 사전예약 이벤트가 열렸어요. 예약·변경·취소 시 확인 창이 표시됩니다.
• 박스별 카드 목록의 시세를 상세 화면과 같은 기준으로 통일했어요.
• 화면 폰트와 로딩 표시를 정리하고, 쪽지함 로딩 속도를 크게 개선했어요.
```

### English

```
• Redesigned the top switcher on Community and My Assets.
• New Watchlist tab — see the daily change for every card you follow.
• New Notifications inbox — point earnings, spending, and level-ups in one place.
• Card Show pre-booking event, now with a confirmation step for booking and cancelling.
• Prices in box card lists now match the card detail screen.
• Cleaner typography, clearer loading states, and a much faster message inbox.
```

## 이 버전의 새로운 기능 — 1.1.1 (iOS build 21 · Android vc13, 2026-08-29)

Guideline 1.2(UGC) 반려 후 재심사 빌드. Play 용 3개 언어 원문은 `store-assets/release-notes-v1.1.1.txt`.

### 한국어

```
• 앱 아이콘이 새로워졌어요.
• 내 자산 화면이 인포그래픽 대시보드로 확장됐어요 — 자산 구성·분류별 비중·손익 분포·취득·그레이딩 현황을 한눈에.
• 카드 게임별 시장 지수가 추가됐어요 — 내 컬렉션 수익률을 시장 흐름과 비교해 보세요.
• 시세 상세에 등급 전환 탭이 생겼어요 — 일반 카드와 PSA 10 시세를 바로 전환.
• 목록 가격과 시세 상세의 대표 시세 기준을 통일하고, 홈 이벤트 배너를 화면 가로 전체로 키웠어요.
• 커뮤니티 이용규칙 동의 절차와 신고·차단 안내를 강화했어요.
• 카메라 스캔 버튼이 반응하지 않던 문제를 수정하고, 로딩 안정성을 개선했어요.
```

### English

```
• Brand-new app icon.
• My Assets is now an infographic dashboard — allocation, category breakdown, P&L distribution, acquisitions and grading at a glance.
• New market indices per card game — compare your collection's return against the market.
• Grade switcher on price detail — flip between raw and PSA 10 prices instantly.
• List prices now match the detail screen, and home event banners span the full width.
• Clearer community guidelines with an agreement step, plus report and block guidance.
• Fixed the camera scan button not responding, and made loading more reliable.
```

### 프로모션 텍스트 — 1.1.1 갱신안 (심사 무관, 언제든 교체)

한국어 (99자):

```
내 컬렉션, 시장보다 잘 가고 있을까? 카드 게임별 시장 지수와 인포그래픽 대시보드로 자산 흐름을 한눈에. 스캔 등록·시세 비교·직거래·커뮤니티까지 트레이딩 카드의 모든 것.
```

English (166자):

```
Is your collection beating the market? New per-game market indices and an infographic dashboard show where your assets stand. Scan, compare prices, trade, and talk shop.
```

### 심사 메모 (Resolution Center 답변용, 1.2 UGC)

```
We have addressed Guideline 1.2 in build 21:
- Users must explicitly agree to the Community Guidelines (zero-tolerance for objectionable content and abusive users) via a checkbox dialog before posting, commenting, or listing. Agreement is recorded server-side and re-requested when the guidelines change.
- Terms of Service updated (Article 7-2) with the zero-tolerance policy and our commitment to act on reports within 24 hours by removing content and ejecting the offending user.
- Existing report and block features remain available on every post, comment and user profile.
```
