import Link from 'next/link';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';
import { serverFetch } from '@/lib/apiServer';
import type { InfoPostsPage } from '../../../shared/infoPosts';

export const dynamic = 'force-dynamic';

/** /info?page=N — 네이버 블로그 정보 글 목록. 앱 mobile/app/info.tsx 와 페어(같은 /api/info-posts). */
export default async function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const r = await serverFetch<InfoPostsPage>(`/api/info-posts?page=${page}`);
  const posts = r.data?.posts ?? [];
  return (
    <>
      <StatusBar />
      <AppBar title="정보 글" showBack backHref="/" />
      <div style={{ height: 14 }} />
      <div className="sect">
        <SectionTitle title="카드 소식과 가이드" right={<span className="more">규타쿠의 오타쿠 활동로그</span>} />
        {!r.ok ? (
          <div style={{ padding: 30, textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>
            글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        ) : posts.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>
            등록된 정보 글이 없어요
          </div>
        ) : (
          posts.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '16px 2px', borderBottom: '1px solid var(--ink3)', color: 'inherit', textDecoration: 'none' }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, marginBottom: 8 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{p.date} · 네이버 블로그 ›</div>
            </a>
          ))
        )}
        {r.data?.hasMore ? (
          <Link href={`/info?page=${page + 1}`} style={{ display: 'block', padding: 20, textAlign: 'center', color: 'var(--ink)', fontWeight: 700, textDecoration: 'none' }}>
            글 더 보기 ›
          </Link>
        ) : null}
      </div>
      <div className="bggap" />
    </>
  );
}
