// src/components/createVideoTask/MultiFrameSegmentCard.tsx
//
// [2026-08-08 Vidu 智能多帧 Task 6] 多帧时间轴单段卡片:
//   - 关键帧缩略图(16:9)、段 Prompt、段时长(2..7 秒)、上移/下移/删除
//   - 受控组件:自身不持有状态,所有变更通过 onUpdate / onMove* / onRemove 上抛
//
// 设计原则:
//   - 整段作为一个整体移动,图片 / Prompt / 时长不会失步(排序由父级对整个 segment 对象操作)
//   - 纯展示 + 回调,不发请求、不弹 toast(提示语交给容器层 CreateVideoTask)
//   - 复用视频工作台既有视觉:slate 边框、rounded、primary 强调色、material-symbols 图标
//   - 边界禁用(段数下限)由父级传入 canRemove + 文案,卡片只负责渲染禁用态与 title 提示

import React from 'react';
import { AssetImage } from '../AssetImage';
import {
  isDurationInBounds,
  MULTI_FRAME_DURATION_MAX,
  MULTI_FRAME_DURATION_MIN,
  type MultiFrameSegment,
} from '../../lib/createVideoTask/multiFrame';

/** 段可变更字段(本地 id 不可变,不在 patch 范围内) */
export type MultiFrameSegmentPatch = Partial<
  Pick<MultiFrameSegment, 'keyFrame' | 'prompt' | 'duration'>
>;

/** 时长下拉可选项:2..7 秒 */
const DURATION_OPTIONS = Array.from(
  { length: MULTI_FRAME_DURATION_MAX - MULTI_FRAME_DURATION_MIN + 1 },
  (_, index) => MULTI_FRAME_DURATION_MIN + index,
);

/** 段 Prompt 长度上限,与工作台其它补充说明输入框一致 */
const SEGMENT_PROMPT_MAX_LENGTH = 500;

/** 键盘焦点环 —— 与 Dashboard/LoginPage 既有 focus-visible 约定一致 */
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1';

/** 段内小图标按钮(上移/下移/删除)基础样式 */
const ICON_BUTTON_CLASS = `grid h-7 w-7 shrink-0 place-items-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary hover:bg-primary-light hover:text-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-300 ${FOCUS_RING}`;

interface MultiFrameSegmentCardProps {
  segment: MultiFrameSegment;
  /** 0-based 段索引,用于序号文案与无障碍标签 */
  index: number;
  /** 选择/更换本段关键帧;不传表示当前不可选择素材(如提交中) */
  onChooseAsset?: () => void;
  onUpdate: (patch: MultiFrameSegmentPatch) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  /** 删除被禁用时的解释文案(段数已达下限) */
  removeDisabledHint?: string;
}

