import React, { useState } from 'react';
import { AdTemplate, AppScreen } from '../types';

interface TemplateCenterProps {
  templates: AdTemplate[];
  onAddTemplate: (temp: AdTemplate) => void;
  onUpdateTemplate: (temp: AdTemplate) => void;
  setScreen: (screen: AppScreen) => void;
}

type TabCategory = 'image_task' | 'style_scene' | 'video_prompt' | 'platform_spec' | 'negative_constraint';

export const TemplateCenter: React.FC<TemplateCenterProps> = ({
  templates,
  onAddTemplate,
  onUpdateTemplate,
  setScreen
}) => {
  const [activeTab, setActiveTab] = useState<TabCategory>('image_task');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Interactive drawers & modals
  const [editingTemplate, setEditingTemplate] = useState<AdTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Interactive notification toast state
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Helper to extract variables e.g. {{variable}}
  const extractVariables = (prompt: string) => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(prompt)) !== null) {
      if (!matches.includes(match[1].trim())) {
        matches.push(match[1].trim());
      }
    }
    return matches;
  };

  const handleCopyPrompt = (temp: AdTemplate) => {
    navigator.clipboard.writeText(temp.promptTemplate);
    showToast(`已成功复制「${temp.title}」提示词指令！`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    if (!editingTemplate.title.trim()) {
      showToast('请填写模板名称！', 'error');
      return;
    }

    if (isCreatingNew) {
      onAddTemplate(editingTemplate);
      showToast(`自定义模板「${editingTemplate.title}」创建成功！`);
    } else {
      onUpdateTemplate(editingTemplate);
      showToast(`模板「${editingTemplate.title}」已成功保存并同步！`);
    }
    setEditingTemplate(null);
    setIsCreatingNew(false);
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    // Map existing templates without explicit tabCategory
    const calculatedTab: TabCategory = t.tabCategory || (t.type === 'video' ? 'video_prompt' : 'image_task');
    const matchesTab = calculatedTab === activeTab;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.promptTemplate.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.applicableCategory && t.applicableCategory.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesTab && matchesSearch && matchesStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTemplates.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBatchDeactivate = () => {
    if (selectedIds.length === 0) {
      showToast('请先选择要停用的模板！', 'info');
      return;
    }
    selectedIds.forEach(id => {
      const found = templates.find(t => t.id === id);
      if (found) {
        onUpdateTemplate({ ...found, status: 'draft' });
      }
    });
    setSelectedIds([]);
    showToast(`已批量停用 ${selectedIds.length} 个模板资源！`);
  };

  const handleBatchCopy = () => {
    if (selectedIds.length === 0) {
      showToast('请选择要复制提示词的模板！', 'info');
      return;
    }
    const prompts = selectedIds.map(id => {
      const found = templates.find(t => t.id === id);
      return found ? `【${found.title}】\n${found.promptTemplate}` : '';
    }).filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(prompts);
    showToast(`已复制 ${selectedIds.length} 个模板指令至剪贴板！`);
  };

  // Get total count of specific tab categories
  const getTabCount = (cat: TabCategory) => {
    return templates.filter(t => {
      const calculatedTab = t.tabCategory || (t.type === 'video' ? 'video_prompt' : 'image_task');
      return calculatedTab === cat;
    }).length;
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border bg-slate-900 text-white animate-bounce">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-semibold">{toastMsg.text}</span>
        </div>
      )}

      {/* Page Header & Info */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">模板资源库</h2>
          <p className="text-xs text-slate-500">维护可复用 Prompt 模板，提升生成质量与一致性。</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100 border-dashed">
          <span className="material-symbols-outlined text-primary text-lg">info</span>
          <p className="text-xs text-slate-600">
            当前权限：<span className="font-semibold text-primary">管理员</span>，可编辑和发布模板。普通员工仅可查看及复制。
          </p>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
        
        {/* Internal Tabs matching the PRD tags */}
        <div className="flex border-b border-slate-100 bg-slate-50/40 px-4 pt-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'image_task', label: '图片任务模板' },
            { id: 'style_scene', label: '风格场景模板' },
            { id: 'video_prompt', label: '视频 Prompt 模板' },
            { id: 'platform_spec', label: '平台规格模板' },
            { id: 'negative_constraint', label: '负面约束模板' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TabCategory);
                setSelectedIds([]);
              }}
              className={`px-4 py-3 border-b-2 font-semibold text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-slate-500 hover:text-primary'
              }`}
            >
              {tab.label} ({getTabCount(tab.id as TabCategory)})
            </button>
          ))}
        </div>

        {/* Action Bar & Filters */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                placeholder="搜索模板名称或关键字"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <select
              className="py-1.5 pl-3 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:bg-white transition-all outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">状态: 全部</option>
              <option value="active">启用中</option>
              <option value="draft">已停用</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
            <button
              onClick={handleBatchCopy}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              复制
            </button>
            <button
              onClick={handleBatchDeactivate}
              className="px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-rose-500">block</span>
              批量停用
            </button>
            <button
              onClick={() => {
                setEditingTemplate({
                  id: `T-${Math.floor(1005 + Math.random() * 9000)}`,
                  title: '',
                  type: activeTab === 'video_prompt' ? 'video' : 'image',
                  category: activeTab === 'video_prompt' ? '短视频脚本' : '电商主图',
                  ratio: activeTab === 'platform_spec' ? '1:1' : '3:4',
                  usedCount: 0,
                  status: 'active',
                  modifier: '陈美晴',
                  updatedTime: new Date().toISOString().slice(0, 10),
                  previewUrl: activeTab === 'video_prompt' 
                    ? 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=500&q=80'
                    : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80',
                  promptTemplate: '',
                  tabCategory: activeTab,
                  taskType: activeTab === 'image_task' ? '商品生图' : 
                            activeTab === 'style_scene' ? '场景融合' : 
                            activeTab === 'video_prompt' ? '视频脚本' : 
                            activeTab === 'platform_spec' ? '规格排版' : '负面提示',
                  applicableCategory: '通用',
                  defaultStyle: '简约白底',
                  defaultCount: '4张',
                  defaultChannel: 'Midjourney v6',
                  version: 'v1.0.0', // automatically generated
                  avgAestheticScore: 8.0,
                  imageTaskType: '主图',
                  variableFields: ['商品主体', '模特属性', '背景色调'],
                  relatedNegativeConstraints: ['物理结构防畸变规约'],
                  styleType: '风格',
                  styleTags: ['简约冷淡风'],
                  sceneTags: ['精致电商影棚'],
                  poseTags: ['正面静定站姿'],
                  promptFragment: 'high quality photography, clean background',
                  videoMode: 'img2video',
                  applicableImageTypes: ['电商主图'],
                  recommendationConditions: '主体清晰无复杂重叠',
                  defaultDuration: '8s',
                  motionRange: 'medium',
                  threeStageStructure: {
                    opening: '模特正面中景展示，微调光影呼吸感',
                    dynamic: '模特缓慢转身45度，裙摆自然飘逸',
                    detailEnding: '特写拉近展示拉链和纽扣等走线细节'
                  },
                  specUsage: '商品主图',
                  specMaterialType: '图片',
                  specWidth: 1024,
                  specHeight: 1024,
                  specFormat: 'jpg',
                  maxFileSize: '5MB',
                  isDefaultRecommended: true,
                  applicableMaterialTypes: '通用',
                  constraintCategory: '人物人体',
                  severityLevel: 'P0',
                  chineseDescription: '强力纠偏防止身体扭曲或面部崩塌',
                  referencedTemplatesCount: 0
                });
                setIsCreatingNew(true);
              }}
              className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-primary-hover transition-colors shadow-xs ml-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              新建模板
            </button>
          </div>

        </div>

        {/* Data Table matching the PRD design precisely with customized columns for each Tab */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 tracking-wider">
                <th className="p-4 w-12 text-center">
                  <input
                    className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer w-4 h-4"
                    type="checkbox"
                    checked={filteredTemplates.length > 0 && selectedIds.length === filteredTemplates.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                
                {/* Dynamic Headings based on activeTab */}
                {activeTab === 'image_task' && (
                  <>
                    <th className="p-4 font-semibold text-slate-700">模板名称</th>
                    <th className="p-4 font-semibold text-slate-700">图片任务类型</th>
                    <th className="p-4 font-semibold text-slate-700">适用品类</th>
                    <th className="p-4 font-semibold text-slate-700">默认风格</th>
                    <th className="p-4 font-semibold text-slate-700">默认比例 / 张数</th>
                    <th className="p-4 font-semibold text-slate-700">默认模型通道</th>
                    <th className="p-4 font-semibold text-slate-700">关联负面约束</th>
                    <th className="p-4 font-semibold text-slate-700">状态</th>
                    <th className="p-4 font-semibold text-slate-700">使用次数</th>
                  </>
                )}

                {activeTab === 'style_scene' && (
                  <>
                    <th className="p-4 font-semibold text-slate-700">风格场景名称</th>
                    <th className="p-4 font-semibold text-slate-700">模板类型</th>
                    <th className="p-4 font-semibold text-slate-700">风格标签</th>
                    <th className="p-4 font-semibold text-slate-700">场景标签</th>
                    <th className="p-4 font-semibold text-slate-700">动作/姿势标签</th>
                    <th className="p-4 font-semibold text-slate-700">审美评分</th>
                    <th className="p-4 font-semibold text-slate-700">推荐任务</th>
                    <th className="p-4 font-semibold text-slate-700">状态</th>
                    <th className="p-4 font-semibold text-slate-700">调用频次</th>
                  </>
                )}

                {activeTab === 'video_prompt' && (
                  <>
                    <th className="p-4 font-semibold text-slate-700">视频脚本名称</th>
                    <th className="p-4 font-semibold text-slate-700">视频生成模式</th>
                    <th className="p-4 font-semibold text-slate-700">推荐适用首帧</th>
                    <th className="p-4 font-semibold text-slate-700">参数限制 (时长/幅度)</th>
                    <th className="p-4 font-semibold text-slate-700">三段结构建议</th>
                    <th className="p-4 font-semibold text-slate-700">约束项</th>
                    <th className="p-4 font-semibold text-slate-700">状态</th>
                    <th className="p-4 font-semibold text-slate-700">使用次数</th>
                  </>
                )}

                {activeTab === 'platform_spec' && (
                  <>
                    <th className="p-4 font-semibold text-slate-700">规格规范名称</th>
                    <th className="p-4 font-semibold text-slate-700">输出类型</th>
                    <th className="p-4 font-semibold text-slate-700">推荐画幅比例</th>
                    <th className="p-4 font-semibold text-slate-700">宽度 x 高度 (px)</th>
                    <th className="p-4 font-semibold text-slate-700">文件格式</th>
                    <th className="p-4 font-semibold text-slate-700">体积大小限制</th>
                    <th className="p-4 font-semibold text-slate-700">默认推荐带入</th>
                    <th className="p-4 font-semibold text-slate-700">状态</th>
                  </>
                )}

                {activeTab === 'negative_constraint' && (
                  <>
                    <th className="p-4 font-semibold text-slate-700">负面约束名称</th>
                    <th className="p-4 font-semibold text-slate-700">适用素材</th>
                    <th className="p-4 font-semibold text-slate-700">约束分类</th>
                    <th className="p-4 font-semibold text-slate-700">严重级别</th>
                    <th className="p-4 font-semibold text-slate-700">中文避坑说明</th>
                    <th className="p-4 font-semibold text-slate-700">默认全局启用</th>
                    <th className="p-4 font-semibold text-slate-700">正在被引用数</th>
                    <th className="p-4 font-semibold text-slate-700">状态</th>
                  </>
                )}

                <th className="p-4 font-semibold text-slate-700 text-right w-28">操作</th>
              </tr>
            </thead>
            
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-16 text-center text-slate-400 font-medium">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">space_dashboard</span>
                    <p className="text-sm font-semibold text-slate-600">暂无该分类下的可复用规则模板</p>
                    <p className="text-slate-400 text-xs mt-1">您可以通过上方「新建模板」按钮为该大类创建新规约</p>
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((temp) => {
                  const isChecked = selectedIds.includes(temp.id);
                  return (
                    <tr
                      key={temp.id}
                      onClick={() => setEditingTemplate(temp)}
                      className={`hover:bg-slate-50/50 transition-colors cursor-pointer group ${
                        isChecked ? 'bg-blue-50/20' : ''
                      } ${temp.status === 'draft' ? 'opacity-75 bg-slate-50/30' : ''}`}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer w-4 h-4"
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(temp.id, e.target.checked)}
                        />
                      </td>

                      {/* --- CATEGORY 1: IMAGE TASK --- */}
                      {activeTab === 'image_task' && (
                        <>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-lg text-primary">add_photo_alternate</span>
                              <span className="font-semibold text-slate-800 group-hover:text-primary transition-colors">{temp.title}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-medium text-[10px]">
                              {temp.imageTaskType || temp.taskType || '主图'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 font-medium">{temp.applicableCategory || '通用品类'}</td>
                          <td className="p-4 text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              {temp.defaultStyle || '默认自然风格'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-600 font-medium">
                            {temp.ratio} <span className="text-slate-300 mx-1">/</span> {temp.defaultCount || '4张'}
                          </td>
                          <td className="p-4 text-slate-500 font-medium">{temp.defaultChannel || 'DaVinci Vision v2'}</td>
                          <td className="p-4 text-slate-400 max-w-[150px] truncate" title={temp.relatedNegativeConstraints?.join(', ') || '通用物理防走形约束'}>
                            {temp.relatedNegativeConstraints?.join(', ') || '通用防形变约束'}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              temp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                              {temp.status === 'active' ? '启用中' : '已停用'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-semibold text-slate-700">{(temp.usedCount || 0).toLocaleString()}</td>
                        </>
                      )}

                      {/* --- CATEGORY 2: STYLE SCENE --- */}
                      {activeTab === 'style_scene' && (
                        <>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-lg text-indigo-500">palette</span>
                              <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{temp.title}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-[10px]">
                              {temp.styleType || '风格'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {(temp.styleTags || [temp.defaultStyle || '通用']).map(tag => (
                                <span key={tag} className="px-1 bg-slate-100 text-slate-600 rounded text-[9px]">{tag}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {(temp.sceneTags || ['精致电商摄影棚']).map(tag => (
                                <span key={tag} className="px-1 bg-slate-100 text-slate-600 rounded text-[9px]">{tag}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                              {(temp.poseTags || ['正面站姿/侧微动']).map(tag => (
                                <span key={tag} className="px-1 bg-slate-100 text-slate-600 rounded text-[9px]">{tag}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-amber-600 font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs text-amber-500">star</span>
                            {temp.avgAestheticScore || '8.5'}
                          </td>
                          <td className="p-4 text-slate-500">{temp.taskType || '场景融合'}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              temp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                              {temp.status === 'active' ? '启用中' : '已停用'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-semibold text-slate-700">{(temp.usedCount || 0).toLocaleString()}</td>
                        </>
                      )}

                      {/* --- CATEGORY 3: VIDEO PROMPT --- */}
                      {activeTab === 'video_prompt' && (
                        <>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-lg text-amber-500">movie_creation</span>
                              <span className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">{temp.title}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 font-bold text-[10px]">
                              {temp.videoMode === 'reference2video' ? 'Reference (垫图录制)' : 'Image2Video (图生视频)'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                              {(temp.applicableImageTypes || ['电商主图', '场景融合首帧']).join(', ')}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-600">
                            {temp.defaultDuration || '8秒'} <span className="text-slate-300">/</span> 幅度: {temp.motionRange === 'large' ? '高' : temp.motionRange === 'small' ? '低' : '中'}
                          </td>
                          <td className="p-4">
                            <div className="max-w-[200px] truncate bg-slate-50 p-1.5 rounded border border-slate-100 text-[10px] text-slate-500" title={`【开场】${temp.threeStageStructure?.opening || '正面模特静态'}\n【动态】${temp.threeStageStructure?.dynamic || '自然微动转身'}\n【收尾】${temp.threeStageStructure?.detailEnding || '细节收尾'}`}>
                              开场: {temp.threeStageStructure?.opening || '模特正面静立展示'}...
                            </div>
                          </td>
                          <td className="p-4 text-rose-500 max-w-[120px] truncate font-medium" title={temp.negativePrompt || '人体崩溃, 脸部融化, 画面强闪烁, 异常漂移'}>
                            {temp.negativePrompt || '画面闪烁/漂移变色'}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              temp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                              {temp.status === 'active' ? '启用中' : '已停用'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-semibold text-slate-700">{(temp.usedCount || 0).toLocaleString()}</td>
                        </>
                      )}

                      {/* --- CATEGORY 4: PLATFORM SPEC --- */}
                      {activeTab === 'platform_spec' && (
                        <>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-lg text-emerald-500">grid_on</span>
                              <span className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">{temp.title}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[10px]">
                              {temp.specMaterialType || '图片'}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-700 font-mono">{temp.ratio}</td>
                          <td className="p-4 font-mono text-slate-600 font-bold">
                            {temp.specWidth || 1024} x {temp.specHeight || 1365}
                          </td>
                          <td className="p-4 font-mono text-slate-500 font-semibold">{(temp.specFormat || 'jpg').toUpperCase()}</td>
                          <td className="p-4 font-mono text-slate-400 font-semibold">{temp.maxFileSize || '10MB'}</td>
                          <td className="p-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              temp.isDefaultRecommended !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {temp.isDefaultRecommended !== false ? '默认智能带入' : '按需手动选择'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              temp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                              {temp.status === 'active' ? '启用中' : '已停用'}
                            </span>
                          </td>
                        </>
                      )}

                      {/* --- CATEGORY 5: NEGATIVE CONSTRAINT --- */}
                      {activeTab === 'negative_constraint' && (
                        <>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-lg text-rose-500">warning</span>
                              <span className="font-semibold text-slate-800 group-hover:text-rose-600 transition-colors">{temp.title}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px]">
                              {temp.applicableMaterialTypes || '通用'}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-slate-600">{temp.constraintCategory || '商品保真'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                              temp.severityLevel === 'P0' ? 'bg-rose-100 text-rose-700 border border-rose-200' : temp.severityLevel === 'P1' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {temp.severityLevel || 'P0'}
                            </span>
                          </td>
                          <td className="p-4 text-rose-700 font-medium max-w-[200px] truncate" title={temp.chineseDescription || '规避肢体扭曲异常，强力纠偏'}>
                            {temp.chineseDescription || '规避肢体扭曲与细节融化异常'}
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-slate-500">
                              {temp.isDefaultRecommended !== false ? '⚠️ 强全局启用' : '手动勾选启用'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-indigo-600">{temp.referencedTemplatesCount || 12} 次引用</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              temp.status === 'active' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                              {temp.status === 'active' ? '监控中' : '已停用'}
                            </span>
                          </td>
                        </>
                      )}

                      {/* ACTIONS */}
                      <td className="p-4 text-right font-semibold" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyPrompt(temp)}
                            title="复制正文指令"
                            className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm font-bold">content_copy</span>
                          </button>
                          <button
                            onClick={() => setEditingTemplate(temp)}
                            title="编辑修改规则"
                            className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm font-bold">edit</span>
                          </button>
                          <button
                            onClick={() => setScreen(temp.type === 'video' ? AppScreen.CREATE_VIDEO_TASK : AppScreen.CREATE_IMAGE_TASK)}
                            title="以此规则发布新任务"
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm font-bold">rocket_launch</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>共 {filteredTemplates.length} 个模板，已选择 {selectedIds.length} 个</span>
          <div className="flex items-center gap-1.5">
            <button className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 cursor-pointer">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button className="w-6 h-6 rounded bg-primary text-white font-semibold flex items-center justify-center">1</button>
            <button className="p-1 rounded hover:bg-slate-100 cursor-pointer">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      {/* Slide-out Drawer for editing/creating templates */}
      {editingTemplate && (
        <>
          {/* Overlay background */}
          <div 
            onClick={() => {
              setEditingTemplate(null);
              setIsCreatingNew(false);
            }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
          />
          
          <div className="fixed top-0 right-0 w-full max-w-[600px] h-screen bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col animate-slideInRight">
            <form onSubmit={handleSaveEdit} className="h-full flex flex-col">
              
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">
                      {isCreatingNew ? 'add_circle' : 'architecture'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">
                      {isCreatingNew ? '创建全新模板' : `编辑模板: ${editingTemplate.title}`}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {isCreatingNew ? '版本 v1.0.0 自动生成' : `模板唯一标识: ${editingTemplate.id}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(editingTemplate.promptTemplate);
                      showToast('复制提示词成功！');
                    }} 
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                    title="复制提示词"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">content_copy</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingTemplate(null);
                      setIsCreatingNew(false);
                    }} 
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">close</span>
                  </button>
                </div>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-600">
                
                {/* Basic Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">模板名称 <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-primary"
                      value={editingTemplate.title}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                      placeholder="例：秋季复古慵懒风温暖针织"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">适用品类</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-primary"
                      value={editingTemplate.applicableCategory || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, applicableCategory: e.target.value })}
                      placeholder="如：通用 / 女装/外套"
                    />
                  </div>
                </div>

                {/* Dropdown template category & initialized task types */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">模板类别</label>
                    <select
                      className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-semibold focus:bg-white focus:border-primary"
                      value={editingTemplate.tabCategory || 'image_task'}
                      onChange={(e) => {
                        const newVal = e.target.value as TabCategory;
                        let mappedTaskType = '';
                        if (newVal === 'image_task') mappedTaskType = '商品生图';
                        else if (newVal === 'style_scene') mappedTaskType = '场景融合';
                        else if (newVal === 'video_prompt') mappedTaskType = '视频脚本';
                        else if (newVal === 'platform_spec') mappedTaskType = '规格排版';
                        else if (newVal === 'negative_constraint') mappedTaskType = '负面提示';

                        setEditingTemplate({
                          ...editingTemplate,
                          tabCategory: newVal,
                          taskType: mappedTaskType,
                          type: newVal === 'video_prompt' ? 'video' : 'image',
                          category: newVal === 'video_prompt' ? '短视频脚本' : '电商主图'
                        });
                        showToast(`已按最新PRD初始化任务类型为「${mappedTaskType}」！`, 'info');
                      }}
                    >
                      <option value="image_task">图片任务</option>
                      <option value="style_scene">风格场景</option>
                      <option value="video_prompt">视频</option>
                      <option value="platform_spec">平台规格</option>
                      <option value="negative_constraint">负面约束</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">任务类型 (已根据类别初始化)</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-500 font-semibold cursor-not-allowed"
                      value={editingTemplate.taskType || ''}
                      readOnly
                      title="任务类型根据模板分类自动进行第一性原理映射"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">默认风格</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-primary"
                      value={editingTemplate.defaultStyle || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultStyle: e.target.value })}
                      placeholder="简约白底"
                    />
                  </div>
                </div>

                {/* Category-Specific Form Editors (PRD Custom Layouts) */}
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">settings_suggest</span>
                    {editingTemplate.tabCategory === 'image_task' && '图片任务 (Image Task) 专有配置字段'}
                    {editingTemplate.tabCategory === 'style_scene' && '风格场景 (Style Scene) 审美微调参数'}
                    {editingTemplate.tabCategory === 'video_prompt' && '视频 (Video Prompt) 三阶段动态编排'}
                    {editingTemplate.tabCategory === 'platform_spec' && '平台规格 (Platform Spec) 尺寸规范参数'}
                    {editingTemplate.tabCategory === 'negative_constraint' && '负面约束 (Negative Constraint) 避坑防御规约'}
                  </h4>

                  {/* 1. Image Task Fields */}
                  {editingTemplate.tabCategory === 'image_task' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">图片任务类型</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary"
                            value={editingTemplate.imageTaskType || '主图'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, imageTaskType: e.target.value as any })}
                          >
                            <option value="主图">电商商品主图</option>
                            <option value="场景图">详情页 / 场景融合图</option>
                            <option value="细节图">细节特写局部生图</option>
                            <option value="上身三视图">上身效果与三视图</option>
                            <option value="通用">通用任务规则</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">默认模型通道</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-medium"
                            value={editingTemplate.defaultChannel || 'DaVinci Core v2'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultChannel: e.target.value })}
                            placeholder="如 DaVinci Core v2"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">默认比例 (e.g. 3:4)</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-center"
                            value={editingTemplate.ratio}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, ratio: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">默认生图张数</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary text-center"
                            value={editingTemplate.defaultCount || '4张'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultCount: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">发布状态</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-semibold"
                            value={editingTemplate.status}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, status: e.target.value as any })}
                          >
                            <option value="active">启用中</option>
                            <option value="draft">已停用</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">可变参数变量 (以逗号分隔)</label>
                        <input
                          type="text"
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-xs"
                          value={editingTemplate.variableFields ? editingTemplate.variableFields.join(', ') : '商品名, 颜色, 材质'}
                          onChange={(e) => setEditingTemplate({ 
                            ...editingTemplate, 
                            variableFields: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                          })}
                          placeholder="例如: 商品主体, 背景风格, 卖点文案"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">关联的负面防变形规约 (以逗号分隔)</label>
                        <input
                          type="text"
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-xs"
                          value={editingTemplate.relatedNegativeConstraints ? editingTemplate.relatedNegativeConstraints.join(', ') : '高精度手部关节约束, 物理抗畸变规约'}
                          onChange={(e) => setEditingTemplate({ 
                            ...editingTemplate, 
                            relatedNegativeConstraints: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                          })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. Style Scene Fields */}
                  {editingTemplate.tabCategory === 'style_scene' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">风格维度划分</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-semibold"
                            value={editingTemplate.styleType || '风格'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, styleType: e.target.value as any })}
                          >
                            <option value="风格">纯审美艺术风格</option>
                            <option value="场景">背景物理场景空间</option>
                            <option value="动作姿势">模特肢体/动作姿势</option>
                            <option value="组合预设">全面审美组合预设</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">推荐调优模型通道</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-medium"
                            value={editingTemplate.defaultChannel || 'Aesthetic Pro Max'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultChannel: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">审美期望分 (0-10)</label>
                          <input
                            type="number"
                            step="0.1"
                            max="10"
                            min="1"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-center font-bold"
                            value={editingTemplate.avgAestheticScore || 8.5}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, avgAestheticScore: parseFloat(e.target.value) || 8.5 })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">画布输出比例</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-center"
                            value={editingTemplate.ratio}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, ratio: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">发布状态</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-semibold"
                            value={editingTemplate.status}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, status: e.target.value as any })}
                          >
                            <option value="active">启用中</option>
                            <option value="draft">已停用</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">艺术风格特征标签 (逗号分隔)</label>
                        <input
                          type="text"
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-xs"
                          value={editingTemplate.styleTags ? editingTemplate.styleTags.join(', ') : '新中式、极简冷淡、复古港风'}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, styleTags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">物理背景场景标签 (逗号分隔)</label>
                        <input
                          type="text"
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-xs"
                          value={editingTemplate.sceneTags ? editingTemplate.sceneTags.join(', ') : '极简白影棚、都市街区、大理石底台'}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, sceneTags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">模特肢体姿态标签 (逗号分隔)</label>
                        <input
                          type="text"
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-xs"
                          value={editingTemplate.poseTags ? editingTemplate.poseTags.join(', ') : '正面站姿、微侧脸、手插口袋'}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, poseTags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. Video Prompt Fields */}
                  {editingTemplate.tabCategory === 'video_prompt' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">视频生成模式</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-bold text-[11px]"
                            value={editingTemplate.videoMode || 'img2video'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, videoMode: e.target.value as any })}
                          >
                            <option value="img2video">Image-to-Video (纯静图流体转换)</option>
                            <option value="reference2video">Reference-to-Video (垫图特征追踪)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">默认调用模型通道</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-medium"
                            value={editingTemplate.defaultChannel || 'Sora Fast Video Engine'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultChannel: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">默认时长参数</label>
                          <select
                            className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary"
                            value={editingTemplate.defaultDuration || '8s'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultDuration: e.target.value })}
                          >
                            <option value="5s">5 秒快速渲染</option>
                            <option value="8s">8 秒标准渲染</option>
                            <option value="15s">15 秒深度精绘</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">运动幅度限制</label>
                          <select
                            className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary"
                            value={editingTemplate.motionRange || 'medium'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, motionRange: e.target.value as any })}
                          >
                            <option value="small">小幅度 (高保真防抖)</option>
                            <option value="medium">中等幅度 (兼顾张力与平滑)</option>
                            <option value="large">大幅度 (强镜头环绕运动)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">状态</label>
                          <select
                            className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-semibold"
                            value={editingTemplate.status}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, status: e.target.value as any })}
                          >
                            <option value="active">启用中</option>
                            <option value="draft">已停用</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">推荐适用首帧类型 (逗号分隔)</label>
                        <input
                          type="text"
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary text-xs"
                          value={editingTemplate.applicableImageTypes ? editingTemplate.applicableImageTypes.join(', ') : '电商商品主图, 细节白底图'}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, applicableImageTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        />
                      </div>

                      {/* Three Stage Elements */}
                      <div className="p-3 bg-slate-100 rounded-lg space-y-2 border border-slate-200">
                        <span className="font-bold text-[10px] text-slate-500 uppercase flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px] text-amber-500">splitscreen</span>
                          三段结构细化规则建议 (Three Stage Directive)
                        </span>
                        
                        <div className="space-y-2 text-[11px]">
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600 block">① 开场画面主体设定 (Opening Stage)</label>
                            <input
                              type="text"
                              className="w-full h-8 px-2 bg-white border border-slate-200 rounded outline-none text-slate-800 text-[11px]"
                              value={editingTemplate.threeStageStructure?.opening || ''}
                              onChange={(e) => setEditingTemplate({
                                ...editingTemplate,
                                threeStageStructure: {
                                  opening: e.target.value,
                                  dynamic: editingTemplate.threeStageStructure?.dynamic || '',
                                  detailEnding: editingTemplate.threeStageStructure?.detailEnding || ''
                                }
                              })}
                              placeholder="例如：第一阶段开场模特身着毛衣正面，静立光影正常"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600 block">② 动态镜头或姿体展示 (Dynamic Stage)</label>
                            <input
                              type="text"
                              className="w-full h-8 px-2 bg-white border border-slate-200 rounded outline-none text-slate-800 text-[11px]"
                              value={editingTemplate.threeStageStructure?.dynamic || ''}
                              onChange={(e) => setEditingTemplate({
                                ...editingTemplate,
                                threeStageStructure: {
                                  opening: editingTemplate.threeStageStructure?.opening || '',
                                  dynamic: e.target.value,
                                  detailEnding: editingTemplate.threeStageStructure?.detailEnding || ''
                                }
                              })}
                              placeholder="例如：第二阶段模特慢动作半转身，毛衣面料产生轻微晃动"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600 block">③ 特写或细节镜头收束 (Ending Stage)</label>
                            <input
                              type="text"
                              className="w-full h-8 px-2 bg-white border border-slate-200 rounded outline-none text-slate-800 text-[11px]"
                              value={editingTemplate.threeStageStructure?.detailEnding || ''}
                              onChange={(e) => setEditingTemplate({
                                ...editingTemplate,
                                threeStageStructure: {
                                  opening: editingTemplate.threeStageStructure?.opening || '',
                                  dynamic: editingTemplate.threeStageStructure?.dynamic || '',
                                  detailEnding: e.target.value
                                }
                              })}
                              placeholder="例如：第三阶段微距镜头缓慢推向领口，展示精致针织走线细节"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Platform Spec Fields */}
                  {editingTemplate.tabCategory === 'platform_spec' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">输出场景用途</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary"
                            value={editingTemplate.specUsage || '商品主图'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, specUsage: e.target.value as any })}
                          >
                            <option value="商品主图">电商平台 1:1 商品主图规格</option>
                            <option value="详情页场景图">详情页 3:4 / 16:9 场景渲染图</option>
                            <option value="短视频素材">小红书/抖音短视频高画质素材</option>
                            <option value="通用">多渠道通用输出规格</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">对应素材物理类型</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary"
                            value={editingTemplate.specMaterialType || '图片'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, specMaterialType: e.target.value as any })}
                          >
                            <option value="图片">图片 (Raster / Vector)</option>
                            <option value="视频">视频 (H.264 / ProRes)</option>
                            <option value="双核通用">双核自适应多媒体通用型</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">输出画布分辨率宽度 (px)</label>
                          <input
                            type="number"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-center font-bold"
                            value={editingTemplate.specWidth || 1024}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, specWidth: parseInt(e.target.value) || 1024 })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">输出画布分辨率高度 (px)</label>
                          <input
                            type="number"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-center font-bold"
                            value={editingTemplate.specHeight || 1024}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, specHeight: parseInt(e.target.value) || 1024 })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">强制文件格式</label>
                          <select
                            className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-xs"
                            value={editingTemplate.specFormat || 'jpg'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, specFormat: e.target.value as any })}
                          >
                            <option value="jpg">JPG</option>
                            <option value="png">PNG (透明图/无损)</option>
                            <option value="webp">WEBP (高比例压缩)</option>
                            <option value="mp4">MP4 (视频格式)</option>
                            <option value="gif">GIF (动图格式)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">最大体积大小限制</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-mono text-center"
                            value={editingTemplate.maxFileSize || '5MB'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, maxFileSize: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">推荐画幅比例 (e.g. 1:1)</label>
                          <input
                            type="text"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary text-center font-mono font-bold"
                            value={editingTemplate.ratio}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, ratio: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 py-1">
                        <input
                          type="checkbox"
                          id="isDefaultRecommended"
                          className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          checked={editingTemplate.isDefaultRecommended !== false}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, isDefaultRecommended: e.target.checked })}
                        />
                        <label htmlFor="isDefaultRecommended" className="font-bold text-slate-700 cursor-pointer select-none">
                          设为新任务默认推荐带入的画布规格模板
                        </label>
                      </div>
                    </div>
                  )}

                  {/* 5. Negative Constraint Fields */}
                  {editingTemplate.tabCategory === 'negative_constraint' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">适用素材范围</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary"
                            value={editingTemplate.applicableMaterialTypes || '通用'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, applicableMaterialTypes: e.target.value as any })}
                          >
                            <option value="通用">多媒体全域通用避坑</option>
                            <option value="图片">仅适用于图片生图规约</option>
                            <option value="视频">仅适用于视频动态稳定性规约</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">规约严重级别</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-bold text-rose-600"
                            value={editingTemplate.severityLevel || 'P0'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, severityLevel: e.target.value as any })}
                          >
                            <option value="P0" className="text-rose-600 font-bold">P0 强力阻断 (任何时候都将注入底层约束)</option>
                            <option value="P1" className="text-amber-600 font-bold">P1 预警拦截 (超出安全阈值时拦截渲染)</option>
                            <option value="P2" className="text-slate-600 font-bold">P2 软性防变形 (提示并持续优化纠偏)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">约束分类</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-medium"
                            value={editingTemplate.constraintCategory || '商品保真'}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, constraintCategory: e.target.value as any })}
                          >
                            <option value="商品保真">商品固有材质/Logo细节保真</option>
                            <option value="人物人体">人脸防垮/手部肢体防畸变</option>
                            <option value="画面质量">规避低画质/重影/边缘羽化异常</option>
                            <option value="视频稳定性">规避视频闪烁/突变/多帧漂移</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700">发布状态</label>
                          <select
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary font-semibold"
                            value={editingTemplate.status}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, status: e.target.value as any })}
                          >
                            <option value="active">运行中 (监控守卫)</option>
                            <option value="draft">已停用</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">中文避坑逻辑说明 (便于模型底层理解与运营人员查阅)</label>
                        <textarea
                          rows={2}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-primary text-xs"
                          value={editingTemplate.chineseDescription || ''}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, chineseDescription: e.target.value })}
                          placeholder="例如: 该负面提示词深度干预AI模型对于多手、畸形手部关节的纠错，可大幅减少坏图率。"
                        />
                      </div>

                      <div className="flex items-center gap-3 py-1">
                        <input
                          type="checkbox"
                          id="isGlobalNegativeEnabled"
                          className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 w-4 h-4 cursor-pointer text-rose-600"
                          checked={editingTemplate.isDefaultRecommended !== false}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, isDefaultRecommended: e.target.checked })}
                        />
                        <label htmlFor="isGlobalNegativeEnabled" className="font-bold text-slate-700 cursor-pointer select-none text-rose-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">gavel</span>
                          强力开启全局自动强绑定 (默认向该素材任务底层注入此负面词)
                        </label>
                      </div>
                    </div>
                  )}

                </div>

                <hr className="border-slate-100" />

                {/* Prompt Template Body */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">text_fields</span>
                      Prompt 正文指令
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const enhanced = editingTemplate.promptTemplate + ', studio lighting, extremely detailed, octane render, 8k resolution';
                        setEditingTemplate({ ...editingTemplate, promptTemplate: enhanced });
                        showToast('已通过 AI 加持画面精细度！');
                      }}
                      className="text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer text-[10px]"
                    >
                      <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                      AI 智能优化
                    </button>
                  </div>

                  <div className="relative rounded-xl border border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 bg-slate-50 overflow-hidden">
                    <div className="bg-slate-100/80 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingTemplate.promptTemplate + ' {{product_feature}}';
                          setEditingTemplate({ ...editingTemplate, promptTemplate: updated });
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-50 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">data_object</span>
                        插入自定义变量
                      </button>
                    </div>
                    <textarea
                      className="w-full h-36 p-3 bg-white border-none focus:ring-0 resize-none font-mono leading-relaxed text-slate-800 text-xs"
                      value={editingTemplate.promptTemplate}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, promptTemplate: e.target.value })}
                      placeholder="输入 prompt 模板内容，例如：A professional photo of {{product_name}}, on top of {{platform}}, soft focus..."
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">使用双大括号包裹的 <code className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded">{"{{变量名}}"}</code> 将会被识别为任务表单的可变填充字段。</p>
                </div>

                {/* Dynamic detected variables */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-150">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-secondary">data_object</span>
                    检测到的提示词变量 ({extractVariables(editingTemplate.promptTemplate).length}个)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {extractVariables(editingTemplate.promptTemplate).length === 0 ? (
                      <span className="text-[10px] text-slate-400 italic">提示词中未发现变量字段</span>
                    ) : (
                      extractVariables(editingTemplate.promptTemplate).map((v) => (
                        <span key={v} className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 font-mono text-secondary text-[10px] font-bold">
                          {"{{"}{v}{"}}"}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Negative Constraints Prompt */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-rose-500">block</span>
                    负面约束 (Negative Prompt)
                  </label>
                  <textarea
                    className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 resize-none font-mono leading-relaxed text-slate-700"
                    value={editingTemplate.negativePrompt || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, negativePrompt: e.target.value })}
                    placeholder="输入需要避开的异常。例如：bad anatomy, deformed, texts, messy background"
                  />
                </div>

              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-150 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">最新版本:</span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-mono rounded-full font-bold text-[10px]">
                    {editingTemplate.version || 'v1.0.0'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(null);
                      setIsCreatingNew(false);
                    }}
                    className="px-4 py-2 font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">{isCreatingNew ? 'publish' : 'save'}</span>
                    {isCreatingNew ? '创建并发布' : '保存更新'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </>
      )}

    </div>
  );
};
