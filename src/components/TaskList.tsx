import React, { useEffect, useState } from 'react';
import {
  AppScreen,
  type TaskGroupItemResponse,
  type TaskGroupResponse,
  type TaskResultPreviewResponse,
  type TaskStatus,
} from '../types';
import { taskApi } from '../api/modules/task';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { withCosThumbnail } from '../utils/cosImage';
import { ImagePreviewModal } from './ImagePreviewModal';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';

interface TaskListProps {
  highlightGroupId: string | null;
  highlightTaskKind: MediaKind;
  setScreen: (screen: AppScreen, payload?: { highlightGroupId?: string }) => void;
}

type MediaKind = 'IMAGE' | 'VIDEO';
type StatusFilter = 'all' | 'pending' | 'running' | 'review' | 'completed' | 'failed' | 'rejected' | 'cancelled';

const STATUS_FILTERS: Array<{
  id: StatusFilter;
  label: string;
  statuses?: TaskStatus[];
}> = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '等待中', statuses: ['DRAFT', 'PENDING'] },
  { id: 'running', label: '生成中', statuses: ['GENERATING'] },
  { id: 'review', label: '待审核', statuses: ['PENDING_REVIEW_SCORE', 'PENDING_REVIEW_PUBLISH'] },
  { id: 'completed', label: '已归档', statuses: ['ARCHIVED', 'COMPLETED'] },
  { id: 'failed', label: '失败', statuses: ['FAILED'] },
  { id: 'rejected', label: '已打回', statuses: ['REJECTED'] },
  { id: 'cancelled', label: '已取消', statuses: ['CANCELED'] },
];

const STATUS_META: Record<TaskStatus, { label: string; style: string }> = {
  DRAFT: { label: '草稿', style: 'bg-slate-100 text-slate-600' },
  PENDING: { label: '等待生成', style: 'bg-slate-100 text-slate-600' },
  GENERATING: { label: '生成中', style: 'bg-blue-50 text-primary' },
  PENDING_REVIEW_SCORE: { label: '待审美评分', style: 'bg-amber-50 text-amber-700' },
  PENDING_REVIEW_PUBLISH: { label: '待上架审核', style: 'bg-violet-50 text-violet-700' },
  ARCHIVED: { label: '已归档', style: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: '已打回', style: 'bg-rose-50 text-rose-700' },
  CANCELED: { label: '已取消', style: 'bg-slate-100 text-slate-500' },
  FAILED: { label: '生成失败', style: 'bg-red-50 text-red-700' },
  COMPLETED: { label: '已完成', style: 'bg-emerald-50 text-emerald-700' },
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

const isActiveStatus = (status: TaskStatus) =>
  ['DRAFT', 'PENDING', 'GENERATING'].includes(status);

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return value.replace('T', ' ').slice(0, 16);
};

const taskLabel = (task: TaskGroupItemResponse) =>
  IMAGE_TYPE_LABELS[task.imageType ?? task.taskType] ?? task.title ?? task.taskCode;

const resultImageUrl = (result: TaskResultPreviewResponse) =>
  result.mediaType === 'IMAGE'
    ? result.url
    : result.thumbnailUrl || result.url;

