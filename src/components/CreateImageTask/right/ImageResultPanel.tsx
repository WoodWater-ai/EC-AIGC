import React, { useState } from 'react';
import { Images, Loader2, Sparkles } from 'lucide-react';
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
  SCENE_DETAIL: '场景图',
  DETAIL_CLOSEUP: '细节图',
  MODEL_TRIPLE_VIEW: '模特三视图',
  product_main: '商品主图',
  scene_detail: '场景图',
  detail_closeup: '细节图',
  model_triple_view: '模特三视图',
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
  onGenerate: () => void;
  /** [2026-08-15] 提交后右侧结果状态:idle=未提交 / loading=生成中(轮询) / done=全部任务结束 */
  submitStatus: 'idle' | 'loading' | 'done';
  submitGroups: SubmitGroup[];
  submitError?: string | null;
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
  onGenerate,
  submitStatus,
  submitGroups,
  submitError,
}) => {
  // [2026-08-15] 点击图片打开大图预览(无放大镜按钮,直接点图)
  const [preview, setPreview] = useState<{ groupIndex: number; imageIndex: number } | null>(null);
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

  // [2026-08-15] 加载态分组:优先用后端已返回的任务分组;首帧未返回前用 typeCounts 占位
  const loadingGroups: SubmitGroup[] = submitGroups.length > 0
    ? submitGroups
    : (Object.entries(typeCounts) as [ImageGenerationType, number][])
        .filter(([, count]) => count > 0)
        .map(([imageType, count]) => ({
          imageType,
          taskStatus: 'GENERATING' as TaskStatus,
          count,
          previews: [],
        }));

  return (
    <section id="image-result-panel" className="flex min-h-[540px] h-full flex-col overflow-hidden rounded-[7px] border border-[#dfe3e8] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e8ed] px-3 py-3">
        <h2 className="text-xs font-black">本次生成结果</h2>
        <span className="flex items-center gap-1.5">
          <span className={`px-2 py-1 text-[9px] font-bold ${badge.cls}`}>
            {badge.text}
          </span>
          {submitStatus === 'done' && abnormalCount > 0 && (
            <span className="px-2 py-1 text-[9px] font-bold rounded bg-red-50 text-red-600">
              异常 {abnormalCount} 张
            </span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {submitStatus === 'idle' && (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              <Images className="h-6 w-6" />
            </span>
            <p className="mt-3 text-xs font-black text-slate-700">结果将在这里显示</p>
            <p className="mt-2 max-w-56 text-[10px] leading-5 text-slate-400">
              提交后可离开页面，任务会在后台继续；任务列表会自动恢复进度与最终结果。
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
                  <div className="grid grid-cols-2 gap-2">
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
                <p className="mt-1 text-[10px]">可前往任务列表查看详情</p>
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
                  <div className="grid grid-cols-2 gap-2">
                    {group.previews.map((result, imageIndex) => (
                      <button
                        key={result.id}
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
                    ))}
                  </div>
                ) : (
                  <p className="rounded bg-slate-50 px-2 py-2 text-[10px] text-slate-400">
                    该类型暂无产物{statusLabel(group.taskStatus) === '失败' ? '（任务失败）' : '，稍后可在任务列表查看'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {submitError && (
          <div className="px-3 pb-2">
            <p className="rounded bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-600">
              结果刷新失败：{submitError}（将在任务列表中查看）
            </p>
          </div>
        )}

        <dl className="mx-3 mb-3 border-y border-slate-100 py-3 text-left text-[10px]">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">图片类型</dt>
            <dd className="font-bold text-slate-700">{selectedTypes.length} 类</dd>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <dt className="text-slate-400">生成数量</dt>
            <dd className="font-bold text-slate-700">{totalCount} 张</dd>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <dt className="text-slate-400">模型</dt>
            <dd className="max-w-40 truncate font-bold text-slate-700" title={params.modelId ?? ''}>
              {params.modelId || '等待默认路由'}
            </dd>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <dt className="text-slate-400">输出规格</dt>
            <dd className="font-bold text-slate-700">{outputSpec(params)}</dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-[#e5e8ed] p-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={submitStatus === 'loading'}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#df5b43] text-xs font-bold text-white hover:bg-[#cb4d37] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitStatus === 'loading' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> 生成中…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> 检查并生成 {totalCount} 张</>
          )}
        </button>
        <p className="mt-2 text-center text-[9px] leading-4 text-slate-400">
          提交前会展示完整校验、耗时与失败处理策略。
        </p>
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
