import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GeneratedImageResult, GenerationTask, ImageRevisionContext, ProductAsset, ResultReviewStage, ResultTemplate, VideoTaskEntryContext, IMAGE_GENERATION_TYPE_LABELS } from '../types';
import { ImagePreviewDialog, type PreviewImage } from './ImagePreviewDialog';
import { templatePublishBlockReason } from '../templateUtils';

interface TaskDetailsDrawerProps {
  tasks: GenerationTask[];
  products: ProductAsset[];
  initialTaskId?: string;
  onClose: () => void;
  onUpdateTask: (task: GenerationTask) => void;
  onCreateVideo: (context: VideoTaskEntryContext | GenerationTask) => void;
  canPublishTemplate: boolean;
  canManageTemplate: boolean;
  publishedTemplateTaskIds: ReadonlySet<string>;
  onPublishTemplate: (task: GenerationTask) => void;
  getTemplateStatusForTask: (taskId: string) => ResultTemplate['status'] | undefined;
  onToggleTemplateStatus: (taskId: string) => void;
}

interface ResultTarget { taskId: string; result: GeneratedImageResult; }

const stageLabel: Record<ResultReviewStage, string> = {
  candidate: '待评分审核', aesthetic_review: '待评分审核', listing_review: '待评分审核', approved: '审核通过', rejected: '已打回', unavailable: '不可用',
};
const stageStyle: Record<ResultReviewStage, string> = {
  candidate: 'bg-slate-100 text-slate-600', aesthetic_review: 'bg-slate-100 text-slate-600', listing_review: 'bg-slate-100 text-slate-600', approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-700', unavailable: 'bg-slate-200 text-slate-500',
};

const resolveResults = (task: GenerationTask): GeneratedImageResult[] => task.results?.length
  ? task.results
  : task.resultUrl
    ? [{ id: `${task.id}-result-1`, url: task.resultUrl, version: 1, reviewStage: task.status === 'archived' ? 'approved' : 'candidate' }]
    : [];

const taskImageType = (task: GenerationTask) => task.imageType
  ? IMAGE_GENERATION_TYPE_LABELS[task.imageType]
  : task.type === 'video' ? '受控视频' : '图片任务';

const taskStatus = (task: GenerationTask) => task.status === 'running' ? '生成中'
  : task.status === 'archived' ? '审核通过'
    : task.status === 'completed' ? '已完成'
      : task.status === 'candidate' ? '待评分审核'
        : task.status === 'pending' ? '排队中'
          : task.status === 'failed' ? '生成失败'
            : task.status === 'rejected' ? '已打回'
              : task.status === 'cancelled' ? '已取消' : task.status;

const buildRevisionContext = (target: GeneratedImageResult, task: GenerationTask, results: GeneratedImageResult[]): ImageRevisionContext => {
  const appendCurrentReview = (context: ImageRevisionContext): ImageRevisionContext => {
    if (!target.aestheticReview?.comment || context.turns.some((turn) => turn.role === 'review' && turn.sourceResultId === target.id)) return context;
    return {
      ...context,
      turns: [...context.turns, {
        id: `review-context-${target.id}`,
        role: 'review',
        content: target.aestheticReview.comment,
        timestamp: target.aestheticReview.timestamp,
        sourceResultId: target.id,
      }],
    };
  };
  if (target.revisionContext) return appendCurrentReview(target.revisionContext);
  const parent = target.parentImageId ? results.find((item) => item.id === target.parentImageId) : undefined;
  if (parent) return appendCurrentReview(buildRevisionContext(parent, task, results));
  return appendCurrentReview({
    rootResultId: target.id,
    sourceTaskId: task.id,
    basePrompt: task.taskPrompt ?? task.params?.prompt ?? '未记录原始 Prompt。',
    negativePrompt: task.negativePrompt ?? task.params?.negativePrompt,
    fidelityRules: ['保持商品主体、材质和品牌信息不变', '未标记区域保持原图构图和视觉关系'],
    turns: [],
  });
};

