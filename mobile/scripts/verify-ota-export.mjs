import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(project, process.argv[2] ?? 'dist');
const platforms = process.argv.slice(3);
assert(platforms.length > 0, 'Specify platforms: node scripts/verify-ota-export.mjs dist android ios');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

const routes = files(path.join(project, 'app')).filter((file) =>
  /\.[jt]sx?$/.test(file) && !/\+api\.[jt]sx?$/.test(file) && !/\+html\.[jt]sx?$/.test(file)
);
assert(routes.length > 0, 'No local routes found');
const metadata = JSON.parse(fs.readFileSync(path.join(output, 'metadata.json'), 'utf8'));
for (const platform of platforms) {
  assert(['android', 'ios'].includes(platform), 'Unsupported platform: ' + platform);
  const bundle = metadata.fileMetadata?.[platform]?.bundle;
  assert(bundle, 'Missing bundle for ' + platform);
  assert(fs.statSync(path.join(output, bundle)).size > 0, 'Empty bundle');
  const map = JSON.parse(fs.readFileSync(path.join(output, bundle + '.map'), 'utf8'));
  for (const route of routes) {
    const relative = path.relative(project, route).split(path.sep).join('/');
    // Platform-specific routes need only be present in their own platform bundle.
    if (/\.(android|ios|web)\.[jt]sx?$/.test(relative) &&
        !relative.includes('.' + platform + '.')) continue;
    const index = map.sources.findIndex((source) =>
      source === relative || source.endsWith('/' + relative)
    );
    assert(index >= 0, platform + ': route missing from OTA: ' + relative);
    assert.equal(map.sourcesContent[index], fs.readFileSync(route, 'utf8'),
      platform + ': stale/wrong-worktree source: ' + relative);
  }
  console.log(platform + ': verified current route sources (' + routes.length + ' local files), ' + bundle);
}

