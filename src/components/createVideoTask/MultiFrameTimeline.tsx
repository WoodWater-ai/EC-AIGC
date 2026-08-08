// src/components/createVideoTask/MultiFrameTimeline.tsx
//
// [2026-08-08 Vidu 智能多帧 Task 6] 多帧时间轴编排 UI:
//   - 首帧节点(emerald 起始标识)+ N 个关键帧段卡片,竖向单列时间轴
//   - 段的新增/删除/排序在边界处禁用并给出 title 解释
//   - 底部汇总:已配置 N/9、预计总时长 X 秒
//
// 设计原则:
//   - 受控组件:不持有段状态,全部通过回调上抛给 CreateVideoTask(Task 7 接入)
//   - 排序以整段对象为单位(onMoveSegment(from, to)),图片/Prompt/时长不会失步
//   - 单列布局 + 列内换行:<1024px 宽度下控件换行而非横向溢出
//   - 仅使用既有主题色(primary / emerald / slate / danger),不新增 @theme token

import React from 'react';
import { AssetImage } from '../AssetImage';
import {
  MultiFrameSegmentCard,
  type MultiFrameSegmentPatch,
} from './MultiFrameSegmentCard';
import {
  canAddSegment,
  canRemoveSegment,
  isDurationInBounds,
  MULTI_FRAME_SEGMENT_MAX,
  MULTI_FRAME_SEGMENT_MIN,
  totalDurationSeconds,
  type MultiFrameSegment,
  type SelectedMultiFrameAsset,
} from '../../lib/createVideoTask/multiFrame';

/** 键盘焦点环 —— 与段卡片保持一致 */
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1';

interface MultiFrameTimelineProps {
  /** 时间轴起点素材;为 null 时首帧节点展示空态 */
  startFrame: SelectedMultiFrameAsset | null;
  segments: MultiFrameSegment[];
  /**
   * 打开素材选择器。
   * 传 segmentId 表示为该段选择关键帧;不传(undefined)表示选择首帧。
   * 整个回调可省略,省略时所有选择入口置为禁用态(如提交中)。
   */
  onChooseAsset?: (segmentId?: string) => void;
  onUpdateSegment: (id: string, patch: MultiFrameSegmentPatch) => void;
  onMoveSegment: (from: number, to: number) => void;
  onRemoveSegment: (id: string) => void;
  onAddSegment: () => void;
}

