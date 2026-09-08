import { NextResponse } from 'next/server';

// 로컬 Route Handler — next.config 의 /api/* → Express rewrite 보다 우선(afterFiles).
//
// PSA Public API 릴레이. PSA 의 Cloudflare 가 한국 홈 IP(NAS 회선)를 하드 차단해
// NAS 직접 호출이 403 — Vercel(미국) 을 경유시키는 좁은 프록시.
// 호출자: server/lib/psaPop.ts (NAS) — 직접 호출 403 시 폴백.
//
// 보안: 화이트리스트 2개 GET 엔드포인트만 통과 + 호출자가 자기 PSA 토큰을
// x-psa-token 으로 제공해야 동작(토큰 없인 무용지물). PSA_RELAY_KEY 를
// Vercel과 서버에 같은 값을 설정해야 하며 미설정 시 요청을 거부한다.
export const dynamic = 'force-dynamic';

const PSA_ORIGIN = 'https://api.psacard.com/publicapi';
const PATH_RE = /^\/(cert\/GetByCertNumber|pop\/GetPSASpecPopulation)\/[A-Za-z0-9]{1,20}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') ?? '';
  if (!PATH_RE.test(path)) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }

  const relayKey = process.env.PSA_RELAY_KEY;
  if (!relayKey || req.headers.get('x-relay-key') !== relayKey) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const token = req.headers.get('x-psa-token')?.trim();
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 });

  try {
    const res = await fetch(`${PSA_ORIGIN}${path}`, {
      headers: { Authorization: `bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const body = await res.text();
    // PSA 가 JSON 이 아닌 차단 페이지를 주면 그대로 전달하지 않고 상태만 알린다.
    if (!res.ok || !body.trimStart().startsWith('{')) {
      return NextResponse.json(
        { error: 'psa-upstream', status: res.status },
        { status: res.ok ? 502 : res.status },
      );
    }
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[psa-relay]', path, err);
    return NextResponse.json({ error: 'psa-unreachable' }, { status: 502 });
  }
}
