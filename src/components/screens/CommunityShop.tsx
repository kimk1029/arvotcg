'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { HAS_NAVER_MAP_KEY, ShopNaverMap } from '@/components/screens/ShopNaverMap';
import {
  ALL_REGIONS,
  SHOP_COMING_SOON,
  SHOP_COMING_SOON_SUB,
  SHOP_COMING_SOON_TEXT,
  SHOP_COUNTRIES,
  buildRegionTree,
  filterShopsByRegion,
  regionFocusOf,
  regionLabel,
  type RegionSelection,
  type ShopCountry,
} from '@/lib/shopRegions';

/**
 * 커뮤니티 Shop 모드 — Claude Design 'ARVOTCG 커뮤니티' 프로토타입의 샵 화면.
 * 지도(핀 선택) · 선택 샵 요약 카드(오리파 도넛·후기 토글·지도앱 링크) ·
 * 후기 작성 폼 · 주변 카드샵 리스트 · 방문 후기 피드(무한 스크롤).
 * 샵 데이터는 어드민 관리 API(/api/shops), 후기는 프로토타입 정적 편집 데이터.
 * 모바일 CommunityShop 과 페어.
 */

export interface ShopPalette {
  pageBg: string;
  cardBg: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  red: string;
  line: string;
  chip: string;
  chev: string;
}

const ORANGE = '#FF7A00';
const ORANGE_SOFT = '#FFF1E6';
const STAR = '#FFC53D';

interface ShopInfo {
  id: string;
  name: string;
  official?: boolean;
  addr: string;
  dist: string;
  rating: string;
  reviews: number;
  oripa: string;
  single: string;
  priceLv: string;
  priceColor: string;
  grad: string;
  emoji: string;
  x: string;
  y: string;
  /** 네이버 지도 좌표 (근사값 — Geocoder 가 주소 기준으로 보정) */
  lat: number;
  lng: number;
}

/** API 실패 시 폴백 — server/routes/shops.ts 의 DEFAULT_SHOPS(시드)와 동일 내용. */
const FALLBACK_SHOPS: ShopInfo[] = [
  { id: 's1', name: '포켓랩 성수점', official: true, addr: '서울 성동구 연무장길 21', dist: '320m', rating: '4.8', reviews: 214, oripa: '65%', single: '1,240종', priceLv: '저렴', priceColor: '#1E8E5A', grad: 'linear-gradient(150deg,#ffb347,#ff7a1f)', emoji: '🎁', x: '30%', y: '38%', lat: 37.5433, lng: 127.0512 },
  { id: 's2', name: '카드킹덤 홍대', official: true, addr: '서울 마포구 와우산로 105', dist: '1.2km', rating: '4.6', reviews: 158, oripa: '40%', single: '2,860종', priceLv: '보통', priceColor: '#16161a', grad: 'linear-gradient(150deg,#6fb1e0,#3a6ea5)', emoji: '👑', x: '62%', y: '30%', lat: 37.5535, lng: 126.9256 },
  { id: 's3', name: 'TCG스테이션', addr: '서울 성동구 왕십리로 83', dist: '850m', rating: '4.4', reviews: 96, oripa: '80%', single: '420종', priceLv: '높음', priceColor: '#F5333F', grad: 'linear-gradient(150deg,#9d6bd6,#4568dc)', emoji: '🚉', x: '46%', y: '66%', lat: 37.557, lng: 127.04 },
  { id: 's4', name: '몬스터카드샵', addr: '서울 광진구 아차산로 200', dist: '2.1km', rating: '4.2', reviews: 61, oripa: '25%', single: '3,150종', priceLv: '저렴', priceColor: '#1E8E5A', grad: 'linear-gradient(150deg,#11998e,#38ef7d)', emoji: '👾', x: '78%', y: '58%', lat: 37.5405, lng: 127.0715 },
];

/** GET /api/shops 응답 행 (card_shops — 어드민 관리). */
interface ShopApiRow {
  id: number;
  name: string;
  official: boolean;
  addr: string;
  lat: number | null;
  lng: number | null;
  emoji: string;
  gradFrom: string;
  gradTo: string;
  tileColor: string;
  oripaPct: number;
  singleText: string;
  priceLevel: string;
  rating: number;
  reviewCount: number;
  dist: string;
}

