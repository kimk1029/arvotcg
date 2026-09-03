'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Tabbar } from './Tabbar';
import { useNavPrefs } from './NavPrefsProvider';
import { isEmbedded } from '@/lib/embed';

export function PhoneShell({ children }: { children: ReactNode }) {
  const { navStyle } = useNavPrefs();
  // 앱 인앱 WebView(임베드) — 앱이 네이티브 탭바를 갖고 있으므로 웹 탭바를 그리지 않고
  // 플로팅 하단 여백도 두지 않는다. hydration 전엔 layout.tsx 부트스트랩이 찍은
  // html[data-embed] + globals.css 규칙이 같은 결과를 보장한다.
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => setEmbedded(isEmbedded()), []);
  // 분리형(플로팅)이면 탭바가 콘텐츠 위에 떠 있으므로(absolute), 마지막 콘텐츠가
  // 바에 가리지 않게 screen 하단 패딩을 더해 그 아래로도 스크롤되게 한다.
  const floating = navStyle === 'floating' && !embedded;
  return (
    <div className="page-wrap">
      <div className={`phone${floating ? ' phone--floatnav' : ''}`}>
        <div className={`screen${floating ? ' screen--floatnav' : ''}`}>{children}</div>
        {embedded ? null : <Tabbar />}
      </div>
    </div>
  );
}
