import Link from 'next/link';
import { CardThumb } from '@/components/CardThumb';
import { TranslationTicker, type SearchRankItem } from '@/components/TranslationTicker';
import { PIXEL_BORDER } from '@/components/pixelBorder';
import { AppBar } from '@/components/ui/AppBar';
import { Panel } from '@/components/ui/Panel';
import { ListAdRow } from '@/components/ListAdRow';
import { autoPriceSize } from '../../../../shared/util/autoPriceSize';
import { StatusBar } from '@/components/ui/StatusBar';
import { translate } from '@/lib/cardTranslate';
import { snkrdunkUrl } from '@/lib/cardsCatalog';
import { type EbayPriceSnapshot, type EbayItemSummary } from '@/lib/ebay';
import { serverFetch } from '@/lib/apiServer';

export const dynamic = 'force-dynamic';

type SearchMode = 'card' | 'illustrator';

interface SearchParams {
  q?: string;
  mode?: string;
}

interface IllustratorCard {
  id: string;
  name: string;
  setName?: string;
  setCode?: string;
  number?: string;
  totalNumber?: string | number;
  rarity?: string;
  illustrator?: string;
  imageSmall?: string | null;
  imageLarge?: string | null;
}

interface IllustratorSearchResp {
  ok: boolean;
  resolvedName?: string;
  matched?: { en: string; ja: string | null; koAliases: string[] } | null;
  count?: number;
  cards?: IllustratorCard[];
  message?: string;
}

