import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import { PerTypePromptEditor } from './PerTypePromptEditor';

const allTypes: ImageGenerationType[] = [
  'product_main',
  'scene_detail',
  'detail_closeup',
  'model_triple_view',
  'product_detail',
];

test('renders one independent prompt editor for every selected image type', () => {
  const typeCounts = Object.fromEntries(allTypes.map((type) => [type, 1])) as Record<ImageGenerationType, number>;
  const defaultPrompts = Object.fromEntries(allTypes.map((type) => [type, `default-${type}`])) as Record<ImageGenerationType, string>;

  const html = renderToStaticMarkup(React.createElement(PerTypePromptEditor, {
    selectedTypes: allTypes,
    typeCounts,
    defaultPrompts,
    overrides: {},
    templateName: '默认模板',
    isProductBound: true,
    onChangeOverride: () => undefined,
    onRegenerateAll: () => undefined,
    onAiOptimizeSelected: () => undefined,
  }));

  assert.equal((html.match(/<textarea/g) ?? []).length, allTypes.length);
  allTypes.forEach((type) => assert.match(html, new RegExp(`default-${type}`)));
});
