import React, { useEffect, useRef, useState } from 'react';
import { GeneratedImageResult, GenerationTask, ProductAsset, ResultReviewStage, VideoTaskEntryContext } from '../types';

interface TaskDetailsDrawerProps {
  task: GenerationTask;
  products: ProductAsset[];
  onClose: () => void;
  onUpdateTask: (task: GenerationTask) => void;
  onAddTask: (task: GenerationTask) => void;
  onCreateVideo: (context: VideoTaskEntryContext | GenerationTask) => void;
  initialTab?: 'overview' | 'inputs' | 'results' | 'reviews' | 'costs';
}

const stageLabel: Record<ResultReviewStage, string> = {
  candidate: '待评分审核', aesthetic_review: '待评分审核', listing_review: '待评分审核', approved: '审核通过', rejected: '已打回', unavailable: '不可用',
};
const stageStyle: Record<ResultReviewStage, string> = {
  candidate: 'bg-slate-100 text-slate-600', aesthetic_review: 'bg-slate-100 text-slate-600', listing_review: 'bg-slate-100 text-slate-600', approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-700', unavailable: 'bg-slate-200 text-slate-500',
};

const resolveResults = (task: GenerationTask): GeneratedImageResult[] => task.results?.length
  ? task.results
  : task.resultUrl || task.status === 'candidate' || task.status === 'completed'
    ? [{ id: `${task.id}-result-1`, url: task.resultUrl ?? task.productImg, version: 1, reviewStage: 'candidate' }]
    : [];

