import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 히어로 배너 이미지 업로드 — 파일을 API 서버(운영 Vultr api.arvotcg.com, /api/admin/banners/upload)로 전달한다.
 * 서버가 자기 디스크(server/public/cdn/uploads/banner)에 저장하고 /api/cdn/... 절대 URL 을
 * 돌려준다(카드 자체 CDN·피드 이미지와 같은 트리). Vercel Blob 은 서버 쪽 옵션일 뿐이다.
 *
 * 어드민은 사용자 JWT 가 없으므로 서버와 공유하는 ADMIN_UPLOAD_SECRET 로 인증한다.
 */
const API_ORIGIN = process.env.ADMIN_API_ORIGIN ?? 'https://api.arvotcg.com';
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'ADMIN_UPLOAD_SECRET 미설정 — admin/.env.local 과 server/.env 에 같은 값을 넣으세요.' },
      { status: 503 },
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `지원하지 않는 형식: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '4MB 이하만 업로드 가능' }, { status: 400 });
  }
  try {
    const fd = new FormData();
    fd.append('file', file, file.name || 'banner');
    const r = await fetch(`${API_ORIGIN}/api/admin/banners/upload`, {
      method: 'POST',
      headers: { 'x-admin-upload-secret': secret },
      body: fd,
      cache: 'no-store',
    });
    const body = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!r.ok) {
      return NextResponse.json({ error: body.error ?? `API ${r.status}` }, { status: r.status });
    }
    if (!body.url) return NextResponse.json({ error: '서버 응답에 url 이 없습니다' }, { status: 502 });
    return NextResponse.json({ url: body.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin.banners.upload]', msg);
    return NextResponse.json({ error: `API 서버 연결 실패: ${msg}` }, { status: 502 });
  }
}
