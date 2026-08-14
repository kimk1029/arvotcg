import { useEffect, useRef, type ReactNode } from 'react';
import { View, AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { api } from '@/lib/apiClient';

/**
 * 모바일 행동 추적기 — children 을 감싸 모든 탭을 비차단 캡처하고, 화면 이동(usePathname)마다
 * pageview 를 /api/metrics/action 에 배치 전송. 회원은 apiClient 가 Bearer 로 userId 첨부,
 * 비회원은 anonId(파일 저장)로 식별. 모든 실패는 조용히 무시(UX 영향 0).
 */
const FLUSH_MS = 5000;
const MAX_QUEUE = 25;
const ANON_FILE = 'anon.txt';

interface Ev {
  type: string;
  path: string;
  target?: string;
}

let queue: Ev[] = [];
let anonId = '';

function getAnonId(): string {
  if (anonId) return anonId;
  try {
    const f = new File(Paths.document, ANON_FILE);
    if (f.exists) {
      const v = f.textSync().trim();
      if (v) {
        anonId = v;
        return v;
      }
    }
    const v = `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (!f.exists) f.create();
    f.write(v);
    anonId = v;
  } catch {
    anonId = anonId || `a_${Date.now()}`;
  }
  return anonId;
}

function flush(): void {
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  api('/api/metrics/action', {
    method: 'POST',
    body: { source: 'mobile', anonId: getAnonId(), events },
  }).catch(() => {});
}

function enqueue(ev: Ev): void {
  queue.push(ev);
  if (queue.length >= MAX_QUEUE) flush();
}

export function ActionTracker({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // 화면 이동 1건
  useEffect(() => {
    if (pathname) enqueue({ type: 'pageview', path: pathname });
  }, [pathname]);

  // anonId 준비 + flush 타이밍 (마운트 1회)
  useEffect(() => {
    getAnonId();
    const timer = setInterval(flush, FLUSH_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      flush();
    };
  }, []);

  // 탭 좌표 추적은 하지 않는다 — 루트 View 의 onStartShouldSetResponderCapture 는
  // 새 아키텍처(Fabric) iOS 에서 false 를 반환해도 자식 Pressable 의 터치를 삼켜
  // 앱 전체 버튼이 안 눌리는 치명적 문제를 일으킨다 (스크롤만 동작하는 증상).
  // 화면 이동(pageview) 추적만 유지. 웹은 DOM 캡처 리스너라 영향 없음.
  return <View style={{ flex: 1 }}>{children}</View>;
}
