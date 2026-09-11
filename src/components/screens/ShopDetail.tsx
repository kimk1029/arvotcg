'use client';

import { useToast } from '@/components/ToastProvider';
import { SHOP_OPEN_LABEL, shopOpenState } from '@/lib/shopHours';
import { TMAP_WEB_URL, instagramEmbedUrl, instagramHandle, instagramUrl, naverMapRouteUrl, naverMapWebUrl, tmapRouteUrl } from '@/lib/shopLinks';

/**
 * 카드샵 상세 페이지 — Claude Design 'POKE30 커뮤니티' 프로토타입의 shop detail page
 * (리스트 항목 클릭 → 전체 화면 오버레이, 뒤로가기로 닫힘). 앱 ShopDetail 과 페어.
 * 사진·진행 중 오리파는 데이터가 없어 히어로 타일 1장 + 정보 박스로 대신한다.
 * 인스타그램이 있으면 맨 아래 '최근 소식' 에 프로필 임베드(최근 게시물, 공개 계정만).
 */

export interface ShopDetailData {
  name: string;
  official?: boolean;
  addr: string;
  lat: number;
  lng: number;
  dist: string;
  rating: string;
  reviews: number;
  oripa: string;
  single: string;
  priceLv: string;
  grad: string;
  emoji: string;
  phone?: string;
  instagram?: string;
  hours?: string;
  closedDays?: string;
  intro?: string;
  tags?: string[];
}

interface Props {
  shop: ShopDetailData;
  onClose: () => void;
}

const INK = '#16161a';
const MUTED = '#9A9AA0';

/** 앱 스킴을 먼저 열고, 앱이 없어 화면이 그대로면 웹 폴백으로 (모바일 브라우저). 데스크톱은 바로 웹. */
function openWithFallback(scheme: string, web: string) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile) { window.open(web, '_blank', 'noopener'); return; }
  const t = window.setTimeout(() => { if (!document.hidden) window.location.href = web; }, 1500);
  const clear = () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', clear); };
  document.addEventListener('visibilitychange', clear);
  window.location.href = scheme;
}