export const TaskList: React.FC<TaskListProps> = ({ highlightGroupId, highlightTaskKind, setScreen }) => {
  const [kind, setKind] = useState<MediaKind>(highlightTaskKind);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<TaskGroupResponse | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [imagePreview, setImagePreview] = useState<{ results: TaskResultPreviewResponse[]; index: number } | null>(null);
  const [videoPreview, setVideoPreview] = useState<TaskResultPreviewResponse | null>(null);

  const activeFilter = STATUS_FILTERS.find((item) => item.id === statusFilter);
  const groupsQuery = useServiceQuery(
    () => taskApi.groupPage({
      pageNum,
      pageSize: 10,
      taskKind: kind,
      statuses: activeFilter?.statuses,
      keyword: keyword || undefined,
    }),
    [pageNum, kind, statusFilter, keyword],
  );
  const imageCountQuery = useServiceQuery(
    () => taskApi.groupPage({ pageNum: 1, pageSize: 1, taskKind: 'IMAGE' }),
    [],
  );
  const videoCountQuery = useServiceQuery(
    () => taskApi.groupPage({ pageNum: 1, pageSize: 1, taskKind: 'VIDEO' }),
    [],
  );

  const groups = groupsQuery.data?.list ?? [];
  const total = groupsQuery.data?.total ?? 0;
  const pages = Math.max(groupsQuery.data?.pages ?? 0, 1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(searchInput.trim());
      setPageNum(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!groups.some((group) => isActiveStatus(group.status))) return;
    const timer = window.setInterval(() => groupsQuery.refetch(), 5000);
    return () => window.clearInterval(timer);
  }, [groups, groupsQuery.refetch]);

  useEffect(() => {
    if (!highlightGroupId) return;
    setKind(highlightTaskKind);
    setStatusFilter('all');
    setSearchInput('');
    setKeyword('');
    setPageNum(1);
    setExpandedGroups((current) => new Set(current).add(highlightGroupId));
  }, [highlightGroupId, highlightTaskKind]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const openDrawer = (group: TaskGroupResponse, taskId?: string) => {
    setSelectedTaskId(taskId);
    setSelectedGroup(group);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold text-primary">生成任务中心</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">任务列表</h2>
          <p className="mt-2 text-sm text-slate-500">
            每次提交为一个批次；展开后按图片类型或视频任务查看产物与执行状态。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScreen(AppScreen.CREATE_IMAGE_TASK)}
            className="h-10 rounded-lg bg-primary px-4 text-xs font-bold text-white"
          >
            新建图片任务
          </button>
          <button
            onClick={() => setScreen(AppScreen.CREATE_VIDEO_TASK)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700"
          >
            新建视频任务
          </button>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {([
          ['IMAGE', `图片批次 (${imageCountQuery.data?.total ?? 0})`],
          ['VIDEO', `视频批次 (${videoCountQuery.data?.total ?? 0})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setKind(value);
              setStatusFilter('all');
              setPageNum(1);
              setExpandedGroups(new Set());
            }}
            className={`h-9 rounded-lg px-4 text-xs font-bold ${
              kind === value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setStatusFilter(item.id);
                setPageNum(1);
              }}
              className={`h-8 rounded-lg px-3 text-xs font-bold ${
                statusFilter === item.id
                  ? 'bg-primary text-white'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {item.label}
              {statusFilter === item.id ? ` ${total}` : ''}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="relative block">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-base text-slate-400">search</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索批次、任务、商品或编号"
              className="h-9 w-64 rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-primary"
            />
          </label>
          <button
            onClick={() => groupsQuery.refetch()}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
            title="刷新"
          >
            <span className={`material-symbols-outlined text-lg ${groupsQuery.loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr>
                <th className="p-4 font-bold">批次 / 商品</th>
                <th className="p-4 font-bold">模板</th>
                <th className="p-4 font-bold">提交时间</th>
                <th className="p-4 font-bold">批次状态</th>
                <th className="p-4 font-bold">任务与产物</th>
                <th className="p-4 text-right font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => {
                const expanded = expandedGroups.has(group.groupId);
                const meta = STATUS_META[group.status];
                const highlighted = highlightGroupId === group.groupId;
                return (
                  <React.Fragment key={group.groupId}>
                    <tr className={`${highlighted ? 'bg-blue-50/80' : 'hover:bg-slate-50/70'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => toggleGroup(group.groupId)}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-500 hover:bg-slate-100"
                            title={expanded ? '收起批次' : '展开批次'}
                          >
                            <span className={`material-symbols-outlined text-base transition-transform ${expanded ? 'rotate-90' : ''}`}>
                              chevron_right
                            </span>
                          </button>
                          {group.productImage ? (
                            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                              <img
                                src={withCosThumbnail(group.productImage, 96)}
                                alt=""
                                className="block h-auto max-h-full w-auto max-w-full object-contain object-center"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-300">
                              <span className="material-symbols-outlined">inventory_2</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="max-w-[230px] truncate font-mono text-[10px] text-slate-400">
                              {group.groupId}
                            </p>
                            <p className="mt-1 max-w-[230px] truncate text-xs font-black text-slate-800">
                              {group.productName || '未命名商品'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="max-w-[190px] truncate text-xs font-bold text-slate-700">
                          {group.templateName || '未使用模板'}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">提交人 {group.submitterUserId}</p>
                      </td>
                      <td className="p-4 text-xs text-slate-600">{formatDateTime(group.submittedAt)}</td>
                      <td className="p-4">
                        <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${meta.style}`}>
                          {meta.label}
                        </span>
                        {isActiveStatus(group.status) && (
                          <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${group.progressPercent}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="text-xs font-bold text-slate-700">
                          {group.taskCount} 个子任务 · {group.resultCount} 个产物
                        </p>
                        <p className="mt-1 max-w-[260px] truncate text-[10px] text-slate-400">
                          {group.tasks.map(taskLabel).join('、')}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => openDrawer(group)}
                            className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700"
                          >
                            详情
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && group.tasks.map((task) => (
                      <TaskChildRow
                        key={task.id}
                        task={task}
                        onOpen={() => openDrawer(group, task.id)}
                        onPreviewImage={(results, index) => setImagePreview({ results, index })}
                        onPreviewVideo={setVideoPreview}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
              {!groupsQuery.loading && groups.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-sm text-slate-400">
                    没有符合条件的任务批次
                  </td>
                </tr>
              )}
              {groupsQuery.loading && (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-sm text-slate-400">
                    正在加载任务批次…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">共 {total} 个批次</p>
          <div className="flex items-center gap-2">
            <button
              disabled={pageNum <= 1}
              onClick={() => setPageNum((value) => Math.max(1, value - 1))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-xs font-mono text-slate-500">{pageNum} / {pages}</span>
            <button
              disabled={pageNum >= pages}
              onClick={() => setPageNum((value) => Math.min(pages, value + 1))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {selectedGroup && (
        <TaskDetailsDrawer
          group={selectedGroup}
          initialTaskId={selectedTaskId}
          onClose={() => setSelectedGroup(null)}
          onChanged={() => groupsQuery.refetch()}
        />
      )}
      {imagePreview && (
        <ImagePreviewModal
          images={imagePreview.results.map((result, index) => ({
            url: result.url,
            label: `产物 ${index + 1}`,
          }))}
          initialIndex={imagePreview.index}
          onClose={() => setImagePreview(null)}
        />
      )}
      {videoPreview && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-6" onClick={() => setVideoPreview(null)}>
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              onClick={() => setVideoPreview(null)}
              className="absolute -right-3 -top-10 text-white"
              aria-label="关闭视频预览"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <video src={videoPreview.url} controls autoPlay className="max-h-[82vh] w-full bg-black object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

interface TaskChildRowProps {
  task: TaskGroupItemResponse;
  onOpen: () => void;
  onPreviewImage: (results: TaskResultPreviewResponse[], index: number) => void;
  onPreviewVideo: (result: TaskResultPreviewResponse) => void;
}

const TaskChildRow: React.FC<TaskChildRowProps> = ({
  task,
  onOpen,
  onPreviewImage,
  onPreviewVideo,
}) => {
  const meta = STATUS_META[task.status];
  const imageResults = task.resultPreviews.filter((result) => result.mediaType === 'IMAGE');
  return (
    <tr className="bg-slate-50/70">
      <td className="py-3 pl-14 pr-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-slate-400">subdirectory_arrow_right</span>
          <p className="text-xs font-bold text-slate-700">{taskLabel(task)}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-mono text-[10px] text-slate-500">{task.taskCode || task.id}</p>
        <p className="mt-1 text-[10px] text-slate-400">
          {task.modelChannelName || task.modelChannelId || '未记录模型通道'}
        </p>
      </td>
      <td className="px-4 py-3 text-[10px] text-slate-500">{task.aspectRatio || '—'}</td>
      <td className="px-4 py-3">
        <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${meta.style}`}>{meta.label}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {task.resultPreviews.slice(0, 4).map((result, index) => (
            <button
              key={result.id}
              onClick={() => result.mediaType === 'VIDEO'
                ? onPreviewVideo(result)
                : onPreviewImage(imageResults, imageResults.findIndex((item) => item.id === result.id))}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1"
              title="预览产物"
            >
              <img
                src={withCosThumbnail(resultImageUrl(result), 96)}
                alt=""
                className="max-h-full max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
              {result.mediaType === 'VIDEO' && (
                <span className="material-symbols-outlined absolute text-lg text-white drop-shadow">play_circle</span>
              )}
            </button>
          ))}
          {task.resultPreviews.length === 0 && (
            <span className="text-[10px] text-slate-400">
              {isActiveStatus(task.status) ? `生成中 ${task.progressPercent}%` : '暂无产物'}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <button onClick={onOpen} className="h-7 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-bold">
            详情
          </button>
        </div>
      </td>
    </tr>
  );
};
