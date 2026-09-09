import { getApiBaseUrl, handleUnauthorized } from '@/lib/apiClient';
import { getAuthHeader } from '@/lib/session';

/**
 * 사진 업로드 — express `/api/upload/*` (multipart, field 'files', requireAuth).
 * 웹 TradeImagePicker 와 동일 엔드포인트. 업로드된 공개 URL 배열 반환.
 */
async function uploadImages(uris: string[], endpoint: string): Promise<string[]> {
  if (uris.length === 0) return [];
  const form = new FormData();
  uris.forEach((uri, i) => {
    // RN FormData 파일 형식 — picker 가 quality 로 jpeg 재인코딩.
    form.append('files', { uri, name: `photo-${Date.now()}-${i}.jpg`, type: 'image/jpeg' } as never);
  });
  const auth = getAuthHeader();
  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: form as unknown as BodyInit,
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    let msg = `업로드 실패 (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { urls?: string[] };
  return data.urls ?? [];
}

/** 거래글 상품 사진 (최대 5장). */
export function uploadTradeImages(uris: string[]): Promise<string[]> {
  return uploadImages(uris, '/api/upload/trade-images');
}

/** 커뮤니티 글 사진 (최대 3장) — 웹 TradeImagePicker endpoint prop 대응. */
export function uploadFeedImages(uris: string[]): Promise<string[]> {
  return uploadImages(uris, '/api/upload/feed-images');
}
