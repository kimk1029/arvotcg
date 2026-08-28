# ARVOTCG OCR server

Standalone Express server that the mobile app posts card images to.
Runs OCR (Tesseract by default; OpenAI Vision when `OPENAI_API_KEY` is set),
parses bottom-left card-info text (`006/165 sv2a SR`), matches against a small
static card DB, and returns the response shape the mobile app expects.

## Run

```bash
cd server
npm install
cp .env.example .env   # optional — only needed for Vision API path
npm run dev
# OCR server listening http://localhost:3030  vision=off
```

`tesseract.js` downloads `eng.traineddata`, `kor.traineddata`, and when
available `jpn.traineddata` on first OCR call (cached afterwards). If Japanese
traineddata is not available yet, the server falls back to English/Korean OCR.

## API

`POST /api/cards/scan` — multipart/form-data
- `image` — JPEG file
- `guideRect` — JSON `{x,y,w,h}` (relative 0..1)
- `platform` — `ios` | `android`
- `imageWidth`, `imageHeight`
- `capturedAt` — ISO timestamp

Returns `CardScanResponse` (see `mobile/src/types/cardScan.ts`).

## Modes

- **Tesseract (default)** — offline, free. The server first trims the detected
  card border from the uploaded frame, then runs multiple bottom-left OCR crops
  for number/set/rarity and multilingual OCR for Korean/Japanese/English names.
- **Vision (opt-in)** — set `OPENAI_API_KEY` in `.env`. Routes to GPT-4o-mini
  vision for full-card extraction including Korean names.

<!-- 2026-08-29: Vultr 자동 배포 시크릿 등록 후 첫 트리거 (deploy-server vultr 잡 검증) -->