export const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({ task, products, onClose, onUpdateTask, onAddTask, onCreateVideo, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'inputs' | 'results' | 'reviews' | 'costs'>(initialTab);
  const [results, setResults] = useState<GeneratedImageResult[]>(() => resolveResults(task));
  const [editTarget, setEditTarget] = useState<GeneratedImageResult | null>(null);
  const [reviewTarget, setReviewTarget] = useState<GeneratedImageResult | null>(null);
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const product = products.find((item) => item.name === task.productName);

  useEffect(() => { setResults(resolveResults(task)); }, [task]);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  const sync = (next: GeneratedImageResult[]) => {
    setResults(next);
    const nextStatus = next.some((item) => item.reviewStage === 'approved') ? 'archived'
      : next.some((item) => item.reviewStage === 'rejected') ? 'rejected'
      : 'candidate';
    onUpdateTask({ ...task, status: nextStatus, progress: 100, results: next, resultUrl: next[0]?.url ?? task.resultUrl });
  };

  const submitReview = (decision: 'approved' | 'rejected') => {
    if (!reviewTarget) return;
    const next = results.map((item) => item.id === reviewTarget.id ? {
      ...item,
      reviewStage: decision,
      aestheticReview: {
        reviewer: '陈美晴 · 设计/美工',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        rating,
        tags,
        comment: comment || (decision === 'approved' ? '评分审核通过，可进入视频生成。' : '评分审核打回，请根据意见修改。'),
        decision,
      },
    } : item);
    sync(next);
    setReviewTarget(null); setComment(''); setTags([]);
  };

  const createEditTask = (target: GeneratedImageResult, instruction: string, maskDataUrl: string) => {
    const version = Math.max(...results.map((item) => item.version), 0) + 1;
    const newResult: GeneratedImageResult = { id: `${task.id}-result-${version}`, url: target.url, version, reviewStage: 'candidate', parentImageId: target.id, editInstruction: instruction, maskDataUrl };
    const childTask: GenerationTask = {
      ...task,
      id: `E-${Date.now()}`,
      name: `二次编辑 v${version} · ${task.name}`,
      status: 'running', progress: 0,
      parentResultId: target.id, editInstruction: instruction, maskDataUrl,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      results: [newResult], resultUrl: undefined,
    };
    onAddTask(childTask);
    window.setTimeout(() => {
      onAddTask({ ...childTask, status: 'candidate', progress: 100, resultUrl: target.url });
      sync([...results, newResult]);
    }, 850);
  };

  const statusText = task.status === 'running' ? '生成中' : task.status === 'archived' ? '审核通过' : task.status === 'candidate' ? '待评分审核' : task.status === 'rejected' ? '已打回' : task.status;
  const detailRows = [
    ['图片类型', task.imageType ? ({ product_main: '商品主图', scene_detail: '详情/场景图', detail_closeup: '细节图', on_model: '上身/三视图' }[task.imageType]) : task.type === 'image' ? '图片任务' : '视频任务'],
    ['任务模板', task.templateName], ['比例', task.params?.ratio ?? '未设置'], ['模型', task.modelSnapshot?.modelName ?? task.modelChannel ?? '未设置'], ['任务组', task.groupId ?? '单任务'], ['创建时间', task.timestamp],
  ];

  return <div className="fixed inset-0 z-50 flex justify-end"><button onClick={onClose} className="absolute inset-0 bg-slate-900/35" aria-label="关闭任务详情" /><section className="relative z-10 w-full max-w-5xl h-full bg-[#f5f7fb] shadow-2xl flex flex-col">
    <header className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between"><div><p className="text-[11px] font-bold text-primary">任务详情 · {task.id}</p><h2 className="text-lg font-black mt-1">{task.name}</h2></div><div className="flex gap-3 items-center"><span className="px-2 py-1 rounded text-[11px] font-bold bg-slate-100 text-slate-600">{statusText}</span><button onClick={onClose} className="material-symbols-outlined text-slate-500">close</button></div></header>
    <nav className="bg-white px-6 flex gap-5 border-b border-slate-200">{([{ id: 'overview', label: '概览' }, { id: 'inputs', label: '输入素材' }, { id: 'results', label: `生成结果 (${results.length})` }, { id: 'reviews', label: '评分记录' }, { id: 'costs', label: '成本' }] as const).map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 text-xs font-bold border-b-2 ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>{tab.label}</button>)}</nav>
    <main className="flex-1 overflow-y-auto p-6">
      {activeTab === 'overview' && <div className="grid lg:grid-cols-[1fr_320px] gap-5"><div className="bg-white rounded-lg border border-slate-200 p-5"><p className="text-[11px] font-bold text-primary">任务级 Prompt 副本</p><p className="mt-3 text-sm leading-7 text-slate-700">{task.taskPrompt ?? task.params?.prompt ?? '尚未生成 Prompt。'}</p>{task.negativePrompt && <p className="mt-4 p-3 rounded bg-slate-50 text-xs text-slate-500"><b className="text-slate-700">负面约束：</b>{task.negativePrompt}</p>}</div><div className="bg-white rounded-lg border border-slate-200 p-5"><h3 className="font-black text-sm">任务配置</h3><div className="mt-4 space-y-3">{detailRows.map(([label, value]) => <div key={label}><p className="text-[10px] text-slate-400">{label}</p><p className="text-xs font-bold mt-1">{value}</p></div>)}</div></div></div>}
      {activeTab === 'inputs' && <div className="grid md:grid-cols-2 gap-5"><div className="bg-white rounded-lg border border-slate-200 p-5"><h3 className="font-black text-sm">商品主体</h3><img src={task.productImg} alt={task.productName} className="mt-4 w-full max-h-80 object-cover rounded-md" referrerPolicy="no-referrer"/><p className="mt-3 text-xs font-bold">{task.productName}</p></div><div className="bg-white rounded-lg border border-slate-200 p-5"><h3 className="font-black text-sm">商品与参考上下文</h3><div className="mt-4 text-xs leading-7 text-slate-600"><p>商品类目：{product?.category ?? '未识别'}</p><p>核心卖点：{product?.specs.sellingPoints.slice(0, 2).join('、') ?? '未设置'}</p><p>参考图：来源、角色和替换记录保留在本次任务快照中。</p><p>模特：任务创建时的选择仅影响本次 Prompt。</p></div></div></div>}
      {activeTab === 'results' && <div><div><p className="text-[11px] font-bold text-primary">版本链</p><h3 className="text-base font-black mt-1">先修改，再评分审核</h3><p className="mt-1 text-xs text-slate-500">每个版本可独立修改和评分；原图不会被覆盖。</p></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-5">{results.length ? results.map((result) => <article key={result.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden"><img src={result.url} alt={`版本 ${result.version}`} className="w-full h-52 object-cover" referrerPolicy="no-referrer"/><div className="p-4"><div className="flex justify-between items-center"><b className="text-xs">版本 v{result.version}</b><span className={`px-2 py-1 rounded text-[10px] font-bold ${stageStyle[result.reviewStage]}`}>{stageLabel[result.reviewStage]}</span></div>{result.editInstruction && <p className="mt-2 text-[11px] text-slate-500 line-clamp-2">编辑：{result.editInstruction}</p>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setEditTarget(result)} className="h-8 px-2.5 rounded border border-slate-200 text-xs font-bold">二次编辑</button>{result.reviewStage === 'candidate' || result.reviewStage === 'rejected' ? <button onClick={() => { setReviewTarget(result); setRating(4); setComment(''); setTags([]); }} className="h-8 px-2.5 rounded bg-primary text-white text-xs font-bold">评分与审核</button> : null}{result.reviewStage === 'approved' && task.type === 'image' ? <button onClick={() => onCreateVideo({ ...task, resultUrl: result.url, results: [result] })} className="h-8 px-2.5 rounded bg-emerald-600 text-white text-xs font-bold">创建视频</button> : null}</div></div></article>) : <div className="col-span-full p-12 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-400 text-sm">任务尚未生成结果。</div>}</div></div>}
      {activeTab === 'reviews' && <div className="grid lg:grid-cols-2 gap-5">{results.map((result) => <article key={result.id} className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex justify-between"><h3 className="text-sm font-black">版本 v{result.version}</h3><span className={`px-2 py-1 rounded text-[10px] ${stageStyle[result.reviewStage]}`}>{stageLabel[result.reviewStage]}</span></div>{result.aestheticReview ? <div className="mt-4 p-3 rounded bg-blue-50 text-xs"><b>评分 {result.aestheticReview.rating} / 5 · {result.aestheticReview.decision === 'approved' ? '通过' : '打回'}</b><p className="mt-1">{result.aestheticReview.comment}</p><p className="mt-2 text-[10px] text-slate-500">{result.aestheticReview.tags.join('、') || '未打标签'}</p></div> : <p className="mt-4 text-xs text-slate-400">尚未评分审核</p>}</article>)}</div>}
      {activeTab === 'costs' && <div className="bg-white rounded-lg border border-slate-200 p-5 max-w-xl"><p className="text-[11px] font-bold text-primary">成本快照</p><h3 className="font-black mt-1">本次任务预估成本</h3><p className="mt-5 text-3xl font-black">{task.modelSnapshot?.estimatedCost?.toFixed(1) ?? '—'} <span className="text-sm text-slate-400">元</span></p><p className="mt-3 text-xs text-slate-500">派生编辑版本会产生独立的模型调用成本。</p></div>}
    </main>
    {editTarget && <ImageEditDialog image={editTarget} onClose={() => setEditTarget(null)} onSubmit={(instruction, mask) => { createEditTask(editTarget, instruction, mask); setEditTarget(null); }} />}
    {reviewTarget && <ReviewDialog target={reviewTarget} rating={rating} setRating={setRating} comment={comment} setComment={setComment} tags={tags} setTags={setTags} onClose={() => setReviewTarget(null)} onSubmit={submitReview} />}
  </section></div>;
};

const ImageEditDialog: React.FC<{ image: GeneratedImageResult; onClose: () => void; onSubmit: (instruction: string, maskDataUrl: string) => void }> = ({ image, onClose, onSubmit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [brushSize, setBrushSize] = useState(32);
  const [erasing, setErasing] = useState(false);
  const [instruction, setInstruction] = useState('请修改局部效果，同时保持商品主体、材质和品牌信息不变。');
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return; const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!; const { x, y } = point(event);
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over'; ctx.fillStyle = 'rgba(2,86,255,.52)'; ctx.beginPath(); ctx.arc(x, y, brushSize, 0, Math.PI * 2); ctx.fill();
  };
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60" /><div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-lg shadow-2xl p-6"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">图片二次编辑</p><h2 className="font-black mt-1">标记需要修改的区域</h2></div><button onClick={onClose} className="material-symbols-outlined">close</button></div><div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 mt-5"><div><div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden select-none"><img src={image.url} alt="编辑源图片" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer"/><canvas ref={canvasRef} width={800} height={600} onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); draw(event); }} onPointerMove={draw} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} className="absolute inset-0 w-full h-full cursor-crosshair" /></div><p className="mt-2 text-[11px] text-slate-500">蓝色涂抹区域为需要修改的区域；未涂抹区域会作为保真要求传入派生任务。</p></div><aside className="space-y-4"><label className="block text-xs font-bold">修改要求<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} className="mt-1.5 h-28 w-full border border-slate-200 rounded-md p-2 text-xs font-normal leading-5" /></label><label className="block text-xs font-bold">画笔大小<input type="range" min="8" max="72" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="mt-3 w-full" /></label><button onClick={() => setErasing((value) => !value)} className={`w-full h-9 rounded border text-xs font-bold ${erasing ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200'}`}>{erasing ? '当前：橡皮擦' : '切换为橡皮擦'}</button><button onClick={() => { const canvas = canvasRef.current!; canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height); }} className="w-full h-9 rounded border border-slate-200 text-xs font-bold">清空涂抹</button><button onClick={() => onSubmit(instruction, canvasRef.current?.toDataURL('image/png') ?? '')} className="w-full h-9 rounded bg-primary text-white text-xs font-bold">生成修改版本</button></aside></div></div></div>;
};

