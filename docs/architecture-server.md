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

- 카탈로그 = `snkrdunk_cards`, 현재가 = `snkrdunk_current_prices`, 가격 이력 = `snkrdunk_price_snapshots`.
- 가격 신선도는 실제 DB `fetchedAt`부터 24시간. 갱신 결과·쓰기 억제 캐시는 이 시각을
  그대로 사용하며, 읽거나 저장을 시도했다고 만료 시간이 하루 더 늘어나지 않는다.
  현재가·카탈로그 조회 캐시는 60초. 가격 갱신 작업은 캐시를 우회해 DB 시각을 확인하고
  작업 완료를 기다린다. 화면 조회는 기존 값으로 응답하면서 백그라운드 갱신한다.
- **분산 배치**: `lib/dailyPriceSnapshot.ts` — 부팅 5분 후 첫 실행, 이후 매시 00/30분.
  보유 카드와 고가 후보 중 24시간 넘은 가격을 오래된 순서로 최대 50개 처리한다.
  동시 처리 1개, 최소 2초 간격, 5분이 지나면 새 작업을 시작하지 않는다(실행 중 작업은 완료 대기).
  연속 3회 실패 시 중단하고 실패 카드는 1시간 뒤 재시도한다.
  대상 선정 SQL은 2초, 트랜잭션은 실행 3초/연결 대기 1초 제한.
  상태: `GET /api/snkrdunk/daily-snapshot-status` (`nextRunAt`, `intervalMs`, `batchLimit` 포함).
  `DAILY_SNAPSHOT_DISABLED=1`로 중단. standby에서 `DAILY_PRICE_REFRESH_ENABLED=1`이면
  가격 배치만 실행한다. 옛 `DAILY_SNAPSHOT_HOUR_KST/DELAY_MS/MAX_MS` 환경변수는 사용하지 않는다.
- 웹·앱 컬렉션은 `/prices` 실패(네트워크·429·5xx·잘못된 응답)에 전체 목록을 재요청하지 않는다.
  기존 값을 유지하며, 정상 응답에서 카드 ID 구성이 달라졌을 때만 전체 조회한다.
  401/403 인증 실패는 숨기지 않는다. 앱 컬렉션 요청의 즉시 자동 재시도도 끈다.
- 등록가/등락률은 등급 기준 통일 — `shared/snkrdunkPrice.ts`의 registerBasisJpy가 정본.

## 스케줄러 패턴

단일 인스턴스 전제의 in-process 타이머 (별도 크론 인프라 없음):
- `priceAlerts.ts` — 15분 interval, 가격알림 체크
- `cardImageCache.js` — 부팅+매일, 카드 이미지 webp 셀프 CDN 워밍
- `dailyPriceSnapshot.ts` — 30분 간격 체인 setTimeout
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
