import React, { useMemo, useState } from 'react';
import { AppScreen, GeneratedImageResult, GenerationTask, ProductAsset, TaskStatus, VideoTaskEntryContext, IMAGE_GENERATION_TYPE_LABELS } from '../types';
import { ImagePreviewDialog, type PreviewImage } from './ImagePreviewDialog';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';

interface TaskListProps {
  tasks: GenerationTask[];
  products: ProductAsset[];
  onUpdateTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  onCreateVideo: (context: VideoTaskEntryContext | GenerationTask) => void;
}

interface TaskGroupView {
  id: string;
  groupNo: string;
  type: GenerationTask['type'];
  tasks: GenerationTask[];
  status: TaskStatus;
  submittedAt?: string;
  progress: number;
  resultCount: number;
}

const STATUS_META: Record<TaskStatus, { label: string; style: string }> = {
  pending: { label: '排队中', style: 'bg-blue-50 text-primary' },
  running: { label: '生成中', style: 'bg-blue-50 text-primary' },
  completed: { label: '已完成', style: 'bg-slate-100 text-slate-600' },
  failed: { label: '生成失败', style: 'bg-red-50 text-red-700' },
  rejected: { label: '已打回', style: 'bg-red-50 text-red-700' },
  candidate: { label: '待评分审核', style: 'bg-slate-100 text-slate-600' },
  aesthetic_review: { label: '待评分审核', style: 'bg-slate-100 text-slate-600' },
  listing_review: { label: '待评分审核', style: 'bg-slate-100 text-slate-600' },
  archived: { label: '审核通过', style: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: '已取消', style: 'bg-slate-200 text-slate-500' },
};

const deriveGroupStatus = (tasks: GenerationTask[]): TaskStatus => {
  const statuses = tasks.map((task) => task.status);
  if (statuses.some((status) => status === 'failed')) return 'failed';
  if (statuses.some((status) => status === 'running')) return 'running';
  if (statuses.some((status) => status === 'pending')) return 'pending';
  if (statuses.some((status) => status === 'aesthetic_review')) return 'aesthetic_review';
  if (statuses.some((status) => status === 'listing_review')) return 'listing_review';
  if (statuses.some((status) => status === 'candidate')) return 'candidate';
  if (statuses.some((status) => status === 'rejected')) return 'rejected';
  if (statuses.every((status) => status === 'archived')) return 'archived';
  if (statuses.every((status) => status === 'cancelled')) return 'cancelled';
  return 'completed';
};

const resolveTaskResults = (task: GenerationTask): GeneratedImageResult[] => task.results?.length
  ? task.results
  : task.resultUrl
    ? [{ id: `${task.id}-result-1`, url: task.resultUrl, version: 1, reviewStage: task.status === 'archived' ? 'approved' : 'candidate' }]
    : [];

const resultCount = (task: GenerationTask) => resolveTaskResults(task).length;

const formatImageType = (task: GenerationTask) => task.imageType
  ? IMAGE_GENERATION_TYPE_LABELS[task.imageType]
  : task.type === 'video' ? '受控视频' : '图片任务';

const formatSubmittedAt = (value?: string) => value ?? '未提交';

