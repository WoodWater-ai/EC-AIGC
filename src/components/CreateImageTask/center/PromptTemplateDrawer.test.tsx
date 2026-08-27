import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CreationTemplate } from '../../../api/modules/creationTemplate';
import {
  PromptTemplateDrawer,
  templatesForWorkspaceType,
} from './PromptTemplateDrawer';

const template = (id: string, name: string, imageType: string): CreationTemplate => ({
  id,
  templateName: name,
  mediaType: 'IMAGE',
  coverUrl: `/templates/${id}.jpg`,
  status: 'PUBLISHED',
  visibility: 'ORG',
  currentVersionId: `${id}-v1`,
  version: '1',
  usageCount: 0,
  viewCount: 0,
  favoriteCount: 0,
  favorited: false,
  imageType,
});

const templates = [
  template('main', '纯色棚拍主图', 'PRODUCT_MAIN'),
  template('scene', '卧室场景', 'SCENE_DETAIL'),
  template('detail', '面料微距', 'DETAIL_CLOSEUP'),
  template('triple', '模特三视图', 'MODEL_TRIPLE_VIEW'),
];

test('template drawer merges main and scene templates in scene main category', () => {
  assert.deepEqual(
    templatesForWorkspaceType(templates, 'scene_detail').map((item) => item.id),
    ['main', 'scene'],
  );
  assert.deepEqual(
    templatesForWorkspaceType(templates, 'detail_closeup').map((item) => item.id),
    ['detail'],
  );
});

test('template drawer renders only templates for the active workspace tab', () => {
  const html = renderToStaticMarkup(React.createElement(PromptTemplateDrawer, {
    activeType: 'scene_detail',
    templates,
    loading: false,
    applyingId: null,
    onSelect: () => undefined,
    onClose: () => undefined,
  }));

  assert.match(html, /场景主图模板/);
  assert.match(html, /纯色棚拍主图/);
  assert.match(html, /卧室场景/);
  assert.doesNotMatch(html, /面料微距/);
  assert.doesNotMatch(html, /模特三视图/);
});
