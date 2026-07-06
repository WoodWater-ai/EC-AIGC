import React, { useState, useEffect } from 'react';
import { GenerationTask, ProductAsset, AppScreen } from '../types';

interface TaskDetailsDrawerProps {
  task: GenerationTask;
  products: ProductAsset[];
  onClose: () => void;
  onUpdateTask: (task: GenerationTask) => void;
  initialTab?: 'overview' | 'inputs' | 'results' | 'reviews' | 'costs';
}

export const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({
  task,
  products,
  onClose,
  onUpdateTask,
  initialTab
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'inputs' | 'results' | 'reviews' | 'costs'>('overview');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, task]);
  
  // Find associated product
  const associatedProduct = products.find(p => p.name === task.productName) || products[0];

  // Local state for generated images with ratings
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  // Local state for review history
  const [reviews, setReviews] = useState<any[]>([]);
  // Copy feedback state
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Active image being rated/reviewed
  const [activeReviewImgId, setActiveReviewImgId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');

  // Refined scoring sub-dimensions
  const [reviewAccuracy, setReviewAccuracy] = useState<number>(4.0);
  const [reviewConsistency, setReviewConsistency] = useState<number>(4.0);
  const [reviewComposition, setReviewComposition] = useState<number>(4.0);
  const [reviewTexture, setReviewTexture] = useState<number>(4.0);
  const [selectedReviewTags, setSelectedReviewTags] = useState<string[]>([]);
  const [availableReviewTags, setAvailableReviewTags] = useState<string[]>([
    '主体漂移', '色彩失真', '布料闪烁', '人物扭曲', '视频水印'
  ]);
  const [showCustomTagInput, setShowCustomTagInput] = useState<boolean>(false);
  const [newCustomTag, setNewCustomTag] = useState<string>('');

  // Automatically calculate the overall rating based on sub-dimensions
  useEffect(() => {
    if (activeReviewImgId) {
      const avg = (reviewAccuracy + reviewConsistency + reviewComposition + reviewTexture) / 4;
      setReviewRating(parseFloat(avg.toFixed(1)));
    }
  }, [reviewAccuracy, reviewConsistency, reviewComposition, reviewTexture, activeReviewImgId]);

  // Timeline / Quick review states
  const [quickComment, setQuickComment] = useState('');
  const [quickRating, setQuickRating] = useState(5);
  const [quickStatus, setQuickStatus] = useState<'approved' | 'rejected'>('approved');

  // Initialize data once drawer opens
  useEffect(() => {
    // 1. Generate mockup images for completed tasks
    if (task.status === 'completed' || task.status === 'rejected') {
      const imagesList = task.generatedImages && task.generatedImages.length > 0 
        ? task.generatedImages 
        : [
            { id: 'img-1', url: task.resultUrl || task.productImg, rating: task.rating || 5, status: task.status === 'rejected' ? 'rejected' : 'approved', comment: '商品主体保真度高，边缘合成良好。' },
            { id: 'img-2', url: associatedProduct?.files[1]?.url || task.productImg, rating: 4, status: 'approved', comment: '材质纹理细腻，符合极简冷淡风。' },
            { id: 'img-3', url: associatedProduct?.files[2]?.url || task.productImg, rating: 5, status: 'approved', comment: '整体高奢，背景光影效果拉满。' },
            { id: 'img-4', url: associatedProduct?.thumbnail || task.productImg, rating: 3, status: 'pending', comment: '脚部透视有轻微偏差，需微调。' }
          ];
      setGeneratedImages(imagesList);
    } else {
      setGeneratedImages([]);
    }

    // 2. Generate default reviews
    const defaultReviews = task.reviews && task.reviews.length > 0 
      ? task.reviews 
      : [
          {
            id: 'rev-1',
            reviewer: '陈美晴',
            rating: 4,
            status: 'approved',
            comment: '一审通过。光效融合度良好，商品无漂移，白鸭绒外壳质感表达完美。',
            timestamp: '2026-07-03 15:42'
          },
          ...(task.status === 'rejected' ? [{
            id: 'rev-2',
            reviewer: '林若云 (客户)',
            rating: 2,
            status: 'rejected',
            comment: task.feedback || '高光部分有些许过曝，拉低了整体的高级感，建议降低参数重新运行。',
            timestamp: '2026-07-03 16:15'
          }] : [])
        ];
    setReviews(defaultReviews);
  }, [task, associatedProduct]);

  // Copy prompt helper
  const handleCopyPrompt = () => {
    const promptText = task.params?.prompt || `A premium studio product photography of ${task.productName}, clean marble stone display, morning shadow play, minimal aesthetics, highly detailed textures, 8k render.`;
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Submit rating for an individual image
  const handleSubmitImageReview = (imgId: string) => {
    const updated = generatedImages.map(img => {
      if (img.id === imgId) {
        return {
          ...img,
          status: reviewStatus,
          rating: reviewRating,
          accuracyRating: reviewAccuracy,
          consistencyRating: reviewConsistency,
          compositionRating: reviewComposition,
          textureRating: reviewTexture,
          problemTags: selectedReviewTags,
          comment: reviewComment || (reviewStatus === 'approved' ? '审核通过，效果极佳。' : '审核不通过，建议重绘。')
        };
      }
      return img;
    });

    setGeneratedImages(updated);

    // Append to timeline reviews
    const newReview = {
      id: `rev-gen-${Date.now()}`,
      reviewer: '陆永奇 (当前用户)',
      rating: reviewRating,
      status: reviewStatus,
      comment: `针对生成图 #${imgId.split('-')[1]} 的单评: ${reviewComment || (reviewStatus === 'approved' ? '审核通过' : '审核退回')}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    const newReviewsList = [...reviews, newReview];
    setReviews(newReviewsList);

    // Sync back to main parent task state
    onUpdateTask({
      ...task,
      rating: Math.round(newReviewsList.reduce((acc, r) => acc + r.rating, 0) / newReviewsList.length),
      generatedImages: updated,
      reviews: newReviewsList
    });

    // Reset review form
    setActiveReviewImgId(null);
    setReviewComment('');
  };

  // Submit quick review timeline record
  const handleAddQuickReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickComment.trim()) return;

    const newReview = {
      id: `rev-quick-${Date.now()}`,
      reviewer: '陆永奇 (当前用户)',
      rating: quickRating,
      status: quickStatus,
      comment: quickComment,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    const newReviewsList = [...reviews, newReview];
    setReviews(newReviewsList);

    // Update parent task
    onUpdateTask({
      ...task,
      status: quickStatus === 'approved' ? 'completed' : 'rejected',
      feedback: quickStatus === 'rejected' ? quickComment : undefined,
      reviews: newReviewsList,
      rating: Math.round(newReviewsList.reduce((acc, r) => acc + r.rating, 0) / newReviewsList.length)
    });

    setQuickComment('');
  };

  // Cost data calculation matching the task type
  const cost = task.type === 'video' ? 120 : (task.params?.steps || 30) * 3;
  const breakdown = task.costBreakdown || {
    compute: Math.round(cost * 0.55),
    steps: Math.round(cost * 0.20),
    upscaler: Math.round(cost * 0.15),
    bandwidth: Math.round(cost * 0.10)
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Background overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Slide-out drawer panel */}
      <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col z-10 animate-slideLeft border-l border-slate-200">
        
        {/* Header Section */}
        <header className="px-6 py-5 border-b border-slate-150 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base lg:text-lg font-black text-slate-800 tracking-tight">#{task.id} 任务详情</h2>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
              task.status === 'running' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
              task.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
              task.status === 'failed' ? 'bg-red-50 text-red-600 border border-red-200' :
              'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                task.status === 'running' ? 'bg-blue-500 animate-pulse' :
                task.status === 'completed' ? 'bg-emerald-500' :
                task.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              {task.status === 'running' ? '生成中' :
               task.status === 'completed' ? '已完成' :
               task.status === 'failed' ? '生成失败' : '被退回'}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined font-bold text-xl">close</span>
          </button>
        </header>

        {/* Multi-Tab Navigation Row */}
        <div className="px-6 border-b border-slate-100 bg-white shrink-0 flex space-x-6 text-sm font-semibold select-none">
          {[
            { id: 'overview', label: '概览' },
            { id: 'inputs', label: '输入素材' },
            { id: 'results', label: '生成结果' },
            { id: 'reviews', label: '审核记录' },
            { id: 'costs', label: '成本明细' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id 
                  ? 'border-[#0054cd] text-[#0054cd] font-extrabold' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
          
          {/* TAB 1: 概览 (Overview) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* 输入素材 Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                  <h3 className="text-xs lg:text-sm font-extrabold text-slate-800">输入素材</h3>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  {/* Item 1: 原图 */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 text-center flex flex-col justify-between items-center h-[130px] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="w-14 h-14 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center">
                      <img src={task.productImg} alt="原图" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-1.5 truncate w-full">原图</span>
                  </div>

                  {/* Item 2: 风格 */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 text-center flex flex-col justify-between items-center h-[130px] shadow-2xs">
                    <div className="w-14 h-14 bg-[#eff4ff] rounded-lg border border-blue-100 flex items-center justify-center text-blue-500">
                      <span className="material-symbols-outlined text-2xl">style</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-1.5 truncate w-full">风格参考</span>
                  </div>

                  {/* Item 3: 场景 */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 text-center flex flex-col justify-between items-center h-[130px] shadow-2xs">
                    <div className="w-14 h-14 bg-[#f1fcf8] rounded-lg border border-emerald-100 flex items-center justify-center text-emerald-500">
                      <span className="material-symbols-outlined text-2xl">landscape</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-1.5 truncate w-full">场景参考</span>
                  </div>

                  {/* Item 4: 姿态 */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 text-center flex flex-col justify-between items-center h-[130px] shadow-2xs">
                    <div className="w-14 h-14 bg-[#fff9eb] rounded-lg border border-amber-100 flex items-center justify-center text-amber-500">
                      <span className="material-symbols-outlined text-2xl">accessibility</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-1.5 truncate w-full">姿态参考</span>
                  </div>
                </div>
              </div>

              {/* 商品信息 Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                  <h3 className="text-xs lg:text-sm font-extrabold text-slate-800">商品信息</h3>
                </div>
                
                <div className="bg-blue-50/40 rounded-xl p-5 border border-blue-100/50 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">商品名称</label>
                    <span className="text-xs lg:text-sm font-extrabold text-slate-800 leading-tight">
                      {associatedProduct?.name || task.productName}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">类目</label>
                      <span className="text-xs font-bold text-slate-700">
                        {associatedProduct?.category || '户外服饰'}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">颜色/花色</label>
                      <span className="text-xs font-bold text-slate-700">
                        {associatedProduct?.specs?.color?.join('、') || '极美火山灰'}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">面料</label>
                      <span className="text-xs font-bold text-slate-700">
                        {associatedProduct?.specs?.material || '抗撕裂科技纤维面料'}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">核心卖点</label>
                      <span className="text-xs font-bold text-slate-700">
                        {associatedProduct?.specs?.sellingPoints?.slice(0, 2).join('、') || '防风透湿、极轻量设计'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 任务参数 Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                  <h3 className="text-xs lg:text-sm font-extrabold text-slate-800">任务参数</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '任务类型', value: task.type === 'image' ? '商品主图' : '视频脚本' },
                    { label: '风格', value: task.type === 'image' ? '甜美网红风' : '爆破粒子风' },
                    { label: '场景', value: task.type === 'image' ? '北欧极简石室' : '三维炫彩粒子' },
                    { label: '比例', value: task.params?.ratio || '1:1' },
                    { label: '生成数量', value: task.type === 'image' ? '24张' : '1个' },
                    { label: '模型通道', value: task.modelChannel || 'DaVinci Vision v3.5' }
                  ].map((param, i) => (
                    <div key={i} className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">{param.label}</span>
                      <span className="text-xs font-extrabold text-slate-800">{param.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 提示词预览 Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                    <h3 className="text-xs lg:text-sm font-extrabold text-slate-800">提示词预览</h3>
                  </div>
                  <button 
                    onClick={handleCopyPrompt}
                    className="text-xs text-blue-600 font-extrabold flex items-center gap-1 hover:text-blue-700 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">{copiedPrompt ? 'check' : 'content_copy'}</span>
                    {copiedPrompt ? '已复制成功' : '复制提示词'}
                  </button>
                </div>
                
                <div className="bg-slate-100 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-mono text-slate-600 leading-relaxed font-medium">
                    {task.params?.prompt || `A premium product photography of ${task.productName}, placed on a minimalist sand plaster block with sharp hard morning sunlight. High dynamic range, soft shadows, 8k commercial quality.`}
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: 输入素材 (Input Assets Details) */}
          {activeTab === 'inputs' && (
            <div className="space-y-4">
              {[
                { title: '商品主体原图 (Source Main Image)', size: '2.4 MB', resolution: '2048 x 2048', type: 'PNG', status: '解析正常 (提取率 99.8%)', img: task.productImg },
                { title: '风格特征参考图 (Style Ref)', size: '1.8 MB', resolution: '1024 x 1024', type: 'JPG', status: '已转换为Latent特征向量', icon: 'style', bg: 'bg-[#eff4ff] text-blue-500' },
                { title: '场景布局参考图 (Scene Ref)', size: '3.1 MB', resolution: '1920 x 1080', type: 'JPG', status: '空间景深及网格已映射', icon: 'landscape', bg: 'bg-[#f1fcf8] text-emerald-500' },
                { title: '人模姿态参考图 (Pose Ref)', size: '1.2 MB', resolution: '1024 x 1024', type: 'PNG', status: '骨骼关节点检测完成', icon: 'accessibility', bg: 'bg-[#fff9eb] text-amber-500' }
              ].map((input, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center shrink-0">
                    {input.img ? (
                      <img src={input.img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${input.bg}`}>
                        <span className="material-symbols-outlined text-2xl">{input.icon}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{input.title}</h4>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 mt-1 font-mono">
                      <span>格式: {input.type}</span>
                      <span>大小: {input.size}</span>
                      <span>分辨率: {input.resolution}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded-full inline-block">
                      {input.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: 生成结果 (Generation Results & Interactive Rating / Scoring) */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              
              {task.status !== 'completed' && task.status !== 'rejected' ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl block mb-2 animate-spin text-slate-300">sync</span>
                  <span>任务正在努力生成中，完成后即可在此查看高画质结果并去评分审核...</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center bg-[#eff4ff] border border-blue-200/50 p-3.5 rounded-xl text-xs font-bold text-blue-800">
                    <span>💡 您可以在下方查看渲染结果，对单张图片点击“审核评分”提出修正或赋予星级。</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {generatedImages.map((img) => (
                      <div key={img.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow">
                        {/* Image Frame */}
                        <div className="aspect-square bg-slate-50 relative overflow-hidden group">
                          <img src={img.url} alt={img.id} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" referrerPolicy="no-referrer" />
                          
                          {/* Rating and Status Overlay top left */}
                          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 bg-white/90 backdrop-blur-xs ${
                              img.status === 'approved' ? 'text-emerald-600 border-emerald-200' :
                              img.status === 'rejected' ? 'text-red-600 border-red-200' :
                              'text-amber-600 border-amber-200'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${img.status === 'approved' ? 'bg-emerald-500' : img.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`} />
                              {img.status === 'approved' ? '已通过' : img.status === 'rejected' ? '被退回' : '未审核'}
                            </span>
                            
                            <span className="bg-white/90 backdrop-blur-xs text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1 text-amber-500">
                              <span className="material-symbols-outlined text-[10px] font-black">star</span>
                              {img.rating}分
                            </span>
                          </div>
                        </div>

                        {/* Text and Actions panel */}
                        <div className="p-3 bg-white border-t border-slate-100">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              IMAGE #{img.id.split('-')[1]}
                            </span>
                            
                            <button
                              onClick={() => {
                                setActiveReviewImgId(img.id);
                                setReviewStatus(img.status === 'rejected' ? 'rejected' : 'approved');
                                setReviewRating(img.rating || 4.0);
                                setReviewAccuracy(img.accuracyRating || 4.0);
                                setReviewConsistency(img.consistencyRating || 4.0);
                                setReviewComposition(img.compositionRating || 4.0);
                                setReviewTexture(img.textureRating || 4.0);
                                setSelectedReviewTags(img.problemTags || []);
                                setReviewComment(img.comment || '');
                                setShowCustomTagInput(false);
                                setNewCustomTag('');
                              }}
                              className="text-[10px] text-blue-600 font-extrabold hover:text-blue-700 cursor-pointer border border-blue-200 hover:bg-blue-50/50 px-2.5 py-1 rounded-lg"
                            >
                              去评分 / 审核
                            </button>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 italic truncate font-medium">
                            {img.comment || '暂无评语'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Popup Overlay Modal for rating an individual image */}
              {activeReviewImgId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-fadeIn">
                  <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
                    <div className="p-4 border-b border-slate-150 bg-slate-50 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">图片单件评分与审核</span>
                      <button onClick={() => setActiveReviewImgId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Image Preview thumbnail */}
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <img 
                          src={generatedImages.find(img => img.id === activeReviewImgId)?.url} 
                          alt="preview" 
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0" 
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate">IMAGE #{activeReviewImgId.split('-')[1]}</h4>
                          <span className="text-[10px] text-slate-400">进行审核决策与评分星级记录</span>
                        </div>
                      </div>

                      {/* Score Selection (1-5 Stars) & Sub-dimensions */}
                      <div className="space-y-4">
                        {/* Approval Status Toggle - Sleek Segmented Control */}
                        <div>
                          <label className="text-[11px] font-extrabold text-slate-500 block mb-1.5 uppercase tracking-wide">审核决策 (Approval Decision)</label>
                          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewStatus('approved');
                                // Selecting "Approved" can optionally clear problem tags for clean state
                                setSelectedReviewTags([]);
                              }}
                              className={`flex-1 py-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                reviewStatus === 'approved' 
                                  ? 'bg-emerald-500 text-white shadow-xs' 
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              通过 (Pass)
                            </button>
                            <button
                              type="button"
                              onClick={() => setReviewStatus('rejected')}
                              className={`flex-1 py-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                reviewStatus === 'rejected' 
                                  ? 'bg-rose-500 text-white shadow-xs' 
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              退回 (Reject)
                            </button>
                          </div>
                        </div>

                        {/* Heading for Aesthetic Rating */}
                        <div className="pt-2 border-t border-slate-100/80">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-3.5 bg-[#1D6FFF] rounded-full" />
                            <span className="text-xs font-extrabold text-slate-800">审美评分 (1-5)</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => {
                                  // Quick-set all sub-dimensions to this star value
                                  setReviewAccuracy(star);
                                  setReviewConsistency(star);
                                  setReviewComposition(star);
                                  setReviewTexture(star);
                                }}
                                className={`material-symbols-outlined text-2xl transition-colors cursor-pointer ${
                                  star <= Math.round(reviewRating) ? 'text-amber-500 fill' : 'text-slate-250 hover:text-amber-400'
                                }`}
                                style={{ fontVariationSettings: star <= Math.round(reviewRating) ? "'FILL' 1" : "'FILL' 0" }}
                              >
                                star
                              </button>
                            ))}
                            <span className="text-sm font-black text-slate-800 ml-2 font-display">{reviewRating.toFixed(1)}</span>
                          </div>

                          {/* 4 Fine-grained sliders */}
                          <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {/* Accuracy */}
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-bold text-slate-600 w-12 shrink-0">准确度</span>
                              <div className="relative flex-1">
                                <input
                                  type="range"
                                  min="1.0"
                                  max="5.0"
                                  step="0.1"
                                  value={reviewAccuracy}
                                  onChange={(e) => {
                                    setReviewAccuracy(parseFloat(e.target.value));
                                  }}
                                  className="w-full h-1.5 bg-blue-50 rounded-lg appearance-none cursor-pointer accent-[#1D6FFF]"
                                  style={{
                                    background: `linear-gradient(to right, #1D6FFF 0%, #1D6FFF ${((reviewAccuracy - 1) / 4) * 100}%, #eff6ff ${((reviewAccuracy - 1) / 4) * 100}%, #eff6ff 100%)`
                                  }}
                                />
                              </div>
                              <span className="text-xs font-extrabold text-slate-700 w-6 text-right font-mono">{reviewAccuracy.toFixed(1)}</span>
                            </div>

                            {/* Consistency */}
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-bold text-slate-600 w-12 shrink-0">一致性</span>
                              <div className="relative flex-1">
                                <input
                                  type="range"
                                  min="1.0"
                                  max="5.0"
                                  step="0.1"
                                  value={reviewConsistency}
                                  onChange={(e) => {
                                    setReviewConsistency(parseFloat(e.target.value));
                                  }}
                                  className="w-full h-1.5 bg-blue-50 rounded-lg appearance-none cursor-pointer accent-[#1D6FFF]"
                                  style={{
                                    background: `linear-gradient(to right, #1D6FFF 0%, #1D6FFF ${((reviewConsistency - 1) / 4) * 100}%, #eff6ff ${((reviewConsistency - 1) / 4) * 100}%, #eff6ff 100%)`
                                  }}
                                />
                              </div>
                              <span className="text-xs font-extrabold text-slate-700 w-6 text-right font-mono">{reviewConsistency.toFixed(1)}</span>
                            </div>

                            {/* Composition */}
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-bold text-slate-600 w-12 shrink-0">构图</span>
                              <div className="relative flex-1">
                                <input
                                  type="range"
                                  min="1.0"
                                  max="5.0"
                                  step="0.1"
                                  value={reviewComposition}
                                  onChange={(e) => {
                                    setReviewComposition(parseFloat(e.target.value));
                                  }}
                                  className="w-full h-1.5 bg-blue-50 rounded-lg appearance-none cursor-pointer accent-[#1D6FFF]"
                                  style={{
                                    background: `linear-gradient(to right, #1D6FFF 0%, #1D6FFF ${((reviewComposition - 1) / 4) * 100}%, #eff6ff ${((reviewComposition - 1) / 4) * 100}%, #eff6ff 100%)`
                                  }}
                                />
                              </div>
                              <span className="text-xs font-extrabold text-slate-700 w-6 text-right font-mono">{reviewComposition.toFixed(1)}</span>
                            </div>

                            {/* Texture */}
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-bold text-slate-600 w-12 shrink-0">质感</span>
                              <div className="relative flex-1">
                                <input
                                  type="range"
                                  min="1.0"
                                  max="5.0"
                                  step="0.1"
                                  value={reviewTexture}
                                  onChange={(e) => {
                                    setReviewTexture(parseFloat(e.target.value));
                                  }}
                                  className="w-full h-1.5 bg-blue-50 rounded-lg appearance-none cursor-pointer accent-[#1D6FFF]"
                                  style={{
                                    background: `linear-gradient(to right, #1D6FFF 0%, #1D6FFF ${((reviewTexture - 1) / 4) * 100}%, #eff6ff ${((reviewTexture - 1) / 4) * 100}%, #eff6ff 100%)`
                                  }}
                                />
                              </div>
                              <span className="text-xs font-extrabold text-slate-700 w-6 text-right font-mono">{reviewTexture.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>

                        {/* SECTION: Problem Tagging */}
                        <div className="pt-2 border-t border-slate-100/80">
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-1 h-3.5 bg-[#1D6FFF] rounded-full" />
                            <span className="text-xs font-extrabold text-slate-800">问题打标 (多选)</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {availableReviewTags.map((tag) => {
                              const isSelected = selectedReviewTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedReviewTags(prev => prev.filter(t => t !== tag));
                                    } else {
                                      setSelectedReviewTags(prev => [...prev, tag]);
                                      // Auto toggle status to reject if an issue tag is selected
                                      setReviewStatus('rejected');
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50/50 border-blue-500 text-blue-600'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {tag}
                                  {isSelected && (
                                    <span className="material-symbols-outlined text-[10px] font-extrabold text-blue-500 leading-none">close</span>
                                  )}
                                </button>
                              );
                            })}

                            {/* Add Custom tag inline control */}
                            {!showCustomTagInput ? (
                              <button
                                type="button"
                                onClick={() => setShowCustomTagInput(true)}
                                className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-100 cursor-pointer flex items-center gap-0.5"
                              >
                                <span>+ 自定义</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={newCustomTag}
                                  onChange={(e) => setNewCustomTag(e.target.value)}
                                  placeholder="标签名"
                                  className="px-2.5 py-1 text-xs border border-blue-400 rounded-full outline-none w-20 text-slate-700 font-bold"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const trimmed = newCustomTag.trim();
                                      if (trimmed) {
                                        if (!availableReviewTags.includes(trimmed)) {
                                          setAvailableReviewTags(prev => [...prev, trimmed]);
                                        }
                                        if (!selectedReviewTags.includes(trimmed)) {
                                          setSelectedReviewTags(prev => [...prev, trimmed]);
                                          setReviewStatus('rejected');
                                        }
                                      }
                                      setNewCustomTag('');
                                      setShowCustomTagInput(false);
                                    } else if (e.key === 'Escape') {
                                      setShowCustomTagInput(false);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const trimmed = newCustomTag.trim();
                                    if (trimmed) {
                                      if (!availableReviewTags.includes(trimmed)) {
                                        setAvailableReviewTags(prev => [...prev, trimmed]);
                                      }
                                      if (!selectedReviewTags.includes(trimmed)) {
                                        setSelectedReviewTags(prev => [...prev, trimmed]);
                                        setReviewStatus('rejected');
                                      }
                                    }
                                    setNewCustomTag('');
                                    setShowCustomTagInput(false);
                                  }}
                                  className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[10px] font-black">check</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Comment text */}
                        <div className="pt-2 border-t border-slate-100/80">
                          <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="添加审核备注说明..."
                            className="w-full text-xs font-medium border border-slate-200 focus:border-blue-500 rounded-xl p-3 h-20 outline-none resize-none transition-all bg-slate-50/50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                      <button
                        onClick={() => setActiveReviewImgId(null)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleSubmitImageReview(activeReviewImgId)}
                        className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm cursor-pointer"
                      >
                        提交决策评分
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: 审核记录 (Review Records History Timeline) */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              
              {/* Audit Timeline List */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-2xs">
                <h4 className="text-xs font-extrabold text-slate-800">审批流程时间轴</h4>
                
                <div className="relative border-l border-slate-150 pl-5 ml-2.5 space-y-5">
                  {reviews.map((rev, idx) => (
                    <div key={rev.id} className="relative">
                      {/* Anchor Dot */}
                      <span className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white ring-4 ${
                        rev.status === 'approved' ? 'bg-emerald-500 ring-emerald-50' : 'bg-red-500 ring-red-50'
                      }`} />
                      
                      {/* Review Block Card */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">{rev.reviewer}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-black border ${
                              rev.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              {rev.status === 'approved' ? '审核通过' : '审核拒绝'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{rev.timestamp}</span>
                        </div>

                        {/* Stars row */}
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <span 
                              key={s} 
                              className={`material-symbols-outlined text-xs ${s < rev.rating ? 'text-amber-500' : 'text-slate-200'}`}
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              star
                            </span>
                          ))}
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100/50">
                          {rev.comment}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form to submit an instant rating/review in the timeline */}
              <form onSubmit={handleAddQuickReview} className="bg-white rounded-xl border border-[#b2c5ff]/40 p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-lg font-bold">rate_review</span>
                  <h4 className="text-xs font-extrabold text-slate-800">快捷新增批注 / 评分</h4>
                </div>

                {/* Score slider */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">综合评分星级</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setQuickRating(star)}
                        className={`material-symbols-outlined text-xl cursor-pointer ${
                          star <= quickRating ? 'text-amber-500' : 'text-slate-250'
                        }`}
                        style={{ fontVariationSettings: star <= quickRating ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </button>
                    ))}
                  </div>
                </div>

                {/* Decision */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">综合审核决策</span>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setQuickStatus('approved')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        quickStatus === 'approved' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      通过 (Pass)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickStatus('rejected')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        quickStatus === 'rejected' ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      拒绝退回 (Reject)
                    </button>
                  </div>
                </div>

                {/* Comment box */}
                <div>
                  <textarea
                    value={quickComment}
                    onChange={(e) => setQuickComment(e.target.value)}
                    placeholder="输入协作评语或拒绝的反馈内容..."
                    className="w-full text-xs font-medium border border-slate-200 focus:border-blue-500 rounded-xl p-3 h-16 outline-none resize-none transition-all bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-[#0054cd] hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">gavel</span>
                    提交当前评分批注
                  </button>
                </div>
              </form>

            </div>
          )}

          {/* TAB 5: 成本明细 (Cost Breakdown Visualization) */}
          {activeTab === 'costs' && (
            <div className="space-y-6">
              
              {/* Point Expenditure Summary box */}
              <div className="bg-gradient-to-r from-slate-800 to-[#1D6FFF] text-white p-5 rounded-xl flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase block">预估等额算力成本</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black">{cost} Pts</span>
                    <span className="text-xs font-bold text-slate-200">(等值大约 ¥ {task.type === 'video' ? '1.50' : '0.45'})</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center border border-white/20">
                  <span className="material-symbols-outlined text-2xl">toll</span>
                </div>
              </div>

              {/* Breakdown Bars list */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-2xs">
                <h4 className="text-xs font-extrabold text-slate-800">算力损耗配比结构</h4>
                
                <div className="space-y-4">
                  {/* Compute Core */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600 flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        GPU 渲染核心算力
                      </span>
                      <span className="text-slate-800 font-mono">{breakdown.compute} Pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(breakdown.compute / cost) * 100}%` }} />
                    </div>
                  </div>

                  {/* Steps fee */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600 flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        渲染步数与高去噪增溢费
                      </span>
                      <span className="text-slate-800 font-mono">{breakdown.steps} Pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(breakdown.steps / cost) * 100}%` }} />
                    </div>
                  </div>

                  {/* HD Upscaler */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600 flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        超分像素放大与重构损耗
                      </span>
                      <span className="text-slate-800 font-mono">{breakdown.upscaler} Pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(breakdown.upscaler / cost) * 100}%` }} />
                    </div>
                  </div>

                  {/* Storage / CDN */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600 flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        高保真存储及云端分发服务
                      </span>
                      <span className="text-slate-800 font-mono">{breakdown.bandwidth} Pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(breakdown.bandwidth / cost) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource saving tip */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200/50 flex gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-lg font-bold shrink-0">check_circle</span>
                <div className="space-y-0.5">
                  <h5 className="text-xs font-extrabold text-emerald-800">算力推荐优化建议</h5>
                  <p className="text-[10px] text-emerald-600 leading-relaxed font-medium">
                    您当前已勾选「DaVinci Vision v3.5 (自研推荐)」通道，在保障极佳画质的同时相比传统 Midjourney 通道已节省 35% 算力开销。
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
