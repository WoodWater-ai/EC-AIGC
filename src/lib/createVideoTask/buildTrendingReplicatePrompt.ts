export type TrendingReplacementRole = 'model' | 'scene' | 'style' | 'pose';

export interface TrendingReplacementAsset {
  replacementRole: TrendingReplacementRole;
}

export interface TrendingPromptInput {
  replacements: TrendingReplacementAsset[];
  userInstruction: string;
}

export const TRENDING_ROLE_LABELS: Record<TrendingReplacementRole, string> = {
  model: '模特',
  scene: '场景',
  style: '风格',
  pose: '动作/姿势',
};

const bindingText = (
  role: TrendingReplacementRole,
  imageNo: number,
): string => {
  switch (role) {
    case 'model':
      return `图${imageNo}：人物替换图。替换原视频中的人物外貌、体型、发型和气质；连续动作与节奏仍以源视频为准。`;
    case 'scene':
      return `图${imageNo}：场景替换图。仅替换场景布景与光线，保留原视频镜头、人物动作与剪辑节奏。`;
    case 'style':
      return `图${imageNo}：风格参考图。仅约束色调、质感与美术风格，不替换具体主体。`;
    case 'pose':
      return `图${imageNo}：动作/姿势限制图。仅补充姿态限制，连续动作、运镜与剪辑仍以源视频为准。`;
  }
};

const referenceSummary = (
  replacements: TrendingReplacementAsset[],
  role: TrendingReplacementRole,
  fallback: string,
): string => {
  const values = replacements
    .map((asset, index) => ({ asset, imageNo: index + 2 }))
    .filter(({ asset }) => asset.replacementRole === role)
    .map(({ imageNo }) => `图${imageNo}`);
  return values.length > 0 ? values.join('、') : fallback;
};

/**
 * 商品图固定为 Vidu images[0]，其余绑定严格跟随 replacements 当前顺序。
 * Prompt 中不生成任何未实际选择的图片编号或替换角色。
 */
export const buildTrendingReplicatePrompt = ({
  replacements,
  userInstruction,
}: TrendingPromptInput): string => {
  const bindings = [
    '图1：商品替换图。替换原视频中的商品，锁定颜色、图案、材质、版型和细节。',
    ...replacements.map((asset, index) =>
      bindingText(asset.replacementRole, index + 2)),
  ];

  const replacementTargets = ['商品'];
  if (replacements.some((asset) => asset.replacementRole === 'model')) {
    replacementTargets.push('人物');
  }
  if (replacements.some((asset) => asset.replacementRole === 'scene')) {
    replacementTargets.push('场景');
  }

  const stylePrompt = referenceSummary(
    replacements,
    'style',
    '保持原视频的视觉风格，不额外改写',
  );
  const scenePrompt = referenceSummary(
    replacements,
    'scene',
    '保持原视频场景，不执行场景替换',
  );
  const posePrompt = referenceSummary(
    replacements,
    'pose',
    '严格跟随原视频人物动作与节奏',
  );

  return `【复刻范围】
以原视频为唯一的镜头、运镜、人物动作、剪辑节奏、时长和叙事结构依据。
除下方明确指定的替换内容外，其他画面保持原视频逻辑不变。

【图片绑定】
${bindings.join('\n')}

【替换规则】
将原视频中的 ${replacementTargets.join('、')} 替换为对应参考图内容。
商品真实性优先于原视频中的原商品；人物身份以人物参考图为准；仅在存在场景参考图时替换场景。
不得改变原视频的镜头语言、动作节奏、剪辑结构和未指定替换的主体。

【标签参数】
风格倾向：${stylePrompt}。
场景倾向：${scenePrompt}。
动作限制：${posePrompt}；源视频连续动作优先。

【质量约束】
人物、服装和商品在全片中保持一致；避免身份漂移、服装变化、商品变形、闪烁、跳帧、错误文字和不连续动作。

【用户创意补充】
${userInstruction.trim() || '无额外补充。'}`;
};

export const extractTrendingUserInstruction = (prompt: string): string => {
  const marker = '【用户创意补充】';
  const markerIndex = prompt.lastIndexOf(marker);
  return markerIndex >= 0
    ? prompt.slice(markerIndex + marker.length).trim().replace(/^无额外补充。?$/, '')
    : prompt.trim();
};
