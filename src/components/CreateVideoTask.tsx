import React, { useState } from 'react';
import { ProductAsset, GenerationTask, AppScreen } from '../types';
import { AssetTransitModal } from './AssetTransitModal';
import { assetApi } from '../api/modules/asset';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { templateApi, type TemplateDTO } from '../api/modules/template';

interface CreateVideoTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
}

interface SourceImage {
  id: string;
  name: string;
  url: string;
  tag: string;
  score: number;
  archived: boolean;
  selected: boolean;
}

export const CreateVideoTask: React.FC<CreateVideoTaskProps> = ({
  products,
  onAddTask,
  setScreen,
  selectedProduct,
  setSelectedProduct
}) => {
  const { data } = useServiceQuery(() =>
    templateApi.page({ pageSize: 200, status: 'NORMAL' }),
  );
  const templates: TemplateDTO[] = data?.list ?? [];
  // Modal states for Transit Station
  const [isTransitOpen, setIsTransitOpen] = useState(false);

  // Source images state pre-filled to match prototype strictly
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([
    {
      id: 'src-1',
      name: 'SmartWatch Pro Max',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXLKRx6cjMgfXncaHMmKOTF7Q0MuvqCUDcrGBYPJ8t0xaKMCNt-oynAekl-4LUA85q7NEgINvKN62zkstOMZcachuBrsEH0faf-GWccm90PUVv2zaMmPhF-t3GQ60_gP1R8Pk3vz6-FYuI_nvCQFVLTf-dVxom4I9IpUdKZqjj5oBH2JEnlj7bZzJ5TPSR8CH9EWoBXxefRQf0M50H8T177AAFCc7fdYXDIxrcOlAcmnVxLzTSfeTm',
      tag: '主图生成 - 场景融合',
      score: 92,
      archived: true,
      selected: true
    },
    {
      id: 'src-2',
      name: 'Executive Briefcase',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCFSOML8HXFXlpBdlHKBE8COFusXwu0-hCvaaD4DOFXKsNRw6OY5mfhPTVz6s-TvOVKJxs7xpXxayrBK0EVofK0em5JeRSPbiSdv3h1_NceYuEKuFWOBZ3D8T7AOWVzVlZFGgn2sM2oUfFKK8KdWjvKy3K4BokFSPwqlgD-O5U8a1R2fyqwwPjKKRi5NGJTRAovRtmbpyP8wWBHqgc9s7XF835_vGAKoz492WYos2-bggHnJeBREmnM',
      tag: '模特穿搭 - 咖啡厅',
      score: 88,
      archived: false,
      selected: false
    }
  ]);

  // Mode Switch tab
  const [activeTab, setActiveTab] = useState<'ref' | 'first'>('ref');

  // Prompts config state
  const [promptTemplate, setPromptTemplate] = useState('上身展示视频模板');
  const [shot03, setShot03] = useState('');
  const [shot39, setShot39] = useState('');
  const [shot915, setShot915] = useState('');

  // Negative constraints
  const [negativeTags, setNegativeTags] = useState<string[]>(['商品漂移', '面料闪烁', '多余手指']);
  const [newNegativeInput, setNewNegativeInput] = useState('');
  const [customNegativeText, setCustomNegativeText] = useState('');

  // Video parameters
  const [duration, setDuration] = useState<number>(15);
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [motion, setMotion] = useState<number>(2); // 1 = subtle, 2 = moderate, 3 = dynamic
  const [resolution, setResolution] = useState('1080p (高品质)');
  const [modelEngine, setModelEngine] = useState('云端 API (速度快)');
  const [modelVersion, setModelVersion] = useState('V2.1 (最新稳定版)');

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);

  // Toggle selection on source images
  const handleToggleImage = (id: string) => {
    setSourceImages(prev => prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img));
  };

  // Add tag constraint
  const handleAddTag = () => {
    const val = newNegativeInput.trim();
    if (val && !negativeTags.includes(val)) {
      setNegativeTags(prev => [...prev, val]);
      setNewNegativeInput('');
    }
  };

  // Delete tag constraint
  const handleDeleteTag = (tagToDelete: string) => {
    setNegativeTags(prev => prev.filter(t => t !== tagToDelete));
  };

  // Handle selected items from transit modal —— 接 fileResourceIds,异步反查详情生成 SourceImage
  const handleConfirmTransitSelection = async (fileResourceIds: number[]) => {
    if (fileResourceIds.length === 0) return;

    try {
      const items = await Promise.all(
        fileResourceIds.map((id) => assetApi.get(id)),
      );
      const newItems: SourceImage[] = items.map((asset, idx) => ({
        id: `transit-${Date.now()}-${idx}`,
        name: asset.name.length > 20 ? asset.name.substring(0, 15) + '...' : asset.name,
        url: asset.thumbnailUrl ?? '',
        tag: '资源中心导入 - 优质素材',
        score: 85,  // 视频任务不强依赖评分,统一给一个默认
        archived: false,
        selected: true,
      }));
      setSourceImages((prev) => [...newItems, ...prev]);
    } catch (err) {
      console.error('[CreateVideoTask] 资源中心导入失败:', err);
      alert(`导入失败: ${(err as Error).message}`);
    } finally {
      setIsTransitOpen(false);
    }
  };

  // Selection counts
  const selectedCount = sourceImages.filter(img => img.selected).length;

  const handleSubmit = () => {
    const activeSelected = sourceImages.find(img => img.selected) || sourceImages[0];
    const taskName = `视频渲染任务_${activeSelected?.name || '未知'}_${new Date().getMonth() + 1}${new Date().getDate()}`;
    
    const newTask: GenerationTask = {
      id: `V-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`,
      name: taskName,
      type: 'video',
      status: 'running',
      progress: 0,
      productName: activeSelected?.name || selectedProduct.name,
      productImg: activeSelected?.url || selectedProduct.thumbnail,
      templateName: promptTemplate,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      creator: '陆永奇',
      modelChannel: modelEngine,
      params: {
        ratio: aspectRatio,
        steps: 40,
        guidance: motion === 1 ? 3 : motion === 2 ? 6.5 : 9.5,
        prompt: `0-3s: ${shot03 || '主视觉建立'} | 3-9s: ${shot39 || '氛围与动作'} | 9-15s: ${shot915 || '细节收尾'} | Negatives: ${negativeTags.join(',')}, ${customNegativeText}`
      }
    };

    onAddTask(newTask);
    setScreen(AppScreen.TASKS);

    // Simulate render progress
    let progressValue = 0;
    const interval = setInterval(() => {
      progressValue += 10;
      if (progressValue >= 100) {
        clearInterval(interval);
        onAddTask({
          ...newTask,
          status: 'completed',
          progress: 100,
          resultUrl: activeSelected?.url || selectedProduct.thumbnail
        });
      } else {
        onAddTask({
          ...newTask,
          progress: progressValue
        });
      }
    }, 1200);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F5F7FB] overflow-hidden text-[#0b1c30] select-none">
      
      {/* Top Header Navigation */}
      <header className="h-16 bg-white border-b border-[#c2c6d8] flex items-center justify-between px-6 shrink-0 z-10 shadow-[0px_2px_8px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setScreen(AppScreen.TASKS)}
            className="text-[#424655] hover:text-[#0054cd] transition-colors flex items-center justify-center cursor-pointer w-8 h-8 rounded-full hover:bg-slate-100"
          >
            <span className="material-symbols-outlined font-bold text-xl">arrow_back</span>
          </button>
          <h1 className="font-bold text-lg text-[#0b1c30]">新建视频任务</h1>
          <span className="bg-[#eff4ff] text-[#0054cd] px-2 py-0.5 rounded text-xs font-bold">基于图片资产</span>
        </div>

        {/* Step Indicator strictly matches design */}
        <div className="hidden md:flex items-center space-x-3">
          <div className="flex items-center text-[#0054cd] font-bold text-xs lg:text-sm">
            <div className="w-5 h-5 rounded-full bg-[#136bfb] text-white flex items-center justify-center text-[10px] font-bold mr-2">1</div>
            <span>选择图片</span>
          </div>
          <div className="w-8 h-px bg-[#0054cd]" />
          
          <div className="flex items-center text-[#0054cd] font-bold text-xs lg:text-sm">
            <div className="w-5 h-5 rounded-full bg-[#136bfb] text-white flex items-center justify-center text-[10px] font-bold mr-2">2</div>
            <span>视频参数</span>
          </div>
          <div className="w-8 h-px bg-[#c2c6d8]" />
          
          <div className="flex items-center text-[#424655] font-semibold text-xs lg:text-sm">
            <div className="w-5 h-5 rounded-full border border-[#c2c6d8] text-[#424655] flex items-center justify-center text-[10px] font-bold mr-2">3</div>
            <span>确认生成</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="bg-[#0054cd] text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm cursor-pointer">
            <span className="material-symbols-outlined text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            AI 助手
          </button>
          <span className="text-[#424655] text-xs font-medium">草稿已自动保存于 10:42</span>
        </div>
      </header>

      {/* Main Column Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Column 1: Source Image Selection (Left Sidebar / Width 25%) */}
        <section className="w-1/4 min-w-[280px] max-w-[340px] bg-white border-r border-[#c2c6d8] flex flex-col h-full shadow-[0px_2px_8px_rgba(0,0,0,0.05)] shrink-0">
          <div className="p-5 border-b border-[#c2c6d8] shrink-0">
            <h2 className="text-base font-extrabold text-[#0b1c30] mb-4">来源图片</h2>
            
            {/* Mode Switch tabs */}
            <div className="flex bg-[#e5eeff] p-1 rounded-lg mb-4">
              <button 
                onClick={() => setActiveTab('ref')}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded text-center cursor-pointer transition-all ${
                  activeTab === 'ref' 
                    ? 'bg-white text-[#0054cd] shadow-xs' 
                    : 'text-[#424655] hover:text-[#0b1c30]'
                }`}
              >
                参考图生视频 ({selectedCount}/7)
              </button>
              <button 
                onClick={() => setActiveTab('first')}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded text-center cursor-pointer transition-all ${
                  activeTab === 'first' 
                    ? 'bg-white text-[#0054cd] shadow-xs' 
                    : 'text-[#424655] hover:text-[#0b1c30]'
                }`}
              >
                首帧图生视频 ({selectedCount > 0 ? 1 : 0}/1)
              </button>
            </div>

            {/* Core Action Buttons - both open the AssetTransitModal as requested! */}
            <div className="flex gap-2">
              <button 
                onClick={() => setIsTransitOpen(true)}
                className="flex-1 bg-[#eff4ff] border border-[#b2c5ff] text-[#0054cd] rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">photo_library</span>
                <span className="text-xs font-extrabold">商品素材库</span>
              </button>
              <button 
                onClick={() => setIsTransitOpen(true)}
                className="flex-1 bg-white border border-[#c2c6d8] text-[#424655] rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">upload</span>
                <span className="text-xs font-extrabold">本地上传</span>
              </button>
            </div>
          </div>

          {/* Source Image Grid List */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#F5F7FB] space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {sourceImages.map((img) => (
                <div 
                  key={img.id}
                  onClick={() => handleToggleImage(img.id)}
                  className={`group relative rounded-xl overflow-hidden border-2 bg-white cursor-pointer transition-all hover:shadow-md ${
                    img.selected ? 'border-[#0054cd] shadow-xs' : 'border-[#c2c6d8]'
                  }`}
                >
                  {/* Status badges top-left */}
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                    {img.archived && (
                      <span className="bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                        <span className="material-symbols-outlined text-[10px] font-bold">check_circle</span>
                        已归档
                      </span>
                    )}
                    <span className="bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                      <span className="material-symbols-outlined text-[10px] font-bold">star</span>
                      {img.score}分
                    </span>
                  </div>

                  {/* Circular checkmark select indicator top-right */}
                  <div className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-white transition-all ${
                    img.selected ? 'bg-[#0054cd]' : 'border border-white/80 bg-black/10'
                  }`}>
                    {img.selected && <span className="material-symbols-outlined text-xs font-bold">check</span>}
                  </div>

                  {/* Aspect square image display */}
                  <div className="aspect-square bg-slate-50 overflow-hidden relative">
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform" 
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Text details */}
                  <div className="p-2.5 bg-white border-t border-slate-100">
                    <p className="font-extrabold text-xs text-[#0b1c30] truncate">{img.name}</p>
                    <p className="text-[10px] text-[#424655] font-medium truncate mt-0.5">{img.tag}</p>
                  </div>
                </div>
              ))}
            </div>

            {sourceImages.length === 0 && (
              <div className="text-center py-12 text-[#424655] text-xs font-bold">
                暂未添加参考图片。请点击上方按钮通过资源中心选择并添加。
              </div>
            )}
          </div>
        </section>

        {/* Column 2: Video Prompt Configuration (Middle Column / Width 50%) */}
        <section className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 relative">
          <div className="p-8 max-w-3xl mx-auto w-full space-y-6">
            
            {/* Title section with Template switcher */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#0b1c30]">视频 Prompt 配置</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#424655]">视频提示词模板:</span>
                <select 
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  className="bg-white border border-[#c2c6d8] rounded-lg text-xs font-bold py-1.5 pl-3 pr-8 text-[#0b1c30] focus:ring-1 focus:ring-[#0054cd] outline-none cursor-pointer"
                >
                  <option value="上身展示视频模板">上身展示视频模板</option>
                  <option value="主图氛围短视频模板">主图氛围短视频模板</option>
                  <option value="细节质感展示模板">细节质感展示模板</option>
                  <option value="模特轻动作模板">模特轻动作模板</option>
                  <option value="场景转场模板">场景转场模板</option>
                </select>
              </div>
            </div>

            {/* Three-stage Time blocks */}
            <div className="space-y-6">
              
              {/* Stage 1: 0-3s */}
              <div className="bg-white rounded-xl p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.05)] border border-[#c2c6d8] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#1D6FFF]"></div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-2">
                    <span className="bg-[#eff4ff] text-[#0054cd] px-1.5 py-0.5 rounded text-[10px] font-extrabold">0-3s</span>
                    主视觉建立 (Establishing Shot)
                  </h3>
                </div>
                <textarea 
                  value={shot03}
                  onChange={(e) => setShot03(e.target.value)}
                  className="w-full bg-[#F5F7FB] border border-[#c2c6d8] rounded-xl p-3 text-xs font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#0054cd] focus:bg-white outline-none resize-none h-24 transition-all"
                  placeholder="[建议] 描述镜头如何引入商品。提示：时间轴将根据右侧视频时长自动调整。例如：缓慢推镜头，焦点锁定在商品主体..."
                />
              </div>

              {/* Stage 2: 3-9s */}
              <div className="bg-white rounded-xl p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.05)] border border-[#c2c6d8] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00687b]"></div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-2">
                    <span className="bg-[#afecff] text-[#005f71] px-1.5 py-0.5 rounded text-[10px] font-extrabold">3-9s</span>
                    氛围与动作 (Action & Atmosphere)
                  </h3>
                </div>
                <textarea 
                  value={shot39}
                  onChange={(e) => setShot39(e.target.value)}
                  className="w-full bg-[#F5F7FB] border border-[#c2c6d8] rounded-xl p-3 text-xs font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#0054cd] focus:bg-white outline-none resize-none h-24 transition-all"
                  placeholder="[建议] 描述商品的使用场景或动态变化。例如：展示核心功能点，配合环境氛围渲染..."
                />
              </div>

              {/* Stage 3: 9-15s */}
              <div className="bg-white rounded-xl p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.05)] border border-[#c2c6d8] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#595c60]"></div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-2">
                    <span className="bg-[#e0e3e6] text-[#181c1f] px-1.5 py-0.5 rounded text-[10px] font-extrabold">9-15s</span>
                    细节收尾 (Detail & Closure)
                  </h3>
                </div>
                <textarea 
                  value={shot915}
                  onChange={(e) => setShot915(e.target.value)}
                  className="w-full bg-[#F5F7FB] border border-[#c2c6d8] rounded-xl p-3 text-xs font-medium text-[#0b1c30] focus:ring-1 focus:ring-[#0054cd] focus:bg-white outline-none resize-none h-24 transition-all"
                  placeholder="[建议] 描述视频的结束方式。例如：镜头拉远，定格在品牌Logo旁，光效逐渐收尾..."
                />
              </div>

              {/* Negative constraints card strictly matching design */}
              <div className="bg-[#eff4ff]/60 rounded-xl p-5 border border-dashed border-[#b2c5ff] mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#FF4D4F] text-lg font-bold">block</span>
                  <h3 className="text-xs font-extrabold text-[#0b1c30]">负面约束 (Negative Prompts)</h3>
                </div>

                <div className="flex flex-wrap gap-2 mb-3 items-center">
                  {negativeTags.map((tag) => (
                    <span 
                      key={tag}
                      className="bg-white border border-[#c2c6d8] px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#424655] flex items-center gap-1.5"
                    >
                      <span>{tag}</span>
                      <button 
                        onClick={() => handleDeleteTag(tag)}
                        className="material-symbols-outlined text-xs text-[#727787] hover:text-[#ba1a1a] cursor-pointer"
                      >
                        close
                      </button>
                    </span>
                  ))}

                  {/* Inline adding button helper */}
                  <div className="flex items-center border border-[#c2c6d8] rounded-lg bg-white overflow-hidden max-w-[150px]">
                    <input 
                      type="text" 
                      placeholder="自定义" 
                      value={newNegativeInput}
                      onChange={(e) => setNewNegativeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTag();
                      }}
                      className="w-16 px-2 py-0.5 text-[10px] font-bold outline-none border-none focus:ring-0"
                    />
                    <button 
                      onClick={handleAddTag}
                      className="bg-blue-50 text-blue-600 px-1.5 py-0.5 text-[10px] font-extrabold border-l border-[#c2c6d8] hover:bg-blue-100 cursor-pointer"
                    >
                      添加
                    </button>
                  </div>
                </div>

                <textarea 
                  value={customNegativeText}
                  onChange={(e) => setCustomNegativeText(e.target.value)}
                  className="w-full bg-white border border-[#c2c6d8] rounded-xl p-2.5 text-xs font-medium text-[#424655] focus:ring-1 focus:ring-[#0054cd] outline-none resize-none h-14"
                  placeholder="输入其他负面提示词，用英文逗号分隔..."
                />
              </div>

            </div>

          </div>
        </section>

        {/* Column 3: Video parameters configuration (Right column / Width 25%) */}
        <section className="w-1/4 min-w-[280px] max-w-[340px] bg-white border-l border-[#c2c6d8] flex flex-col h-full shadow-[-2px_0px_8px_rgba(0,0,0,0.02)] shrink-0">
          <div className="p-5 border-b border-[#c2c6d8] shrink-0">
            <h2 className="text-base font-extrabold text-[#0b1c30]">视频参数</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Duration select */}
            <div>
              <label className="block text-xs font-extrabold text-[#0b1c30] mb-2.5">时长 (Duration)</label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 8, 15].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setDuration(sec)}
                    className={`py-2 text-center border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      duration === sec
                        ? 'border-[#0054cd] bg-[#eff4ff] text-[#0054cd]'
                        : 'border-[#c2c6d8] text-[#424655] hover:bg-slate-50'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio select with beautiful icons */}
            <div>
              <label className="block text-xs font-extrabold text-[#0b1c30] mb-2.5">比例 (Aspect Ratio)</label>
              <div className="grid grid-cols-3 gap-2">
                
                {/* 9:16 */}
                <button
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex flex-col items-center justify-center py-2.5 border rounded-lg h-16 transition-all cursor-pointer ${
                    aspectRatio === '9:16'
                      ? 'border-[#0054cd] bg-[#eff4ff] text-[#0054cd]'
                      : 'border-[#c2c6d8] text-[#424655] hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-3.5 h-6 border-2 rounded-sm mb-1 ${aspectRatio === '9:16' ? 'border-[#0054cd]' : 'border-[#727787]'}`} />
                  <span className="text-[10px] font-bold">9:16</span>
                </button>

                {/* 16:9 */}
                <button
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex flex-col items-center justify-center py-2.5 border rounded-lg h-16 transition-all cursor-pointer ${
                    aspectRatio === '16:9'
                      ? 'border-[#0054cd] bg-[#eff4ff] text-[#0054cd]'
                      : 'border-[#c2c6d8] text-[#424655] hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-6 h-3.5 border-2 rounded-sm mb-1 ${aspectRatio === '16:9' ? 'border-[#0054cd]' : 'border-[#727787]'}`} />
                  <span className="text-[10px] font-bold">16:9</span>
                </button>

                {/* 1:1 */}
                <button
                  onClick={() => setAspectRatio('1:1')}
                  className={`flex flex-col items-center justify-center py-2.5 border rounded-lg h-16 transition-all cursor-pointer ${
                    aspectRatio === '1:1'
                      ? 'border-[#0054cd] bg-[#eff4ff] text-[#0054cd]'
                      : 'border-[#c2c6d8] text-[#424655] hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 border-2 rounded-sm mb-1 ${aspectRatio === '1:1' ? 'border-[#0054cd]' : 'border-[#727787]'}`} />
                  <span className="text-[10px] font-bold">1:1</span>
                </button>

              </div>
            </div>

            {/* Motion Intensity Slider */}
            <div>
              <label className="block text-xs font-extrabold text-[#0b1c30] mb-2.5">运动幅度 (Motion)</label>
              <input 
                type="range"
                min="1"
                max="3"
                step="1"
                value={motion}
                onChange={(e) => setMotion(parseInt(e.target.value))}
                className="w-full accent-[#0054cd] h-1 bg-[#c2c6d8] rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-[#424655] mt-1.5">
                <span className={motion === 1 ? 'text-[#0054cd]' : ''}>小 (Subtle)</span>
                <span className={motion === 2 ? 'text-[#0054cd]' : ''}>中 (Moderate)</span>
                <span className={motion === 3 ? 'text-[#0054cd]' : ''}>大 (Dynamic)</span>
              </div>
            </div>

            {/* Advanced Settings Accordion strictly matched */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <button 
                onClick={() => setIsAdvancedOpen(prev => !prev)}
                className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
              >
                <span className="text-xs font-extrabold text-[#0b1c30]">高级设置</span>
                <span className="material-symbols-outlined text-[#424655] text-lg">
                  {isAdvancedOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isAdvancedOpen && (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Resolution */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-[#424655]">分辨率 (Resolution)</label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full h-9 bg-white border border-[#c2c6d8] rounded-lg text-xs font-bold px-3 text-[#0b1c30] outline-none cursor-pointer"
                    >
                      <option value="1080p (高品质)">1080p (高品质)</option>
                      <option value="720p (快速预览)">720p (快速预览)</option>
                    </select>
                  </div>

                  {/* Model Engine */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-[#424655]">模型通道 (Model Engine)</label>
                    <select
                      value={modelEngine}
                      onChange={(e) => setModelEngine(e.target.value)}
                      className="w-full h-9 bg-white border border-[#c2c6d8] rounded-lg text-xs font-bold px-3 text-[#0b1c30] outline-none cursor-pointer"
                    >
                      <option value="云端 API (速度快)">云端 API (速度快)</option>
                      <option value="本地模型 (免算力费)">本地模型 (免算力费)</option>
                    </select>
                  </div>

                  {/* Model Version */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-[#424655]">模型版本 (Model Version)</label>
                    <select
                      value={modelVersion}
                      onChange={(e) => setModelVersion(e.target.value)}
                      className="w-full h-9 bg-white border border-[#c2c6d8] rounded-lg text-xs font-bold px-3 text-[#0b1c30] outline-none cursor-pointer"
                    >
                      <option value="V2.1 (最新稳定版)">V2.1 (最新稳定版)</option>
                      <option value="V2.0 (经典版)">V2.0 (经典版)</option>
                      <option value="V1.5 (极速版)">V1.5 (极速版)</option>
                    </select>
                    <p className="text-[9px] font-bold text-[#0054cd] mt-1">* 已根据所选通道自动匹配可用版本</p>
                  </div>

                </div>
              )}
            </div>

          </div>

          {/* Action Cost Footer strictly matches design */}
          <div className="p-4 bg-white border-t border-[#c2c6d8] mt-auto shrink-0 space-y-3 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#424655] font-bold">预估成本:</span>
              <span className="text-[#0b1c30] font-extrabold text-lg">¥ 1.50</span>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setScreen(AppScreen.TASKS)}
                className="flex-1 border border-[#0054cd] text-[#0054cd] rounded-lg py-2 text-xs font-extrabold hover:bg-blue-50/50 transition-colors cursor-pointer"
              >
                保存草稿
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-1 bg-gradient-to-r from-[#0054cd] to-[#00687b] text-white rounded-lg py-2 text-xs font-extrabold shadow-md hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">movie</span>
                提交生成
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Transit Station Overlay inside Video Task component context */}
      {isTransitOpen && (
        <AssetTransitModal
          purpose="PRODUCT"
          productId={selectedProduct?.id ? Number(selectedProduct.id) : undefined}
          onClose={() => setIsTransitOpen(false)}
          onConfirmSelection={handleConfirmTransitSelection}
        />
      )}

    </div>
  );
};
