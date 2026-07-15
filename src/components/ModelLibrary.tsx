import React, { useState } from 'react';
import { ImageGenerationType, IMAGE_GENERATION_TYPE_LABELS } from '../types';
import { mockModelProfiles } from '../mockData';

const ALL_TYPES: ImageGenerationType[] = ['product_main', 'scene_detail', 'detail_closeup', 'on_model'];

export const ModelLibrary: React.FC = () => {
  const [filter, setFilter] = useState<ImageGenerationType | 'all'>('all');
  const profiles = mockModelProfiles.filter((profile) => filter === 'all' || profile.suitableFor.includes(filter));
  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
      <div><p className="text-xs text-primary font-bold">虚拟 / 授权 / 内部素材</p><h2 className="text-2xl font-black text-slate-900 mt-1">模特资源库</h2><p className="text-sm text-slate-500 mt-2">仅用于任务推荐与人工选择，不支持联网抓取或真人身份复刻。</p></div>
      <button className="h-9 px-4 bg-primary text-white rounded-md text-xs font-bold">新增模特素材</button>
    </div>
    <div className="flex flex-wrap gap-2">{([{ id: 'all', label: '全部任务' }, ...ALL_TYPES.map((type) => ({ id: type, label: IMAGE_GENERATION_TYPE_LABELS[type] }))] as const).map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`px-3 py-2 rounded-md text-xs font-bold border ${filter === item.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{item.label}</button>)}</div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{profiles.map((profile) => <article key={profile.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden"><img src={profile.image} alt={profile.name} className="w-full h-48 object-cover" referrerPolicy="no-referrer"/><div className="p-4"><div className="flex justify-between gap-2"><h3 className="font-black">{profile.name}</h3><span className="text-[10px] px-2 py-1 bg-slate-100 rounded text-slate-500">{profile.source}</span></div><p className="mt-2 text-xs text-slate-500 leading-5">{profile.reason}</p><div className="flex flex-wrap gap-1 mt-3">{profile.tags.map((tag) => <span key={tag} className="text-[10px] px-2 py-1 bg-blue-50 text-primary rounded">{tag}</span>)}</div><p className="mt-3 text-[11px] text-slate-400">适用：{profile.suitableFor.map((type) => IMAGE_GENERATION_TYPE_LABELS[type]).join('、')}</p></div></article>)}</div>
  </div>;
};
