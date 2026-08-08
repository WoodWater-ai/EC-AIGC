// src/lib/createVideoTask/multiFrame.ts
//
// [2026-08-08 Vidu 智能多帧 Task 5] 多帧时间轴纯函数:
//   - 段 UI 模型 + 纯函数(create / reorder / 总时长 / 边界校验 / 准备状态)
//   - 后端提交数据组装(assets FIRST_FRAME + N KEY_FRAME, sortOrder = 段索引,
//     允许同一 assetId 重复出现;multiFrameSegments 与 assets 索引对齐)
//
// 设计原则:
//   - 本模块为纯函数,无副作用,不发起网络请求,不读全局状态,可在 React 之外复用与单测
//   - 本地 `id` 仅作 UI 稳定键值(React key / 拖拽 source),**永不**发送到后端
//   - 边界(2..9 段、2..7 秒)对所有供应商统一,具体供应商模型/分辨率由 useTaskParams 层校验
//   - 与 deletePromptsAndShots / createImageTask 状态机完全解耦,本模块不触发任何 UI 副作用

import type { VideoTaskSubmitPayload } from '../../types';

/** 多帧段关键帧选中的素材引用(与 TaskAssetRef 形状一致,但只承载 UI 必需字段) */
export interface SelectedMultiFrameAsset {
  assetId: string;
  originalUrl: string;
  thumbnailUrl?: string;
  name?: string;
}

/** 多帧时间轴中的单段(UI 模型) */
export interface MultiFrameSegment {
  /** UI 稳定键值,本地生成,不会提交到后端 */
  id: string;
  /** 当前段绑定的关键帧素材;未选择时为 null(UI 表现为"未配置") */
  keyFrame: SelectedMultiFrameAsset | null;
  /** 段独立 Prompt;空字符串视为未填写 */
  prompt: string;
  /** 段独立时长(秒);受 2..7 秒边界约束 */
  duration: number;
}

/** 多帧段边界(供应商中立,Vidu 智能多帧采纳) */
export const MULTI_FRAME_SEGMENT_MIN = 2;
export const MULTI_FRAME_SEGMENT_MAX = 9;
export const MULTI_FRAME_DURATION_MIN = 2;
export const MULTI_FRAME_DURATION_MAX = 7;
/** 智能多帧默认时长(秒),与后端持久化 default 对齐 */
export const MULTI_FRAME_DURATION_DEFAULT = 5;

/** 本地单调 id 计数器 —— 同一会话内单调递增,跨刷新不保证唯一(纯 UI key 即可) */
let __multiFrameIdCounter = 0;

/** 生成稳定本地 id(纯 UI key,不发送到后端) */
function nextSegmentId(): string {
  __multiFrameIdCounter += 1;
  return `mf-seg-${Date.now().toString(36)}-${__multiFrameIdCounter.toString(36)}`;
}

/**
 * 创建一个新段(空素材 + 默认 Prompt 空字符串 + 默认时长)。
 * 纯函数:不修改入参,不影响外部状态。
 */
export function createMultiFrameSegment(): MultiFrameSegment {
  return {
    id: nextSegmentId(),
    keyFrame: null,
    prompt: '',
    duration: MULTI_FRAME_DURATION_DEFAULT,
  };
}

/**
 * 把 from 索引的段移动到 to 索引位置,其余段顺序保持稳定(顺序前移/后移)。
 * 纯函数:不修改入参数组,返回新数组。
 *
 * @param segments  当前段列表(不可变)
 * @param from      移动源索引(0-based)
 * @param to        移动目标索引(0-based)
 */
export function moveMultiFrameSegment(
  segments: MultiFrameSegment[],
  from: number,
  to: number,
): MultiFrameSegment[] {
  if (segments.length === 0) return segments;
  if (from < 0 || from >= segments.length) return segments;
  const target = Math.max(0, Math.min(to, segments.length - 1));
  if (target === from) return segments;

  const next = segments.slice();
  const [moved] = next.splice(from, 1);
  if (!moved) return segments;
  next.splice(target, 0, moved);
  return next;
}

/** 计算所有段时长之和(秒)。空段返回 0。 */
export function totalDurationSeconds(segments: MultiFrameSegment[]): number {
  return segments.reduce((sum, seg) => sum + (Number.isFinite(seg.duration) ? seg.duration : 0), 0);
}

/** 判断单个时长是否在 2..7 秒边界内 */
export function isDurationInBounds(duration: number): boolean {
  return (
    Number.isFinite(duration) &&
    duration >= MULTI_FRAME_DURATION_MIN &&
    duration <= MULTI_FRAME_DURATION_MAX
  );
}

