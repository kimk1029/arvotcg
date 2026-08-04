import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { PacksExplorer, type PackListRow } from '@/components/PacksExplorer';
import { CARD_PACKS } from '@/lib/cardPacks';
import { serverFetch } from '@/lib/apiServer';

/**
 * 시세확인 박스 리스트 — 카탈로그+대표 박스는 NAS `/api/card-packs?withBox=1`
 * 단일 소스. 서버 카탈로그에 세트를 추가·배포하면 웹·앱 재배포 없이 목록에
 * 바로 뜬다 (앱 packs/index.tsx 와 동일 플로우). 번들 CARD_PACKS 는 NAS
 * 미응답 시 박스 정보 없는 폴백으로만 쓴다.
 */

interface PackWithBoxResp {
  code: string;
  setCode?: string;
  game?: PackListRow['game'];
  name: string;
  emoji: string;
  bg: string;
  releasedAt?: string;
  boxName: string;
  boxKoName: string;
  boxImageUrl: string | null;
  boxPrice: number;
}

export const metadata = {
  title: '시세확인 · ARVOTCG',
  description: '포켓몬·원피스·유희왕·스포츠 카드 박스를 선택하고 박스별 싱글카드 시세를 확인하세요.',
};

// ISR — 인증 없는 공용 데이터라 캐시해 즉시 서빙 + 백그라운드 재생성.
export const revalidate = 600;

/** 박스 시세 TTL — 페이지 revalidate 와 정렬. */
const BOX_TTL = 600;

export default async function PackExplorerPage() {
  const r = await serverFetch<{ data?: PackWithBoxResp[] }>(
    '/api/card-packs?withBox=1',
    { auth: false, revalidate: BOX_TTL },
  );
  // withBox 미지원 구서버가 meta 목록만 돌려주는 과도기 대비 — 박스 필드 유무로 검증.
  const fromServer =
    r.data?.data && r.data.data.length > 0 && typeof r.data.data[0].boxName === 'string'
      ? r.data.data
      : null;
  const rows: PackWithBoxResp[] =
    fromServer ??
    // NAS 미응답 폴백 — 번들 카탈로그로 박스 이미지/시세 없이 표시.
    CARD_PACKS.map((pack) => ({
          code: pack.code,
          setCode: pack.setCode,
          game: pack.game,
          name: pack.name,
          emoji: pack.emoji,
          bg: pack.bg,
          releasedAt: pack.releasedAt,
          boxName: pack.searchQuery,
          boxKoName: pack.name,
          boxImageUrl: null,
          boxPrice: 0,
        }));

  const packs: PackListRow[] = rows.map((pack) => ({
    code: pack.code,
    setCode: pack.setCode,
    game: pack.game ?? 'pokemon',
    name: pack.name,
    emoji: pack.emoji,
    bg: pack.bg,
    releasedAt: pack.releasedAt,
    boxName: pack.boxName,
    boxKoName: pack.boxKoName,
    boxImageUrl: pack.boxImageUrl,
    boxPrice: pack.boxPrice,
  }));

  return (
    <>
      <StatusBar />
      <AppBar title="시세확인" showBack backHref="/" />
      <PacksExplorer packs={packs} />
      <div className="bggap" />
    </>
  );
}