export const MultiFrameSegmentCard: React.FC<MultiFrameSegmentCardProps> = ({
  segment,
  index,
  onChooseAsset,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  canRemove,
  removeDisabledHint,
}) => {
  const position = index + 1;
  const keyFrame = segment.keyFrame;
  const durationValid = isDurationInBounds(segment.duration);
  const pickable = Boolean(onChooseAsset);

  return (
    <div
      className={`min-w-0 rounded-lg border bg-white p-3 transition hover:shadow-sm focus-within:border-primary/40 focus-within:shadow-sm ${
        keyFrame ? 'border-slate-200 hover:border-slate-300' : 'border-dashed border-slate-300'
      }`}
    >
      {/* 段头:序号 + 状态 + 排序/删除操作 */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-black text-slate-700">第 {position} 段</span>
          {keyFrame ? (
            <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              已配置
            </span>
          ) : (
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              待选择关键帧
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className={ICON_BUTTON_CLASS}
            title={canMoveUp ? `上移第 ${position} 段` : '已经是第一段'}
            aria-label={`上移第 ${position} 段`}
          >
            <span className="material-symbols-outlined text-base">arrow_upward</span>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className={ICON_BUTTON_CLASS}
            title={canMoveDown ? `下移第 ${position} 段` : '已经是最后一段'}
            aria-label={`下移第 ${position} 段`}
          >
            <span className="material-symbols-outlined text-base">arrow_downward</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-danger hover:bg-red-50 hover:text-danger disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-300 ${FOCUS_RING}`}
            title={canRemove ? `删除第 ${position} 段` : removeDisabledHint}
            aria-label={`删除第 ${position} 段`}
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>

      {/* 段体:缩略图 + Prompt / 时长。窄屏(<1024px)下右列换行到图片下方,不横向溢出 */}
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="w-32 shrink-0">
          {keyFrame ? (
            <div className="group/thumb relative">
              <button
                type="button"
                onClick={onChooseAsset}
                disabled={!pickable}
                className={`block w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition-colors hover:border-primary disabled:cursor-not-allowed ${FOCUS_RING}`}
                title={pickable ? `更换第 ${position} 段关键帧` : undefined}
                aria-label={`更换第 ${position} 段关键帧`}
              >
                <AssetImage
                  urls={[keyFrame.thumbnailUrl, keyFrame.originalUrl]}
                  alt={keyFrame.name ?? `第 ${position} 段关键帧`}
                  aspectRatio="video"
                  objectFit="contain"
                />
                {pickable && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/45 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover/thumb:opacity-100">
                    更换
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ keyFrame: null })}
                className={`absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/thumb:opacity-100 focus-visible:opacity-100 ${FOCUS_RING}`}
                title={`移除第 ${position} 段关键帧`}
                aria-label={`移除第 ${position} 段关键帧`}
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
              <p
                className="mt-1 truncate text-[10px] text-slate-400"
                title={keyFrame.name}
              >
                {keyFrame.name ?? '未命名素材'}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={onChooseAsset}
              disabled={!pickable}
              className={`grid aspect-video w-full place-items-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-primary hover:bg-primary-light hover:text-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-300 ${FOCUS_RING}`}
              title={pickable ? `选择第 ${position} 段关键帧` : undefined}
              aria-label={`选择第 ${position} 段关键帧`}
            >
              <span className="block text-center">
                <span className="material-symbols-outlined block text-2xl">add_photo_alternate</span>
                <span className="mt-0.5 block text-[10px] font-bold">选择关键帧</span>
              </span>
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 basis-48">
          <label className="block text-[11px] font-bold text-slate-600">
            段 Prompt
            <span className="ml-1 font-normal text-slate-400">(选填)</span>
            <textarea
              value={segment.prompt}
              maxLength={SEGMENT_PROMPT_MAX_LENGTH}
              onChange={(event) => onUpdate({ prompt: event.target.value })}
              className="mt-1 h-16 w-full resize-y rounded-md border border-slate-200 p-2 text-xs font-normal leading-5 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder={`描述第 ${position} 段的镜头运动与画面变化；留空则跟随首帧与商品事实`}
              aria-label={`第 ${position} 段 Prompt`}
            />
          </label>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              时长
              <select
                value={durationValid ? segment.duration : ''}
                onChange={(event) => onUpdate({ duration: Number(event.target.value) })}
                className={`h-7 rounded border bg-white px-1.5 text-[11px] font-bold text-slate-600 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10 ${
                  durationValid ? 'border-slate-200' : 'border-danger'
                }`}
                aria-label={`第 ${position} 段时长(秒)`}
              >
                {!durationValid && (
                  <option value="" disabled>
                    请选择
                  </option>
                )}
                {DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} 秒
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[10px] text-slate-400">
              {segment.prompt.length}/{SEGMENT_PROMPT_MAX_LENGTH}
            </span>
          </div>

          {!durationValid && (
            <p className="mt-1.5 text-[10px] font-bold text-danger">
              段时长需在 {MULTI_FRAME_DURATION_MIN}～{MULTI_FRAME_DURATION_MAX} 秒之间。
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