export const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({ tasks, products, initialTaskId, onClose, onUpdateTask, onCreateVideo, canPublishTemplate, canManageTemplate, publishedTemplateTaskIds, onPublishTemplate, getTemplateStatusForTask, onToggleTemplateStatus }) => {
  const [displayTasks, setDisplayTasks] = useState(tasks);
  const [activeTaskId, setActiveTaskId] = useState(initialTaskId ?? tasks[0]?.id);
  const [editTarget, setEditTarget] = useState<ResultTarget | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ResultTarget | null>(null);
  const [preview, setPreview] = useState<{ images: PreviewImage[]; imageId: string } | null>(null);
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const activeTask = displayTasks.find((task) => task.id === activeTaskId) ?? displayTasks[0];
  const activeResults = useMemo(() => activeTask ? resolveResults(activeTask) : [], [activeTask]);
  const activePreviewImages = useMemo<PreviewImage[]>(() => activeTask ? activeResults.map((result) => ({ id: result.id, url: result.url, alt: `${taskImageType(activeTask)} v${result.version}` })) : [], [activeResults, activeTask]);
  const groupId = displayTasks[0]?.groupId ?? displayTasks[0]?.id ?? '—';
  const submittedAt = displayTasks.map((task) => task.submittedAt).find(Boolean) ?? '未提交';
  const product = products.find((item) => item.name === activeTask?.productName);
  const activeTemplateStatus = activeTask && publishedTemplateTaskIds.has(activeTask.id) ? getTemplateStatusForTask(activeTask.id) : undefined;
  const activeTaskPublishReason = activeTask ? templatePublishBlockReason(activeTask) : '未选择任务';
  const publicationLabel = activeTemplateStatus === 'active' ? '下架模板' : activeTemplateStatus === 'disabled' ? '重新上架' : '设为模板';
  const publicationTitle = activeTemplateStatus ? !canManageTemplate ? '当前账号没有管理模板权限' : undefined : !canPublishTemplate ? '当前账号没有发布模板权限' : activeTaskPublishReason ?? undefined;

  useEffect(() => setDisplayTasks(tasks), [tasks]);
  useEffect(() => setActiveTaskId(initialTaskId ?? tasks[0]?.id), [initialTaskId, tasks]);

  const patchTask = (next: GenerationTask) => {
    setDisplayTasks((current) => current.map((task) => task.id === next.id ? next : task));
    onUpdateTask(next);
  };

  const submitReview = (decision: 'approved' | 'rejected') => {
    if (!reviewTarget) return;
    const task = displayTasks.find((item) => item.id === reviewTarget.taskId);
    if (!task) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const reviewComment = comment || (decision === 'approved' ? '评分审核通过。' : '评分审核打回，请根据意见修改。');
    const taskResults = resolveResults(task);
    const nextResults = taskResults.map((result) => result.id === reviewTarget.result.id ? {
      ...result,
      reviewStage: decision,
      aestheticReview: { reviewer: '陈美晴 · 设计/美工', timestamp: now, rating, tags, comment: reviewComment, decision },
      revisionContext: { ...buildRevisionContext(result, task, taskResults), turns: [...buildRevisionContext(result, task, taskResults).turns, { id: `review-${Date.now()}`, role: 'review' as const, content: reviewComment, timestamp: now, sourceResultId: result.id }] },
    } : result);
    const nextStatus = nextResults.some((result) => result.reviewStage === 'approved') ? 'archived' : nextResults.some((result) => result.reviewStage === 'rejected') ? 'rejected' : 'candidate';
    patchTask({ ...task, status: nextStatus, progress: 100, results: nextResults, resultUrl: nextResults[0]?.url ?? task.resultUrl });
    setReviewTarget(null); setComment(''); setTags([]);
  };

  const createEditVersion = (target: ResultTarget, instruction: string, maskDataUrl: string) => {
    const task = displayTasks.find((item) => item.id === target.taskId);
    if (!task) return;
    const taskResults = resolveResults(task);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const inherited = buildRevisionContext(target.result, task, taskResults);
    const revisionContext: ImageRevisionContext = { ...inherited, turns: [...inherited.turns, { id: `edit-${Date.now()}`, role: 'user', content: instruction, timestamp: now, sourceResultId: target.result.id, maskDataUrl }] };
    const version = Math.max(...taskResults.map((result) => result.version), 0) + 1;
    const newResult: GeneratedImageResult = { id: `${task.id}-result-${version}`, url: target.result.url, version, reviewStage: 'candidate', parentImageId: target.result.id, editInstruction: instruction, maskDataUrl, revisionContext, sourceRecordId: target.result.sourceRecordId, sourceFileName: target.result.sourceFileName };
    patchTask({ ...task, status: 'running', progress: 0 });
    window.setTimeout(() => patchTask({ ...task, status: 'candidate', progress: 100, results: [...taskResults, newResult], resultUrl: task.resultUrl ?? target.result.url }), 850);
  };

  if (!activeTask) return null;

  return <div className="fixed inset-0 z-50 flex justify-end">
    <button onClick={onClose} className="absolute inset-0 bg-slate-900/35" aria-label="关闭任务详情" />
    <section className="relative z-10 flex h-full w-full max-w-[980px] flex-col bg-[#f5f7fb] shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-6"><div><p className="text-[11px] font-bold text-primary">批次详情 · {groupId}</p><h2 className="mt-1 text-lg font-black text-slate-900">{activeTask.productName}</h2><p className="mt-1 text-[11px] text-slate-400">提交时间：{submittedAt} · {displayTasks.length} 个图片类型</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center text-slate-500" aria-label="关闭"><span className="material-symbols-outlined">close</span></button></header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white p-3 md:w-56 md:overflow-y-auto md:border-b-0 md:border-r"><div className="flex gap-2 md:block md:space-y-2">{displayTasks.map((task) => { const selected = task.id === activeTask.id; const count = resolveResults(task).length; return <button key={task.id} onClick={() => setActiveTaskId(task.id)} className={`min-w-40 border p-3 text-left md:w-full ${selected ? 'border-primary bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-slate-800">{taskImageType(task)}</span><span className={`h-2 w-2 rounded-full ${task.status === 'rejected' ? 'bg-red-500' : task.status === 'archived' ? 'bg-emerald-500' : 'bg-amber-400'}`} /></div><p className="mt-2 text-[10px] text-slate-500">{taskStatus(task)} · {count} 个产物</p></button>; })}</div></aside>
        <div className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold text-primary">{taskImageType(activeTask)} · {activeTask.id}</p><h3 className="mt-1 text-base font-black text-slate-900">{taskStatus(activeTask)}</h3></div>{activeTask.status === 'running' && <span className="text-xs font-bold text-primary">生成进度 {activeTask.progress}%</span>}</div>
          {activeResults.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{activeResults.map((result) => <article key={result.id} className="overflow-hidden border border-slate-200 bg-white"><button onClick={() => setPreview({ images: activePreviewImages, imageId: result.id })} className="block w-full bg-slate-100" aria-label={`放大预览${taskImageType(activeTask)}版本 ${result.version}`}><img src={result.url} alt={`${taskImageType(activeTask)}版本 ${result.version}`} className="h-60 w-full object-cover transition-transform hover:scale-[1.02]" referrerPolicy="no-referrer"/></button><div className="p-4"><div className="flex items-center justify-between gap-2"><b className="text-xs">版本 v{result.version}</b><span className={`px-2 py-1 text-[10px] font-bold ${stageStyle[result.reviewStage]}`}>{stageLabel[result.reviewStage]}</span></div>{result.editInstruction && <p className="mt-2 text-[11px] leading-5 text-slate-500">编辑：{result.editInstruction}</p>}{result.reviewStage === 'rejected' && <p className="mt-2 text-[11px] leading-5 text-red-700">打回意见：{result.aestheticReview?.comment ?? activeTask.feedback ?? '请根据审核意见继续调整。'}</p>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setEditTarget({ taskId: activeTask.id, result })} className="h-8 rounded border border-slate-200 px-2.5 text-xs font-bold">二次编辑</button>{result.reviewStage === 'candidate' || result.reviewStage === 'rejected' ? <button onClick={() => { setReviewTarget({ taskId: activeTask.id, result }); setRating(4); setComment(''); setTags([]); }} className="h-8 bg-primary px-2.5 text-xs font-bold text-white">评分与审核</button> : null}{result.reviewStage === 'approved' && activeTask.type === 'image' ? <button onClick={() => onCreateVideo({ kind: 'approved-image', sourceTask: activeTask, sourceResult: result })} className="h-8 bg-emerald-600 px-2.5 text-xs font-bold text-white">创建视频</button> : null}<button disabled={activeTemplateStatus ? !canManageTemplate : !canPublishTemplate || Boolean(activeTaskPublishReason)} title={publicationTitle} onClick={() => activeTemplateStatus ? onToggleTemplateStatus(activeTask.id) : onPublishTemplate(activeTask)} className={`inline-flex h-8 items-center gap-1 px-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${activeTemplateStatus === 'active' ? 'border border-[#dfc6a4] bg-[#fff8ec] text-[#93652d]' : 'bg-slate-900 text-white'}`}>{activeTemplateStatus === 'active' && <span className="material-symbols-outlined text-[15px]">archive</span>}{activeTemplateStatus === 'disabled' && <span className="material-symbols-outlined text-[15px]">unarchive</span>}{publicationLabel}</button></div></div></article>)}</div> : <div className="mt-4 border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">{activeTask.status === 'running' ? `正在生成，当前进度 ${activeTask.progress}%` : activeTask.status === 'failed' ? activeTask.errorMsg ?? '生成失败' : '尚未生成结果。'}</div>}
          <div className="mt-6 space-y-3"><details open className="border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-xs font-black text-slate-800">本次输入与最终提示词</summary><div className="mt-4 grid gap-4 md:grid-cols-[112px_1fr]"><img src={activeTask.productImg} alt={activeTask.productName} className="h-28 w-28 object-cover" referrerPolicy="no-referrer"/><div className="space-y-2 text-xs leading-6 text-slate-600"><p><b className="text-slate-800">商品：</b>{activeTask.productName}{product ? ` · ${product.category}` : ''}</p><p><b className="text-slate-800">最终 Prompt：</b>{activeTask.taskPrompt ?? activeTask.params?.prompt ?? '未记录最终 Prompt'}</p><p><b className="text-slate-800">负面约束：</b>{activeTask.negativePrompt ?? activeTask.params?.negativePrompt ?? '未设置'}</p><p><b className="text-slate-800">模型：</b>{activeTask.modelSnapshot?.modelName ?? activeTask.modelChannel ?? '未设置'} · {activeTask.params?.ratio ?? '未设置比例'}</p></div></div></details><details className="border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-xs font-black text-slate-800">审核与版本记录</summary><div className="mt-4 space-y-3">{activeResults.map((result) => { const context = buildRevisionContext(result, activeTask, activeResults); return <div key={result.id} className="border-l-2 border-slate-200 pl-3 text-[11px] leading-5 text-slate-600"><p className="font-bold text-slate-800">v{result.version} · {stageLabel[result.reviewStage]}</p>{result.aestheticReview && <p>审核：{result.aestheticReview.comment}</p>}{context.turns.map((turn) => <p key={turn.id}>{turn.role === 'review' ? '审核意见' : '编辑要求'}：{turn.content}</p>)}</div>; })}</div></details></div>
        </div>
      </main>
      {preview && <ImagePreviewDialog images={preview.images} initialImageId={preview.imageId} onClose={() => setPreview(null)} />}
      {editTarget && <ImageEditDialog image={editTarget.result} context={buildRevisionContext(editTarget.result, displayTasks.find((task) => task.id === editTarget.taskId) ?? activeTask, resolveResults(displayTasks.find((task) => task.id === editTarget.taskId) ?? activeTask))} onClose={() => setEditTarget(null)} onSubmit={(instruction, mask) => { createEditVersion(editTarget, instruction, mask); setEditTarget(null); }} />}
      {reviewTarget && <ReviewDialog target={reviewTarget.result} rating={rating} setRating={setRating} comment={comment} setComment={setComment} tags={tags} setTags={setTags} onClose={() => setReviewTarget(null)} onSubmit={submitReview} />}
    </section>
  </div>;
};

const ImageEditDialog: React.FC<{ image: GeneratedImageResult; context: ImageRevisionContext; onClose: () => void; onSubmit: (instruction: string, maskDataUrl: string) => void }> = ({ image, context, onClose, onSubmit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [brushSize, setBrushSize] = useState(32);
  const [erasing, setErasing] = useState(false);
  const [instruction, setInstruction] = useState('请修改局部效果，同时保持商品主体、材质和品牌信息不变。');
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const canvas = canvasRef.current!; const context2d = canvas.getContext('2d')!; const { x, y } = point(event); context2d.globalCompositeOperation = erasing ? 'destination-out' : 'source-over'; context2d.fillStyle = 'rgba(2,86,255,.52)'; context2d.beginPath(); context2d.arc(x, y, brushSize, 0, Math.PI * 2); context2d.fill(); };
  return <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60" /><div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">图片二次编辑</p><h2 className="mt-1 font-black">标记需要修改的区域</h2></div><button onClick={onClose} className="material-symbols-outlined" aria-label="关闭二次编辑">close</button></div><div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><div><div className="relative aspect-[4/3] select-none overflow-hidden bg-slate-100"><img src={image.url} alt="编辑源图片" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer"/><canvas ref={canvasRef} width={800} height={600} onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); draw(event); }} onPointerMove={draw} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} className="absolute inset-0 h-full w-full cursor-crosshair" /></div><p className="mt-2 text-[11px] text-slate-500">蓝色涂抹区域为需要修改的区域；未涂抹区域将作为保真要求继承。</p></div><aside className="space-y-4"><details open className="border border-blue-100 bg-blue-50 p-3"><summary className="cursor-pointer text-xs font-black text-primary">已继承上下文（{context.turns.length} 轮）</summary><div className="mt-3 space-y-2 text-[11px] leading-5 text-slate-600"><p><b>原始 Prompt：</b>{context.basePrompt}</p>{context.negativePrompt && <p><b>负面约束：</b>{context.negativePrompt}</p>}<p><b>保真要求：</b>{context.fidelityRules.join('；')}</p>{context.turns.length ? <div className="border-t border-blue-100 pt-2">{context.turns.map((turn) => <p key={turn.id}><b>{turn.role === 'review' ? '审核意见' : '编辑要求'}：</b>{turn.content}</p>)}</div> : <p>这是初始版本，尚无历史编辑。</p>}</div></details><label className="block text-xs font-bold">本轮修改要求<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} className="mt-1.5 h-24 w-full border border-slate-200 p-2 text-xs font-normal leading-5" /></label><label className="block text-xs font-bold">画笔大小<input type="range" min="8" max="72" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="mt-3 w-full" /></label><button onClick={() => setErasing((value) => !value)} className={`h-9 w-full border text-xs font-bold ${erasing ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200'}`}>{erasing ? '当前：橡皮擦' : '切换为橡皮擦'}</button><button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 800, 600)} className="h-9 w-full border border-slate-200 text-xs font-bold">清空涂抹</button><button onClick={() => onSubmit(instruction, canvasRef.current?.toDataURL('image/png') ?? '')} className="h-9 w-full bg-primary text-xs font-bold text-white">生成修改版本</button></aside></div></div></div>;
};

const ReviewDialog: React.FC<{ target: GeneratedImageResult; rating: number; setRating: (value: number) => void; comment: string; setComment: (comment: string) => void; tags: string[]; setTags: (tags: string[]) => void; onClose: () => void; onSubmit: (decision: 'approved' | 'rejected') => void }> = ({ target, rating, setRating, comment, setComment, tags, setTags, onClose, onSubmit }) => {
  const [decision, setDecision] = useState<'approved' | 'rejected'>(target.reviewStage === 'rejected' ? 'rejected' : 'approved');
  const toggleTag = (tag: string) => setTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60" /><div className="relative w-full max-w-xl overflow-hidden bg-white shadow-2xl"><header className="flex justify-between border-b border-slate-200 p-5"><div><p className="text-[11px] font-bold text-primary">图片单件评分与审核</p><h2 className="mt-1 font-black">版本 v{target.version}</h2></div><button onClick={onClose} className="material-symbols-outlined text-slate-400" aria-label="关闭审核">close</button></header><div className="p-5"><div className="flex gap-3 border border-slate-100 bg-slate-50 p-3"><img src={target.url} alt="待审核图片" className="h-16 w-16 object-cover" referrerPolicy="no-referrer"/><div><p className="text-sm font-black">IMAGE #{target.version}</p><p className="mt-1 text-xs text-slate-400">记录一次审核决策与评分。</p></div></div><div className="mt-5"><p className="text-xs font-black">审核决策</p><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setDecision('approved')} className={`h-10 text-xs font-bold ${decision === 'approved' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>通过</button><button onClick={() => setDecision('rejected')} className={`h-10 text-xs font-bold ${decision === 'rejected' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>打回</button></div></div><div className="mt-5"><p className="text-xs font-black">审美评分 {rating} / 5</p><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => setRating(value)} className={`material-symbols-outlined text-3xl ${value <= rating ? 'text-amber-400' : 'text-slate-300'}`} aria-label={`评分 ${value}`}>star</button>)}</div></div><div className="mt-5"><p className="text-xs font-black">问题打标</p><div className="mt-2 flex flex-wrap gap-2">{['主体漂移', '色彩失真', '构图问题', '细节质感', '人物扭曲', '商业可用'].map((tag) => <button key={tag} onClick={() => toggleTag(tag)} className={`border px-2.5 py-1.5 text-[11px] font-bold ${tags.includes(tag) ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 text-slate-500'}`}>{tag}</button>)}</div></div><label className="mt-5 block text-xs font-black">审核意见<textarea value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 h-24 w-full border border-slate-200 p-3 text-xs font-normal" placeholder="填写修改意见或通过说明" /></label></div><footer className="flex justify-end gap-2 border-t border-slate-200 p-4"><button onClick={onClose} className="h-9 border border-slate-200 px-4 text-xs font-bold">取消</button><button onClick={() => onSubmit(decision)} className="h-9 bg-primary px-4 text-xs font-bold text-white">提交决策评分</button></footer></div></div>;
};
