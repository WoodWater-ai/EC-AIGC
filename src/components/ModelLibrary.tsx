import React, { useState } from 'react';
import { ImageGenerationType, IMAGE_GENERATION_TYPE_LABELS } from '../types';
import type { ModelProfile } from '../types';

const ATTRIBUTE_FILTERS = ['全部', '清透', '甜美', '成熟', '居家'] as const;

interface ModelLibraryProps {
  profiles: ModelProfile[];
  onCreateProfile: () => void;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({ profiles: allProfiles, onCreateProfile }) => {
  const [filter, setFilter] = useState<(typeof ATTRIBUTE_FILTERS)[number]>('全部');
  const profiles = allProfiles.filter((profile) => profile.status === 'active' && (filter === '全部' || profile.tags.includes(filter)));
  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
      <div><h2 className="text-2xl font-black text-slate-900">模特资源库</h2><p className="text-sm text-slate-500 mt-2">选择已保存的人物资产，用于商品图片和视频任务。</p></div>
      <button onClick={onCreateProfile} className="h-9 px-4 bg-primary text-white rounded-md text-xs font-bold">新建 AI 模特</button>
    </div>
    <div className="flex flex-wrap gap-2">{ATTRIBUTE_FILTERS.map((item) => <button key={item} onClick={() => setFilter(item)} className={`px-3 py-2 rounded-md text-xs font-bold border ${filter === item ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{item}</button>)}</div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{profiles.map((profile) => <article key={profile.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden"><img src={profile.image} alt={profile.name} className="w-full h-48 object-cover" referrerPolicy="no-referrer"/><div className="p-4"><div className="flex justify-between gap-2"><h3 className="font-black">{profile.name}</h3><span className="text-[10px] px-2 py-1 bg-slate-100 rounded text-slate-500">{profile.source}</span></div><div className="flex flex-wrap gap-1 mt-3">{profile.tags.map((tag) => <span key={tag} className="text-[10px] px-2 py-1 bg-blue-50 text-primary rounded">{tag}</span>)}</div><p className="mt-3 text-[11px] text-slate-400">适用任务：{profile.suitableFor.map((type) => IMAGE_GENERATION_TYPE_LABELS[type]).join('、')}</p></div></article>)}</div>
  </div>;
};
