import type { Metadata } from 'next';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '아르보TCG 서비스의 개인정보 수집·이용·보관·파기 정책 안내',
  alternates: { canonical: '/privacy' },
};

const UPDATED_AT = '2026.04.26';
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'arvotcg@example.com';

export default function PrivacyPage() {
  return (
    <>
      <StatusBar />
      <AppBar title="개인정보처리방침" showBack backHref="/my" />

      <div style={{ height: 14 }} />

      <div className="sect">
        <SectionTitle
          title="개인정보처리방침"
          right={<span className="more">시행일 {UPDATED_AT}</span>}
        />

        <Doc>
          <P>
            「아르보TCG」(이하 “서비스”)은 이용자의 개인정보를
            중요하게 생각하며, 「개인정보 보호법」을 비롯한 관련 법령을
            준수하기 위해 다음과 같은 처리방침을 두고 있습니다.{' '}
            <Link href="/privacy/en">English version</Link>
          </P>

          <H>1. 수집하는 개인정보 항목</H>
          <P>
            서비스는 회원가입·서비스 제공·고객문의 처리 등을 위해 아래의
            개인정보를 수집합니다.
          </P>

          <Sub>가. 소셜 로그인 시 자동 수집</Sub>
          <Ul>
            <Li>
              <B>카카오</B> — 카카오 회원번호(서비스 식별자), 이메일
              (사용자가 동의한 경우에 한함)
            </Li>
            <Li>
              <B>네이버</B> — 네이버 회원 식별값, 이메일 (사용자가 동의한
              경우에 한함)
            </Li>
            <Li>
              <B>Google</B> — Google 계정 식별값(sub), 이메일 (사용자가
              동의한 경우에 한함)
            </Li>
          </Ul>
          <P>
            ※ 프로필 사진, 실명, 성별, 연령대, 휴대전화번호 등 위 항목
            <B> 외의 정보는 수집하지 않습니다.</B> 서비스에서 사용되는
            아바타·닉네임은 가입 직후 시스템이 자동 생성하며 이용자가
            언제든 변경할 수 있습니다.
          </P>

          <Sub>나. 서비스 이용 중 이용자가 직접 입력하는 정보</Sub>
          <Ul>
            <Li>닉네임(자동 생성, 변경 가능)</Li>
            <Li>거래글·피드·혼잡도 제보·쪽지의 본문 및 첨부 이미지</Li>
            <Li>거래글에 본인이 입력한 카카오톡 ID(선택)</Li>
            <Li>찜(북마크), 보유 아바타·배경·테두리, 포인트, 오리파 기록</Li>
          </Ul>

          <Sub>다. 자동 수집되는 정보</Sub>
          <Ul>
            <Li>접속 IP 주소(일별 중복방문자 카운트, 1일 1IP 중복제거)</Li>
            <Li>User-Agent(브라우저/기기 종류), Referer, 접속 경로</Li>
            <Li>
              쿠키 — 세션 유지(NextAuth), 분석(Google Analytics),
              광고(Google AdSense, Kakao AdFit)
            </Li>
          </Ul>

          <H>2. 개인정보 수집·이용 목적</H>
          <Ul>
            <Li>회원 식별 및 로그인 유지, 부정이용 방지</Li>
            <Li>거래·제보·쪽지 등 서비스 제공 및 사용자 간 소통</Li>
            <Li>방문자 통계·서비스 개선 및 인기 콘텐츠 분석</Li>
            <Li>광고 게재(맞춤형 광고 — 동의 시) 및 수익 분석</Li>
            <Li>고객문의 응대 및 분쟁 해결</Li>
          </Ul>

          <H>3. 개인정보 보유 및 이용기간</H>
          <P>
            원칙적으로 회원 탈퇴 시 지체 없이 파기합니다. 다만 관련
            법령에 따라 일정 기간 보관해야 하는 경우는 아래 기준에
            따릅니다.
          </P>
          <Ul>
            <Li>회원정보(소셜 식별값, 이메일) — 회원 탈퇴 시 즉시 파기</Li>
            <Li>
              이용자 작성 게시물(거래글·피드·제보·쪽지) — 탈퇴 시 작성자
              연결을 끊고 익명화 처리(법령상 통신비밀보호법·전자상거래법
              등 보존 의무 발생 시 해당 기간 동안 보관)
            </Li>
            <Li>접속 로그·IP — 「통신비밀보호법」에 따라 3개월 보관 후 파기</Li>
            <Li>
              부정이용 기록 — 분쟁 처리 또는 법령상 요구가 있는 경우
              해당 기간 보관
            </Li>
          </Ul>

          <H>4. 개인정보의 제3자 제공</H>
          <P>
            서비스는 이용자의 개인정보를 외부에 제공하지 않습니다. 다만
            다음의 경우는 예외로 합니다.
          </P>
          <Ul>
            <Li>이용자가 사전에 동의한 경우</Li>
            <Li>
              법령에 의하여 수사기관 또는 행정기관의 적법한 요청이 있는
              경우
            </Li>
          </Ul>

          <H>5. 개인정보 처리위탁 (Processor)</H>
          <P>
            서비스는 원활한 운영을 위해 다음과 같이 개인정보 처리업무를
            위탁하고 있습니다.
          </P>
          <Ul>
            <Li>
              <B>Supabase Inc.</B> — 데이터베이스 호스팅 (회원/게시물
              저장). 리전: ap-northeast-2 (서울)
            </Li>
            <Li>
              <B>Vercel Inc.</B> — 웹 애플리케이션 호스팅 및 이미지 저장
              (Vercel Blob)
            </Li>
            <Li>
              <B>Google LLC</B> — 소셜 로그인(Google), 분석(Google
              Analytics 4), 광고(Google AdSense)
            </Li>
            <Li>
              <B>Kakao Corp.</B> — 소셜 로그인(카카오), 광고(Kakao AdFit)
            </Li>
            <Li>
              <B>NAVER Corp.</B> — 소셜 로그인(네이버), 지도
              SDK(NAVER Cloud Maps)
            </Li>
          </Ul>
          <P style={{ marginTop: 6 }}>
            위 수탁자들은 개인정보 처리 목적 달성에 필요한 범위 내에서만
            정보를 처리하며, 일부 서비스의 경우 데이터가 미국 등
            해외(서버 소재지)에서 처리될 수 있습니다.
          </P>

          <H>6. 이용자(정보주체)의 권리</H>
          <P>이용자는 언제든 다음의 권리를 행사할 수 있습니다.</P>
          <Ul>
            <Li>개인정보 열람 요구 — 마이페이지에서 직접 확인 가능</Li>
            <Li>오류 정정 — 닉네임/프로필 항목은 마이페이지에서 직접 수정</Li>
            <Li>삭제 및 처리 정지 요구 — 회원 탈퇴 또는 아래 연락처로 요청</Li>
            <Li>맞춤형 광고 동의 철회 — 브라우저 쿠키 삭제 또는 광고 사업자별 옵트아웃</Li>
          </Ul>
          <P style={{ marginTop: 6 }}>
            맞춤형 광고 옵트아웃 안내:
            <br />· Google: <Link href="https://adssettings.google.com">adssettings.google.com</Link>
            <br />· Kakao AdFit: <Link href="https://adfit.kakao.com/optout">adfit.kakao.com/optout</Link>
          </P>

          <H>7. 쿠키(Cookie)의 운영</H>
          <P>
            서비스는 이용자에게 더 나은 서비스를 제공하기 위해 쿠키를
            사용합니다. 이용자는 브라우저 설정에서 쿠키 저장을 거부할
            수 있으나, 거부 시 로그인 등 일부 서비스 이용에 제한이 있을
            수 있습니다.
          </P>
          <Ul>
            <Li>세션 쿠키(NextAuth) — 로그인 유지 (필수)</Li>
            <Li>분석 쿠키(_ga 등) — 방문자 통계, Google Analytics</Li>
            <Li>광고 쿠키 — Google AdSense, Kakao AdFit (맞춤형 광고)</Li>
          </Ul>

          <H>8. 개인정보 안전성 확보 조치</H>
          <Ul>
            <Li>HTTPS 전 구간 암호화 통신</Li>
            <Li>세션 토큰은 HttpOnly·Secure 쿠키로 발급</Li>
            <Li>접근권한 최소화 및 비밀번호·키 관리(환경변수 격리)</Li>
            <Li>비정상 접근 차단(Rate-limit) 및 정기적 점검</Li>
          </Ul>

          <H>9. 14세 미만 아동의 개인정보</H>
          <P>
            서비스는 만 14세 미만 아동의 회원가입을 받지 않습니다. 14세
            미만임이 확인될 경우 즉시 회원 정보를 파기합니다.
          </P>

          <H>10. 개인정보 보호책임자 및 문의처</H>
          <Ul>
            <Li>책임자: 아르보TCG 운영자</Li>
            <Li>
              연락처:{' '}
              <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
            </Li>
          </Ul>
          <P style={{ marginTop: 6 }}>
            기타 개인정보 침해에 대한 신고나 상담이 필요한 경우 아래
            기관에 문의하실 수 있습니다.
          </P>
          <Ul>
            <Li>개인정보침해신고센터 (privacy.kisa.or.kr / ☎ 118)</Li>
            <Li>대검찰청 사이버범죄수사단 (spo.go.kr / ☎ 1301)</Li>
            <Li>경찰청 사이버수사국 (ecrm.cyber.go.kr / ☎ 182)</Li>
          </Ul>

          <H>11. 고지의 의무</H>
          <P>
            본 개인정보처리방침은 시행일로부터 적용되며, 법령·정책 또는
            보안기술의 변경에 따라 내용 추가·삭제·수정이 있을 시 변경되는
            방침의 시행 7일 전부터 공지사항을 통해 고지합니다.
          </P>
          <P style={{ marginTop: 12, fontSize: 9, color: 'var(--ink3)' }}>
            본 방침 시행일: {UPDATED_AT}
          </P>
        </Doc>
      </div>

      <div className="bggap" />
    </>
  );
}

