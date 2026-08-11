import React, { useEffect, useMemo, useState } from 'react';
import type {
  ChannelAsyncTask,
  TaskGroupItemResponse,
  TaskGroupResponse,
  TaskResultPreviewResponse,
  TaskStatus,
} from '../types';
import { taskApi } from '../api/modules/task';
import { asyncTaskApi } from '../api/modules/asyncTask';
import { auditApi } from '../api/modules/audit';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { withCosThumbnail } from '../utils/cosImage';
import { ImagePreviewModal } from './ImagePreviewModal';
import { toast } from 'sonner';
import { creationTemplateApi } from '../api/modules/creationTemplate';
import { PublishTemplateDialog } from './common/PublishTemplateDialog';
import { ImageRevisionDialog } from './task/ImageRevisionDialog';
import { useAuth } from '../auth/AuthContext';
import { assetApi, type AssetResourceItem } from '../api/modules/asset';

interface TaskDetailsDrawerProps {
  group: TaskGroupResponse;
  initialTaskId?: string;
  onClose: () => void;
  onChanged?: () => void;
  /** 将某个已生成结果转换为产品素材后，带入对应创作页。 */
  onContinueWithResult?: (asset: AssetResourceItem) => void;
}

type DetailTab = 'details' | 'results' | 'diagnostics';

interface ReviewTarget {
  result: TaskResultPreviewResponse;
}

interface TemplatePublishTarget {
  result: TaskResultPreviewResponse;
  taskId: string;
  defaultName: string;
}

const STATUS_META: Record<TaskStatus, { label: string; style: string }> = {
  DRAFT: { label: '生成中', style: 'bg-blue-50 text-primary' },
  PENDING: { label: '生成中', style: 'bg-blue-50 text-primary' },
  GENERATING: { label: '生成中', style: 'bg-blue-50 text-primary' },
  PENDING_REVIEW_SCORE: { label: '待审美评分', style: 'bg-amber-50 text-amber-700' },
  PENDING_REVIEW_PUBLISH: { label: '待审美评分', style: 'bg-amber-50 text-amber-700' },
  ARCHIVED: { label: '审核通过', style: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: '已打回', style: 'bg-rose-50 text-rose-700' },
  CANCELED: { label: '生成失败', style: 'bg-red-50 text-red-700' },
  FAILED: { label: '生成失败', style: 'bg-red-50 text-red-700' },
};

const IMAGE_TYPE_LABELS: Record<string, string> = {
  PRODUCT_MAIN: '商品主图',
  SCENE_DETAIL: '详情/场景图',
  DETAIL_SCENE: '详情/场景图',
  DETAIL_CLOSEUP: '细节图',
  DETAIL: '细节图',
  MODEL_TRIPLE_VIEW: '模特三视图',
  ON_MODEL: '模特三视图',
  VIDEO: '视频任务',
};

const isActive = (status: TaskStatus) =>
  ['DRAFT', 'PENDING', 'GENERATING'].includes(status);

const taskLabel = (task: TaskGroupItemResponse) =>
  IMAGE_TYPE_LABELS[task.imageType ?? task.taskType] ?? task.title;

const formatDateTime = (value?: string | null) =>
  value ? value.replace('T', ' ').slice(0, 19) : '—';

