import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppScreen, GenerationTask, SystemUser } from '../types';
import {
  DashboardTemplate,
  mockDashboardTemplates,
  TemplateMediaType,
} from '../dashboardData';

interface DashboardProps {
  tasks: GenerationTask[];
  currentUser: SystemUser;
  setScreen: (screen: AppScreen) => void;
}

const taskStatusLabel: Record<GenerationTask['status'], string> = {
  pending: '排队中',
  running: '生成中',
  completed: '已完成',
  failed: '生成失败',
  rejected: '已打回',
};

export const Dashboard: React.FC<DashboardProps> = ({ tasks, currentUser, setScreen }) => {
  const [tab, setTab] = useState<'camp' | 'mine'>('camp');
  const [media, setMedia] = useState<TemplateMediaType>('image');
  const [category, setCategory] = useState('全部');
  const [style, setStyle] = useState('全部');
  const [order, setOrder] = useState<'recommended' | 'latest'>('recommended');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<ReadonlySet<string>>(() => new Set());
  const [templates, setTemplates] = useState(mockDashboardTemplates);
  const [publishedTaskIds, setPublishedTaskIds] = useState<ReadonlySet<string>>(() => new Set());

  const runningCount = tasks.filter((task) => task.status === 'running' || task.status === 'pending').length;
  const pendingCount = tasks.filter((task) => task.status === 'failed' || task.status === 'rejected').length;
  const mediaTemplates = templates.filter((item) => item.mediaType === media);
  const categories = ['全部', ...new Set(mediaTemplates.map((item) => item.category))];
  const styles = ['全部', ...new Set(mediaTemplates.map((item) => item.style))];
  const campTemplates = useMemo(
    () => mediaTemplates
      .filter((item) => item.status === 'active'
        && (category === '全部' || item.category === category)
        && (style === '全部' || item.style === style))
      .sort((left, right) => order === 'recommended'
        ? right.usageCount - left.usageCount
        : right.createdAt.localeCompare(left.createdAt)),
    [category, mediaTemplates, order, style],
  );
  const completedWorks = tasks.filter((task) => task.progress === 100
    && !['pending', 'running', 'failed'].includes(task.status)
    && task.type === media);
  const userWorks = completedWorks.filter((task) => task.creator === currentUser.name);
  const myWorks = userWorks.length > 0 ? userWorks : completedWorks;
  const selectedTemplate = selectedTemplateId
    ? templates.find((item) => item.id === selectedTemplateId) ?? null
    : null;
  const imageCount = templates.filter((item) => item.mediaType === 'image' && item.status === 'active').length;
  const videoCount = templates.filter((item) => item.mediaType === 'video' && item.status === 'active').length;

  const resetFilters = () => {
    setCategory('全部');
    setStyle('全部');
    setOrder('recommended');
  };

  const useTemplate = (template: DashboardTemplate) => {
    setScreen(template.mediaType === 'image' ? AppScreen.CREATE_IMAGE_TASK : AppScreen.CREATE_VIDEO_TASK);
  };

  const toggleFavorite = (template: DashboardTemplate) => {
    const wasFavorite = favoriteTemplateIds.has(template.id);
    setFavoriteTemplateIds((current) => {
      const next = new Set(current);
      if (wasFavorite) next.delete(template.id);
      else next.add(template.id);
      return next;
    });
    setTemplates((current) => current.map((item) => item.id === template.id
      ? { ...item, favoriteCount: Math.max(0, item.favoriteCount + (wasFavorite ? -1 : 1)) }
      : item));
  };

  const openTemplate = (template: DashboardTemplate) => {
    setSelectedTemplateId(template.id);
    setTemplates((current) => current.map((item) => item.id === template.id
      ? { ...item, viewCount: item.viewCount + 1 }
      : item));
  };

  const togglePublished = (taskId: string) => {
    setPublishedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <section
        className="flex flex-wrap items-center gap-1 rounded-lg border border-[#e8e4df] bg-white px-3 py-2 shadow-[0_6px_20px_rgba(53,44,37,0.035)] sm:px-4"
        aria-label="生产状态"
      >
        <span className="mr-1 hidden text-[10px] font-black tracking-[0.1em] text-[#a9a39c] sm:inline">生产状态</span>
        <MiniMetric icon="progress_activity" label="进行中" value={`${runningCount} 个任务`} onClick={() => setScreen(AppScreen.TASKS)} />
        <MiniMetric icon="notifications" label="待处理" value={`${pendingCount} 项需关注`} alert={pendingCount > 0} onClick={() => setScreen(AppScreen.TASKS)} />
        <span className="ml-auto hidden text-[11px] text-[#a9a39c] lg:inline">模板成片可直接复用</span>
      </section>

      <section>
        <div className="flex border-b border-[#e8e4df]">
          <div className="flex gap-6">
            <TopTab active={tab === 'camp'} label="模板营地" count={templates.filter((item) => item.status === 'active').length} onClick={() => setTab('camp')} />
            <TopTab active={tab === 'mine'} label="我的作品" count={completedWorks.length} onClick={() => setTab('mine')} />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[#e8e4df] bg-white p-2 shadow-[0_6px_20px_rgba(53,44,37,0.035)]">
          <div className="grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <MediaTabs
              media={media}
              imageCount={imageCount}
              videoCount={videoCount}
              onChange={(next) => {
                setMedia(next);
                resetFilters();
              }}
            />
            {tab === 'camp' && <StyleRail activeStyle={style} styles={styles} onChange={setStyle} />}
            {tab === 'camp' && (
              <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2 lg:border-t-0 lg:pt-0">
                <FilterSelect icon="category" label="品类" value={category} values={categories} onChange={setCategory} />
                <FilterSelect
                  icon="sort"
                  label="排序"
                  value={order}
                  values={['recommended', 'latest']}
                  labels={{ recommended: '推荐', latest: '最新' }}
                  onChange={(value) => setOrder(value as typeof order)}
                />
              </div>
            )}
          </div>
        </div>

        {tab === 'camp' ? (
          <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {campTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isFavorite={favoriteTemplateIds.has(template.id)}
                onUse={() => useTemplate(template)}
                onOpenDetail={() => openTemplate(template)}
                onToggleFavorite={() => toggleFavorite(template)}
              />
            ))}
            {campTemplates.length === 0 && <EmptyState label="没有匹配的模板" action="重置筛选" onAction={resetFilters} />}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {myWorks.map((task) => (
              <MyWorkCard
                key={task.id}
                task={task}
                isPublished={publishedTaskIds.has(task.id)}
                onPublish={() => togglePublished(task.id)}
                onView={() => setScreen(AppScreen.TASKS)}
                onReuse={() => setScreen(task.type === 'image' ? AppScreen.CREATE_IMAGE_TASK : AppScreen.CREATE_VIDEO_TASK)}
              />
            ))}
            {myWorks.length === 0 && (
              <EmptyState
                label={`还没有已完成${media === 'image' ? '图片' : '视频'}作品`}
                action="开始创作"
                onAction={() => setScreen(media === 'image' ? AppScreen.CREATE_IMAGE_TASK : AppScreen.CREATE_VIDEO_TASK)}
              />
            )}
          </div>
        )}
      </section>

      {selectedTemplate && (
        <TemplateDetailDrawer
          template={selectedTemplate}
          isFavorite={favoriteTemplateIds.has(selectedTemplate.id)}
          onClose={() => setSelectedTemplateId(null)}
          onUse={() => useTemplate(selectedTemplate)}
          onToggleFavorite={() => toggleFavorite(selectedTemplate)}
        />
      )}
    </div>
  );
};

