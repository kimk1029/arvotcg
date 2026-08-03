import { notFound } from 'next/navigation';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { PackMarketSections } from '@/components/PackMarketSections';
import { serverFetch } from '@/lib/apiServer';
import type { PackWithHits } from '@/lib/cardPackHits';

export const revalidate = 900;

interface Params {
  params: Promise<{ code: string }>;
}

async function loadPack(code: string): Promise<PackWithHits | null> {
  const r = await serverFetch<{ data: PackWithHits }>(
    `/api/card-packs/${encodeURIComponent(code)}?limit=600`,
    { auth: false },
  );
  return r.data?.data ?? null;
}

export default async function PackDetailPage({ params }: Params) {
  const { code } = await params;
  const pack = await loadPack(code);
  if (!pack) notFound();

  const cards = pack.hits.filter((hit) => hit.itemKind === 'single');
  const boxes = pack.hits.filter((hit) => hit.itemKind === 'box');

  return (
    <>
      <StatusBar />
      <AppBar title={pack.shortName} showBack backHref="/cards/packs" />

      <div className="sect">
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 14,
            background: pack.bg, color: 'var(--white)',
            boxShadow:
              '-4px 0 0 var(--ink),4px 0 0 var(--ink),0 -4px 0 var(--ink),0 4px 0 var(--ink),inset 0 3px 0 rgba(255,255,255,.45),inset 0 -3px 0 rgba(0,0,0,.25),6px 6px 0 var(--ink)',
          }}
        >
          <div
            style={{
              width: 74,
              height: 74,
              background: 'rgba(255,255,255,.16)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow:
                '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.3)',
            }}
          >
            {pack.boxImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pack.boxImageUrl} alt={pack.boxKoName ?? pack.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 39 }}>{pack.emoji}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--f1)', fontSize: 14, letterSpacing: 0.5 }}>{pack.name}</div>
            {pack.boxName ? (
              <div style={{ fontFamily: 'var(--f1)', fontSize: 9, opacity: 0.78, marginTop: 5, lineHeight: 1.45 }}>
                {pack.boxKoName}
                <br />
                {pack.boxName}
              </div>
            ) : null}
            <div style={{ fontFamily: 'var(--f1)', fontSize: 10, opacity: 0.85, marginTop: 6, letterSpacing: 0.3 }}>
              {pack.releasedAt ? `${pack.releasedAt} 출시 · ` : ''}싱글카드 {cards.length}개
            </div>
          </div>
        </div>
      </div>

      <PackMarketSections cards={cards} boxes={boxes} />

      <div className="bggap" />
    </>
  );
}

export async function generateMetadata({ params }: Params) {
  const { code } = await params;
  const pack = await loadPack(code);
  if (!pack) return { title: '카드팩' };
  return {
    title: `${pack.name} · 힛카드 시세 — ARVOTCG`,
    description: `${pack.name} 팩에서 나오는 힛카드들의 실시간 시세 (스니다 기준).`,
    alternates: { canonical: `/cards/packs/${encodeURIComponent(code)}` },
  };
}
