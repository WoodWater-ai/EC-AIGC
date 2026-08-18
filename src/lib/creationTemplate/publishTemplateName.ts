/** 作品发布模板时的统一兜底名称。 */
export const DEFAULT_PUBLISH_TEMPLATE_NAME = '我的创作模板';

/**
 * 首页作品卡与任务详情共用作品标题作为模板默认名。
 * 后端任务标题统一为“任务类型 · 商品名称”，因此这里不再重复拼接商品名称。
 */
export const getPublishTemplateDefaultName = (workTitle?: string | null) =>
  workTitle?.trim() || DEFAULT_PUBLISH_TEMPLATE_NAME;