// 좌표 미입력 샵의 초기 위치 — 지도 Geocoder 가 주소 기준으로 곧바로 보정한다.
const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

function priceColorOf(lv: string): string {
  return lv === '저렴' ? '#1E8E5A' : lv === '높음' ? '#F5333F' : '#16161a';
}

function shopFromApi(r: ShopApiRow): ShopInfo {
  return {
    id: `s${r.id}`,
    name: r.name,
    official: r.official || undefined,
    addr: r.addr,
    dist: r.dist,
    rating: r.rating.toFixed(1),
    reviews: r.reviewCount,
    oripa: `${r.oripaPct}%`,
    single: r.singleText || '-',
    priceLv: r.priceLevel,
    priceColor: priceColorOf(r.priceLevel),
    grad: `linear-gradient(150deg,${r.gradFrom},${r.gradTo})`,
    emoji: r.emoji,
    // 일러스트 폴백 지도용 근사 위치 — id 기반 고정 분산.
    x: `${22 + ((r.id * 37) % 56)}%`,
    y: `${28 + ((r.id * 53) % 46)}%`,
    lat: r.lat ?? SEOUL_CENTER.lat,
    lng: r.lng ?? SEOUL_CENTER.lng,
  };
}

const REVIEW_TAGS = ['오리파 알참', '가격 착함', '응대 친절', '매장 쾌적', '재고 많음'];

interface ReviewItem {
  sid: string;
  avatar: string;
  avGrad: string;
  name: string;
  time: string;
  rating: string;
  text: string;
  tags: string[];
}

const REVIEW_POOL: ReviewItem[] = [
  { sid: 's1', avatar: '🐹', avGrad: 'linear-gradient(150deg,#ffe08a,#ffb347)', name: '카드사랑', time: '2시간 전', rating: '5.0', text: '오리파 구성이 진짜 알차요. SAR 한 장 뽑고 갑니다 ㅋㅋ 사장님도 친절하세요', tags: ['오리파 알참', '응대 친절'] },
  { sid: 's2', avatar: '🔮', avGrad: 'linear-gradient(150deg,#8e6bd6,#5a3aa8)', name: '홀로수집가', time: '5시간 전', rating: '4.5', text: '싱글 카드 종류가 많아서 좋았어요. 시세보다 살짝 저렴한 것도 꽤 있음', tags: ['재고 많음', '가격 착함'] },
  { sid: 's3', avatar: '🌙', avGrad: 'linear-gradient(150deg,#3a3a44,#16161a)', name: '블래키킹', time: '어제', rating: '3.5', text: '오리파 위주 매장이라 싱글은 별로 없어요. 오리파는 재밌긴 한데 가격대가 좀 있는 편', tags: ['오리파 알참'] },
  { sid: 's1', avatar: '⚡', avGrad: 'linear-gradient(150deg,#f9d423,#ff8a3c)', name: 'SAR매니아', time: '어제', rating: '4.5', text: '5만원 오리파에서 AR 카드 나왔어요! 구성 공개가 투명해서 믿고 사는 편', tags: ['오리파 알참', '매장 쾌적'] },
  { sid: 's4', avatar: '👾', avGrad: 'linear-gradient(150deg,#11998e,#38ef7d)', name: '겟데이', time: '2일 전', rating: '4.0', text: '싱글 위주 매장. 스탠다드 카드 재고가 압도적으로 많아요. 시세 체크하고 가면 득템 가능', tags: ['재고 많음', '가격 착함'] },
  { sid: 's2', avatar: '🌸', avGrad: 'linear-gradient(150deg,#f7a6c4,#b78cf0)', name: '나나미짱', time: '2일 전', rating: '5.0', text: '매장이 넓고 쾌적해요. SR 이상 진열장 구경만 해도 재밌음. 홍대 오면 꼭 들르세요', tags: ['매장 쾌적', '응대 친절'] },
  { sid: 's3', avatar: '🐲', avGrad: 'linear-gradient(150deg,#ff9a3c,#ff5a1f)', name: '불꽃수집가', time: '3일 전', rating: '4.0', text: '1만원 오리파 가성비 괜찮아요. 꽝이어도 최소 보장이 있어서 부담 없음', tags: ['오리파 알참'] },
  { sid: 's1', avatar: '🦈', avGrad: 'linear-gradient(150deg,#5b86e5,#36d1dc)', name: '카드샤크', time: '3일 전', rating: '4.5', text: '그레이딩 카드 매입도 해줘서 편해요. 매입가도 시세 대비 양호한 편입니다', tags: ['가격 착함', '응대 친절'] },
  { sid: 's4', avatar: '🌊', avGrad: 'linear-gradient(150deg,#6fb1e0,#3a6ea5)', name: '물타입장인', time: '4일 전', rating: '3.5', text: '오리파는 거의 없지만 싱글 컨디션이 좋아요. 카드 상태 직접 확인하고 살 수 있음', tags: ['재고 많음'] },
  { sid: 's2', avatar: '🌟', avGrad: 'linear-gradient(150deg,#f7d774,#e0a500)', name: '사나피버', time: '5일 전', rating: '4.5', text: 'SR 싱글 시세가 착해요. 여자친구랑 같이 갔는데 입문자한테도 친절하게 설명해주심', tags: ['응대 친절', '가격 착함'] },
];

