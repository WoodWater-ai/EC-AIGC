import React, { useState, useEffect, useCallback } from 'react';
import { ProductAsset, GenerationTask, AppScreen } from '../types';
import { TransitPickerButton } from './common/TransitPickerButton';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { templateApi, type TemplateDTO } from '../api/modules/template';
import { TaskParamsPanel } from './createTask/TaskParamsPanel';
import { buildSubmitPayload } from './createTask/buildSubmitPayload';
import { submitTask } from '../api/modules/task';
import { type SlotKey, type SlotRef } from './createTask/slots';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: () => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
}

export const CreateImageTask: React.FC<CreateImageTaskProps> = ({
  products,
  onAddTask,
  setScreen,
  openTransit,
  selectedProduct,
  setSelectedProduct
}) => {
  const { data } = useServiceQuery(() =>
    templateApi.page({ pageSize: 200, status: 'NORMAL' }),
  );
  const templates: TemplateDTO[] = data?.list ?? [];
  // 7 个 slot 的资源引用(统一 Record,替代原 13 个独立 state)
  const [slotRefs, setSlotRefs] = useState<Record<SlotKey, SlotRef | null>>({
    main: null, top: null, bottom: null, detail: null,
    style: null, scene: null, pose: null,
  });
  const setSlotRef = useCallback((slot: SlotKey, ref: SlotRef | null) => {
    setSlotRefs((prev) => ({ ...prev, [slot]: ref }));
  }, []);

  // Input fields in Middle Column
  const [productName, setProductName] = useState(selectedProduct.name);
  const [sellingPoints, setSellingPoints] = useState(selectedProduct.specs.sellingPoints.join('，'));
  const [productCategory, setProductCategory] = useState(selectedProduct.category);
  const [colorPattern, setColorPattern] = useState(selectedProduct.specs.color[0] || '米白色');
  const [fitStructure, setFitStructure] = useState('修身版型');
  const [fabricTexture, setFabricTexture] = useState(selectedProduct.specs.material || '细腻针织纹理');
  const [keyDetails, setKeyDetails] = useState('法式复古风格');

  // Constraints checkbox state
  const [constrainColor, setConstrainColor] = useState(true);
  const [constrainPattern, setConstrainPattern] = useState(true);
  const [constrainLogo, setConstrainLogo] = useState(false);
  const [constrainFit, setConstrainFit] = useState(false);

  // Task parameters in Right Column
  const [aspectRatio, setAspectRatio] = useState<'3:4' | '1:1' | '16:9'>('3:4');
  const [count, setCount] = useState(4);
  const [negativePrompt, setNegativePrompt] = useState('blurry, bad quality, distorted');
  const [taskParams, setTaskParams] = useState<{ channelId: string | null; channelType: string | null; capability: string | null; modelId: string | null; schemaParams: Record<string, any> }>({ channelId: null, channelType: null, capability: null, modelId: null, schemaParams: {} });
  const [imagePrefill] = useState<import('./createTask/useTaskParams').PrefillState | null>(() => {
    try { const raw = sessionStorage.getItem('beta.template.prefill'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  // Assembled Prompt state
  const [promptText, setPromptText] = useState('');

  // Local state for composite setup
  const [hasCompositePreviewed, setHasCompositePreviewed] = useState(false);

  // Mock Upload state for main asset
  const [isUploading, setIsUploading] = useState(false);

  // Sync inputs when selectedProduct changes
  useEffect(() => {
    setProductName(selectedProduct.name);
    setSellingPoints(selectedProduct.specs.sellingPoints.join('，'));
    setProductCategory(selectedProduct.category);
    setColorPattern(selectedProduct.specs.color[0] || '米白色');
    setFabricTexture(selectedProduct.specs.material || '细腻针织纹理');
  }, [selectedProduct]);

  // Reset to Global Template
  const handleResetToTemplate = () => {
    setProductName(selectedProduct.name);
    setSellingPoints(selectedProduct.specs.sellingPoints.join('，'));
    setColorPattern(selectedProduct.specs.color[0] || '米白色');
    setFabricTexture(selectedProduct.specs.material || '细腻针织纹理');
    setAspectRatio('3:4');
    setConstrainColor(true);
    setConstrainPattern(true);
    setConstrainLogo(false);
    setConstrainFit(false);
  };

  const handleMockUploadMain = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      setTimeout(() => {
        setIsUploading(false);
        // Create a temporary mock asset based on uploaded file
        const file = e.target.files![0];
        const mockUrl = URL.createObjectURL(file);
        setSelectedProduct({
          ...selectedProduct,
          name: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
          thumbnail: mockUrl,
          files: [
            {
              id: 'uploaded-1',
              name: file.name,
              url: mockUrl,
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              type: 'image'
            },
            ...selectedProduct.files
          ]
        });
      }, 1000);
    }
  };

  const handleCompositePreview = () => {
    if (!slotRefs.top || !slotRefs.bottom) {
      alert('请先添加上衣和下装素材后再进行合成！');
      return;
    }
    setHasCompositePreviewed(true);
    alert('合成预览成功！已自动将“上下装合成套图”入库并设为主体图。');
    setSelectedProduct({
      ...selectedProduct,
      name: '智能拼合秋季潮流女装套组',
      thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80',
    });
  };

  const handleSubmitTask = async () => {
    if (!taskParams.channelType || !taskParams.capability) {
      alert('请先在右侧选择通道和能力');
      return;
    }
    if (!taskParams.channelId) {
      alert('请先在右侧选择通道实例');
      return;
    }
    const payload = buildSubmitPayload({
      title: `图片生成任务_${productName}`,
      productId: String(selectedProduct.id),
      taskType: 'PRODUCT_MAIN',
      channelType: taskParams.channelType,
      capability: taskParams.capability,
      modelId: taskParams.modelId ?? undefined,
      modelChannelId: String(taskParams.channelId),
      aspectRatio,
      count,
      prompt: promptText,
      negativePrompt,
      schemaParams: taskParams.schemaParams,
      templateId: imagePrefill?.templateId,
      templateVersionId: imagePrefill?.templateVersionId,
      slotRefs,
    });
    try {
      await submitTask(payload);
      sessionStorage.removeItem('beta.template.prefill');
      setScreen(AppScreen.TASKS);
    } catch {
      // http 拦截器已 toast 错误
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden text-slate-800" id="create-image-task-container">
      
      {/* 1. Top Navigation Bar */}
      <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10" id="create-task-header">
        {/* Left: Back Button & Title */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setScreen(AppScreen.TASKS)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-sm lg:text-base font-bold leading-tight flex items-center gap-2">
              新建任务
            </h1>
            <div className="text-[10px] lg:text-xs text-slate-400 font-mono">T-20231024-001</div>
          </div>
        </div>

        {/* Center: Step Progress */}
        <div className="flex-1 flex justify-center items-center">
          <div className="flex items-center space-x-2">
            {/* Step 1 (Active) */}
            <div className="flex items-center text-blue-600 font-medium text-[11px] lg:text-sm">
              <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-blue-600 text-white flex items-center justify-center mr-1.5 lg:mr-2 text-[10px] lg:text-xs">1</div>
              上传素材
            </div>
            <div className="w-6 lg:w-8 h-px bg-slate-200 mx-1 lg:mx-2" />
            {/* Step 2 (Active state text and border circle) */}
            <div className="flex items-center text-blue-600 font-medium text-[11px] lg:text-sm">
              <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full border border-blue-600 flex items-center justify-center mr-1.5 lg:mr-2 text-[10px] lg:text-xs font-bold">2</div>
              商品信息
            </div>
            <div className="w-6 lg:w-8 h-px bg-slate-200 mx-1 lg:mx-2" />
            {/* Step 3 (Inactive) */}
            <div className="flex items-center text-slate-400 text-[11px] lg:text-sm">
              <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full border border-slate-300 flex items-center justify-center mr-1.5 lg:mr-2 text-[10px] lg:text-xs bg-slate-50">3</div>
              模板与参数
            </div>
            <div className="w-6 lg:w-8 h-px bg-slate-200 mx-1 lg:mx-2" />
            {/* Step 4 (Inactive) */}
            <div className="flex items-center text-slate-400 text-[11px] lg:text-sm">
              <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full border border-slate-300 flex items-center justify-center mr-1.5 lg:mr-2 text-[10px] lg:text-xs bg-slate-50">4</div>
              确认生成
            </div>
          </div>
        </div>

        {/* Right: AI Assistant Button */}
        <div>
          <button className="flex items-center text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-sm mr-1">auto_awesome</span>
            AI 助手
          </button>
        </div>
      </header>

      {/* 2. Main Content Area (Three Columns) */}
      <main className="flex-1 flex overflow-hidden bg-white" id="create-task-main-view">
        
        {/* Column 1: 素材上传 (Left Column) */}
        <div className="w-[300px] lg:w-[350px] shrink-0 border-r border-slate-200 flex flex-col bg-white overflow-y-auto" id="col-upload-assets">
          
          {/* Header sticky */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h2 className="text-sm lg:text-base font-bold text-slate-800">素材上传</h2>
          </div>

          <div className="px-5 py-2 text-[10px] lg:text-xs text-slate-400 border-b border-slate-100 bg-slate-50 font-medium">
            上传后进入暂存抽屉，需手动分类
          </div>

          {/* Main Upload Area */}
          <div className="p-5 space-y-6">
            
            {/* Primary Image Upload Box */}
            <div className="relative border-2 border-dashed border-blue-250 rounded-xl p-5 bg-blue-50/50 flex flex-col items-center justify-center text-center hover:bg-blue-50 transition-colors group">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center mb-2.5 shadow-xs group-hover:shadow text-blue-500 transition-shadow">
                <span className="material-symbols-outlined text-xl">cloud_upload</span>
              </div>
              <TransitPickerButton
                slot="main"
                value={slotRefs.main}
                onChange={(next) => setSlotRef('main', next)}
                size="lg"
                variant="primary"
                placeholder="点击上传图片打开资源中心"
              />
              <div className="text-[10px] lg:text-xs text-slate-400 leading-relaxed max-w-[240px] mt-2">
                所有资源选择都要打开资源中心，支持本地上传与目录扫描，可多选及勾选上传。
              </div>
              <div className="text-[9px] lg:text-[10px] text-slate-400 mt-2 font-mono">
                通过资源中心统一管理和添加主体素材
              </div>
            </div>

            {/* Composite Setup: 上下装合成套图 */}
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined text-blue-500 text-sm mr-1.5">layers</span>
                上下装合成套图
              </div>
              <div className="p-4 flex flex-col items-center">
                <div className="text-[10px] lg:text-xs text-slate-400 mb-3 font-medium">合成后将作为主任务图像输入</div>
                <div className="flex items-center space-x-3 w-full justify-center mb-4">
                  
                  {/* Top slot */}
                  <TransitPickerButton
                    slot="top"
                    value={slotRefs.top}
                    onChange={(next) => setSlotRef('top', next)}
                    size="md"
                    placeholder="添加上衣"
                    icon="checkroom"
                  />

                  <div className="text-slate-300 text-lg font-bold">+</div>

                  {/* Bottom slot */}
                  <TransitPickerButton
                    slot="bottom"
                    value={slotRefs.bottom}
                    onChange={(next) => setSlotRef('bottom', next)}
                    size="md"
                    placeholder="添加下装"
                    icon="accessibility_new"
                  />

                </div>

                <button 
                  onClick={handleCompositePreview}
                  className="w-full py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm mr-1">preview</span>
                  合成预览并入库
                </button>
              </div>
            </div>

            {/* Reference Images: 参考图 (选传) */}
            <div>
              <div className="text-xs lg:text-sm font-bold text-slate-800 mb-1">参考图 (选传)</div>
              <div className="text-[10px] lg:text-xs text-slate-400 mb-3 leading-normal font-medium">
                用于影响生成的细节、风格、场景、姿势，不直接替代主体
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                
                {/* Slot 1: Details */}
                <div className="flex flex-col items-center">
                  <TransitPickerButton
                    slot="detail"
                    value={slotRefs.detail}
                    onChange={(next) => setSlotRef('detail', next)}
                    size="sm"
                    placeholder="细节"
                  />
                  <span className={`text-[10px] font-medium mt-1 ${slotRefs.detail ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>细节</span>
                </div>

                {/* Slot 2: Style */}
                <div className="flex flex-col items-center">
                  <TransitPickerButton
                    slot="style"
                    value={slotRefs.style}
                    onChange={(next) => setSlotRef('style', next)}
                    size="sm"
                    placeholder="风格"
                    icon="palette"
                  />
                  <span className={`text-[10px] font-medium mt-1 ${slotRefs.style ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>风格</span>
                </div>

                {/* Slot 3: Scene */}
                <div className="flex flex-col items-center">
                  <TransitPickerButton
                    slot="scene"
                    value={slotRefs.scene}
                    onChange={(next) => setSlotRef('scene', next)}
                    size="sm"
                    placeholder="场景"
                  />
                  <span className={`text-[10px] font-medium mt-1 ${slotRefs.scene ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>场景</span>
                </div>

                {/* Slot 4: Pose */}
                <div className="flex flex-col items-center">
                  <TransitPickerButton
                    slot="pose"
                    value={slotRefs.pose}
                    onChange={(next) => setSlotRef('pose', next)}
                    size="sm"
                    placeholder="姿势"
                  />
                  <span className={`text-[10px] font-medium mt-1 ${slotRefs.pose ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>姿势</span>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* Column 2: 商品信息 (Middle Column - Wide) */}
        <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-y-auto" id="col-product-info">
          <div className="p-6 max-w-2xl lg:max-w-3xl mx-auto w-full">
            
            {/* Main Form Card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              
              {/* Card Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center bg-white">
                <span className="material-symbols-outlined text-blue-600 mr-2 text-xl font-bold">info</span>
                <h2 className="text-sm lg:text-base font-bold text-slate-800">商品信息</h2>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-6">
                
                {/* 1. 商品主体图 View */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs lg:text-sm font-bold text-slate-700">商品主体图</span>
                    <span className="bg-blue-50 text-blue-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-blue-100 font-bold flex items-center">
                      AI 已识别
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3 flex items-start space-x-4 bg-slate-50/50">
                    {/* Preview Thumbnail */}
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 relative group overflow-hidden shrink-0">
                      {selectedProduct.thumbnail ? (
                        <img 
                          src={selectedProduct.thumbnail} 
                          alt={selectedProduct.name}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-2xl">image</span>
                      )}
                      
                      {/* Hover eye action */}
                      <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white transition-opacity">
                        <span className="material-symbols-outlined text-sm cursor-pointer hover:text-blue-300">visibility</span>
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center mb-1.5 flex-wrap gap-2">
                        <span className="bg-slate-100 text-slate-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-slate-200 font-bold">
                          商品原图
                        </span>
                        <span className="text-xs lg:text-sm font-bold text-slate-800 truncate">
                          {selectedProduct.thumbnail ? 'uploaded_arrival_asset.jpg' : 'new_arrival_01.jpg'}
                        </span>
                      </div>
                      <div className="text-[10px] lg:text-xs text-slate-400 font-mono">
                        尺寸: 1024x1024 | 大小: 2.4 MB
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 商品名称 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs lg:text-sm font-bold text-slate-700" htmlFor="product_name">
                      商品名称 <span className="text-red-500">*</span>
                    </label>
                    <span className="bg-blue-50 text-blue-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-blue-100 font-bold">
                      AI 已识别
                    </span>
                  </div>
                  <input 
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-medium outline-none transition-shadow"
                    id="product_name"
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>

                {/* 3. 核心卖点 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs lg:text-sm font-bold text-slate-700" htmlFor="selling_points">
                      核心卖点
                    </label>
                    <span className="bg-blue-50 text-blue-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-blue-100 font-bold">
                      AI 已识别
                    </span>
                  </div>
                  <textarea 
                    className="w-full p-3 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-medium outline-none resize-y"
                    id="selling_points"
                    rows={3}
                    value={sellingPoints}
                    onChange={(e) => setSellingPoints(e.target.value)}
                  />
                </div>

                {/* 4. 品类 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs lg:text-sm font-bold text-slate-700" htmlFor="category">
                      品类 <span className="text-red-500">*</span>
                    </label>
                    <span className="bg-blue-50 text-blue-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-blue-100 font-bold">
                      AI 已识别
                    </span>
                  </div>
                  <div className="relative">
                    <select 
                      className="block w-full h-10 pl-3 pr-10 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none font-bold cursor-pointer"
                      id="category"
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value as any)}
                    >
                      <option value="户外服饰">针织衫/毛衣</option>
                      <option value="美妆护肤">美妆护肤</option>
                      <option value="箱包配饰">箱包配饰</option>
                      <option value="智能硬件">智能硬件与穿戴设备</option>
                      <option value="珠饰轻奢">珠宝与腕表轻奢</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <span className="material-symbols-outlined text-sm font-bold">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* 5. 2-column Grid: 颜色与图案, 版型结构 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs lg:text-sm font-bold text-slate-700">颜色与图案</label>
                      <span className="bg-blue-50 text-blue-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-blue-100 font-bold">
                        AI 已识别
                      </span>
                    </div>
                    <input 
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
                      type="text"
                      value={colorPattern}
                      onChange={(e) => setColorPattern(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs lg:text-sm font-bold text-slate-700">版型结构</label>
                      <span className="bg-amber-50 text-amber-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-amber-200 font-bold flex items-center">
                        <span className="material-symbols-outlined text-[11px] mr-0.5 font-bold">warning_amber</span>
                        需人工确认
                      </span>
                    </div>
                    <input 
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
                      type="text"
                      value={fitStructure}
                      onChange={(e) => setFitStructure(e.target.value)}
                    />
                  </div>
                </div>

                {/* 6. 2-column Grid: 面料质感, 关键细节 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs lg:text-sm font-bold text-slate-700">面料质感</label>
                      <span className="bg-blue-50 text-blue-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-blue-100 font-bold">
                        AI 已识别
                      </span>
                    </div>
                    <input 
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
                      type="text"
                      value={fabricTexture}
                      onChange={(e) => setFabricTexture(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs lg:text-sm font-bold text-slate-700">关键细节</label>
                      <span className="bg-amber-50 text-amber-600 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md border border-amber-200 font-bold flex items-center">
                        <span className="material-symbols-outlined text-[11px] mr-0.5 font-bold">warning_amber</span>
                        需人工确认
                      </span>
                    </div>
                    <input 
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
                      type="text"
                      value={keyDetails}
                      onChange={(e) => setKeyDetails(e.target.value)}
                    />
                  </div>
                </div>

                {/* 7. 不可改变项 (Constraints/Non-negotiables) */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center text-xs lg:text-sm font-bold text-red-600">
                      <span className="material-symbols-outlined text-base mr-1.5 font-bold">gpp_bad</span>
                      不可改变项 (Constraints/Non-negotiables)
                    </div>
                    <span className="bg-blue-100 text-blue-700 text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                      AI 已识别
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex items-center bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-xs cursor-pointer hover:bg-slate-50 select-none">
                      <input 
                        type="checkbox" 
                        checked={constrainColor}
                        onChange={(e) => setConstrainColor(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                      />
                      <span className="ml-2 text-xs lg:text-sm font-bold text-slate-700">颜色</span>
                    </label>

                    <label className="inline-flex items-center bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-xs cursor-pointer hover:bg-slate-50 select-none">
                      <input 
                        type="checkbox" 
                        checked={constrainPattern}
                        onChange={(e) => setConstrainPattern(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                      />
                      <span className="ml-2 text-xs lg:text-sm font-bold text-slate-700">图案</span>
                    </label>

                    <label className="inline-flex items-center bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-xs cursor-pointer hover:bg-slate-50 select-none">
                      <input 
                        type="checkbox" 
                        checked={constrainLogo}
                        onChange={(e) => setConstrainLogo(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                      />
                      <span className="ml-2 text-xs lg:text-sm font-bold text-slate-700">Logo</span>
                    </label>

                    <label className="inline-flex items-center bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-xs cursor-pointer hover:bg-slate-50 select-none">
                      <input 
                        type="checkbox" 
                        checked={constrainFit}
                        onChange={(e) => setConstrainFit(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                      />
                      <span className="ml-2 text-xs lg:text-sm font-bold text-slate-700">版型</span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* Column 3: 任务参数 (Right Column) */}
        <div className="w-[310px] lg:w-[350px] shrink-0 border-l border-slate-200 flex flex-col bg-[#F9FAFB] overflow-y-auto" id="col-generation-params">
          <TaskParamsPanel
            group="IMAGE"
            prefill={imagePrefill}
            unified={{
              productName,
              sellingPoints,
              keyDetails,
              constraints: [
                constrainColor ? '颜色' : '',
                constrainPattern ? '图案' : '',
                constrainLogo ? 'Logo' : '',
                constrainFit ? '版型' : '',
              ].filter(Boolean),
            }}
            aspectRatio={aspectRatio}
            count={count}
            onAspectRatioChange={setAspectRatio}
            onCountChange={setCount}
            prompt={promptText}
            onPromptChange={setPromptText}
            negativePrompt={negativePrompt}
            onNegativePromptChange={setNegativePrompt}
            onParamsChange={setTaskParams}
          />
          <div className="mt-auto p-4 border-t border-slate-100 flex gap-2">
            <button onClick={() => setScreen(AppScreen.TASKS)} className="flex-1 py-2 text-sm border border-slate-200 rounded-md">取消</button>
            <button onClick={handleSubmitTask} className="flex-1 py-2 text-sm text-white rounded-md bg-blue-600">提交任务</button>
          </div>
        </div>

      </main>

      {/* 3. Bottom Action Bar */}
      <footer className="bg-white border-t border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]" id="create-task-footer">
        <div className="text-[11px] lg:text-xs text-slate-400 font-mono font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          已自动保存于 10:42
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setScreen(AppScreen.TASKS)}
            className="px-5 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg shadow-xs hover:bg-slate-50 focus:outline-none transition-colors text-xs lg:text-sm cursor-pointer"
          >
            保存草稿
          </button>
          <button 
            onClick={handleSubmitTask}
            className="px-5 py-2 bg-blue-600 border border-transparent text-white font-bold rounded-lg shadow-xs hover:bg-blue-700 focus:outline-none transition-colors flex items-center text-xs lg:text-sm cursor-pointer active:scale-98"
          >
            <span className="material-symbols-outlined mr-1.5 text-sm font-bold">auto_awesome</span>
            提交生成 (¥1.20)
          </button>
        </div>
      </footer>

    </div>
  );
};
