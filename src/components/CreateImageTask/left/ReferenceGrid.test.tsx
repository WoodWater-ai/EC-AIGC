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

const ALL_SLOTS: ReferenceSlot[] = ['model', 'detail', 'style', 'scene', 'pose'];

test('empty state: single + placeholder, no slot-specific labels', () => {
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [],
    ...emptyCallbacks(),
  }));

  // 单 + 卡
  assert.match(html, /添加参考/);
  assert.match(html, /<svg[^>]*lucide-plus/);

  // 不再有 3 卡文案
  assert.doesNotMatch(html, /添加模特参考/);
  assert.doesNotMatch(html, /添加细节参考/);
  assert.doesNotMatch(html, /添加风格参考/);

  // 0/5 计数
  assert.match(html, /0\s*\/\s*5/);
});

test('one slot occupied: trailing + card rendered', () => {
  const ref = makeRef('r1', '图一');
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [{ slot: 'detail', ref }],
    ...emptyCallbacks(),
  }));

  assert.match(html, /图一/);
  assert.match(html, /添加参考/);
  assert.match(html, /1\s*\/\s*5/);
});

test('all 5 slots occupied: trailing + card not rendered', () => {
  const orderedRefs = ALL_SLOTS.map((slot, i) => ({
    slot,
    ref: makeRef(`r${i}`, `图${i}`),
  }));
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs,
    ...emptyCallbacks(),
  }));

  assert.match(html, /5\s*\/\s*5/);
  const plusMatches = html.match(/<svg[^>]*lucide-plus/g) ?? [];
  assert.equal(plusMatches.length, 0, `+ icon should not render when slots full, got ${plusMatches.length}`);
});

test('same image covering all 5 slots: trailing + card not rendered', () => {
  const sameRef = makeRef('r0', '同一图');
  const orderedRefs = ALL_SLOTS.map((slot) => ({ slot, ref: sameRef }));
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs,
    ...emptyCallbacks(),
  }));

  const plusMatches = html.match(/<svg[^>]*lucide-plus/g) ?? [];
  assert.equal(plusMatches.length, 0, '+ icon should not render when slots fully covered');
  // 5 个 role 标签都显示在该图下方
  assert.match(html, /模特/);
  assert.match(html, /细节/);
  assert.match(html, /风格/);
  assert.match(html, /场景/);
  assert.match(html, /姿势/);
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

test('reference image fits inside container via object-contain (no cover crop)', () => {
  const ref = makeRef('r1', '图一');
  const html = renderToStaticMarkup(React.createElement(ReferenceGrid, {
    orderedRefs: [{ slot: 'detail', ref }],
    ...emptyCallbacks(),
  }));

  // 容器 div 含 flex + items-center + justify-center (居中)
  assert.match(html, /class="relative aspect-\[4\/3\][^"]*flex items-center justify-center/);
  // img 使用 object-contain + max-h-full + max-w-full (contain 适配,不裁切)
  // 不依赖 className 内部 Tailwind 排序,任一关键字存在即可
  assert.match(html, /class="[^"]*object-contain[^"]*"/);
  assert.match(html, /class="[^"]*max-h-full[^"]*"/);
  assert.match(html, /class="[^"]*max-w-full[^"]*"/);
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
      { slot: 'style', ref: refB }, // refB 当前占 style,detail 由 refA 占
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
