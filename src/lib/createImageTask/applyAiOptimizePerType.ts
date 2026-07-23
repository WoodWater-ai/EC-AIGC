// src/lib/createImageTask/applyAiOptimizePerType.ts
import type { ImageGenerationType } from './readinessChecks';

export type AllTypePrompts = Record<ImageGenerationType, string>;

/**
 * 与 assembleTaskPrompt.applyAiOptimize 同语义:在 prompt 前后包装优化修饰词(本地包装,非真实 AI)。
 * 区别:按 selectedTypes 列表逐类型应用,未选中的 type 不动,入参不被修改。
 */
export function applyAiOptimizePerType(
  prompts: AllTypePrompts,
  selectedTypes: ImageGenerationType[],
): AllTypePrompts {
  const set = new Set(selectedTypes);
  const out: AllTypePrompts = { ...prompts };
  for (const t of ['product_main','scene_detail','detail_closeup','on_model'] as ImageGenerationType[]) {
    if (!set.has(t)) continue;
    out[t] = `(Cinematic backlight, photorealistic studio render) ${prompts[t]}, raytracing reflections, cinematic color grading, warm ambient glow`;
  }
  return out;
}
