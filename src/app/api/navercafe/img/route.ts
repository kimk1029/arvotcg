import { NextResponse } from 'next/server';

// 네이버 카페 이미지 CDN(pstatic)은 외부 도메인 Referer 를 403 차단한다.
// 브라우저의 referrerPolicy 에 의존하면 일부 환경에서 referer 가 새어 깨지므로,
// 서버에서 referer 없이 받아 같은 출처로 되돌려주는 프록시.
export const dynamic = 'force-dynamic';

const ALLOWED_HOST_SUFFIX = '.pstatic.net';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get('u');
  if (!u) return new NextResponse('missing u', { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new NextResponse('bad url', { status: 400 });
  }
  // SSRF 방지 — https + pstatic CDN 호스트만 허용.
  if (target.protocol !== 'https:' || !target.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return new NextResponse('forbidden host', { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      // Referer 미전송이 핵심(핫링크 차단 우회). UA/Accept 만 전달.
      headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse(`upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(contentType)) {
      await upstream.body.cancel();
      return new NextResponse('unsupported image', { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        // CDN/브라우저 캐시 — 이미지는 불변에 가까움.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('fetch failed', { status: 502 });
  }
}
