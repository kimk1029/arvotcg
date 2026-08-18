/**
 * 그레이딩 표식 — 카드 이미지 우하단 흰 필 배지에 그레이딩사 로고 + 등급 숫자.
 * 컬렉션 카드 목록(app/my/cards)과 홈 HOT 카드(CleanHomeScreen)가 공통으로 사용.
 *
 * height 로 크기를 조절(컬렉션 12 / HOT 9). 로고↔등급 숫자 간격(gap)은 기존의 절반.
 */
import { Image, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { SHOT } from '@/lib/shotMode';

/**
 * 그레이딩사 로고 이미지 (assets/grading/*.webp) — PSA·CGC 는 Wikipedia,
 * SGC 는 공식 트위터, BGS(Beckett)·ARS 는 각 공식 사이트에서 수집한 실제 마크.
 */
export const GRADE_LOGOS: Record<string, ReturnType<typeof require>> = {
  PSA: require('../../../assets/grading/psa.webp'),
  BGS: require('../../../assets/grading/bgs.webp'),
  CGC: require('../../../assets/grading/cgc.webp'),
  SGC: require('../../../assets/grading/sgc.webp'),
  ARS: require('../../../assets/grading/ars.webp'),
};

/** 로고 원본 종횡비 (width/height) — 배지 높이에 맞춰 폭 계산. */
export const GRADE_LOGO_AR: Record<string, number> = { PSA: 256 / 96, BGS: 88 / 96, CGC: 1, SGC: 1, ARS: 73 / 96 };

interface Props {
  company?: string | null;
  grade?: string | null;
  /** 로고 높이(px). 컬렉션 12 / HOT 카드 9. */
  height?: number;
  /** 미등록 그레이딩사 폴백 라벨 색. 없으면 폴백 렌더 없이 null. */
  gold?: string;
}

export function GradeMark({ company, grade, height = 12, gold }: Props) {
  const key = (company ?? '').trim().toUpperCase();
  // 스토어 스크린샷 모드 — 그레이딩사 로고는 제3자 상표라 메타데이터에 노출하지 않는다.
  // 로고 없이 등급 숫자만 담긴 중립 배지로 대체.
  const logo = SHOT ? undefined : GRADE_LOGOS[key];
  if (!logo) {
    if (SHOT && grade?.trim()) {
      return (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', bottom: 5, right: 5, zIndex: 4, backgroundColor: '#fff',
            paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6,
            shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }}
        >
          <PixelText variant="ko" size={Math.max(8.5, height * 0.75)} weight="bold" color="#111">
            {`GRADE ${grade.trim()}`}
          </PixelText>
        </View>
      );
    }
    if (!gold) return null;
    // 미등록 회사 폴백 — 골드 '그레이딩' 라벨.
    return (
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 5, right: 5, zIndex: 4, backgroundColor: gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
        <PixelText variant="ko" size={8} weight="bold" color="#fff">그레이딩</PixelText>
      </View>
    );
  }
  // gap = height * 0.125 → 기존(0.25*height) 대비 절반으로 로고↔등급 간격을 좁힘.
  const gap = Math.max(1, height * 0.125);
  const gradeSize = Math.max(8.5, height * 0.75);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', bottom: 5, right: 5, zIndex: 4,
        flexDirection: 'row', alignItems: 'center', gap,
        backgroundColor: '#fff', paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 6,
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
      }}
    >
      <Image source={logo} style={{ height, width: height * (GRADE_LOGO_AR[key] ?? 1) }} resizeMode="contain" />
      {!!grade?.trim() && (
        <PixelText variant="ko" size={gradeSize} weight="bold" color="#111">{grade.trim()}</PixelText>
      )}
    </View>
  );
}
