import { useMemo, useState } from 'react';
import type { ModelProfileDTO } from '../api/modules/modelProfile';
import type { ImageGenerationType } from '../types';
import { withCosThumbnail } from '../utils/cosImage';
import { ImagePreviewModal } from './ImagePreviewModal';

const FILTERS = ['全部', '清透', '甜美', '成熟', '居家'] as const;
const TASK_LABELS: Record<ImageGenerationType, string> = {
  product_main: '商品主图',
  scene_detail: '场景细节',
  detail_closeup: '细节特写',
  model_triple_view: '模特三视图',
};

interface ModelLibraryProps {
  profiles: ModelProfileDTO[];
  onCreateProfile: () => void;
  loading?: boolean;
  error?: string;
}

export function ModelLibrary({
  profiles: allProfiles,
  onCreateProfile,
  loading,
  error,
}: ModelLibraryProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('全部');
  const [previewProfile, setPreviewProfile] = useState<ModelProfileDTO>();
  const profiles = useMemo(
    () => allProfiles.filter(
      (profile) => profile.status === 'active'
        && (filter === '全部' || profile.tags.includes(filter)),
    ),
    [allProfiles, filter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-black text-slate-900">模特资源库</h2>
          <p className="mt-2 text-sm text-slate-500">选择已保存的人物资产，用于商品图片和视频任务。</p>
        </div>
        <button onClick={onCreateProfile} className="h-9 rounded-md bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover">
          新建 AI 模特
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-md border px-3 py-2 text-xs font-bold ${
              filter === item
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400">
          正在加载模特资源…
        </div>
      ) : error ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-red-200 bg-red-50 px-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : profiles.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-400">
          当前筛选下暂无可用模特
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {profiles.map((profile) => (
            <article
              key={profile.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white transition-all hover:border-slate-300 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => setPreviewProfile(profile)}
                className="flex aspect-square w-full cursor-zoom-in items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50"
                aria-label={`放大查看模特图片：${profile.name}`}
                title="点击查看大图"
              >
                <img
                  src={withCosThumbnail(profile.image, 640) ?? profile.image}
                  alt={profile.name}
                  className="max-h-full max-w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </button>
              <div className="space-y-2 p-3.5">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 truncate text-sm font-black text-slate-900" title={profile.name}>{profile.name}</h3>
                  <span className="shrink-0 whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500">{profile.source}</span>
                </div>
                <div className="mt-2 flex max-h-11 flex-wrap gap-1 overflow-hidden">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="whitespace-nowrap rounded bg-blue-50 px-2 py-1 text-[10px] text-primary">{tag}</span>
                  ))}
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">
                  适用任务：{profile.suitableFor
                    .map((type) => TASK_LABELS[type as ImageGenerationType] ?? type)
                    .join('、')}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {previewProfile && (
        <ImagePreviewModal
          images={[{
            url: previewProfile.image,
            label: previewProfile.name,
          }]}
          initialIndex={0}
          onClose={() => setPreviewProfile(undefined)}
        />
      )}
    </div>
  );
}
