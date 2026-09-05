#!/usr/bin/env node
/**
 * 스토어 최신 빌드번호를 서버 DB(AppRelease)에 등록한다 — 앱 강제 업데이트의 기준값.
 *
 * **새 스토어 빌드(EAS production)를 낼 때마다 실행한다.** 값을 안 올리면 강제
 * 업데이트가 이전 빌드 기준으로 남는다. mobile/app.json 이 정본이라 인자 없이 돌리면
 * 거기 적힌 version / ios.buildNumber / android.versionCode 를 그대로 등록한다.
 *
 * 사용:
 *   node scripts/set-app-release.mjs                    # app.json 값으로 양 플랫폼 등록
 *   node scripts/set-app-release.mjs --platform android # 한쪽만
 *   node scripts/set-app-release.mjs --build 23         # 값을 직접 지정(롤백용)
 *   node scripts/set-app-release.mjs --off              # 강제 업데이트 해제(사고 시)
 *   node scripts/set-app-release.mjs --dry              # 전송 없이 보낼 값만 출력
 *
 * 인증: server 와 공유하는 ADMIN_UPLOAD_SECRET (환경변수 또는 admin/.env.local).
 * 대상 서버: APP_RELEASE_API_ORIGIN 또는 기본 https://api.arvotcg.com
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.APP_RELEASE_API_ORIGIN ?? 'https://api.arvotcg.com';

/** admin/.env.local · server/.env 에서 KEY=값 하나만 주워온다(dotenv 의존 없이). */
function fromEnvFile(file, key) {
  const p = join(ROOT, file);
  if (!existsSync(p)) return null;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`));
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}
const has = (name) => process.argv.includes(`--${name}`);

const app = JSON.parse(readFileSync(join(ROOT, 'mobile/app.json'), 'utf8')).expo;
const version = app.version;

const onlyPlatform = arg('platform');
const buildOverride = arg('build');
const enforced = !has('off');
const dry = has('dry');

const targets = [
  { platform: 'ios', latestBuild: Number(app.ios?.buildNumber) },
  { platform: 'android', latestBuild: Number(app.android?.versionCode) },
].filter((t) => (onlyPlatform ? t.platform === onlyPlatform : true));

if (targets.length === 0) {
  console.error(`대상 없음 — --platform 은 ios 또는 android`);
  process.exit(1);
}

const secret = process.env.ADMIN_UPLOAD_SECRET ?? fromEnvFile('admin/.env.local', 'ADMIN_UPLOAD_SECRET');
if (!secret && !dry) {
  console.error('ADMIN_UPLOAD_SECRET 없음 — 환경변수로 주거나 admin/.env.local 에 넣으세요.');
  process.exit(1);
}

let failed = false;
for (const t of targets) {
  const latestBuild = buildOverride ? Number(buildOverride) : t.latestBuild;
  if (!Number.isInteger(latestBuild) || latestBuild <= 0) {
    console.error(`${t.platform}: 빌드번호를 못 읽었습니다 (${latestBuild})`);
    failed = true;
    continue;
  }
  const body = { platform: t.platform, latestBuild, version, enforced };
  if (dry) {
    console.log(`[dry] PUT ${API}/api/app-release`, JSON.stringify(body));
    continue;
  }
  try {
    const r = await fetch(`${API}/api/app-release`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-upload-secret': secret },
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`${t.platform}: 실패 ${r.status}`, json);
      failed = true;
    } else {
      console.log(
        `${t.platform}: v${version} build ${latestBuild} 등록${enforced ? '' : ' (강제 해제)'}`,
      );
    }
  } catch (e) {
    console.error(`${t.platform}: 요청 실패`, e?.message ?? e);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
