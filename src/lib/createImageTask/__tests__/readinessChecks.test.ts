import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeReadinessChecks, type ReadinessDeps } from '../readinessChecks';

const base: ReadinessDeps = {
  isProductBound: true,
  factsConfirmed: true,
  factsComplete: true,
  promptsConfirmed: true,
  promptsComplete: true,
  isSupported: true,
  channelMaintenance: false,
};

test('all true → 4 checks complete', () => {
  const checks = computeReadinessChecks(base);
  assert.equal(checks.length, 4);
  assert.ok(checks.every((c) => c.complete));
  assert.equal(checks.filter((c) => c.complete).length, 4);
});

test('isProductBound=false → check #1 incomplete; targetId=image-source-section', () => {
  const checks = computeReadinessChecks({ ...base, isProductBound: false });
  assert.equal(checks[0].complete, false);
  assert.equal(checks[0].targetId, 'image-source-section');
  assert.equal(checks[1].complete, true);
});

test('facts incomplete → check #2 incomplete; targetId=image-content-section', () => {
  const checks = computeReadinessChecks({ ...base, factsComplete: false });
  assert.equal(checks[1].complete, false);
  assert.equal(checks[1].targetId, 'image-content-section');
});

test('facts not confirmed → check #2 incomplete', () => {
  const checks = computeReadinessChecks({ ...base, factsConfirmed: false });
  assert.equal(checks[1].complete, false);
});

test('prompts incomplete OR not confirmed → check #3 incomplete; targetId=image-content-section', () => {
  const a = computeReadinessChecks({ ...base, promptsComplete: false });
  const b = computeReadinessChecks({ ...base, promptsConfirmed: false });
  assert.equal(a[2].complete, false);
  assert.equal(b[2].complete, false);
  assert.equal(a[2].targetId, 'image-content-section');
});

test('isSupported=false OR maintenance → check #4 incomplete; targetId=image-settings-section', () => {
  const a = computeReadinessChecks({ ...base, isSupported: false });
  const b = computeReadinessChecks({ ...base, channelMaintenance: true });
  assert.equal(a[3].complete, false);
  assert.equal(b[3].complete, false);
  assert.equal(a[3].targetId, 'image-settings-section');
});

test('order is fixed: 1素材 2事实 3Prompt 4规格', () => {
  const checks = computeReadinessChecks({ ...base });
  assert.equal(checks[0].id, 1);
  assert.equal(checks[1].id, 2);
  assert.equal(checks[2].id, 3);
  assert.equal(checks[3].id, 4);
});
