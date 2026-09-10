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

test('두 플랫폼 모두 실제 앱 ID — 배포 준비 판정 통과 (2026-09-11 안드로이드 앱 ID 발급)', () => {
  assert.equal(appIdFor('ios'), ADMOB_APP_ID.ios);
  assert.equal(appIdFor('android'), ADMOB_APP_ID.android);
  assert.equal(adsReadyForRelease('android'), true);
  assert.equal(adsReadyForRelease('ios'), true);
});

test('배포 빌드는 실제 단위, 앱 ID 가 빠지면 테스트 단위로 떨어진다', () => {
  // AdBanner 가 쓰는 조건: __DEV__ || !adsReadyForRelease(platform)
  const useTest = (p: 'android' | 'ios') => !adsReadyForRelease(p);
  assert.equal(useTest('android'), false);
  assert.equal(bannerUnitId('android', useTest('android')), ADMOB_BANNER_UNIT.android);
  assert.equal(useTest('ios'), false);
  assert.equal(bannerUnitId('ios', useTest('ios')), ADMOB_BANNER_UNIT.ios);
  // 형식이 깨진 앱 ID 는 준비 실패로 본다 — 테스트 값이 실수로 남는 경우.
  assert.equal(isValidAppId('ca-app-pub-3940256099942544~3347511713'), true);
  assert.equal(isValidAppId('ca-app-pub-8606099213555265/7191313009'), false);
});
