# 로그인 접근 제어 및 요청 위조 점검 (2026-09-09)

## 범위와 결과

웹 Next middleware/EntryGate, Express API 마운트와 JWT 검증, 웹뷰 인증 브리지,
CORS/쿠키 변경 요청, 프록시 이미지, 주요 게시글 소유자 검사, HTTPS 응답을 확인했다.
운영 데이터에 대한 공격·변경 테스트는 하지 않았다. 인증/DB를 격리한 로컬 테스트를 사용했다.
전체 침투 테스트나 모든 권한·비즈니스 로직에 대한 보안 인증을 의미하지 않는다.

| 발견 사항 | 변경 |
| --- | --- |
| embed=1 / 앱 User-Agent가 웹 로그인 게이트를 면제 | 표시 모드와 인증을 분리. 서버의 /auth/me로 세션 서명·만료·회원 존재 확인 |
| 임의 쿠키 값만 있어도 SSR 진입 | 쿠키 존재 검사를 실제 인증 검사로 교체. 인증 서버 오류 시 거부 |
| 조회 API 다수가 optionalAuth/무인증 | Express /api에 기본 인증 적용. Next 로컬 API도 middleware로 검사 |
| API·확장자 경로가 middleware에서 통째로 제외 | 알려진 정적 자산만 허용. API/RSC도 검사 |
| 웹뷰 장기 토큰이 URL에 유지 | 새 앱은 Authorization 헤더 사용. 기존 앱 쿼리 토큰도 검증 후 HttpOnly 쿠키로 교환·URL 제거 |
| 쿠키 변경 요청에 명시적인 출처 검사가 없음 | 허용 Origin/Referer 확인. 네이티브/서버 Bearer 인증은 별도 검증. 어드민 변경 요청에도 Origin 검사 |
| CORS 목록 미설정 시 모든 Origin 허용 | 운영 웹·어드민 및 명시적으로 설정된 출처만 허용 |
| 인증 조회 응답에 public 캐시 | 보호 API와 웹 응답을 private/no-store 처리. SSR API 호출에 세션 전달 |
| 만료 필드 없는 서명 토큰 허용 가능 | JWT 알고리즘 HS256 제한, sub/iat/exp 필수. 탈퇴한 회원의 토큰도 API에서 거부 |
| 이미지 프록시가 리다이렉트·임의 콘텐츠 유형 수용 | HTTPS pstatic 호스트 검사 유지, 리다이렉트 거부, raster 이미지 MIME만 허용, nosniff |
| 방문 IP가 X-Forwarded-For 첫 값만 신뢰 | Express trust proxy 정책으로 계산된 req.ip 사용 |
| PSA 릴레이 공유키 미설정 시 접근 허용 | 키 미설정 또는 불일치 시 거부 |
| sitemap이 보호 콘텐츠 ID/목록 공개 | 공개 법적 안내 페이지만 포함 |

게시글 수정·삭제는 요청 본문의 authorId가 아닌 검증된 req.user와 DB authorId를 비교한다.
쪽지 조회도 검증된 로그인 사용자와 상대방으로 조회하는 구조를 확인했다.
이 확인은 모든 엔드포인트의 IDOR 검증을 완료했다는 의미는 아니다.

## 의도적으로 공개되는 경로

로그인·OAuth·온보딩·법적 안내 및 정적 자산은 로그인 전에 필요하다.
API 예외는 `shared/accessPolicy.ts`에 모았다:

- GET/HEAD 앱 업데이트 정보, 정적 CDN 이미지, 제한된 네이버 이미지 프록시.
- POST 행동/방문/광고 기록. 익명 ID·출처는 통계용이며 인증 근거로 사용하지 않는다.
- 관리자 API, 앱 출시 정보 PUT, PSA 릴레이는 **자체 관리자/공유키 인증**을 사용한다.

로그인 없이 위 자산·안내를 요청하는 것은 가능하지만, 홈·콘텐츠 목록·사용자 기능은 인증이 필요하다.

## 검증

