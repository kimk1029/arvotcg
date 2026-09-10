import { PRODUCTION_API_ORIGIN_FALLBACK } from '../shared/apiEndpoints.ts';

const origin = process.env.MONITOR_API_ORIGIN || PRODUCTION_API_ORIGIN_FALLBACK;
const url = new URL('/ready', origin);
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const start = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || body.ok !== true) throw new Error(`unhealthy HTTP ${response.status}`);
    console.log(`Readiness passed (${Date.now() - start}ms)`);
    process.exit(0);
  } catch (error) {
    console.error(`Readiness attempt ${attempt}/3: ${error.message}`);
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
process.exitCode = 1;
