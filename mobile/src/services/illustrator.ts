/**
 * 일러스트레이터 카드 검색 — 웹 /cards/search?mode=illustrator 와 동일한
 * 서버 API(/api/cards/by-illustrator). 한글 별칭→EN/JA 사전 매칭 후 카드 목록 반환.
 */
import { api } from '@/lib/apiClient';

export interface IllustratorCard {
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

export interface IllustratorSearchResp {
  ok: boolean;
  resolvedName?: string;
  matched?: { en: string; ja: string | null; koAliases: string[] } | null;
  count?: number;
  cards?: IllustratorCard[];
  message?: string;
}

export async function searchByIllustrator(q: string, limit = 30): Promise<IllustratorSearchResp> {
  // RN fetch 는 기본 타임아웃이 없어 서버/외부 API 가 매달리면 스피너가 영원히 돈다.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await api<IllustratorSearchResp>(
      `/api/cards/by-illustrator?q=${encodeURIComponent(q)}&limit=${limit}`,
      { auth: false, signal: ctrl.signal },
    );
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error('검색이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
