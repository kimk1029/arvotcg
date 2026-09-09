import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackgroundWriteGate } from './backgroundWriteGate';

test('burst writes are shed and slots recover without double release', () => {
  const acquire = createBackgroundWriteGate(2);
  const first = acquire()!;
  const second = acquire()!;
  for (let i = 0; i < 1000; i++) assert.equal(acquire(), null);
  first();
  first();
  const third = acquire()!;
  assert.equal(typeof third, 'function');
  assert.equal(acquire(), null);
  second();
  third();
  assert.ok(acquire());
  assert.ok(acquire());
  assert.equal(acquire(), null);
});
