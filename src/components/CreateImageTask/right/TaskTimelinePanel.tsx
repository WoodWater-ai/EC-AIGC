import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, CircleDashed, Image as ImageIcon, XCircle } from 'lucide-react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import type { TaskResultPreviewResponse, TaskStatus } from '../../../types';
import { taskApi } from '../../../api/modules/task';
import { AssetImage } from '../../AssetImage';

export interface ResultTaskSnapshot {
  /** 批次中用于恢复编辑上下文的原始图片任务。 */
  taskId: string | null;
  /** 原任务的 Prompt 类型，用于将结果页草稿回填到正确编辑器。 */
  promptType: ImageGenerationType | null;
  totalCount: number;
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  prompt: string;
  positivePrompt: string;
  negativePrompt: string;
  modelId: string | null;
  aspectRatio: string;
  resolution: string;
  referenceCount: number;
}

export interface TimelineTask {
  groupId: string;
  productId?: string | null;
  submittedAt: string;
  status: 'loading' | 'done';
  taskStatus: TaskStatus;
  progressPercent: number;
  resultCount: number;
  error: string | null;
  snapshot: ResultTaskSnapshot;
  /** 已知的批次结果预览；未传时由面板按 groupId 读取，兼容既有调用方。 */
  resultPreviews?: TaskResultPreviewResponse[];
}

interface TaskTimelinePanelProps {
  tasks: TimelineTask[];
  activeTaskId: string | null;
  onSelect: (groupId: string) => void;
  productName?: string;
  productImage?: string | null;
}

const IMAGE_TYPE_LABELS: Record<ImageGenerationType, string> = {
  product_main: '商品主图',
  scene_detail: '场景主图',
  detail_closeup: '细节图',
  model_triple_view: '三视图',
};

const MAX_VISIBLE_THUMBNAILS = 3;
const FAILED_TASK_STATUSES: TaskStatus[] = ['FAILED', 'REJECTED', 'CANCELED'];

const timeLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '刚刚提交';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit',
  }).format(date);
};

const isAbnormalTask = (task: TimelineTask): boolean =>
  Boolean(task.error) || FAILED_TASK_STATUSES.includes(task.taskStatus);

const taskState = (task: TimelineTask) => {
  if (isAbnormalTask(task)) {
    return { label: '异常', className: 'bg-red-50 text-red-600', Icon: XCircle };
  }
  if (task.status === 'loading') {
    return { label: `生成中 ${task.resultCount}/${task.snapshot.totalCount}`, className: 'bg-blue-50 text-blue-700', Icon: CircleDashed };
  }
  return { label: `已完成 ${task.resultCount}/${task.snapshot.totalCount}`, className: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 };
};

