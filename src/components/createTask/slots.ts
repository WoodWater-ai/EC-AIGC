/**
 * 任务创建流程的素材 slot 类型与元数据(单一来源)
 *
 * - 7 个 slot 共享同一套 "点击 → 弹资源中心 → 确认 → 写值" 流程
 * - 任何 slot 渲染 / 提交字段 / 单多选语义都从这里取
 */

export const SLOT_KEYS = [
  'main', 'top', 'bottom', 'detail', 'style', 'scene', 'pose',
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

/** slot 已选资源引用 —— 只存必要字段,提交时携带 asset_resource.id */
export interface SlotRef {
  /**
   * 后端真实业务标识 asset_resource.id。
   * 字段名为兼容既有调用方暂时保留，string 防 JS 精度丢失。
   */
  fileResourceId: string;
  /** 缩略图 URL —— UI 预览用 */
  thumbnailUrl?: string;
  /** 原图 URL —— 合成/COS 处理等需要原图质量的场景用 */
  originalUrl?: string;
  /** 资源名 —— slot 已选态标签 + 同步给商品主体图区 */
  name?: string;
  /** 文件大小(字节) —— 商品主体图区显示用 */
  fileSize?: number;
  /** 图片原始宽度(px) —— 商品主体图区显示用 */
  width?: number;
  /** 图片原始高度(px) —— 商品主体图区显示用 */
  height?: number;
}

export interface SlotMeta {
  key: SlotKey;
  /** 中文标签 */
  label: string;
  /** 业务语义:该 slot 允许多选 */
  multiSelect: boolean;
  /** 提交 payload 中对应的字段名(用于 buildSubmitPayload 内部 switch) */
  payloadField: string;
}

export const SLOT_META: Record<SlotKey, SlotMeta> = {
  main:   { key: 'main',   label: '主图', multiSelect: false, payloadField: 'mainFileResId' },
  top:    { key: 'top',    label: '上衣', multiSelect: false, payloadField: 'topFileResId' },
  bottom: { key: 'bottom', label: '下装', multiSelect: false, payloadField: 'bottomFileResId' },
  detail: { key: 'detail', label: '细节', multiSelect: false, payloadField: 'detailFileResId' },
  style:  { key: 'style',  label: '风格', multiSelect: false, payloadField: 'styleFileResId' },
  scene:  { key: 'scene',  label: '场景', multiSelect: false, payloadField: 'sceneFileResId' },
  pose:   { key: 'pose',   label: '姿势', multiSelect: false, payloadField: 'poseFileResId' },
};