const MiniMetric: React.FC<{ icon: string; label: string; value: string; alert?: boolean; onClick: () => void }> = ({ icon, label, value, alert, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-2 border-l border-[#eeeae6] px-3 py-1 text-left first:border-l-0 first:pl-1 transition-colors hover:text-primary">
    <span className={`material-symbols-outlined text-[16px] ${alert ? 'text-warning' : 'text-[#a9a39c]'}`}>{icon}</span>
    <span><span className="mr-1 text-[10px] font-bold text-[#a9a39c]">{label}</span><span className="text-[11px] font-black text-[#393431]">{value}</span></span>
  </button>
);

const TopTab: React.FC<{ active: boolean; label: string; count: number; onClick: () => void }> = ({ active, label, count, onClick }) => (
  <button onClick={onClick} className={`border-b-2 pb-2.5 text-sm font-black transition-colors ${active ? 'border-primary text-[#201f1d]' : 'border-transparent text-[#a9a39c] hover:text-[#393431]'}`}>
    {label}<span className={`ml-1.5 text-[10px] ${active ? 'text-primary' : 'text-[#a9a39c]'}`}>{count}</span>
  </button>
);

const MediaTabs: React.FC<{ media: TemplateMediaType; imageCount: number; videoCount: number; onChange: (media: TemplateMediaType) => void }> = ({ media, imageCount, videoCount, onChange }) => (
  <div className="inline-flex w-fit shrink-0 rounded-md border border-[#e8e4df] bg-[#f6f3ef] p-1" role="tablist" aria-label="模板媒介">
    {([
      ['image', 'image', '图片', imageCount],
      ['video', 'play_circle', '视频', videoCount],
    ] as const).map(([value, icon, label, count]) => (
      <button
        key={value}
        role="tab"
        aria-selected={media === value}
        onClick={() => onChange(value)}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] px-3 text-xs font-black whitespace-nowrap transition-all ${media === value ? 'bg-white text-[#201f1d] shadow-sm' : 'text-[#79736d] hover:text-[#393431]'}`}
      >
        <span className="material-symbols-outlined text-[16px]">{icon}</span>{label}
        <span className="text-[10px] text-[#a9a39c]">{count}</span>
      </button>
    ))}
  </div>
);

const StyleRail: React.FC<{ activeStyle: string; styles: string[]; onChange: (style: string) => void }> = ({ activeStyle, styles, onChange }) => (
  <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 pb-1 pt-1 lg:px-2 lg:pb-0">
    <span className="mr-1 shrink-0 text-[10px] font-black tracking-[0.08em] text-[#a9a39c]">风格</span>
    {styles.map((item) => (
      <button key={item} onClick={() => onChange(item)} className={`h-8 shrink-0 rounded-md border px-3 text-[11px] font-bold transition-all ${activeStyle === item ? 'border-[#201f1d] bg-[#201f1d] text-white shadow-sm' : 'border-[#e8e4df] bg-white text-[#79736d] hover:border-[#c6beb6] hover:text-[#393431]'}`}>{item}</button>
    ))}
  </div>
);

const FilterSelect: React.FC<{ icon: string; label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }> = ({ icon, label, value, values, labels, onChange }) => (
  <label className="flex h-8 items-center gap-1 rounded-md border border-[#e8e4df] bg-white px-2 text-[11px] font-bold text-[#79736d] transition-colors hover:border-[#c6beb6]">
    <span className="material-symbols-outlined text-[15px] text-[#a9a39c]">{icon}</span>
    <span className="hidden sm:inline">{label}</span>
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="max-w-24 bg-transparent text-[11px] font-black text-[#393431] outline-none">
      {values.map((item) => <option key={item} value={item}>{labels?.[item] ?? item}</option>)}
    </select>
  </label>
);

const TemplateCard: React.FC<{
  template: DashboardTemplate;
  isFavorite: boolean;
  onUse: () => void;
  onOpenDetail: () => void;
  onToggleFavorite: () => void;
}> = ({ template, isFavorite, onUse, onOpenDetail, onToggleFavorite }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPreview = () => { videoRef.current?.play().catch(() => undefined); };
  const pausePreview = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  return (
    <article onMouseEnter={playPreview} onMouseLeave={pausePreview} className="group relative overflow-hidden rounded-lg border border-[#e8e4df] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#c6beb6] hover:shadow-[0_16px_32px_rgba(53,44,37,0.15)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#f4f1ed]">
        <button type="button" onClick={onOpenDetail} className="absolute inset-0 block h-full w-full cursor-pointer overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset" aria-label={`查看模板详情：${template.sourceProductName}`}>
          <img src={template.coverUrl} alt={`${template.sourceProductName}模板成片`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
          {template.hoverPreviewUrl && <video ref={videoRef} muted loop playsInline poster={template.coverUrl} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" src={template.hoverPreviewUrl} />}
          {template.mediaType === 'video' && <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/80 bg-[#201f1d]/75 text-white shadow-sm"><span className="material-symbols-outlined text-[17px]">play_arrow</span></span>}
        </button>
        <div onClick={onOpenDetail} className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#171411]/95 via-[#171411]/72 to-transparent px-3 pb-3 pt-20 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
          <h2 className="truncate text-sm font-black text-white">{template.sourceProductName}</h2>
          <div className="mt-2 flex flex-wrap gap-1">
            <TemplateTag label="类型" value={template.type} /><TemplateTag label="风格" value={template.style} />
            <TemplateTag label="场景" value={template.scene} /><TemplateTag label={template.mediaType === 'video' ? '镜头' : '姿势'} value={template.poseOrShot} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/65">
              <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">visibility</span>{template.viewCount}</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }} className={`inline-flex items-center gap-1 transition-colors ${isFavorite ? 'text-primary-light' : 'hover:text-white'}`}>
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>{template.favoriteCount}
              </button>
            </div>
            <button type="button" onClick={(event) => { event.stopPropagation(); onUse(); }} className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-2.5 text-[11px] font-black text-[#201f1d] transition-colors hover:bg-primary hover:text-white">做同款<span className="material-symbols-outlined text-[15px]">arrow_outward</span></button>
          </div>
        </div>
      </div>
    </article>
  );
};

const TemplateTag: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="max-w-full truncate rounded-[4px] border border-white/15 bg-white/10 px-1.5 py-1 text-[9px] font-medium text-white/90"><span className="mr-1 text-white/55">{label}</span>{value}</span>
);

const TemplateDetailDrawer: React.FC<{
  template: DashboardTemplate;
  isFavorite: boolean;
  onClose: () => void;
  onUse: () => void;
  onToggleFavorite: () => void;
}> = ({ template, isFavorite, onClose, onUse, onToggleFavorite }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-[#171411]/65 p-0 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0 cursor-default" aria-label="关闭模板详情" />
      <section className="relative mx-auto flex h-full w-full max-w-6xl flex-col overflow-y-auto bg-[#fbfaf8] shadow-2xl sm:h-auto sm:min-h-[620px] sm:flex-row sm:overflow-hidden">
        <div className="relative min-h-[46vh] bg-[#25211e] sm:min-h-0 sm:w-[58%]">
          <img src={template.coverUrl} alt={`${template.sourceProductName}模板预览`} className="h-full min-h-[46vh] w-full object-cover sm:min-h-0" />
          {template.hoverPreviewUrl && <video ref={videoRef} autoPlay muted loop playsInline poster={template.coverUrl} src={template.hoverPreviewUrl} className="absolute inset-0 h-full w-full object-cover" />}
          {template.mediaType === 'video' && <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#171411]/75 px-3 py-1.5 text-[11px] font-black text-white"><span className="material-symbols-outlined text-[16px]">play_circle</span>视频模板 · 悬停预览</span>}
        </div>
        <aside className="relative flex min-w-0 flex-1 flex-col bg-[#fbfaf8] p-5 sm:p-7">
          <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#79736d] transition-colors hover:bg-[#f0ede9] hover:text-[#201f1d]"><span className="material-symbols-outlined text-[20px]">close</span></button>
          <p className="pr-10 text-[10px] font-black tracking-[0.12em] text-primary">{template.mediaType === 'image' ? '图片模板' : '视频模板'} · V{template.version}</p>
          <h2 className="mt-2 pr-8 text-xl font-black leading-7 text-[#201f1d]">{template.sourceProductName}</h2>
          <p className="mt-2 text-xs leading-5 text-[#79736d]">{template.description}</p>
          <div className="mt-5 flex items-center gap-4 border-y border-[#ece8e3] py-3">
            <button type="button" onClick={onToggleFavorite} className={`inline-flex items-center gap-1.5 text-xs font-bold ${isFavorite ? 'text-primary' : 'text-[#6f6963] hover:text-primary'}`}><span className="material-symbols-outlined text-[18px]">favorite</span>{template.favoriteCount} 收藏</button>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6f6963]"><span className="material-symbols-outlined text-[18px]">visibility</span>{template.viewCount} 浏览</span>
          </div>
          <dl className="mt-5 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-3 text-xs">
            <dt className="font-bold text-[#a19b94]">适用品类</dt><dd className="font-bold text-[#443f3a]">{template.category}</dd>
            <dt className="font-bold text-[#a19b94]">{template.mediaType === 'image' ? '图片类型' : '视频类型'}</dt><dd className="font-bold text-[#443f3a]">{template.type}</dd>
            <dt className="font-bold text-[#a19b94]">风格</dt><dd className="font-bold text-[#443f3a]">{template.style}</dd>
            <dt className="font-bold text-[#a19b94]">场景</dt><dd className="font-bold text-[#443f3a]">{template.scene}</dd>
            <dt className="font-bold text-[#a19b94]">{template.mediaType === 'video' ? '镜头' : '姿势'}</dt><dd className="font-bold text-[#443f3a]">{template.poseOrShot}</dd>
          </dl>
          <div className="mt-5 rounded-md border border-[#eee7df] bg-[#f7f3ed] p-3 text-[11px] leading-5 text-[#726a62]"><span className="font-black text-[#443f3a]">替换规则：</span>保留模板的构图、光线和生成参数；开始前仅需替换当前商品主体素材。</div>
          <div className="mt-auto pt-6"><button type="button" onClick={onUse} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#201f1d] text-xs font-black text-white transition-colors hover:bg-primary">使用此模板<span className="material-symbols-outlined text-[17px]">arrow_outward</span></button></div>
        </aside>
      </section>
    </div>
  );
};

const MyWorkCard: React.FC<{
  task: GenerationTask;
  isPublished: boolean;
  onPublish: () => void;
  onView: () => void;
  onReuse: () => void;
}> = ({ task, isPublished, onPublish, onView, onReuse }) => (
  <article className="group overflow-hidden rounded-lg border border-[#e8e4df] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#c6beb6] hover:shadow-[0_16px_32px_rgba(53,44,37,0.1)]">
    <div className="relative aspect-[4/5] overflow-hidden bg-[#f4f1ed]">
      <img src={task.resultUrl ?? task.productImg} alt={task.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
      <span className="absolute left-3 top-3 rounded-md border border-white/80 bg-white/90 px-2 py-1 text-[10px] font-black text-[#393431] shadow-sm">{task.type === 'image' ? '图片作品' : '视频作品'}</span>
    </div>
    <div className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-sm font-black text-[#201f1d]">{task.name}</h2><p className="mt-1 truncate text-[10px] font-bold text-[#a9a39c]">{taskStatusLabel[task.status]} · {task.templateName}</p></div>
        {isPublished && <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-emerald-600"><span className="material-symbols-outlined text-[14px]">check_circle</span>已发布</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f0ede9] pt-3">
        <button onClick={onView} className="h-8 rounded-md border border-[#e8e4df] px-2.5 text-xs font-bold text-[#625d58] transition-colors hover:border-[#c6beb6]">详情</button>
        <button onClick={onReuse} className="h-8 rounded-md border border-[#e8e4df] px-2.5 text-xs font-bold text-[#625d58] transition-colors hover:border-[#c6beb6]">再次创作</button>
        <button onClick={onPublish} className={`ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-bold transition-colors ${isPublished ? 'border border-[#dfc6a4] bg-[#fff8ec] text-[#93652d] hover:bg-[#fff0d8]' : 'bg-[#201f1d] text-white hover:bg-primary'}`}>
          {isPublished && <span className="material-symbols-outlined text-[15px]">archive</span>}{isPublished ? '下架模板' : '设为模板'}
        </button>
      </div>
    </div>
  </article>
);

const EmptyState: React.FC<{ label: string; action: string; onAction: () => void }> = ({ label, action, onAction }) => (
  <div className="col-span-full flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
    <span className="material-symbols-outlined text-3xl text-slate-400">auto_awesome</span>
    <p className="mt-3 text-sm font-bold text-slate-500">{label}</p>
    <button onClick={onAction} className="mt-2 text-xs font-bold text-primary">{action}</button>
  </div>
);
