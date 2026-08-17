import type { Metadata } from 'next';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';

// Google Play 데이터 보안 요건용 공개 페이지 — 스토어 등록정보의 "계정 삭제 URL".
// 요건: 앱 이름 기재 / 삭제 단계 안내 / 삭제·보관 데이터 유형과 보관 기간 명시.

export const metadata: Metadata = {
  title: '계정 삭제 안내',
  description: 'ARVOTCG(아르보TCG) 계정 및 데이터 삭제 요청 방법 안내',
  alternates: { canonical: '/account-deletion' },
};

const UPDATED_AT = '2026.08.17';
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'arvotcg@example.com';

const pStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: 'var(--f1)',
  fontSize: 9,
  lineHeight: 1.9,
  color: 'var(--ink2)',
};

const hStyle: React.CSSProperties = {
  margin: '18px 0 8px',
  fontFamily: 'var(--f1)',
  fontSize: 12,
  letterSpacing: 0.5,
  color: 'var(--ink)',
};

export default function AccountDeletionPage() {
  return (
    <>
      <StatusBar />
      <AppBar title="계정 삭제 안내" showBack backHref="/" />

      <div style={{ height: 14 }} />

      <div className="sect">
        <SectionTitle
          title="계정 삭제 안내"
          right={<span className="more">시행일 {UPDATED_AT}</span>}
        />

        <article
          style={{
            background: 'var(--white)',
            padding: '14px 16px',
            boxShadow:
              '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.85),inset 0 -3px 0 rgba(0,0,0,.12),4px 4px 0 var(--ink)',
          }}
        >
          <p style={pStyle}>
            본 페이지는 「ARVOTCG(아르보TCG)」 앱·웹 서비스의 계정 및 관련
            데이터 삭제 요청 방법을 안내합니다.
          </p>

          <h3 style={hStyle}>1. 앱/웹에서 직접 삭제 (즉시 처리)</h3>
          <ol style={{ ...pStyle, paddingLeft: 18 }}>
            <li>ARVOTCG 앱 또는 웹(poke-30.com)에 로그인합니다.</li>
            <li>하단 탭에서 「마이」(마이페이지)로 이동합니다.</li>
            <li>페이지 맨 아래의 「회원 탈퇴」를 누릅니다.</li>
            <li>안내 내용을 확인하고 탈퇴를 확정하면 즉시 삭제됩니다.</li>
          </ol>

          <h3 style={hStyle}>2. 이메일로 삭제 요청</h3>
          <p style={pStyle}>
            앱에 접근할 수 없는 경우, 가입에 사용한 소셜 계정의 이메일로{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--ink)' }}>
              {CONTACT_EMAIL}
            </a>
            에 “계정 삭제 요청”을 보내주세요. 본인 확인 후 7일 이내에
            처리합니다.
          </p>

          <h3 style={hStyle}>3. 삭제되는 데이터</h3>
          <p style={pStyle}>
            탈퇴 시 아래 데이터가 <b>즉시 영구 삭제</b>되며 복구할 수 없습니다.
          </p>
          <ul style={{ ...pStyle, paddingLeft: 18 }}>
            <li>계정 정보 — 소셜 로그인 식별값, 이메일, 닉네임, 프로필 사진</li>
            <li>컬렉션·포트폴리오, 관심 카드(북마크)</li>
            <li>알림, 쪽지(메시지), 차단 목록 등 개인 활동 데이터</li>
          </ul>

          <h3 style={hStyle}>4. 보관되는 데이터 및 기간</h3>
          <ul style={{ ...pStyle, paddingLeft: 18 }}>
            <li>
              작성한 게시물(거래글·피드 글·댓글)은 작성자가 「탈퇴한
              사용자」로 익명 처리된 상태로 유지됩니다. 게시물까지 삭제를
              원하시면 탈퇴 전에 직접 삭제하거나 위 이메일로 함께 요청해
              주세요.
            </li>
            <li>
              전자상거래 등 관련 법령에 따라 보관 의무가 있는 기록은 해당
              법정 기간 동안 분리 보관 후 파기됩니다. 자세한 내용은{' '}
              <a href="/privacy" style={{ color: 'var(--ink)' }}>
                개인정보처리방침
              </a>
              을 참고하세요.
            </li>
          </ul>

          <h3 style={hStyle}>5. 계정 삭제 없이 일부 데이터만 삭제</h3>
          <p style={pStyle}>
            탈퇴하지 않고도 본인이 작성한 게시물·사진·댓글은 각 게시물의 삭제
            메뉴에서 직접 삭제할 수 있으며, 그 외 데이터는 위 이메일로 개별
            삭제를 요청할 수 있습니다.
          </p>
        </article>
      </div>

      <div style={{ height: 40 }} />
    </>
  );
}
