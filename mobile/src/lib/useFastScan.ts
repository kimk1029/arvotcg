/**
 * 카메라 fast scan 파이프라인 — 한 장 찍힐 때마다 즉시 OCR → 코드 검색.
 *
 * 촬영과 인식을 분리해서, 사용자가 다음 장을 찍는 동안 앞 장의 인식/검색이
 * 백그라운드로 끝나 있게 한다. 결과 화면에 도착하면 대부분 이미 완료 상태다.
 */
import { useCallback, useRef, useState } from 'react';
import { scanCardCode, type ScannedCardCode } from '@/lib/cardCodeOcr';
import { isUsableCardCode } from '../../../shared/cardCode';
import { fetchCardsByCode, type CardByCode } from '@/services/snkrdunk';
import type { CardShot } from '@/components/cv/CardCamera';

export type ShotStatus = 'reading' | 'searching' | 'done' | 'nocode' | 'empty';

export interface ScanShot {
  id: string;
  cardUri: string;
  roiUri: string;
  capturedAt: string;
  status: ShotStatus;
  code: ScannedCardCode | null;
  /** 'device' | 'server' | 'none' — 어디서 읽었는지(디버그/표시용). */
  engine: string;
  cards: CardByCode[];
  source: 'db' | 'live' | 'none';
  /** 인식+검색 총 소요(ms). */
  elapsedMs: number;
}

export function useFastScan() {
  const [shots, setShots] = useState<ScanShot[]>([]);
  const seq = useRef(0);

  const update = useCallback((id: string, patch: Partial<ScanShot>) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /** 촬영 1장 추가 + 인식/검색 파이프라인 시작. */
  const addShot = useCallback(
    (shot: CardShot) => {
      seq.current += 1;
      const id = `shot-${seq.current}-${shot.capturedAt}`;
      const startedAt = Date.now();
      setShots((prev) => [
        ...prev,
        {
          id,
          cardUri: shot.cardUri,
          roiUri: shot.roiUri,
          capturedAt: shot.capturedAt,
          status: 'reading',
          code: null,
          engine: 'none',
          cards: [],
          source: 'none',
          elapsedMs: 0,
        },
      ]);

      void (async () => {
        // 1) 좌하단 코드만 인식 (온디바이스 → 실패 시 서버).
        const scan = await scanCardCode(shot.roiUri, shot.cardUri, shot.fullUri);
        if (!isUsableCardCode(scan.code)) {
          update(id, {
            status: 'nocode',
            code: scan.code,
            engine: scan.engine,
            elapsedMs: Date.now() - startedAt,
          });
          return;
        }
        update(id, { status: 'searching', code: scan.code, engine: scan.engine });

        // 2) 코드로 바로 조회 — 이름 검색 없이 세트코드+번호만.
        const { cards, source } = await fetchCardsByCode(
          scan.code.setCode ?? '',
          scan.code.cardNumber ?? '',
          scan.code.game,
        );
        update(id, {
          status: cards.length > 0 ? 'done' : 'empty',
          cards,
          source,
          elapsedMs: Date.now() - startedAt,
        });
      })();
    },
    [update],
  );

  const removeShot = useCallback((id: string) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reset = useCallback(() => {
    setShots([]);
    seq.current = 0;
  }, []);

  return { shots, addShot, removeShot, reset };
}
