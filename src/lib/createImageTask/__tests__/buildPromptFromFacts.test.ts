import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPromptFromFacts } from '../buildPromptFromFacts';

const facts = {
  name: '法式针织衫',
  sellingPoints: '柔软透气',
  category: '户外服饰',
  color: '米白',
  patternAndMaterial: '羊毛',
  structure: '修身',
};

test('按 Profile 输出完整区块并按参考图顺序编号', () => {
  const out = buildPromptFromFacts(
    'product_main', facts, '甜美网红风', '自然影棚', '自然站姿', ['style', 'scene', 'pose'],
  );
  const idx = (value: string) => out.indexOf(value);
  assert.ok(idx('【任务目标】') < idx('【参考图绑定】'));
  assert.ok(idx('【参考图绑定】') < idx('【视觉参数】'));
  assert.ok(idx('【视觉参数】') < idx('【商品事实与保真】'));
  assert.ok(idx('【商品事实与保真】') < idx('【用户创意补充】'));
  assert.ok(out.includes('图1为商品主体'));
  assert.ok(out.includes('图2为风格参考'));
  assert.ok(out.includes('图3为场景参考'));
  assert.ok(out.includes('图4为姿势或构图参考'));
  assert.ok(out.includes('主体为“法式针织衫”'));
  assert.ok(out.includes('摄影风格：甜美网红风，并以图2为参考'));
  assert.ok(out.includes('场景：自然影棚，并以图3为参考'));
  assert.ok(out.includes('姿势或构图：自然站姿，并以图4为参考'));
});

test('未填写视觉参数时仍输出商品事实与默认约束', () => {
  const out = buildPromptFromFacts('scene_detail', facts, '', '', '', []);
  assert.ok(out.includes('商品为画面中心'));
  assert.ok(out.includes('核心卖点：柔软透气'));
  assert.ok(out.includes('场景：符合商品使用逻辑的低干扰场景'));
  assert.ok(out.includes('不得新增未提供的商品、文字、Logo 或配饰'));
});

test('细节图使用商品事实生成 detail_focus', () => {
  const out = buildPromptFromFacts('detail_closeup', facts, '', '', '', ['detail']);
  assert.ok(out.includes('微距聚焦柔软透气'));
  assert.ok(out.includes('图2为细节参考'));
});

test('模特三视图使用预制镜头句和动态模特绑定', () => {
  const out = buildPromptFromFacts('model_triple_view', facts, '', '', '', ['model', 'scene']);
  assert.ok(out.includes('相同人物、光线和机位展示正面、侧面、背面'));
  assert.ok(out.includes('图2为模特参考'));
  assert.ok(out.includes('图3为场景参考'));
  assert.ok(!out.includes('图4'));
});

test('用户创意补充写入独立区块', () => {
  const out = buildPromptFromFacts('product_main', facts, '', '', '', [], '增加节日氛围');
  assert.ok(out.endsWith('增加节日氛围'));
});

test('商品名为空时返回空字符串', () => {
  const empty = { name: '', sellingPoints: '', category: '', color: '', patternAndMaterial: '', structure: '' };
  assert.equal(buildPromptFromFacts('product_main', empty, '', '', '', []), '');
});
