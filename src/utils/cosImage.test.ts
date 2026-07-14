import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withCosThumbnail } from './cosImage';

test('空 url 返回 undefined', () => {
  assert.equal(withCosThumbnail(undefined), undefined);
  assert.equal(withCosThumbnail(null), undefined);
  assert.equal(withCosThumbnail(''), undefined);
});

test('普通 url 加默认 maxWidth=400 参数', () => {
  assert.equal(
    withCosThumbnail('https://cdn.example.com/a.jpg'),
    'https://cdn.example.com/a.jpg?imageMogr2/thumbnail/400x>',
  );
});

test('自定义 maxWidth 生效', () => {
  assert.equal(
    withCosThumbnail('https://cdn.example.com/a.jpg', 800),
    'https://cdn.example.com/a.jpg?imageMogr2/thumbnail/800x>',
  );
});

test('已有 imageMogr2 不重复添加', () => {
  const processed = 'https://cdn.example.com/a.jpg?imageMogr2/thumbnail/200x>';
  assert.equal(withCosThumbnail(processed), processed);
  assert.equal(withCosThumbnail(processed, 800), processed);
});

test('URL 已含其他 query 时用 & 拼', () => {
  assert.equal(
    withCosThumbnail('https://cdn.example.com/a.jpg?version=1'),
    'https://cdn.example.com/a.jpg?version=1&imageMogr2/thumbnail/400x>',
  );
});
