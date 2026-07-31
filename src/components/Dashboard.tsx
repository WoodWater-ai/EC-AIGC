import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppScreen, GenerationTask, PendingItem, ResultTemplate, SystemUser, TaskDetailNavigation, TemplateMediaType } from '../types';
import { templatePublishBlockReason, videoTemplateTypeLabel } from '../templateUtils';

interface DashboardProps {
  tasks: GenerationTask[];
  templates: ResultTemplate[];
  pendingItems: PendingItem[];
  currentUser: SystemUser;
  canPublishTemplate: boolean;
  canManageTemplate: boolean;
  publishedTemplateTaskIds: ReadonlySet<string>;
  setScreen: (screen: AppScreen) => void;
  onUseTemplate: (template: ResultTemplate) => void;
  favoriteTemplateIds: ReadonlySet<string>;
  onToggleTemplateFavorite: (templateId: string) => void;
  onViewTemplate: (templateId: string) => void;
  onPublishTemplate: (task: GenerationTask) => void;
  getTemplateStatusForTask: (taskId: string) => ResultTemplate['status'] | undefined;
  onToggleTemplateStatus: (taskId: string) => void;
  onViewTask: (target: TaskDetailNavigation) => void;
  onOpenPending: () => void;
}

const taskResultUrl = (task: GenerationTask) => task.results?.at(-1)?.url ?? task.resultUrl ?? task.productImg;
const taskStatusLabel: Record<GenerationTask['status'], string> = {
  pending: '排队中', running: '生成中', completed: '已完成', failed: '生成失败', rejected: '已打回', candidate: '待评分', aesthetic_review: '待评分', listing_review: '待上架', archived: '已归档', cancelled: '已取消',
};