export const TaskList: React.FC<TaskListProps> = ({ tasks, products, onUpdateTask, setScreen, onCreateVideo }) => {
  const [kind, setKind] = useState<'image' | 'video'>('image');
  const [status, setStatus] = useState<'all' | TaskStatus>('all');
  const [query, setQuery] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<TaskGroupView | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [preview, setPreview] = useState<{ images: PreviewImage[]; imageId: string } | null>(null);

  const groups = useMemo(() => {
    const buckets = new Map<string, GenerationTask[]>();
    tasks.filter((task) => task.type === kind).forEach((task) => {
      const key = task.groupId ?? `single-${task.id}`;
      buckets.set(key, [...(buckets.get(key) ?? []), task]);
    });
    return Array.from(buckets.entries()).map(([id, childTasks]) => {
      const orderedTasks = [...childTasks].sort((left, right) => (left.groupOrder ?? 1) - (right.groupOrder ?? 1));
      return {
        id,
        groupNo: orderedTasks[0].groupId ?? orderedTasks[0].id,
        type: orderedTasks[0].type,
        tasks: orderedTasks,
        status: deriveGroupStatus(orderedTasks),
        submittedAt: orderedTasks.map((task) => task.submittedAt).find(Boolean),
        progress: Math.round(orderedTasks.reduce((total, task) => total + task.progress, 0) / orderedTasks.length),
        resultCount: orderedTasks.reduce((total, task) => total + resultCount(task), 0),
      } satisfies TaskGroupView;
    }).sort((left, right) => (right.submittedAt ?? '').localeCompare(left.submittedAt ?? ''));
  }, [kind, tasks]);

  const visibleGroups = useMemo(() => groups.filter((group) => {
    if (status !== 'all' && group.status !== status) return false;
    const searchable = group.tasks.map((task) => `${task.id} ${task.name} ${task.productName} ${task.templateName}`).join(' ').toLowerCase();
    return searchable.includes(query.toLowerCase());
  }), [groups, query, status]);

  const statusTabs: Array<'all' | TaskStatus> = ['all', 'pending', 'running', 'candidate', 'archived', 'failed', 'rejected'];
  const toggleGroup = (id: string) => setExpandedGroupIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openDrawer = (group: TaskGroupView, taskId?: string) => {
    setSelectedGroup(group);
    setSelectedTaskId(taskId);
  };

  return <div className="space-y-5">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4"><div><p className="text-xs font-bold text-primary">生成与评分审核闭环</p><h2 className="text-2xl font-black text-slate-900 mt-1">任务列表</h2><p className="mt-2 text-sm text-slate-500">每次提交为一个批次；展开后按图片类型查看子任务和对应产物。</p></div><div className="flex gap-2"><button onClick={() => setScreen(AppScreen.CREATE_IMAGE_TASK)} className="h-9 px-4 rounded-md bg-primary text-white text-xs font-bold">新建图片任务</button><button onClick={() => setScreen(AppScreen.CREATE_VIDEO_TASK)} className="h-9 px-4 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-bold">新建视频任务</button></div></div>
    <div className="bg-white rounded-lg border border-slate-200 p-2 flex gap-2"><button onClick={() => { setKind('image'); setStatus('all'); }} className={`h-9 px-4 rounded-md text-xs font-bold ${kind === 'image' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>图片批次 ({new Set(tasks.filter((task) => task.type === 'image').map((task) => task.groupId ?? task.id)).size})</button><button onClick={() => { setKind('video'); setStatus('all'); }} className={`h-9 px-4 rounded-md text-xs font-bold ${kind === 'video' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>视频批次 ({new Set(tasks.filter((task) => task.type === 'video').map((task) => task.groupId ?? task.id)).size})</button></div>
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between"><div className="flex flex-wrap gap-2">{statusTabs.map((item) => { const meta = item === 'all' ? { label: '全部', style: '' } : STATUS_META[item]; const count = groups.filter((group) => item === 'all' || group.status === item).length; return <button key={item} onClick={() => setStatus(item)} className={`h-8 px-3 rounded-md text-xs font-bold ${status === item ? 'bg-primary text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{meta.label} {count}</button>; })}</div><div className="relative"><span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-base">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索批次、任务、商品或编号" className="h-9 w-60 pl-8 pr-3 rounded-md border border-slate-200 text-xs" /></div></div>
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="p-4 font-bold">批次 / 商品</th><th className="p-4 font-bold">模板</th><th className="p-4 font-bold">提交时间</th><th className="p-4 font-bold">批次状态</th><th className="p-4 font-bold">任务与产物</th><th className="p-4 font-bold text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleGroups.map((group) => { const meta = STATUS_META[group.status]; const firstTask = group.tasks[0]; const expanded = expandedGroupIds.has(group.id); return <React.Fragment key={group.id}><tr className="hover:bg-slate-50/70"><td className="p-4"><div className="flex gap-2.5 items-center"><button onClick={() => toggleGroup(group.id)} title={expanded ? '收起批次' : '展开批次'} className="w-6 h-6 shrink-0 rounded hover:bg-slate-100 text-slate-500"><span className={`material-symbols-outlined text-base transition-transform ${expanded ? 'rotate-90' : ''}`}>chevron_right</span></button><img src={firstTask.productImg} alt="" className="w-9 h-9 rounded object-cover" referrerPolicy="no-referrer"/><div><p className="text-[10px] text-slate-400 font-mono">{group.groupNo}</p><p className="mt-1 text-xs font-black text-slate-800 max-w-[220px] truncate">{firstTask.productName}</p></div></div></td><td className="p-4"><p className="text-xs font-bold max-w-[190px] truncate">{firstTask.templateName}</p><p className="mt-1 text-[10px] text-slate-400">{firstTask.creator}</p></td><td className="p-4 text-xs text-slate-600">{formatSubmittedAt(group.submittedAt)}</td><td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${meta.style}`}>{meta.label}</span>{group.status === 'running' && <div className="mt-2 h-1 w-24 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${group.progress}%` }} /></div>}</td><td className="p-4"><p className="text-xs font-bold">{group.tasks.length} 个子任务 · {group.resultCount} 个产物</p><p className="mt-1 text-[10px] text-slate-400">{group.tasks.map(formatImageType).join('、')}</p></td><td className="p-4"><div className="flex justify-end"><button onClick={() => openDrawer(group)} className="h-8 px-2.5 rounded border border-slate-200 text-xs font-bold">详情</button></div></td></tr>{expanded && group.tasks.map((task) => { const taskResults = resolveTaskResults(task); const previewImages = taskResults.map((result) => ({ id: result.id, url: result.url, alt: `${formatImageType(task)} v${result.version}` })); return <tr key={task.id} className="bg-slate-50/70"><td className="py-3 pr-4 pl-14"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-slate-400">subdirectory_arrow_right</span><p className="text-xs font-bold text-slate-700">{formatImageType(task)}</p></div></td><td className="py-3 px-4"><p className="text-[10px] font-mono text-slate-500">{task.id}</p><p className="mt-1 text-[10px] text-slate-400">{task.modelSnapshot?.modelName ?? task.modelChannel ?? '未设置模型'}</p></td><td className="py-3 px-4 text-[10px] text-slate-400">{task.params?.ratio ?? '—'}</td><td className="py-3 px-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${STATUS_META[task.status].style}`}>{STATUS_META[task.status].label}</span></td><td className="py-3 px-4"><div className="flex items-center gap-1.5">{taskResults.slice(0, 4).map((result) => <button key={result.id} onClick={(event) => { event.stopPropagation(); setPreview({ images: previewImages, imageId: result.id }); }} className="h-8 w-8 overflow-hidden rounded border border-white focus:outline-none focus:ring-2 focus:ring-primary" aria-label={`放大预览${formatImageType(task)}版本 ${result.version}`}><img src={result.url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer"/></button>)}{taskResults.length === 0 && <span className="text-[10px] text-slate-400">{task.status === 'running' ? `生成中 ${task.progress}%` : '暂无产物'}</span>}</div></td><td className="py-3 pl-4 pr-4"><div className="flex justify-end"><button onClick={() => openDrawer(group, task.id)} className="h-7 px-2.5 rounded bg-white border border-slate-200 text-[11px] font-bold">详情</button></div></td></tr>; })}</React.Fragment>; })}{visibleGroups.length === 0 && <tr><td colSpan={6} className="p-16 text-center text-sm text-slate-400">没有符合条件的批次</td></tr>}</tbody></table></div></div>
    {selectedGroup && <TaskDetailsDrawer tasks={selectedGroup.tasks} products={products} initialTaskId={selectedTaskId} onClose={() => setSelectedGroup(null)} onUpdateTask={onUpdateTask} onCreateVideo={onCreateVideo} />}
    {preview && <ImagePreviewDialog images={preview.images} initialImageId={preview.imageId} onClose={() => setPreview(null)} />}
  </div>;
};