/* ───────────────────── 스타일 헬퍼 ───────────────────── */

function Doc({ children }: { children: React.ReactNode }) {
  return (
    <article
      style={{
        background: 'var(--white)',
        padding: '14px 16px',
        boxShadow:
          '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.85),inset 0 -3px 0 rgba(0,0,0,.12),4px 4px 0 var(--ink)',
      }}
    >
      {children}
    </article>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: '18px 0 8px',
        fontFamily: 'var(--f1)',
        fontSize: 12,
        letterSpacing: 0.5,
        color: 'var(--ink)',
      }}
    >
      {children}
    </h3>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        margin: '10px 0 6px',
        fontFamily: 'var(--f1)',
        fontSize: 10,
        letterSpacing: 0.3,
        color: 'var(--ink2)',
      }}
    >
      {children}
    </h4>
  );
}

function P({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        margin: '0 0 8px',
        fontFamily: 'var(--f1)',
        fontSize: 9,
        lineHeight: 1.9,
        letterSpacing: 0.2,
        color: 'var(--ink2)',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul
      style={{
        margin: '0 0 8px',
        padding: '0 0 0 14px',
        fontFamily: 'var(--f1)',
        fontSize: 9,
        lineHeight: 1.9,
        letterSpacing: 0.2,
        color: 'var(--ink2)',
      }}
    >
      {children}
    </ul>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBottom: 2 }}>{children}</li>;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: 'var(--ink)' }}>{children}</strong>;
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--blu)', textDecoration: 'underline' }}
    >
      {children}
    </a>
  );
}
