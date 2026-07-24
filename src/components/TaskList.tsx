import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  GenerationTask,
  AppScreen,
  ProductAsset,
  ChannelAsyncTask,
  ChannelAsyncTaskImage,
  AsyncTaskStatus,
  ASYNC_TASK_STATUS_STYLES,
} from '../types';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import { ImagePreviewModal, PreviewImage } from './ImagePreviewModal';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { taskApi } from '../api/modules/task';
import { asyncTaskApi } from '../api/modules/asyncTask';

interface TaskListProps {
  tasks: GenerationTask[];
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  onUpdateTask: (task: GenerationTask) => void;
  highlightGroupId: string | null;
  setScreen: (screen: AppScreen) => void;
  /** [2026-07-16 P0] 由 App 层传入的 refetch 回调(在重试/筛选后触发) */
  onRefresh?: () => void;
}

// ==================== [2026-07-16 P0] 子任务 chip(带缩略图) ====================

interface ChildTaskChipProps {
  child: ChannelAsyncTask;
  onRetry: (id: string) => void;
  /** [2026-07-21] 点击缩略图放大预览:把该子任务全部产出图冒泡到 TaskList 顶层 */
  onPreview: (images: PreviewImage[], index: number) => void;
}

/**
 * 子任务 chip 缩略图 URL:
 *  - imageUrl 已是完整 URL(COS 域名前缀 + fileKey)
 *  - 用 CI 数据万象 ?imageMogr2/thumbnail/64x64 实时缩放
 *  - 子任务用 64x64 缩略图(单子任务很小)
 *  <p>[2026-07-16 P0 修订] 后端 image_url 存完整 URL,前端只拼 CI 缩放参数
 */
