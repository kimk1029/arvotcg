import { NoticeManager, type NoticeData } from '@/components/NoticeManager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let notices: NoticeData[] = [];
  let loadError: string | null = null;
  try {
    const rows = await prisma.notice.findMany({
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
    });
    notices = rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      tag: n.tag,
      pinned: n.pinned,
      published: n.published,
      publishedAt: n.publishedAt,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.error('[admin.notices.page]', e);
  }

  return (
    <>
      <h1 className="admin-h1">공지사항</h1>
      <p className="admin-sub">
        웹·앱 사이드메뉴 &gt; 공지사항에 그대로 노출됩니다. 비공개 공지는 노출되지 않습니다.
      </p>
      {loadError && (
        <div style={{ padding: '9px 12px', borderRadius: 6, fontSize: 12, background: '#FEF2F2', color: '#B91C1C', marginBottom: 12 }}>
          ⚠ 목록을 불러오지 못했습니다 ({loadError}). notices 테이블이 아직 없다면 스키마 배포 후 다시 시도하세요.
        </div>
      )}
      <NoticeManager initialNotices={notices} />
    </>
  );
}
