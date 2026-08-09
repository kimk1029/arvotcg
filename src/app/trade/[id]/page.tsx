import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { absUrl, plainExcerpt } from '@/lib/seo';
import { BookmarkButton } from '@/components/BookmarkButton';
import { BumpButton } from '@/components/BumpButton';
import { ComposedAvatar } from '@/components/ComposedAvatar';
import { KakaoButton } from '@/components/KakaoButton';
import { TradeStatusActions } from '@/components/TradeStatusActions';
import { ReportMenu } from '@/components/ReportMenu';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { Tag } from '@/components/ui/Tag';
import { getServerUser, serverFetch } from '@/lib/apiServer';
import { formatPrice } from '@/lib/numberFormat';
import type { TradeDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number(params.id);
  if (isNaN(id)) return { title: '거래글' };
  const r = await serverFetch<{ data: TradeDetail }>(`/api/trades/${id}`, { auth: false });
  const trade = r.data?.data;
  if (!trade) return { title: '거래글' };

  const action = trade.type === 'buy' ? '삽니다' : '팝니다';
  const title = `[${action}] ${trade.title}`;
  const description =
    plainExcerpt(trade.body) || `${trade.place} · ${trade.title} — 포켓몬 TCG 카드 거래`;
  // 실제 상품 사진이 있으면 그걸, 없으면 브랜드 이미지로 폴백 — 공유 카드가 항상 채워지도록.
  const ogImage = trade.images?.[0] ?? '/meta.png';
  const canonical = `/trade/${id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: `${title} · 아르보TCG`,
      description,
      url: canonical,
      images: [{ url: ogImage }],
    },
    twitter: { card: 'summary_large_image', images: [ogImage] },
  };
}

export default async function Page({ params }: Props) {
  const id = Number(params.id);
  if (isNaN(id)) notFound();

  const [tradeResp, user] = await Promise.all([
    serverFetch<{ data: TradeDetail }>(`/api/trades/${id}`, { auth: false }),
    getServerUser(),
  ]);
  const trade = tradeResp.data?.data;
  if (!trade) notFound();

  const isAuthor = !!user?.id && user.id === trade.authorId;

  let hasInboundMessage = false;
  if (isAuthor) {
    const r = await serverFetch<{ hasInboundMessage: boolean }>(
      `/api/trades/${id}/inbound-check`,
    );
    hasInboundMessage = r.data?.hasInboundMessage ?? false;
  }

  const STATUS_LABEL: Record<string, string> = {
    open: '거래 중',
    reserved: '예약 중',
    done: '거래 완료',
    cancelled: '취소됨',
  };

  const priceNumber = Number(String(trade.price).replace(/[^\d]/g, ''));

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: trade.title,
            description: plainExcerpt(trade.body) || trade.title,
            ...(trade.images?.length ? { image: trade.images.map(absUrl) } : {}),
            ...(priceNumber > 0
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: priceNumber,
                    priceCurrency: 'KRW',
                    availability:
                      trade.status === 'open'
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/OutOfStock',
                    url: absUrl(`/trade/${id}`),
                  },
                }
              : {}),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '거래', item: absUrl('/trade') },
              { '@type': 'ListItem', position: 2, name: trade.title, item: absUrl(`/trade/${id}`) },
            ],
          },
        ]}
      />
      <StatusBar />
      <AppBar title="거래글" showBack backHref="/trade" />

      <div style={{ padding: '16px var(--gap)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Tag variant={trade.type === 'buy' ? 'buy' : 'sell'}>
            {trade.type === 'buy' ? '삽니다' : '팝니다'}
          </Tag>
          <Tag variant="place">📍 {trade.place}</Tag>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
            {STATUS_LABEL[trade.status] ?? trade.status}
          </span>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>{trade.title}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--muted)' }}>
          <ComposedAvatar
            avatar={trade.authorEmoji}
            bg={trade.authorBgId}
            frame={trade.authorFrameId}
            size={48}
            fallback={trade.authorEmoji}
          />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
              {trade.authorName ?? '-'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{trade.time}</span>
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>
            {formatPrice(trade.price)}
          </span>
          <BookmarkButton tradeId={trade.id} />
          {!isAuthor && (
            <ReportMenu targetType="trade" targetId={trade.id} authorId={trade.authorId} authorName={trade.authorName} />
          )}
        </div>

        {trade.images && trade.images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, paddingTop: 4 }}>
            {trade.images.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', aspectRatio: '1/1', overflow: 'hidden' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`상품 사진 ${i + 1}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    background: 'var(--pap2)',
                    boxShadow:
                      '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
                  }}
                />
              </a>
            ))}
          </div>
        )}

        {trade.body && (
          <div style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {trade.body}
          </div>
        )}

        {!isAuthor && trade.authorId && (
          <Link
            href={`/my/messages/${trade.authorId}?trade=${trade.id}`}
            className="chat-cta"
            aria-label="1:1 쪽지 보내기"
          >
            ✉ 1:1 쪽지 보내기 ▶
          </Link>
        )}

        {trade.kakaoId && (
          <div style={{ marginTop: 8 }}>
            <KakaoButton kakaoId={trade.kakaoId} />
          </div>
        )}

        {isAuthor && (
          <>
            <div style={{ marginTop: 4 }}>
              <BumpButton tradeId={trade.id} initialCount={trade.bumpCount ?? 0} />
            </div>
            <TradeStatusActions
              tradeId={trade.id}
              status={trade.status}
              isAuthor={isAuthor}
              canComplete={hasInboundMessage}
            />
          </>
        )}
      </div>

      <div className="bggap" />
    </>
  );
}
