/**
 * 테마별 픽셀 마크. 모든 variant 를 DOM 에 렌더하고
 * `[data-theme]` 셀렉터로 CSS 가 표시 토글.
 *
 * - pokemon  : 브랜드 픽셀 카드
 * - onepiece : 위에서 본 루피의 밀짚모자 (탄 brim + 빨강 띠)
 * - yugioh   : 천년 퍼즐 — 위에서 본 황금 사각 + 호루스의 눈
 * - sports   : 흰 공 + 잔디색 라인
 *
 * SSR 안전 — 어떤 테마든 첫 페인트에서 정확히 한 variant 만 보임.
 */
export function PixelBall({ size = 22 }: { size?: number }) {
  return (
    <span
      className="ball-themed"
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        position: 'relative',
        lineHeight: 0,
      }}
      aria-hidden
    >
      {/* pokemon variant — 브랜드 픽셀 카드 (IP 몬스터볼 도트 아트 대체.
          클래스명은 테마 CSS 토글 호환을 위해 유지) */}
      <svg
        className="ball-pokemon"
        width={size}
        height={size}
        viewBox="0 0 10 10"
        style={{ shapeRendering: 'crispEdges' }}
      >
        <rect x="2" y="0" width="6" height="1" fill="#1A1A2E" />
        <rect x="2" y="1" width="1" height="8" fill="#1A1A2E" />
        <rect x="7" y="1" width="1" height="8" fill="#1A1A2E" />
        <rect x="2" y="9" width="6" height="1" fill="#1A1A2E" />
        <rect x="3" y="1" width="4" height="8" fill="#129782" />
        <rect x="3" y="1" width="1" height="2" fill="#3DBBA4" />
        <rect x="4" y="3" width="1" height="1" fill="#FFD23F" />
        <rect x="3" y="4" width="3" height="1" fill="#FFD23F" />
        <rect x="4" y="5" width="1" height="1" fill="#FFD23F" />
      </svg>

      {/* onepiece variant — 위에서 본 밀짚모자 (클래식 테마라 논픽셀 스무스 렌더).
          바깥 = 밀짚 brim, 안쪽 = 빨강 띠, 중앙 = 모자 정수리. */}
      <svg
        className="ball-onepiece"
        width={size}
        height={size}
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="47" fill="#F4D272" stroke="#4A2F12" strokeWidth="5" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(120,80,20,.35)" strokeWidth="3" />
        <circle cx="50" cy="50" r="33" fill="#C8404A" />
        <circle cx="50" cy="50" r="24" fill="#E3B45A" stroke="#B8884B" strokeWidth="3" />
        <ellipse cx="42" cy="42" rx="8" ry="4.5" fill="#FFF1C9" opacity="0.5" />
      </svg>

      {/* yugioh variant — 역피라미드 황금 펜던트 + 눈 (클래식 테마라 논픽셀 스무스 렌더) */}
      <svg
        className="ball-yugioh"
        width={size}
        height={size}
        viewBox="0 0 100 100"
      >
        <polygon
          points="50,96 6,16 94,16"
          fill="#E0AC2E"
          stroke="#4A3408"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <polygon points="50,96 6,16 50,16" fill="#C9941C" />
        <polygon points="6,16 94,16 84,27 16,27" fill="#F2D470" />
        {/* 눈 — 작은 사이즈에서도 읽히게 눈매+동공만 */}
        <path
          d="M28 48 Q50 34 72 48 Q50 62 28 48 Z"
          fill="#FBF4DE"
          stroke="#3A2606"
          strokeWidth="5"
        />
        <circle cx="50" cy="48" r="8" fill="#3A2606" />
      </svg>

      {/* sports variant — 경기장 공 아이콘 */}
      <svg
        className="ball-sports"
        width={size}
        height={size}
        viewBox="0 0 10 10"
        style={{ shapeRendering: 'crispEdges' }}
      >
        <rect x="3" y="0" width="4" height="1" fill="#111827" />
        <rect x="2" y="1" width="1" height="1" fill="#111827" />
        <rect x="7" y="1" width="1" height="1" fill="#111827" />
        <rect x="1" y="2" width="1" height="1" fill="#111827" />
        <rect x="8" y="2" width="1" height="1" fill="#111827" />
        <rect x="0" y="3" width="1" height="4" fill="#111827" />
        <rect x="9" y="3" width="1" height="4" fill="#111827" />
        <rect x="1" y="7" width="1" height="1" fill="#111827" />
        <rect x="8" y="7" width="1" height="1" fill="#111827" />
        <rect x="2" y="8" width="1" height="1" fill="#111827" />
        <rect x="7" y="8" width="1" height="1" fill="#111827" />
        <rect x="3" y="9" width="4" height="1" fill="#111827" />
        <rect x="3" y="1" width="4" height="1" fill="#FFFFFF" />
        <rect x="2" y="2" width="6" height="1" fill="#FFFFFF" />
        <rect x="1" y="3" width="8" height="4" fill="#FFFFFF" />
        <rect x="2" y="7" width="6" height="1" fill="#FFFFFF" />
        <rect x="3" y="8" width="4" height="1" fill="#FFFFFF" />
        <rect x="4" y="1" width="2" height="8" fill="#16A34A" />
        <rect x="1" y="4" width="8" height="2" fill="#16A34A" />
        <rect x="4" y="4" width="2" height="2" fill="#FFFFFF" />
      </svg>
    </span>
  );
}
