import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReferenceSlot } from '../../../lib/createImageTask/extractReferenceInsights';
import type { ReferenceAsset } from '../../../lib/createImageTask/imageCreationUi';
import { ReferenceGrid } from './ReferenceGrid';

const makeRef = (id: string, name: string): ReferenceAsset => ({
  id,
  fileResourceId: id,
  originalUrl: `https://example.com/${id}.jpg`,
  thumbnailUrl: `https://example.com/${id}-thumb.jpg`,
  name,
});

const emptyCallbacks = () => ({
  openSlotPicker: () => undefined,
  onRolesChange: () => undefined,
  onRemove: () => undefined,
  onForceOpenConsumed: () => undefined,
});

const ALL_SLOTS: ReferenceSlot[] = ['model', 'pose', 'scene', 'detail'];

test('empty state: model and common libraries render vertically with separate entries', () => {
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [],
    ...emptyCallbacks(),
  }));

  assert.match(html, /模特库/);
  assert.match(html, /通用素材库/);
  assert.match(html, /添加模特/);
  assert.match(html, /添加场景 \/ 细节/);
  assert.doesNotMatch(html, /标签会随任务提交同步到素材中心/);
  assert.doesNotMatch(html, /选择人物形象或姿势参考/);
  assert.doesNotMatch(html, /风格/);
  assert.match(html, /0\s*\/\s*4/);
});

test('one common reference renders in common library and keeps other entries available', () => {
  const ref = makeRef('r1', '图一');
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [{ slot: 'detail', ref }],
    ...emptyCallbacks(),
  }));

  assert.match(html, /图一/);
  assert.match(html, /添加模特/);
  assert.match(html, /添加场景 \/ 细节/);
  assert.match(html, /1\s*\/\s*4/);
  assert.doesNotMatch(html, /每张图片至少选择一个标签/);
  assert.match(html, /grid-cols-1/);
});

test('all 4 roles occupied: both library add entries are disabled', () => {
  const orderedRefs = ALL_SLOTS.map((slot, i) => ({
    slot,
    ref: makeRef(`r${i}`, `图${i}`),
  }));
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs,
    ...emptyCallbacks(),
  }));

  assert.match(html, /4\s*\/\s*4/);
  const disabledMatches = html.match(/<button[^>]*disabled=""/g) ?? [];
  assert.equal(disabledMatches.length, 2, 'each library add entry should be disabled when its roles are occupied');
});

test('same image covering all 4 roles: all labels remain visible without style', () => {
  const sameRef = makeRef('r0', '同一图');
  const orderedRefs = ALL_SLOTS.map((slot) => ({ slot, ref: sameRef }));
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs,
    ...emptyCallbacks(),
  }));

  assert.match(html, /1\s*\/\s*4/);
  const disabledMatches = html.match(/<button[^>]*disabled=""/g) ?? [];
  assert.equal(disabledMatches.length, 2);
  assert.match(html, /模特/);
  assert.match(html, /细节/);
  assert.match(html, /场景/);
  assert.match(html, /姿势/);
  assert.doesNotMatch(html, /风格/);
});

test('forceOpenRoleKey matches a reference: its RolePicker open by default', () => {
  const ref = makeRef('r1', '图一');
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [{ slot: 'detail', ref }],
    forceOpenRoleKey: 'r1',
    ...emptyCallbacks(),
  }));

  assert.match(html, /role="listbox"/);
  // 第 1 张参考图,显示 = 图 2(主体素材占图 1)
  assert.match(html, /图 2 标签/);
  // 图片角标同样从图 2 开始
  assert.match(html, />\s*图 2\s*</);
});

test('reference image uses a large high-quality preview without cover crop', () => {
  const ref = makeRef('r1', '图一');
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [{ slot: 'detail', ref }],
    ...emptyCallbacks(),
  }));

  // 容器 div 含 flex + items-center + justify-center (居中)
  assert.match(html, /class="relative aspect-\[4\/3\][^"]*flex items-center justify-center/);
  // 原图优先，并请求适合大卡片和高分屏的 960px COS 预览。
  assert.match(html, /r1\.jpg\?imageMogr2\/thumbnail\/960x/);
  assert.doesNotMatch(html, /r1-thumb\.jpg\?imageMogr2\/thumbnail\/960x/);
  assert.match(html, /class="[^"]*object-contain[^"]*"/);
  // img 不再使用 object-cover (防回滚)
  assert.doesNotMatch(html, /object-cover/);
});

test('without forceOpenRoleKey: RolePicker default closed', () => {
  const ref = makeRef('r1', '图一');
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [{ slot: 'detail', ref }],
    ...emptyCallbacks(),
  }));

  // 关闭时 listbox 不渲染
  assert.doesNotMatch(html, /role="listbox"/);
});

test('occupiedByAnother: refB sees detail as disabled when refA already owns it', () => {
  // refA 占 detail, refB 当前不占 detail。强制打开 refB 的 RolePicker,
  // 断言 refB 的 listbox 中 detail 项渲染 disabled + tooltip 文案。
  const refA = makeRef('a', '图A');
  const refB = makeRef('b', '图B');
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [
      { slot: 'detail', ref: refA },
      { slot: 'scene', ref: refB }, // refB 当前占 scene,detail 由 refA 占
    ],
    forceOpenRoleKey: 'b', // refB 的 RolePicker 强制打开
    ...emptyCallbacks(),
  }));

  // refB 的 listbox 渲染(refB 是第 2 张参考图,显示 = 图 3)
  assert.match(html, /图 3 标签/);

  // refB 的 listbox 中,detail 行(非 active)应 disabled + 灰显 className
  // 关键断言:HTML 中存在 disabled 属性 + title="已被图 2 占用"(refA 是第 1 张参考图,显示 = 图 2)
  assert.match(html, /disabled=""[^>]*title="已被图 2 占用/);
  // 不再有 "选择后将自动转移"(老文案已淘汰)
  assert.doesNotMatch(html, /选择后将自动转移/);
});

// 注:集成级用例(移除图触发 + 回归、移除 forceOpen 图清 key)需 userEvent + 重新 render,
// 当前项目仅 node:test + renderToStaticMarkup,后续若引入 vitest + RTL 再补。