const officialBadge = (
  <svg width="15" height="15" viewBox="0 0 24 24" style={{ flex: 'none' }}>
    <path d="M12 1.5 14.8 4l3.7-.4 1 3.6 3.2 1.9-1.6 3.4 1.6 3.4-3.2 1.9-1 3.6-3.7-.4L12 22.5 9.2 20l-3.7.4-1-3.6-3.2-1.9 1.6-3.4L1.3 8.1l3.2-1.9 1-3.6 3.7.4z" fill="#2C8FFF" />
    <path d="m9 12 2 2 4-4.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ShopSection({ P }: { P: ShopPalette }) {
  // 한국 / 일본 카드샵 탭. 일본은 아직 데이터가 없어 자리만 있다.
  const [country, setCountry] = useState<ShopCountry>('kr');
  // 지역 — 기본 '내 주변'(전체). 칩을 누르면 시/도 → 구/군 선택 시트.
  const [sel, setSel] = useState<RegionSelection>(ALL_REGIONS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shopId, setShopId] = useState('s1');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [myStars, setMyStars] = useState(0);
  const [myTags, setMyTags] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewCount, setReviewCount] = useState(5);

  // 어드민 관리 샵 목록 — null = 로딩 중 (네이버 지도는 마커를 마운트 시 1회
  // 생성하므로 목록 확정 후에만 렌더). 실패/빈 응답이면 폴백 유지.
  const [shops, setShops] = useState<ShopInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/shops', { cache: 'no-store' })
      .then((r) => r.json())
      .then((b: { shops?: ShopApiRow[] }) => {
        if (cancelled) return;
        const rows = Array.isArray(b?.shops) ? b.shops : [];
        const next = rows.length > 0 ? rows.map(shopFromApi) : FALLBACK_SHOPS;
        setShops(next);
        setShopId((cur) => (next.some((s) => s.id === cur) ? cur : next[0].id));
      })
      .catch(() => { if (!cancelled) setShops(FALLBACK_SHOPS); });
    return () => { cancelled = true; };
  }, []);
  const list = shops ?? FALLBACK_SHOPS;
  // 지역 선택 — 해당 지역 샵만 목록·지도에 (정본 shared/shopRegions). 지도는 그 샵들의 중심으로 이동.
  const regionShops = filterShopsByRegion(list, sel);
  const focus = regionFocusOf(sel, list);
  // 선택지(시/도 → 구/군)는 실제 등록된 샵에서 만든다 — 샵 없는 지역은 나오지 않는다.
  const regionTree = buildRegionTree(list);
  useEffect(() => {
    if (regionShops.length > 0 && !regionShops.some((s) => s.id === shopId)) {
      setShopId(regionShops[0].id);
      setReviewOpen(false);
      setReviewFilter(regionShops[0].id);
      setReviewCount(5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, shops]);

  const shopName = (id: string) => list.find((s) => s.id === id)?.name ?? '';
  const shop = list.find((s) => s.id === shopId) ?? list[0];
  const donut = ((parseInt(shop.oripa, 10) / 100) * 125.7).toFixed(1);

  const selectShop = (id: string) => {
    setShopId(id);
    setReviewOpen(false);
    setSubmitted(false);
    setReviewFilter(id);
    setReviewCount(5);
  };

  // 방문 후기 — 필터된 풀을 3바퀴까지 반복(최대 30개), 스크롤로 4개씩 추가 로드.
  const base = reviewFilter === 'all' ? REVIEW_POOL : REVIEW_POOL.filter((r) => r.sid === reviewFilter);
  const total = Math.min(30, base.length * 3);
  const count = Math.min(reviewCount, total);
  const feedItems: ReviewItem[] = [];
  for (let i = 0; i < count; i++) {
    const r = base[i % base.length];
    feedItems.push({ ...r, time: i < base.length ? r.time : `${i - base.length + 6}일 전` });
  }
  const hasMore = count < total;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const ob = new IntersectionObserver(
      (es) => { if (es[0].isIntersecting) setReviewCount((c) => Math.min(30, c + 4)); },
      { rootMargin: '140px' },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasMore, reviewFilter]);

  const filters = [{ id: 'all', label: '전체' }, ...list.map((s) => ({ id: s.id, label: s.name }))];

  const cardSt: CSSProperties = { background: P.cardBg, borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,.05)' };

  const curtained = SHOP_COMING_SOON[country];

  return (
    <div>
      {/* 한국 / 일본 카드샵 탭 + 지역 칩 — '준비중' 커튼 바깥(항상 조작 가능) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 8px', borderBottom: `1px solid ${P.line}` }}>
        {SHOP_COUNTRIES.map((c) => {
          const on = country === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCountry(c.id)}
              style={{
                flex: 'none', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 800, padding: '8px 14px',
                borderRadius: 18, cursor: 'pointer', border: 'none',
                background: on ? P.ink : P.chip, color: on ? P.cardBg : P.ink3,
              }}
            >
              {c.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {country === 'kr' && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="지역 선택"
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
              fontSize: 12.5, fontWeight: 800, padding: '8px 12px', borderRadius: 18, cursor: 'pointer',
              background: P.chip, color: P.ink, border: 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.6" /></svg>
            {regionLabel(sel)}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        )}
      </div>

      {pickerOpen && (
        <RegionPicker
          P={P}
          tree={regionTree}
          sel={sel}
          onPick={(next) => { setSel(next); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {country === 'jp' ? (
        <Curtain P={P} on>
          <div style={{ padding: '46px 20px 60px', textAlign: 'center' }}>
            <div style={{ fontSize: 46 }}>🇯🇵</div>
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 800, color: P.ink }}>일본 카드샵</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: P.ink3, fontWeight: 600, lineHeight: 1.7 }}>
              아키하바라 · 나카노 등 현지 카드샵 정보를<br />모으고 있어요.
            </div>
          </div>
        </Curtain>
      ) : (
      <Curtain P={P} on={curtained}>
      {/* map — 네이버 지도 (키 미설정 시 일러스트 지도 폴백) */}
      <div style={{ padding: '14px 16px 6px' }}>
        <div style={{ position: 'relative', height: 230, borderRadius: 18, overflow: 'hidden', background: '#E8EDE6', boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
          {HAS_NAVER_MAP_KEY ? (
            // 마커는 마운트 시 1회 생성 — 샵 목록 로딩 완료 후에만 지도 마운트.
            shops !== null && <ShopNaverMap pins={regionShops} focus={focus} selId={shopId} onSelect={selectShop} />
          ) : (
            <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 74, height: 13, background: '#fff' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 158, height: 9, background: '#fff', transform: 'rotate(-4deg)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 96, width: 11, background: '#fff', transform: 'rotate(6deg)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 104, width: 9, background: '#fff' }} />
          <div style={{ position: 'absolute', left: 14, top: 16, width: 64, height: 44, borderRadius: 8, background: '#D3DFCE' }} />
          <div style={{ position: 'absolute', right: 20, top: 104, width: 78, height: 40, borderRadius: 8, background: '#C9DBEF' }} />
          <div style={{ position: 'absolute', left: 30, bottom: 18, width: 90, height: 34, borderRadius: 8, background: '#D3DFCE' }} />
          {regionShops.map((s) => {
            const sel = s.id === shopId;
            return (
              <button key={s.id} type="button" onClick={() => selectShop(s.id)} style={{ position: 'absolute', left: s.x, top: s.y, transform: 'translate(-50%,-100%)', cursor: 'pointer', zIndex: sel ? 6 : 5, textAlign: 'center', background: 'none', border: 'none', padding: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: sel ? '#16161a' : '#fff', border: '2px solid #fff', borderRadius: 16, padding: '4px 9px', boxShadow: '0 4px 10px rgba(0,0,0,.22)', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 11 }}>{s.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: sel ? '#fff' : '#16161a' }}>{s.name.split(' ')[0]}</span>
                </span>
                <span style={{ display: 'block', width: 2, height: 7, background: sel ? '#16161a' : '#fff', margin: '0 auto' }} />
              </button>
            );
          })}
          <div style={{ position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 11, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(0,0,0,.14)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16161a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          </div>
            </>
          )}
        </div>
      </div>

      {/* selected shop compact card — 지역에 샵이 없으면 숨김 */}
      <div style={{ padding: '8px 16px 6px', display: regionShops.length === 0 ? 'none' : undefined }}>
        <div style={{ ...cardSt, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <svg width="52" height="52" viewBox="0 0 52 52" style={{ flex: 'none' }}>
              <circle cx="26" cy="26" r="20" fill="none" stroke={P.chip} strokeWidth="7" />
              <circle cx="26" cy="26" r="20" fill="none" stroke={ORANGE} strokeWidth="7" strokeDasharray={`${donut} 125.7`} transform="rotate(-90 26 26)" strokeLinecap="round" />
              <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill={P.ink}>{shop.oripa}</text>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.name}</span>
                {shop.official && officialBadge}
                <span style={{ fontSize: 12, fontWeight: 800, color: P.ink, flex: 'none' }}><span style={{ color: STAR }}>★</span> {shop.rating}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: ORANGE, background: ORANGE_SOFT, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>오리파 {shop.oripa}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: P.ink3, background: P.chip, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>싱글 {shop.single}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: shop.priceColor, background: P.chip, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>시세 {shop.priceLv}</span>
              </div>
              <div style={{ fontSize: 11, color: P.ink3, fontWeight: 600, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.addr} · 후기 {shop.reviews}</div>
            </div>
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <button type="button" onClick={() => { setReviewOpen((v) => !v); setSubmitted(false); }} style={{ display: 'flex', alignItems: 'center', gap: 4, background: P.ink, borderRadius: 10, padding: '8px 11px', cursor: 'pointer', border: 'none' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: P.cardBg, whiteSpace: 'nowrap' }}>후기</span>
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href="https://tmap.life" target="_blank" rel="noreferrer" title="티맵 길안내" style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(150deg,#7d3ff0,#4a12c4)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 2px 5px rgba(90,30,200,.3)' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>T</span>
                </a>
                <a href={`https://map.naver.com/p/search/${encodeURIComponent(shop.name)}`} target="_blank" rel="noreferrer" title="네이버지도" style={{ width: 28, height: 28, borderRadius: 8, background: '#03C75A', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 2px 5px rgba(3,199,90,.3)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 2C7.6 2 4 5.5 4 9.9c0 5.4 7 11.5 7.7 12.1a.5.5 0 0 0 .6 0C13 21.4 20 15.3 20 9.9 20 5.5 16.4 2 12 2Z" fill="#fff" /><circle cx="12" cy="10" r="3" fill="#03C75A" /></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* review form (toggle) */}
      {reviewOpen && (
        <div style={{ padding: '6px 16px' }}>
          <div style={{ background: P.cardBg, borderRadius: 18, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,.05)', border: '1.5px solid #FFE0C2' }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: P.ink }}>{shop.name} 후기 남기기</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setMyStars(n)} style={{ fontSize: 26, color: n <= myStars ? STAR : '#E5E5EA', cursor: 'pointer', background: 'none', border: 'none', padding: 0, lineHeight: 1 }}>★</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {REVIEW_TAGS.map((label) => {
                const on = !!myTags[label];
                return (
                  <button key={label} type="button" onClick={() => setMyTags((t) => ({ ...t, [label]: !t[label] }))} style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 16, cursor: 'pointer', background: on ? ORANGE_SOFT : P.cardBg, color: on ? ORANGE : P.ink3, border: `1.5px solid ${on ? ORANGE : '#E5E5EA'}` }}>{label}</button>
                );
              })}
            </div>
            <textarea placeholder="오리파 구성, 가격, 응대 등 경험을 알려주세요" rows={2} style={{ marginTop: 12, width: '100%', background: P.pageBg, border: 'none', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: P.ink, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
            <button type="button" onClick={() => { if (myStars) setSubmitted(true); }} style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: submitted ? '#2BB673' : ORANGE, borderRadius: 12, padding: 12, cursor: 'pointer', border: 'none' }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{submitted ? '후기 등록 완료!' : '후기 등록'}</span>
            </button>
          </div>
        </div>
      )}

      {/* shop list */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 10px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>{regionLabel(sel)} 카드샵 <span style={{ color: P.ink3 }}>{regionShops.length}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: P.ink }}>
          평점순 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </div>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ ...cardSt, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.04)' }}>
          {regionShops.length === 0 && (
            <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 13, color: P.ink3, fontWeight: 600, lineHeight: 1.6 }}>
              {regionLabel(sel)} 지역에 등록된 카드샵이 아직 없어요.<br />어드민 › 카드샵 관리에서 추가하면 바로 표시돼요.
            </div>
          )}
          {regionShops.map((s, i) => {
            const sel = s.id === shopId;
            return (
              <button key={s.id} type="button" onClick={() => selectShop(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', width: '100%', borderTop: i === 0 ? 'none' : `1px solid ${P.line}`, cursor: 'pointer', background: sel ? '#FFF9F4' : P.cardBg, border: 'none', borderBottom: 'none', textAlign: 'left' }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: s.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flex: 'none' }}>{s.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>{s.name}</span>
                    {s.official && officialBadge}
                    <span style={{ fontSize: 11, fontWeight: 700, color: P.ink3 }}>{s.dist}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: P.ink }}><span style={{ color: STAR }}>★</span> {s.rating}</span>
                    <span style={{ fontSize: 11.5, color: P.ink3, fontWeight: 600 }}>후기 {s.reviews}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ORANGE, background: ORANGE_SOFT, padding: '2px 7px', borderRadius: 6 }}>오리파 {s.oripa}</span>
                  </span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.chev} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="m9 6 6 6-6 6" /></svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* visit review feed */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 8px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>방문 후기</div>
        <div style={{ fontSize: 12, color: P.ink3, fontWeight: 600 }}>{reviewFilter === 'all' ? `전체 ${total}개` : `${shopName(reviewFilter)} ${total}개`}</div>
      </div>
      <div className="cv-hrow" style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '0 16px 12px' }}>
        {filters.map((f) => {
          const on = reviewFilter === f.id;
          return (
            <button key={f.id} type="button" onClick={() => { setReviewFilter(f.id); setReviewCount(5); }} style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 16, cursor: 'pointer', background: on ? P.ink : P.cardBg, color: on ? P.cardBg : P.ink3, border: 'none' }}>{f.label}</button>
          );
        })}
      </div>
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ ...cardSt, boxShadow: '0 2px 10px rgba(0,0,0,.04)' }}>
          {feedItems.map((rv, i) => (
            <div key={`${rv.sid}-${rv.name}-${i}`} style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: rv.avGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>{rv.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: P.ink }}>{rv.name}</span>
                    <span style={{ fontSize: 11, color: P.ink3, fontWeight: 500 }}>{rv.time}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: ORANGE, fontWeight: 700, marginTop: 1 }}>{shopName(rv.sid)}</div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: P.ink, flex: 'none' }}><span style={{ color: STAR }}>★</span> {rv.rating}</span>
              </div>
              <div style={{ fontSize: 13, color: P.ink2, lineHeight: 1.55, marginTop: 9 }}>{rv.text}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 9 }}>
                {rv.tags.map((tg) => (
                  <span key={tg} style={{ fontSize: 10.5, fontWeight: 700, color: P.ink3, background: P.chip, padding: '3px 8px', borderRadius: 6 }}>{tg}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {hasMore && (
          <div ref={sentinelRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '16px 0 4px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D2D2D8' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C2C2C8' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B0B0B6' }} />
            <span style={{ fontSize: 11.5, color: P.ink3, fontWeight: 600, marginLeft: 4 }}>스크롤하면 더 불러와요</span>
          </div>
        )}
      </div>
      </Curtain>
      )}
    </div>
  );
}

