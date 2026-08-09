import type { Metadata } from 'next';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';

export const metadata: Metadata = {
  title: '이용약관',
  description: '아르보TCG 서비스 이용약관',
  alternates: { canonical: '/terms' },
};

const UPDATED_AT = '2026.04.26';
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'arvotcg@example.com';

export default function TermsPage() {
  return (
    <>
      <StatusBar />
      <AppBar title="이용약관" showBack backHref="/my" />

      <div style={{ height: 14 }} />

      <div className="sect">
        <SectionTitle
          title="이용약관"
          right={<span className="more">시행일 {UPDATED_AT}</span>}
        />

        <Doc>
          <H>제1조 (목적)</H>
          <P>
            본 약관은 「아르보TCG」(이하 “서비스”)이 제공하는
            온라인 서비스의 이용과 관련하여 회사와 이용자의 권리·의무 및
            책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
          </P>

          <H>제2조 (용어의 정의)</H>
          <Ul>
            <Li>
              <B>서비스</B> — TCG 카드 시세 정보 제공, 카드 검색·컬렉션
              관리, 이용자 간 카드 거래, 피드/쪽지/오리파 등 본 사이트가
              제공하는 모든 기능
            </Li>
            <Li>
              <B>이용자</B> — 본 약관에 따라 서비스를 이용하는 회원 및
              비회원
            </Li>
            <Li>
              <B>회원</B> — Kakao/Naver/Google 소셜 로그인을 통해 가입한
              자
            </Li>
            <Li>
              <B>게시물</B> — 회원이 서비스에 게시한 모든 텍스트·이미지
              및 부수 정보
            </Li>
            <Li>
              <B>포인트</B> — 서비스 내에서 사용 가능한 가상의 보상
              수단(현금성 가치 없음)
            </Li>
          </Ul>

          <H>제3조 (약관의 효력 및 변경)</H>
          <P>
            본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.
            관련 법령에 위배되지 않는 범위에서 약관이 변경될 수 있으며,
            변경 시 시행일 7일 이전(이용자에게 불리한 변경의 경우 30일
            이전)에 공지합니다.
          </P>

          <H>제4조 (회원가입)</H>
          <Ul>
            <Li>
              회원가입은 소셜 로그인(Kakao/Naver/Google) 시 본 약관 및
              개인정보처리방침에 동의한 것으로 간주됩니다.
            </Li>
            <Li>만 14세 미만은 가입할 수 없습니다.</Li>
            <Li>
              타인 명의 도용·허위정보 입력·다중계정 부정이용 시 가입이
              제한 또는 취소될 수 있습니다.
            </Li>
          </Ul>

          <H>제5조 (회원 탈퇴 및 자격 상실)</H>
          <Ul>
            <Li>
              회원은 마이페이지 또는 운영자 문의를 통해 언제든 탈퇴를
              요청할 수 있으며, 즉시 회원 자격이 상실됩니다.
            </Li>
            <Li>
              다음의 경우 사전 통지 없이 자격을 제한·정지·박탈할 수
              있습니다.
              <Ul>
                <Li>타인의 권리(저작권·초상권·명예 등)를 침해한 경우</Li>
                <Li>
                  허위 거래·사기·반복적인 노쇼 등 다른 이용자에게 피해를
                  끼친 경우
                </Li>
                <Li>
                  자동화 도구·매크로 등을 이용한 어뷰징, 포인트 부정 취득
                </Li>
                <Li>음란·폭력·혐오·불법 정보 게시</Li>
                <Li>기타 법령 또는 본 약관 위반</Li>
              </Ul>
            </Li>
          </Ul>

          <H>제6조 (서비스의 제공 및 변경)</H>
          <Ul>
            <Li>
              서비스는 연중무휴, 1일 24시간 제공을 원칙으로 하나, 시스템
              점검·장애·천재지변 등 불가피한 사유로 일시 중단될 수
              있습니다.
            </Li>
            <Li>
              운영상·기술상 필요에 따라 서비스의 일부 또는 전부를
              변경하거나 중단할 수 있으며, 사전 공지를 원칙으로 합니다.
            </Li>
          </Ul>

          <H>제7조 (게시물의 권리·책임)</H>
          <Ul>
            <Li>
              게시물의 저작권은 작성자에게 귀속됩니다. 다만 회원은
              서비스 운영·홍보 목적의 비독점적 사용권을 서비스에
              부여합니다.
            </Li>
            <Li>
              게시물의 내용에 대한 책임은 작성자 본인에게 있으며, 운영자는
              법령 위반·타인 권리침해 게시물에 대해 사전 통지 없이 삭제할
              수 있습니다.
            </Li>
            <Li>
              회원이 탈퇴한 경우, 게시물 작성자 표시는 익명 처리되며
              본문은 서비스 운영·법적 보존 의무가 있는 한 유지될 수
              있습니다.
            </Li>
          </Ul>

          <H>제8조 (이용자 간 거래 및 면책)</H>
          <P>
            서비스는 이용자 간 거래의 <B>중개·소개 플랫폼</B>이며, 거래
            당사자가 아닙니다. 다음 사항을 명시합니다.
          </P>
          <Ul>
            <Li>
              결제·배송·교환·환불 등 모든 거래 절차는 이용자 간 직접
              진행됩니다.
            </Li>
            <Li>
              운영자는 거래로 인해 발생하는 분쟁·사기·물품 하자·금전
              손실 등에 대해 책임을 지지 않습니다.
            </Li>
            <Li>
              이용자는 안전한 거래를 위해 직거래(대면 확인)를 권장합니다.
            </Li>
          </Ul>

          <H>제9조 (포인트 정책)</H>
          <Ul>
            <Li>
              포인트는 서비스 내 가상 보상으로, 현금·실물·외부 자산으로
              환전·환불되지 않습니다.
            </Li>
            <Li>
              포인트는 피드 작성·제보·거래 등 서비스 내 활동을 통해
              지급됩니다.
            </Li>
            <Li>
              유료 충전 및 무료 광고 충전 기능은 현재 제공하지 않습니다.
            </Li>
            <Li>
              어뷰징(자동화·다중계정·자기참조 등)으로 취득한 포인트 및
              해당 계정으로 구매한 아이템은 사전 통지 없이 회수될 수
              있습니다.
            </Li>
            <Li>
              회원 탈퇴 시 보유 포인트는 즉시 소멸하며, 보상되지 않습니다.
            </Li>
          </Ul>

          <H>제10조 (광고 게재)</H>
          <P>
            서비스는 운영을 위해 Google AdSense, Kakao AdFit 등 광고
            네트워크의 광고를 게재할 수 있습니다. 광고를 클릭하여
            연결되는 외부 사이트의 콘텐츠 및 거래에 대해서는 운영자가
            책임지지 않습니다.
          </P>

          <H>제11조 (지식재산권)</H>
          <Ul>
            <Li>
              서비스 내 운영자가 작성한 콘텐츠 및 디자인 전반의
              저작권은 운영자에게 귀속됩니다.
            </Li>
            <Li>
              포켓몬 관련 명칭·캐릭터·이미지는 © Nintendo · Game Freak
              · The Pokémon Company의 자산이며, 본 서비스는 상업적
              연관이 없습니다.
            </Li>
          </Ul>

          <H>제12조 (면책조항)</H>
          <Ul>
            <Li>
              운영자는 천재지변·전쟁·정전·통신장애·해킹·법령 변경 등
              불가항력으로 인한 서비스 제공 불능에 대하여 책임을 지지
              않습니다.
            </Li>
            <Li>
              이용자가 게재한 정보의 신뢰성·정확성·합법성에 대해 운영자는
              책임을 지지 않습니다.
            </Li>
            <Li>
              이용자 간 또는 이용자와 제3자 간 발생한 분쟁에 운영자는
              개입하지 않으며, 그로 인한 손해를 배상할 책임이 없습니다.
            </Li>
          </Ul>

          <H>제13조 (준거법 및 관할)</H>
          <P>
            본 약관과 관련된 분쟁은 대한민국 법령에 따르며, 운영자
            소재지를 관할하는 법원을 1심 전속 관할법원으로 합니다.
          </P>

          <H>제14조 (문의)</H>
          <P>
            본 약관에 대한 문의는 다음 연락처로 가능합니다.
            <br />
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
          </P>

          <P style={{ marginTop: 12, fontSize: 9, color: 'var(--ink3)' }}>
            본 약관 시행일: {UPDATED_AT}
          </P>
        </Doc>
      </div>

      <div className="bggap" />
    </>
  );
}

/* ───────── 스타일 헬퍼 (privacy 와 동일 톤) ───────── */

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
