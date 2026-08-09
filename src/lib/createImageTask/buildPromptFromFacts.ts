import type { ReferenceSlot } from './extractReferenceInsights';
import type { ProductFacts } from './extractProductFacts';
import type { ImageGenerationType } from './readinessChecks';

const TYPE_INSTRUCTIONS: Record<ImageGenerationType, string> = {
  product_main: '商品完整居中，背景低干扰，轮廓、材质和细节清晰可辨。',
  scene_detail: '商品为画面中心，场景仅服务于氛围、尺度和使用感。',
  detail_closeup: '微距聚焦商品材质、工艺与关键细节，背景干净虚化，细节必须可核验。',
  model_triple_view: '相同人物、光线和机位展示正面、侧面、背面；手部不得遮挡商品关键结构。',
};

const referenceBinding = (slots: ReferenceSlot[], imageNo: number): string => {
  const labels: Record<ReferenceSlot, string> = {
    detail: '细节',
    style: '风格',
    scene: '场景',
    pose: '姿势或构图',
    model: '模特',
  };
  const scopes: Record<ReferenceSlot, string> = {
    detail: '重点展示的细节部位和可核验工艺',
    style: '摄影质感、色调和视觉语言',
    scene: '空间、布景和光线',
    pose: '人物姿态和构图关系',
    model: '人物外貌、体型和发型',
  };
  return `图${imageNo}为${slots.map((slot) => labels[slot]).join('、')}参考，仅用于锁定${slots.map((slot) => scopes[slot]).join('、')}，不得改变图1商品。`;
};

const factsText = (facts: ProductFacts): string => {
  const values = [
    facts.category && `品类：${facts.category}`,
    facts.sellingPoints && `核心卖点：${facts.sellingPoints}`,
    facts.color && `颜色：${facts.color}`,
    facts.patternAndMaterial && `图案/材质：${facts.patternAndMaterial}`,
    facts.structure && `版型/结构：${facts.structure}`,
  ].filter(Boolean);
  return values.length > 0 ? values.join('；') : '以图1中可核验的商品信息为准';
};

const lockedAttributesText = (facts: ProductFacts): string => {
  const values = [
    facts.color && `颜色（${facts.color}）`,
    facts.patternAndMaterial && `图案与材质（${facts.patternAndMaterial}）`,
    facts.structure && `版型与结构（${facts.structure}）`,
    facts.sellingPoints && `可见关键卖点（${facts.sellingPoints}）`,
  ].filter(Boolean);
  return values.length > 0
    ? `图1商品的${values.join('、')}`
    : '图1商品中可见的颜色、图案、材质、版型、结构和关键工艺';
};

const visualParam = (
  value: string,
  referenceGroups: ReferenceSlot[][],
  slot: ReferenceSlot,
  fallback: string,
): string => {
  const index = referenceGroups.findIndex((group) => group.includes(slot));
  const reference = index >= 0 ? `图${index + 2}` : '';
  if (value && reference) return `${value}，并以${reference}为参考`;
  return value || (reference ? `以${reference}为参考` : fallback);
};

/**
 * image.ecommerce-reference Profile 编译器。
 * 图1固定为主体商品，后续图号严格跟随当前参考图拖拽顺序。
 */
export function buildPromptFromFacts(
  type: ImageGenerationType,
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  referenceBindings: Array<ReferenceSlot | ReferenceSlot[]>,
  userInstruction = '',
): string {
  if (!facts.name.trim()) return '';

  const referenceGroups = referenceBindings.map((binding) =>
    Array.isArray(binding) ? binding : [binding]);
  const bindings = [
    '图1为商品主体，仅用于锁定颜色、图案、材质、版型、结构和可见品牌信息。',
    ...referenceGroups.map((slots, index) => referenceBinding(slots, index + 2)),
  ];
  const detailFocus = facts.sellingPoints
    || facts.patternAndMaterial
    || '商品材质、工艺与关键细节';
  const typeInstruction = type === 'detail_closeup'
    ? `微距聚焦${detailFocus}，背景干净虚化，细节必须可核验。`
    : TYPE_INSTRUCTIONS[type];

  return `【任务目标】
为电商生成${typeInstruction}主体为“${facts.name}”，画面真实、清晰、可用于商品展示。

【参考图绑定】
${bindings.join('\n')}

【视觉参数】
摄影风格：${visualParam(style, referenceGroups, 'style', '真实、清晰的电商摄影风格')}。
场景：${visualParam(scene, referenceGroups, 'scene', type === 'scene_detail' ? '符合商品使用逻辑的低干扰场景' : '简洁低干扰背景')}。
姿势或构图：${visualParam(pose, referenceGroups, 'pose', type === 'model_triple_view' ? '同一模特正面、侧面、背面三视图' : '商品主体稳定、结构完整')}。

【商品事实与保真】
商品事实：${factsText(facts)}。
必须保持：${lockedAttributesText(facts)}。
不得新增未提供的商品、文字、Logo 或配饰；不得改变商品颜色、图案、版型、材质和关键工艺。

【用户创意补充】
${userInstruction.trim() || '无额外补充。'}`;
}
