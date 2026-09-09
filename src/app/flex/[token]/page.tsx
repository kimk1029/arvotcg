import type { Metadata } from 'next';
import { FlexPoster, type FlexData } from '@/components/FlexPoster';

export const dynamic = 'force-dynamic';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? process.env.API_ORIGIN ?? 'https://api.arvotcg.com';

async function load(token: string): Promise<FlexData | null> {
  try {
    const r = await fetch(`${API}/api/flex/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: FlexData };
    return j.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const d = await load(params.token);
  if (!d) return { title: '수익 인증 · ARVOTCG' };
  return {
    title: `${d.name} 수익 인증 · ARVOTCG`,
    description: `${d.owner.name} 님의 카드 · 등록가 대비 현재 시세`,
    openGraph: { images: d.imageUrl ? [d.imageUrl] : [] },
  };
}

/** 수익 인증 포스터 — 링크만 있으면 누구나 볼 수 있는 공개 페이지(공유용). */
export default async function Page({ params }: { params: { token: string } }) {
  const data = await load(params.token);
  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#EAF1FF', fontFamily: 'var(--f1)', color: '#3A4A6B', fontSize: 14, textAlign: 'center', padding: 24 }}>
        만료되었거나 존재하지 않는 인증 링크예요.
      </div>
    );
  }
  return <FlexPoster data={data} />;
}
