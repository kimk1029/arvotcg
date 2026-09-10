import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNoticeTag, noticeDateLabel, sortNotices } from './notices';
// 검증 함수는 어드민만 쓰지만 규칙(날짜 형식·태그 화이트리스트)이 DB 계약이라 같이 지킨다.
import { parseNoticeInput } from '../admin/src/lib/notices';

test('목록은 고정글 먼저, 그 다음 발행일 최신순', () => {
  const rows = [
    { id: 1, pinned: false, publishedAt: '2026-05-01' },
    { id: 2, pinned: true, publishedAt: '2026-01-01' },
    { id: 3, pinned: false, publishedAt: '2026-09-01' },
  ];
  assert.deepEqual(sortNotices(rows).map((r) => r.id), [2, 3, 1]);
});

test('태그는 화이트리스트만 통과', () => {
  assert.equal(isNoticeTag('update'), true);
  assert.equal(isNoticeTag('공지'), false);
  assert.equal(isNoticeTag(null), false);
});

test('발행일 라벨은 점 구분', () => {
  assert.equal(noticeDateLabel('2026-04-20'), '2026.04.20');
});

test('신규 등록은 제목·발행일이 필수', () => {
  assert.equal(parseNoticeInput({ body: 'x' }, false).ok, false);
  assert.equal(parseNoticeInput({ title: '  ' , publishedAt: '2026-04-20' }, false).ok, false);
  assert.equal(parseNoticeInput({ title: '안내', publishedAt: '2026-4-20' }, false).ok, false);
  const ok = parseNoticeInput({ title: ' 안내 ', publishedAt: '2026-04-20', tag: '' }, false);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.ok && ok.data, { title: '안내', publishedAt: '2026-04-20', tag: null });
});

test('PATCH 는 누락 허용, 잘못된 태그는 거부', () => {
  assert.equal(parseNoticeInput({ pinned: true }, true).ok, true);
  assert.equal(parseNoticeInput({ tag: 'notice' }, true).ok, false);
  assert.equal(parseNoticeInput({ published: 'yes' }, true).ok, false);
});
