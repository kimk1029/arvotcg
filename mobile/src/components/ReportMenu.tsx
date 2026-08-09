/**
 * 게시글/댓글 "⋯" 신고·차단 메뉴 (App Store 심사 지침 1.2 요건).
 * 웹 src/components/ReportMenu.tsx 와 페어 — 같은 플로우:
 * ⋯ → [신고하기 | 사용자 차단] → 신고면 사유 선택 → POST /api/reports.
 * 차단은 POST /api/me/blocks 후 onBlocked 콜백(목록 새로고침)으로 반영.
 * 내 글(authorId === 세션 id)에는 렌더하지 않는다.
 */
import { Alert, Pressable, Text } from 'react-native';
import {
  REPORT_REASONS,
  blockUser,
  reportContent,
  type ReportTargetType,
} from '@/lib/myApi';
import { getUserId, isAuthenticated } from '@/lib/session';

interface Props {
  targetType: ReportTargetType;
  targetId: number;
  /** 대상 작성자 — 있으면 차단 옵션 노출. null/undefined 면 신고만. */
  authorId?: string | null;
  authorName?: string | null;
  /** 차단 완료 후 처리 (목록 새로고침 등). */
  onBlocked?: () => void;
  /** 트리거 글자 크기 (기본 18). */
  size?: number;
}

export function ReportMenu({ targetType, targetId, authorId, authorName, onBlocked, size = 18 }: Props) {
  // 내 글이면 메뉴 자체를 숨김.
  if (authorId && getUserId() === authorId) return null;

  const pickReason = () => {
    Alert.alert('신고 사유를 선택해 주세요', undefined, [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: async () => {
          try {
            await reportContent(targetType, targetId, reason);
            Alert.alert('신고 접수', '신고가 접수되었습니다. 운영팀이 검토 후 조치할게요.');
          } catch {
            Alert.alert('실패', '신고 접수에 실패했어요. 잠시 후 다시 시도해 주세요.');
          }
        },
      })),
      { text: '취소', style: 'cancel' as const },
    ]);
  };

  const confirmBlock = () => {
    if (!authorId) return;
    const label = authorName ?? '이 사용자';
    Alert.alert(
      `${label}님을 차단할까요?`,
      '차단하면 이 사용자의 글과 댓글이 더 이상 보이지 않아요.\n(마이페이지 > 차단 관리에서 해제 가능)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단하기',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(authorId);
              Alert.alert('차단 완료', '이 사용자의 글이 목록에서 숨겨집니다.');
              onBlocked?.();
            } catch {
              Alert.alert('실패', '차단에 실패했어요. 잠시 후 다시 시도해 주세요.');
            }
          },
        },
      ],
    );
  };

  const open = () => {
    if (!isAuthenticated()) {
      Alert.alert('로그인이 필요해요', '신고·차단은 로그인 후 이용할 수 있어요.');
      return;
    }
    Alert.alert('이 콘텐츠에 대해', undefined, [
      { text: '🚩 신고하기', style: 'destructive', onPress: pickReason },
      ...(authorId
        ? [{ text: `🚫 ${authorName ?? '이 사용자'} 차단하기`, style: 'destructive' as const, onPress: confirmBlock }]
        : []),
      { text: '취소', style: 'cancel' },
    ]);
  };

  return (
    <Pressable onPress={open} hitSlop={8} accessibilityLabel="더보기 (신고/차단)">
      <Text style={{ fontSize: size, lineHeight: size + 2, color: '#C2C2C8', fontWeight: '800', paddingHorizontal: 4 }}>⋯</Text>
    </Pressable>
  );
}
