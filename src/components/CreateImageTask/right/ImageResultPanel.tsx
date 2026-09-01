import React, { useEffect, useState } from 'react';
import { Copy, Images, Loader2, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { withCosThumbnail } from '../../../utils/cosImage';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import type { TaskParamsSnapshot } from './ImageSettingsSection';
import type { TaskResultPreviewResponse, TaskStatus } from '../../../types';
import { ImagePreviewModal } from '../../ImagePreviewModal';

/** [2026-08-15] 结果状态中文映射(覆盖生成/审核状态与历史中文值) */
const RESULT_STATUS_LABELS: Record<string, string> = {
  PENDING: '待生成',
  GENERATING: '生成中',
  SUCCESS: '成功',
  FAILED: '失败',
  CANCELED: '已取消',
  DRAFT: '草稿',
  PENDING_REVIEW_SCORE: '待审美评分',
  PENDING_REVIEW_PUBLISH: '待发布',
  PENDING_SCORE: '待审美评分',
  PENDING_REVIEW: '待审美评分',
  PASSED: '审核通过',
  ARCHIVED: '已归档',
  REJECTED: '已打回',
  UNAVAILABLE: '不可用',
  待评分: '待审美评分',
  待审核: '待审美评分',
  通过: '审核通过',
  打回: '已打回',
};

const statusLabel = (status: string | null | undefined): string =>
  status ? (RESULT_STATUS_LABELS[status] ?? status) : '待审核';

/** 任务是否仍在生成中(占位骨架只对进行中的类型显示) */
const isActiveTask = (status: TaskStatus): boolean =>
  ['DRAFT', 'PENDING', 'GENERATING'].includes(status);

/** 异常产物状态(失败/打回/取消/不可用;含中文兜底) */
const ABNORMAL_STATUSES = new Set(['FAILED', 'REJECTED', 'CANCELED', 'UNAVAILABLE', '失败', '打回']);
/** 任务失败终态(无产物时按期望张数计入异常) */
const FAIL_TASK_STATUSES: TaskStatus[] = ['FAILED', 'REJECTED', 'CANCELED'];

/** [2026-08-15] 图片类型中文(后端大写枚举 + 前端小写兜底) */
const IMAGE_TYPE_LABELS: Record<string, string> = {
  PRODUCT_MAIN: '商品主图',
  SCENE_DETAIL: '场景主图',
  DETAIL_CLOSEUP: '细节图',
  MODEL_TRIPLE_VIEW: '模特三视图',
  PRODUCT_DETAIL: '详情图',
  product_main: '商品主图',
  scene_detail: '场景主图',
  detail_closeup: '细节图',
  model_triple_view: '模特三视图',
  product_detail: '详情图',
};

export interface SubmitGroup {
  imageType: string;
  taskStatus: TaskStatus;
  /** 该类型期望生成张数(loading 时用于占位个数) */
  count: number;
  previews: TaskResultPreviewResponse[];
}

interface ImageResultPanelProps {
  selectedTypes: ImageGenerationType[];
  /** [2026-08-15] 各类型生成张数,加载态首帧(分组数据未返回前)用于占位 */
  typeCounts: Record<ImageGenerationType, number>;
  totalCount: number;
  params: TaskParamsSnapshot;
  /** [2026-08-15] 提交后右侧结果状态:idle=未提交 / loading=生成中(轮询) / done=全部任务结束 */
  submitStatus: 'idle' | 'loading' | 'done';
  submitGroups: SubmitGroup[];
  submitError?: string | null;
  taskId?: string | null;
  initialPositivePrompt?: string;
  initialNegativePrompt?: string;
  onContinueEditing?: (draft: { positivePrompt: string; negativePrompt: string }) => void;
  onDraftChange?: (draft: { positivePrompt: string; negativePrompt: string }) => void;
  continuing?: boolean;
}

const outputSpec = (params: TaskParamsSnapshot) => {
  const ratio = params.schemaParams?.aspect_ratio;
  const resolution = params.schemaParams?.resolution;
  return [ratio, resolution].filter(Boolean).join(' · ') || '等待模型参数';
};

export const ImageResultPanel: React.FC<ImageResultPanelProps> = ({
  selectedTypes,
  typeCounts,
  totalCount,
  params,
  submitStatus,
  submitGroups,
  submitError,
  taskId,
  initialPositivePrompt = '',
  initialNegativePrompt = '',
  onContinueEditing,
  onDraftChange,
  continuing = false,
}) => {
  // [2026-08-15] 点击图片打开大图预览(无放大镜按钮,直接点图)
  const [preview, setPreview] = useState<{ groupIndex: number; imageIndex: number } | null>(null);
  const [positivePrompt, setPositivePrompt] = useState(initialPositivePrompt);
  const [negativePrompt, setNegativePrompt] = useState(initialNegativePrompt);
  useEffect(() => {
    setPositivePrompt(initialPositivePrompt);
    setNegativePrompt(initialNegativePrompt);
  }, [initialNegativePrompt, initialPositivePrompt, taskId]);
  // [2026-08-15] 已完成 = 实际产物总数(状态多为审核态,不按 SUCCESS 过滤,否则永远 0)
  const producedCount = submitGroups.reduce((sum, g) => sum + g.previews.length, 0);
  // 异常 = 产物状态异常 + 失败任务(无产物时按其期望张数计入)
  const abnormalCount = submitGroups.reduce((sum, g) =>
    sum
    + g.previews.filter((r) => ABNORMAL_STATUSES.has(r.status ?? '')).length
    + (FAIL_TASK_STATUSES.includes(g.taskStatus) && g.previews.length === 0 ? g.count : 0),
  0);
  const badge = submitStatus === 'idle'
    ? { text: `待生成 · ${totalCount} 张`, cls: 'bg-amber-50 text-amber-700' }
    : submitStatus === 'loading'
      ? { text: `生成中 · ${totalCount} 张`, cls: 'bg-blue-50 text-blue-700' }
      : { text: `已完成 · ${producedCount} 张`, cls: 'bg-emerald-50 text-emerald-700' };

  const previewGroup = preview ? submitGroups[preview.groupIndex] : undefined;
  const previewImages = previewGroup?.previews ?? [];
  const copyPrompt = async (content: string, label: string) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success(`${label}已复制`);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  // [2026-08-15] 加载态分组:优先用后端已返回的任务分组;首帧未返回前用 typeCounts 占位
  const loadingGroups: SubmitGroup[] = submitGroups.length > 0
    ? submitGroups
    : (Object.entries(typeCounts) as [ImageGenerationType, number][])
        .filter(([imageType, count]) => selectedTypes.includes(imageType) && count > 0)
        .map(([imageType, count]) => ({
          imageType,
          taskStatus: 'GENERATING' as TaskStatus,
          count,
          previews: [],
        }));

  return (
    <section id="image-result-panel" className="flex min-h-[540px] h-full flex-col overflow-hidden border border-[#dfe3e8] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e8ed] px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-xs font-black">结果预览</h2>
          <span className="flex items-center gap-1.5">
            <span className={`px-2 py-1 text-[9px] font-bold ${badge.cls}`}>
              {badge.text}
            </span>
            {submitStatus === 'done' && abnormalCount > 0 && (
              <span className="rounded bg-red-50 px-2 py-1 text-[9px] font-bold text-red-600">
                异常 {abnormalCount} 张
              </span>
            )}
          </span>
          <span className="hidden text-[10px] font-bold text-slate-400 sm:inline">
            输出规格 {outputSpec(params)}
          </span>
        </div>
        {onContinueEditing && (
          <button
            type="button"
            onClick={() => onContinueEditing({ positivePrompt, negativePrompt })}
            disabled={continuing}
            className="flex h-8 shrink-0 items-center gap-1.5 border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {continuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PencilLine className="h-3.5 w-3.5" />}
            {continuing ? '带入中…' : '继续创作'}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {submitStatus === 'idle' && (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              <Images className="h-6 w-6" />
            </span>
            <p className="mt-3 text-xs font-black text-slate-700">结果将在这里显示</p>
            <p className="mt-2 max-w-56 text-[10px] leading-5 text-slate-400">
              提交后，生成结果会显示在这里。
            </p>
          </div>
        )}

        {submitStatus === 'loading' && (
          <div className="space-y-4 px-3 py-3">
            {loadingGroups.map((group) => (
              <div key={group.imageType}>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-700">
                    {IMAGE_TYPE_LABELS[group.imageType] ?? group.imageType}
                    <span className="ml-1.5 font-bold text-slate-400">
                      {group.previews.length} / {group.count} 张
                    </span>
                  </h3>
                </div>
                {group.previews.length === 0 && !isActiveTask(group.taskStatus) ? (
                  <p className="rounded bg-slate-50 px-2 py-2 text-[10px] text-slate-400">
                    该类型暂无产物{group.taskStatus === 'FAILED' ? '（任务失败）' : ''}
                  </p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,320px))] gap-3">
                    {group.previews.map((result, imageIndex) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => setPreview({ groupIndex: loadingGroups.indexOf(group), imageIndex })}
                        className="group relative flex aspect-square w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 transition hover:border-primary/60"
                        title="点击查看大图"
                      >
                        <img
                          src={withCosThumbnail(result.thumbnailUrl ?? result.url, 480) ?? result.url}
                          alt={statusLabel(result.status)}
                          className="min-h-0 min-w-0 max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      </button>
                    ))}
                    {isActiveTask(group.taskStatus) && Array.from({
                      length: Math.max(0, group.count - group.previews.length),
                    }).map((_, i) => (
                      <div
                        key={`loading-${i}`}
                        className="flex aspect-square w-full min-w-0 animate-pulse items-center justify-center rounded-lg border border-slate-100 bg-slate-100"
                      >
                        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {submitStatus === 'done' && (
          <div className="space-y-4 px-3 py-3">
            {submitGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <Images className="h-8 w-8" />
                <p className="mt-2 text-xs font-bold">本轮未获取到生成产物</p>
                <p className="mt-1 text-[10px]">请检查任务状态或稍后重试。</p>
              </div>
            )}
            {submitGroups.map((group, groupIndex) => (
              <div key={group.imageType}>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-700">
                    {IMAGE_TYPE_LABELS[group.imageType] ?? group.imageType}
                    <span className="ml-1.5 font-bold text-slate-400">{group.previews.length} 张</span>
                  </h3>
                  <span className="text-[9px] font-bold text-slate-400">
                    {statusLabel(group.taskStatus)}
                  </span>
                </div>
                {group.previews.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,320px))] gap-3">
                    {group.previews.map((result, imageIndex) => (
                      <div key={result.id} className="group relative aspect-square min-w-0">
                      <button
                        type="button"
                        onClick={() => setPreview({ groupIndex, imageIndex })}
                        className="group relative flex aspect-square w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 transition hover:border-primary/60 hover:shadow-sm"
                        title="点击查看大图"
                      >
                        <img
                          src={withCosThumbnail(result.thumbnailUrl ?? result.url, 480) ?? result.url}
                          alt={statusLabel(result.status)}
                          className="min-h-0 min-w-0 max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        {result.status !== 'SUCCESS' && (
                          <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {statusLabel(result.status)}
                          </span>
                        )}
                      </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded bg-slate-50 px-2 py-2 text-[10px] text-slate-400">
                    该类型暂无产物{statusLabel(group.taskStatus) === '失败' ? '（任务失败）' : '，请稍后重试'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {submitError && (
          <div className="px-3 pb-2">
            <p className="rounded bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-600">
              结果刷新失败：{submitError}，请稍后重试
            </p>
          </div>
        )}

      </div>

      <aside className="min-h-0 shrink-0 overflow-y-auto border-t border-slate-200 bg-slate-50/50 p-4 xl:w-[min(42%,520px)] xl:min-w-[400px] xl:border-l xl:border-t-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-black text-slate-800">编辑本轮提示词</h3>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-600">
              正面提示词
              <button
                type="button"
                onClick={() => void copyPrompt(positivePrompt, '正面提示词')}
                className="flex h-6 items-center gap-1 px-1.5 text-[9px] text-slate-400 hover:bg-white hover:text-primary"
              >
                <Copy className="h-3 w-3" />复制
              </button>
            </span>
            <textarea
              value={positivePrompt}
              onChange={(event) => {
                const value = event.target.value;
                setPositivePrompt(value);
                onDraftChange?.({ positivePrompt: value, negativePrompt });
              }}
              aria-label="结果页正面提示词"
              className="min-h-[520px] w-full resize-y border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700 outline-none focus:border-primary"
              placeholder="填写本轮希望保留或调整的创作要求"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-600">
              负面提示词
              <button
                type="button"
                onClick={() => void copyPrompt(negativePrompt, '负面提示词')}
                className="flex h-6 items-center gap-1 px-1.5 text-[9px] text-slate-400 hover:bg-white hover:text-primary"
              >
                <Copy className="h-3 w-3" />复制
              </button>
            </span>
            <textarea
              value={negativePrompt}
              onChange={(event) => {
                const value = event.target.value;
                setNegativePrompt(value);
                onDraftChange?.({ positivePrompt, negativePrompt: value });
              }}
              aria-label="结果页负面提示词"
              className="min-h-[140px] w-full resize-y border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700 outline-none focus:border-primary"
              placeholder="填写不希望出现的内容"
            />
          </label>
        </div>
      </aside>
      </div>

      {/* [2026-08-15] 点击结果图直接打开大图预览(无放大镜按钮) */}
      {preview && previewImages.length > 0 && (
        <ImagePreviewModal
          images={previewImages.map((result) => ({
            url: result.url,
            label: statusLabel(result.status),
          }))}
          initialIndex={Math.min(preview.imageIndex, previewImages.length - 1)}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
};
