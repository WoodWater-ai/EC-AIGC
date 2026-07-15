export interface AssemblePromptInput {
  productName: string;
  sellingPoints?: string;
  keyDetails?: string;
  aspectRatio?: string;
  /** schema 差异区字段值(风格/场景/动作等) */
  schemaParams: Record<string, any>;
  /** 已勾选的保护特征(颜色/图案/Logo/版型) */
  constraints?: string[];
}

/** 把统一字段 + schema 字段值组装成 prompt(保留老页 assemblePrompt 语义) */
export function assembleTaskPrompt(input: AssemblePromptInput): string {
  const { productName, sellingPoints, keyDetails, aspectRatio, schemaParams, constraints } = input;
  const style = schemaParams.style ?? schemaParams.style_preset ?? '';
  const scene = schemaParams.scene ?? '';
  const pose = schemaParams.pose ?? schemaParams.action ?? '';
  const ratio = aspectRatio ?? schemaParams.aspect_ratio ?? '';

  const constraintClause = constraints && constraints.length > 0
    ? ` [保护特征: ${constraints.join('、')}]`
    : '';

  const parts = [
    `3D High-fidelity product photoshoot of "${productName}".`,
    style ? `Style: ${style}.` : '',
    scene ? `Scene: ${scene}.` : '',
    pose ? `Pose: ${pose}.` : '',
    ratio ? `Aspect ratio: ${ratio}.` : '',
    sellingPoints ? `Selling points: ${sellingPoints}.` : '',
    keyDetails ? `${keyDetails}.` : '',
  ].filter(Boolean);

  return parts.join(' ') + constraintClause + (ratio ? ` --ar ${ratio}` : '');
}

/** AI 建议:在现有 prompt 上包装优化(前端本地,保留老页体验) */
export function applyAiOptimize(prompt: string): string {
  return `(Cinematic backlight, photorealistic studio render) ${prompt}, raytracing reflections, cinematic color grading, warm ambient glow`;
}