export const MultiFrameTimeline: React.FC<MultiFrameTimelineProps> = ({
  startFrame,
  segments,
  onChooseAsset,
  onUpdateSegment,
  onMoveSegment,
  onRemoveSegment,
  onAddSegment,
}) => {
  const pickable = Boolean(onChooseAsset);
  const segmentCount = segments.length;
  const totalSeconds = totalDurationSeconds(segments);
  const missingKeyFrames = segments.filter((segment) => !segment.keyFrame).length;

  const atMaxSegments = segmentCount >= MULTI_FRAME_SEGMENT_MAX;
  const hasInvalidDuration = segments.some(
    (segment) => !isDurationInBounds(segment.duration),
  );
  const addDisabled = !canAddSegment(segments);
  const addHint = atMaxSegments
    ? `最多 ${MULTI_FRAME_SEGMENT_MAX} 段关键帧，已达上限`
    : hasInvalidDuration
      ? '请先修正时长越界的段，再新增关键帧'
      : '新增一段关键帧';

  const removeAllowed = canRemoveSegment(segments);
  const removeDisabledHint = `至少保留 ${MULTI_FRAME_SEGMENT_MIN} 段关键帧，无法继续删除`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-emerald-600">时间轴编排</p>
          <h2 className="mt-1 text-sm font-black">首帧 + 关键帧分段</h2>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            首帧决定画面起点；每段关键帧按顺序推进画面，可重复使用同一素材。
          </p>
        </div>
        <button
          type="button"
          onClick={onAddSegment}
          disabled={addDisabled}
          className={`flex h-8 shrink-0 items-center gap-1 rounded-md border border-primary bg-white px-3 text-[11px] font-bold text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-slate-50 ${FOCUS_RING}`}
          title={addHint}
        >
          <span className="material-symbols-outlined text-base">add</span>
          新增关键帧
        </button>
      </div>

      <div className="mt-4">
        {/* 首帧节点:emerald 竖条 + start 徽章 + 向下连接器 */}
        <div className="flex gap-3">
          <div className="flex w-7 shrink-0 flex-col items-center">
            <span
              aria-hidden="true"
              className="h-3 w-0.5 rounded-full bg-emerald-500"
            />
            <span
              aria-hidden="true"
              className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-sm"
            >
              <span className="material-symbols-outlined text-base">flag</span>
            </span>
            <span
              aria-hidden="true"
              className="mt-1 w-px flex-1 bg-slate-200"
            />
          </div>

          <div className="min-w-0 flex-1 pb-4">
            <div className="min-w-0 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 transition-shadow hover:shadow-sm focus-within:shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    start
                  </span>
                  <span className="text-xs font-black text-slate-700">视频首帧</span>
                </div>
                {startFrame && pickable && (
                  <button
                    type="button"
                    onClick={() => onChooseAsset?.()}
                    className={`shrink-0 rounded px-1 text-[11px] font-bold text-primary hover:underline ${FOCUS_RING}`}
                    title="更换视频首帧"
                  >
                    更换
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <div className="w-32 shrink-0">
                  {startFrame ? (
                    <div>
                      <div className="overflow-hidden rounded-md border border-emerald-200 bg-white">
                        <AssetImage
                          urls={[startFrame.thumbnailUrl, startFrame.originalUrl]}
                          alt={startFrame.name ?? '视频首帧'}
                          aspectRatio="video"
                          objectFit="contain"
                        />
                      </div>
                      <p
                        className="mt-1 truncate text-[10px] text-slate-400"
                        title={startFrame.name}
                      >
                        {startFrame.name ?? '未命名素材'}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChooseAsset?.()}
                      disabled={!pickable}
                      className={`grid aspect-video w-full place-items-center rounded-md border-2 border-dashed border-emerald-300 bg-white text-emerald-600 transition-colors hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 ${FOCUS_RING}`}
                      title={pickable ? '选择视频首帧' : undefined}
                      aria-label="选择视频首帧"
                    >
                      <span className="block text-center">
                        <span className="material-symbols-outlined block text-2xl">
                          add_photo_alternate
                        </span>
                        <span className="mt-0.5 block text-[10px] font-bold">选择首帧</span>
                      </span>
                    </button>
                  )}
                </div>
                <p className="min-w-0 flex-1 basis-48 text-[11px] leading-5 text-slate-500">
                  {startFrame
                    ? '首帧作为视频起点，后续每段关键帧在此基础上依次推进。'
                    : '请先选择视频首帧，再配置关键帧分段。'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 关键帧段列表 */}
        {segments.map((segment, index) => {
          const isLast = index === segmentCount - 1;
          return (
            <div key={segment.id} className="flex gap-3">
              <div className="flex w-7 shrink-0 flex-col items-center">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-black text-white shadow-sm"
                >
                  {index + 1}
                </span>
                {!isLast && (
                  <span aria-hidden="true" className="mt-1 w-px flex-1 bg-slate-200" />
                )}
              </div>
              <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-4'}`}>
                <MultiFrameSegmentCard
                  segment={segment}
                  index={index}
                  onChooseAsset={
                    onChooseAsset ? () => onChooseAsset(segment.id) : undefined
                  }
                  onUpdate={(patch) => onUpdateSegment(segment.id, patch)}
                  onMoveUp={() => onMoveSegment(index, index - 1)}
                  onMoveDown={() => onMoveSegment(index, index + 1)}
                  onRemove={() => onRemoveSegment(segment.id)}
                  canMoveUp={index > 0}
                  canMoveDown={index < segmentCount - 1}
                  canRemove={removeAllowed}
                  removeDisabledHint={removeDisabledHint}
                />
              </div>
            </div>
          );
        })}

        {segmentCount === 0 && (
          <div className="ml-10 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[11px] font-bold text-slate-400">
            尚未配置关键帧，至少需要 {MULTI_FRAME_SEGMENT_MIN} 段。
          </div>
        )}
      </div>

      {/* 底部汇总 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-bold text-slate-600">
          已配置 {segmentCount}/{MULTI_FRAME_SEGMENT_MAX}，预计总时长 {totalSeconds} 秒
        </p>
        {missingKeyFrames > 0 && (
          <p className="text-[10px] font-bold text-amber-600">
            还有 {missingKeyFrames} 段未选择关键帧
          </p>
        )}
      </div>
    </div>
  );
};
