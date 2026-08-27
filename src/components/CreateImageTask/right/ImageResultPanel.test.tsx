import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImageResultPanel } from './ImageResultPanel';

test('loading placeholders include only types with non-empty prompts', () => {
  const html = renderToStaticMarkup(React.createElement(ImageResultPanel, {
    selectedTypes: ['detail_closeup'],
    typeCounts: {
      product_main: 1,
      scene_detail: 2,
      detail_closeup: 3,
      model_triple_view: 4,
    },
    totalCount: 3,
    params: {
      modelId: 'q3-fast',
      channelId: 'test',
      schemaParams: { aspect_ratio: '9:16', resolution: '1K' },
      executionParamsReady: true,
    },
    submitStatus: 'loading',
    submitGroups: [],
  }));

  assert.match(html, /细节图/);
  assert.doesNotMatch(html, /场景主图/);
  assert.doesNotMatch(html, /模特三视图/);
  assert.doesNotMatch(html, /商品主图/);
});

test('completed result keeps prompts beside images and exposes the continue-creation action', () => {
  const html = renderToStaticMarkup(React.createElement(ImageResultPanel, {
    selectedTypes: ['scene_detail'],
    typeCounts: {
      product_main: 1,
      scene_detail: 1,
      detail_closeup: 1,
      model_triple_view: 1,
    },
    totalCount: 1,
    params: {
      modelId: 'nano-banana',
      channelId: 'test',
      schemaParams: {},
      executionParamsReady: true,
    },
    submitStatus: 'done',
    submitGroups: [{
      imageType: 'SCENE_DETAIL',
      taskStatus: 'SUCCESS',
      count: 1,
      previews: [{ id: 'result-1', taskId: 'task-1', mediaType: 'IMAGE', url: 'https://cdn.example.com/result.png' }],
    }],
    taskId: 'task-1',
    initialPositivePrompt: '保留毛衣的针织纹理',
    initialNegativePrompt: '不要模糊面料',
    onContinueEditing: () => undefined,
  }));

  assert.match(html, /编辑本轮提示词/);
  assert.match(html, /aria-label="结果页正面提示词"/);
  assert.match(html, /保留毛衣的针织纹理/);
  assert.match(html, /不要模糊面料/);
  assert.match(html, />继续创作</);
  assert.match(html, /输出规格/);
  assert.match(html, /min-h-\[520px\]/);
  assert.match(html, /min-h-0 shrink-0 overflow-y-auto/);
  assert.doesNotMatch(html, />图片类型</);
  assert.doesNotMatch(html, />生成数量</);
  assert.doesNotMatch(html, /以此图继续创作/);
});
