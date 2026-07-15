import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SLOT_KEYS, SLOT_META } from './slots';

test('SLOT_KEYS has 7 keys in expected order', () => {
  assert.deepEqual([...SLOT_KEYS], [
    'main', 'top', 'bottom', 'detail', 'style', 'scene', 'pose',
  ]);
});

test('SLOT_META covers every SLOT_KEY', () => {
  for (const k of SLOT_KEYS) {
    assert.ok(SLOT_META[k], `missing SLOT_META entry for ${k}`);
    assert.equal(SLOT_META[k].key, k);
  }
});

test('SLOT_META labels are non-empty Chinese strings', () => {
  for (const k of SLOT_KEYS) {
    const label = SLOT_META[k].label;
    assert.ok(label && label.length > 0, `empty label for ${k}`);
    assert.ok(/[一-龥]/.test(label), `label for ${k} should contain CJK: ${label}`);
  }
});

test('SLOT_META multiSelect defaults to false', () => {
  for (const k of SLOT_KEYS) {
    assert.equal(SLOT_META[k].multiSelect, false, `${k} should default to multiSelect=false`);
  }
});

test('SLOT_META payloadField names follow {slot}FileResId convention', () => {
  const expected: Record<string, string> = {
    main: 'mainFileResId',
    top: 'topFileResId',
    bottom: 'bottomFileResId',
    detail: 'detailFileResId',
    style: 'styleFileResId',
    scene: 'sceneFileResId',
    pose: 'poseFileResId',
  };
  for (const k of SLOT_KEYS) {
    assert.equal(SLOT_META[k].payloadField, expected[k]);
  }
});
