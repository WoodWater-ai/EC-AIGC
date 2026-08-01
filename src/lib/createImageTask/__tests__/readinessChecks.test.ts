import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeReadinessChecks, type ReadinessDeps } from '../readinessChecks';

const base: ReadinessDeps = {
  isProductBound: true,
  promptsComplete: true,
  executionParamsReady: true,
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

test('prompts incomplete → check #2 incomplete; targetId=image-content-section', () => {
  const checks = computeReadinessChecks({ ...base, promptsComplete: false });
  assert.equal(checks[1].complete, false);
  assert.equal(checks[1].targetId, 'image-content-section');
});

test('execution params incomplete → check #3 incomplete; targetId=image-settings-section', () => {
  const checks = computeReadinessChecks({ ...base, executionParamsReady: false });
  assert.equal(checks[2].complete, false);
  assert.equal(checks[2].targetId, 'image-settings-section');
});

test('isSupported=false OR maintenance → check #4 incomplete; targetId=image-settings-section', () => {
  const a = computeReadinessChecks({ ...base, isSupported: false });
  const b = computeReadinessChecks({ ...base, channelMaintenance: true });
  assert.equal(a[3].complete, false);
  assert.equal(b[3].complete, false);
  assert.equal(a[3].targetId, 'image-settings-section');
});

test('order is fixed: 1素材 2Prompt 3执行参数 4规格', () => {
  const checks = computeReadinessChecks({ ...base });
  assert.equal(checks[0].id, 1);
  assert.equal(checks[1].id, 2);
  assert.equal(checks[2].id, 3);
  assert.equal(checks[3].id, 4);
});
