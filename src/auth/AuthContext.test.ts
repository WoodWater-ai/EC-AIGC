import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractBootstrapInputs } from './AuthContext';

test('extractBootstrapInputs URL ?token=xxx → urlToken=xxx, storedToken=null', () => {
  const fakeLocation = {
    href: 'https://app.example.com/tasks?token=eyJxxx',
    search: '?token=eyJxxx',
  } as unknown as Location;
  const result = extractBootstrapInputs(
    fakeLocation,
    null, // localStorage 无
  );
  assert.equal(result.urlToken, 'eyJxxx');
  assert.equal(result.tokenToUse, 'eyJxxx');
  assert.equal(result.shouldEnterEmbedMode, true);
});

test('extractBootstrapInputs URL 无 token 但 localStorage 有 → storedToken', () => {
  const fakeLocation = {
    href: 'https://app.example.com/dashboard',
    search: '',
  } as unknown as Location;
  const result = extractBootstrapInputs(fakeLocation, 'stored-xxx');
  assert.equal(result.urlToken, null);
  assert.equal(result.tokenToUse, 'stored-xxx');
  assert.equal(result.shouldEnterEmbedMode, false);
});

test('extractBootstrapInputs 两者皆无 → tokenToUse=null', () => {
  const fakeLocation = {
    href: 'https://app.example.com/',
    search: '',
  } as unknown as Location;
  const result = extractBootstrapInputs(fakeLocation, null);
  assert.equal(result.tokenToUse, null);
});

test('extractBootstrapInputs URL 多参数(token + 业务参数)→ 仅取 token,其他保留', () => {
  const fakeLocation = {
    href: 'https://app.example.com/tasks?token=eyJxxx&highlightGroupId=42',
    search: '?token=eyJxxx&highlightGroupId=42',
  } as unknown as Location;
  const result = extractBootstrapInputs(fakeLocation, null);
  assert.equal(result.urlToken, 'eyJxxx');
  assert.equal(result.tokenToUse, 'eyJxxx');
  assert.equal(result.shouldEnterEmbedMode, true);
  assert.deepEqual(result.otherSearchEntries, [['highlightGroupId', '42']]);
});
