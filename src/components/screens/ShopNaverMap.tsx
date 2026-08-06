'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Shop 지도 — 네이버 지도(NCP Web Dynamic Map v3) 위 카드샵 칩 핀.
 * Client ID(NEXT_PUBLIC_NCP_MAP_CLIENT_ID) 미설정이면 HAS_NAVER_MAP_KEY=false —
 * 부모(CommunityShop)가 일러스트 지도로 폴백한다. 모바일 ShopNaverMap(WebView) 과 페어.
 */

export interface ShopMapPin {
  id: string;
  name: string;
  emoji: string;
  addr: string;
  lat: number;
  lng: number;
}

// NCP SDK 는 타입 패키지가 없어 any 로 다룬다.
type NMaps = any;
declare global {
  interface Window {
    naver?: { maps: NMaps };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID ?? '';
export const HAS_NAVER_MAP_KEY = CLIENT_ID.length > 0;
const SDK_BASE = 'https://oapi.map.naver.com/openapi/v3/maps.js';
const SDK_SRC = `${SDK_BASE}?ncpKeyId=${CLIENT_ID}&submodules=geocoder`;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (window.naver?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SDK_BASE}"]`);
    if (existing) {
      if (window.naver?.maps) { resolve(); return; }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('sdk load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => {
      if (window.naver?.maps) resolve();
      else reject(new Error('SDK loaded but naver.maps undefined — NCP 인증/도메인 확인'));
    };
    s.onerror = () => reject(new Error('script 401/403 or network error'));
    document.head.appendChild(s);
  });
}

/** 기존 일러스트 지도의 칩 핀과 동일한 룩 (이모지 + 이름 첫 단어) */
function pinHtml(pin: ShopMapPin, selected: boolean): string {
  const label = pin.name.split(' ')[0];
  return `
    <div style="position:relative;width:0;height:0;">
      <div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <span style="display:inline-flex;align-items:center;gap:4px;background:${selected ? '#16161a' : '#fff'};border:2px solid #fff;border-radius:16px;padding:4px 9px;box-shadow:0 4px 10px rgba(0,0,0,.22);white-space:nowrap;">
          <span style="font-size:11px;line-height:1;">${pin.emoji}</span>
          <span style="font-size:11px;font-weight:800;color:${selected ? '#fff' : '#16161a'};">${label}</span>
        </span>
        <span style="display:block;width:2px;height:7px;background:${selected ? '#16161a' : '#fff'};"></span>
      </div>
    </div>
  `;
}

interface Props {
  pins: ShopMapPin[];
  selId: string;
  onSelect: (id: string) => void;
}

export function ShopNaverMap({ pins, selId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NMaps | null>(null);
  const markersRef = useRef<Map<string, NMaps>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const selIdRef = useRef(selId);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errDetail, setErrDetail] = useState('');

  const fitAll = () => {
    if (!mapRef.current || !window.naver?.maps) return;
    const naver = window.naver.maps;
    const b = new naver.LatLngBounds();
    markersRef.current.forEach((m) => b.extend(m.getPosition()));
    mapRef.current.fitBounds(b, { top: 46, right: 50, bottom: 30, left: 50 });
  };

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    const markers = markersRef.current;

    loadSdk()
      .then(() => {
        if (cancelled || !containerRef.current || !window.naver?.maps) return;
        const naver = window.naver.maps;
        const list = pinsRef.current;

        const bounds = new naver.LatLngBounds();
        list.forEach((p) => bounds.extend(new naver.LatLng(p.lat, p.lng)));

        const map = new naver.Map(containerRef.current, {
          bounds,
          minZoom: 9,
          maxZoom: 19,
          mapTypeControl: false,
          logoControl: false,
          mapDataControl: false,
          scaleControl: false,
          zoomControl: false,
        });
        mapRef.current = map;

        list.forEach((pin) => {
          const marker = new naver.Marker({
            position: new naver.LatLng(pin.lat, pin.lng),
            map,
            icon: { content: pinHtml(pin, pin.id === selIdRef.current), size: new naver.Size(0, 0), anchor: new naver.Point(0, 0) },
            zIndex: pin.id === selIdRef.current ? 6 : 5,
          });
          naver.Event.addListener(marker, 'click', () => onSelectRef.current(pin.id));
          markers.set(pin.id, marker);
        });

        // Geocoder 로 주소 기준 좌표 보정 후 재프레이밍
        const refineAll = async () => {
          if (!naver.Service?.geocode) return;
          await Promise.all(
            list.map(
              (pin) =>
                new Promise<void>((resolve) => {
                  naver.Service.geocode(
                    { query: pin.addr },
                    (s: number, res: { v2?: { addresses?: Array<{ x: string; y: string }> } }) => {
                      if (s === naver.Service.Status.OK) {
                        const a = res?.v2?.addresses?.[0];
                        const lat = a ? Number(a.y) : NaN;
                        const lng = a ? Number(a.x) : NaN;
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                          markers.get(pin.id)?.setPosition(new naver.LatLng(lat, lng));
                        }
                      }
                      resolve();
                    },
                  );
                }),
            ),
          );
          if (!cancelled) fitAll();
        };
        refineAll().catch(() => {});

        setStatus('ready');
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setErrDetail(e.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      markers.forEach((m) => m.setMap(null));
      markers.clear();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택 변경 → 핀 아이콘만 갱신 (지도 재생성 없음)
  useEffect(() => {
    selIdRef.current = selId;
    if (status !== 'ready' || !window.naver?.maps) return;
    const naver = window.naver.maps;
    markersRef.current.forEach((marker, id) => {
      const pin = pinsRef.current.find((p) => p.id === id);
      if (!pin) return;
      marker.setIcon({ content: pinHtml(pin, id === selId), size: new naver.Size(0, 0), anchor: new naver.Point(0, 0) });
      marker.setZIndex(id === selId ? 6 : 5);
    });
  }, [selId, status]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#E8EDE6' }} />
      {status !== 'ready' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20, background: '#E8EDE6', fontSize: 12, fontWeight: 700, color: '#5a6a58', textAlign: 'center', lineHeight: 1.7 }}>
          {status === 'loading' ? '🗺 네이버 지도 불러오는 중...' : (
            <div>
              지도 로드 실패
              <br />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{errDetail}</span>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={fitAll}
        title="전체 매장 보기"
        style={{ position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 11, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(0,0,0,.14)', border: 'none', cursor: 'pointer' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16161a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
      </button>
    </div>
  );
}
