'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { ComposedAvatar } from '@/components/ComposedAvatar';
import { GRADE_LOGOS } from '@/components/cards/GradeMark';
import { useCurrency } from '@/components/CurrencyProvider';
import { KAKAO_JS_KEY, KAKAO_JS_SDK_URL, flexShareUrl } from '../../shared/kakao';

export interface FlexData {
  name: string;
  nameJa: string | null;
  imageUrl: string | null;
  setCode: string | null;
  cardNumber: string | null;
  rarity: string | null;
  series: string | null;
  region: string;
  graded: boolean;
  gradeCompany: string | null;
  gradeValue: string | null;
  qty: number;
  registerPriceJpy: number | null;
  currentPriceJpy: number;
  minPriceJpy: number;
  createdAt: string;
  owner: { name: string; avatarId: string; backgroundId: string; frameId: string };
}

const REGION_LABEL: Record<string, string> = { jp: '일본판', kr: '한국판', en: '영문판' };
const REGION_FLAG: Record<string, string> = { jp: '🇯🇵', kr: '🇰🇷', en: '🇺🇸' };
// 홈 화면 로고와 같은 색 — ARVO 잉크 + TCG 브랜드 오렌지.
const INK = '#16161a';
const ACCENT = '#FF7A00';
const STAMP = '#E5484D';

