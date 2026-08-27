import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromptWorkspace } from './PromptWorkspace';

test('prompt workspace renders three tabs and only the active prompt editor', () => {
  const html = renderToStaticMarkup(React.createElement(PromptWorkspace, {
    activeType: 'scene_detail',
    defaultPrompts: {
      product_main: '旧主图 Prompt',
      scene_detail: '暖调窗边场景',
      detail_closeup: '细节图 Prompt',
      model_triple_view: '三视图 Prompt',
    },
    promptOverrides: {},
    negativePromptOverrides: {},
    referenceGroups: [['model', 'pose'], ['scene'], ['detail']],
    isProductBound: true,
    onActiveTypeChange: () => undefined,
    onChangePromptOverride: () => undefined,
    onRestorePrompt: () => undefined,
    onChangeNegativePrompt: () => undefined,
    onRestoreNegativePrompt: () => undefined,
    onOpenTemplates: () => undefined,
    tagSelector: React.createElement('div', null, '标签控件'),
    executionSettings: React.createElement('div', null, '执行参数控件'),
  }));

  assert.match(html, /场景主图/);
  assert.match(html, /细节图/);
  assert.match(html, /三视图/);
  assert.match(html, /aria-label="场景主图正面提示词"/);
  assert.match(html, /正面提示词/);
  assert.match(html, /min-h-\[270px\]/);
  assert.match(html, /min-h-\[52px\]/);
  assert.match(html, /主图参考/);
  assert.match(html, /模特参考/);
  assert.match(html, /姿势参考/);
  assert.match(html, /场景参考/);
  assert.match(html, /细节参考/);
  assert.match(html, /图1/);
  assert.match(html, /图2/);
  assert.match(html, /图3/);
  assert.match(html, /图4/);
  assert.match(html, /负面提示词/);
  assert.match(html, /恢复默认负面提示词/);
  assert.doesNotMatch(html, />参考图绑定</);
  assert.doesNotMatch(html, />创作标签</);
  assert.doesNotMatch(html, />执行参数</);
  assert.match(html, /模板/);
  assert.match(html, /标签控件/);
  assert.match(html, /执行参数控件/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /加入生成|取消生成/);
  assert.doesNotMatch(html, /overflow-x-auto/);
  assert.doesNotMatch(html, /细节图 Prompt<\/textarea>/);
  assert.doesNotMatch(html, /按表单重算/);
  assert.doesNotMatch(html, /像对话输入框/);
});

test('prompt workspace shows restore action only for a manually edited prompt', () => {
  const baseProps = {
    activeType: 'detail_closeup' as const,
    defaultPrompts: {
      product_main: '',
      scene_detail: '',
      detail_closeup: '默认细节',
      model_triple_view: '',
    },
    isProductBound: true,
    negativePromptOverrides: {},
    referenceGroups: [],
    onActiveTypeChange: () => undefined,
    onChangePromptOverride: () => undefined,
    onRestorePrompt: () => undefined,
    onChangeNegativePrompt: () => undefined,
    onRestoreNegativePrompt: () => undefined,
    onOpenTemplates: () => undefined,
    tagSelector: null,
    executionSettings: null,
  };

  const cleanHtml = renderToStaticMarkup(React.createElement(PromptWorkspace, {
    ...baseProps,
    promptOverrides: {},
  }));
  const editedHtml = renderToStaticMarkup(React.createElement(PromptWorkspace, {
    ...baseProps,
    promptOverrides: { detail_closeup: '手工细节' },
  }));

  assert.doesNotMatch(cleanHtml, /恢复默认正面提示词/);
  assert.match(editedHtml, /恢复默认正面提示词/);
  assert.match(editedHtml, /手工细节/);
});
