import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { PacksExplorer, type PackListRow } from '@/components/PacksExplorer';
import { CARD_PACKS } from '@/lib/cardPacks';
import { translateKnownCardNameToKo } from '@/lib/cardTranslate';
import { serverFetch } from '@/lib/apiServer';

interface ApparelGroupResp {
  apparels?: Array<{ localizedName: string; imageUrl: string | null; minPrice: number }>;
}

interface SearchResp {
  results?: Array<{ name: string; imageUrl: string | null; priceText: string }>;
}

export const metadata = {
  title: '시세확인 · ARVOTCG',
  description: '포켓몬·원피스·유희왕·스포츠 카드 박스를 선택하고 박스별 싱글카드 시세를 확인하세요.',
};

// ISR — 인증 없는 공용 데이터라 캐시해 즉시 서빙 + 백그라운드 재생성.
// (팩 ~56개 × NAS 호출이라 동적 렌더 시 수 초가 걸리던 페이지)
export const revalidate = 600;

/** 박스 시세 TTL — 페이지 revalidate 와 정렬. */
const BOX_TTL = 600;

/** 동시 실행 cap — 한 번의 재생성에서 NAS/스니덩을 한꺼번에 두드리지 않게. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export default async function PackExplorerPage() {
  const packs: PackListRow[] = await mapWithLimit(
    CARD_PACKS,
    8,
    async (pack) => {
      let box: { localizedName: string; imageUrl: string | null; minPrice: number } | null = null;
      if (pack.apparelGroupId) {
        const r = await serverFetch<{ data: ApparelGroupResp | null }>(
          `/api/snkrdunk/apparel-groups/${pack.apparelGroupId}?apparelCategoryId=14&page=1&perPage=1`,
          { auth: false, revalidate: BOX_TTL },
        );
        box = r.data?.data?.apparels?.[0] ?? null;
      } else {
        // 그룹 미확인 팩(비포켓몬 일부) — 검색 1페이지의 첫 박스 매물로 대표 이미지/시세.
        const r = await serverFetch<SearchResp>(
          `/api/snkrdunk/search?q=${encodeURIComponent(`${pack.searchQuery} ボックス`)}`,
          { auth: false, revalidate: BOX_TTL },
        );
        const hit = r.data?.results?.[0];
        if (hit) {
          box = {
            localizedName: hit.name,
            imageUrl: hit.imageUrl,
            minPrice: Number((hit.priceText ?? '').replace(/[^\d]/g, '')) || 0,
          };
        }
      }
      return {
        code: pack.code,
        setCode: pack.setCode,
        game: pack.game ?? 'pokemon',
        name: pack.name,
        emoji: pack.emoji,
        bg: pack.bg,
        releasedAt: pack.releasedAt,
        boxName: box?.localizedName ?? pack.searchQuery,
        boxKoName: box?.localizedName ? translateKnownCardNameToKo(box.localizedName) : pack.name,
        boxImageUrl: box?.imageUrl ?? null,
        boxPrice: box?.minPrice ?? 0,
      };
    },
  );

  return (
    <>
      <StatusBar />
      <AppBar title="시세확인" showBack backHref="/" />
      <PacksExplorer packs={packs} />
      <div className="bggap" />
    </>
  );
}