/**
 * '준비중' 커튼 — 실제 화면을 딤 처리해 뒤에 두고 앞에 안내를 덮는다.
 * on=false 면 아무것도 하지 않고 children 만 그대로 낸다(오픈 시 코드 변경 없음).
 * 정본 플래그: shared/shopRegions.ts SHOP_COMING_SOON.
 */
function Curtain({ P, on, children }: { P: ShopPalette; on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{ opacity: 0.32, filter: 'grayscale(0.35)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-start', paddingTop: 90, gap: 8,
          background: 'linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.62) 22%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: P.ink, color: P.cardBg, borderRadius: 999, padding: '10px 20px', fontSize: 15, fontWeight: 900, boxShadow: '0 6px 18px rgba(0,0,0,.22)' }}>
          <span aria-hidden>🛠️</span>
          {SHOP_COMING_SOON_TEXT}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink2, textAlign: 'center', textShadow: '0 1px 3px rgba(255,255,255,.9)' }}>
          {SHOP_COMING_SOON_SUB}
        </div>
      </div>
    </div>
  );
}

/** 지역 선택 시트 — 시/도 목록 → 그 안의 구/군. 선택지는 등록된 샵에서 생성된다. */
function RegionPicker({
  P, tree, sel, onPick, onClose,
}: {
  P: ShopPalette;
  tree: ReturnType<typeof buildRegionTree>;
  sel: RegionSelection;
  onPick: (next: RegionSelection) => void;
  onClose: () => void;
}) {
  const [sido, setSido] = useState<string | null>(sel.sido ?? tree[0]?.name ?? null);
  const node = tree.find((t) => t.name === sido) ?? null;

  return (
    <div
      role="dialog"
      aria-label="지역 선택"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxHeight: '72vh', background: P.cardBg, borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px 12px', borderBottom: `1px solid ${P.line}` }}>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: P.ink }}>지역 선택</span>
          <button type="button" onClick={() => onPick(ALL_REGIONS)} style={{ fontSize: 12.5, fontWeight: 800, color: P.ink3, background: P.chip, border: 'none', borderRadius: 14, padding: '6px 12px', cursor: 'pointer' }}>
            내 주변
          </button>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ fontSize: 20, lineHeight: 1, color: P.ink3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        {tree.length === 0 ? (
          <div style={{ padding: '34px 20px', textAlign: 'center', fontSize: 13, color: P.ink3, fontWeight: 600, lineHeight: 1.7 }}>
            등록된 카드샵이 아직 없어요.<br />어드민 › 카드샵 관리에서 추가하면 지역이 생겨요.
          </div>
        ) : (
          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            {/* 좌: 시/도 */}
            <div style={{ width: 108, flex: 'none', overflowY: 'auto', background: P.pageBg, borderRight: `1px solid ${P.line}` }}>
              {tree.map((t) => {
                const on = t.name === sido;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSido(t.name)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '13px 14px', cursor: 'pointer', border: 'none',
                      background: on ? P.cardBg : 'transparent', color: on ? P.ink : P.ink3, fontSize: 13.5, fontWeight: on ? 800 : 600,
                    }}
                  >
                    {t.name} <span style={{ color: P.ink3, fontWeight: 600 }}>{t.count}</span>
                  </button>
                );
              })}
            </div>
            {/* 우: 구/군 */}
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              <button
                type="button"
                onClick={() => sido && onPick({ sido, gu: null })}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '13px 16px', cursor: 'pointer', border: 'none', background: 'none', color: P.ink, fontSize: 13.5, fontWeight: 800, borderBottom: `1px solid ${P.line}` }}
              >
                {sido} 전체 <span style={{ color: P.ink3, fontWeight: 600 }}>{node?.count ?? 0}</span>
              </button>
              {(node?.gus ?? []).map((g) => {
                const on = sel.sido === sido && sel.gu === g.name;
                return (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => sido && onPick({ sido, gu: g.name })}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '13px 16px', cursor: 'pointer', border: 'none',
                      background: on ? P.chip : 'none', color: P.ink, fontSize: 13.5, fontWeight: on ? 800 : 600, borderBottom: `1px solid ${P.line}`,
                    }}
                  >
                    {g.name} <span style={{ color: P.ink3, fontWeight: 600 }}>{g.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
