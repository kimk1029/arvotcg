/**
 * 카드샵 저장 직후 API 서버의 /api/shops 60초 캐시를 비운다 (server/routes/shops.ts).
 * 어드민은 DB 에 직접 쓰므로 서버가 변경을 모른다 — 배너 업로드와 같은 공유 비밀로 호출.
 * 실패해도 저장은 유효(최대 60초 뒤 자연 반영)라 예외를 삼킨다.
 */
const API_ORIGIN = process.env.ADMIN_API_ORIGIN ?? 'https://api.arvotcg.com';

export async function invalidateShopsCache(): Promise<void> {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  if (!secret) return;
  try {
    await fetch(`${API_ORIGIN}/api/shops/invalidate`, { method: 'POST', headers: { 'x-admin-upload-secret': secret }, signal: AbortSignal.timeout(3000) });
  } catch {
    /* 60초 뒤 자연 반영 */
  }
}