const parseParams = (value?: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const resultPreviewUrl = (result: TaskResultPreviewResponse) =>
  result.mediaType === 'IMAGE'
    ? result.url
    : result.thumbnailUrl || result.url;

const RESULT_STATUS_LABELS: Record<string, string> = {
  PASSED: '审核通过',
  REJECTED: '已打回',
  UNAVAILABLE: '不可用',
  PENDING_SCORE: '待审美评分',
  PENDING_REVIEW: '待审美评分',
  ARCHIVED: '审核通过',
  待评分: '待审美评分',
  待审核: '待审美评分',
  通过: '审核通过',
  打回: '已打回',
};

const resultStatusLabel = (status?: string | null) =>
  status ? RESULT_STATUS_LABELS[status] ?? status : '已生成';

export const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({
  group: initialGroup,
  initialTaskId,
  onClose,
  onChanged,
  onContinueWithResult,
}) => {
  const { hasPermission } = useAuth();
  const canAudit = hasPermission('task:audit');
  const canRetryTask = hasPermission('task:retry');
  const canReviseTask = hasPermission('task:revise');
  const canManageTemplate = hasPermission('template:manage');
  const [group, setGroup] = useState(initialGroup);
  const [selectedTaskId, setSelectedTaskId] = useState(
    initialTaskId ?? initialGroup.tasks[0]?.id,
  );
  const [activeTab, setActiveTab] = useState<DetailTab>('results');
  const [imagePreview, setImagePreview] = useState<{ results: TaskResultPreviewResponse[]; index: number } | null>(null);
  const [videoPreview, setVideoPreview] = useState<TaskResultPreviewResponse | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [templatePublishTarget, setTemplatePublishTarget] = useState<TemplatePublishTarget | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<TaskResultPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedResultIds, setSavedResultIds] = useState<Set<string>>(new Set());
  const [savingResultId, setSavingResultId] = useState<string | null>(null);

  const selectedTask = group.tasks.find((task) => task.id === selectedTaskId)
    ?? group.tasks[0];

  const refreshGroup = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const detail = await taskApi.groupDetail(group.groupId);
      setGroup(detail);
      setSelectedTaskId((current) =>
        detail.tasks.some((task) => task.id === current) ? current : detail.tasks[0]?.id);
      onChanged?.();
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const resolveProductAsset = async (result: TaskResultPreviewResponse) => {
    setSavingResultId(result.id);
    try {
      const [asset] = await assetApi.resolveGenerated([{
        mediaType: result.mediaType,
        sourceId: result.id,
      }]);
      if (!asset) throw new Error('未返回可用素材');
      setSavedResultIds((current) => new Set(current).add(result.id));
      return asset;
    } finally {
      setSavingResultId(null);
    }
  };

  useEffect(() => {
    void refreshGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGroup.groupId]);

  useEffect(() => {
    if (!isActive(group.status) && !group.hasActiveRevision) return;
    const timer = window.setInterval(() => void refreshGroup(true), 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.groupId, group.status, group.hasActiveRevision]);

  if (!selectedTask) return null;
  const meta = STATUS_META[selectedTask.status];

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/35" onClick={onClose} />
      <section className="relative flex h-full w-full max-w-6xl flex-col bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="font-mono text-[11px] font-bold text-primary">批次详情 · {group.groupId}</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">{group.productName}</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              提交时间：{formatDateTime(group.submittedAt)} · {group.taskCount} 个业务子任务 · {group.resultCount} 个产物
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refreshGroup()}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
              title="刷新批次"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center text-slate-500" aria-label="关闭">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r border-slate-200 bg-white p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">批次内任务</p>
            <div className="space-y-2">
              {group.tasks.map((task) => {
                const taskMeta = STATUS_META[task.status];
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedTask.id === task.id
                        ? 'border-primary bg-blue-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-xs text-slate-800">{taskLabel(task)}</b>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${taskMeta.style}`}>
                        {taskMeta.label}
                      </span>
                    </div>
                    <p className="mt-2 truncate font-mono text-[9px] text-slate-400">{task.taskCode || task.id}</p>
                    <div className="mt-2 h-1 overflow-hidden rounded bg-slate-100">
                      <div className="h-full bg-primary" style={{ width: `${task.progressPercent}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5 pt-3">
              {([
                ['details', '详情'],
                ['results', `生成结果 (${selectedTask.resultPreviews.length})`],
                ['diagnostics', '执行诊断'],
              ] as Array<[DetailTab, string]>).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`border-b-2 px-4 py-3 text-xs font-bold ${
                    activeTab === id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
              {activeTab === 'details' && (
                <div className="space-y-5">
                  <OverviewTab group={group} task={selectedTask} meta={meta} />
                  <InputsTab group={group} task={selectedTask} />
                </div>
              )}
              {activeTab === 'results' && (
                <ResultsTab
                  task={selectedTask}
                  onPreviewImages={(results, index) => setImagePreview({ results, index })}
                  onPreviewVideo={setVideoPreview}
                  onReview={(result) => canAudit && setReviewTarget({ result })}
                  onRevise={(result) => canReviseTask && setRevisionTarget(result)}
                  onRevisionRetry={async (taskId) => {
                    if (!canRetryTask) return;
                    await taskApi.retryImageRevision(taskId);
                    toast.success('已重新提交二次编辑任务');
                    await refreshGroup();
                  }}
                  onPublishTemplate={(result) => canManageTemplate && setTemplatePublishTarget({
                    result,
                    taskId: result.taskId,
                    defaultName: `${taskLabel(selectedTask)}模板`,
                  })}
                  onOfflineTemplate={async (result) => {
                    if (!canManageTemplate) return;
                    if (!result.creationTemplateId) return;
                    try {
                      await creationTemplateApi.offline(result.creationTemplateId);
                      toast.success('模板已下架');
                      await refreshGroup();
                    } catch {
                      // 统一请求层展示具体错误。
                    }
                  }}
                  onSaveToProduct={async (result) => {
                    await resolveProductAsset(result);
                    toast.success('已保存到产品素材');
                  }}
                  onContinueWithResult={async (result) => {
                    const asset = await resolveProductAsset(result);
                    onContinueWithResult?.(asset);
                  }}
                  canSaveToProduct={Boolean(group.productId)}
                  savedResultIds={savedResultIds}
                  savingResultId={savingResultId}
                  canAudit={canAudit}
                  canRetry={canRetryTask}
                  canRevise={canReviseTask}
                  canManageTemplate={canManageTemplate}
                />
              )}
              {activeTab === 'diagnostics' && (
                <DiagnosticsTab task={selectedTask} onTaskChanged={() => void refreshGroup()} />
              )}
            </div>
          </main>
        </div>
      </section>

      {imagePreview && (
        <ImagePreviewModal
          images={imagePreview.results.map((result, index) => ({
            url: result.url,
            label: `${taskLabel(selectedTask)} · 产物 ${index + 1}`,
          }))}
          initialIndex={imagePreview.index}
          onClose={() => setImagePreview(null)}
        />
      )}
      {videoPreview && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/75 p-6" onClick={() => setVideoPreview(null)}>
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              onClick={() => setVideoPreview(null)}
              className="absolute -right-2 -top-10 text-white"
              aria-label="关闭视频预览"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <video src={videoPreview.url} controls autoPlay className="max-h-[82vh] w-full bg-black object-contain" />
          </div>
        </div>
      )}
      {reviewTarget && (
        <ReviewDialog
          target={reviewTarget.result}
          onClose={() => setReviewTarget(null)}
          onCompleted={async () => {
            setReviewTarget(null);
            await refreshGroup();
          }}
        />
      )}
      {revisionTarget && (
        <ImageRevisionDialog
          source={revisionTarget}
          task={selectedTask}
          onClose={() => setRevisionTarget(null)}
          onSubmitted={async () => {
            setRevisionTarget(null);
            await refreshGroup();
          }}
        />
      )}
      <PublishTemplateDialog
        open={templatePublishTarget !== null}
        defaultName={templatePublishTarget?.defaultName ?? '我的创作模板'}
        onClose={() => setTemplatePublishTarget(null)}
        onConfirm={async (templateName) => {
          if (!templatePublishTarget) return;
          await creationTemplateApi.publishFromResult({
            taskId: templatePublishTarget.taskId,
            resultId: templatePublishTarget.result.id,
            mediaType: templatePublishTarget.result.mediaType,
            templateName,
          });
          toast.success('已设为模板并发布到模板营地');
          setTemplatePublishTarget(null);
          await refreshGroup();
        }}
      />
    </div>
  );
};

const OverviewTab: React.FC<{
  group: TaskGroupResponse;
  task: TaskGroupItemResponse;
  meta: { label: string; style: string };
}> = ({ group, task, meta }) => {
  const params = useMemo(() => parseParams(task.taskParamsJson), [task.taskParamsJson]);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <InfoCard label="任务状态">
          <span className={`inline-block rounded-md px-2 py-1 text-xs font-bold ${meta.style}`}>{meta.label}</span>
        </InfoCard>
        <InfoCard label="生成进度" value={`${task.progressPercent}%`} />
        <InfoCard label="模型通道" value={task.modelChannelName || task.modelChannelId || '未记录'} />
        <InfoCard label="模型名称" value={task.modelCode || '未记录'} />
        <InfoCard label="产物数量" value={`${task.resultPreviews.length} / ${task.count ?? 0}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black text-slate-800">任务配置</h3>
          <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
            <InfoRow label="业务类型" value={taskLabel(task)} />
            <InfoRow label="生成比例" value={task.aspectRatio || String(params.aspect_ratio ?? '—')} />
            <InfoRow label="模板" value={task.templateName || group.templateName || '未使用模板'} />
            <InfoRow label="提交时间" value={formatDateTime(task.createTime)} />
            <InfoRow label="预估成本" value={task.estimatedCost == null ? '—' : `${task.estimatedCost} Pts`} />
            <InfoRow label="实际成本" value={task.actualCost == null ? '—' : `${task.actualCost} Pts`} />
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black text-slate-800">关联商品</h3>
          <div className="mt-4 flex items-center gap-3">
            {group.productImage ? (
              <img
                src={withCosThumbnail(group.productImage, 200)}
                alt={group.productName}
                className="block h-24 w-24 rounded-lg border border-slate-200 bg-white p-2 object-contain object-center"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-lg bg-slate-100 text-slate-300">
                <span className="material-symbols-outlined text-3xl">inventory_2</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-800">{group.productName}</p>
              <p className="mt-2 font-mono text-[10px] text-slate-400">商品 ID：{group.productId || '未绑定'}</p>
            </div>
          </div>
        </section>
      </div>

      {task.status === 'FAILED' && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-black text-red-800">失败原因</h3>
          <p className="mt-2 text-xs leading-6 text-red-700">{task.failReason || '后端未记录失败原因'}</p>
          {task.failCode && <p className="mt-1 font-mono text-[10px] text-red-500">{task.failCode}</p>}
        </section>
      )}
    </div>
  );
};

const ResultsTab: React.FC<{
  task: TaskGroupItemResponse;
  onPreviewImages: (results: TaskResultPreviewResponse[], index: number) => void;
  onPreviewVideo: (result: TaskResultPreviewResponse) => void;
  onReview: (result: TaskResultPreviewResponse) => void;
  onRevise: (result: TaskResultPreviewResponse) => void;
  onRevisionRetry: (taskId: string) => Promise<void>;
  onPublishTemplate: (result: TaskResultPreviewResponse) => void;
  onOfflineTemplate: (result: TaskResultPreviewResponse) => Promise<void>;
  onSaveToProduct: (result: TaskResultPreviewResponse) => Promise<void>;
  onContinueWithResult: (result: TaskResultPreviewResponse) => Promise<void>;
  canSaveToProduct: boolean;
  savedResultIds: Set<string>;
  savingResultId: string | null;
  canAudit: boolean;
  canRetry: boolean;
  canRevise: boolean;
  canManageTemplate: boolean;
}> = ({
  task,
  onPreviewImages,
  onPreviewVideo,
  onReview,
  onRevise,
  onRevisionRetry,
  onPublishTemplate,
  onOfflineTemplate,
  onSaveToProduct,
  onContinueWithResult,
  canSaveToProduct,
  savedResultIds,
  savingResultId,
  canAudit,
  canRetry,
  canRevise,
  canManageTemplate,
}) => {
  const imageResults = task.resultPreviews.filter((result) => result.mediaType === 'IMAGE');
  const revisionJobs = task.revisionJobs ?? [];
  if (task.resultPreviews.length === 0 && revisionJobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
        {isActive(task.status) ? `正在生成，当前进度 ${task.progressPercent}%` : '当前任务暂无产物'}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {task.resultPreviews.map((result, index) => {
        const imageIndex = imageResults.findIndex((item) => item.id === result.id);
        return (
          <article key={result.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => result.mediaType === 'VIDEO'
                ? onPreviewVideo(result)
                : onPreviewImages(imageResults, imageIndex)}
              className="relative flex h-64 w-full items-center justify-center overflow-hidden bg-slate-100 p-3"
            >
              <img
                src={withCosThumbnail(resultPreviewUrl(result), 720)}
                alt={`产物 ${index + 1}`}
                className="max-h-full max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
              {result.mediaType === 'VIDEO' && (
                <span className="material-symbols-outlined absolute text-5xl text-white drop-shadow-lg">play_circle</span>
              )}
              {result.mediaType === 'IMAGE' && (
                <span className="absolute left-3 top-3 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-black text-white">
                  V{result.revisionNo ?? 1}
                </span>
              )}
            </button>
            <div className="p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <b className="block truncate text-xs text-slate-800">产物 #{index + 1}</b>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-4 text-slate-400">
                    <span className="whitespace-nowrap">
                      {result.mediaType === 'IMAGE' ? '图片' : '视频'}
                    </span>
                    <span className="whitespace-nowrap">批次 {result.batchIdx ?? index}</span>
                    {result.score != null && (
                      <span className="whitespace-nowrap">{result.score} 分</span>
                    )}
                  </div>
                  {result.editInstruction && (
                    <p
                      className="mt-2 line-clamp-2 break-words text-[10px] leading-4 text-slate-500"
                      title={result.editInstruction}
                    >
                      编辑要求：{result.editInstruction}
                    </p>
                  )}
                </div>
                <span className="shrink-0 whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-[10px] font-bold leading-4 text-slate-600">
                  {resultStatusLabel(result.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
                {canSaveToProduct && (
                  <>
                    <button
                      onClick={() => void onSaveToProduct(result)}
                      disabled={savingResultId === result.id || savedResultIds.has(result.id)}
                      className="inline-flex h-7 shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-700 hover:border-emerald-400 disabled:cursor-default disabled:opacity-70"
                    >
                      <span className="material-symbols-outlined text-xs">{savedResultIds.has(result.id) ? 'check' : 'add_to_photos'}</span>
                      {savedResultIds.has(result.id) ? '已入产品素材' : savingResultId === result.id ? '保存中…' : '保存到产品素材'}
                    </button>
                    <button
                      onClick={() => void onContinueWithResult(result)}
                      disabled={savingResultId === result.id}
                      className="inline-flex h-7 shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-slate-200 px-2 text-[10px] font-bold text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-xs">auto_awesome</span>
                      继续创作
                    </button>
                  </>
                )}
                {canRevise && result.mediaType === 'IMAGE' && (
                  <button
                    onClick={() => onRevise(result)}
                    className="inline-flex h-7 shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-primary/25 bg-blue-50 px-2 text-[10px] font-bold text-primary hover:border-primary"
                  >
                    <span className="material-symbols-outlined text-xs">brush</span>
                    二次编辑
                  </button>
                )}
                {canAudit && result.score == null && (
                    <button
                      onClick={() => onReview(result)}
                      className="h-7 shrink-0 whitespace-nowrap rounded bg-primary px-2 text-[10px] font-bold text-white"
                    >
                      评分与审核
                    </button>
                )}
                {canManageTemplate && (result.templateStatus === 'PUBLISHED' ? (
                  <button
                    onClick={() => void onOfflineTemplate(result)}
                    className="inline-flex h-7 shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-[#dfc6a4] bg-[#fff8ec] px-2 text-[10px] font-bold text-[#93652d] hover:bg-[#fff0d8]"
                  >
                    <span className="material-symbols-outlined text-xs">archive</span>
                    下架模板
                  </button>
                ) : result.status !== 'REJECTED' && (
                  <button
                    onClick={() => onPublishTemplate(result)}
                    className="h-7 shrink-0 whitespace-nowrap rounded border border-slate-200 px-2 text-[10px] font-bold text-slate-700 hover:border-primary hover:text-primary"
                  >
                    设为模板
                  </button>
                ))}
              </div>
            </div>
            {result.rejectReason && (
              <p className="break-words border-t border-red-100 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-700">
                打回原因：{result.rejectReason}
              </p>
            )}
          </article>
        );
      })}
      {revisionJobs.map((job) => (
        <article
          key={job.taskId}
          className={`overflow-hidden rounded-xl border bg-white ${
            job.status === 'FAILED' ? 'border-red-200' : 'border-blue-200'
          }`}
        >
          <div className="grid h-64 place-items-center bg-slate-100 p-6 text-center">
            <div>
              <span className={`material-symbols-outlined text-5xl ${
                job.status === 'FAILED' ? 'text-red-400' : 'animate-spin text-primary'
              }`}>
                {job.status === 'FAILED' ? 'error' : 'progress_activity'}
              </span>
              <p className="mt-3 text-xs font-black text-slate-700">
                V{job.revisionNo} {job.status === 'FAILED' ? '生成失败' : '正在生成'}
              </p>
              {job.failReason && (
                <p className="mt-2 line-clamp-3 break-words text-[10px] leading-5 text-red-600">
                  {job.failReason}
                </p>
              )}
            </div>
          </div>
          <div className="p-3">
            <p className="break-words text-[10px] leading-5 text-slate-500">
              编辑要求：{job.editInstruction || '未记录'}
            </p>
            {canRetry && job.status === 'FAILED' && (
              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                <button
                  onClick={async () => {
                    await onRevisionRetry(job.taskId);
                  }}
                  className="h-8 rounded bg-primary px-3 text-[11px] font-bold text-white"
                >
                  重试
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

const InputsTab: React.FC<{ group: TaskGroupResponse; task: TaskGroupItemResponse }> = ({ group, task }) => {
  const inputVideos = task.inputVideos ?? [];
  const inputUrls = useMemo(() => {
    const structuredImages = (task.inputImages ?? []).filter(
      (url) => !/\.(mp4|mov|webm|avi)(?:$|[?#])/i.test(url),
    );
    const urls = structuredImages.length > 0 ? [...structuredImages] : [];
    if (urls.length === 0) {
      task.inputImageUrls?.split(',').map((url) => url.trim()).filter(Boolean).forEach((url) => {
        if (!/\.(mp4|mov|webm|avi)(?:$|[?#])/i.test(url) && !urls.includes(url)) {
          urls.push(url);
        }
      });
    }
    if (group.productImage && !urls.includes(group.productImage)) urls.unshift(group.productImage);
    return urls;
  }, [group.productImage, task.inputImages, task.inputImageUrls]);
  const params = useMemo(() => parseParams(task.taskParamsJson), [task.taskParamsJson]);
  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label}已复制`);
  };
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-black text-slate-800">输入素材</h3>
        {inputVideos.length > 0 || inputUrls.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {inputVideos.map((url, index) => (
              <div
                key={`video-${url}-${index}`}
                className="relative flex aspect-square w-full min-w-0 items-center justify-center overflow-hidden rounded-lg bg-black"
              >
                <video
                  src={url}
                  controls
                  preload="metadata"
                  className="h-full w-full object-contain"
                />
                <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
                  复刻原视频
                </span>
              </div>
            ))}
            {inputUrls.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="flex aspect-square w-full min-w-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-2"
              >
                <img
                  src={withCosThumbnail(url, 360)}
                  alt={`输入素材 ${index + 1}`}
                  className="min-h-0 min-w-0 max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-400">该历史任务未记录输入素材地址。</p>
        )}
      </section>

      <PromptBlock
        label="最终 Prompt"
        value={task.taskPrompt || ''}
        onCopy={() => void copyText(task.taskPrompt || '', 'Prompt')}
      />
      <PromptBlock
        label="负面 Prompt"
        value={task.negativePrompt || ''}
        onCopy={() => void copyText(task.negativePrompt || '', '负面 Prompt')}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-black text-slate-800">执行参数快照</h3>
        {Object.keys(params).length ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(params).map(([key, value]) => (
              <InfoRow key={key} label={key} value={String(value)} />
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-xs text-slate-400">未记录执行参数。</p>
        )}
      </section>
    </div>
  );
};

const DiagnosticsTab: React.FC<{
  task: TaskGroupItemResponse;
  onTaskChanged: () => void;
}> = ({ task, onTaskChanged }) => {
  const { hasPermission } = useAuth();
  const canRetryTask = hasPermission('task:retry');
  const executionsQuery = useServiceQuery(
    () => asyncTaskApi.page({ bizId: task.id, page: 1, size: 50 }),
    [task.id],
  );
  const executions = executionsQuery.data?.list ?? [];

  const retryBusinessTask = async () => {
    if (!canRetryTask) return;
    try {
      await taskApi.retry(task.id);
      toast.success('任务已重新提交');
      onTaskChanged();
    } catch {
      // 统一请求层已经提示具体错误
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800">业务任务诊断</h3>
            <p className="mt-1 font-mono text-[10px] text-slate-400">{task.taskCode || task.id}</p>
          </div>
          {canRetryTask && task.status === 'FAILED' && (
            <button onClick={() => void retryBusinessTask()} className="h-8 rounded-lg bg-primary px-3 text-xs font-bold text-white">
              重试业务任务
            </button>
          )}
        </div>
        <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
          <InfoRow label="失败代码" value={task.failCode || '—'} />
          <InfoRow label="失败原因" value={task.failReason || '—'} />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800">渠道执行记录</h3>
            <p className="mt-1 text-[10px] text-slate-400">仅用于执行排查，不作为任务列表主层级。</p>
          </div>
          <button
            onClick={() => executionsQuery.refetch()}
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
        {executionsQuery.error && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            当前账号无权查看渠道执行记录，业务任务和产物不受影响。
          </p>
        )}
        {!executionsQuery.loading && !executionsQuery.error && executions.length === 0 && (
          <p className="mt-4 text-xs text-slate-400">暂无渠道执行记录。</p>
        )}
        <div className="mt-4 space-y-3">
          {executions.map((execution) => (
            <ExecutionCard key={execution.id} execution={execution} onChanged={executionsQuery.refetch} />
          ))}
        </div>
      </section>
    </div>
  );
};

const ExecutionCard: React.FC<{ execution: ChannelAsyncTask; onChanged: () => void }> = ({ execution, onChanged }) => {
  const { hasPermission } = useAuth();
  const canRetryAsyncTask = hasPermission('async-task:retry');
  const retry = async () => {
    if (!canRetryAsyncTask) return;
    try {
      await asyncTaskApi.retry(execution.id);
      toast.success('渠道执行已重试');
      onChanged();
    } catch {
      // 请求层提示
    }
  };
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-800">
              {execution.channelType} · {execution.capability}
            </p>
            <p className="mt-1 font-mono text-[10px] text-slate-400">
              #{execution.id} · remote {execution.remoteTaskId || '未提交'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-white px-2 py-1 text-[10px] font-bold text-slate-600">{execution.status}</span>
            {canRetryAsyncTask && ['FAILED', 'DEAD_LETTER'].includes(execution.status) && (
              <button onClick={(event) => { event.preventDefault(); void retry(); }} className="h-7 rounded bg-primary px-2 text-[10px] font-bold text-white">
                重试
              </button>
            )}
          </div>
        </div>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-[11px] text-slate-600 sm:grid-cols-2">
        <InfoRow label="开始时间" value={formatDateTime(execution.startedAt)} />
        <InfoRow label="结束时间" value={formatDateTime(execution.finishedAt)} />
        <InfoRow label="重试次数" value={String(execution.retryCount)} />
        <InfoRow label="产物数量" value={String(execution.resultCount)} />
        <div className="sm:col-span-2">
          <InfoRow label="失败原因" value={execution.failReason || '—'} />
        </div>
      </div>
    </details>
  );
};

const DEFECT_TAGS = ['主体漂移', '色彩失真', '构图问题', '细节缺失', '人物扭曲'];
const ADVANTAGE_TAGS = ['主体准确', '风格一致', '构图自然', '细节清晰', '商业可用'];

const ReviewDialog: React.FC<{
  target: TaskResultPreviewResponse;
  onClose: () => void;
  onCompleted: () => Promise<void>;
}> = ({ target, onClose, onCompleted }) => {
  const { hasPermission } = useAuth();
  const canAudit = hasPermission('task:audit');
  const [rating, setRating] = useState(Math.round(target.score ?? 4));
  const [defectTags, setDefectTags] = useState<string[]>([]);
  const [advantageTags, setAdvantageTags] = useState<string[]>([]);
  const [note, setNote] = useState(target.rejectReason ?? '');
  const [decision, setDecision] = useState<'PASSED' | 'REJECTED'>('PASSED');
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (
    tag: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => setter((current) =>
    current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag]);

  const submit = async () => {
    if (!canAudit) return;
    if (decision === 'REJECTED' && !note.trim()) {
      toast.error('打回时必须填写审核原因');
      return;
    }
    setSubmitting(true);
    try {
      await auditApi.submitScore({
        mediaType: target.mediaType,
        generatedImageId: target.mediaType === 'IMAGE' ? target.id : undefined,
        generatedVideoId: target.mediaType === 'VIDEO' ? target.id : undefined,
        overallScore: rating,
        defectTags: defectTags.join(',') || undefined,
        advantageTags: advantageTags.join(',') || undefined,
        optimizationNote: note.trim() || undefined,
        reviewConclusion: decision,
      });
      toast.success(decision === 'PASSED' ? '评分审核已通过' : '产物已打回');
      await onCompleted();
    } catch {
      // 统一请求层展示具体错误
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <section className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold text-primary">
              {target.mediaType === 'VIDEO' ? '视频' : '图片'}单件评分与审核
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-900">产物 #{target.batchIdx ?? target.id}</h2>
          </div>
          <button onClick={onClose} className="material-symbols-outlined text-slate-400" aria-label="关闭审核">
            close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-72 items-center justify-center overflow-hidden bg-slate-100 p-4">
            {target.mediaType === 'VIDEO' ? (
              <video
                src={target.url}
                poster={withCosThumbnail(target.thumbnailUrl ?? undefined, 960)}
                controls
                preload="metadata"
                className="max-h-[65vh] max-w-full bg-black object-contain"
              />
            ) : (
              <img
                src={withCosThumbnail(target.url, 960)}
                alt="待审核图片产物"
                className="max-h-[65vh] max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          <aside className="space-y-5 overflow-y-auto p-5">
            <div>
              <p className="text-xs font-black text-slate-800">审核决定</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDecision('PASSED')}
                  className={`h-10 rounded text-xs font-bold ${
                    decision === 'PASSED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  通过
                </button>
                <button
                  onClick={() => setDecision('REJECTED')}
                  className={`h-10 rounded text-xs font-bold ${
                    decision === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  打回
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-slate-800">综合评分 {rating} / 5</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setRating(value)}
                    className={`material-symbols-outlined text-3xl ${
                      value <= rating ? 'text-amber-400' : 'text-slate-300'
                    }`}
                    aria-label={`评分 ${value}`}
                  >
                    star
                  </button>
                ))}
              </div>
            </div>
            <TagSelector
              label="问题标签"
              tags={DEFECT_TAGS}
              selected={defectTags}
              onToggle={(tag) => toggleTag(tag, setDefectTags)}
              activeClass="border-red-300 bg-red-50 text-red-700"
            />
            <TagSelector
              label="优点标签"
              tags={ADVANTAGE_TAGS}
              selected={advantageTags}
              onToggle={(tag) => toggleTag(tag, setAdvantageTags)}
              activeClass="border-emerald-300 bg-emerald-50 text-emerald-700"
            />

            <label className="block text-xs font-black text-slate-800">
              {decision === 'REJECTED' ? '打回原因' : '审核意见'}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-200 p-3 text-xs font-normal leading-5 outline-none focus:border-primary"
                placeholder={decision === 'REJECTED'
                  ? '请填写明确的打回原因'
                  : '可填写评价或说明'}
              />
            </label>
          </aside>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button onClick={onClose} disabled={submitting} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold">
            取消
          </button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="h-9 rounded-lg bg-primary px-5 text-xs font-bold text-white disabled:opacity-50"
          >
            {submitting ? '提交中…' : '提交决策评分'}
          </button>
        </footer>
      </section>
    </div>
  );
};

const TagSelector: React.FC<{
  label: string;
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  activeClass: string;
}> = ({ label, tags, selected, onToggle, activeClass }) => (
  <div>
    <p className="text-xs font-black text-slate-800">{label}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onToggle(tag)}
          className={`rounded border px-2.5 py-1.5 text-[11px] font-bold ${
            selected.includes(tag) ? activeClass : 'border-slate-200 text-slate-500'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  </div>
);

const InfoCard: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <div className="mt-2 text-sm font-black text-slate-800">{children ?? value ?? '—'}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-[10px] font-bold text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-xs font-semibold text-slate-700">{value}</dd>
  </div>
);

const PromptBlock: React.FC<{ label: string; value: string; onCopy: () => void }> = ({ label, value, onCopy }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-black text-slate-800">{label}</h3>
      <button
        disabled={!value}
        onClick={onCopy}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-sm">content_copy</span>
        复制
      </button>
    </div>
    <p className="mt-4 whitespace-pre-wrap text-xs leading-6 text-slate-600">{value || '未记录'}</p>
  </section>
);
