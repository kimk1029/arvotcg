/**
 * 그레이딩 표식 — 카드 이미지 우하단 흰 필 배지에 그레이딩사 로고 + 등급 숫자.
 * 컬렉션(CollectionScreen)과 홈 HOT 카드(CleanHome)가 공통으로 사용.
 * 앱 mobile/src/components/cv/GradeMark 와 동일 규격(height 비례, 로고↔등급 간격 = height*0.125).
 *
 * 부모가 position:relative 여야 한다. height 로 크기 조절(컬렉션 12 / HOT 9).
 */

/**
 * 그레이딩사 로고 이미지 (public/grading/*.webp) — PSA·CGC 는 Wikipedia,
 * SGC 는 공식 트위터, BGS(Beckett)·ARS 는 각 공식 사이트에서 수집한 실제 마크.
 */
export const GRADE_LOGOS: Record<string, string> = {
  PSA: '/grading/psa.webp',
  BGS: '/grading/bgs.webp',
  CGC: '/grading/cgc.webp',
  SGC: '/grading/sgc.webp',
  ARS: '/grading/ars.webp',
};

interface Props {
  company?: string | null;
  grade?: string | null;
  /** 로고 높이(px). 컬렉션 12 / HOT 카드 9. */
  height?: number;
  /** 미등록 그레이딩사 폴백 라벨 배경색(예: 'var(--gold)'). 없으면 폴백 렌더 없이 null. */
  gold?: string;
}

export function GradeMark({ company, grade, height = 12, gold }: Props) {
  const key = (company ?? '').trim().toUpperCase();
  const logo = GRADE_LOGOS[key];
  if (!logo) {
    if (!gold) return null;
    // 미등록 회사 폴백 — 골드 '그레이딩' 라벨.
    return (
      <span
        style={{
          position: 'absolute', bottom: 5, right: 5, zIndex: 4, pointerEvents: 'none',
          fontFamily: 'var(--f1)', fontSize: 8.5, fontWeight: 800, lineHeight: 1, letterSpacing: 0.3,
          color: '#fff', background: gold, padding: '2px 6px', borderRadius: 6,
          boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }}
      >
        그레이딩
      </span>
    );
  }
  // gap = height * 0.125 — 앱과 동일하게 로고↔등급 간격을 기존(0.25*height)의 절반으로.
  const gap = Math.max(1, height * 0.125);
  const gradeSize = Math.max(8.5, height * 0.75);
  return (
    <span
      style={{
        position: 'absolute', bottom: 5, right: 5, zIndex: 4, pointerEvents: 'none',
        display: 'inline-flex', alignItems: 'center', gap,
        background: '#fff', padding: '2px 5px', borderRadius: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,.35)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={key} style={{ height, width: 'auto', display: 'block' }} />
      {grade?.trim() && (
        <span style={{ fontFamily: 'var(--f1)', fontSize: gradeSize, fontWeight: 900, lineHeight: 1, color: '#111' }}>
          {grade.trim()}
        </span>
      )}
    </span>
  );
}
