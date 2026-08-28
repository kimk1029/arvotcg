'use client';

import type { SnkrdunkRow } from '@/lib/snkrdunkRow';

/**
 * 홈 HOT 카드 목록 공유 캐시 (sessionStorage).
 * 홈 캐러셀에 노출된 목록을 그대로 저장해, '더보기'(/cards/snkrdunk) 목록이
 * 같은 항목·같은 순서로 즉시 뜨게 한다 (재조회 없음 → 진입 속도 개선).
 * 앱 mobile/src/lib/homeHotStore.ts 와 페어.
 */

const KEY = 'pf30:homeHotRows';
const TTL_MS = 10 * 60_000; // 홈 데이터 자체가 10분 캐시 기준

export interface HomeHotCache {
  game: string;
  rows: SnkrdunkRow[];
  savedAt: number;
}

// sessionStorage 불가 환경(사파리 프라이빗 등) 폴백 — 같은 탭 세션 동안만 유지.
let memoryCache: HomeHotCache | null = null;

export function saveHomeHotRows(game: string, rows: SnkrdunkRow[]): void {
  if (rows.length === 0) return;
  const entry: HomeHotCache = { game, rows, savedAt: Date.now() };
  memoryCache = entry;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // ignore quota/unavailable
  }
}

export function loadHomeHotRows(): HomeHotCache | null {
  let entry: HomeHotCache | null = memoryCache;
  if (!entry) {
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw) entry = JSON.parse(raw) as HomeHotCache;
    } catch {
      entry = null;
    }
  }
  if (!entry || !Array.isArray(entry.rows) || entry.rows.length === 0) return null;
  if (Date.now() - entry.savedAt > TTL_MS) return null;
  return entry;
}
