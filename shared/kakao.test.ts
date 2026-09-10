import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flexShareUrl, intentToScheme } from './kakao';

test('안드로이드 intent URL → 커스텀 스킴 + 패키지', () => {
  const r = intentToScheme('intent://send?linkver=4.0&appkey=abc#Intent;scheme=kakaolink;package=com.kakao.talk;end');
  assert.equal(r.url, 'kakaolink://send?linkver=4.0&appkey=abc');
  assert.equal(r.package, 'com.kakao.talk');
  assert.deepEqual(intentToScheme('kakaotalk://x'), { url: 'kakaotalk://x', package: null });
});

test('공유 링크는 token/embed 쿼리 없는 공개 URL', () => {
  assert.equal(flexShareUrl('/flex/12.abc'), 'https://www.arvotcg.com/flex/12.abc');
});