/**
 * 是否允许新增段(段总数 < 9,且现有段时长均在 2..7 内)。
 * 段数为 0..8 时返回 true;达到 9 返回 false;现有段时长越界也返回 false,
 * 提示 UI 阻断添加以避免累计到不可提交状态。
 */
export function canAddSegment(segments: MultiFrameSegment[]): boolean {
  if (segments.length >= MULTI_FRAME_SEGMENT_MAX) return false;
  return segments.every((seg) => isDurationInBounds(seg.duration));
}

/** 是否允许删除当前段(段总数 > 2)。刚好 2 段时禁止删除以保留时间轴下限。 */
export function canRemoveSegment(segments: MultiFrameSegment[]): boolean {
  return segments.length > MULTI_FRAME_SEGMENT_MIN;
}

/** 当前段数量是否在 2..9 边界内 */
export function isSegmentCountInBounds(segments: MultiFrameSegment[]): boolean {
  return (
    segments.length >= MULTI_FRAME_SEGMENT_MIN &&
    segments.length <= MULTI_FRAME_SEGMENT_MAX
  );
}

/**
 * 单段是否"已就绪"(可作为提交的一部分)。
 * 多帧模式下要求:
 *   - 已选择关键帧素材(keyFrame 非 null,assetId 非空)
 *   - 时长在 2..7 秒边界内
 *
 * `mode` 仅用于类型层面对齐 UI 渲染分支(多帧以外的模式不会调用此函数);
 * 实现上不区分 mode,行为相同。
 */
export function isSegmentReady(
  seg: MultiFrameSegment,
  _mode: 'MULTI_FRAME',
): boolean {
  if (!seg.keyFrame) return false;
  if (!seg.keyFrame.assetId) return false;
  return isDurationInBounds(seg.duration);
}

/** 整个多帧时间轴是否已就绪(首帧 + 每段都 ready,且段数在边界内) */
export function isMultiFrameTimelineReady(
  startFrame: SelectedMultiFrameAsset | null,
  segments: MultiFrameSegment[],
): boolean {
  if (!startFrame || !startFrame.assetId) return false;
  if (!isSegmentCountInBounds(segments)) return false;
  return segments.every((seg) => isSegmentReady(seg, 'MULTI_FRAME'));
}

// ============================================================================
// 提交数据组装(对齐后端 VideoTaskSubmitRequest 字段名)
// ============================================================================

/**
 * 构造多帧模式提交数据:
 *   - assets: 第一张 FIRST_FRAME + 每段一个 KEY_FRAME;sortOrder = 段索引(0..N-1)
 *     允许同一 assetId 在不同段重复出现(智能多帧允许复用同一素材)。
 *   - multiFrameSegments: 与 assets 的 KEY_FRAME 行索引对齐的段数据。
 *     keyFrameAssetId / prompt / duration / sortOrder 与后端 DTO 字段名一致。
 *
 * 入参约束:
 *   - startFrame: 非 null,assetId 非空
 *   - segments: 长度 2..9,每段 keyFrame 非 null,duration 在 2..7 内
 *   - 不满足约束时,函数仍返回数据但调用方应在 UI 阻止提交
 *
 * 纯函数:不发起网络请求,不引入副作用。
 */
export function buildMultiFrameSubmitData(
  startFrame: SelectedMultiFrameAsset,
  segments: MultiFrameSegment[],
): {
  assets: VideoTaskSubmitPayload['assets'];
  multiFrameSegments: VideoTaskSubmitPayload['multiFrameSegments'];
} {
  const firstFrameAsset = {
    assetId: startFrame.assetId,
    slotRole: 'FIRST_FRAME' as const,
    sortOrder: 0,
    originalUrl: startFrame.originalUrl,
    thumbnailUrl: startFrame.thumbnailUrl,
    name: startFrame.name,
  };

  const keyFrameAssets = segments.map((seg, index) => {
    // 段 index == 后端 sortOrder;keyFrame 非 null 时才有意义
    const keyFrame = seg.keyFrame;
    return {
      assetId: keyFrame?.assetId ?? '',
      slotRole: 'KEY_FRAME' as const,
      sortOrder: index,
      originalUrl: keyFrame?.originalUrl,
      thumbnailUrl: keyFrame?.thumbnailUrl,
      name: keyFrame?.name,
    };
  });

  const multiFrameSegments = segments.map((seg, index) => ({
    keyFrameAssetId: seg.keyFrame?.assetId ?? '',
    prompt: seg.prompt.trim() === '' ? undefined : seg.prompt,
    duration: seg.duration,
    sortOrder: index,
  }));

  return {
    assets: [firstFrameAsset, ...keyFrameAssets],
    multiFrameSegments,
  };
}
