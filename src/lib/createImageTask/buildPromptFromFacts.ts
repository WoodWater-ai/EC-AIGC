import type { ImageGenerationType } from './readinessChecks';
import type { ProductFacts } from './extractProductFacts';

/**
 * 单张图片类型的 prompt 组装(顺序固定:商品名 → 风格 → 场景 → 姿势 → 卖点 → 关键细节 → 参考图洞察)。
 * 任一字段为空则跳过,避免产生 "  " 多余空格。
 */
export function buildPromptFromFacts(
  _type: ImageGenerationType,   // 预留:type-specific 模板可在此 switch
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  referenceInsights: string[],
): string {
  const segments: string[] = [];

  if (facts.name) {
    segments.push(`3D High-fidelity product photoshoot of "${facts.name}".`);
  }
  if (style) segments.push(`Style: ${style}.`);
  if (scene) segments.push(`Scene: ${scene}.`);
  if (pose) segments.push(`Pose: ${pose}.`);
  if (facts.sellingPoints) segments.push(`Selling points: ${facts.sellingPoints}.`);
  if (facts.structure) segments.push(`Structure: ${facts.structure}.`);
  if (facts.color) segments.push(`Color: ${facts.color}.`);
  if (facts.patternAndMaterial) segments.push(`Material: ${facts.patternAndMaterial}.`);
  if (referenceInsights.length > 0) {
    segments.push(referenceInsights.join('\n'));
  }
  return segments.join(' ');
}
