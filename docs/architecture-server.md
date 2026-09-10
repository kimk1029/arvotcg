# API 서버 (server/) — 구조·설계 규칙

> Express + tsx. pm2 `pokefesta30-server`(:3030, fork 모드, node 직접 실행 — npm 래퍼 금지).
> main push 시 대상별 deploy-server-{nas,vultr}.yml로 자동 배포. **안티봇 스크레이퍼(KREAM 등)는 반드시 여기**
> (Vercel IP는 차단됨).

## 배포 대상 — NAS/Vultr 독립 워크플로

GitHub Actions에서 다음 워크플로를 각각 실행·재실행할 수 있다.

| 대상 | API 서버 | 어드민 |
| --- | --- | --- |
| NAS (stage) | `Deploy Server — NAS` (`deploy-server-nas.yml`) | `Deploy Admin — NAS` (`deploy-admin-nas.yml`) |
| Vultr (production) | `Deploy Server — Vultr` (`deploy-server-vultr.yml`) | `Deploy Admin — Vultr` (`deploy-admin-vultr.yml`) |

- 각 진입 워크플로는 기존 경로의 main push와 개별 `Run workflow`를 지원한다.
- 공통 SSH 배포 구현은 `deploy-server.yml` / `deploy-admin.yml`의 `workflow_call`로 공유한다.
- NAS는 `SSH_*`/`SERVER_ENV`, Vultr는 `VULTR_SSH_*`/`VULTR_SERVER_ENV`만 전달한다.
  호스트 시크릿이 없으면 해당 배포를 건너뛰고, 환경 파일 시크릿이 없으면 해당 호스트의 기존 파일을 유지한다.
- 같은 호스트의 서버·어드민 SSH 작업은 `deploy-host-nas` / `deploy-host-vultr`로 직렬화한다.
  서로 다른 호스트는 독립 실행하며 실패 상태도 별도로 표시한다.
- Supabase 스키마 동기화는 Vultr 어드민 워크플로가 `deploy.yml`을 호출해 한 번만 실행한다.
  기존 정책대로 스키마 동기화 실패가 어드민 배포를 차단하지는 않는다.
  NAS 어드민만 수동 배포하면 스키마 동기화는 실행하지 않는다.
- 서버 배포 전 장애 회귀 테스트, 배포 후 `/ready` DB 준비 상태 검증을 유지한다.
- Vultr 프로비저닝: `scripts/vultr-bootstrap.sh` (Ubuntu 22.04).
- 두 서버는 같은 DB를 사용할 수 있다. 주기 작업은 단일 인스턴스 전제이므로
  `SERVER_ROLE` 설정을 확인해 primary 한 곳에서만 실행한다.

## 레이어

- `server/index.js` — 엔트리. 라우터 mount + 부팅 스케줄러 기동. 에러 핸들러는 항상 마지막.
- `server/routes/**` — HTTP 라우트. 응답 후 DB 적재는 `void (async…)` 백그라운드로(응답 지연 금지).
- `server/lib/**` — DB 헬퍼·스케줄러·스크레이퍼. `@/lib/*` alias로 `src/lib`(웹 shim 경유
  `/shared` 정본)를 그대로 공유 — **서버에서 시세/파싱 로직 재구현 금지**
  → [architecture-shared.md](./architecture-shared.md).

## 데이터 원칙 (스니덩크 시세)

- 카탈로그(불변 정보) = `snkrdunk_cards` (가격 필드 없음). 가격 = `snkrdunk_price_snapshots`
  append-only, 현재가 = 최신 행. 조회는 DB 우선 + TTL(컬렉션 30분 / 팩 24h).
- **일일 배치**: `lib/dailyPriceSnapshot.ts` — 매일 03:00 KST 전 카탈로그 순회 스냅샷
  (멱등: 오늘치 있으면 스킵, 부팅 5분 후 캐치업). 통계 API:
  `GET /api/snkrdunk/apparels/:id/price-stats` (KST 일별 + 1/7/30일 평균),
  상태: `GET /api/snkrdunk/daily-snapshot-status`.
- 등록가/등락률은 등급 기준 통일 — `shared/snkrdunkPrice.ts`의 registerBasisJpy가 정본.

## 스케줄러 패턴

단일 인스턴스 전제의 in-process 타이머 (별도 크론 인프라 없음):
- `priceAlerts.ts` — 15분 interval, 가격알림 체크
- `cardImageCache.js` — 부팅+매일, 카드 이미지 webp 셀프 CDN 워밍
- `dailyPriceSnapshot.ts` — 매일 정각(KST) 체인 setTimeout
새 주기 작업도 이 패턴으로: `start*Scheduler()` export → index.js listen 콜백에서 기동,
타이머 `unref()`, 겹침 방지 플래그, env로 on/off.

## 규칙

1. KST 날짜 계산은 `shared/kst.ts`만 사용 (재구현 금지).
1. **shared 정본 심볼은 `/shared` 에서 직접 import** — `@/lib/*` shim 의 `export *` 를
   거치면 tsx CJS interop(cjs-module-lexer)이 이름을 못 봐 NAS 부팅이 죽는다.
   shim 에 로컬 선언된 fetcher(`fetchSnkrdunk*` 등)만 `@/lib/*` 로 가져올 것.
2. DB 쓰기 실패는 삼키고 로깅 — 사용자 응답을 죽이지 않는다.
3. 배포 후 스모크는 `https://www.poke-30.com/api/...` 프록시로 (poke-30.com은 www로 308).
4. 이 개발 박스에는 DATABASE_URL 없음 — DB는 NAS/Vercel에만. 로컬 검증은 임시 Postgres로.
5. **`DATABASE_URL` 의 `connection_limit` 을 1 로 두지 말 것** (Vultr `server/.env`).
   Prisma 커넥션이 1개면 서버 전체 쿼리가 한 줄로 직렬화돼, 일별 시세 배치가 도는
   동안 모든 API 가 수 초씩 걸린다(2026-08 쪽지함 지연의 실제 원인). 10 권장.
   pgbouncer 트랜잭션 모드(:6543)에는 `pgbouncer=true` 를 함께 유지.
