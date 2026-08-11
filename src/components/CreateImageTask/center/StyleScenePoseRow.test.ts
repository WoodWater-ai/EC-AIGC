import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DictOption } from '../../../api/modules/dict';
import { StyleScenePoseRow } from './StyleScenePoseRow';

const option = (value: string, label: string): DictOption => ({
  id: value,
  value,
  label,
});

test('defaults style scene and pose to not set', () => {
  const html = renderToStaticMarkup(React.createElement(StyleScenePoseRow, {
    styleOptions: [option('STYLE_1', '风格一')],
    sceneOptions: [option('SCENE_1', '场景一')],
    poseOptions: [option('POSE_1', '姿势一')],
    style: '',
    scene: '',
    pose: '',
    onStyleChange: () => undefined,
    onSceneChange: () => undefined,
    onPoseChange: () => undefined,
  }));

  assert.equal((html.match(/不设置/g) ?? []).length, 3);
  assert.doesNotMatch(html, /请选择/);
});
