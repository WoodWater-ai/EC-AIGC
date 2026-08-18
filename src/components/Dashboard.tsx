import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppScreen, GenerationTask, SystemUser } from '../types';
import { DashboardTemplate, TemplateMediaType } from '../dashboardData';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import {
  creationTemplateApi,
  type CreationTemplate,
  type CreationWork,
} from '../api/modules/creationTemplate';
import { toast } from 'sonner';
import { PublishTemplateDialog } from './common/PublishTemplateDialog';
import { ImagePreviewModal } from './ImagePreviewModal';
import { VideoPreviewModal } from './VideoPreviewModal';
import { getPublishTemplateDefaultName } from '../lib/creationTemplate/publishTemplateName';

interface DashboardProps {
  tasks: GenerationTask[];
  currentUser: SystemUser;
  setScreen: (
    screen: AppScreen,
    payload?: { highlightGroupId?: string; creationTemplateId?: string },
  ) => void;
}

const toDashboardTemplate = (template: CreationTemplate): DashboardTemplate => ({
  id: template.id,
  name: template.templateName,
  mediaType: template.mediaType === 'IMAGE' ? 'image' : 'video',
  status: template.status === 'PUBLISHED' ? 'active' : 'disabled',
  version: Number(template.version?.replace(/^v/i, '')) || 1,
  coverUrl: template.coverUrl,
  hoverPreviewUrl: template.mediaType === 'VIDEO' ? template.previewUrl ?? undefined : undefined,
  productImageUrl: template.productImageUrl ?? undefined,
  description: '保留原任务的创作结构、Prompt 与执行参数。',
  category: '全部',
  usage: template.taskType ?? '通用',
  style: template.style || '未标注',
  usageCount: template.usageCount,
  viewCount: template.viewCount,
  favoriteCount: template.favoriteCount,
  favorited: template.favorited,
  sourceTaskId: template.id,
  sourceProductName: template.templateName,
  createdAt: template.publishTime ?? '',
  type: template.imageType || template.taskType || (template.mediaType === 'IMAGE' ? '图片任务' : '视频任务'),
  scene: template.scene || '未标注',
  poseOrShot: template.pose || '未标注',
});

