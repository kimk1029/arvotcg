import type { Metadata } from 'next';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';

/** /privacy/en — 개인정보처리방침 영문판. 한국어판(/privacy)과 내용 동기 유지할 것. */
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How ARVOTCG collects, uses, stores, and deletes personal information.',
  alternates: { canonical: '/privacy/en' },
};

const UPDATED_AT = 'Apr 26, 2026';
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'arvotcg@example.com';

export default function PrivacyEnPage() {
  return (
    <>
      <StatusBar />
      <AppBar title="Privacy Policy" showBack backHref="/my" />

      <div style={{ height: 14 }} />

      <div className="sect">
        <SectionTitle
          title="Privacy Policy"
          right={<span className="more">Effective {UPDATED_AT}</span>}
        />

        <Doc>
          <P>
            ARVOTCG (the &ldquo;Service&rdquo;) values your personal
            information and complies with applicable laws, including the
            Personal Information Protection Act of Korea. This policy explains
            what we collect and how we handle it.{' '}
            <Link href="/privacy">한국어 버전 보기 (Korean version)</Link>
          </P>

          <H>1. Information We Collect</H>
          <P>
            The Service collects the following information for sign-up,
            service provision, and customer support.
          </P>

          <Sub>a. Collected automatically via social login</Sub>
          <Ul>
            <Li>
              <B>Kakao</B> — Kakao member number (service identifier), email
              (only if you consent)
            </Li>
            <Li>
              <B>NAVER</B> — NAVER member identifier, email (only if you
              consent)
            </Li>
            <Li>
              <B>Google</B> — Google account identifier (sub), email (only if
              you consent)
            </Li>
          </Ul>
          <P>
            ※ We do <B>not</B> collect profile photos, legal names, gender,
            age range, or phone numbers. Your in-service avatar and nickname
            are auto-generated at sign-up and can be changed at any time.
          </P>

          <Sub>b. Information you enter while using the Service</Sub>
          <Ul>
            <Li>Nickname (auto-generated, changeable)</Li>
            <Li>
              Content and attached images of trade listings, feed posts, and
              direct messages
            </Li>
            <Li>KakaoTalk ID entered in a trade listing (optional)</Li>
            <Li>
              Bookmarks, owned avatars/backgrounds/frames, points, and draw
              history
            </Li>
          </Ul>

          <Sub>c. Collected automatically</Sub>
          <Ul>
            <Li>
              IP address (daily unique-visitor counting, deduplicated to one
              per IP per day)
            </Li>
            <Li>User-Agent (browser/device type), referer, access path</Li>
            <Li>
              Cookies — session persistence, analytics (Google Analytics), and
              advertising (Google AdSense, Kakao AdFit)
            </Li>
          </Ul>

          <H>2. Purposes of Collection and Use</H>
          <Ul>
            <Li>Member identification, login persistence, and abuse prevention</Li>
            <Li>
              Providing features such as trading, posting, and messaging, and
              enabling communication between users
            </Li>
            <Li>Visitor statistics, service improvement, and content analytics</Li>
            <Li>
              Serving ads (personalized ads only with consent) and revenue
              analytics
            </Li>
            <Li>Customer support and dispute resolution</Li>
          </Ul>

          <H>3. Retention Period</H>
          <P>
            In principle, personal information is destroyed without delay when
            you delete your account. Where retention is required by law, the
            following applies.
          </P>
          <Ul>
            <Li>
              Member information (social identifier, email) — destroyed
              immediately upon account deletion
            </Li>
            <Li>
              User-generated posts (trade listings, feed posts, comments, and
              event posts) — deleted with the account. Records that must be
              retained by law are stored separately from public posts for the
              applicable statutory period.
            </Li>
            <Li>
              Access logs and IP addresses — retained for 3 months under the
              Protection of Communications Secrets Act, then destroyed
            </Li>
            <Li>
              Records of fraudulent use — retained for the applicable period
              when needed for dispute resolution or required by law
            </Li>
          </Ul>

          <H>4. Provision to Third Parties</H>
          <P>
            We do not provide your personal information to third parties,
            except in the following cases.
          </P>
          <Ul>
            <Li>You have given prior consent</Li>
            <Li>
              A lawful request is made by an investigative or administrative
              agency under applicable law
            </Li>
          </Ul>

          <H>5. Data Processors</H>
          <P>
            We entrust the following processors with data processing for
            service operation.
          </P>
          <Ul>
            <Li>
              <B>Supabase Inc.</B> — database hosting (members/posts). Region:
              ap-northeast-2 (Seoul)
            </Li>
            <Li>
              <B>Vercel Inc.</B> — web application hosting and image storage
              (Vercel Blob)
            </Li>
            <Li>
              <B>Google LLC</B> — social login (Google), analytics (Google
              Analytics 4), advertising (Google AdSense)
            </Li>
            <Li>
              <B>Kakao Corp.</B> — social login (Kakao), advertising (Kakao
              AdFit)
            </Li>
            <Li>
              <B>NAVER Corp.</B> — social login (NAVER), map SDK (NAVER Cloud
              Maps)
            </Li>
          </Ul>
          <P style={{ marginTop: 6 }}>
            These processors handle data only to the extent necessary for the
            stated purposes. For some services, data may be processed overseas
            (e.g., in the United States) where their servers are located.
          </P>

          <H>6. Your Rights</H>
          <P>You may exercise the following rights at any time.</P>
          <Ul>
            <Li>Access — view your information directly on My Page</Li>
            <Li>
              Correction — edit your nickname/profile directly on My Page
            </Li>
            <Li>
              Deletion and suspension of processing — delete your account in
              the app (My Page &gt; Withdraw) or contact us below
            </Li>
            <Li>
              Withdraw consent to personalized ads — clear browser cookies or
              opt out with each ad provider
            </Li>
          </Ul>
          <P style={{ marginTop: 6 }}>
            Personalized-ads opt-out:
            <br />· Google:{' '}
            <Link href="https://adssettings.google.com">
              adssettings.google.com
            </Link>
            <br />· Kakao AdFit:{' '}
            <Link href="https://adfit.kakao.com/optout">
              adfit.kakao.com/optout
            </Link>
          </P>

          <H>7. Cookies</H>
          <P>
            The Service uses cookies to provide a better experience. You can
            refuse cookies in your browser settings, but some features such as
            login may be limited.
          </P>
          <Ul>
            <Li>Session cookies — login persistence (required)</Li>
            <Li>Analytics cookies (_ga, etc.) — visitor statistics, Google Analytics</Li>
            <Li>Ad cookies — Google AdSense, Kakao AdFit (personalized ads)</Li>
          </Ul>

          <H>8. Security Measures</H>
          <Ul>
            <Li>Encrypted transport (HTTPS) across the web service</Li>
            <Li>Session tokens issued as HttpOnly/Secure cookies</Li>
            <Li>
              Least-privilege access and secret management (isolated
              environment variables)
            </Li>
            <Li>Rate limiting against abnormal access and periodic reviews</Li>
          </Ul>

          <H>9. Children Under 14</H>
          <P>
            The Service does not accept sign-ups from children under 14. If we
            learn that a member is under 14, we destroy the member&rsquo;s
            information immediately.
          </P>

          <H>10. Privacy Officer and Contact</H>
          <Ul>
            <Li>Officer: ARVOTCG Operator</Li>
            <Li>
              Contact:{' '}
              <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
            </Li>
          </Ul>
          <P style={{ marginTop: 6 }}>
            For reports or counseling regarding privacy infringement in Korea,
            you may also contact:
          </P>
          <Ul>
            <Li>Personal Information Infringement Report Center (privacy.kisa.or.kr / ☎ 118)</Li>
            <Li>Supreme Prosecutors&rsquo; Office Cyber Crime Investigation (spo.go.kr / ☎ 1301)</Li>
            <Li>National Police Agency Cyber Bureau (ecrm.cyber.go.kr / ☎ 182)</Li>
          </Ul>

          <H>11. Notice of Changes</H>
          <P>
            This policy is effective as of the date above. If any content is
            added, deleted, or amended due to changes in laws, policies, or
            security technology, we will announce the change at least 7 days
            before it takes effect.
          </P>
          <P style={{ marginTop: 12, fontSize: 9, color: 'var(--ink3)' }}>
            Effective date: {UPDATED_AT}. In case of any discrepancy between
            this English translation and the Korean original, the Korean
            version prevails.
          </P>
        </Doc>
      </div>

      <div className="bggap" />
    </>
  );
}

/* ───────────────────── 스타일 헬퍼 (한국어판과 동일) ───────────────────── */

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
      target={href.startsWith('http') || href.startsWith('mailto') ? '_blank' : undefined}
      rel="noopener noreferrer"
      style={{ color: 'var(--blu)', textDecoration: 'underline' }}
    >
      {children}
    </a>
  );
}
