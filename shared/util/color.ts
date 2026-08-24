/**
 * 색 유틸 (웹·앱 공용 순수 함수).
 * 웹은 CSS color-mix 로 처리할 수 있지만, RN 은 계산식이 없어 여기서 섞는다.
 */

/** '#RGB' / '#RRGGBB' → [r,g,b]. 파싱 실패 시 null. */
function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '');
  if (m.length === 3) {
    const [r, g, b] = m.split('');
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
  }
  if (m.length === 6) {
    return [
      parseInt(m.slice(0, 2), 16),
      parseInt(m.slice(2, 4), 16),
      parseInt(m.slice(4, 6), 16),
    ];
  }
  return null;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * 두 색을 비율만큼 섞는다 — `ratio` 는 fg 비중(0~1).
 *   mixHex('#FFD23F', '#FFFFFF', 0.2) → 옅은 금색 틴트
 * 파싱 못 하는 값이 오면 base 를 그대로 돌려준다.
 */
export function mixHex(color: string, base: string, ratio: number): string {
  const a = parseHex(color);
  const b = parseHex(base);
  if (!a || !b) return base;
  const t = Math.max(0, Math.min(1, ratio));
  return `#${a.map((v, i) => toHex(v * t + b[i] * (1 - t))).join('')}`;
}
