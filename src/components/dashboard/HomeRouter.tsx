'use client';

import { StatusBar } from '@/components/ui/StatusBar';
import type { SnkrdunkRow } from '@/lib/snkrdunkRow';
import { CleanHome } from '@/components/dashboard/CleanHome';
import type { HeroSlideData } from '@/components/HeroSlider';
import type { MyCardWithPrice } from '@/lib/queries';
import type { MvcAuctionItem } from '@/lib/navercafe';

interface Props {
  cards: MyCardWithPrice[];
  heroBanners?: HeroSlideData[];
  isLoggedIn: boolean;
  snkrdunkRows?: SnkrdunkRow[];
  snkrdunkBoxRows?: SnkrdunkRow[];
  mvcAuctions?: MvcAuctionItem[];
}

/**
 * 메인화면 — 모든 테마가 동일한 프로토타입 레이아웃(CleanHome)을 쓰고,
 * 색/폰트만 테마별로 달라진다. (CleanHome 내부에서 useTheme 로 팔레트 선택)
 */
export function HomeRouter(props: Props) {
  return (
    <>
      <StatusBar />
      <CleanHome
        heroBanners={props.heroBanners}
        isLoggedIn={props.isLoggedIn}
        snkrdunkRows={props.snkrdunkRows}
        snkrdunkBoxRows={props.snkrdunkBoxRows}
        mvcAuctions={props.mvcAuctions}
      />
    </>
  );
}