export const Dashboard: React.FC<DashboardProps> = ({ tasks, setScreen }) => {
  const [tab, setTab] = useState<'camp' | 'mine'>('camp');
  const [media, setMedia] = useState<TemplateMediaType>('image');
  const [category, setCategory] = useState('全部');
  const [style, setStyle] = useState('全部');
  const [order, setOrder] = useState<'recommended' | 'latest'>('latest');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [favoritePendingIds, setFavoritePendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [publishTarget, setPublishTarget] = useState<CreationWork | null>(null);
  const [previewWork, setPreviewWork] = useState<CreationWork | null>(null);
  const viewedTemplateIdsRef = useRef<Set<string>>(new Set());
  const imageCampQuery = useServiceQuery(
    () => creationTemplateApi.camp('IMAGE'),
    [],
  );
  const videoCampQuery = useServiceQuery(
    () => creationTemplateApi.camp('VIDEO'),
    [],
  );
  const imageWorksQuery = useServiceQuery(
    () => creationTemplateApi.myWorks('IMAGE'),
    [],
  );
  const videoWorksQuery = useServiceQuery(
    () => creationTemplateApi.myWorks('VIDEO'),
    [],
  );
  const campQuery = media === 'image' ? imageCampQuery : videoCampQuery;
  const worksQuery = media === 'image' ? imageWorksQuery : videoWorksQuery;
  const templates = useMemo(
    () => (campQuery.data?.list ?? []).map(toDashboardTemplate),
    [campQuery.data],
  );
  const myWorks = worksQuery.data?.list ?? [];

  const runningCount = tasks.filter((task) => task.status === 'running' || task.status === 'pending').length;
  const pendingCount = tasks.filter((task) => task.status === 'failed' || task.status === 'rejected').length;
  const mediaTemplates = templates.filter((item) => item.mediaType === media);
  const categories = [...new Set(['全部', ...mediaTemplates.map((item) => item.category)])];
  const styles = [...new Set(['全部', ...mediaTemplates.map((item) => item.style)])];
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
  const selectedTemplate = selectedTemplateId
    ? templates.find((item) => item.id === selectedTemplateId) ?? null
    : null;
  const imageCount = tab === 'mine'
    ? imageWorksQuery.data?.total ?? 0
    : imageCampQuery.data?.total ?? 0;
  const videoCount = tab === 'mine'
    ? videoWorksQuery.data?.total ?? 0
    : videoCampQuery.data?.total ?? 0;
  const campTotal = (imageCampQuery.data?.total ?? 0)
    + (videoCampQuery.data?.total ?? 0);
  const worksTotal = (imageWorksQuery.data?.total ?? 0)
    + (videoWorksQuery.data?.total ?? 0);

  const resetFilters = () => {
    setCategory('全部');
    setStyle('全部');
    setOrder('latest');
  };

  const useTemplate = (template: DashboardTemplate) => {
    setScreen(
      template.mediaType === 'image'
        ? AppScreen.CREATE_IMAGE_TASK
        : AppScreen.CREATE_VIDEO_TASK,
      { creationTemplateId: template.id },
    );
  };

  const toggleFavorite = async (template: DashboardTemplate) => {
    if (favoritePendingIds.has(template.id)) return;
    setFavoritePendingIds((current) => new Set(current).add(template.id));
    try {
      await creationTemplateApi.toggleFavorite(template.id);
      await campQuery.refetch();
    } finally {
      setFavoritePendingIds((current) => {
        const next = new Set(current);
        next.delete(template.id);
        return next;
      });
    }
  };

  const openTemplate = (template: DashboardTemplate) => {
    setSelectedTemplateId(template.id);
    if (viewedTemplateIdsRef.current.has(template.id)) return;
    viewedTemplateIdsRef.current.add(template.id);
    void creationTemplateApi.recordView(template.id)
      .then(() => {
        void campQuery.refetch();
      }, () => {
        viewedTemplateIdsRef.current.delete(template.id);
      });
  };

  const togglePublished = async (work: CreationWork) => {
    if (!work.creationTemplateId || work.templateStatus !== 'PUBLISHED') {
      setPublishTarget(work);
      return;
    }
    try {
      await creationTemplateApi.offline(work.creationTemplateId);
      toast.success('模板已下架');
      await Promise.all([worksQuery.refetch(), campQuery.refetch()]);
    } catch {
      // 统一请求层展示具体错误。
    }
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
            <TopTab active={tab === 'camp'} label="模板营地" count={campTotal} onClick={() => setTab('camp')} />
            <TopTab active={tab === 'mine'} label="我的作品" count={worksTotal} onClick={() => setTab('mine')} />
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
                isFavorite={template.favorited}
                onUse={() => useTemplate(template)}
                onOpenDetail={() => openTemplate(template)}
                onToggleFavorite={() => void toggleFavorite(template)}
              />
            ))}
            {campTemplates.length === 0 && <EmptyState label="没有匹配的模板" action="重置筛选" onAction={resetFilters} />}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {myWorks.map((task) => (
              <MyWorkCard
                key={`${task.mediaType}-${task.resultId}`}
                work={task}
                isPublished={task.templateStatus === 'PUBLISHED'}
                onPublish={() => void togglePublished(task)}
                onView={() => setScreen(AppScreen.TASKS, { highlightGroupId: task.groupId })}
                onPreview={() => setPreviewWork(task)}
                onReuse={() => task.creationTemplateId && setScreen(
                  task.mediaType === 'IMAGE' ? AppScreen.CREATE_IMAGE_TASK : AppScreen.CREATE_VIDEO_TASK,
                  { creationTemplateId: task.creationTemplateId },
                )}
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
          isFavorite={selectedTemplate.favorited}
          onClose={() => setSelectedTemplateId(null)}
          onUse={() => useTemplate(selectedTemplate)}
          onToggleFavorite={() => void toggleFavorite(selectedTemplate)}
        />
      )}
      {previewWork?.mediaType === 'IMAGE' && (
        <ImagePreviewModal
          images={[{ url: previewWork.url, label: previewWork.title }]}
          onClose={() => setPreviewWork(null)}
        />
      )}
      {previewWork?.mediaType === 'VIDEO' && (
        <VideoPreviewModal
          videos={[{
            url: previewWork.url,
            poster: previewWork.thumbnailUrl,
            label: previewWork.title,
          }]}
          onClose={() => setPreviewWork(null)}
        />
      )}
      <PublishTemplateDialog
        open={publishTarget !== null}
        defaultName={getPublishTemplateDefaultName(publishTarget?.title)}
        onClose={() => setPublishTarget(null)}
        onConfirm={async (templateName) => {
          if (!publishTarget) return;
          await creationTemplateApi.publishFromResult({
            taskId: publishTarget.taskId,
            resultId: publishTarget.resultId,
            mediaType: publishTarget.mediaType,
            templateName,
          });
          toast.success('已设为模板并发布到模板营地');
          setPublishTarget(null);
          setCategory('全部');
          setStyle('全部');
          setOrder('latest');
          await Promise.all([worksQuery.refetch(), campQuery.refetch()]);
        }}
      />
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

const SourceProduct: React.FC<{ image: string }> = ({ image }) => (
  <div className="absolute bottom-3 right-3 flex items-end gap-1">
    <span className="mb-3 grid h-5 w-5 place-items-center rounded-full bg-[#201f1d] text-white shadow-md">
      <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
    </span>
    <figure className="rounded-md border border-white bg-white p-1.5 shadow-[0_6px_18px_rgba(36,30,25,0.24)]">
      <img
        src={image}
        alt="可替换的主体商品图"
        className="h-12 w-12 rounded-[3px] bg-white object-contain"
        referrerPolicy="no-referrer"
      />
      <figcaption className="mt-1 text-center text-[8px] font-black tracking-[0.08em] text-[#79736d]">
        主体图
      </figcaption>
    </figure>
  </div>
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
          {template.productImageUrl && (
            <div className="transition-opacity duration-200 lg:group-hover:opacity-0">
              <SourceProduct image={template.productImageUrl} />
            </div>
          )}
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#171411]/65 p-0 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0 cursor-default" aria-label="关闭模板详情" />
      <section className="relative mx-auto flex h-full w-full max-w-6xl flex-col overflow-y-auto bg-[#fbfaf8] shadow-2xl sm:h-[min(720px,calc(100dvh-40px))] sm:min-h-0 sm:flex-row sm:overflow-hidden sm:rounded-xl">
        <div className="relative min-h-[46vh] overflow-hidden bg-[#25211e] sm:min-h-0 sm:w-[58%]">
          <img
            src={template.coverUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-2xl"
          />
          <div className="absolute inset-0 bg-[#171411]/25" aria-hidden="true" />
          <img src={template.coverUrl} alt={`${template.sourceProductName}模板预览`} className="relative z-10 h-full min-h-[46vh] w-full object-contain sm:min-h-0" />
          {template.hoverPreviewUrl && <video ref={videoRef} autoPlay muted loop playsInline poster={template.coverUrl} src={template.hoverPreviewUrl} className="absolute inset-0 z-10 h-full w-full object-contain" />}
          {template.mediaType === 'video' && <span className="absolute left-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-full bg-[#171411]/75 px-3 py-1.5 text-[11px] font-black text-white"><span className="material-symbols-outlined text-[16px]">play_circle</span>视频模板 · 悬停预览</span>}
        </div>
        <aside className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#fbfaf8] p-5 sm:p-7">
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
  work: CreationWork;
  isPublished: boolean;
  onPublish: () => void;
  onView: () => void;
  onPreview: () => void;
  onReuse: () => void;
}> = ({ work, isPublished, onPublish, onView, onPreview, onReuse }) => (
  <article className="group overflow-hidden rounded-lg border border-[#e8e4df] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#c6beb6] hover:shadow-[0_16px_32px_rgba(53,44,37,0.1)]">
    <div className="relative aspect-[4/5] overflow-hidden bg-[#f4f1ed]">
      {work.mediaType === 'VIDEO' ? (
        <button
          type="button"
          onClick={onPreview}
          className="absolute inset-0 h-full w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          aria-label={`播放视频：${work.title}`}
        >
          <video
            src={work.url}
            poster={work.thumbnailUrl ?? undefined}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/5 transition-colors duration-200 group-hover:bg-black/20">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-[#393431] shadow-lg transition-transform duration-200 group-hover:scale-110">
              <span className="material-symbols-outlined text-[26px]">play_arrow</span>
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onPreview}
          className="absolute inset-0 h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          aria-label={`放大查看图片：${work.title}`}
        >
          <img src={work.thumbnailUrl || work.url} alt={work.title} className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]" />
          <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/15 group-hover:opacity-100">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#393431] shadow-lg">
              <span className="material-symbols-outlined text-[21px]">zoom_in</span>
            </span>
          </span>
        </button>
      )}
      <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/80 bg-white/90 px-2 py-1 text-[10px] font-black text-[#393431] shadow-sm">{work.mediaType === 'IMAGE' ? '图片作品' : '视频作品'}</span>
      {work.productImageUrl && (
        <div className="pointer-events-none transition-opacity duration-200 lg:group-hover:opacity-0">
          <SourceProduct image={work.productImageUrl} />
        </div>
      )}
    </div>
    <div className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-sm font-black text-[#201f1d]">{work.title}</h2><p className="mt-1 truncate text-[10px] font-bold text-[#a9a39c]">{resultWorkStatusLabel(work.status)}</p></div>
        {isPublished && <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-emerald-600"><span className="material-symbols-outlined text-[14px]">check_circle</span>已发布</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f0ede9] pt-3">
        <button onClick={onView} className="h-8 rounded-md border border-[#e8e4df] px-2.5 text-xs font-bold text-[#625d58] transition-colors hover:border-[#c6beb6]">详情</button>
        <button disabled={!isPublished} onClick={onReuse} className="h-8 rounded-md border border-[#e8e4df] px-2.5 text-xs font-bold text-[#625d58] transition-colors hover:border-[#c6beb6] disabled:cursor-not-allowed disabled:opacity-40">做同款</button>
        <button disabled={!isPublished && !work.canPublishTemplate} onClick={onPublish} className={`ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isPublished ? 'border border-[#dfc6a4] bg-[#fff8ec] text-[#93652d] hover:bg-[#fff0d8]' : 'bg-[#201f1d] text-white hover:bg-primary'}`}>
          {isPublished && <span className="material-symbols-outlined text-[15px]">archive</span>}{isPublished ? '下架模板' : '设为模板'}
        </button>
      </div>
    </div>
  </article>
);

const resultWorkStatusLabel = (status?: string | null) => {
  if (!status) return '已生成';
  const labels: Record<string, string> = {
    PASSED: '审核通过',
    ARCHIVED: '审核通过',
    REJECTED: '已打回',
    PENDING_SCORE: '待审美评分',
    PENDING_REVIEW: '待审美评分',
  };
  return labels[status] ?? status;
};

const EmptyState: React.FC<{ label: string; action: string; onAction: () => void }> = ({ label, action, onAction }) => (
  <div className="col-span-full flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
    <span className="material-symbols-outlined text-3xl text-slate-400">auto_awesome</span>
    <p className="mt-3 text-sm font-bold text-slate-500">{label}</p>
    <button onClick={onAction} className="mt-2 text-xs font-bold text-primary">{action}</button>
  </div>
);
