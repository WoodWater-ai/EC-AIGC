import React, { useState, useMemo } from 'react';
import { ProductAsset, AppScreen } from '../types';
import {
  Grid,
  List,
  Search,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Plus,
  ArrowUpDown,
  ExternalLink,
  Sparkles,
  Settings,
  X,
  Star,
  RefreshCw,
  FolderOpen,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  AlertCircle,
  FileCheck,
  Package,
  Clock,
  MoreVertical,
  SlidersHorizontal,
  Play
} from 'lucide-react';

interface ProductAssetLibraryProps {
  products: ProductAsset[];
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  setScreen: (screen: AppScreen) => void;
}

// Highly realistic generated asset data structure
interface GeneratedAsset {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  type: '图片' | '视频';
  taskType: string;
  style: string;
  scene: string;
  ratioDuration: string;
  channel: string;
  status: '已通过' | '待审核' | '废弃';
  score: number | null;
  promptVersion: string;
  cost: number;
  addedTime: string;
  thumbnail: string;
  size?: string;
}

export const ProductAssetLibrary: React.FC<ProductAssetLibraryProps> = ({
  products,
  selectedProduct,
  setSelectedProduct,
  isDrawerOpen,
  setIsDrawerOpen,
  setScreen
}) => {
  // 1. View mode: 'card' (商品卡片视图), 'grid' (素材网格视图), 'table' (表格视图)
  const [viewMode, setViewMode] = useState<'card' | 'grid' | 'table'>('table');

  // 2. Local states for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部品类');
  const [selectedAssetType, setSelectedAssetType] = useState<'全部' | '图片' | '视频' | '废弃'>('全部');
  const [selectedTaskType, setSelectedTaskType] = useState('全部任务');
  const [selectedStyle, setSelectedStyle] = useState('全部风格');
  const [selectedScene, setSelectedScene] = useState('全部场景');
  const [selectedChannel, setSelectedChannel] = useState('全部模型通道');
  const [selectedStatus, setSelectedStatus] = useState('全部状态');
  const [creationTimeRange, setCreationTimeRange] = useState('不限时间');

  // Sorting
  const [sortBy, setSortBy] = useState<'latest' | 'score' | 'cost'>('latest');

  // Drawer configurations
  // We have two types of drawers depending on which mode is selected:
  // - "product_drawer" (opened when viewMode is 'card' and a product card is clicked)
  // - "asset_drawer" (opened when viewMode is 'grid' or 'table' and an asset is clicked)
  const [drawerType, setDrawerType] = useState<'product' | 'asset'>('asset');
  const [activeAssetId, setActiveAssetId] = useState<string>('a1');
  const [productDrawerTab, setProductDrawerTab] = useState<'overview' | 'input' | 'images' | 'videos' | 'reviews' | 'costs'>('overview');
  const [assetDrawerTab, setAssetDrawerTab] = useState<'overview' | 'source' | 'audit' | 'costs'>('overview');

  // Expanded costs detail panel toggle inside Asset Drawer
  const [costCollapse, setCostCollapse] = useState(true);

  // Checkbox states for batch operations in Table View
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [onlyShowPending, setOnlyShowPending] = useState(false);

  // Rich, realistic mock assets for the generated grid & table
  const generatedAssets: GeneratedAsset[] = useMemo(() => [
    {
      id: 'a1',
      productId: 'p2', // Nike Air Max (mapped to 跑鞋 Phantom X for design match)
      productName: '跑鞋 Phantom X',
      sku: 'PROD-883920',
      category: '运动鞋',
      type: '图片',
      taskType: '主图',
      style: '运动风',
      scene: '白底图',
      ratioDuration: '3:4 · 1024x1365',
      channel: 'Stable Diffusion',
      status: '已通过',
      score: 92,
      promptVersion: 'V2.4',
      cost: 12.40,
      addedTime: '2023-10-25 14:28',
      thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
      size: '1.9 MB'
    },
    {
      id: 'a2',
      productId: 'p2',
      productName: '跑鞋 Phantom X',
      sku: 'PROD-883920',
      category: '运动鞋',
      type: '视频',
      taskType: '运动展示',
      style: '运动风',
      scene: '室内影棚',
      ratioDuration: '15s · 9:16 · 1080p',
      channel: 'Vidu 极速版',
      status: '已通过',
      score: 88,
      promptVersion: 'V2.4',
      cost: 42.00,
      addedTime: '2023-10-25 14:30',
      thumbnail: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=400&q=80',
      size: '42.5 MB'
    },
    {
      id: 'a3',
      productId: 'p4', // Light knitwear / cardigan
      productName: '复古针织开衫',
      sku: 'PROD-772311',
      category: '女装',
      type: '图片',
      taskType: '主图',
      style: '复古风',
      scene: '白底图',
      ratioDuration: '3:4 · 1024x1365',
      channel: 'SDXL 1.0',
      status: '已通过',
      score: 90,
      promptVersion: 'V2.3',
      cost: 12.40,
      addedTime: '2023-10-25 13:15',
      thumbnail: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=400&q=80',
      size: '2.1 MB'
    },
    {
      id: 'a4',
      productId: 'p3', // Makeup or dress floral
      productName: '碎花连衣裙',
      sku: 'PROD-661122',
      category: '女装',
      type: '图片',
      taskType: '场景图',
      style: '清新风',
      scene: '花园',
      ratioDuration: '3:4 · 1024x1365',
      channel: 'Midjourney v6',
      status: '待审核',
      score: null,
      promptVersion: 'V2.4',
      cost: 12.40,
      addedTime: '2023-10-25 12:50',
      thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=400&q=80',
      size: '3.3 MB'
    },
    {
      id: 'a5',
      productId: 'p1', // Smart watch
      productName: '智能运动手表 V3',
      sku: 'PROD-554433',
      category: '数码配件',
      type: '图片',
      taskType: '主图',
      style: '科技风',
      scene: '白底图',
      ratioDuration: '3:4 · 1024x1365',
      channel: 'SDXL 1.0',
      status: '已通过',
      score: 85,
      promptVersion: 'V2.3',
      cost: 12.40,
      addedTime: '2023-10-25 11:30',
      thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
      size: '1.8 MB'
    },
    {
      id: 'a6',
      productId: 'p1',
      productName: '智能运动手表 V3',
      sku: 'PROD-554433',
      category: '数码配件',
      type: '视频',
      taskType: '功能展示',
      style: '科技风',
      scene: '办公室',
      ratioDuration: '15s · 9:16 · 1080p',
      channel: 'Runway Gen-V',
      status: '已通过',
      score: 86,
      promptVersion: 'V2.4',
      cost: 42.00,
      addedTime: '2023-10-25 11:28',
      thumbnail: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=400&q=80',
      size: '38.0 MB'
    },
    {
      id: 'a7',
      productId: 'p4',
      productName: '轻薄羽绒服',
      sku: 'PROD-339912',
      category: '女装',
      type: '图片',
      taskType: '主图',
      style: '简约风',
      scene: '白底图',
      ratioDuration: '3:4 · 1024x1365',
      channel: 'Stable Diffusion',
      status: '废弃',
      score: null,
      promptVersion: 'V2.2',
      cost: 0.00,
      addedTime: '2023-10-25 10:20',
      thumbnail: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=400&q=80',
      size: '2.4 MB'
    },
    {
      id: 'a8',
      productId: 'p4',
      productName: '简约托特包',
      sku: 'PROD-229811',
      category: '箱包',
      type: '图片',
      taskType: '主图',
      style: '简约风',
      scene: '白底图',
      ratioDuration: '3:4 · 1024x1365',
      channel: 'Midjourney v6',
      status: '已通过',
      score: 83,
      promptVersion: 'V2.3',
      cost: 12.40,
      addedTime: '2023-10-24 16:45',
      thumbnail: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=400&q=80',
      size: '2.2 MB'
    },
    {
      id: 'a9',
      productId: 'p2',
      productName: '跑鞋 Phantom X',
      sku: 'PROD-883920',
      category: '运动鞋',
      type: '视频',
      taskType: '街头穿搭',
      style: '运动风',
      scene: '街头',
      ratioDuration: '15s · 9:16 · 1080p',
      channel: 'Pika 1.0',
      status: '待审核',
      score: null,
      promptVersion: 'V2.3',
      cost: 42.00,
      addedTime: '2023-10-24 15:50',
      thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
      size: '41.1 MB'
    },
    {
      id: 'a10',
      productId: 'p2',
      productName: '篮球专业版',
      sku: 'PROD-118733',
      category: '运动器材',
      type: '图片',
      taskType: '主图',
      style: '运动风',
      scene: '白底图',
      ratioDuration: '1:1 · 1024x1024',
      channel: 'SDXL 1.0',
      status: '已通过',
      score: 87,
      promptVersion: 'V2.3',
      cost: 12.40,
      addedTime: '2023-10-24 15:20',
      thumbnail: 'https://images.unsplash.com/photo-1483168527879-c66136b56105?auto=format&fit=crop&w=400&q=80',
      size: '1.2 MB'
    }
  ], []);

  // Filtered Assets list based on selected controls
  const filteredAssets = useMemo(() => {
    return generatedAssets.filter(asset => {
      // 1. Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = asset.productName.toLowerCase().includes(q);
        const matchesSku = asset.sku.toLowerCase().includes(q);
        if (!matchesName && !matchesSku) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== '全部品类') {
        if (asset.category !== selectedCategory) return false;
      }

      // 3. Asset Type Filter (from subtabs & segmented controls)
      if (selectedAssetType === '图片' && asset.type !== '图片') return false;
      if (selectedAssetType === '视频' && asset.type !== '视频') return false;
      if (selectedAssetType === '废弃' && asset.status !== '废弃') return false;

      // 4. Task Type Filter
      if (selectedTaskType !== '全部任务' && asset.taskType !== selectedTaskType) return false;

      // 5. Style Filter
      if (selectedStyle !== '全部风格' && asset.style !== selectedStyle) return false;

      // 6. Scene Filter
      if (selectedScene !== '全部场景' && asset.scene !== selectedScene) return false;

      // 7. Channel Filter
      if (selectedChannel !== '全部模型通道' && asset.channel !== selectedChannel) return false;

      // 8. Status Filter
      if (selectedStatus !== '全部状态') {
        if (selectedStatus === '已通过' && asset.status !== '已通过') return false;
        if (selectedStatus === '待审核' && asset.status !== '待审核') return false;
        if (selectedStatus === '废弃' && asset.status !== '废弃') return false;
      }

      // 9. Batch Filter Option
      if (onlyShowPending && asset.status !== '待审核') return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'score') {
        return (b.score || 0) - (a.score || 0);
      }
      if (sortBy === 'cost') {
        return b.cost - a.cost;
      }
      return b.addedTime.localeCompare(a.addedTime); // Default: latest
    });
  }, [generatedAssets, searchQuery, selectedCategory, selectedAssetType, selectedTaskType, selectedStyle, selectedScene, selectedChannel, selectedStatus, onlyShowPending, sortBy]);

  // Selected Active Asset model
  const activeAsset = useMemo(() => {
    return generatedAssets.find(a => a.id === activeAssetId) || generatedAssets[0];
  }, [generatedAssets, activeAssetId]);

  // Handle asset click
  const handleSelectAsset = (assetId: string) => {
    setActiveAssetId(assetId);
    setDrawerType('asset');
    setIsDrawerOpen(true);
  };

  // Toggle single checkboxes
  const handleToggleSelectAsset = (assetId: string) => {
    setSelectedAssetIds(prev =>
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  // Toggle select all
  const handleToggleSelectAll = () => {
    const visibleIds = filteredAssets.map(a => a.id);
    const allSelected = visibleIds.every(id => selectedAssetIds.includes(id));
    if (allSelected) {
      setSelectedAssetIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedAssetIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  return (
    <div className="space-y-6 relative min-h-screen bg-slate-50/50 pb-12" id="asset-library-container">
      
      {/* 1. Header & Sub-header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-[#0B1C30] tracking-tight flex items-center gap-2">
            商品素材库
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            以商品为单位管理输入素材、生成图片、生成视频、审核记录和成本
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setScreen(AppScreen.CREATE_IMAGE_TASK);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        </div>
      </div>

      {/* 2. Top Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">商品资产数</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">1,248</span>
              <span className="text-[10px] font-semibold text-emerald-500">+12% ↑</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">图片归档数</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">8,592</span>
              <span className="text-[10px] font-semibold text-emerald-500">+5% ↑</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <VideoIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">视频归档数</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">426</span>
              <span className="text-[10px] font-semibold text-emerald-500">+18% ↑</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">待审核素材</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">138</span>
              <span className="text-[10px] font-semibold text-emerald-500">+3% ↑</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Star className="w-5 h-5 text-purple-500 fill-purple-100" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">高分素材数 (&gt;85)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">3,104</span>
              <span className="text-[10px] font-semibold text-emerald-500">+2% ↑</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">废弃素材数</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">1,824</span>
              <span className="text-[10px] font-semibold text-rose-500">-4% ↓</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filters Section */}
      <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-xs space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">搜索商品名/ID</label>
            <div className="relative">
              <input
                type="text"
                placeholder="输入商品名称或ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 pl-9 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-700"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">品类</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="全部品类">全部品类</option>
              <option value="运动鞋">运动鞋</option>
              <option value="女装">女装</option>
              <option value="数码配件">数码配件</option>
              <option value="箱包">箱包</option>
              <option value="运动器材">运动器材</option>
              <option value="男装">男装</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">素材类型</label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              {(['全部', '图片', '视频', '废弃'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedAssetType(t)}
                  className={`flex-1 text-center py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    selectedAssetType === t
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">任务类型</label>
            <select
              value={selectedTaskType}
              onChange={(e) => setSelectedTaskType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="全部任务">全部任务</option>
              <option value="主图">主图</option>
              <option value="场景图">场景图</option>
              <option value="细节图">细节图</option>
              <option value="运动展示">运动展示</option>
              <option value="功能展示">功能展示</option>
              <option value="街头穿搭">街头穿搭</option>
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-1 border-t border-slate-100">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">风格</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="全部风格">全部风格</option>
              <option value="运动风">运动风</option>
              <option value="复古风">复古风</option>
              <option value="清新风">清新风</option>
              <option value="科技风">科技风</option>
              <option value="简约风">简约风</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">场景</label>
            <select
              value={selectedScene}
              onChange={(e) => setSelectedScene(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="全部场景">全部场景</option>
              <option value="白底图">白底图</option>
              <option value="室内影棚">室内影棚</option>
              <option value="花园">花园</option>
              <option value="办公室">办公室</option>
              <option value="街头">街头</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">模型通道</label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="全部模型通道">全部模型通道</option>
              <option value="Stable Diffusion">Stable Diffusion</option>
              <option value="Vidu 极速版">Vidu 极速版</option>
              <option value="SDXL 1.0">SDXL 1.0</option>
              <option value="Midjourney v6">Midjourney v6</option>
              <option value="Runway Gen-V">Runway Gen-V</option>
              <option value="Pika 1.0">Pika 1.0</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">归档状态</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="全部状态">全部状态</option>
              <option value="已通过">已通过</option>
              <option value="待审核">待审核</option>
              <option value="废弃">废弃</option>
            </select>
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 block mb-1">创建时间</label>
            <div className="flex bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700 items-center justify-between cursor-pointer">
              <span className="truncate">{creationTimeRange}</span>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Layout Switching Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-2">
        {/* Left Subtabs */}
        <div className="flex items-center gap-2">
          {viewMode === 'table' ? (
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1 transition-all">
                批量导出
                <ChevronDown className="w-3 h-3" />
              </button>
              <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all">
                批量归档
              </button>
              <button
                onClick={() => setOnlyShowPending(prev => !prev)}
                className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition-all border ${
                  onlyShowPending
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                仅看待审核
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              {(['全部', '图片', '视频', '废弃'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedAssetType(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    selectedAssetType === t
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs font-bold text-slate-700">
              近期活跃商品
            </div>
          )}
        </div>

        {/* View Selection Segment (Matches Mock perfectly) */}
        <div className="flex items-center gap-4 ml-auto">
          {viewMode === 'grid' && (
            <span className="text-[11px] text-slate-400 font-medium">共 12,846 个素材</span>
          )}

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            <button
              onClick={() => {
                setViewMode('card');
                setDrawerType('product');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              商品卡片视图
            </button>
            <button
              onClick={() => {
                setViewMode('grid');
                setDrawerType('asset');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              素材网格视图
            </button>
            <button
              onClick={() => {
                setViewMode('table');
                setDrawerType('asset');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              表格视图
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1 text-slate-600 font-semibold"
            >
              <option value="latest">最近更新</option>
              <option value="score">最高评分</option>
              <option value="cost">最大成本</option>
            </select>
            <button className="p-1 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Central Views Block */}
      <div className="grid grid-cols-1 gap-5">
        
        {/* VIEW 1: 表格视图 (Table View - Matches Screenshot 1) */}
        {viewMode === 'table' && (
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredAssets.length > 0 && filteredAssets.every(a => selectedAssetIds.includes(a.id))}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-3 px-3">商品/素材</th>
                    <th className="py-3 px-3">商品名称</th>
                    <th className="py-3 px-3">品类</th>
                    <th className="py-3 px-3">素材类型</th>
                    <th className="py-3 px-3">任务类型</th>
                    <th className="py-3 px-3">风格</th>
                    <th className="py-3 px-3">场景</th>
                    <th className="py-3 px-3">比例/时长</th>
                    <th className="py-3 px-3">模型通道</th>
                    <th className="py-3 px-3">审核状态</th>
                    <th className="py-3 px-3">评分</th>
                    <th className="py-3 px-3">Prompt 版本</th>
                    <th className="py-3 px-3">成本</th>
                    <th className="py-3 px-3">创建时间</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="text-center py-10 text-slate-400 font-medium">
                        暂无符合筛选条件的素材资产
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => {
                      const isSelected = selectedAssetIds.includes(asset.id);
                      const isHighlighted = activeAssetId === asset.id && isDrawerOpen && drawerType === 'asset';
                      return (
                        <tr
                          key={asset.id}
                          className={`hover:bg-slate-50/50 transition-colors ${
                            isHighlighted ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-100' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectAsset(asset.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="w-10 h-10 rounded overflow-hidden bg-slate-50 border border-slate-200/60 relative shrink-0">
                              <img
                                src={asset.thumbnail}
                                alt={asset.productName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {asset.type === '视频' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <Play className="w-3 h-3 text-white fill-white" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            <div>{asset.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {asset.sku}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{asset.category}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              asset.type === '图片'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              {asset.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-medium">{asset.taskType}</td>
                          <td className="py-3 px-3 text-slate-500">{asset.style}</td>
                          <td className="py-3 px-3 text-slate-500">{asset.scene}</td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{asset.ratioDuration}</td>
                          <td className="py-3 px-3 font-medium text-slate-600">{asset.channel}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              asset.status === '已通过'
                                ? 'bg-emerald-50 text-emerald-600'
                                : asset.status === '待审核'
                                ? 'bg-amber-50 text-amber-600 animate-pulse'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {asset.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold font-mono text-slate-700">
                            {asset.score !== null ? asset.score : '—'}
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{asset.promptVersion}</td>
                          <td className="py-3 px-3 font-bold font-mono text-slate-700">
                            {asset.cost > 0 ? `¥ ${asset.cost.toFixed(2)}` : '¥0.00'}
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-400">{asset.addedTime}</td>
                          <td className="py-3 px-4 text-right space-x-2 shrink-0">
                            <button
                              onClick={() => handleSelectAsset(asset.id)}
                              className="text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer"
                            >
                              查看详情
                            </button>
                            <button className="text-slate-400 hover:text-slate-600 cursor-pointer">
                              下载
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 select-none">
              <div>
                共 1,248 条
              </div>
              <div className="flex items-center gap-1.5">
                <button className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all">
                  &lt;
                </button>
                <button className="w-7 h-7 bg-blue-600 text-white font-bold rounded flex items-center justify-center">
                  1
                </button>
                <button className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all">
                  2
                </button>
                <button className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all">
                  3
                </button>
                <button className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all">
                  4
                </button>
                <button className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all">
                  5
                </button>
                <span className="px-1 text-slate-400">...</span>
                <button className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all">
                  63
                </button>
                <button className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all">
                  &gt;
                </button>

                <select className="bg-white border border-slate-200 text-slate-600 rounded py-0.5 px-1.5 font-semibold text-xs ml-2">
                  <option>20 条/页</option>
                  <option>50 条/页</option>
                </select>
                <span className="ml-1.5">跳转至</span>
                <input type="text" defaultValue="1" className="w-8 text-center border border-slate-200 bg-white text-slate-700 py-0.5 rounded text-xs" />
                <span>页</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: 商品卡片视图 (Product Card View - Matches Screenshot 2) */}
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => {
              // Map mock data properties cleanly or use defaults
              const isSelected = selectedProduct.id === p.id && isDrawerOpen && drawerType === 'product';
              const latestStatus = p.id === 'p1' ? '生成中' : p.id === 'p3' ? '审核中' : '已通过';
              const cumulativeCost = p.id === 'p1' ? '86.20' : p.id === 'p2' ? '112.40' : p.id === 'p3' ? '68.30' : '54.60';
              const topScore = p.id === 'p1' ? '88分' : p.id === 'p2' ? '92分' : p.id === 'p3' ? '90分' : '85分';

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProduct(p);
                    setDrawerType('product');
                    setProductDrawerTab('overview');
                    setIsDrawerOpen(true);
                  }}
                  className={`group bg-white rounded-xl border cursor-pointer overflow-hidden transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-500 shadow-md ring-2 ring-blue-500/10'
                      : 'border-slate-200/60 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Select indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center z-10">
                      <Check className="w-3 h-3 text-white stroke-[3px]" />
                    </div>
                  )}

                  {/* Visual Preview */}
                  <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden border-b border-slate-100">
                    <img
                      src={p.thumbnail}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white backdrop-blur-xs text-[9px] font-bold px-2 py-0.5 rounded-sm">
                      {p.category}
                    </span>
                  </div>

                  {/* Information Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm truncate">{p.name}</h4>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {p.sku}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-slate-50/70 p-1.5 rounded-lg border border-slate-100 mt-3 text-center text-[10px] text-slate-500">
                      <div>
                        <div className="font-bold text-slate-700 text-xs">{p.id === 'p1' ? 18 : p.id === 'p2' ? 32 : 24}</div>
                        <div>通过图片</div>
                      </div>
                      <div className="border-x border-slate-150">
                        <div className="font-bold text-slate-700 text-xs">{p.id === 'p1' ? 2 : p.id === 'p2' ? 5 : 3}</div>
                        <div>通过视频</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-700 text-xs">{p.id === 'p1' ? 6 : p.id === 'p2' ? 9 : 5}</div>
                        <div>废弃素材</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-3 mt-3 border-t border-slate-100 text-slate-400 font-semibold">
                      <span>最高评分 <span className="text-amber-500 font-bold">{topScore}</span></span>
                      <span>最新状态 <span className={`font-bold ${latestStatus === '生成中' ? 'text-blue-500' : latestStatus === '审核中' ? 'text-amber-500' : 'text-emerald-500'}`}>● {latestStatus}</span></span>
                      <span>累计成本 <span className="text-slate-800 font-bold font-mono">¥ {cumulativeCost}</span></span>
                    </div>

                    <div className="text-[9px] text-slate-300 font-mono mt-2 text-right">
                      更新时间: 2023-10-25 14:30
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 3: 素材网格视图 (Asset Grid View - Matches Screenshot 3) */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAssets.map((asset) => {
              const isSelected = activeAssetId === asset.id && isDrawerOpen && drawerType === 'asset';
              return (
                <div
                  key={asset.id}
                  onClick={() => handleSelectAsset(asset.id)}
                  className={`group bg-white rounded-xl border cursor-pointer overflow-hidden transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-500 shadow-md ring-2 ring-blue-500/10'
                      : 'border-slate-200/60 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* File Type badge overlay */}
                  <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10 ${
                    asset.type === '图片'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {asset.type}
                  </span>

                  {/* Thumbnail */}
                  <div className="aspect-square bg-slate-50 relative overflow-hidden border-b border-slate-100">
                    <img
                      src={asset.thumbnail}
                      alt={asset.productName}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />

                    {/* Play Overlay for Video */}
                    {asset.type === '视频' && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer transition-all">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        {/* Video timing info bar */}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white py-1 px-2 flex items-center justify-between text-[9px] font-semibold font-mono">
                          <span>15s</span>
                          <span>9:16</span>
                          <span>1080p</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Content Details */}
                  <div className="p-3.5 space-y-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs truncate">{asset.productName}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{asset.taskType} | {asset.ratioDuration.split('·')[0]}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                        <span className="font-bold text-slate-700 font-mono">{asset.score !== null ? `${asset.score}分` : '待审'}</span>
                      </div>
                      <span className={`font-bold ${
                        asset.status === '已通过'
                          ? 'text-emerald-500'
                          : asset.status === '待审核'
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}>
                        ● {asset.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold pt-1">
                      <span className="truncate max-w-[80px]">{asset.channel}</span>
                      <span className="text-slate-700 font-bold font-mono">¥ {asset.cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. SLIDING DETAILS SIDEBAR / DRAWERS */}
      {isDrawerOpen && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 bg-black/10 backdrop-blur-xs z-40 transition-opacity" onClick={() => setIsDrawerOpen(false)} />

          {/* Drawer Wrapper */}
          <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col justify-between animate-slideInRight overflow-hidden" id="drawer-panel">
            
            {/* ---------------- DRAW_TYPE 1: PRODUCT_DETAILS_DRAWER (Matches Screenshot 2 Side panel) ---------------- */}
            {drawerType === 'product' && (
              <div className="flex-1 flex flex-col justify-between h-full">
                
                {/* Header Info */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/60">
                      <img src={selectedProduct.thumbnail} alt={selectedProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#0B1C30] flex items-center gap-1.5">
                        {selectedProduct.name}
                        <span className="material-symbols-outlined text-[14px] text-slate-400 font-semibold">more_horiz</span>
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>ID: {selectedProduct.sku}</span>
                        <span>{selectedProduct.category}</span>
                        <span>白底图</span>
                        <span className="px-1 bg-blue-50 text-blue-600 font-bold rounded-sm text-[8px]">生成中</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs selection (Matches Screenshot 2 tabs) */}
                <div className="flex border-b border-slate-100 bg-white px-2">
                  {[
                    { id: 'overview', label: '概览' },
                    { id: 'input', label: '输入素材' },
                    { id: 'images', label: '生成图片' },
                    { id: 'videos', label: '生成视频' },
                    { id: 'reviews', label: '审核记录' },
                    { id: 'costs', label: '成本记录' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setProductDrawerTab(tab.id as any)}
                      className={`flex-1 text-center py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        productDrawerTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-600">
                  {productDrawerTab === 'overview' && (
                    <div className="space-y-5 animate-fadeIn">
                      
                      {/* Grid Stats Block */}
                      <div className="grid grid-cols-5 gap-2 text-center bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-base font-bold text-slate-800 font-mono">1</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">商品原图</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">0</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">合成套图</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">18</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">通过图片</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">2</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">通过视频</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">6</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">废弃素材</p>
                        </div>
                      </div>

                      {/* Prompt and Total Cost indicator */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 border border-slate-150 rounded-lg p-3">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">最新 Prompt</span>
                          <span className="font-bold text-slate-700 block mt-1">V2.4 · SDXL 1.0</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-150 rounded-lg p-3">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">总成本</span>
                          <span className="font-extrabold text-rose-500 block text-sm mt-1">¥ 86.20</span>
                        </div>
                      </div>

                      {/* 输入素材 Grid */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 flex items-center justify-between text-xs">
                          <span>输入素材</span>
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="border border-slate-100 rounded-lg overflow-hidden bg-white p-1 relative">
                            <img src={selectedProduct.thumbnail} className="w-full h-16 object-cover rounded" referrerPolicy="no-referrer" />
                            <div className="text-[9px] text-slate-400 mt-1 text-center font-semibold">商品原图</div>
                          </div>
                          <div className="border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center h-[90px] bg-slate-50/50">
                            <span className="material-symbols-outlined text-slate-300 text-lg">image</span>
                            <span className="text-[9px] text-slate-300 font-semibold mt-1">暂无</span>
                            <div className="text-[8px] text-slate-300">合成套图</div>
                          </div>
                          <div className="border border-slate-100 rounded-lg overflow-hidden bg-white p-1 relative">
                            <img src="https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=400&q=80" className="w-full h-16 object-cover rounded" referrerPolicy="no-referrer" />
                            <div className="text-[9px] text-slate-400 mt-1 text-center font-semibold">细节图</div>
                          </div>
                          <div className="border border-slate-100 rounded-lg overflow-hidden bg-white p-1 relative">
                            <img src="https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=400&q=80" className="w-full h-16 object-cover rounded" referrerPolicy="no-referrer" />
                            <div className="text-[9px] text-slate-400 mt-1 text-center font-semibold">风格参考</div>
                          </div>
                          <div className="border border-slate-100 rounded-lg overflow-hidden bg-white p-1 relative">
                            <img src="https://images.unsplash.com/photo-1483168527879-c66136b56105?auto=format&fit=crop&w=400&q=80" className="w-full h-16 object-cover rounded" referrerPolicy="no-referrer" />
                            <div className="text-[9px] text-slate-400 mt-1 text-center font-semibold">场景参考</div>
                          </div>
                          <div className="border border-slate-100 rounded-lg overflow-hidden bg-white p-1 relative">
                            <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80" className="w-full h-16 object-cover rounded" referrerPolicy="no-referrer" />
                            <div className="text-[9px] text-slate-400 mt-1 text-center font-semibold">姿势参考</div>
                          </div>
                        </div>
                      </div>

                      {/* 视频素材(通过) banner */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-700">视频素材 (通过)</h4>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded text-[8px]">已通过</span>
                        </div>
                        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-900 relative aspect-video flex items-center justify-center">
                          <img src={selectedProduct.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                          <div className="w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer z-10 transition-all border border-white/20">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                          <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                            <span className="px-1.5 py-0.5 bg-black/70 text-white rounded font-bold font-mono text-[8px]">15s</span>
                            <span className="px-1.5 py-0.5 bg-black/70 text-white rounded font-bold font-mono text-[8px]">9:16</span>
                            <span className="px-1.5 py-0.5 bg-black/70 text-white rounded font-bold font-mono text-[8px]">1080p</span>
                          </div>
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                            <span className="text-[9px] text-white/90 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                              来源图片 <img src={selectedProduct.thumbnail} className="w-3 h-3 rounded-full object-cover inline" referrerPolicy="no-referrer" />
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 最新生产任务 & 审核评分 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-2xs space-y-2">
                          <h4 className="font-bold text-slate-700">最新生产任务</h4>
                          <div>
                            <p className="font-bold text-[#0B1C30]">Task-20231025-001</p>
                            <p className="text-[10px] text-slate-400 mt-1">生成时间: 2023-10-25 14:28</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            生成中
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-2xs flex flex-col justify-between">
                          <h4 className="font-bold text-slate-700">审核评分</h4>
                          <div>
                            <div className="text-lg font-black text-slate-800 flex items-baseline gap-1">
                              88分
                              <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1 rounded">较上次 +3</span>
                            </div>
                            <div className="flex text-amber-500 mt-0.5">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <Star className="w-3.5 h-3.5 text-amber-200" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Model channel & Cost breakdown details */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700">模型通道</h4>
                        <div className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 font-semibold text-slate-700">
                          Stable Diffusion
                        </div>
                      </div>

                      <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4.5 space-y-2">
                        <h4 className="font-bold text-slate-700 pb-1.5 border-b border-slate-200/80">成本明细</h4>
                        <div className="space-y-2 pt-1 font-mono text-[11px] text-slate-500">
                          <div className="flex justify-between">
                            <span>图片生成 (18张)</span>
                            <span className="font-bold text-slate-700">¥ 12.40</span>
                          </div>
                          <div className="flex justify-between">
                            <span>视频生成 (2条)</span>
                            <span className="font-bold text-slate-700">¥ 73.80</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold border-t border-slate-200 pt-2 text-rose-500">
                            <span>合计</span>
                            <span>¥ 86.20</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {productDrawerTab !== 'overview' && (
                    <div className="py-12 text-center text-slate-400 animate-fadeIn">
                      <FolderOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      当前商品标签页 [{(['概览', '输入素材', '生成图片', '生成视频', '审核记录', '成本记录'] as any).find((x: any) => x === productDrawerTab) || '其它'}] 深度关联数据已同步归档。
                    </div>
                  )}
                </div>

                {/* Bottom Buttons inside product drawer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button
                    onClick={() => {
                      setViewMode('grid');
                      setIsDrawerOpen(false);
                    }}
                    className="flex-1 py-2.5 border border-slate-200 text-xs text-slate-500 font-bold hover:bg-slate-100 rounded-lg cursor-pointer transition-all text-center"
                  >
                    查看全部素材
                  </button>
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setScreen(AppScreen.CREATE_IMAGE_TASK);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 rounded-lg cursor-pointer transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI 重新生成
                  </button>
                </div>

              </div>
            )}

            {/* ---------------- DRAW_TYPE 2: ASSET_DETAILS_DRAWER (Matches Screenshot 1 / 3 Side Panel) ---------------- */}
            {drawerType === 'asset' && (
              <div className="flex-1 flex flex-col justify-between h-full">
                
                {/* Header Info */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/60 shrink-0">
                      <img src={activeAsset.thumbnail} alt={activeAsset.productName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#0B1C30] flex items-center gap-1.5">
                        {activeAsset.productName} / {activeAsset.type === '视频' ? '视频素材' : '图片素材'}
                        <span className="material-symbols-outlined text-[14px] text-slate-400 font-semibold">more_horiz</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 font-mono mt-0.5">
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold rounded-sm text-[8px]">{activeAsset.type}</span>
                        {activeAsset.type === '视频' && (
                          <>
                            <span className="px-1 bg-slate-100 rounded-sm text-slate-500">15s</span>
                            <span className="px-1 bg-slate-100 rounded-sm text-slate-500">9:16</span>
                            <span className="px-1 bg-slate-100 rounded-sm text-slate-500">1080p</span>
                          </>
                        )}
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded-sm text-[8px]">已通过</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab select headings (Matches Screenshot 1 / 3) */}
                <div className="flex border-b border-slate-100 bg-white px-4 pt-1">
                  {[
                    { id: 'overview', label: '概览' },
                    { id: 'source', label: '来源' },
                    { id: 'audit', label: '审核' },
                    { id: 'costs', label: '成本' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setAssetDrawerTab(tab.id as any)}
                      className={`flex-1 text-center py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        assetDrawerTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab details - Scrollable */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-600">
                  {assetDrawerTab === 'overview' && (
                    <div className="space-y-5 animate-fadeIn">
                      
                      {/* Media Player block */}
                      <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-900 relative aspect-video flex items-center justify-center">
                        <img src={activeAsset.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                        <div className="w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer z-10 transition-all border border-white/20 shadow-lg">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                        {activeAsset.type === '视频' && (
                          <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                            <span className="px-1.5 py-0.5 bg-black/70 text-white rounded font-bold font-mono text-[8px]">15s</span>
                            <span className="px-1.5 py-0.5 bg-black/70 text-white rounded font-bold font-mono text-[8px]">9:16</span>
                            <span className="px-1.5 py-0.5 bg-black/70 text-white rounded font-bold font-mono text-[8px]">1080p</span>
                          </div>
                        )}
                      </div>

                      {/* Detail Key-Value Rows */}
                      <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4.5 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">来源图片</span>
                          <span className="font-bold text-blue-600 flex items-center gap-1">
                            IMG-001
                            <ExternalLink className="w-3.5 h-3.5" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">商品 ID</span>
                          <span className="font-mono font-bold text-slate-800">{activeAsset.sku}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">任务 ID</span>
                          <span className="font-mono font-bold text-slate-800">TASK-V-102</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">Prompt 版本</span>
                          <span className="font-mono font-bold text-slate-800">V2.4 · SDXL 1.0</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">模型通道</span>
                          <span className="font-bold text-slate-700">{activeAsset.channel}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">审核评分</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1 font-mono">
                            {activeAsset.score || 88} 分
                            <span className="flex text-amber-500">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <Star className="w-3 h-3 fill-transparent text-slate-300" />
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">审核结果</span>
                          <span className="font-bold text-emerald-500">已通过</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">成本</span>
                          <span className="font-bold font-mono text-slate-800">¥ {activeAsset.cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">创建时间</span>
                          <span className="font-mono text-slate-500">2023-10-25 14:30:25</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">更新时间</span>
                          <span className="font-mono text-slate-500">2023-10-25 14:30:30</span>
                        </div>
                      </div>

                      {/* Collapsible Panel: 成本明细 */}
                      <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <div
                          onClick={() => setCostCollapse(!costCollapse)}
                          className="p-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between cursor-pointer text-slate-700 font-bold"
                        >
                          <span>成本明细</span>
                          {costCollapse ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </div>
                        {!costCollapse && (
                          <div className="p-4 font-mono text-[11px] text-slate-500 space-y-2 bg-white animate-slideDown">
                            <div className="flex justify-between">
                              <span>视频生成 (15s)</span>
                              <span className="font-bold text-slate-700">¥ {activeAsset.cost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-xs text-rose-500 pt-2 border-t border-slate-100 mt-2">
                              <span>总计</span>
                              <span>¥ {activeAsset.cost.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {assetDrawerTab !== 'overview' && (
                    <div className="py-12 text-center text-slate-400 animate-fadeIn">
                      <FolderOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      当前素材标签页 [{(['概览', '来源', '审核', '成本'] as any).find((x: any) => x === assetDrawerTab) || '其它'}] 深度关联数据已同步归档。
                    </div>
                  )}
                </div>

                {/* Bottom Buttons inside asset drawer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <button className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-2xs">
                      <Eye className="w-3.5 h-3.5" />
                      预览
                    </button>
                    <button className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-2xs">
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </button>
                    <button className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-2xs">
                      查看商品
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setScreen(AppScreen.CREATE_IMAGE_TASK);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 rounded-lg cursor-pointer transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI 重新生成
                  </button>
                </div>

              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
};