export function ShopDetail({ shop, onClose }: Props) {
  const toast = useToast();
  const open = shopOpenState(shop.hours, shop.closedDays);
  const openLabel = open ? SHOP_OPEN_LABEL[open] : null;
  const ig = instagramHandle(shop.instagram);
  const route = { lat: shop.lat, lng: shop.lng, name: shop.name };

  const copyAddr = () => {
    navigator.clipboard?.writeText(shop.addr)
      .then(() => toast.success('주소가 복사되었습니다'))
      .catch(() => toast.error('복사에 실패했어요'));
  };
  const share = () => {
    const url = window.location.href;
    const text = `${shop.name} · ${shop.addr}`;
    if (navigator.share) navigator.share({ title: shop.name, text, url }).catch(() => {});
    else navigator.clipboard?.writeText(`${text}\n${url}`).then(() => toast.success('링크가 복사되었습니다')).catch(() => {});
  };
  const actionBtn = (bg: string, fg: string, label: string, icon: React.ReactNode, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ flex: 1, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', border: 'none', fontSize: 13, fontWeight: 800, color: fg }}>{icon}{label}</button>
  );
  const infoRows: [string, React.ReactNode][] = [
    ['영업시간', shop.hours || '-'],
    ['휴무', shop.closedDays || '-'],
    ['전화', shop.phone ? <a href={`tel:${shop.phone.replace(/[^\d+]/g, '')}`} style={{ color: INK, textDecoration: 'none' }}>{shop.phone}</a> : '-'],
    ['인스타그램', ig ? <a href={instagramUrl(ig)} target="_blank" rel="noreferrer" style={{ color: '#5a3ad6', textDecoration: 'none' }}>@{ig}</a> : '-'],
    ['싱글 카드', shop.single],
    ['오리파 비중', shop.oripa],
    ['가격대', shop.priceLv],
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 'none', height: 50, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #F0F0F2' }}>
        <button type="button" onClick={onClose} aria-label="뒤로" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: -8, padding: 8, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
        </button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: INK, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.name}</div>
        <button type="button" onClick={share} aria-label="공유" style={{ display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
        </button>
      </div>
      <div className="cv-hrow" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {/* hero (사진 데이터 없음 — 타일 색·이모지) */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ height: 150, borderRadius: 14, background: shop.grad, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%,rgba(255,255,255,.35),transparent 65%)' }} />
            <span style={{ position: 'relative' }}>{shop.emoji}</span>
            <div style={{ position: 'absolute', left: 10, bottom: 9, fontSize: 10.5, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.45)', padding: '3px 8px', borderRadius: 7, whiteSpace: 'nowrap' }}>매장</div>
          </div>
        </div>
        {/* header */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: -0.4 }}>{shop.name}</span>
            {shop.official && (
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ flex: 'none' }}><path d="M12 1.5 14.8 4l3.7-.4 1 3.6 3.2 1.9-1.6 3.4 1.6 3.4-3.2 1.9-1 3.6-3.7-.4L12 22.5 9.2 20l-3.7.4-1-3.6-3.2-1.9 1.6-3.4L1.3 8.1l3.2-1.9 1-3.6 3.7.4z" fill="#2C8FFF" /><path d="m9 12 2 2 4-4.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}><span style={{ color: '#FFC53D' }}>★</span> {shop.rating}</span>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, whiteSpace: 'nowrap' }}>후기 {shop.reviews}</span>
            {shop.dist && <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, whiteSpace: 'nowrap' }}>· {shop.dist}</span>}
            {openLabel && <span style={{ fontSize: 11.5, fontWeight: 800, color: openLabel.color, whiteSpace: 'nowrap' }}>{openLabel.label}</span>}
          </div>
          {/* 주소 + 복사 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
            <span style={{ fontSize: 12.5, color: '#8E8E93', fontWeight: 500 }}>{shop.addr}</span>
            <button type="button" onClick={copyAddr} aria-label="주소 복사" title="주소 복사" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
          {/* actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {shop.phone && actionBtn(INK, '#fff', '전화', <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>, () => { window.location.href = `tel:${shop.phone!.replace(/[^\d+]/g, '')}`; })}
            {actionBtn('#F2F2F4', INK, '네이버지도', <span style={{ width: 18, height: 18, borderRadius: 5, background: '#03C75A', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>N</span>, () => openWithFallback(naverMapRouteUrl(route), naverMapWebUrl(shop.addr)))}
            {actionBtn('#F2F2F4', INK, '티맵', <span style={{ width: 18, height: 18, borderRadius: 5, background: '#E8412C', color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>T</span>, () => openWithFallback(tmapRouteUrl(route), TMAP_WEB_URL))}
            {ig && actionBtn('#F2F2F4', INK, '인스타', <span style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>◎</span>, () => window.open(instagramUrl(ig), '_blank', 'noopener'))}
          </div>
        </div>
        {/* intro */}
        <div style={{ padding: '22px 20px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 10 }}>매장 소개</div>
          <div style={{ fontSize: 13.5, color: shop.intro ? '#4A4A50' : MUTED, lineHeight: 1.7, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{shop.intro || '소개가 아직 등록되지 않았어요.'}</div>
          {!!shop.tags?.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {shop.tags.map((t) => <span key={t} style={{ fontSize: 11.5, fontWeight: 700, color: '#5a3ad6', background: '#F4F1FF', padding: '5px 10px', borderRadius: 14, whiteSpace: 'nowrap' }}>{t}</span>)}
            </div>
          )}
        </div>
        {/* info */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ background: '#F7F7F9', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {infoRows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, gap: 12 }}>
                <span style={{ color: MUTED, fontWeight: 600, flex: 'none' }}>{k}</span>
                <span style={{ color: INK, fontWeight: 700, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* 최근 소식 — 인스타그램 프로필 임베드 (공개 계정만 표시됨) */}
        {ig && (
          <div style={{ padding: '22px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: INK }}>최근 소식</div>
              <a href={instagramUrl(ig)} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#5a3ad6', textDecoration: 'none' }}>@{ig} 인스타그램 →</a>
            </div>
            <iframe
              title={`@${ig} 인스타그램`}
              src={instagramEmbedUrl(ig)}
              loading="lazy"
              style={{ width: '100%', height: 540, border: 'none', borderRadius: 14, background: '#F7F7F9' }}
              allowTransparency
            />
          </div>
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