const ReviewDialog: React.FC<{ target: GeneratedImageResult; rating: number; setRating: (value: number) => void; comment: string; setComment: (value: string) => void; tags: string[]; setTags: (value: string[]) => void; onClose: () => void; onSubmit: (decision: 'approved' | 'rejected') => void }> = ({ target, rating, setRating, comment, setComment, tags, setTags, onClose, onSubmit }) => {
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const toggleTag = (tag: string) => setTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]);
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60" /><div className="relative w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden"><header className="p-5 border-b border-slate-200 flex justify-between"><div><p className="text-[11px] font-bold text-primary">图片单件评分与审核</p><h2 className="font-black mt-1">版本 v{target.version}</h2></div><button onClick={onClose} className="material-symbols-outlined text-slate-400">close</button></header><div className="p-5"><div className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"><img src={target.url} alt="待审核图片" className="w-16 h-16 rounded object-cover" referrerPolicy="no-referrer"/><div><p className="text-sm font-black">IMAGE #{target.version}</p><p className="mt-1 text-xs text-slate-400">记录一次审核决策与评分。</p></div></div><div className="mt-5"><p className="text-xs font-black">审核决策</p><div className="grid grid-cols-2 gap-2 mt-2"><button onClick={() => setDecision('approved')} className={`h-10 rounded-md text-xs font-bold ${decision === 'approved' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>通过</button><button onClick={() => setDecision('rejected')} className={`h-10 rounded-md text-xs font-bold ${decision === 'rejected' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>打回</button></div></div><div className="mt-5"><p className="text-xs font-black">审美评分 {rating} / 5</p><div className="flex gap-1 mt-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => setRating(value)} className={`material-symbols-outlined text-3xl ${value <= rating ? 'text-amber-400' : 'text-slate-300'}`}>star</button>)}</div></div><div className="mt-5"><p className="text-xs font-black">问题打标 <span className="font-normal text-slate-400">(多选)</span></p><div className="flex flex-wrap gap-2 mt-2">{['主体漂移', '色彩失真', '构图问题', '细节质感', '人物扭曲', '商业可用'].map((tag) => <button key={tag} onClick={() => toggleTag(tag)} className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border ${tags.includes(tag) ? 'bg-blue-50 border-primary text-primary' : 'border-slate-200 text-slate-500'}`}>{tag}</button>)}</div></div><label className="block mt-5 text-xs font-black">审核意见<textarea value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 h-24 w-full border border-slate-200 rounded-md p-3 text-xs font-normal" placeholder="填写修改意见或通过说明" /></label></div><footer className="p-4 border-t border-slate-200 flex justify-end gap-2"><button onClick={onClose} className="h-9 px-4 rounded border border-slate-200 text-xs font-bold">取消</button><button onClick={() => onSubmit(decision)} className="h-9 px-4 rounded bg-primary text-white text-xs font-bold">提交决策评分</button></footer></div></div>;
};
