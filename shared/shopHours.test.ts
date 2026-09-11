import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTags, shopOpenState } from './shopHours';

// 2026-09-11 (금) 14:00 KST = 05:00 UTC
const FRI_14 = Date.UTC(2026, 8, 11, 5, 0);
// 2026-09-14 (월) 14:00 KST
const MON_14 = Date.UTC(2026, 8, 14, 5, 0);

test('영업시간 안이면 open, 밖이면 closed, 파싱 불가면 null', () => {
  assert.equal(shopOpenState('10:00 - 21:00', '', FRI_14), 'open');
  assert.equal(shopOpenState('10:00~13:00', '', FRI_14), 'closed');
  assert.equal(shopOpenState('14:00 - 02:00', '', Date.UTC(2026, 8, 11, 16, 0)), 'open'); // 익일 01:00 KST
  assert.equal(shopOpenState('', '', FRI_14), null);
  assert.equal(shopOpenState('10시~21시', '', FRI_14), null);
});

test('휴무 요일이면 dayoff, 연중무휴는 무시', () => {
  assert.equal(shopOpenState('10:00 - 21:00', '매주 월요일', MON_14), 'dayoff');
  assert.equal(shopOpenState('10:00 - 21:00', '월, 화', MON_14), 'dayoff');
  assert.equal(shopOpenState('10:00 - 21:00', '매주 월요일', FRI_14), 'open');
  assert.equal(shopOpenState('10:00 - 21:00', '연중무휴', MON_14), 'open');
});

test('태그 파서', () => {
  assert.deepEqual(parseTags(' 오리파 , 싱글 ,, 매입'), ['오리파', '싱글', '매입']);
  assert.deepEqual(parseTags(''), []);
});
