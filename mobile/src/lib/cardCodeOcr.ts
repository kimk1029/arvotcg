/**
 * 카드 좌하단 코드 인식 — 카메라 스캔 fast path.
 *
 * 1순위: **온디바이스** ML Kit 텍스트 인식. 네트워크 없이 수십~수백 ms 로 끝나
 *        연속 촬영에도 따라온다.
 * 2순위: 서버 `/api/cards/scan-code` (Paddle/Vision) — 온디바이스가 아무것도
 *        못 읽었을 때만. 조각 이미지만 올려서 기존 /api/cards/scan 보다 훨씬 가볍다.
 *
 * 파싱은 [[/shared/cardCode.ts]] 단일 소스. 여기서는 인식만 하고 규칙은 만들지 않는다.
 */
import { getApiOrigin } from '@/lib/apiEnv';
import { getAuthHeader } from '@/lib/session';
import { parseScannedCardCode, isUsableCardCode, type ScannedCardCode } from '../../../shared/cardCode';

/** ML Kit 은 네이티브 모듈 — Expo Go 에서는 없다. 로드 실패해도 화면이 죽지 않게 lazy require. */
type MlKitLine = { text?: string };
type MlKitResult = { text?: string; blocks?: Array<{ text?: string; lines?: MlKitLine[] }> };
type MlKitModule = { recognize: (uri: string) => Promise<MlKitResult> };

let mlkit: MlKitModule | null | undefined;
function getMlKit(): MlKitModule | null {
  if (mlkit !== undefined) return mlkit;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition');
    mlkit = (mod?.default ?? mod) as MlKitModule;
  } catch {
    mlkit = null;
  }
  return mlkit;
}

export type OcrEngine = 'device' | 'server' | 'none';

export interface CardCodeScan {
  code: ScannedCardCode;
  engine: OcrEngine;
  /** 인식에 걸린 시간(ms) — 디버깅/표시용. */
  durationMs: number;
}

/** ML Kit 결과 → 줄 배열. */
function linesOf(result: MlKitResult | null | undefined): string[] {
  if (!result) return [];
  const out: string[] = [];
  for (const block of result.blocks ?? []) {
    for (const line of block.lines ?? []) {
      if (line.text) out.push(line.text);
    }
    if ((!block.lines || block.lines.length === 0) && block.text) out.push(block.text);
  }
  if (out.length === 0 && result.text) out.push(result.text);
  return out;
}

/** 온디바이스 인식. 모듈이 없거나 실패하면 빈 배열. */
export async function recognizeOnDevice(uri: string): Promise<string[]> {
  const kit = getMlKit();
  if (!kit) return [];
  try {
    return linesOf(await kit.recognize(uri));
  } catch {
    return [];
  }
}

/** 서버 폴백 — 조각 이미지를 그대로 올려 코드만 받는다. */
async function recognizeOnServer(uri: string, timeoutMs = 12000): Promise<ScannedCardCode | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const form = new FormData();
    // RN 의 FormData 파일 형식 (fetch 가 multipart 로 직렬화).
    form.append('image', { uri, name: 'card.jpg', type: 'image/jpeg' } as unknown as Blob);
    const auth = getAuthHeader();
    const res = await fetch(`${getApiOrigin()}/api/cards/scan-code`, {
      method: 'POST',
      headers: auth ? { Authorization: auth } : undefined,
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: ScannedCardCode };
    return json.code ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 카드 이미지에서 코드를 읽는다 — 좁은 조각부터 넓은 순으로 시도한다.
 *
 * 좌하단 ROI 가 1순위(작아서 가장 빠르고 정확)지만, 촬영 프레임과 프리뷰의
 * 화각/비율이 어긋나면 잘린 위치가 밀릴 수 있다. 그래서 실패 시 카드 전체 →
 * 원본 사진 순으로 넓혀 가며 한 번씩 더 본다(각 패스는 온디바이스라 수백 ms).
 *
 * @param roiUri  좌하단만 잘라 확대한 이미지.
 * @param cardUri 가이드 영역(카드)만 잘라낸 이미지.
 * @param fullUri 크롭 전 원본 사진.
 */
export async function scanCardCode(
  roiUri: string,
  cardUri?: string,
  fullUri?: string,
): Promise<CardCodeScan> {
  const startedAt = Date.now();

  let deviceLines: string[] = [];
  let deviceCode = parseScannedCardCode([]);
  for (const uri of [roiUri, cardUri, fullUri]) {
    if (!uri) continue;
    const lines = await recognizeOnDevice(uri);
    if (lines.length === 0) continue;
    deviceLines = lines;
    deviceCode = parseScannedCardCode(lines);
    if (isUsableCardCode(deviceCode)) {
      return { code: deviceCode, engine: 'device', durationMs: Date.now() - startedAt };
    }
  }

  // 온디바이스가 코드를 못 만들었을 때만 서버 폴백 (네트워크 왕복).
  const serverCode = await recognizeOnServer(cardUri ?? fullUri ?? roiUri);
  if (serverCode && isUsableCardCode(serverCode)) {
    return { code: serverCode, engine: 'server', durationMs: Date.now() - startedAt };
  }

  // 둘 다 실패 — 그래도 부분 결과(번호만 읽힘 등)는 돌려줘 UI 가 안내할 수 있게.
  return {
    code: serverCode ?? deviceCode,
    engine: deviceLines.length > 0 ? 'device' : 'none',
    durationMs: Date.now() - startedAt,
  };
}

export { isUsableCardCode };
export type { ScannedCardCode };
