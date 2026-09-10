import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_REVIEW_STATE, isStoreUrl, markAsked, shouldAskReview, storePlatformFromUa } from './reviewPrompt';

const DAY = 86_400_000;

test('3번째 방문에 한 번 묻고, 후기 남겼으면 다시 안 묻는다', () => {
  assert.equal(shouldAskReview({ ...INITIAL_REVIEW_STATE, visits: 2 }), false);
  const third = { ...INITIAL_REVIEW_STATE, visits: 3 };
  assert.equal(shouldAskReview(third), true);
  const asked = markAsked(third, 1000);
  assert.equal(shouldAskReview({ ...asked, visits: 4 }, 2000), false); // 답 없이 닫음 → 같은 세션류 재질문 없음
  assert.equal(shouldAskReview({ ...asked, status: 'done', visits: 99 }, 2000 + 30 * DAY), false);
});

test("'나중에'는 7일 뒤 다시, 최대 3회", () => {
  const later = { ...markAsked({ ...INITIAL_REVIEW_STATE, visits: 3 }, 0), status: 'later' as const };
  assert.equal(shouldAskReview({ ...later, visits: 5 }, 6 * DAY), false);
  assert.equal(shouldAskReview({ ...later, visits: 5 }, 7 * DAY), true);
  assert.equal(shouldAskReview({ ...later, asks: 3, visits: 20 }, 30 * DAY), false);
});

test('UA 플랫폼 판정과 스토어 URL 판정', () => {
  assert.equal(storePlatformFromUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios');
  assert.equal(storePlatformFromUa('Mozilla/5.0 (Linux; Android 14) ARVOTCG-App'), 'android');
  assert.equal(storePlatformFromUa('Mozilla/5.0 (Windows NT 10.0)'), null);
  assert.equal(isStoreUrl('https://play.google.com/store/apps/details?id=com.arvotcg.app'), true);
  assert.equal(isStoreUrl('https://apps.apple.com/kr/app/id6799868587?action=write-review'), true);
  assert.equal(isStoreUrl('https://www.arvotcg.com/event/cardshow'), false);
});