- `npm run test:security`: 웹 인증/웹뷰/이미지 프록시 회귀 테스트.
- `cd server && npm run test:security`: 실제 JWT 서명·변조·만료·알고리즘 테스트 및 로컬 Express HTTP 인증/CSRF 테스트. DB 조회는 모킹한다.
- `npm run build` 후 `node tests/web-access-smoke.mjs`: 프로덕션 Next 서버에 14가지 HTTP 요청. 익명/가짜 쿠키/앱 표시/RSC/미들웨어 우회 헤더/API 호출 거부, 정상 세션 이벤트 화면 통과 확인. /auth/me만 로컬 스텁 사용.
- 웹·서버·모바일 타입 검사 및 웹·어드민 프로덕션 빌드.
- 운영 웹·API에 읽기 전용 HEAD 요청: HTTP→HTTPS 리다이렉트와 HTTPS 연결 성공. 웹 HSTS 확인. API에는 코드에서 운영 HSTS/nosniff를 추가했다.

## 배포 시 필요한 설정과 영향

- 웹 middleware의 인증 서버는 API_INTERNAL_URL / NEXT_PUBLIC_API_ORIGIN / API_ORIGIN_PROD 순서와 공통 환경 선택을 따른다. Edge에서 접근 가능한 주소여야 한다. 인증 서버가 응답하지 않으면 보호 화면 진입도 거부한다.
- `SESSION_COOKIE_NAME`은 웹·서버가 같아야 한다.
- PSA 릴레이를 사용하는 경우 웹/서버에 같은 `PSA_RELAY_KEY`가 필요하다. 없으면 릴레이 폴백은 거부되며, 직접 PSA 호출 경로는 유지된다.
- KREAM 릴레이는 HTTPS 주소에서만 호출하며 검증된 사용자의 토큰을 전달한다. 릴레이 서버도 해당 토큰을 검증할 수 있어야 한다.
- 추가 웹 도메인은 CORS_ORIGINS, 추가 어드민 도메인은 ADMIN_BASE_URL을 설정한다.
- Express의 기존 `trust proxy = 1`은 한 단계의 신뢰 가능한 프록시를 전제로 한다. 실제 프록시 홉 및 외부에서 API 프로세스 포트로 직접 접근할 수 없는지 인프라 확인이 필요하다.
- 익명 사용자가 받던 API 조회는 401로 바뀐다. 신규 앱은 웹뷰 토큰 전달이 헤더 방식이며 구버전 앱 URL 전달도 호환한다.

## 남은 보안 항목

`npm audit --omit=dev` 결과(상위·하위 의존성이 중복 집계되므로 독립 취약점 개수와 다름):

| 대상 | high | moderate | critical |
| --- | ---: | ---: | ---: |
| 웹(root) | 6 | 0 | 0 |
| 서버 | 6 | 2 | 0 |
| 어드민 | 7 | 0 | 0 |

현재 Next.js 14.2.35에는 요청 스머글링·캐시·서비스 거부 관련 공지가 포함된다.
감사 결과는 Next 15.5.21 미만에 해당하는 공지들을 보고했다. Next 메이저 전환 및
관련 React/비동기 라우트 API 호환 검증이 필요하며 **이번 인증 수정에서 업그레이드하지 않았다**.
Prisma 도구 체인의 deepmerge-ts, postcss/nanoid, 서버 sharp/undici/form-data/qs 등도 남아 있다.
이 목록은 패키지 메타데이터 감사 결과이며 각 공지의 실제 악용 가능성을 모두 재현한 결과는 아니다.

OAuth state는 현재 HMAC/TTL 검증 방식이다. 브라우저 세션과의 nonce 바인딩,
모바일 OAuth PKCE 및 세션 폐기/토큰 탈취 후 재사용 방어는 별도 심층 점검이 필요하다.
로그아웃은 쿠키 제거 방식이므로 이미 복사된 유효 토큰을 즉시 폐기하는 서버 세션 저장소는 없다.
인증서가 정상인 HTTPS 통신과 서버 인증은 확인했지만, 루팅된 기기·신뢰 인증서 설치·탈취된 유효 토큰까지 막는다고 보장하지 않는다.

참고 기준:
- [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Next.js rewrite request smuggling advisory](https://github.com/advisories/GHSA-ggv3-7p47-pfv8)
