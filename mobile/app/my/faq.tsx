import { useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { colors } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { REWARDS } from '@/lib/rewards';

interface QA { q: string; a: string }
interface Section { title: string; items: QA[] }

const FAQ: Section[] = [
  {
    title: '포인트 모으기',
    items: [
      {
        q: '포인트는 어떻게 받나요?',
        a:
          `다음 활동을 하면 자동으로 포인트가 쌓입니다.\n` +
          `· 하루 1회 출석 (KST 기준) +${REWARDS.login_daily}P\n` +
          `· 3일 연속 출석 보너스 +${REWARDS.login_streak3_bonus}P\n` +
          `· 커뮤니티 글 작성 +${REWARDS.feed_general}P\n` +
          `· 거래글 등록 +${REWARDS.trade_post}P\n` +
          `· 거래 완료 처리 +${REWARDS.trade_done}P (쪽지를 1통 이상 받은 글에서만)`,
      },
      {
        q: '출석 보너스는 언제 들어와요?',
        a: 'KST(한국 시간) 기준으로 날짜가 바뀐 뒤 앱에 다시 들어오면 즉시 적립됩니다. 마이페이지·홈 진입 시점에 자동 처리.',
      },
      {
        q: '거래 완료 포인트가 안 들어와요.',
        a: '거래 완료 보상은 누군가 해당 거래글로 1:1 쪽지를 보낸 적이 있어야 지급됩니다. 쪽지 없이는 "거래 완료" 버튼이 비활성 상태입니다.',
      },
      {
        q: '포인트는 어디에 쓰나요?',
        a: '마이페이지 → 상점에서 아바타·배경·프레임을 구매하거나, 오리파 뽑기에 사용할 수 있습니다.',
      },
    ],
  },
  {
    title: '계정 / 로그인',
    items: [
      {
        q: '닉네임은 어떻게 바꾸나요?',
        a: '마이페이지 → 이름 옆 "닉네임수정" 버튼 → 새 이름 입력 후 저장. 2~20자까지 가능합니다.',
      },
      {
        q: '로그인이 안돼요. 카카오톡에서 열면 "Unable to log in" 이 떠요.',
        a: '카카오톡·네이버앱 같은 내장 브라우저는 OAuth 로그인이 차단됩니다. 우측 상단 메뉴에서 "Chrome/Safari 로 열기" 선택해주세요.',
      },
      {
        q: '이메일/포인트가 사라졌어요.',
        a: '처음 로그인 직후엔 DB 동기화에 잠시 시간이 걸릴 수 있습니다. 새로고침 후에도 이상하면 공지 하단 문의 링크로 알려주세요.',
      },
    ],
  },
  {
    title: '거래 / 커뮤니티',
    items: [
      {
        q: '거래글 작성 후 완료 처리는 어떻게 하나요?',
        a: '거래글 상세 → 본인 글이면 "거래 완료" 버튼 노출. 단, 누군가가 1:1 쪽지를 보낸 적이 있어야 완료 처리가 가능합니다 (스팸·자기완료 방지). 완료된 글은 목록에서 흐리게 표시됩니다.',
      },
      {
        q: '글 작성하면 포인트가 얼마나 쌓이나요?',
        a: `커뮤니티 글 +${REWARDS.feed_general}P, 거래글 작성 +${REWARDS.trade_post}P, 거래 완료 +${REWARDS.trade_done}P 입니다.`,
      },
      {
        q: '가격은 어떻게 입력하나요?',
        a: '숫자만 입력하면 자동으로 1,000 단위 콤마가 찍히고, "제안"·"정가"·"1.5만" 같은 텍스트도 그대로 저장됩니다.',
      },
    ],
  },
  {
    title: '오리파',
    items: [
      {
        q: '오리파 뽑기 결과는 다른 사람과 공유되나요?',
        a: '네 — 100칸은 전체 유저가 공유합니다. 내가 뽑은 자리는 다른 사람에게도 뽑힌 상태로 보입니다. 8초마다 자동 동기화.',
      },
      {
        q: '오리파 뽑는 데 사용한 포인트는 어떻게 충전하나요?',
        a: '현재 포인트 유료 충전과 무료 광고 충전은 운영하지 않습니다. 포인트는 커뮤니티 글, 거래글 작성, 거래 완료 처리로 적립됩니다.',
      },
    ],
  },
  {
    title: '기타',
    items: [
      {
        q: '문의는 어디로 보내나요?',
        a: '공지사항 하단 이메일 또는 거래 완료 후 쪽지로 보내주세요. 운영팀이 1~2일 내 답변드립니다.',
      },
      {
        q: '개인정보는 어떻게 처리하나요?',
        a: '이메일/닉네임만 저장하며, 광고/마케팅 용도로 외부 공유하지 않습니다. 마이페이지 하단 [회원 탈퇴]로 언제든 계정과 개인정보를 즉시 삭제할 수 있습니다.',
      },
    ],
  },
];

export default function FaqScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="FAQ · 자주 묻는 질문" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}>
        {FAQ.map((section) => (
          <View key={section.title} style={{ marginHorizontal: 14, marginBottom: 14 }}>
            <SectHd title={section.title} />
            <View style={{ gap: 8 }}>
              {section.items.map((it, i) => (
                <FaqRow key={i} qa={it} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function FaqRow({ qa }: { qa: QA }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const flat = isFlatTheme(useTheme().theme);
  const [open, setOpen] = useState(false);
  return (
    <PixelFrame bg={tc.white} borderWidth={2} shadow={3} hi={null} lo={null} inner={0}>
      <Pressable onPress={() => setOpen((v) => !v)}>
        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PixelText variant="ko" size={11} color={tc.red} weight="bold">Q.</PixelText>
            <PixelText variant="ko" size={11} color={tc.ink} style={{ flex: 1 }} weight="bold">{qa.q}</PixelText>
            <PixelText variant={txt} size={9} color={tc.ink3}>{open ? '▲' : '▼'}</PixelText>
          </View>
          {open ? (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: flat ? tc.pap3 : 'rgba(0,0,0,0.15)', borderStyle: flat ? 'solid' : 'dashed', flexDirection: 'row', gap: 6 }}>
              <PixelText variant="ko" size={10} color={tc.blu} weight="bold">A.</PixelText>
              <PixelText variant="ko" size={10} color={tc.ink2} style={{ flex: 1, lineHeight: 18 }}>
                {qa.a}
              </PixelText>
            </View>
          ) : null}
        </View>
      </Pressable>
    </PixelFrame>
  );
}