export const TaskTimelinePanel: React.FC<TaskTimelinePanelProps> = ({
  tasks,
  activeTaskId,
  onSelect,
  productName,
  productImage,
}) => {
  const [previewsByGroup, setPreviewsByGroup] = useState<Record<string, TaskResultPreviewResponse[]>>({});
  const fetchedResultCounts = useRef<Record<string, number>>({});
  const fetchingGroups = useRef<Set<string>>(new Set());

  useEffect(() => {
    tasks.forEach((task) => {
      if (
        task.resultPreviews?.length
        || task.resultCount === 0
        || fetchedResultCounts.current[task.groupId] === task.resultCount
        || fetchingGroups.current.has(task.groupId)
      ) {
        return;
      }
      fetchingGroups.current.add(task.groupId);
      void taskApi.groupDetail(task.groupId).then((group) => {
        const previews = group.tasks.flatMap((groupTask) => groupTask.resultPreviews)
          .filter((preview) => preview.mediaType === 'IMAGE');
        // 只在请求成功后记录数量；失败会在下一次父级刷新时自动重试。
        fetchedResultCounts.current[task.groupId] = task.resultCount;
        setPreviewsByGroup((previous) => ({ ...previous, [task.groupId]: previews }));
      }).catch(() => undefined).finally(() => {
        fetchingGroups.current.delete(task.groupId);
      });
    });
  }, [tasks]);

  return (
    <aside className="flex h-full min-h-[540px] flex-col overflow-hidden rounded-[7px] border border-[#dfe3e8] bg-white">
      <div className="border-b border-[#e5e8ed] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-black text-slate-800">当前商品任务队列</h2>
          <span className="bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{tasks.length} 个任务</span>
        </div>
        {productName ? (
          <div className="mt-2 flex min-w-0 items-center gap-2 text-[10px] font-bold text-slate-600">
            {productImage && <img src={productImage} alt="" className="h-5 w-5 shrink-0 object-cover" />}
            <span className="truncate">{productName}</span>
          </div>
        ) : (
          <p className="mt-1 text-[10px] leading-4 text-slate-400">请选择主体素材以查看该商品的历史任务。</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center text-slate-400">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><ImageIcon className="h-5 w-5" /></span>
            <p className="mt-3 text-[11px] font-bold text-slate-600">尚未提交任务</p>
            <p className="mt-1 text-[10px] leading-4">提交后，生成进度与历史结果会持续保留在这里。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const state = taskState(task);
              const StateIcon = state.Icon;
              const active = task.groupId === activeTaskId;
              const typeLabel = task.snapshot.selectedTypes
                .map((type) => IMAGE_TYPE_LABELS[type])
                .join(' · ');
              const previews = (task.resultPreviews ?? previewsByGroup[task.groupId] ?? [])
                .filter((preview) => preview.mediaType === 'IMAGE')
                .slice(0, MAX_VISIBLE_THUMBNAILS);
              const skeletonCount = task.status === 'loading' && !isAbnormalTask(task)
                ? Math.max(0, Math.min(MAX_VISIBLE_THUMBNAILS, task.snapshot.totalCount) - previews.length)
                : 0;
              const showPreviewArea = previews.length > 0 || skeletonCount > 0 || isAbnormalTask(task);
              return (
                <button
                  key={task.groupId}
                  type="button"
                  onClick={() => onSelect(task.groupId)}
                  className={`w-full border p-2.5 text-left transition ${active
                    ? 'border-primary bg-blue-50/70 shadow-[0_0_0_1px_rgba(59,130,246,.12)]'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black text-slate-700">#{task.groupId.slice(-8)}</p>
                      <p className="mt-1 truncate text-[9px] text-slate-400">{typeLabel || '图片任务'} · {timeLabel(task.submittedAt)}</p>
                    </div>
                    <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-slate-300'}`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-1 text-[9px] font-bold ${state.className}`}>
                      <StateIcon className={`h-3 w-3 ${task.status === 'loading' ? 'animate-spin' : ''}`} />
                      {state.label}
                    </span>
                  </div>
                  {showPreviewArea && (
                    <div className="mt-2">
                      <div className="grid grid-cols-3 gap-1">
                        {previews.map((preview) => (
                          <div key={preview.id} data-timeline-thumbnail="true" className="aspect-square overflow-hidden border border-slate-100 bg-slate-50">
                            <AssetImage
                              urls={[preview.thumbnailUrl, preview.url]}
                              alt="生成结果缩略图"
                              maxWidth={160}
                              className="h-full w-full"
                              fallback={<span className="flex h-full w-full items-center justify-center bg-slate-100 text-[9px] font-bold text-slate-400">图片加载失败</span>}
                            />
                          </div>
                        ))}
                        {Array.from({ length: skeletonCount }).map((_, index) => (
                          <div
                            key={`skeleton-${index}`}
                            data-timeline-skeleton="true"
                            className="aspect-square animate-pulse border border-slate-100 bg-slate-100"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {task.status === 'loading' && (
                    <div className="mt-2 h-1 overflow-hidden bg-slate-100">
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.max(task.progressPercent, 4)}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