export const Dashboard: React.FC<DashboardProps> = ({ tasks, templates, pendingItems, currentUser, canPublishTemplate, canManageTemplate, publishedTemplateTaskIds, setScreen, onUseTemplate, favoriteTemplateIds, onToggleTemplateFavorite, onViewTemplate, onPublishTemplate, getTemplateStatusForTask, onToggleTemplateStatus, onViewTask, onOpenPending }) => {
  const [tab, setTab] = useState<'camp' | 'mine'>('camp');
  const [media, setMedia] = useState<TemplateMediaType>('image');
  const [category, setCategory] = useState('全部');
  const [style, setStyle] = useState('全部');
  const [order, setOrder] = useState<'recommended' | 'latest'>('recommended');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const runningCount = tasks.filter((task) => task.status === 'running' || task.status === 'pending').length;
  const unreadPending = pendingItems.filter((item) => !item.read).length;
  const mediaTemplates = templates.filter((item) => item.mediaType === media);
  const categories = ['全部', ...new Set(mediaTemplates.map((item) => item.category))];
  const styles = ['全部', ...new Set(mediaTemplates.map((item) => item.style))];
  const campTemplates = useMemo(() => mediaTemplates.filter((item) => item.status === 'active'
    && (category === '全部' || item.category === category)
    && (style === '全部' || item.style === style))
    .sort((left, right) => order === 'recommended' ? right.usageCount - left.usageCount : right.createdAt.localeCompare(left.createdAt)), [category, mediaTemplates, order, style]);
  const myWorks = useMemo(() => tasks.filter((task) => task.creator === currentUser.name && task.progress === 100
    && !['pending', 'running', 'failed', 'cancelled'].includes(task.status) && task.type === media), [currentUser.name, media, tasks]);
  const resetFilters = () => { setCategory('全部'); setStyle('全部'); setOrder('recommended'); };
  const imageCount = templates.filter((item) => item.mediaType === 'image' && item.status === 'active').length;
  const videoCount = templates.filter((item) => item.mediaType === 'video' && item.status === 'active').length;
  const selectedTemplate = selectedTemplateId ? templates.find((item) => item.id === selectedTemplateId) ?? null : null;

  const openTemplateDetail = (template: ResultTemplate) => {
    setSelectedTemplateId(template.id);
    onViewTemplate(template.id);
  };

  return <div className="space-y-5">
    <section className="flex flex-wrap items-center gap-1 rounded-lg border border-[#e8e4df] bg-white px-3 py-2 shadow-[0_6px_20px_rgba(53,44,37,0.035)] sm:px-4" aria-label="生产状态">
      <span className="mr-1 hidden text-[10px] font-black tracking-[0.1em] text-[#a9a39c] sm:inline">生产状态</span>
      <MiniMetric icon="progress_activity" label="进行中" value={`${runningCount} 个任务`} onClick={() => setScreen('TASKS' as AppScreen)} />
      <MiniMetric icon="notifications" label="待处理" value={`${unreadPending} 项需关注`} alert={unreadPending > 0} onClick={onOpenPending} />
      <span className="ml-auto hidden text-[11px] text-[#a9a39c] lg:inline">模板成片可直接复用</span>
    </section>

    <section>
      <div className="flex border-b border-[#e8e4df]">
        <div className="flex gap-6"><TopTab active={tab === 'camp'} label="模板营地" count={templates.filter((item) => item.status === 'active').length} onClick={() => setTab('camp')} /><TopTab active={tab === 'mine'} label="我的作品" count={tasks.filter((task) => task.creator === currentUser.name && task.progress === 100).length} onClick={() => setTab('mine')} /></div>
      </div>

      <div className="mt-3 rounded-lg border border-[#e8e4df] bg-white p-2 shadow-[0_6px_20px_rgba(53,44,37,0.035)]">
        <div className="grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <MediaTabs media={media} imageCount={imageCount} videoCount={videoCount} onChange={(next) => { setMedia(next); resetFilters(); }} />
          {tab === 'camp' && <StyleRail activeStyle={style} styles={styles} onChange={setStyle} />}
          {tab === 'camp' && <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2 lg:border-t-0 lg:pt-0"><FilterSelect icon="category" label="品类" value={category} values={categories} onChange={setCategory} /><FilterSelect icon="sort" label="排序" value={order} values={['recommended', 'latest']} labels={{ recommended: '推荐', latest: '最新' }} onChange={(value) => setOrder(value as typeof order)} /></div>}
        </div>
      </div>

      {tab === 'camp' ? <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {campTemplates.map((template) => {
          const sourceTask = tasks.find((task) => task.id === template.sourceTaskId);
          const sourceProductUrl = sourceTask?.productName === template.sourceProductName ? sourceTask.productImg : undefined;
          return <TemplateCard key={template.id} template={template} sourceProductUrl={sourceProductUrl} isFavorite={favoriteTemplateIds.has(template.id)} onUse={() => onUseTemplate(template)} onOpenDetail={() => openTemplateDetail(template)} onToggleFavorite={() => onToggleTemplateFavorite(template.id)} />;
        })}
        {campTemplates.length === 0 && <EmptyState label="没有匹配的模板" action="重置筛选" onAction={resetFilters} />}
      </div> : <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {myWorks.map((task) => <MyWorkCard key={task.id} task={task} templateStatus={publishedTemplateTaskIds.has(task.id) ? getTemplateStatusForTask(task.id) : undefined} canPublish={canPublishTemplate} canManage={canManageTemplate} onPublish={() => onPublishTemplate(task)} onToggleStatus={() => onToggleTemplateStatus(task.id)} onView={() => onViewTask({ taskId: task.id, groupId: task.groupId, mediaType: task.type })} onReuse={() => setScreen(task.type === 'image' ? 'CREATE_IMAGE_TASK' as AppScreen : 'CREATE_VIDEO_TASK' as AppScreen)} />)}
        {myWorks.length === 0 && <EmptyState label={`还没有已完成${media === 'image' ? '图片' : '视频'}作品`} action="开始创作" onAction={() => setScreen(media === 'image' ? 'CREATE_IMAGE_TASK' as AppScreen : 'CREATE_VIDEO_TASK' as AppScreen)} />}
      </div>}
    </section>
    {selectedTemplate && <TemplateDetailDrawer template={selectedTemplate} sourceProductUrl={tasks.find((task) => task.id === selectedTemplate.sourceTaskId && task.productName === selectedTemplate.sourceProductName)?.productImg} isFavorite={favoriteTemplateIds.has(selectedTemplate.id)} onClose={() => setSelectedTemplateId(null)} onUse={() => onUseTemplate(selectedTemplate)} onToggleFavorite={() => onToggleTemplateFavorite(selectedTemplate.id)} />}
  </div>;
};

const MiniMetric: React.FC<{ icon: string; label: string; value: string; alert?: boolean; onClick: () => void }> = ({ icon, label, value, alert, onClick }) => <button onClick={onClick} className="flex items-center gap-2 border-l border-[#eeeae6] px-3 py-1 text-left first:border-l-0 first:pl-1 transition-colors hover:text-primary"><span className={`material-symbols-outlined text-[16px] ${alert ? 'text-warning' : 'text-[#a9a39c]'}`}>{icon}</span><span><span className="mr-1 text-[10px] font-bold text-[#a9a39c]">{label}</span><span className="text-[11px] font-black text-[#393431]">{value}</span></span></button>;
const TopTab: React.FC<{ active: boolean; label: string; count: number; onClick: () => void }> = ({ active, label, count, onClick }) => <button onClick={onClick} className={`border-b-2 pb-2.5 text-sm font-black transition-colors ${active ? 'border-primary text-[#201f1d]' : 'border-transparent text-[#a9a39c] hover:text-[#393431]'}`}>{label}<span className={`ml-1.5 text-[10px] ${active ? 'text-primary' : 'text-[#a9a39c]'}`}>{count}</span></button>;
const MediaTabs: React.FC<{ media: TemplateMediaType; imageCount: number; videoCount: number; onChange: (media: TemplateMediaType) => void }> = ({ media, imageCount, videoCount, onChange }) => <div className="inline-flex w-fit shrink-0 rounded-md border border-[#e8e4df] bg-[#f6f3ef] p-1" role="tablist" aria-label="模板媒介"><button role="tab" aria-selected={media === 'image'} onClick={() => onChange('image')} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] px-3 text-xs font-black whitespace-nowrap transition-all ${media === 'image' ? 'bg-white text-[#201f1d] shadow-sm' : 'text-[#79736d] hover:text-[#393431]'}`}><span className="material-symbols-outlined text-[16px]">image</span>图片<span className="text-[10px] text-[#a9a39c]">{imageCount}</span></button><button role="tab" aria-selected={media === 'video'} onClick={() => onChange('video')} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] px-3 text-xs font-black whitespace-nowrap transition-all ${media === 'video' ? 'bg-white text-[#201f1d] shadow-sm' : 'text-[#79736d] hover:text-[#393431]'}`}><span className="material-symbols-outlined text-[16px]">play_circle</span>视频<span className="text-[10px] text-[#a9a39c]">{videoCount}</span></button></div>;
const StyleRail: React.FC<{ activeStyle: string; styles: string[]; onChange: (style: string) => void }> = ({ activeStyle, styles, onChange }) => <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 pb-1 pt-1 lg:px-2 lg:pb-0"><span className="mr-1 shrink-0 text-[10px] font-black tracking-[0.08em] text-[#a9a39c]">风格</span>{styles.map((item) => <button key={item} onClick={() => onChange(item)} className={`h-8 shrink-0 rounded-md border px-3 text-[11px] font-bold transition-all ${activeStyle === item ? 'border-[#201f1d] bg-[#201f1d] text-white shadow-sm' : 'border-[#e8e4df] bg-white text-[#79736d] hover:border-[#c6beb6] hover:text-[#393431]'}`}>{item}</button>)}</div>;
const FilterSelect: React.FC<{ icon: string; label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }> = ({ icon, label, value, values, labels, onChange }) => <label className="flex h-8 items-center gap-1 rounded-md border border-[#e8e4df] bg-white px-2 text-[11px] font-bold text-[#79736d] transition-colors hover:border-[#c6beb6]"><span className="material-symbols-outlined text-[15px] text-[#a9a39c]">{icon}</span><span className="hidden sm:inline">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="max-w-24 bg-transparent text-[11px] font-black text-[#393431] outline-none">{values.map((item) => <option key={item} value={item}>{labels?.[item] ?? item}</option>)}</select></label>;

const SourceProduct: React.FC<{ image: string }> = ({ image }) => <div className="absolute bottom-3 right-3 flex items-end gap-1"><span className="mb-3 grid h-5 w-5 place-items-center rounded-full bg-[#201f1d] text-white shadow-md"><span className="material-symbols-outlined text-[12px]">arrow_forward</span></span><figure className="rounded-md border border-white bg-white p-1.5 shadow-[0_6px_18px_rgba(36,30,25,0.24)]"><img src={image} alt="可替换的主体商品图" className="h-12 w-12 rounded-[3px] bg-white object-contain" referrerPolicy="no-referrer" /><figcaption className="mt-1 text-center text-[8px] font-black tracking-[0.08em] text-[#79736d]">主体图</figcaption></figure></div>;
const outputTypeLabel = (template: ResultTemplate) => {
  if (template.mediaType === 'video') return videoTemplateTypeLabel(template.snapshot.videoMode);
  if (template.snapshot.imageType === 'scene_detail') return '场景细节';
  if (template.snapshot.imageType === 'product_main') return '商品主图';
  return '模特上身';
};

interface TemplateMeta {
  productName: string;
  type: string;
  style: string;
  scene: string;
  poseOrShot: string;
  poseLabel: '姿势' | '镜头';
}

const getTemplateMeta = (template: ResultTemplate): TemplateMeta => {
  const scene = template.snapshot.references.find((reference) => reference.role === 'scene')?.name ?? template.usage.split('/')[0].trim();
  const poseOrShot = template.snapshot.references.find((reference) => reference.role === 'pose' || reference.role === 'action')?.name
    ?? (template.mediaType === 'video' ? `${template.snapshot.motion ?? '适中'}运镜` : '自然站姿');
  return {
    productName: template.sourceProductName ?? template.name,
    type: outputTypeLabel(template),
    style: template.style,
    scene,
    poseOrShot,
    poseLabel: template.mediaType === 'video' ? '镜头' : '姿势',
  };
};

const TemplateCard: React.FC<{ template: ResultTemplate; sourceProductUrl?: string; isFavorite: boolean; onUse: () => void; onOpenDetail: () => void; onToggleFavorite: () => void }> = ({ template, sourceProductUrl, isFavorite, onUse, onOpenDetail, onToggleFavorite }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const meta = getTemplateMeta(template);
  const playPreview = () => { videoRef.current?.play().catch(() => undefined); };
  const pausePreview = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  return <article onMouseEnter={playPreview} onMouseLeave={pausePreview} className="group relative overflow-hidden rounded-lg border border-[#e8e4df] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#c6beb6] hover:shadow-[0_16px_32px_rgba(53,44,37,0.15)]">
    <div className="relative aspect-[4/5] overflow-hidden bg-[#f4f1ed]">
      <button type="button" onClick={onOpenDetail} onMouseEnter={playPreview} onMouseLeave={pausePreview} className="absolute inset-0 z-0 block h-full w-full cursor-pointer overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset" aria-label={`查看模板详情：${meta.productName}`}>
      <img src={template.coverUrl} alt={`${meta.productName}模板成片`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" referrerPolicy="no-referrer" />
      {template.hoverPreviewUrl && <video ref={videoRef} muted loop playsInline poster={template.coverUrl} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" src={template.hoverPreviewUrl} />}
      {template.mediaType === 'video' && <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/80 bg-[#201f1d]/75 text-white shadow-sm"><span className="material-symbols-outlined text-[17px]">play_arrow</span></span>}
      {sourceProductUrl && <div className="transition-opacity duration-200 lg:group-hover:opacity-0"><SourceProduct image={sourceProductUrl} /></div>}
      </button>
      <div onClick={onOpenDetail} className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#171411]/95 via-[#171411]/72 to-transparent px-3 pb-3 pt-20 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
        <h2 className="truncate text-sm font-black text-white" title={meta.productName}>{meta.productName}</h2>
        <div className="mt-2 flex flex-wrap gap-1"><TemplateTag label="类型" value={meta.type} /><TemplateTag label="风格" value={meta.style} /><TemplateTag label="场景" value={meta.scene} /><TemplateTag label={meta.poseLabel} value={meta.poseOrShot} /></div>
        <div className="mt-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-[10px] font-bold text-white/65"><span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">visibility</span>{template.viewCount}</span><button type="button" onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }} aria-pressed={isFavorite} aria-label={isFavorite ? '取消收藏模板' : '收藏模板'} className={`inline-flex items-center gap-1 transition-colors ${isFavorite ? 'text-primary-light' : 'hover:text-white'}`}><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>{template.favoriteCount}</button></div><button type="button" onClick={(event) => { event.stopPropagation(); onUse(); }} className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-2.5 text-[11px] font-black text-[#201f1d] transition-colors hover:bg-primary hover:text-white">做同款<span className="material-symbols-outlined text-[15px]">arrow_outward</span></button></div>
      </div>
    </div>
  </article>;
};

const TemplateTag: React.FC<{ label: string; value: string }> = ({ label, value }) => <span className="max-w-full truncate rounded-[4px] border border-white/15 bg-white/10 px-1.5 py-1 text-[9px] font-medium text-white/90"><span className="mr-1 text-white/55">{label}</span>{value}</span>;

interface TemplateDetailDrawerProps {
  template: ResultTemplate;
  sourceProductUrl?: string;
  isFavorite: boolean;
  onClose: () => void;
  onUse: () => void;
  onToggleFavorite: () => void;
}

const TemplateDetailDrawer: React.FC<TemplateDetailDrawerProps> = ({ template, sourceProductUrl, isFavorite, onClose, onUse, onToggleFavorite }) => {
  const meta = getTemplateMeta(template);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const playPreview = () => { videoRef.current?.play().catch(() => undefined); };
  const pausePreview = () => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } };

  return <div className="fixed inset-0 z-[70] bg-[#171411]/65 p-0 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={`${meta.productName}模板详情`}>
    <button type="button" onClick={onClose} className="absolute inset-0 cursor-default" aria-label="关闭模板详情" />
    <section className="relative mx-auto flex h-full w-full max-w-6xl flex-col overflow-y-auto bg-[#fbfaf8] shadow-2xl sm:h-auto sm:min-h-[620px] sm:flex-row sm:overflow-hidden">
      <div onMouseEnter={playPreview} onMouseLeave={pausePreview} className="relative min-h-[46vh] bg-[#25211e] sm:min-h-0 sm:w-[58%]">
        <img src={template.coverUrl} alt={`${meta.productName}模板预览`} className="h-full min-h-[46vh] w-full object-cover sm:min-h-0" referrerPolicy="no-referrer" />
        {template.hoverPreviewUrl && <video ref={videoRef} muted loop playsInline poster={template.coverUrl} src={template.hoverPreviewUrl} className="absolute inset-0 h-full w-full object-cover" />}
        {sourceProductUrl && <SourceProduct image={sourceProductUrl} />}
        {template.mediaType === 'video' && <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#171411]/75 px-3 py-1.5 text-[11px] font-black text-white"><span className="material-symbols-outlined text-[16px]">play_circle</span>视频模板 · 悬停预览</span>}
      </div>
      <aside className="relative flex min-w-0 flex-1 flex-col bg-[#fbfaf8] p-5 sm:p-7">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#79736d] transition-colors hover:bg-[#f0ede9] hover:text-[#201f1d]" aria-label="关闭模板详情"><span className="material-symbols-outlined text-[20px]">close</span></button>
        <p className="pr-10 text-[10px] font-black tracking-[0.12em] text-primary">{template.mediaType === 'image' ? '图片模板' : '视频模板'} · V{template.version}</p>
        <h2 className="mt-2 pr-8 text-xl font-black leading-7 text-[#201f1d]">{meta.productName}</h2>
        <p className="mt-2 text-xs leading-5 text-[#79736d]">{template.description}</p>
        <div className="mt-5 flex items-center gap-4 border-y border-[#ece8e3] py-3"><button type="button" onClick={onToggleFavorite} aria-pressed={isFavorite} className={`inline-flex items-center gap-1.5 text-xs font-bold ${isFavorite ? 'text-primary' : 'text-[#6f6963] hover:text-primary'}`}><span className={`material-symbols-outlined text-[18px] ${isFavorite ? 'fill-1' : ''}`}>favorite</span>{template.favoriteCount} 收藏</button><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6f6963]"><span className="material-symbols-outlined text-[18px]">visibility</span>{template.viewCount} 浏览</span></div>
        <dl className="mt-5 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-3 text-xs"><dt className="font-bold text-[#a19b94]">适用品类</dt><dd className="font-bold text-[#443f3a]">{template.category}</dd><dt className="font-bold text-[#a19b94]">{template.mediaType === 'image' ? '图片类型' : '视频类型'}</dt><dd className="font-bold text-[#443f3a]">{meta.type}</dd><dt className="font-bold text-[#a19b94]">风格</dt><dd className="font-bold text-[#443f3a]">{meta.style}</dd><dt className="font-bold text-[#a19b94]">场景</dt><dd className="font-bold text-[#443f3a]">{meta.scene}</dd><dt className="font-bold text-[#a19b94]">{meta.poseLabel}</dt><dd className="font-bold text-[#443f3a]">{meta.poseOrShot}</dd></dl>
        <div className="mt-5 rounded-md border border-[#eee7df] bg-[#f7f3ed] p-3 text-[11px] leading-5 text-[#726a62]"><span className="font-black text-[#443f3a]">替换规则：</span>保留模板的构图、光线和生成参数；开始前仅需替换当前商品主体素材。</div>
        <div className="mt-auto pt-6"><button type="button" onClick={onUse} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#201f1d] text-xs font-black text-white transition-colors hover:bg-primary">使用此模板<span className="material-symbols-outlined text-[17px]">arrow_outward</span></button></div>
      </aside>
    </section>
  </div>;
};
const MyWorkCard: React.FC<{ task: GenerationTask; templateStatus?: ResultTemplate['status']; canPublish: boolean; canManage: boolean; onPublish: () => void; onToggleStatus: () => void; onView: () => void; onReuse: () => void }> = ({ task, templateStatus, canPublish, canManage, onPublish, onToggleStatus, onView, onReuse }) => {
  const publishReason = templatePublishBlockReason(task);
  const publicationLabel = templateStatus === 'active' ? '下架模板' : templateStatus === 'disabled' ? '重新上架' : '设为模板';
  const publicationTitle = templateStatus ? !canManage ? '当前账号没有管理模板权限' : undefined : !canPublish ? '当前账号没有发布模板权限' : publishReason ?? undefined;
  return <article className="group overflow-hidden rounded-lg border border-[#e8e4df] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#c6beb6] hover:shadow-[0_16px_32px_rgba(53,44,37,0.1)]"><div className="relative aspect-[4/5] overflow-hidden bg-[#f4f1ed]"><img src={taskResultUrl(task)} alt={task.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" referrerPolicy="no-referrer" /><span className="absolute left-3 top-3 rounded-md border border-white/80 bg-white/90 px-2 py-1 text-[10px] font-black text-[#393431] shadow-sm">{task.type === 'image' ? '图片作品' : '视频作品'}</span><SourceProduct image={task.productImg} /></div><div className="p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-black text-[#201f1d]">{task.name}</h2><p className="mt-1 truncate text-[10px] font-bold text-[#a9a39c]">{taskStatusLabel[task.status]} · {task.templateName}</p></div>{templateStatus && <span className={`inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold ${templateStatus === 'active' ? 'text-emerald-600' : 'text-[#a9834b]'}`}><span className="material-symbols-outlined text-[14px]">{templateStatus === 'active' ? 'check_circle' : 'archive'}</span>{templateStatus === 'active' ? '已发布' : '已下架'}</span>}</div><div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f0ede9] pt-3"><button onClick={onView} className="h-8 rounded-md border border-[#e8e4df] px-2.5 text-xs font-bold text-[#625d58] transition-colors hover:border-[#c6beb6]">详情</button><button onClick={onReuse} className="h-8 rounded-md border border-[#e8e4df] px-2.5 text-xs font-bold text-[#625d58] transition-colors hover:border-[#c6beb6]">再次创作</button><button disabled={templateStatus ? !canManage : !canPublish || Boolean(publishReason)} title={publicationTitle} onClick={templateStatus ? onToggleStatus : onPublish} className={`ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${templateStatus === 'active' ? 'border border-[#dfc6a4] bg-[#fff8ec] text-[#93652d] hover:bg-[#fff0d8]' : templateStatus === 'disabled' ? 'bg-[#201f1d] text-white hover:bg-primary' : 'bg-[#201f1d] text-white hover:bg-primary'}`}>{templateStatus === 'active' && <span className="material-symbols-outlined text-[15px]">archive</span>}{templateStatus === 'disabled' && <span className="material-symbols-outlined text-[15px]">unarchive</span>}{publicationLabel}</button></div></div></article>;
};
const EmptyState: React.FC<{ label: string; action: string; onAction: () => void }> = ({ label, action, onAction }) => <div className="col-span-full flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center"><span className="material-symbols-outlined text-3xl text-slate-400">auto_awesome</span><p className="mt-3 text-sm font-bold text-slate-500">{label}</p><button onClick={onAction} className="mt-2 text-xs font-bold text-primary">{action}</button></div>;