function fmtMoney(n: number, currency: string): string {
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  const num = rounded.toLocaleString('en-US');
  if (currency === 'USD') return `$${num}`;
  if (currency === 'JPY') return `¥${num}`;
  if (currency === 'KRW') return `${num}₩`;
  return `${num} ${currency}`;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const mode: SearchMode = searchParams.mode === 'illustrator' ? 'illustrator' : 'card';
  const jaQuery = q && mode === 'card' ? translate(q, 'ja') : '';
  const enQuery = q && mode === 'card' ? translate(q, 'en') : '';

  // 카드 모드: 기존 eBay 시세 호출. 일러스트레이터 모드: by-illustrator 호출.
  const ebayResp = q && mode === 'card'
    ? await serverFetch<{ configured: boolean; data: EbayPriceSnapshot | null }>(
        `/api/cards/ebay-search?q=${encodeURIComponent(enQuery)}&limit=20`,
        { auth: false },
      )
    : null;
  const configured = ebayResp?.data?.configured ?? false;
  const ebay = ebayResp?.data?.data ?? null;

  const illustResp = q && mode === 'illustrator'
    ? await serverFetch<IllustratorSearchResp>(
        `/api/cards/by-illustrator?q=${encodeURIComponent(q)}&limit=30`,
        { auth: false },
      )
    : null;
  const illust = illustResp?.data ?? null;

  // 전광판용 인기 검색어 순위 (최근 30일 Top 10)
  const topSearches =
    (await serverFetch<{ items: SearchRankItem[] }>('/api/search-log/top', { auth: false })).data
      ?.items ?? [];

  return (
    <>
      <StatusBar />
      <AppBar title="카드 검색" showBack backHref="/cards" />
      <TranslationTicker items={topSearches} />

      <div style={{ height: 14 }} />

      {/* 모드 토글 — 카드 / 일러스트레이터 */}
      <div
        style={{
          display: 'flex',
          margin: '0 var(--gap) 8px',
          border: '2px solid var(--ink)',
          background: 'var(--white)',
        }}
      >
        {(
          [
            { v: 'card' as const, label: '🃏 카드명·코드' },
            { v: 'illustrator' as const, label: '🎨 일러스트레이터' },
          ]
        ).map((opt, i) => (
          <Link
            key={opt.v}
            href={`/cards/search?mode=${opt.v}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            style={{
              flex: 1,
              padding: '10px 0',
              textAlign: 'center',
              background: mode === opt.v ? 'var(--gold)' : 'transparent',
              color: mode === opt.v ? 'var(--ink)' : 'var(--ink3)',
              fontFamily: 'var(--f1)',
              fontSize: 11,
              letterSpacing: 0.3,
              textDecoration: 'none',
              borderLeft: i === 0 ? 'none' : '2px solid var(--ink)',
            }}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* 검색 박스 */}
      <form method="get" className="ko-search-box" style={{ margin: '0 var(--gap) var(--cg)' }}>
        {/* form 이 GET 으로 제출될 때 mode 도 보존 */}
        <input type="hidden" name="mode" value={mode} />
        <div className="ko-search-hint">
          {mode === 'illustrator'
            ? '일러스트레이터 이름 (한국어·영어 OK)'
            : '카드명 / 카드 코드 입력 (한·영 혼용 OK)'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            name="q"
            defaultValue={q}
            placeholder={
              mode === 'illustrator'
                ? '예) 신지칸다, 아리타, Mitsuhiro Arita'
                : '예) 잉어킹 홀로, 리자몽, SV1-045'
            }
            autoFocus
            className="ko-search-input"
          />
          <button type="submit" className="ko-search-submit">
            검색
          </button>
        </div>
      </form>

      {!q ? (
        <div style={{ margin: '0 var(--gap)', padding: 20, fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.7 }}>
          {mode === 'illustrator' ? (
            <>
              일러스트레이터 이름을 한국어나 영어로 입력해 보세요.<br />
              예) <b style={{ color: 'var(--ink)' }}>신지칸다</b>, <b style={{ color: 'var(--ink)' }}>아리타</b>, <b style={{ color: 'var(--ink)' }}>Mitsuhiro Arita</b>
            </>
          ) : (
            <>
              한국어로 입력하면 자동으로<br />
              🇯🇵 스니덩 용 일본어 / 🇺🇸 이베이 용 영어 로<br />
              각각 번역해서 결과를 보여드립니다.
            </>
          )}
        </div>
      ) : mode === 'illustrator' ? (
        <IllustratorResults q={q} resp={illust} />
      ) : (
        <>
          {/* 번역 결과 표시 */}
          <div className="search-panel search-panel--muted">
            입력: <b style={{ color: 'var(--ink)' }}>{q}</b>
            <br />
            🇯🇵 JA: <b style={{ color: 'var(--red)' }}>{jaQuery}</b>
            <br />
            🇺🇸 EN: <b style={{ color: 'var(--blu)' }}>{enQuery}</b>
          </div>

          {/* SNKRDUNK */}
          <div className="sect">
            <div
              className="search-panel"
              style={{ margin: 0, fontFamily: 'var(--f1)', fontSize: 11, letterSpacing: 0.5 }}
            >
              <div style={{ marginBottom: 8, color: 'var(--ink2)' }}>🇯🇵 스니덩 (SNKRDUNK)</div>
              <Link
                href={snkrdunkUrl(jaQuery)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  background: 'var(--yel)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--f1)',
                  fontSize: 10,
                  letterSpacing: 0.5,
                  textDecoration: 'none',
                  boxShadow:
                    '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
                }}
              >
                スニダンで「{jaQuery}」を検索 →
              </Link>
              <div style={{ marginTop: 8, fontSize: 9, color: 'var(--ink3)' }}>
                ※ 공식 API 미제공 — 새 탭에서 SNKRDUNK 검색 페이지로 이동합니다.
              </div>
            </div>
          </div>

          {/* 광고 — 검색결과 블록 사이 */}
          <div className="sect">
            <ListAdRow slotIndex={0} />
          </div>

          {/* eBay 실시간 결과 */}
          <div className="sect">
            <div
              className="search-panel"
              style={{ margin: 0, fontFamily: 'var(--f1)', fontSize: 11, letterSpacing: 0.5 }}
            >
              <div style={{ marginBottom: 8, color: 'var(--ink2)' }}>
                🇺🇸 eBay {ebay ? `· ${ebay.sampleN.toLocaleString()}건 호가 샘플` : ''}
              </div>
              {!configured ? (
                <div style={{ fontSize: 9, color: 'var(--ink3)', lineHeight: 1.7 }}>
                  eBay API 키가 설정되어 있지 않습니다.
                  <br />
                  <code style={{ fontSize: 9 }}>EBAY_CLIENT_ID / EBAY_CLIENT_SECRET</code>
                </div>
              ) : !ebay ? (
                <div style={{ fontSize: 9, color: 'var(--ink3)' }}>
                  검색 결과가 없거나 API 호출이 실패했습니다.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 9, marginBottom: 10 }}>
                    <Badge>최저 {fmtMoney(ebay.low, ebay.currency)}</Badge>
                    <Badge emphasis>평균 {fmtMoney(ebay.avg, ebay.currency)}</Badge>
                    <Badge>중앙 {fmtMoney(ebay.median, ebay.currency)}</Badge>
                    <Badge>최고 {fmtMoney(ebay.high, ebay.currency)}</Badge>
                  </div>
                  <EbayList items={ebay.items} />
                </>
              )}
            </div>
          </div>
        </>
      )}

      <div className="bggap" />
    </>
  );
}

function Badge({ children, emphasis }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <span
      style={{
        padding: '3px 8px',
        background: emphasis ? 'var(--red)' : 'var(--pap2)',
        color: emphasis ? 'var(--white)' : 'var(--ink)',
        fontFamily: 'var(--f1)',
        letterSpacing: 0.3,
        boxShadow: PIXEL_BORDER,
      }}
    >
      {children}
    </span>
  );
}

function EbayList({ items }: { items: EbayItemSummary[] }) {
  if (items.length === 0) return <div style={{ fontSize: 9, color: 'var(--ink3)' }}>리스팅 없음</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it) => (
        <Link
          key={it.itemId}
          href={it.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            background: 'var(--pap2)',
            textDecoration: 'none',
            boxShadow: PIXEL_BORDER,
          }}
        >
          {it.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.thumb}
              alt={it.title}
              width={40}
              height={40}
              style={{ objectFit: 'cover', background: 'var(--white)', flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: 40, height: 40, background: 'var(--white)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--f1)',
                fontSize: 9,
                color: 'var(--ink)',
                letterSpacing: 0.2,
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {it.title}
            </div>
          </div>
          {(() => {
            const label = fmtMoney(it.price, it.currency);
            return (
              <div
                style={{
                  fontFamily: 'var(--f1)',
                  fontSize: autoPriceSize(label, 10, 7),
                  color: 'var(--red)',
                  letterSpacing: 0.3,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  maxWidth: '40%',
                }}
              >
                {label}
              </div>
            );
          })()}
        </Link>
      ))}
    </div>
  );
}

/* ----------------- Illustrator results panel ----------------- */

function IllustratorResults({
  q,
  resp,
}: {
  q: string;
  resp: IllustratorSearchResp | null;
}) {
  // 입력/매칭 정보 배너 — 사전 hit/miss 표시.
  const matched = resp?.matched ?? null;
  const cards = resp?.cards ?? [];
  const resolvedName = resp?.resolvedName ?? q;
  return (
    <>
      <div
        style={{
          margin: '0 var(--gap) var(--cg)',
          padding: '10px 14px',
          background: 'var(--pap2)',
          fontFamily: 'var(--f1)',
          fontSize: 9,
          color: 'var(--ink2)',
          letterSpacing: 0.3,
          lineHeight: 1.8,
          boxShadow:
            '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
        }}
      >
        입력: <b style={{ color: 'var(--ink)' }}>{q}</b>
        <br />
        🎨 검색 이름: <b style={{ color: 'var(--red)' }}>{resolvedName}</b>
        {matched ? (
          <>
            <br />
            ✓ 매칭됨 — 영문 <b>{matched.en}</b>
            {matched.ja ? (
              <>
                {' · '}일문 <b>{matched.ja}</b>
              </>
            ) : null}
          </>
        ) : (
          <>
            <br />
            <span style={{ color: 'var(--ink3)' }}>
              사전 미등록 — 입력 그대로 TCGdex 검색. 한국어 표기가 맞는지 확인해주세요.
            </span>
          </>
        )}
      </div>

      <div className="sect">
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--white)',
            fontFamily: 'var(--f1)',
            fontSize: 11,
            letterSpacing: 0.5,
            boxShadow:
              '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
            marginBottom: 10,
          }}
        >
          <div style={{ color: 'var(--ink2)' }}>
            🎨 일러스트레이터 카드 {cards.length > 0 ? `· ${cards.length}장` : ''}
          </div>
        </div>

        {!resp?.ok ? (
          <div
            style={{
              padding: 20,
              fontFamily: 'var(--f1)',
              fontSize: 10,
              color: 'var(--red)',
              textAlign: 'center',
            }}
          >
            ⚠ {resp?.message ?? '검색 실패 — 잠시 후 다시 시도해주세요.'}
          </div>
        ) : cards.length === 0 ? (
          <div
            style={{
              padding: 20,
              fontFamily: 'var(--f1)',
              fontSize: 10,
              color: 'var(--ink3)',
              textAlign: 'center',
              lineHeight: 1.7,
            }}
          >
            해당 일러스트레이터의 카드를 찾지 못했어요.
            <br />
            <span style={{ fontSize: 9 }}>
              사전 매칭이 안 됐다면 영문 이름(예: Mitsuhiro Arita) 으로도 시도해보세요.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
              padding: '0 var(--gap)',
            }}
          >
            {cards.map((c) => (
              <IllustratorCardTile key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function IllustratorCardTile({ c }: { c: IllustratorCard }) {
  const img = c.imageSmall || c.imageLarge;
  const num = c.number && c.totalNumber ? `${c.number}/${c.totalNumber}` : c.number ?? '';
  return (
    <Panel
      style={{ overflow: 'hidden' }}
      pixelShadow="-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)"
    >
      <CardThumb
        style={{
          aspectRatio: '63 / 88',
          background: 'var(--pap2)',
          overflow: 'hidden',
        }}
        src={img}
        alt={c.name}
        loading="lazy"
        emojiSize={33}
      />
      <div className="cv-card-divider" style={{ padding: '6px 8px 8px' }}>
        <div
          style={{
            fontFamily: 'var(--f1)',
            fontSize: 10,
            color: 'var(--ink)',
            letterSpacing: 0.2,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 28,
          }}
          title={c.name}
        >
          {c.name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: 'var(--f1)',
            fontSize: 8,
            color: 'var(--ink3)',
            letterSpacing: 0.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {[c.setCode?.toUpperCase(), num, c.rarity].filter(Boolean).join(' · ')}
        </div>
      </div>
    </Panel>
  );
}
