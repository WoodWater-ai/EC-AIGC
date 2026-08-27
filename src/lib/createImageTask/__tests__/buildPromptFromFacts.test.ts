import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildPromptFromFacts,
  DEFAULT_TYPE_REQUIREMENTS,
  parseReusablePrompt,
} from '../buildPromptFromFacts';

const facts = {
  name: '法式针织衫',
  sellingPoints: '柔软透气',
  category: '户外服饰',
  color: '米白',
  patternAndMaterial: '羊毛',
  structure: '修身',
};

test('输出精简区块并按参考图顺序编号', () => {
  const out = buildPromptFromFacts(
    'scene_detail', facts, '甜美网红风', '自然影棚', '自然站姿', ['style', 'scene', 'pose'],
    '增加节日氛围',
  );
  const idx = (value: string) => out.indexOf(value);
  assert.ok(idx('【图片类型要求】') < idx('【正面提示词】'));
  assert.ok(idx('【正面提示词】') < idx('【参考图绑定】'));
  assert.ok(idx('【参考图绑定】') < idx('【商品事实】'));
  assert.ok(idx('【商品事实】') < idx('【基础要求】'));
  assert.ok(out.includes('增加节日氛围'));
  assert.ok(out.includes('主图参考：图1'));
  assert.ok(out.includes('风格参考：图2'));
  assert.ok(out.includes('场景参考：图3'));
  assert.ok(out.includes('姿势参考：图4'));
  assert.ok(out.includes('创作标签：风格=甜美网红风；场景=自然影棚；姿势=自然站姿'));
  assert.doesNotMatch(out, /【视觉参数】|无额外补充|必须保持：/);
});

test('使用不可编辑的当前类型基础要求', () => {
  const out = buildPromptFromFacts('scene_detail', facts, '', '', '', [], '干净背景');
  assert.ok(out.includes('商品为画面中心'));
  assert.ok(out.includes(DEFAULT_TYPE_REQUIREMENTS.scene_detail));
});

test('细节图使用商品事实生成 detail_focus', () => {
  const out = buildPromptFromFacts('detail_closeup', facts, '', '', '', ['detail'], '突出针脚');
  assert.ok(out.includes('微距聚焦柔软透气'));
  assert.ok(out.includes('细节参考：图2'));
});

test('模特三视图使用预制镜头句和动态模特绑定', () => {
  const out = buildPromptFromFacts('model_triple_view', facts, '', '', '', ['model', 'scene'], '自然站立');
  assert.ok(out.includes('相同人物、光线和机位展示正面、侧面、背面'));
  assert.ok(out.includes('模特参考：图2'));
  assert.ok(out.includes('场景参考：图3'));
  assert.ok(!out.includes('图4'));
});

test('创意为空时不生成最终 Prompt', () => {
  assert.equal(buildPromptFromFacts('scene_detail', facts, '', '', '', []), '');
});

test('商品名为空时返回空字符串', () => {
  const empty = { name: '', sellingPoints: '', category: '', color: '', patternAndMaterial: '', structure: '' };
  assert.equal(buildPromptFromFacts('product_main', empty, '', '', '', []), '');
});

test('复用新 Prompt 时拆出正面和负面提示词', () => {
  const prompt = buildPromptFromFacts(
    'scene_detail', facts, '极简', '窗边', '自然站立', [], '暖调窗边场景',
  );
  const withNegative = `${prompt}\n\n【负面提示词】\n不要改变衣领结构。`;
  assert.deepEqual(parseReusablePrompt(withNegative), {
    designerInstruction: '暖调窗边场景',
    negativePrompt: '不要改变衣领结构。',
  });
});

test('旧 Prompt 优先提取用户创意，无法识别时保留原文', () => {
  const legacy = '【任务目标】\n旧规则\n\n【用户创意补充】\n增加雪景';
  assert.equal(parseReusablePrompt(legacy).designerInstruction, '增加雪景');
  assert.equal(parseReusablePrompt('自由模板原文').designerInstruction, '自由模板原文');
});