function buildThumbUrl(imageUrl: string | null | undefined, size = 64): string | null {
  if (!imageUrl) return null;
  // 完整 URL 已有 ?query 时用 & 拼接,否则用 ?
  const sep = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${sep}imageMogr2/thumbnail/${size}x${size}`;
}

const ChildTaskChip: React.FC<ChildTaskChipProps> = ({ child, onRetry, onPreview }) => {
  const style = ASYNC_TASK_STATUS_STYLES[child.status as AsyncTaskStatus];

  // [2026-07-16 P0] SUCCESS 状态的子任务拉图列表(其他状态后端没图)
  const { data: images, loading: imgsLoading } = useServiceQuery<ChannelAsyncTaskImage[]>(
    () => (child.status === 'SUCCESS'
      ? asyncTaskApi.images(child.id)
      : Promise.resolve([] as ChannelAsyncTaskImage[])),
    [child.id, child.status],
  );
  const imgs = images ?? [];
  const firstImg = imgs[0];
  const thumbUrl = buildThumbUrl(firstImg?.imageUrl, 64);

  // [2026-07-21] 放大预览用原图(不加缩略参数);label 用 batchIdx + version
  const previewImages: PreviewImage[] = imgs
    .filter((im) => !!im.imageUrl)
    .map((im) => ({
      url: im.imageUrl,
      label: im.version ? `batchIdx=${im.batchIdx} · ${im.version}` : `batchIdx=${im.batchIdx}`,
    }));
  const canPreview = previewImages.length > 0;

  return (
    <div
      className={`inline-flex flex-col gap-1.5 p-2 rounded-lg text-[10px] font-bold ${style.bg} ${style.text} min-w-[140px]`}
    >
      {/* 第一行:缩略图 + batchIdx + 状态 + 重试 */}
      <div className="flex items-center gap-1.5">
        {/* 缩略图(64x64,SUCCESS 且有图才显示;可点击放大) */}
        {thumbUrl ? (
          <button
            type="button"
            onClick={() => canPreview && onPreview(previewImages, 0)}
            className="w-10 h-10 rounded overflow-hidden border border-black/10 cursor-zoom-in p-0 block"
            aria-label={`放大预览 batchIdx=${child.batchIdx}`}
          >
            <img
              src={thumbUrl}
              alt={`batchIdx=${child.batchIdx}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </button>
        ) : (
          <div className="w-10 h-10 rounded bg-black/5 flex items-center justify-center">
            <span className="material-symbols-outlined text-sm opacity-50">
              {child.status === 'SUCCESS' ? 'image' : 'pending'}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="font-mono font-black">batchIdx={child.batchIdx}</span>
            <span>{style.label}</span>
            {imgsLoading && child.status === 'SUCCESS' && (
              <span className="material-symbols-outlined text-[10px] animate-spin">progress_activity</span>
            )}
          </div>
          {child.durationMs != null && child.status === 'SUCCESS' && (
            <span className="text-[9px] opacity-60 font-mono">
              {(child.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {child.failReason && (
            <span
              className="text-[9px] opacity-80 truncate max-w-[120px]"
              title={child.failReason}
            >
              {child.failReason}
            </span>
          )}
        </div>
        {child.status === 'DEAD_LETTER' && (
          <button
            onClick={() => onRetry(child.id)}
            className="px-1.5 py-0.5 bg-white/60 rounded text-[9px] hover:bg-white shrink-0"
          >
            重试
          </button>
        )}
      </div>
      {/* 第二行:多图提示(如果 > 1 张) */}
      {imgs.length > 1 && (
        <div className="text-[9px] opacity-60 font-mono">
          +{imgs.length - 1} 张图
        </div>
      )}
    </div>
  );
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  products,
  onAddTask,
  onUpdateTask,
  highlightGroupId,
  setScreen,
  onRefresh,
}) => {
  const [primaryTab, setPrimaryTab] = useState<'image' | 'video'>('image');
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed' | 'failed' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Selected Task for Preview Modal
  const [previewTask, setPreviewTask] = useState<GenerationTask | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<GenerationTask | null>(null);
  // [2026-07-21] 子任务缩略图放大预览
  const [previewImages, setPreviewImages] = useState<PreviewImage[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [selectedDetailTask, setSelectedDetailTask] = useState<GenerationTask | null>(null);
  const [detailDrawerTab, setDetailDrawerTab] = useState<'overview' | 'inputs' | 'results' | 'reviews' | 'costs'>('overview');

  // [2026-07-16 P0] 子任务展开
  const [expandedBizId, setExpandedBizId] = useState<string | null>(null);
  const { data: childrenData } = useServiceQuery(
    () => (expandedBizId
      ? asyncTaskApi.page({ bizId: expandedBizId, page: 1, size: 50 })
      : Promise.resolve({ list: [] as ChannelAsyncTask[], total: 0, pageNum: 1, pageSize: 50 } as any)),
    [expandedBizId],
  );
  const children: ChannelAsyncTask[] = childrenData?.list ?? [];

  const handleSetPrimaryTab = (tab: 'image' | 'video') => {
    setPrimaryTab(tab);
    setActiveTab('all');
    setCurrentPage(1);
  };

  const handleSetActiveTab = (tab: any) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesPrimaryType = task.type === primaryTab;
    const matchesTab = activeTab === 'all' || task.status === activeTab;
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel = channelFilter === 'all' || (task.modelChannel && task.modelChannel.includes(channelFilter));

    return matchesPrimaryType && matchesTab && matchesSearch && matchesChannel;
  });

  // Pagination calculations
  const totalItems = filteredTasks.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Status counts specific to selected primaryTab (Image / Video)
  const currentTypeTasks = tasks.filter(t => t.type === primaryTab);

  // Unique model channels for filter dropdown
  const channels = ['DaVinci', 'Midjourney', 'Stable Diffusion', 'Runway', 'Kling', 'VIDU'];

  // [2026-07-16 P0] 真实重试(调 admin 端点 /v1/admin/task/retry)
  const handleRetryTask = async (task: GenerationTask) => {
    try {
      await taskApi.retry(task.id);
      toast.success(`任务 ${task.id} 已提交重试,几秒后状态会更新`);
      // 5s 后 refetch(Poller 已经把子任务 SUCCESS 写回父任务,这段时间够)
      setTimeout(() => onRefresh?.(), 5000);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('权限') || msg.includes('401') || msg.includes('403')) {
        toast.error('重试需要管理员权限,或当前任务不支持重试');
      } else {
        toast.error(`重试失败: ${msg || '未知错误'}`);
      }
    }
  };

  // [2026-07-16 P0] 重试子任务(DEAD_LETTER 状态)
  const handleRetryChild = async (childId: string) => {
    try {
      await asyncTaskApi.retry(childId);
      toast.success(`子任务 ${childId} 已提交重试`);
      // 触发 useServiceQuery refetch(通过 toggle expandedBizId 强制)
      const cur = expandedBizId;
      setExpandedBizId(null);
      setTimeout(() => setExpandedBizId(cur), 100);
    } catch (e: any) {
      toast.error(`子任务重试失败: ${e?.message ?? '未知错误'}`);
    }
  };

  // [2026-07-16 P0] 错误诊断按钮改 toast(本期不接 detail 接口的真实 fail_reason 弹窗)
  const handleShowError = (task: GenerationTask) => {
    if (task.errorMsg) {
      toast.error(task.errorMsg, { duration: 8000 });
    } else {
      toast.info('该任务暂无失败详情');
    }
  };

  // [2026-07-16 P0] 意见按钮改 toast
  const handleShowFeedback = (task: GenerationTask) => {
    if (task.feedback) {
      toast.warning(task.feedback, { duration: 8000 });
    } else {
      toast.info('该任务暂无退回批注');
    }
  };

  const handleBatchRetryFailed = async () => {
    const failedOnes = tasks.filter(t => t.status === 'failed' && t.type === primaryTab);
    if (failedOnes.length === 0) {
      toast.info('当前没有失败任务');
      return;
    }
    toast.info(`正在批量重试 ${failedOnes.length} 个失败任务...`);
    for (const t of failedOnes) {
      try {
        await taskApi.retry(t.id);
      } catch (e) {
        console.warn('[TaskList] batch retry failed for', t.id, e);
      }
    }
    setTimeout(() => onRefresh?.(), 5000);
  };

  const handleSetChannelFilter = (v: string) => {
    setChannelFilter(v);
    setCurrentPage(1);
  };

  // 动态成本估算(本期不接后端 costRate,简单规则:张数 × 1 Pts)
  const getEstimatedCost = (task: GenerationTask) => {
    const n = (task.params?.steps as unknown as number) || task.id ? 30 : 30;
    return `${n} Pts`;
  };

  return (
    <div className="space-y-6">

      {/* 1st Level Primary Tabs (图片生成任务 / 视频生成任务) */}
      <div className="flex border-b border-slate-200/80 bg-white p-2 rounded-2xl border shadow-xs gap-2">
        <button
          onClick={() => handleSetPrimaryTab('image')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold tracking-wider transition-all cursor-pointer ${
            primaryTab === 'image'
              ? 'bg-primary text-white shadow-md shadow-blue-500/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-lg">image</span>
          <span>图片生成任务 ({tasks.filter(t => t.type === 'image').length})</span>
        </button>
        <button
          onClick={() => handleSetPrimaryTab('video')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold tracking-wider transition-all cursor-pointer ${
            primaryTab === 'video'
              ? 'bg-primary text-white shadow-md shadow-blue-500/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-lg">video_library</span>
          <span>视频生成任务 ({tasks.filter(t => t.type === 'video').length})</span>
        </button>
      </div>

      {/* Top Banner / Tab Stats */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-sm flex flex-wrap gap-1">
        {[
          { id: 'all', label: '全部任务', count: currentTypeTasks.length, icon: 'list_alt', color: 'text-slate-500 bg-slate-100' },
          { id: 'running', label: '生成中', count: currentTypeTasks.filter(t => t.status === 'running').length, icon: 'autorenew', color: 'text-primary bg-primary-light' },
          { id: 'completed', label: '已完成素材', count: currentTypeTasks.filter(t => t.status === 'completed').length, icon: 'check_circle', color: 'text-success bg-emerald-50' },
          { id: 'failed', label: '生成失败', count: currentTypeTasks.filter(t => t.status === 'failed').length, icon: 'cancel', color: 'text-danger bg-red-50' },
          { id: 'rejected', label: '被退回修正', count: currentTypeTasks.filter(t => t.status === 'rejected').length, icon: 'gavel', color: 'text-warning bg-amber-50' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleSetActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#0B1C30] text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span className={`material-symbols-outlined text-base ${activeTab === tab.id ? 'text-primary' : ''}`}>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${activeTab === tab.id ? 'bg-slate-800 text-white' : tab.color}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Advanced Filter and Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto flex-1">
            {/* Search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="搜索任务名称、产品、ID..."
                className="w-full h-10 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white rounded-xl outline-none transition-all"
              />
            </div>

            {/* Channel Selector */}
            <select
              value={channelFilter}
              onChange={(e) => handleSetChannelFilter(e.target.value)}
              className="h-10 text-xs bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white rounded-xl outline-none px-3 transition-all font-semibold text-slate-700"
            >
              <option value="all">全部生成引擎通道</option>
              {channels.map(ch => (
                <option key={ch} value={ch}>{ch} 通道</option>
              ))}
            </select>
          </div>

          {/* Action buttons on the right */}
          <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
            <button
              onClick={() => {
                setSearchTerm('');
                handleSetChannelFilter('all');
                setCurrentPage(1);
              }}
              className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs text-slate-500 font-bold cursor-pointer transition-all"
            >
              重置筛选
            </button>
            <button
              onClick={handleBatchRetryFailed}
              className="h-10 px-4 rounded-xl bg-primary-light text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-sm font-bold">cached</span>
              重新运行失败任务
            </button>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 tracking-wider">
                <th className="py-4 px-5">任务编号 & 名称</th>
                <th className="py-4 px-5">关联商品底图</th>
                <th className="py-4 px-5">{primaryTab === 'image' ? '所选智能排版模板' : '所选动态视频脚本'}</th>
                <th className="py-4 px-5">创建信息</th>
                <th className="py-4 px-5">生成状态 & 进度</th>
                <th className="py-4 px-5">消耗估算</th>
                <th className="py-4 px-5">配置参数与通道</th>
                <th className="py-4 px-5 text-right">管理操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">hourglass_disabled</span>
                    未找到符合筛选条件的生成任务
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => (
                  <React.Fragment key={task.id}>
                  <tr className={`hover:bg-slate-50/50 transition-colors ${
                    highlightGroupId && task.groupId === highlightGroupId
                      ? 'bg-primary-light ring-2 ring-primary'
                      : ''
                  }`}>
                    {/* Name & ID */}
                    <td className="py-4 px-5">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                          {task.id}
                        </span>
                        <h4 className="font-bold text-slate-800 mt-1.5 leading-tight">{task.name}</h4>
                      </div>
                    </td>

                    {/* Product */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2.5">
                        {task.productImg ? (
                          <img
                            src={task.productImg}
                            alt={task.productName}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300">
                            <span className="material-symbols-outlined text-base">image</span>
                          </div>
                        )}
                        <span className="font-semibold text-slate-700 max-w-[130px] truncate block">{task.productName}</span>
                      </div>
                    </td>

                    {/* Template */}
                    <td className="py-4 px-5">
                      <span className="font-semibold text-slate-600 block">{task.templateName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">比例: {task.params?.ratio || '1:1'}</span>
                    </td>

                    {/* Operator & Time Column */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100/70">
                          <span className="material-symbols-outlined text-[12px] text-slate-400">person</span>
                          {task.creator}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">{task.timestamp}</span>
                      </div>
                    </td>

                    {/* Status & Progress */}
                    <td className="py-4 px-5">
                      <div className="space-y-1.5 max-w-[140px]">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                            task.status === 'running' ? 'bg-blue-50 text-primary border border-blue-200' :
                            task.status === 'completed' ? 'bg-emerald-50 text-success border border-emerald-200' :
                            task.status === 'failed' ? 'bg-red-50 text-danger border border-red-200' :
                            'bg-amber-50 text-warning border border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              task.status === 'running' ? 'bg-primary animate-pulse' :
                              task.status === 'completed' ? 'bg-success' :
                              task.status === 'failed' ? 'bg-danger' : 'bg-warning'
                            }`} />
                            {task.status === 'running' ? '进行中' :
                             task.status === 'completed' ? '已完成' :
                             task.status === 'failed' ? '生成失败' : '被退回'}
                          </span>
                          <span className="text-[11px] font-bold font-mono text-slate-500">{task.progress}%</span>
                        </div>
                        {/* Progress slider bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              task.status === 'running' ? 'bg-primary animate-pulse' :
                              task.status === 'completed' ? 'bg-success' :
                              task.status === 'failed' ? 'bg-danger' : 'bg-warning'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        {/* Interactive score / rating indicators */}
                        {task.status === 'completed' && (
                          <div className="flex items-center gap-1.5 mt-1 bg-amber-50/70 border border-amber-200 px-2 py-0.5 rounded-md w-max">
                            <span className="material-symbols-outlined text-[12px] text-amber-500 font-black">star</span>
                            <span className="text-[10px] font-black text-amber-700 font-mono">
                              {task.rating ? `${task.rating * 20}分` : (task.id === 'T-1002' ? '96分' : '90分')}
                            </span>
                          </div>
                        )}
                        {task.status === 'rejected' && (
                          <div className="flex items-center gap-1 mt-1 bg-red-50/70 border border-red-200 px-1.5 py-0.5 rounded-md w-max">
                            <span className="material-symbols-outlined text-[12px] text-red-500 font-bold">gavel</span>
                            <span className="text-[10px] font-bold text-red-700">被驳回</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Estimated Cost Column */}
                    <td className="py-4 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50/50 text-primary border border-blue-100/60 inline-block font-mono">
                        {getEstimatedCost(task)}
                      </span>
                    </td>

                    {/* Config params */}
                    <td className="py-4 px-5">
                      <span className="text-slate-600 font-medium block truncate max-w-[130px]">{task.modelChannel}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        比例: {task.params?.ratio || '1:1'} · 步数: {task.params?.steps || 30} · 引导: {task.params?.guidance || 7.5}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Universal details button */}
                        <button
                          onClick={() => {
                            setDetailDrawerTab('overview');
                            setSelectedDetailTask(task);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-all"
                          title="查看任务多维详情面板"
                        >
                          详情
                        </button>

                        {/* [2026-07-16 P0] 展开子任务 */}
                        <button
                          onClick={() => setExpandedBizId(expandedBizId === task.id ? null : task.id)}
                          className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer transition-all flex items-center gap-0.5 ${
                            expandedBizId === task.id
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                          title="展开/收起通道子任务"
                        >
                          <span className="material-symbols-outlined text-xs font-black">
                            {expandedBizId === task.id ? 'expand_less' : 'expand_more'}
                          </span>
                          子任务
                        </button>

                        {task.status === 'completed' && (
                          <>
                            <button
                              onClick={() => {
                                setDetailDrawerTab('results');
                                setSelectedDetailTask(task);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold cursor-pointer transition-all flex items-center gap-0.5"
                              title="对生成结果进行打分审核(本期暂未接真实评分)"
                            >
                              <span className="material-symbols-outlined text-xs font-black">star</span>
                              去评分
                            </button>
                            <button
                              onClick={() => setPreviewTask(task)}
                              className="px-2.5 py-1.5 rounded-lg bg-primary-light text-primary hover:bg-primary/20 font-bold transition-all"
                            >
                              预览
                            </button>
                          </>
                        )}
                        {task.status === 'failed' && (
                          <>
                            <button
                              onClick={() => handleShowError(task)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-danger hover:bg-red-100 font-bold cursor-pointer transition-all"
                            >
                              诊断
                            </button>
                            <button
                              onClick={() => handleRetryTask(task)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-all"
                            >
                              重试
                            </button>
                          </>
                        )}
                        {task.status === 'rejected' && (
                          <>
                            <button
                              onClick={() => handleShowFeedback(task)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-warning hover:bg-amber-100 font-bold cursor-pointer transition-all"
                            >
                              意见
                            </button>
                            <button
                              onClick={() => handleRetryTask(task)}
                              className="px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover font-bold cursor-pointer transition-all"
                            >
                              重构
                            </button>
                          </>
                        )}
                        {task.status === 'running' && (
                          <span className="text-slate-400 animate-pulse font-mono text-[10px]">运算中...</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* [2026-07-16 P0] 展开子任务行 */}
                  {expandedBizId === task.id && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50/80 px-5 py-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">layers</span>
                            通道子任务 ({children.length})
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            后端:Vidu / batchIdx 0..{children.length - 1}
                          </span>
                        </div>
                        {children.length === 0 ? (
                          <div className="text-[10px] text-slate-400 font-mono py-2">
                            无子任务(可能是同步通道或老数据)
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {children.map((c) => (
                              <ChildTaskChip
                                key={c.id}
                                child={c}
                                onRetry={handleRetryChild}
                                onPreview={(imgs, idx) => {
                                  setPreviewImages(imgs);
                                  setPreviewIndex(idx);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 font-semibold select-none">
          <span className="text-xs">
            显示第 <span className="text-slate-800 font-mono font-bold">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> 至{' '}
            <span className="text-slate-800 font-mono font-bold">{Math.min(currentPage * pageSize, totalItems)}</span> 项结果，共{' '}
            <span className="text-slate-800 font-mono font-bold">{totalItems}</span> 项
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-xs transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-primary text-white font-black'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Preview Result Image Modal */}
      {previewTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">高解析素材预览 ({previewTask.id})</span>
              <button onClick={() => setPreviewTask(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                {previewTask.resultUrl ? (
                  <img
                    src={previewTask.resultUrl}
                    alt={previewTask.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-5xl">image</span>
                  </div>
                )}
              </div>
              <div className="w-full mt-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-800">{previewTask.name}</h4>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">生成管道: {previewTask.modelChannel}</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setPreviewTask(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
              >
                关闭
              </button>
              {previewTask.resultUrl && (
                <a
                  href={previewTask.resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm"
                >
                  浏览原图
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Feedback Details Modal —— 改 toast 后保留结构占位(本期不接真实批注) */}
      {feedbackTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-amber-100">
            <div className="p-4 border-b border-amber-100 bg-amber-50 flex items-center justify-between text-warning">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">gavel</span>
                协作审核退回批注
              </span>
              <button onClick={() => setFeedbackTask(null)} className="text-amber-500 hover:text-amber-700 cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
                <p className="font-bold text-amber-800 mb-1">二审批注人:协同客户 林若云</p>
                <p className="font-mono">{feedbackTask.feedback || '(暂无批注)'}</p>
              </div>
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p className="font-bold text-slate-800">建议重绘参数:</p>
                <p>• 将引导系数 (CFG Guidance) 调降至 <span className="font-bold text-amber-600">6.0</span>。</p>
                <p>• 在负向提示词中加入 <span className="font-bold text-slate-700">"overexposed, glossy plastic"</span> 以消除塑料质感。</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setFeedbackTask(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleRetryTask(feedbackTask);
                  setFeedbackTask(null);
                }}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm cursor-pointer"
              >
                采纳建议并一键重新绘制
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Sliding Multi-Tab Details Drawer */}
      {selectedDetailTask && (
        <TaskDetailsDrawer
          task={selectedDetailTask}
          taskIds={[selectedDetailTask.id]}
          products={products}
          initialTab={detailDrawerTab}
          onClose={() => setSelectedDetailTask(null)}
          onUpdateTask={(updated) => {
            onUpdateTask(updated);
            setSelectedDetailTask(updated);
          }}
        />
      )}

      {/* 5. [2026-07-21] 子任务缩略图放大预览 */}
      {previewImages && (
        <ImagePreviewModal
          images={previewImages}
          initialIndex={previewIndex}
          onClose={() => setPreviewImages(null)}
        />
      )}

    </div>
  );
};
