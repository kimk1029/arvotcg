import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nearbyBounds } from './shopRegions';

test("'내 주변' 프레이밍 — 현재 위치 중심 대칭, 가까운 샵 2개 포함, 먼 샵 제외", () => {
  const me = { lat: 37.55, lng: 126.98 };
  const pins = [
    { lat: 37.56, lng: 126.99 }, // ~1.4km
    { lat: 37.54, lng: 126.97 }, // ~1.4km
    { lat: 35.1, lng: 129.03 }, // 부산 — 들어오면 안 됨
  ];
  const b = nearbyBounds(me, pins);
  assert.ok(b);
  assert.ok(Math.abs((b.minLat + b.maxLat) / 2 - me.lat) < 1e-9);
  assert.ok(Math.abs((b.minLng + b.maxLng) / 2 - me.lng) < 1e-9);
  const inside = (p: { lat: number; lng: number }) => p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
  assert.ok(inside(pins[0]) && inside(pins[1]));
  assert.equal(inside(pins[2]), false);
});

test('바로 옆 샵 하나뿐이면 최소 반경, 핀 없으면 null', () => {
  const me = { lat: 37.55, lng: 126.98 };
  const c = nearbyBounds(me, [{ lat: 37.5501, lng: 126.9801 }]);
  assert.ok(c && c.maxLat - c.minLat >= 0.006 && c.maxLng - c.minLng >= 0.008);
  assert.equal(nearbyBounds(me, []), null);
});
