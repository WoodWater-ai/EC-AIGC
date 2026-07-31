import type { GenerationTask, VideoTaskMode } from './types';

/** 用户侧只展示可理解的创作类型，不暴露底层 Profile 名称。 */
export const videoTemplateTypeLabel = (mode?: VideoTaskMode): string => {
  if (mode === 'trending_replicate') return '爆款复刻';
  if (mode === 'reference2video') return '真人图参考';
  return '首帧图生视频';
};

/**
 * 发布模板前必须确保下一位使用者能在不还原原任务的情况下完成复用。
 * 返回值可直接作为 disabled 状态下的说明文案。
 */
export const templatePublishBlockReason = (task: GenerationTask): string | null => {
  if (!(task.taskPrompt ?? task.params?.prompt)?.trim()) return '该结果缺少可复用 Prompt';
  if (!task.productName?.trim() || !task.productImg?.trim()) return '该结果缺少可替换的主体商品素材';
  if (!task.params?.ratio) return '该结果缺少输出比例';

  if (task.type === 'image') {
    if (!task.imageType) return '该结果缺少图片类型';
    return null;
  }

  if (!task.params.mode || !task.params.duration || !task.params.resolution || !task.params.motion) {
    return '该视频缺少可复用的模式或输出参数';
  }
  return null;
};
