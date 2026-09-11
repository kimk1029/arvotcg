import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inBounds } from './shopRegions';

test('inBounds — 뷰포트 안/밖', () => {
  const b = { minLat: 37.5, maxLat: 37.6, minLng: 126.9, maxLng: 127.1 };
  assert.equal(inBounds({ lat: 37.55, lng: 127.0 }, b), true);
  assert.equal(inBounds({ lat: 37.7, lng: 127.0 }, b), false);
  assert.equal(inBounds({ lat: 37.55, lng: 126.8 }, b), false);
});
