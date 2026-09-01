import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialPromptDefaults,
  derivePromptTypes,
  getEffectiveNegativePrompt,
  getEffectivePrompt,
  PROMPT_WORKSPACE_TYPES,
  toPromptWorkspaceType,
} from '../promptWorkspace';

test('prompt workspace exposes scene main, detail, triple view and product detail', () => {
  assert.deepEqual(PROMPT_WORKSPACE_TYPES, [
    'scene_detail',
    'detail_closeup',
    'model_triple_view',
    'product_detail',
  ]);
});

test('prompt workspace merges legacy product main and scene templates', () => {
  assert.equal(toPromptWorkspaceType('PRODUCT_MAIN'), 'scene_detail');
  assert.equal(toPromptWorkspaceType('product_main'), 'scene_detail');
  assert.equal(toPromptWorkspaceType('SCENE_DETAIL'), 'scene_detail');
  assert.equal(toPromptWorkspaceType('DETAIL_SCENE'), 'scene_detail');
});

test('prompt workspace keeps detail and triple-view template categories', () => {
  assert.equal(toPromptWorkspaceType('DETAIL_CLOSEUP'), 'detail_closeup');
  assert.equal(toPromptWorkspaceType('DETAIL'), 'detail_closeup');
  assert.equal(toPromptWorkspaceType('MODEL_TRIPLE_VIEW'), 'model_triple_view');
  assert.equal(toPromptWorkspaceType('ON_MODEL'), 'model_triple_view');
  assert.equal(toPromptWorkspaceType('PRODUCT_DETAIL'), 'product_detail');
  assert.equal(toPromptWorkspaceType('UNKNOWN'), null);
});

test('effective prompt prefers an explicit override including an empty value', () => {
  const defaults = {
    product_main: '',
    scene_detail: '默认场景主图',
    detail_closeup: '默认细节图',
    model_triple_view: '',
    product_detail: '',
  };

  assert.equal(getEffectivePrompt('scene_detail', defaults, {}), '默认场景主图');
  assert.equal(getEffectivePrompt('detail_closeup', defaults, { detail_closeup: '' }), '');
});

test('negative prompts are independent per image type and retain the base default', () => {
  assert.equal(getEffectiveNegativePrompt('scene_detail', {}), 'blurry, bad quality, distorted');
  assert.equal(getEffectiveNegativePrompt('detail_closeup', {
    detail_closeup: 'fabric hallucination, missing stitching',
  }), 'fabric hallucination, missing stitching');
});

test('prompt types are derived only from non-empty designer instructions in workspace order', () => {
  const defaults = {
    product_main: '旧商品主图不参与新工作区',
    scene_detail: '场景主图 Prompt',
    detail_closeup: '',
    model_triple_view: '   ',
    product_detail: '',
  };

  assert.deepEqual(derivePromptTypes(defaults, {
    detail_closeup: '细节图 Prompt',
    scene_detail: '  ',
  }), ['detail_closeup']);
});

test('a new task starts with empty designer instructions', () => {
  assert.deepEqual(createInitialPromptDefaults(), {
    product_main: '',
    scene_detail: '',
    detail_closeup: '',
    model_triple_view: '',
    product_detail: '',
  });
});
