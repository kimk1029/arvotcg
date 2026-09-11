import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instagramHandle, naverMapRouteUrl, tmapRouteUrl } from './shopLinks';

test('인스타그램 입력 정규화 — @핸들 / 핸들 / URL', () => {
  assert.equal(instagramHandle('@poke_lab'), 'poke_lab');
  assert.equal(instagramHandle('poke_lab'), 'poke_lab');
  assert.equal(instagramHandle('https://www.instagram.com/poke_lab/?hl=ko'), 'poke_lab');
  assert.equal(instagramHandle('instagram.com/poke.lab/'), 'poke.lab');
  assert.equal(instagramHandle(''), null);
  assert.equal(instagramHandle('has space'), null);
});

test('길안내 스킴 — 좌표·이름 인코딩', () => {
  const t = { lat: 37.5433, lng: 127.0512, name: '포켓랩 성수점' };
  assert.equal(naverMapRouteUrl(t), 'nmap://route/car?dlat=37.5433&dlng=127.0512&dname=%ED%8F%AC%EC%BC%93%EB%9E%A9%20%EC%84%B1%EC%88%98%EC%A0%90&appname=com.arvotcg.app');
  assert.equal(tmapRouteUrl(t), 'tmap://route?goalx=127.0512&goaly=37.5433&goalname=%ED%8F%AC%EC%BC%93%EB%9E%A9%20%EC%84%B1%EC%88%98%EC%A0%90');
});
