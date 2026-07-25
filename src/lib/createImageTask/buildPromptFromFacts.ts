import type { ImageGenerationType } from './readinessChecks';
import type { ProductFacts } from './extractProductFacts';

/**
 * 单张图片类型的 prompt 组装。
 *
 * 命名规则:[imageType 目标句] + 商品事实 + 风格/场景/姿势 + 参考图解析 + 负面约束。
 * 每个 imageType 有专属目标句,使"主图/场景/细节/模特"Prompt 模板名实相符。
 * [v1 2026-07-25 重写]:把通用外壳改成 per-type 模板段;
 *   取消原"3D High-fidelity product photoshoot of {name}"固定首句,改为各 type 自己的目标句;
 *   参考图索引按 appearance 顺序编号,如"参考图 1: 白色吊带睡裙"形式拼入。
 */
export function buildPromptFromFacts(
  type: ImageGenerationType,
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  referenceInsights: string[],
): string {
  const segments: string[] = [];
  // 1. imageType 目标句
  segments.push(typeTargetSentence(type));
  // 2. 商品事实
  const factSegments: string[] = [];
  if (facts.name) factSegments.push(`商品：${facts.name}`);
  if (facts.category) factSegments.push(`品类：${facts.category}`);
  if (facts.sellingPoints) factSegments.push(`核心卖点：${facts.sellingPoints}`);
  if (facts.color) factSegments.push(`颜色：${facts.color}`);
  if (facts.patternAndMaterial) factSegments.push(`图案/材质：${facts.patternAndMaterial}`);
  if (facts.structure) factSegments.push(`版型/结构：${facts.structure}`);
  if (factSegments.length > 0) {
    segments.push(factSegments.join('；') + '。');
  }
  // 3. 风格 / 场景 / 姿势(仅模特展示需要姿势)
  if (style) segments.push(`风格：${style}。`);
  if (scene) segments.push(`场景：${scene}。`);
  if (pose && type === 'model_front') segments.push(`动作/姿势：${pose}。`);
  // 4. 参考图解析(按序号拼接)
  if (referenceInsights.length > 0) {
    const refLines = referenceInsights.map(
      (insight, idx) => `参考图 ${idx + 1}：${insight}`,
    );
    segments.push(refLines.join('\n'));
  }
  return segments.join(' ');
}

/**
 * 每种 imageType 的"目标句"——给 Vidu 的类型语义指令。
 * 这些是首句,放在所有内容前面,使 Vidu 直接理解任务意图。
 *
 * 主图/场景/细节/模特展示 4 类各自明确具体拍摄要求,
 * 避免共用"3D High-fidelity product photoshoot"通用外壳。
 */
function typeTargetSentence(type: ImageGenerationType): string {
  switch (type) {
    case 'product_main':
      return '纯净商业主图，商品主体完整、边缘清晰，保留品牌与材质细节；白底居中构图、主体占比 80% 以上、文字区预留 20%，符合电商主图规范。';
    case 'scene_detail':
      return '商品融入指定场景，强化氛围、使用感和商业叙事；中景镜头突出商品与人物/场景的互动关系，主体占比 40-60%。';
    case 'detail_closeup':
      return '聚焦材质、工艺与关键卖点，使用微距镜头（85mm+ 微距/特写光圈）和局部光影；展示纹理、缝线、印花、配件等细节部位。';
    case 'model_front':
      // 注:本期 model_front 是单张模特正面展示图(非真三视图)。
      // 真正的三视图(正/侧/背)需另起 P,前端拆 3 个子任务。
      return '模特自然展示商品，**正面视角**拍摄为主；确保上身比例、姿态和商品细节真实可信；统一构图居中、人物姿态协调。';
    default:
      // 兜底:防御性,不应触发(enum 限制 4 值)
      return '商品展示图。';
  }
}