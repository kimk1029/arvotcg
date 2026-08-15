/**
 * 소셜 로그인 프로바이더 공식 로고 (SVG).
 * 로그인 버튼 아이콘 칩 안에서 사용 — 이전엔 💬 / N / G 텍스트였음.
 * 웹(src/components/ProviderLogo.tsx)과 동일한 패스 — 수정 시 양쪽 함께.
 */
import Svg, { Path } from 'react-native-svg';
import type { AuthProvider } from '@/lib/oauth';

interface Props {
  provider: AuthProvider | 'apple';
  size?: number;
}

export function ProviderLogo({ provider, size = 22 }: Props) {
  if (provider === 'apple') {
    // Apple 로고 — 검정 버튼 위 흰색 (Sign in with Apple HIG)
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#FFFFFF"
          d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.91 3.16-.84 1.79.14 3.05.94 3.79 2.4-3.34 2.07-2.79 6.44.66 7.88-.65 1.29-1.48 2.56-2.69 3.73zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        />
      </Svg>
    );
  }
  if (provider === 'kakao') {
    // 카카오톡 말풍선 심볼 — 버튼 텍스트색과 동일한 다크브라운
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#3A1D00"
          d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65-.15.53-.96 3.33-1 3.55 0 0-.02.17.09.23.11.07.23.02.23.02.31-.04 3.57-2.34 4.13-2.74.61.09 1.24.13 1.89.13 5.52 0 10-3.54 10-7.9C22 6.55 17.52 3 12 3z"
        />
      </Svg>
    );
  }
  if (provider === 'naver') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill="#FFFFFF" d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
      </Svg>
    );
  }
  // 구글 4색 'G'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </Svg>
  );
}
