import type { ReferenceSlot } from './extractReferenceInsights';
import type { ProductFacts } from './extractProductFacts';
import type { ImageGenerationType } from './readinessChecks';

const TYPE_INSTRUCTIONS: Record<ImageGenerationType, string> = {
  product_main: '商品完整居中，背景低干扰，轮廓、材质和细节清晰可辨。',
  scene_detail: '商品为画面中心，场景仅服务于氛围、尺度和使用感。',
  detail_closeup: '微距聚焦商品材质、工艺与关键细节，背景干净虚化，细节必须可核验。',
  model_triple_view: '相同人物、光线和机位展示正面、侧面、背面；手部不得遮挡商品关键结构。',
  product_detail: '围绕一个核心卖点展示商品完整形态、关键结构和实际穿着效果，画面适合直接用于电商详情页。',
};

/** 不允许被用户删除的基础出图要求，始终拼入正面 Prompt。 */
export const DEFAULT_TYPE_REQUIREMENTS: Record<ImageGenerationType, string> = {
  product_main: '保持商品颜色、材质、版型、图案和关键工艺；不新增商品、文字、Logo或配饰。',
  scene_detail: '保持商品颜色、材质、版型、图案和关键工艺；不新增商品、文字、Logo或配饰。',
  detail_closeup: '细节必须来自主图或细节参考图，不虚构纹理、面料、走线和工艺。',
  model_triple_view: '保持同一模特、同一商品和一致光线；展示正面、侧面、背面，关键结构无遮挡。',
  product_detail: '保持商品颜色、材质、版型、图案和关键工艺；不生成文字、长图、多图拼接或不存在的功能。',
};

/** 用户未填写时，各图片类型共用的负面提示词初始值。 */
export const DEFAULT_NEGATIVE_PROMPT = 'blurry, bad quality, distorted';

export const REFERENCE_ROLE_LABELS: Record<ReferenceSlot, string> = {
  detail: '细节参考',
  style: '风格参考',
  scene: '场景参考',
  pose: '姿势参考',
  model: '模特参考',
};

const factsText = (facts: ProductFacts): string => [
  `商品：${facts.name}`,
  facts.category && `品类：${facts.category}`,
  facts.sellingPoints && `卖点：${facts.sellingPoints}`,
  facts.color && `颜色：${facts.color}`,
  facts.patternAndMaterial && `材质/图案：${facts.patternAndMaterial}`,
  facts.structure && `版型/结构：${facts.structure}`,
].filter(Boolean).join('；');

const referenceText = (referenceGroups: ReferenceSlot[][]): string => [
  '主图参考：图1',
  ...referenceGroups.flatMap((roles, index) => roles.map(
    (role) => `${REFERENCE_ROLE_LABELS[role]}：图${index + 2}`,
  )),
].join('\n');

const creationTagsText = (style: string, scene: string, pose: string): string => {
  const tags = [
    style && `风格=${style}`,
    scene && `场景=${scene}`,
    pose && `姿势=${pose}`,
  ].filter(Boolean);
  return tags.length > 0 ? `\n创作标签：${tags.join('；')}` : '';
};

const sectionValue = (prompt: string, title: string): string | null => {
  const marker = `【${title}】`;
  const start = prompt.indexOf(marker);
  if (start < 0) return null;
  const contentStart = start + marker.length;
  const nextSection = prompt.indexOf('\n【', contentStart);
  return prompt.slice(contentStart, nextSection < 0 ? undefined : nextSection).trim();
};

export interface ReusablePromptContent {
  designerInstruction: string;
  negativePrompt?: string;
}

export function parseReusablePrompt(prompt: string): ReusablePromptContent {
  const source = prompt.trim();
  if (!source) return { designerInstruction: '' };

  const designerInstruction = sectionValue(source, '正面提示词')
    ?? sectionValue(source, '设计师创意');
  if (designerInstruction !== null) {
    // 兼容旧 Prompt：旧的“约束规则”会作为可编辑的负面提示词带入。
    const negativePrompt = sectionValue(source, '负面提示词')
      ?? sectionValue(source, '约束规则');
    return {
      designerInstruction: designerInstruction.replace(/\n创作标签：[^\n]*$/, '').trim(),
      ...(negativePrompt !== null ? { negativePrompt } : {}),
    };
  }

  const legacyInstruction = sectionValue(source, '用户创意补充');
  if (legacyInstruction && legacyInstruction !== '无额外补充。') {
    return { designerInstruction: legacyInstruction };
  }
  return { designerInstruction: source };
}

/** 图1固定为主体商品，后续图号严格跟随当前参考素材顺序。 */
export function buildPromptFromFacts(
  type: ImageGenerationType,
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  referenceBindings: Array<ReferenceSlot | ReferenceSlot[]>,
  userInstruction = '',
): string {
  const designerInstruction = userInstruction.trim();
  if (!facts.name.trim() || !designerInstruction) return '';

  const referenceGroups = referenceBindings.map((binding) =>
    Array.isArray(binding) ? binding : [binding]);
  const detailFocus = facts.sellingPoints
    || facts.patternAndMaterial
    || '商品材质、工艺与关键细节';
  const typeInstruction = type === 'detail_closeup'
    ? `微距聚焦${detailFocus}，背景干净虚化，细节必须可核验。`
    : TYPE_INSTRUCTIONS[type];

  return `【图片类型要求】
${typeInstruction}

【正面提示词】
${designerInstruction}${creationTagsText(style, scene, pose)}

【参考图绑定】
${referenceText(referenceGroups)}

【商品事实】
${factsText(facts)}

【基础要求】
${DEFAULT_TYPE_REQUIREMENTS[type]}`;
}
