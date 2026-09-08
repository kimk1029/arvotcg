import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeOnlineActors, type OnlineRow } from './onlineActors';

const row = (userId: string | null, anonId = 'browser', time = 1, source = 'web'): OnlineRow => ({
  actor: userId ?? `anon:${anonId}`, userId, anonId, source, path: userId ? '/' : '/login',
  ua: null, ip: '127.0.0.1', lastAt: new Date(time), events: 2n,
});
test('login merges guest activity into one member and keeps latest screen', () => {
  const result = mergeOnlineActors([row(null), row('member', 'browser', 2)]);
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, 'member');
  assert.equal(result[0].events, 4n);
  assert.equal(result[0].path, '/');
});
test('later anonymous activity retains member classification', () => {
  const result = mergeOnlineActors([row('member'), row(null, 'browser', 2)]);
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, 'member');
  assert.equal(result[0].path, '/login');
});
test('same IP, different browsers or sources stay separate', () => {
  assert.equal(mergeOnlineActors([row(null, 'other'), row('member')]).length, 2);
  assert.equal(mergeOnlineActors([row(null), row('member', 'browser', 2, 'mobile')]).length, 2);
});
test('shared browser preserves distinct accounts without extra guest', () => {
  const result = mergeOnlineActors([row(null), row('a'), row('b', 'browser', 2)]);
  assert.equal(result.length, 2);
  assert.equal(result.find(r => r.userId === 'b')?.events, 4n);
});
test('multiple browsers for one account merge; fallback ID never links to member', () => {
  assert.equal(mergeOnlineActors([row('a'), row('a', 'other')]).length, 1);
  assert.equal(mergeOnlineActors([row(null, 'anon'), row('a', 'anon')]).length, 2);
  assert.deepEqual(mergeOnlineActors([]), []);
});
