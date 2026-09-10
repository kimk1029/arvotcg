import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NAV_GROUPS, activeGroupTitle, isActive } from './nav';

test('대시보드는 루트에서만 켜진다', () => {
  assert.equal(isActive('/', '/'), true);
  assert.equal(isActive('/', '/users'), false);
});

test('하위 경로에서도 해당 메뉴가 켜진다', () => {
  assert.equal(isActive('/scans', '/scans/12'), true);
  assert.equal(isActive('/users', '/users'), true);
});

test('더 긴 prefix 가 이긴다 — /oripa 는 /oripa/packs 에서 꺼진다', () => {
  assert.equal(isActive('/oripa/packs', '/oripa/packs'), true);
  assert.equal(isActive('/oripa', '/oripa/packs'), false);
  assert.equal(isActive('/oripa', '/oripa'), true);
});

test('경로가 속한 그룹을 찾는다', () => {
  assert.equal(activeGroupTitle('/notices'), '콘텐츠');
  assert.equal(activeGroupTitle('/oripa/packs'), '거래·오리파');
  assert.equal(activeGroupTitle('/monitoring'), '운영');
  assert.equal(activeGroupTitle('/login'), null);
});

test('그룹당 정확히 한 메뉴만 켜진다 — 중복 하이라이트 없음', () => {
  const paths = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  for (const p of paths) {
    const on = NAV_GROUPS.flatMap((g) => g.items).filter((i) => isActive(i.href, p));
    assert.equal(on.length, 1, `${p} → ${on.map((i) => i.href).join(',')}`);
  }
});

test('메뉴 경로에 중복이 없다', () => {
  const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
});