function ymd(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${p(d.getMonth() + 1)}. ${p(d.getDate())}`;
}

/** 카카오 JS SDK(v2) 중 쓰는 부분만 — 전역 window.Kakao. */
interface KakaoSdk {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    uploadImage(o: { file: File[] }): Promise<{ infos: { original: { url: string; width?: number; height?: number } } }>;
    sendDefault(o: Record<string, unknown>): void;
  };
}

/** 카카오 SDK 를 이 페이지에서만 지연 로드하고 init. 실패하면 throw. */
async function loadKakao(): Promise<KakaoSdk> {
  const w = window as unknown as { Kakao?: KakaoSdk };
  if (!w.Kakao) {
    await new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = KAKAO_JS_SDK_URL;
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('kakao sdk load failed'));
      document.head.appendChild(el);
    });
  }
  if (!w.Kakao) throw new Error('kakao sdk missing');
  if (!w.Kakao.isInitialized()) w.Kakao.init(KAKAO_JS_KEY);
  return w.Kakao;
}

/** 앱 WebView 안이면 RN 쪽 브리지가 있다(react-native-webview 가 주입). */
function rnBridge(): { postMessage: (s: string) => void } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } };
  return w.ReactNativeWebView ?? null;
}

/**
 * 수익 인증 포스터 — 내 카드 한 장의 등록가 대비 현재 시세를 세로 카드로 보여준다.
 * 링크(/flex/:token)만 있으면 누구나 볼 수 있고, '이미지로 공유' 는 포스터 영역을
 * PNG 로 찍어 공유 시트(카카오톡 등)로 넘긴다. 앱은 이 페이지를 WebView 로 열고
 * PNG 를 postMessage 로 받아 네이티브 공유 시트를 띄운다(mobile/app/web.tsx).
 */
export function FlexPoster({ data: d }: { data: FlexData }) {
  const { format } = useCurrency();
  const posterRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const basis = d.registerPriceJpy ?? 0;
  const cur = d.currentPriceJpy;
  const profit = basis > 0 && cur > 0 ? (cur - basis) * d.qty : null;
  const pct = basis > 0 && cur > 0 ? ((cur - basis) / basis) * 100 : null;
  const up = (profit ?? 0) >= 0;
  const gradeLogo = d.graded ? GRADE_LOGOS[(d.gradeCompany ?? 'PSA').toUpperCase()] : null;
  const fileName = `arvotcg-flex-${(d.setCode ?? 'card').toLowerCase()}${d.cardNumber ? `-${d.cardNumber}` : ''}.png`;

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 1800);
  };

  /** 포스터 영역을 PNG(2x)로. 카드 이미지는 자체 CDN 상대경로라 같은 출처로 그려진다. */
  const capture = async (): Promise<string> => {
    if (!posterRef.current) throw new Error('no poster');
    return toPng(posterRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#E6EEFF' });
  };

  const shareImage = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const dataUrl = await capture();
      // 1) 앱 WebView — RN 이 파일로 저장해 네이티브 공유 시트(카카오톡·인스타 등)를 띄운다.
      const bridge = rnBridge();
      if (bridge) {
        bridge.postMessage(JSON.stringify({ type: 'flex-share-image', dataUrl, fileName, title: `${d.name} 수익 인증` }));
        return;
      }
      // 2) 모바일 브라우저 — 파일 공유(Web Share). 공유 시트에서 카카오톡을 고르면 사진으로 전송된다.
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${d.name} 수익 인증 · ARVOTCG` });
        return;
      }
      // 3) 데스크톱 등 — 이미지 저장.
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      a.click();
      flash('이미지를 저장했어요');
    } catch {
      flash('이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  };

  /**
   * 카카오톡 공유 — 포스터 PNG 를 카카오 이미지 서버에 올리고(uploadImage) 피드 메시지로 보낸다.
   * 링크는 WebView 가 붙인 token/embed 쿼리를 뺀 공개 URL. 앱 WebView 에선 SDK 가 여는
   * kakaolink:// / intent:// 를 mobile/app/web.tsx 가 가로채 카카오톡 앱으로 넘긴다.
   */
  const shareKakao = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [kakao, dataUrl] = await Promise.all([loadKakao(), capture()]);
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const uploaded = (await kakao.Share.uploadImage({ file: [file] })).infos.original;
      const url = flexShareUrl(window.location.pathname, window.location.origin);
      const headline = pct != null ? `${d.name} · ${up ? '+' : ''}${pct.toFixed(1)}%` : d.name;
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${headline} 수익 인증`,
          description: `${d.owner.name} 님의 카드 · 등록가 ${basis > 0 ? format(basis) : '—'} → 현재 ${cur > 0 ? format(cur) : '—'}`,
          imageUrl: uploaded.url,
          imageWidth: uploaded.width,
          imageHeight: uploaded.height,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: '내 카드 시세 보기', link: { mobileWebUrl: url, webUrl: url } }],
      });
    } catch {
      flash('카카오톡 공유에 실패했어요. 잠시 후 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      flash('링크를 복사했어요');
    } catch {
      flash('링크 복사에 실패했어요');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#DCE7FB', padding: '0 0 34px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* ── 캡처 영역(포스터) — 화면 폭에 꽉 차게(좌우 패딩 없음), 버튼은 이 영역 밖 ── */}
        <div
          ref={posterRef}
          style={{
            position: 'relative', overflow: 'hidden', padding: '16px 0 14px',
            background: 'linear-gradient(180deg,#EEF4FF 0%,#DCE9FF 45%,#EAF2FF 100%)',
          }}
        >
          {/* 배경 워터마크 — 크게 흐린 브랜드 글자 */}
          <div aria-hidden style={{ position: 'absolute', left: -10, top: 150, fontSize: 118, fontWeight: 900, letterSpacing: -4, color: 'rgba(29,91,255,.06)', lineHeight: 1, transform: 'rotate(-90deg)', transformOrigin: 'left top', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            ARVOTCG
          </div>

          {/* 헤더 — 홈과 같은 ARVO·TCG 워드마크 / 날짜 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, position: 'relative', padding: '0 12px' }}>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>
                <span style={{ color: INK }}>ARVO</span><span style={{ color: ACCENT }}>TCG</span>
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2.4, color: '#5B7BC4', marginTop: 5 }}>TCG, MORE VALUE</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#3C5A9A' }}>{ymd(d.createdAt)}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: '#89A3D6', marginTop: 2 }}>MY COLLECTION</div>
            </div>
          </div>

          {/* 3열 — 왼쪽: 로고·워드마크 세로 / 가운데: 카드 이미지(정중앙) / 오른쪽: 카드 기본정보 배지 세로.
              양옆 열을 같은 flex 로 두어 이미지가 포스터 정중앙에 온다. */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 14px', padding: '0 8px' }}>
            {/* 왼쪽 — 앱 로고 + ARVO/TCG + 슬로건 (세로) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {/* 현재 앱 아이콘(mobile/assets/icon.png 과 동일본) — 캡처를 위해 같은 출처(/app-icon.png) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/app-icon-v2.png" alt="ARVOTCG" width={44} height={44} style={{ borderRadius: 11, display: 'block', boxShadow: '0 6px 14px rgba(20,30,60,.25)' }} />
              <div style={{ textAlign: 'center', lineHeight: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: INK, letterSpacing: -0.3 }}>ARVO</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: ACCENT, letterSpacing: -0.3, marginTop: 2 }}>TCG</div>
              </div>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.4, color: '#8FA3C8', textAlign: 'center', lineHeight: 1.7 }}>
                COLLECT<br />TRACK<br />GROW
              </div>
            </div>

            {/* 가운데 — 카드 이미지. 배경 제거본의 둘레 여백은 투명 상자 + 1.12 확대로 잘라낸다. 우하단 인증 도장. */}
            <div style={{ position: 'relative', width: '56%', maxWidth: 270, flex: 'none' }}>
              <div
                style={{
                  width: '100%', aspectRatio: '63 / 88', borderRadius: 16, overflow: 'hidden',
                  background: 'transparent', boxShadow: '0 18px 40px rgba(40,80,170,.3)', display: 'grid', placeItems: 'center',
                }}
              >
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt={d.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.12)', display: 'block' }} />
                ) : (
                  <span style={{ fontSize: 54 }}>🃏</span>
                )}
              </div>
              <div style={{ position: 'absolute', right: -16, bottom: -14, transform: 'rotate(-14deg)', opacity: 0.9, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
                <Stamp date={ymd(d.createdAt)} up={up} pct={pct} />
              </div>
            </div>

            {/* 오른쪽 — 카드 기본정보 배지 세로 나열 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {d.graded ? (
                <Badge small>
                  {gradeLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gradeLogo} alt={d.gradeCompany ?? 'PSA'} style={{ height: 11, width: 'auto' }} />
                  ) : (
                    <b style={{ color: '#1D5BFF' }}>{d.gradeCompany ?? 'PSA'}</b>
                  )}
                  <b>{d.gradeValue ?? ''}</b>
                </Badge>
              ) : (
                <Badge small muted>RAW</Badge>
              )}
              <Badge small>{REGION_FLAG[d.region] ?? '🇯🇵'} {REGION_LABEL[d.region] ?? '일본판'}</Badge>
              {(d.setCode || d.cardNumber) && (
                <Badge small>{[d.setCode?.toUpperCase(), d.cardNumber].filter(Boolean).join(' ')}</Badge>
              )}
              {d.rarity && <Badge small>{d.rarity}</Badge>}
              {d.series && <Badge small>{d.series}</Badge>}
            </div>
          </div>

          {/* 본문 패널 */}
          <div style={{ background: 'rgba(255,255,255,.94)', borderRadius: 20, padding: 16, margin: '0 10px', boxShadow: '0 10px 30px rgba(40,80,170,.12)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <ComposedAvatar avatar={d.owner.avatarId} bg={d.owner.backgroundId} frame={d.owner.frameId} size={38} />
                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#1B2A47', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.owner.name} <span style={{ fontSize: 13 }}>👑</span>
                </span>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8FA3C8' }}>최초 등록일</div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#3C5A9A', marginTop: 2 }}>{ymd(d.createdAt)}</div>
              </div>
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginTop: 14, lineHeight: 1.3 }}>{d.name}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8FA3C8', marginTop: 4 }}>
              {[[d.setCode?.toUpperCase(), d.cardNumber].filter(Boolean).join(' '), d.series].filter(Boolean).join(' | ')}
            </div>

            {/* 등록가 · 현재 시세 · 수익 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, background: '#F7FAFF', borderRadius: 14, padding: '14px 8px', marginTop: 14 }}>
              <Cell label="최초 등록 금액" value={basis > 0 ? format(basis) : '—'} />
              <Cell label="현재 시세" value={cur > 0 ? format(cur) : '—'} divider />
              <Cell
                label="수익 금액"
                value={profit != null ? `${up ? '+' : '-'}${format(Math.abs(profit))}` : '—'}
                color={profit == null ? undefined : up ? '#F5333F' : '#2F6BFF'}
                divider
                chip={pct != null ? `${up ? '+' : ''}${pct.toFixed(2)}%` : undefined}
                chipColor={up ? '#F5333F' : '#2F6BFF'}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F7FAFF', borderRadius: 14, padding: '14px 8px', marginTop: 10 }}>
              <Cell label="보유 수량" value={`${d.qty}개`} />
              <Cell label="최저 매물가" value={d.minPriceJpy > 0 ? format(d.minPriceJpy) : '—'} divider />
            </div>
          </div>

        </div>

        {/* ── 공유 버튼 — 캡처 영역(posterRef) 밖이라 공유 이미지에 찍히지 않는다 ── */}
        <div style={{ padding: '0 14px' }}>
        <button
          type="button"
          onClick={shareKakao}
          disabled={busy}
          style={{
            width: '100%', marginTop: 14, height: 50, borderRadius: 14, border: 'none', cursor: busy ? 'default' : 'pointer',
            background: '#FEE500', color: '#191919', fontSize: 15, fontWeight: 800, opacity: busy ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <KakaoIcon />
          {busy ? '준비 중…' : '카카오톡으로 공유'}
        </button>
        <button
          type="button"
          onClick={shareImage}
          disabled={busy}
          style={{
            width: '100%', marginTop: 8, height: 46, borderRadius: 14, border: 'none', cursor: busy ? 'default' : 'pointer',
            background: busy ? '#7DA0F5' : '#1D5BFF', color: '#fff', fontSize: 14, fontWeight: 800,
          }}
        >
          📸 이미지로 공유하기
        </button>
        <button
          type="button"
          onClick={copyLink}
          style={{
            width: '100%', marginTop: 8, height: 44, borderRadius: 14, border: '1.5px solid #B9CBF2', cursor: 'pointer',
            background: 'rgba(255,255,255,.7)', color: '#1D5BFF', fontSize: 13.5, fontWeight: 800,
          }}
        >
          🔗 링크 복사
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: note ? '#1D5BFF' : '#8FA3C8', marginTop: 10, fontWeight: note ? 800 : 400 }}>
          {note ?? '카카오톡 공유는 포스터 이미지와 링크가 함께 전송돼요 · arvotcg.com'}
        </div>
        </div>
      </div>
    </div>
  );
}

/** 카카오 말풍선 심볼(단색) — 공유 버튼용. */
function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.87 5.33 4.68 6.75L5.6 21.6a.4.4 0 0 0 .6.44l4.6-3.06c.39.04.79.06 1.2.06 5.52 0 10-3.58 10-8.04S17.52 3 12 3z" />
    </svg>
  );
}

/** 인증 도장 — 이중 원 + 원형 글자(ARVOTCG · VERIFIED) + '수익 인증' + 실제 수익률(등록가 대비) + 날짜. */
function Stamp({ date, up, pct }: { date: string; up: boolean; pct: number | null }) {
  const size = 84;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <path id="flex-stamp-arc" d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="rgba(255,255,255,.4)" stroke={STAMP} strokeWidth="3.5" />
      <circle cx="60" cy="60" r="50" fill="none" stroke={STAMP} strokeWidth="1.4" />
      <circle cx="60" cy="60" r="36" fill="none" stroke={STAMP} strokeWidth="1.4" />
      <text fill={STAMP} fontSize="9.5" fontWeight="900" letterSpacing="2.2" fontFamily="Arial, sans-serif">
        <textPath href="#flex-stamp-arc" startOffset="2%">ARVOTCG · VERIFIED · ARVOTCG · VERIFIED ·</textPath>
      </text>
      <text x="60" y="52" textAnchor="middle" fill={STAMP} fontSize="12.5" fontWeight="900" fontFamily="inherit">수익 인증</text>
      <text x="60" y="71" textAnchor="middle" fill={STAMP} fontSize="16" fontWeight="900" fontFamily="Arial, sans-serif">
        {pct != null ? `${up ? '+' : ''}${pct.toFixed(1)}%` : '—'}
      </text>
      <text x="60" y="84" textAnchor="middle" fill={STAMP} fontSize="7" fontWeight="700" letterSpacing="1" fontFamily="Arial, sans-serif">{date}</text>
    </svg>
  );
}

function Badge({ children, muted, small }: { children: React.ReactNode; muted?: boolean; small?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center',
        whiteSpace: small ? 'normal' : 'nowrap', maxWidth: '100%', wordBreak: 'keep-all',
        background: muted ? '#E6ECF6' : '#fff', color: muted ? '#8FA3C8' : '#1B2A47',
        borderRadius: small ? 10 : 12, padding: small ? '6px 8px' : '8px 12px', fontSize: small ? 10.5 : 12, fontWeight: 800,
        boxShadow: '0 4px 12px rgba(40,80,170,.12)',
      }}
    >
      {children}
    </span>
  );
}

function Cell({
  label, value, color, divider, chip, chipColor,
}: { label: string; value: string; color?: string; divider?: boolean; chip?: string; chipColor?: string }) {
  return (
    <div style={{ textAlign: 'center', borderLeft: divider ? '1px solid #E3EAF6' : 'none', padding: '0 6px', minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8FA3C8' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: color ?? '#111827', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {chip && (
        <div style={{ display: 'inline-block', marginTop: 6, background: `${chipColor}1A`, color: chipColor, borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>
          {chip}
        </div>
      )}
    </div>
  );
}
