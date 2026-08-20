/**
 * 화면 전환 즉시 페인트용 SWR(stale-while-revalidate) 캐시 — 공통 인프라.
 *
 * - 메모리 우선. `persist` 키는 디스크(단일 JSON 파일)에도 저장돼 앱 재시작(콜드
 *   스타트)에도 마지막 데이터가 즉시 그려진다.
 * - [[useSWR]] 훅은 useAsync 와 같은 반환 모양(data/loading/error/refresh) —
 *   화면 교체가 기계적. 차이: 캐시가 있으면 스피너 없이 즉시 그리고 백그라운드
 *   갱신하며, 포커스 재진입 시 TTL 이 지난 경우에만 재조회한다
 *   (useAsync 는 포커스마다 무조건 재조회 → 네트워크 낭비 + 스피너).
 * - `me:` 프리픽스 키는 세션(로그인/로그아웃/계정 전환) 변경 시 일괄 무효화 —
 *   이전 계정 데이터가 다음 계정 화면에 비치지 않게.
 * - 실패는 캐시하지 않고, 캐시가 그려져 있는 동안의 백그라운드 실패는 error 로
 *   띄우지 않는다(다음 재조회가 다시 시도).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { subscribeSession } from './session';

interface Entry {
  t: number;
  v: unknown;
}

const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
/** persist 로 디스크에 쓰는 키 집합 — swrSet 이 기억해 저장 시 함께 직렬화. */
const persistKeys = new Set<string>();

/* ── 디스크 (단일 JSON — 값들이 수십 KB 수준이라 통파일이 단순·충분) ── */

const DISK_FILE = 'swr-cache-v1.json';
let diskLoaded = false;
let diskWriteTimer: ReturnType<typeof setTimeout> | null = null;

function diskFile(): File {
  return new File(Paths.document, DISK_FILE);
}

function loadDiskOnce(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    const f = diskFile();
    if (!f.exists) return;
    const parsed = JSON.parse(f.textSync()) as Record<string, Entry> | null;
    if (!parsed) return;
    for (const [k, e] of Object.entries(parsed)) {
      if (e && typeof e.t === 'number' && !mem.has(k)) {
        mem.set(k, e);
        persistKeys.add(k);
      }
    }
  } catch {
    // 손상된 캐시 파일은 무시 — 다음 저장이 덮어쓴다.
  }
}

function saveDiskSoon(): void {
  if (diskWriteTimer) clearTimeout(diskWriteTimer);
  diskWriteTimer = setTimeout(() => {
    diskWriteTimer = null;
    try {
      const out: Record<string, Entry> = {};
      for (const k of persistKeys) {
        const e = mem.get(k);
        if (e) out[k] = e;
      }
      const f = diskFile();
      if (!f.exists) f.create();
      f.write(JSON.stringify(out));
    } catch {
      // 저장 실패(용량 등)는 무시 — 캐시는 가속용일 뿐.
    }
  }, 500);
}

/* ── 스토어 API ─────────────────────────────────────────────────── */

/** 캐시된 값 (TTL 무관 — 스테일이어도 반환). 없으면 null. */
export function swrPeek<T>(key: string): T | null {
  loadDiskOnce();
  const e = mem.get(key);
  return e ? (e.v as T) : null;
}

/** 캐시 나이(ms). 캐시 없으면 Infinity — `swrAge(k) > ttl` 로 재조회 판단. */
export function swrAge(key: string): number {
  loadDiskOnce();
  const e = mem.get(key);
  return e ? Date.now() - e.t : Infinity;
}

export function swrSet<T>(key: string, v: T, opts: { persist?: boolean } = {}): void {
  loadDiskOnce();
  mem.set(key, { t: Date.now(), v });
  if (opts.persist) {
    persistKeys.add(key);
    saveDiskSoon();
  } else if (persistKeys.has(key)) {
    // 기존에 persist 였던 키가 메모리 전용으로 갱신돼도 디스크 값이 낡지 않게 저장.
    saveDiskSoon();
  }
}

/** prefix 로 시작하는 캐시 키 나열 — 게임별 홈 캐시처럼 키가 동적인 그룹의 시드용. */
export function swrKeys(prefix: string): string[] {
  loadDiskOnce();
  return Array.from(mem.keys()).filter((k) => k.startsWith(prefix));
}

/** prefix 로 시작하는 키 일괄 무효화 (메모리+디스크). 등록/삭제 등 뮤테이션 직후 호출. */
export function swrInvalidate(prefix: string): void {
  loadDiskOnce();
  let touchedDisk = false;
  for (const k of Array.from(mem.keys())) {
    if (k.startsWith(prefix)) {
      mem.delete(k);
      if (persistKeys.delete(k)) touchedDisk = true;
    }
  }
  if (touchedDisk) saveDiskSoon();
}

// 세션 변경(로그인/로그아웃/계정 전환) → 사용자 데이터 캐시 일괄 무효화.
subscribeSession(() => swrInvalidate('me:'));

/* ── 훅 ─────────────────────────────────────────────────────────── */

export interface SWRState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useSWR<T>(
  key: string,
  fn: () => Promise<T>,
  opts: {
    /** 이 시간 내 캐시는 포커스/마운트 재조회 생략. 기본 2분. */
    ttlMs?: number;
    /** 디스크 저장 — 앱 재시작에도 즉시 페인트. 기본 false(메모리만). */
    persist?: boolean;
    /** false 면 아무것도 하지 않음 (미로그인 화면 등). */
    enabled?: boolean;
    /** fn 이 의존하는 외부 값 — 변하면 재실행. key 가 바뀌는 경우는 자동. */
    deps?: unknown[];
  } = {},
): SWRState<T> {
  const { ttlMs = 120_000, persist = false, enabled = true } = opts;
  const deps = opts.deps ?? [];
  const [data, setData] = useState<T | null>(() => (enabled ? swrPeek<T>(key) : null));
  const [loading, setLoading] = useState<boolean>(() => enabled && swrPeek<T>(key) === null);
  const [error, setError] = useState<Error | null>(null);
  const tick = useRef(0);

  const run = useCallback(
    (force: boolean) => {
      if (!enabled) return;
      const cached = swrPeek<T>(key);
      // key 전환(deps 변경 포함) 직후 이전 키 데이터가 비치지 않게 캐시값으로 맞춘다.
      setData(cached);
      if (!force && cached !== null && swrAge(key) < ttlMs) return; // 신선 — 재조회 생략
      const myTick = ++tick.current;
      if (cached === null) setLoading(true);
      setError(null);
      // 같은 키 동시요청 병합 — 탭 전환 연타 등에서 중복 fetch 방지.
      const p =
        (inflight.get(key) as Promise<T> | undefined) ??
        (() => {
          const np = fn().finally(() => inflight.delete(key));
          inflight.set(key, np);
          return np;
        })();
      p.then((res) => {
        swrSet(key, res, { persist });
        if (myTick !== tick.current) return;
        setData(res);
        setError(null);
      })
        .catch((err: unknown) => {
          if (myTick !== tick.current) return;
          // 캐시가 그려져 있으면 백그라운드 실패는 조용히 — 스피너/에러 플래시 방지.
          if (swrPeek<T>(key) === null) setError(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          if (myTick !== tick.current) return;
          setLoading(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, enabled, ...deps],
  );

  useEffect(() => {
    run(false);
    return () => {
      tick.current++;
    };
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      run(false);
    }, [run]),
  );

  return { data, loading, error, refresh: () => run(true) };
}
