import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADMOB_APP_ID, ADMOB_BANNER_UNIT, ADMOB_TEST,
  adsReadyForRelease, appIdFor, bannerUnitId, isValidAppId, isValidUnitId,
} from './ads';

test('앱 ID 와 광고 단위 ID 형식을 구분한다 — 물결표 vs 슬래시', () => {
  assert.equal(isValidAppId('ca-app-pub-8606099213555265~3547581465'), true);
  assert.equal(isValidUnitId('ca-app-pub-8606099213555265/8371572277'), true);
  // 서로 바꿔 넣는 실수를 잡는다.
  assert.equal(isValidAppId('ca-app-pub-8606099213555265/8371572277'), false);
  assert.equal(isValidUnitId('ca-app-pub-8606099213555265~3547581465'), false);
  assert.equal(isValidAppId(null), false);
  assert.equal(isValidUnitId(''), false);
});

test('발급받은 값이 형식에 맞는다', () => {
  assert.equal(isValidUnitId(ADMOB_BANNER_UNIT.android), true);
  assert.equal(isValidUnitId(ADMOB_BANNER_UNIT.ios), true);
  assert.equal(isValidAppId(ADMOB_APP_ID.ios), true);
});

test('개발 빌드는 항상 테스트 단위를 쓴다', () => {
  assert.equal(bannerUnitId('android', true), ADMOB_TEST.banner.android);
  assert.equal(bannerUnitId('ios', true), ADMOB_TEST.banner.ios);
});

test('배포 빌드는 발급받은 단위를 쓴다', () => {
  assert.equal(bannerUnitId('android', false), ADMOB_BANNER_UNIT.android);
  assert.equal(bannerUnitId('ios', false), ADMOB_BANNER_UNIT.ios);
});

test('앱 ID 미발급 플랫폼은 테스트 앱 ID 로 떨어진다', () => {
  assert.equal(appIdFor('ios'), ADMOB_APP_ID.ios);
  // 안드로이드 앱 ID 가 들어오면 이 단언이 깨진다 — 그때 이 테스트를 지우면 된다.
  assert.equal(appIdFor('android'), ADMOB_TEST.appId);
  assert.equal(adsReadyForRelease('android'), false);
  assert.equal(adsReadyForRelease('ios'), true);
});
