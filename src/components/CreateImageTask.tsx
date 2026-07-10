import React, { useState, useEffect } from 'react';
import { ProductAsset, GenerationTask, AppScreen } from '../types';
import { AssetTransitModal } from './AssetTransitModal';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { templateApi, type TemplateDTO } from '../api/modules/template';

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
  // Internal Asset Transit Modal states for Image Task
  const [isInternalTransitOpen, setIsInternalTransitOpen] = useState(false);
  const [transitTargetSlot, setTransitTargetSlot] = useState<'main' | 'top' | 'bottom' | 'detail' | 'style' | 'scene' | 'pose'>('main');

  // 7 个 slot 的 fileResourceId(真实业务标识,后续任务创建请求用)
  const [mainFileResId, setMainFileResId] = useState<number | null>(null);
  const [topClothingFileResId, setTopClothingFileResId] = useState<number | null>(null);
  const [bottomClothingFileResId, setBottomClothingFileResId] = useState<number | null>(null);
  const [detailFileResId, setDetailFileResId] = useState<number | null>(null);
  const [styleFileResId, setStyleFileResId] = useState<number | null>(null);
  const [sceneFileResId, setSceneFileResId] = useState<number | null>(null);
  const [poseFileResId, setPoseFileResId] = useState<number | null>(null);

  const handleTransitConfirmSelection = (selectedFileResourceIds: number[]) => {
    if (selectedFileResourceIds.length === 0) return;
    const firstId = selectedFileResourceIds[0];

    switch (transitTargetSlot) {
      case 'main':
        // 主图:暂存 fileResourceId;UI 上保留 thumbnail 显示(由现有 selectedProduct.thumbnail)
        setMainFileResId(firstId);
        break;
      case 'top':
        setTopClothingFileResId(firstId);
        setTopClothingUploaded(true);
        break;
      case 'bottom':
        setBottomClothingFileResId(firstId);
        setBottomClothingUploaded(true);
        break;
      case 'detail':
        setDetailFileResId(firstId);
        setDetailRefUploaded(true);
        break;
      case 'style':
        setStyleFileResId(firstId);
        setStyleRefParsed(true);
        break;
      case 'scene':
        setSceneFileResId(firstId);
        setSceneRefUploaded(true);
        break;
      case 'pose':
        setPoseFileResId(firstId);
        setPoseRefUploaded(true);
        break;
    }
    setIsInternalTransitOpen(false);
  };

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
  const [generationType, setGenerationType] = useState<'main' | 'fitting' | 'detail' | 'triple'>('main');
  const [stylePreset, setStylePreset] = useState('甜美网红风 (Sweet Influencer)');
  const [aspectRatio, setAspectRatio] = useState<'3:4' | '1:1' | '16:9'>('3:4');
  const [batchCount, setBatchCount] = useState<number>(4);
  const [sceneOption, setSceneOption] = useState('室内影棚');
  const [poseOption, setPoseOption] = useState('站姿正面');
  const [modelChannel, setModelChannel] = useState<'runway' | 'vidu'>('runway');

  // Assembled Prompt state
  const [promptText, setPromptText] = useState('');

  // Local state for composite setup and mock reference images upload
  const [topClothingUploaded, setTopClothingUploaded] = useState(false);
  const [bottomClothingUploaded, setBottomClothingUploaded] = useState(false);
  const [hasCompositePreviewed, setHasCompositePreviewed] = useState(false);

  const [detailRefUploaded, setDetailRefUploaded] = useState(false);
  const [styleRefParsed, setStyleRefParsed] = useState(true);
  const [sceneRefUploaded, setSceneRefUploaded] = useState(false);
  const [poseRefUploaded, setPoseRefUploaded] = useState(false);

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

  // Handle Dynamic Prompt Assembly
  const assemblePrompt = () => {
    const activeConstraints: string[] = [];
    if (constrainColor) activeConstraints.push('颜色');
    if (constrainPattern) activeConstraints.push('图案');
    if (constrainLogo) activeConstraints.push('Logo');
    if (constrainFit) activeConstraints.push('版型');

    const constraintString = activeConstraints.length > 0 
      ? ` [保护特征: ${activeConstraints.join('、')}]` 
      : '';

    return `3D High-fidelity product photoshoot of "${productName}". Style: ${stylePreset}. Scene: ${sceneOption}, Pose: ${poseOption}. Aspect ratio: ${aspectRatio}. Product attributes: ${fabricTexture}, ${colorPattern}, ${fitStructure}. Selling points highlights: ${sellingPoints}. ${keyDetails}.${constraintString} --v 6.1 --ar ${aspectRatio}`;
  };

  // Re-assemble prompt when inputs change
  useEffect(() => {
    setPromptText(assemblePrompt());
  }, [
    productName,
    sellingPoints,
    productCategory,
    colorPattern,
    fitStructure,
    fabricTexture,
    keyDetails,
    constrainColor,
    constrainPattern,
    constrainLogo,
    constrainFit,
    stylePreset,
    aspectRatio,
    sceneOption,
    poseOption
  ]);

  // Reset to Global Template
  const handleResetToTemplate = () => {
    setStylePreset('甜美网红风 (Sweet Influencer)');
    setAspectRatio('3:4');
    setSceneOption('室内影棚');
    setPoseOption('站姿正面');
    setConstrainColor(true);
    setConstrainPattern(true);
    setConstrainLogo(false);
    setConstrainFit(false);
  };

  // Apply AI optimization to current prompt
  const handleAIOptimize = () => {
    setPromptText(prev => {
      return `(Cinematic backlight, photorealistic studio render) ` + prev.replace(' --v 6.1', ', raytracing reflections, cinematic color grading, warm ambient glow --v 6.1');
    });
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
    if (!topClothingUploaded || !bottomClothingUploaded) {
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

  const handleSubmitTask = () => {
    const newTask: GenerationTask = {
      id: `T-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`,
      name: `图片生成任务_${productName.split(' ')[0]}_${new Date().getMonth() + 1}${new Date().getDate()}`,
      type: 'image',
      status: 'running',
      progress: 0,
      productName: productName,
      productImg: selectedProduct.thumbnail,
      templateName: stylePreset,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      creator: '陆永奇',
      modelChannel: modelChannel === 'runway' ? 'Runway Gen-V' : 'Vidu 极速版',
      params: {
        ratio: aspectRatio,
        steps: 35,
        guidance: 7.5,
        prompt: promptText,
        negativePrompt: 'blurry, bad quality, distorted'
      }
    };

    onAddTask(newTask);
    setScreen(AppScreen.TASKS);

    // Simulate render progress in background
    let progressValue = 0;
    const interval = setInterval(() => {
      progressValue += 20;
      if (progressValue >= 100) {
        clearInterval(interval);
        onAddTask({
          ...newTask,
          status: 'completed',
          progress: 100,
          resultUrl: selectedProduct.thumbnail
        });
      } else {
        onAddTask({
          ...newTask,
          progress: progressValue
        });
      }
    }, 1000);
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
            <div 
              onClick={() => {
                setTransitTargetSlot('main');
                setIsInternalTransitOpen(true);
              }}
              className="relative border-2 border-dashed border-blue-250 rounded-xl p-5 bg-blue-50/50 flex flex-col items-center justify-center text-center hover:bg-blue-50 transition-colors cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center mb-2.5 shadow-xs group-hover:shadow text-blue-500 transition-shadow">
                <span className="material-symbols-outlined text-xl">cloud_upload</span>
              </div>
              <div className="text-blue-600 font-bold text-xs lg:text-sm mb-1">
                点击上传图片打开资源中心
              </div>
              <div className="text-[10px] lg:text-xs text-slate-400 leading-relaxed max-w-[240px]">
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
                  <div 
                    onClick={() => {
                      setTransitTargetSlot('top');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      topClothingUploaded ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {topClothingUploaded ? (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1 text-blue-500">check_circle</span>
                        <span className="text-[9px] lg:text-[10px] font-bold">已添加上衣</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1">checkroom</span>
                        <span className="text-[9px] lg:text-[10px]">添加上衣</span>
                      </>
                    )}
                  </div>

                  <div className="text-slate-300 text-lg font-bold">+</div>

                  {/* Bottom slot */}
                  <div 
                    onClick={() => {
                      setTransitTargetSlot('bottom');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      bottomClothingUploaded ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {bottomClothingUploaded ? (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1 text-blue-500">check_circle</span>
                        <span className="text-[9px] lg:text-[10px] font-bold">已添加下装</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1">accessibility_new</span>
                        <span className="text-[9px] lg:text-[10px]">添加下装</span>
                      </>
                    )}
                  </div>

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
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('detail');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center cursor-pointer mb-1 transition-all ${
                      detailRefUploaded ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{detailRefUploaded ? 'check' : '+'}</span>
                  </button>
                  <span className={`text-[10px] font-medium ${detailRefUploaded ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>细节</span>
                </div>

                {/* Slot 2: Style */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('style');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border rounded-lg flex flex-col relative overflow-hidden cursor-pointer mb-1 shadow-xs transition-all ${
                      styleRefParsed ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <div className={`flex-1 flex items-center justify-center ${styleRefParsed ? 'text-blue-500' : 'text-slate-400'}`}>
                      <span className="material-symbols-outlined text-xl">palette</span>
                    </div>
                    {styleRefParsed && (
                      <div className="bg-blue-500 text-white text-[8px] text-center py-[2px] absolute bottom-0 w-full font-bold">
                        已解析
                      </div>
                    )}
                  </button>
                  <span className={`text-[10px] font-medium ${styleRefParsed ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>风格</span>
                </div>

                {/* Slot 3: Scene */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('scene');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center cursor-pointer mb-1 transition-all ${
                      sceneRefUploaded ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{sceneRefUploaded ? 'check' : '+'}</span>
                  </button>
                  <span className={`text-[10px] font-medium ${sceneRefUploaded ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>场景</span>
                </div>

                {/* Slot 4: Pose */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('pose');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center cursor-pointer mb-1 transition-all ${
                      poseRefUploaded ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{poseRefUploaded ? 'check' : '+'}</span>
                  </button>
                  <span className={`text-[10px] font-medium ${poseRefUploaded ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>姿势</span>
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
          
          {/* Params Header sticky */}
          <div className="px-5 py-4 flex items-center bg-white border-b border-slate-200 sticky top-0 z-10">
            <span className="material-symbols-outlined text-blue-600 mr-2 text-xl font-bold">settings</span>
            <h2 className="text-sm lg:text-base font-bold text-slate-800">任务参数</h2>
          </div>

          <div className="p-5 space-y-5">
            
            {/* 1. 生成类型 */}
            <div>
              <label className="block text-xs lg:text-sm font-bold text-slate-700 mb-2">生成类型</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setGenerationType('main')}
                  className={`flex items-center justify-center py-2 px-2.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    generationType === 'main'
                      ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1">image</span>
                  主图/场景
                </button>
                <button 
                  onClick={() => setGenerationType('fitting')}
                  className={`flex items-center justify-center py-2 px-2.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    generationType === 'fitting'
                      ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1">accessibility</span>
                  上身试衣
                </button>
                <button 
                  onClick={() => setGenerationType('detail')}
                  className={`flex items-center justify-center py-2 px-2.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    generationType === 'detail'
                      ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1">zoom_in</span>
                  细节特写
                </button>
                <button 
                  onClick={() => setGenerationType('triple')}
                  className={`flex items-center justify-center py-2 px-2.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    generationType === 'triple'
                      ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1">360</span>
                  三视图
                </button>
              </div>
            </div>

            {/* 2. 风格预设 */}
            <div>
              <label className="block text-xs lg:text-sm font-bold text-slate-700 mb-2">风格预设</label>
              <div className="relative">
                <select 
                  className="block w-full h-10 pl-3 pr-10 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none font-bold cursor-pointer"
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value)}
                >
                  <option value="甜美网红风 (Sweet Influencer)">甜美网红风 (Sweet Influencer)</option>
                  <option value="极简北欧风 (Minimalist Nordic)">极简北欧风 (Minimalist Nordic)</option>
                  <option value="科技赛博风 (Cyberpunk Cyber)">科技赛博风 (Cyberpunk Cyber)</option>
                  <option value="金秋自然风 (Autumn Natural)">金秋自然风 (Autumn Natural)</option>
                  <option value="奢华丝绸风 (Elegant Silk Satin)">奢华丝绸风 (Elegant Silk Satin)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <span className="material-symbols-outlined text-sm font-bold">expand_more</span>
                </div>
              </div>
            </div>

            {/* 3. 比例 & 张数 */}
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-xs lg:text-sm font-bold text-slate-700 mb-2">比例</label>
                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                  {(['3:4', '1:1', '16:9'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        aspectRatio === ratio
                          ? 'bg-white shadow-xs text-blue-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-20 lg:w-24">
                <label className="block text-xs lg:text-sm font-bold text-slate-700 mb-2">张数</label>
                <input 
                  className="block w-full h-10 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 text-center font-bold focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  max="10"
                  min="1"
                  type="number"
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            {/* 4. 场景 & 动作 */}
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-xs lg:text-sm font-bold text-slate-700 mb-2">场景</label>
                <div className="relative">
                  <select 
                    className="block w-full h-10 pl-3 pr-8 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none font-bold cursor-pointer"
                    value={sceneOption}
                    onChange={(e) => setSceneOption(e.target.value)}
                  >
                    <option value="室内影棚">室内影棚</option>
                    <option value="海边礁石">海边礁石</option>
                    <option value="大理石展台">大理石展台</option>
                    <option value="赛博网格">赛博网格</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <span className="material-symbols-outlined text-sm font-bold">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-xs lg:text-sm font-bold text-slate-700 mb-2">动作/姿势</label>
                <div className="relative">
                  <select 
                    className="block w-full h-10 pl-3 pr-8 border border-slate-200 rounded-lg text-xs lg:text-sm text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none font-bold cursor-pointer"
                    value={poseOption}
                    onChange={(e) => setPoseOption(e.target.value)}
                  >
                    <option value="站姿正面">站姿正面</option>
                    <option value="侧身侧视">侧身侧视</option>
                    <option value="优雅俯坐">优雅俯坐</option>
                    <option value="动态慢行">动态慢行</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <span className="material-symbols-outlined text-sm font-bold">expand_more</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 底层模型通道 */}
            <div>
              <label className="block text-xs lg:text-sm font-bold text-slate-700 mb-2">底层模型通道</label>
              <div className="space-y-3">
                {/* Model 1 (Selected) */}
                <label 
                  onClick={() => setModelChannel('runway')}
                  className={`flex items-start p-3 border rounded-xl cursor-pointer relative transition-all ${
                    modelChannel === 'runway' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center h-5">
                    <input 
                      checked={modelChannel === 'runway'}
                      onChange={() => setModelChannel('runway')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-slate-300"
                      name="model"
                      type="radio"
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs lg:text-sm font-bold text-slate-900">Runway Gen-V</span>
                      <span className="bg-blue-500 text-white text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-md font-bold">推荐</span>
                    </div>
                    <p className="text-[10px] lg:text-xs text-slate-400 font-medium">高保真，适合质感服饰</p>
                  </div>
                </label>

                {/* Model 2 */}
                <label 
                  onClick={() => setModelChannel('vidu')}
                  className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${
                    modelChannel === 'vidu' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center h-5">
                    <input 
                      checked={modelChannel === 'vidu'}
                      onChange={() => setModelChannel('vidu')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-slate-300"
                      name="model"
                      type="radio"
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="block text-xs lg:text-sm font-bold text-slate-900 mb-0.5">Vidu 极速版</span>
                    <p className="text-[10px] lg:text-xs text-slate-400 font-medium">生成快，适合网红风格</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1 min-h-[20px]" />

            {/* 6. Prompt 编辑器 Widget */}
            <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50/80 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <span className="material-symbols-outlined text-slate-500 mr-1.5 text-lg font-bold">integration_instructions</span>
                    <div>
                      <h3 className="text-xs lg:text-sm font-bold text-slate-800">Prompt 编辑器</h3>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1.5">
                    <button 
                      onClick={handleAIOptimize}
                      className="bg-blue-600 text-white hover:bg-blue-700 text-[10px] px-2.5 py-1 rounded-md font-bold flex items-center shadow-xs cursor-pointer transition-all active:scale-97"
                    >
                      <span className="material-symbols-outlined text-[11px] mr-1 font-bold">auto_awesome</span>
                      AI 建议
                    </button>
                    <button 
                      onClick={handleResetToTemplate}
                      className="text-blue-600 text-[10px] hover:underline font-bold bg-transparent border-0 cursor-pointer"
                    >
                      重新套用全局模板
                    </button>
                  </div>
                </div>
                <div className="text-[9px] lg:text-[10px] text-slate-400 mt-2 font-mono">
                  全局模板版本: v2.1 | 任务级 Prompt 副本
                </div>
              </div>
              <div className="p-3">
                <textarea 
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full text-[11px] font-mono leading-relaxed text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 outline-none resize-none min-h-[120px] focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20"
                />
              </div>
            </div>

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

      {isInternalTransitOpen && (
        <AssetTransitModal
          purpose="PRODUCT"
          productId={selectedProduct?.id ? Number(selectedProduct.id) : undefined}
          onClose={() => setIsInternalTransitOpen(false)}
          onConfirmSelection={handleTransitConfirmSelection}
          targetSlot={transitTargetSlot}
        />
      )}

    </div>
  );
};
