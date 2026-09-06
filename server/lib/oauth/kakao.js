const AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const USERINFO_URL = 'https://kapi.kakao.com/v2/user/me';

function env() {
  const clientId = process.env.KAKAO_CLIENT_ID;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET ?? '';
  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new Error('Kakao OAuth env missing');
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(state) {
  const { clientId, redirectUri } = env();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    // 이메일은 카카오 개발자 콘솔 "카카오계정(이메일)" 동의항목이 선택 동의로 켜져 있어야
    // 요청 가능(비즈 앱 필요, 2026-09-06 설정). 미동의여도 로그인은 완료되고 email 만 비어 온다.
    scope: 'account_email',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = env();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`kakao token exchange ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function fetchUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`kakao userinfo ${res.status}`);
  const data = await res.json();
  return {
    id: String(data.id),
    email: data.kakao_account?.email,
    name: data.kakao_account?.profile?.nickname ?? data.properties?.nickname,
  };
}

export const provider = 'kakao';
