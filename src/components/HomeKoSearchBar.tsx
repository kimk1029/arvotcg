'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { PIXEL_BORDER } from '@/components/pixelBorder';
import { startRouteTransition } from '@/components/RouteProgress';
import { ScanProgressOverlay } from '@/components/ScanProgressOverlay';
import { useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';

// 클린 테마 공통 박스 — 흰 면 + 옅은 보더 + 소프트 섀도우 (라운드 18px).
// 픽셀 테마의 하드 잉크 박스를 대체. DashboardScreen 의 패널들과 동일 스타일.
const CLEAN_BOX_SHADOW = '0 1px 2px rgba(24,34,58,.04),0 10px 24px rgba(24,34,58,.06)';

/** File → HTMLImageElement (스캔용 디코드). */
function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
}

export function HomeKoSearchBar() {
  const router = useRouter();
  const { theme } = useTheme();
  const isClean = isFlatTheme(theme);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function goSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    startRouteTransition();
    router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(trimmed)}`);
  }

  function submit() {
    if (!query.trim()) {
      inputRef.current?.focus();
      return;
    }
    goSearch(query);
  }

  function onClear() {
    setQuery('');
    inputRef.current?.focus();
  }

  // 카메라 스캔 — 사진에서 세트코드+카드번호를 OpenAI 로 읽어 "코드 번호"로 검색.
  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    setScanning(true);
    try {
      const img = await fileToImage(file);
      // OCR 코드는 무거우니 탭 시점에 동적 로드(홈 번들 경량 유지).
      const { recognizeCard } = await import('@/components/grading/cardOcr');
      const r = await recognizeCard(img, null, { useAi: true, language: 'ko' });
      const num = r.cardNumber?.left ?? '';
      const q = r.setCode && num ? `${r.setCode} ${num}` : (r.name ?? num ?? '').trim();
      if (q) goSearch(q);
      else alert('카드 정보를 읽지 못했어요. 더 또렷한 사진으로 다시 시도해 주세요.');
    } catch {
      alert('스캔에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <ScanProgressOverlay visible={scanning} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ position: 'relative', height: 44, width: '100%' }}
      >
        {/* 아이콘 (input 안 좌측) */}
        <span
          aria-hidden
          style={{
            position: 'absolute', left: 12, top: 0, height: 44,
            display: 'flex', alignItems: 'center', fontSize: 15, color: 'var(--ink3)', pointerEvents: 'none',
          }}
        >
          🔍
        </span>

        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={scanning ? '카드 스캔 중…' : '카드 검색 (예: 리자몽)'}
          aria-label="스니덩크 한국어 검색"
          disabled={scanning}
          style={{
            width: '100%', height: 44, padding: '0 84px 0 36px', outline: 'none',
            // 인풋 텍스트 +2pt (11→13) — placeholder/검색어 가독성.
            background: 'var(--white)', fontFamily: 'var(--f1)', fontSize: 13, color: 'var(--ink)', letterSpacing: 0.3,
            // 픽셀 폰트는 폭이 넓어 placeholder 가 줄바꿈→세로로 두꺼워졌다. 항상 한 줄.
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            ...(isClean
              ? { border: '1px solid var(--pap3)', borderRadius: 'var(--r)', boxShadow: CLEAN_BOX_SHADOW }
              : {
                  border: 'none',
                  boxShadow:
                    '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),inset 2px 2px 0 rgba(0,0,0,.08),4px 4px 0 var(--ink)',
                }),
          }}
        />

        {/* Clear */}
        {query && !scanning && (
          <button
            type="button"
            onClick={onClear}
            aria-label="검색어 지우기"
            style={{
              position: 'absolute', right: 84, top: 8, width: 28, height: 28, border: 'none',
              background: 'transparent', cursor: 'pointer', fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink3)',
            }}
          >
            ✕
          </button>
        )}

        {/* 카메라 스캔 (input 안 우측, 검색 버튼 왼쪽) */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} style={{ display: 'none' }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          aria-label="카드 사진 스캔"
          style={{
            position: 'absolute', right: 44, top: 6, width: 32, height: 32, border: 'none',
            background: 'transparent', cursor: scanning ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink3)',
          }}
        >
          {scanning ? (
            <span style={{ fontFamily: 'var(--f1)', fontSize: 11 }}>…</span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          )}
        </button>

        {/* Submit (input 안 우측) */}
        <button
          type="submit"
          aria-label="검색"
          disabled={scanning}
          style={{
            position: 'absolute', right: 6, top: 6, width: 32, height: 32, border: 'none',
            cursor: 'pointer', fontFamily: 'var(--f1)', fontSize: 13, letterSpacing: 0,
            ...(isClean
              ? { background: 'var(--accent)', color: 'var(--white)', borderRadius: 'var(--r-sm)', boxShadow: 'none' }
              : {
                  background: 'var(--ink)', color: 'var(--gold)',
                  boxShadow: `${PIXEL_BORDER},2px 2px 0 var(--yel-dk)`,
                }),
          }}
        >
          ▶
        </button>
      </form>
    </div>
  );
}
