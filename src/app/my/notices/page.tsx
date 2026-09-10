import { PIXEL_BORDER } from '@/components/pixelBorder';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';
import { serverFetch } from '@/lib/apiServer';
import { NOTICE_TAG_LABEL, noticeDateLabel, type Notice, type NoticeTag } from '@/lib/notices';

export const dynamic = 'force-dynamic';

export const metadata = { title: '공지사항 | 아르보TCG' };

const TAG_STYLE: Record<NoticeTag, { bg: string; color: string }> = {
  update: { bg: 'var(--grn)', color: 'var(--white)' },
  event: { bg: 'var(--red)', color: 'var(--white)' },
  maintenance: { bg: 'var(--ink)', color: 'var(--yel)' },
};

export default async function Page() {
  const r = await serverFetch<{ data: Notice[] }>('/api/notices', { auth: false });
  const notices = r.data?.data ?? [];

  return (
    <>
      <StatusBar />
      <AppBar title="공지사항" showBack backHref="/my" />

      <div style={{ height: 14 }} />

      <div className="sect">
        <SectionTitle title="공지사항" right={<span className="more">{notices.length}건</span>} />
        {notices.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>
            등록된 공지가 없어요
          </div>
        ) : (
          notices.map((n) => (
            <article
              key={n.id}
              style={{
                margin: '0 0 10px',
                padding: '12px 14px',
                background: 'var(--white)',
                boxShadow:
                  '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {n.pinned && (
                  <span
                    style={{
                      fontFamily: 'var(--f1)',
                      fontSize: 9,
                      color: 'var(--ink3)',
                    }}
                  >
                    📌
                  </span>
                )}
                {n.tag && (
                  <span
                    style={{
                      padding: '2px 7px',
                      background: TAG_STYLE[n.tag].bg,
                      color: TAG_STYLE[n.tag].color,
                      fontFamily: 'var(--f1)',
                      fontSize: 9,
                      letterSpacing: 0.5,
                      boxShadow: PIXEL_BORDER,
                    }}
                  >
                    {NOTICE_TAG_LABEL[n.tag]}
                  </span>
                )}
                <span
                  style={{
                    fontFamily: 'var(--f1)',
                    fontSize: 9,
                    color: 'var(--ink3)',
                    letterSpacing: 0.3,
                  }}
                >
                  {noticeDateLabel(n.publishedAt)}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--f1)', fontSize: 12, letterSpacing: 0.5, marginBottom: 6 }}>
                {n.title}
              </div>
              <div
                style={{
                  fontFamily: 'var(--f1)',
                  fontSize: 9,
                  color: 'var(--ink2)',
                  lineHeight: 1.8,
                  letterSpacing: 0.3,
                  whiteSpace: 'pre-line',
                }}
              >
                {n.body}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="bggap" />
    </>
  );
}
