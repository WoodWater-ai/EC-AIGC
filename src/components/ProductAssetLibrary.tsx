import React, { useEffect, useState, useMemo } from 'react';
import { ProductAsset, AppScreen } from '../types';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import {
  productLibraryApi,
  type ProductLibraryAsset,
  type ProductLibraryDisplayStatus,
  type ProductLibraryProduct,
  type ProductLibraryReview,
} from '../api/modules/productLibrary';
import { toast } from 'sonner';
import { withCosThumbnail } from '../utils/cosImage';
import { ImagePreviewModal } from './ImagePreviewModal';
import { VideoPreviewModal, type PreviewVideo } from './VideoPreviewModal';
import { useAuth } from '../auth/AuthContext';
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
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  setScreen: (screen: AppScreen) => void;
}

// Highly realistic generated asset data structure
interface GeneratedAsset {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  productId: string;
  productName: string;
  sku: string;
  category: string;
  type: '图片' | '视频';
  taskType: string;
  style: string;
  scene: string;
  action: string;
  ratioDuration: string;
  channel: string;
  modelName: string;
  status: '生成中' | '生成失败' | '待审美评分' | '已归档' | '审核通过' | '已打回';
  rawStatus?: string;
  score: number | null;
  promptVersion: string;
  cost: number;
  addedTime: string;
  thumbnail: string;
  url: string;
  size?: string;
}

const InputAssetMedia: React.FC<{
  file: ProductAsset['files'][number];
  compact?: boolean;
  onPreview: () => void;
}> = ({ file, compact = false, onPreview }) => (
  <button
    type="button"
    onClick={onPreview}
    className={`relative block w-full overflow-hidden rounded bg-slate-50 ${compact ? 'h-16' : 'h-32'}`}
    title={file.type === 'video' ? '点击播放视频' : '点击查看图片'}
  >
    {file.type === 'video' ? (
      <>
        <video
          src={file.url}
          poster={file.thumbnailUrl}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/10">
          <span className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} grid place-items-center rounded-full bg-black/60 text-white shadow-md`}>
            <Play className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ml-0.5 fill-white`} />
          </span>
        </span>
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-bold text-white">
          视频
        </span>
      </>
    ) : (
      <img
        src={file.thumbnailUrl || file.url}
        alt={file.name}
        className="h-full w-full object-contain"
        referrerPolicy="no-referrer"
      />
    )}
  </button>
);

const STATUS_LABELS: Record<ProductLibraryDisplayStatus, GeneratedAsset['status']> = {
  GENERATING: '生成中',
  FAILED: '生成失败',
  PENDING_REVIEW_SCORE: '待审美评分',
  PASSED: '审核通过',
  ARCHIVED: '已归档',
  REJECTED: '已打回',
};

const displayStatusOf = (asset: ProductLibraryAsset): ProductLibraryDisplayStatus =>
  asset.rawStatus === 'ARCHIVED' || asset.rawStatus === '已归档'
    ? 'ARCHIVED'
    : asset.status;

const TASK_TYPE_LABELS: Record<string, string> = {
  PRODUCT_MAIN: '商品主图',
  SCENE_DETAIL: '场景图',
  DETAIL_SCENE: '场景图',
  DETAIL_CLOSEUP: '细节图',
  DETAIL: '细节图',
  MODEL_TRIPLE_VIEW: '三视图',
  ON_MODEL: '三视图',
  VIDEO: '视频任务',
  IMAGE: '图片任务',
};

const taskTypeLabel = (asset: ProductLibraryAsset) => {
  const code = asset.imageType || asset.taskType || '';
  if (TASK_TYPE_LABELS[code]) return TASK_TYPE_LABELS[code];
  if (/[\u4e00-\u9fff]/.test(code)) return code;
  return asset.mediaType === 'VIDEO' ? '视频任务' : '图片任务';
};

const EMPTY_ASSET: GeneratedAsset = {
  id: '',
  mediaType: 'IMAGE',
  productId: '',
  productName: '暂无素材',
  sku: '—',
  category: '—',
  type: '图片',
  taskType: '—',
  style: '—',
  scene: '—',
  action: '—',
  ratioDuration: '—',
  channel: '—',
  modelName: '—',
  status: '生成中',
  score: null,
  promptVersion: '—',
  cost: 0,
  addedTime: '—',
  thumbnail: '',
  url: '',
};

const statusClass = (status: GeneratedAsset['status']) => {
  if (status === '审核通过') return 'bg-emerald-50 text-emerald-600';
  if (status === '已归档') return 'bg-slate-200 text-slate-500';
  if (status === '待审美评分') return 'bg-amber-50 text-amber-600';
  if (status === '生成中') return 'bg-blue-50 text-blue-600';
  return 'bg-rose-50 text-rose-600';
};

const toGeneratedAsset = (asset: ProductLibraryAsset): GeneratedAsset => ({
  id: asset.id,
  mediaType: asset.mediaType,
  productId: asset.productId ?? '',
  productName: asset.productName || '未命名商品',
  sku: asset.taskCode || asset.productId || '—',
  category: asset.productCategory || '未分类',
  type: asset.mediaType === 'VIDEO' ? '视频' : '图片',
  taskType: taskTypeLabel(asset),
  style: asset.style || '—',
  scene: asset.scene || '—',
  action: asset.action || '—',
  ratioDuration: asset.mediaType === 'VIDEO'
    ? [asset.durationSec ? `${asset.durationSec}s` : '', asset.aspectRatio, asset.width && asset.height ? `${asset.width}x${asset.height}` : ''].filter(Boolean).join(' · ')
    : [asset.aspectRatio, asset.width && asset.height ? `${asset.width}x${asset.height}` : ''].filter(Boolean).join(' · '),
  channel: asset.modelChannelName || asset.channelType || '—',
  modelName: asset.modelCode || '—',
  status: STATUS_LABELS[displayStatusOf(asset)],
  rawStatus: asset.rawStatus,
  score: asset.score ?? null,
  promptVersion: asset.promptVersion || '—',
  cost: asset.cost ?? 0,
  addedTime: asset.createTime?.replace('T', ' ').slice(0, 16) || '—',
  thumbnail: withCosThumbnail(asset.thumbnailUrl || asset.url, 480) || asset.thumbnailUrl || asset.url,
  url: asset.url,
  size: asset.width && asset.height ? `${asset.width} × ${asset.height}` : undefined,
});

const toProductAsset = (product: ProductLibraryProduct): ProductAsset => ({
  id: product.id,
  name: product.name,
  sku: product.id,
  category: (product.category || '智能硬件') as ProductAsset['category'],
  imageCount: product.imageCount,
  videoCount: product.videoCount,
  thumbnail: withCosThumbnail(product.imageUrl, 640) || product.imageUrl || '',
  addedTime: product.createTime?.replace('T', ' ').slice(0, 16) || '—',
  specs: {
    brand: '',
    color: product.color ? [product.color] : [],
    material: product.material || '',
    weight: '',
    sellingPoints: product.sellingPoints
      ? product.sellingPoints.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean)
      : [],
  },
  files: [],
  fabric: product.material,
  costDetails: {
    totalCost: String(product.totalCost ?? 0),
    avgCostPerPass: product.passedCount
      ? String((product.totalCost / product.passedCount).toFixed(2))
      : '0',
  },
});

export const ProductAssetLibrary: React.FC<ProductAssetLibraryProps> = ({
  selectedProduct,
  setSelectedProduct,
  isDrawerOpen,
  setIsDrawerOpen,
  setScreen
}) => {
  const { hasPermission } = useAuth();
  const canCreateTask = hasPermission('task:create');
  const canArchive = hasPermission('asset:archive');
  const canExport = hasPermission('asset:export');
  const canDownload = hasPermission('asset:download');
  // 1. View mode: 'card' (商品卡片视图), 'grid' (素材网格视图), 'table' (表格视图)
  const [viewMode, setViewMode] = useState<'card' | 'grid' | 'table'>('table');

  // 2. Local states for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部品类');
  const [selectedAssetType, setSelectedAssetType] = useState<'全部' | '图片' | '视频' | '已归档' | '已打回'>('全部');
  const [selectedTaskType, setSelectedTaskType] = useState('全部任务');
  const [selectedStyle, setSelectedStyle] = useState('全部风格');
  const [selectedScene, setSelectedScene] = useState('全部场景');
  const [selectedChannel, setSelectedChannel] = useState('全部模型通道');
  const [selectedStatus, setSelectedStatus] = useState('全部状态');
  const [creationTimeRange, setCreationTimeRange] = useState('不限时间');
  const [assetPageNum, setAssetPageNum] = useState(1);
  const [assetPageSize, setAssetPageSize] = useState(20);
  const [productPageNum, setProductPageNum] = useState(1);

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
  const [drawerProductAssets, setDrawerProductAssets] = useState<GeneratedAsset[]>([]);
  const [drawerProductReviews, setDrawerProductReviews] = useState<ProductLibraryReview[]>([]);
  const [loadedAssetDetail, setLoadedAssetDetail] = useState<ProductLibraryAsset | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ videos: PreviewVideo[]; initialIndex: number } | null>(null);

  // Expanded costs detail panel toggle inside Asset Drawer
  const [costCollapse, setCostCollapse] = useState(true);

  // Checkbox states for batch operations in Table View
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [onlyShowPending, setOnlyShowPending] = useState(false);
  const apiStatus: ProductLibraryDisplayStatus | undefined =
    selectedAssetType === '已归档' ? 'ARCHIVED'
    : selectedAssetType === '已打回' ? 'REJECTED'
    : onlyShowPending ? 'PENDING_REVIEW_SCORE'
    : selectedStatus === '生成中' ? 'GENERATING'
      : selectedStatus === '生成失败' ? 'FAILED'
        : selectedStatus === '待审美评分' ? 'PENDING_REVIEW_SCORE'
          : selectedStatus === '审核通过' ? 'PASSED'
            : selectedStatus === '已打回' ? 'REJECTED'
              : undefined;
  const creationStartTime = useMemo(() => {
    const days = creationTimeRange === '近7天' ? 7
      : creationTimeRange === '近30天' ? 30
        : creationTimeRange === '近90天' ? 90
          : 0;
    if (!days) return undefined;
    const date = new Date();
    date.setDate(date.getDate() - days);
    return String(date.getTime());
  }, [creationTimeRange]);

  const statisticsQuery = useServiceQuery(() => productLibraryApi.statistics(), []);
  const productPageQuery = useServiceQuery(
    () => productLibraryApi.productPage({
      pageNum: productPageNum,
      pageSize: 20,
      keyword: searchQuery || undefined,
      category: selectedCategory === '全部品类' ? undefined : selectedCategory,
      sortBy,
    }),
    [productPageNum, searchQuery, selectedCategory, sortBy],
  );
  const assetPageQuery = useServiceQuery(
    () => productLibraryApi.assetPage({
      pageNum: assetPageNum,
      pageSize: assetPageSize,
      keyword: searchQuery || undefined,
      mediaType: selectedAssetType === '图片' ? 'IMAGE' : selectedAssetType === '视频' ? 'VIDEO' : undefined,
      // [2026-08-25] 后端过滤:已归档/已打回 tab 显式传 status;默认视图传 excludeArchived=true
      excludeArchived: selectedAssetType === '全部',
      taskType: selectedTaskType === '全部任务' ? undefined : selectedTaskType,
      style: selectedStyle === '全部风格' ? undefined : selectedStyle,
      scene: selectedScene === '全部场景' ? undefined : selectedScene,
      channelType: selectedChannel === '全部模型通道' ? undefined : selectedChannel,
      status: apiStatus,
      startTime: creationStartTime,
      sortBy,
    }),
    [
      searchQuery,
      assetPageNum,
      assetPageSize,
      selectedAssetType,
      selectedTaskType,
      selectedStyle,
      selectedScene,
      selectedChannel,
      apiStatus,
      creationStartTime,
      sortBy,
    ],
  );

  const products = useMemo(
    () => productPageQuery.data?.list.map(toProductAsset) ?? [],
    [productPageQuery.data],
  );
  const statistics = statisticsQuery.data;
  const productSummaries = useMemo(
    () => new Map((productPageQuery.data?.list ?? []).map((product) => [product.id, product])),
    [productPageQuery.data],
  );
  const categories = useMemo(
    () => ['全部品类', ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))],
    [products],
  );

  useEffect(() => {
    setAssetPageNum(1);
    setProductPageNum(1);
  }, [
    searchQuery,
    selectedAssetType,
    selectedTaskType,
    selectedStyle,
    selectedScene,
    selectedChannel,
    selectedStatus,
    selectedCategory,
    onlyShowPending,
    sortBy,
  ]);

  useEffect(() => {
    if (!productPageQuery.data || products.length === 0) return;
    if (!products.some((product) => product.id === selectedProduct.id)) {
      setSelectedProduct(products[0]);
    }
  }, [productPageQuery.data, products, selectedProduct.id, setSelectedProduct]);

  useEffect(() => {
    if (!isDrawerOpen || drawerType !== 'product' || !selectedProduct.id) return;
    setDrawerProductAssets([]);
    setDrawerProductReviews([]);
    let active = true;
    productLibraryApi.productDetail(selectedProduct.id)
      .then((detail) => {
        if (!active) return;
        const base = toProductAsset(detail);
        setDrawerProductAssets([...detail.generatedImages, ...detail.generatedVideos]
          .map(toGeneratedAsset)
          .sort((left, right) => right.addedTime.localeCompare(left.addedTime)));
        setDrawerProductReviews(detail.reviews ?? []);
        setSelectedProduct({
          ...base,
          files: detail.inputAssets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            url: asset.url,
            thumbnailUrl: asset.mediaType === 'VIDEO'
              ? (asset.thumbnailUrl
                  ? withCosThumbnail(asset.thumbnailUrl, 480) || asset.thumbnailUrl
                  : undefined)
              : withCosThumbnail(asset.thumbnailUrl || asset.url, 480) || asset.thumbnailUrl || asset.url,
            size: asset.fileSize ? `${(asset.fileSize / 1024 / 1024).toFixed(2)} MB` : '—',
            type: asset.mediaType === 'VIDEO' ? 'video' : 'image',
          })),
          originalImages: detail.inputAssets
            .filter((asset) => asset.mediaType === 'IMAGE')
            .map((asset) => ({
              name: asset.name,
              url: withCosThumbnail(asset.thumbnailUrl || asset.url, 480) || asset.thumbnailUrl || asset.url,
            })),
          passedImages: detail.generatedImages
            .filter((asset) => asset.status === 'ARCHIVED')
            .map((asset) => ({
              id: asset.id,
              url: withCosThumbnail(asset.thumbnailUrl || asset.url, 480) || asset.thumbnailUrl || asset.url,
              date: asset.createTime || '',
              score: asset.score || 0,
            })),
          passedVideos: detail.generatedVideos
            .filter((asset) => asset.status === 'ARCHIVED')
            .map((asset) => ({
              id: asset.id,
              url: asset.url,
              date: asset.createTime || '',
              coverUrl: withCosThumbnail(asset.thumbnailUrl || asset.url, 480) || asset.thumbnailUrl || asset.url,
            })),
          abandonedImages: detail.generatedImages
            .filter((asset) => asset.status === 'REJECTED' || asset.rawStatus === 'ARCHIVED')
            .map((asset) => ({
              id: asset.id,
              url: withCosThumbnail(asset.thumbnailUrl || asset.url, 480) || asset.thumbnailUrl || asset.url,
              reason: asset.rejectReason || '已归档',
            })),
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isDrawerOpen, drawerType, selectedProduct.id, setSelectedProduct]);

  const handleArchiveSelected = async () => {
    if (!canArchive) return;
    const assets = generatedAssets
      .filter((asset) => selectedAssetIds.includes(asset.id))
      .map((asset) => ({ id: asset.id, mediaType: asset.mediaType }));
    if (assets.length === 0) {
      toast.warning('请先选择需要归档的素材');
      return;
    }
    const affected = await productLibraryApi.archiveBatch(assets);
    toast.success(`已归档 ${affected} 个素材`);
    setSelectedAssetIds([]);
    assetPageQuery.refetch();
    statisticsQuery.refetch();
    productPageQuery.refetch();
  };

  const generatedAssets = useMemo(
    () => assetPageQuery.data?.list.map(toGeneratedAsset) ?? [],
    [assetPageQuery.data],
  );
  const taskTypeOptions = useMemo(
    () => Array.from(new Set(generatedAssets.map((asset) => asset.taskType).filter((value) => value !== '—'))),
    [generatedAssets],
  );
  const styleOptions = useMemo(
    () => Array.from(new Set(generatedAssets.map((asset) => asset.style).filter((value) => value !== '—'))),
    [generatedAssets],
  );
  const sceneOptions = useMemo(
    () => Array.from(new Set(generatedAssets.map((asset) => asset.scene).filter((value) => value !== '—'))),
    [generatedAssets],
  );
  const channelOptions = useMemo(
    () => Array.from(new Set(generatedAssets.map((asset) => asset.channel).filter((value) => value !== '—'))),
    [generatedAssets],
  );

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

      if (selectedCategory !== '全部品类' && asset.category !== selectedCategory) return false;

      // 2. Asset Type Filter (from subtabs & segmented controls)
      if (selectedAssetType === '图片' && asset.type !== '图片') return false;
      if (selectedAssetType === '视频' && asset.type !== '视频') return false;
      if (selectedAssetType === '已归档' && asset.status !== '已归档') return false;
      if (selectedAssetType === '已打回' && asset.status !== '已打回') return false;

      // [2026-08-25] 移除前端 ARCHIVED 默认排除;已交给后端 excludeArchived 参数(配合 tab 传 status)

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
        if (asset.status !== selectedStatus) return false;
      }

      // 9. Batch Filter Option
      if (onlyShowPending && asset.status !== '待审美评分') return false;

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
  const knownAssets = useMemo(
    () => [...drawerProductAssets, ...generatedAssets],
    [drawerProductAssets, generatedAssets],
  );
  const activeAsset = useMemo(() => {
    return knownAssets.find(a => a.id === activeAssetId) || generatedAssets[0] || EMPTY_ASSET;
  }, [knownAssets, generatedAssets, activeAssetId]);
  const activeAssetData = useMemo(
    () => (loadedAssetDetail?.id === activeAsset.id ? loadedAssetDetail : undefined)
      ?? assetPageQuery.data?.list.find((asset) => asset.id === activeAsset.id),
    [assetPageQuery.data, activeAsset.id, loadedAssetDetail],
  );
  const activeAssetProduct = products.find((product) => product.id === activeAsset.productId);
  const selectedProductSummary = productSummaries.get(selectedProduct.id);
  const selectedProductAssets = useMemo(
    () => drawerProductAssets.length > 0
      ? drawerProductAssets
      : generatedAssets.filter((asset) => asset.productId === selectedProduct.id),
    [drawerProductAssets, generatedAssets, selectedProduct.id],
  );
  const latestProductAsset = selectedProductAssets[0];

  useEffect(() => {
    if (!isDrawerOpen || drawerType !== 'asset' || !activeAsset.id) return;
    let active = true;
    productLibraryApi.assetDetail(activeAsset.mediaType, activeAsset.id)
      .then((detail) => {
        if (active) setLoadedAssetDetail(detail);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isDrawerOpen, drawerType, activeAsset.id, activeAsset.mediaType]);

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
          {canCreateTask && <button 
            onClick={() => {
              setScreen(AppScreen.CREATE_IMAGE_TASK);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新建任务
          </button>}
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
              <span className="text-lg font-extrabold text-slate-800 font-mono">{statistics?.productCount ?? 0}</span>
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
              <span className="text-lg font-extrabold text-slate-800 font-mono">{statistics?.imageCount ?? 0}</span>
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
              <span className="text-lg font-extrabold text-slate-800 font-mono">{statistics?.videoCount ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">待审美评分</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">{statistics?.pendingReviewCount ?? 0}</span>
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
              <span className="text-lg font-extrabold text-slate-800 font-mono">{statistics?.highScoreCount ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">归档素材数</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 font-mono">{statistics?.archivedCount ?? 0}</span>
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
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">素材类型</label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              {(['全部', '图片', '视频', '已归档', '已打回'] as const).map((t) => (
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
              {taskTypeOptions.map((taskType) => <option key={taskType} value={taskType}>{taskType}</option>)}
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
              {styleOptions.map((style) => <option key={style} value={style}>{style}</option>)}
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
              {sceneOptions.map((scene) => <option key={scene} value={scene}>{scene}</option>)}
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
              {channelOptions.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">任务状态</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="全部状态">全部状态</option>
              <option value="生成中">生成中</option>
              <option value="生成失败">生成失败</option>
              <option value="待审美评分">待审美评分</option>
              <option value="审核通过">审核通过</option>
              <option value="已打回">已打回</option>
            </select>
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 block mb-1">创建时间</label>
            <select
              value={creationTimeRange}
              onChange={(event) => setCreationTimeRange(event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700"
            >
              <option value="不限时间">不限时间</option>
              <option value="近7天">近7天</option>
              <option value="近30天">近30天</option>
              <option value="近90天">近90天</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Layout Switching Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-2">
        {/* Left Subtabs */}
        <div className="flex items-center gap-2">
          {viewMode === 'table' ? (
            <div className="flex gap-2">
              {canExport && <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1 transition-all">
                批量导出
                <ChevronDown className="w-3 h-3" />
              </button>}
              {canArchive && <button
                onClick={handleArchiveSelected}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all"
              >
                批量归档
              </button>}
              <button
                onClick={() => setOnlyShowPending(prev => !prev)}
                className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition-all border ${
                  onlyShowPending
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                仅看待审美评分
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              {(['全部', '图片', '视频', '已归档', '已打回'] as const).map((t) => (
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
            <span className="text-[11px] text-slate-400 font-medium">共 {assetPageQuery.data?.total ?? 0} 个素材</span>
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
        {(assetPageQuery.loading || productPageQuery.loading) && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            正在加载商品素材库真实数据…
          </div>
        )}
        {(assetPageQuery.error || productPageQuery.error || statisticsQuery.error) && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            商品素材库接口加载失败，请确认后端已启动并执行本次数据库/代码更新。
          </div>
        )}
        
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
                    <th className="py-3 px-3">姿势</th>
                    <th className="py-3 px-3">比例/时长</th>
                    <th className="py-3 px-3">模型通道</th>
                    <th className="py-3 px-3">模型名称</th>
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
                      <td colSpan={18} className="text-center py-10 text-slate-400 font-medium">
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
                            <button
                              type="button"
                              onClick={() => asset.mediaType === 'VIDEO'
                                ? setVideoPreview({
                                    videos: [{ url: asset.url, poster: asset.thumbnail, label: asset.productName }],
                                    initialIndex: 0,
                                  })
                                : setPreviewImageUrl(asset.url)}
                              className="w-10 h-10 rounded overflow-hidden bg-slate-50 border border-slate-200/60 relative shrink-0 p-0 block cursor-pointer transition-colors hover:border-primary"
                              title={asset.mediaType === 'VIDEO' ? '点击放大播放' : '点击查看大图'}
                            >
                              <img
                                src={asset.thumbnail}
                                alt={asset.productName}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                              {asset.type === '视频' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                  <Play className="w-3 h-3 text-white fill-white" />
                                </div>
                              )}
                            </button>
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
                          <td className="py-3 px-3 text-slate-500">{asset.action}</td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{asset.ratioDuration}</td>
                          <td className="py-3 px-3 font-medium text-slate-600">{asset.channel}</td>
                          <td className="py-3 px-3 font-mono text-[10px] font-medium text-slate-600">{asset.modelName}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusClass(asset.status)}`}>
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
                            <a
                              href={asset.url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              下载
                            </a>
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
                共 {assetPageQuery.data?.total ?? 0} 条
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={assetPageNum <= 1}
                  onClick={() => setAssetPageNum((page) => Math.max(1, page - 1))}
                  className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  &lt;
                </button>
                <button className="w-7 h-7 bg-blue-600 text-white font-bold rounded flex items-center justify-center">
                  {assetPageNum}
                </button>
                <span className="px-1 text-slate-400">/ {Math.max(assetPageQuery.data?.pages ?? 1, 1)}</span>
                <button
                  disabled={assetPageNum >= Math.max(assetPageQuery.data?.pages ?? 1, 1)}
                  onClick={() => setAssetPageNum((page) => page + 1)}
                  className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  &gt;
                </button>

                <select
                  value={assetPageSize}
                  onChange={(event) => {
                    setAssetPageSize(Number(event.target.value));
                    setAssetPageNum(1);
                  }}
                  className="bg-white border border-slate-200 text-slate-600 rounded py-0.5 px-1.5 font-semibold text-xs ml-2"
                >
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: 商品卡片视图 (Product Card View - Matches Screenshot 2) */}
        {viewMode === 'card' && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => {
              const isSelected = selectedProduct.id === p.id && isDrawerOpen && drawerType === 'product';
              const summary = productSummaries.get(p.id);
              const latestStatus = summary ? STATUS_LABELS[summary.latestStatus] : '生成中';
              const cumulativeCost = (summary?.totalCost ?? 0).toFixed(2);
              const topScore = summary?.highestScore == null ? '—' : `${summary.highestScore}分`;

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
                      className="w-full h-full object-contain group-hover:scale-103 transition-transform duration-300"
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
                        <div className="font-bold text-slate-700 text-xs">{summary?.passedCount ?? 0}</div>
                        <div>审核通过素材</div>
                      </div>
                      <div className="border-x border-slate-150">
                        <div className="font-bold text-slate-700 text-xs">{summary?.videoCount ?? 0}</div>
                        <div>生成视频</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-700 text-xs">{summary?.rejectedCount ?? 0}</div>
                        <div>已打回</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-3 mt-3 border-t border-slate-100 text-slate-400 font-semibold">
                      <span>最高评分 <span className="text-amber-500 font-bold">{topScore}</span></span>
                      <span>最新状态 <span className={`font-bold ${latestStatus === '生成中' ? 'text-blue-500' : latestStatus === '待审美评分' ? 'text-amber-500' : latestStatus === '审核通过' ? 'text-emerald-500' : 'text-rose-500'}`}>● {latestStatus}</span></span>
                      <span>累计成本 <span className="text-slate-800 font-bold font-mono">¥ {cumulativeCost}</span></span>
                    </div>

                    <div className="text-[9px] text-slate-300 font-mono mt-2 text-right">
                      更新时间: {summary?.latestGeneratedTime?.replace('T', ' ').slice(0, 16) || p.addedTime}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            <span>共 {productPageQuery.data?.total ?? 0} 个商品</span>
            <div className="flex items-center gap-2">
              <button
                disabled={productPageNum <= 1}
                onClick={() => setProductPageNum((page) => Math.max(1, page - 1))}
                className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40"
              >
                上一页
              </button>
              <span>{productPageNum} / {Math.max(productPageQuery.data?.pages ?? 1, 1)}</span>
              <button
                disabled={productPageNum >= Math.max(productPageQuery.data?.pages ?? 1, 1)}
                onClick={() => setProductPageNum((page) => page + 1)}
                className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
          </>
        )}

        {/* VIEW 3: 素材网格视图 (Asset Grid View - Matches Screenshot 3) */}
        {viewMode === 'grid' && (
          <>
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
                      className="w-full h-full object-contain group-hover:scale-103 transition-transform duration-300"
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
                          {asset.ratioDuration.split('·').map((value) => <span key={value}>{value.trim()}</span>)}
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
                        asset.status === '审核通过'
                          ? 'text-emerald-500'
                          : asset.status === '待审美评分'
                          ? 'text-amber-500'
                          : asset.status === '生成中'
                            ? 'text-blue-500'
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
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            <span>共 {assetPageQuery.data?.total ?? 0} 个素材</span>
            <div className="flex items-center gap-2">
              <button disabled={assetPageNum <= 1} onClick={() => setAssetPageNum((page) => Math.max(1, page - 1))} className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40">上一页</button>
              <span>{assetPageNum} / {Math.max(assetPageQuery.data?.pages ?? 1, 1)}</span>
              <button disabled={assetPageNum >= Math.max(assetPageQuery.data?.pages ?? 1, 1)} onClick={() => setAssetPageNum((page) => page + 1)} className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40">下一页</button>
            </div>
          </div>
          </>
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
                      <img src={selectedProduct.thumbnail} alt={selectedProduct.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
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
                          <p className="text-base font-bold text-slate-800 font-mono">{selectedProduct.files.length}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">商品原图</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">{selectedProduct.compositeImages?.length ?? 0}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">合成套图</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">{selectedProduct.passedImages?.length ?? 0}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">通过图片</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">{selectedProduct.passedVideos?.length ?? 0}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">通过视频</p>
                        </div>
                        <div className="border-l border-slate-150">
                          <p className="text-base font-bold text-slate-800 font-mono">{selectedProduct.abandonedImages?.length ?? 0}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">已打回/归档</p>
                        </div>
                      </div>

                      {/* Prompt and Total Cost indicator */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 border border-slate-150 rounded-lg p-3">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">最新 Prompt</span>
                          <span className="font-bold text-slate-700 block mt-1">
                            {latestProductAsset ? `${latestProductAsset.promptVersion} · ${latestProductAsset.channel}` : '暂无生成记录'}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-150 rounded-lg p-3">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">总成本</span>
                          <span className="font-extrabold text-rose-500 block text-sm mt-1">
                            ¥ {(selectedProductSummary?.totalCost ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* 输入素材 Grid */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-700 flex items-center justify-between text-xs">
                          <span>输入素材</span>
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedProduct.files.length > 0 ? selectedProduct.files.slice(0, 6).map((file) => (
                            <div key={file.id} className="border border-slate-100 rounded-lg overflow-hidden bg-white p-1 relative">
                              <InputAssetMedia
                                file={file}
                                compact
                                onPreview={() => file.type === 'video'
                                  ? setVideoPreview({
                                      videos: [{
                                        url: file.url,
                                        poster: file.thumbnailUrl,
                                        label: file.name,
                                      }],
                                      initialIndex: 0,
                                    })
                                  : setPreviewImageUrl(file.url)}
                              />
                              <div className="text-[9px] text-slate-400 mt-1 text-center font-semibold truncate">{file.name}</div>
                            </div>
                          )) : (
                            <div className="col-span-3 border border-dashed border-slate-200 rounded-lg flex items-center justify-center h-[90px] bg-slate-50/50 text-[10px] text-slate-400">
                              暂无已关联输入素材
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 视频素材(通过) banner */}
                      {selectedProduct.passedVideos?.[0] && <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-700">视频素材 (通过)</h4>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded text-[8px]">审核通过</span>
                        </div>
                        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-900 relative aspect-video flex items-center justify-center">
                          <img src={selectedProduct.passedVideos[0].coverUrl} className="absolute inset-0 w-full h-full object-contain opacity-60" referrerPolicy="no-referrer" />
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
                              商品 {selectedProduct.name}
                            </span>
                          </div>
                        </div>
                      </div>}

                      {/* 最新生产任务 & 审核评分 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-2xs space-y-2">
                          <h4 className="font-bold text-slate-700">最新生产任务</h4>
                          <div>
                            <p className="font-bold text-[#0B1C30]">{latestProductAsset?.sku ?? '暂无任务'}</p>
                            <p className="text-[10px] text-slate-400 mt-1">生成时间: {latestProductAsset?.addedTime ?? '—'}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            {latestProductAsset?.status ?? '暂无状态'}
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-2xs flex flex-col justify-between">
                          <h4 className="font-bold text-slate-700">审核评分</h4>
                          <div>
                            <div className="text-lg font-black text-slate-800 flex items-baseline gap-1">
                              {selectedProductSummary?.highestScore == null ? '—' : `${selectedProductSummary.highestScore}分`}
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
                          {latestProductAsset?.channel ?? '暂无通道信息'}
                        </div>
                      </div>

                      <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4.5 space-y-2">
                        <h4 className="font-bold text-slate-700 pb-1.5 border-b border-slate-200/80">成本明细</h4>
                        <div className="space-y-2 pt-1 font-mono text-[11px] text-slate-500">
                          <div className="flex justify-between">
                            <span>图片生成 ({selectedProduct.imageCount}张)</span>
                            <span className="font-bold text-slate-700">按单个结果成本汇总</span>
                          </div>
                          <div className="flex justify-between">
                            <span>视频生成 ({selectedProduct.videoCount}条)</span>
                            <span className="font-bold text-slate-700">按单个结果成本汇总</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold border-t border-slate-200 pt-2 text-rose-500">
                            <span>合计</span>
                            <span>¥ {(selectedProductSummary?.totalCost ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {productDrawerTab !== 'overview' && (
                    <div className="animate-fadeIn">
                      {productDrawerTab === 'input' && (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedProduct.files.map((file) => (
                            <div key={file.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <InputAssetMedia
                                file={file}
                                onPreview={() => file.type === 'video'
                                  ? setVideoPreview({
                                      videos: [{
                                        url: file.url,
                                        poster: file.thumbnailUrl,
                                        label: file.name,
                                      }],
                                      initialIndex: 0,
                                    })
                                  : setPreviewImageUrl(file.url)}
                              />
                              <div className="mt-2 truncate font-bold text-slate-700">{file.name}</div>
                              <div className="text-[10px] text-slate-400">{file.size}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {productDrawerTab === 'images' && (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedProductAssets.filter((asset) => asset.type === '图片').map((asset) => (
                            <button key={asset.id} onClick={() => handleSelectAsset(asset.id)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
                              <img src={asset.thumbnail} className="h-36 w-full object-contain" referrerPolicy="no-referrer" />
                              <div className="mt-2 flex items-center justify-between">
                                <span className="truncate font-bold text-slate-700">{asset.taskType}</span>
                                <span className={asset.status === '审核通过' ? 'text-emerald-600' : asset.status === '待审美评分' ? 'text-amber-600' : 'text-rose-600'}>{asset.status}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {productDrawerTab === 'videos' && (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedProductAssets.filter((asset) => asset.type === '视频').map((asset) => (
                            <button key={asset.id} onClick={() => handleSelectAsset(asset.id)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
                              <img src={asset.thumbnail} className="h-32 w-full object-contain" referrerPolicy="no-referrer" />
                              <div className="mt-2 font-bold text-slate-700">{asset.taskType}</div>
                              <div className="text-[10px] text-slate-400">{asset.ratioDuration}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      {productDrawerTab === 'reviews' && (
                        <div className="space-y-2">
                          {drawerProductReviews.map((review) => (
                            <div key={review.id} className="rounded-lg border border-slate-200 p-3">
                              <div className="flex items-center justify-between">
                              <div>
                                  <div className="font-bold text-slate-700">{review.mediaType === 'VIDEO' ? '视频' : '图片'}评分</div>
                                  <div className="text-[10px] text-slate-400">任务 {review.taskId} · 评分人 {review.scorerUserId}</div>
                              </div>
                              <div className="text-right">
                                  <div className="font-bold">{review.overallScore}分</div>
                                  <div className="text-[10px] text-slate-500">{review.scoreTime?.replace('T', ' ').slice(0, 16) || '—'}</div>
                                </div>
                              </div>
                              {review.optimizationNote && <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-600">{review.optimizationNote}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {productDrawerTab === 'costs' && (
                        <div className="space-y-2">
                          {selectedProductAssets.map((asset) => (
                            <div key={asset.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                              <span>{asset.type} · {asset.taskType}</span>
                              <span className="font-mono font-bold text-slate-800">¥ {asset.cost.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-slate-200 pt-3 font-bold text-rose-500">
                            <span>合计</span>
                            <span>¥ {(selectedProductSummary?.totalCost ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                      {((productDrawerTab === 'input' && selectedProduct.files.length === 0)
                        || (productDrawerTab === 'images' && !selectedProductAssets.some((asset) => asset.type === '图片'))
                        || (productDrawerTab === 'videos' && !selectedProductAssets.some((asset) => asset.type === '视频'))
                        || (productDrawerTab === 'reviews' && drawerProductReviews.length === 0)
                        || (productDrawerTab === 'costs' && selectedProductAssets.length === 0)) && (
                        <div className="py-12 text-center text-slate-400">
                          <FolderOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          暂无真实数据
                        </div>
                      )}
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
                  {canCreateTask && <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setScreen(AppScreen.CREATE_IMAGE_TASK);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 rounded-lg cursor-pointer transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI 重新生成
                  </button>}
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
                      <img src={activeAsset.thumbnail} alt={activeAsset.productName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
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
                            {activeAsset.ratioDuration.split('·').map((value) => (
                              <span key={value} className="px-1 bg-slate-100 rounded-sm text-slate-500">{value.trim()}</span>
                            ))}
                          </>
                        )}
                        <span className={`px-1.5 py-0.5 font-bold rounded-sm text-[8px] ${statusClass(activeAsset.status)}`}>
                          {activeAsset.status}
                        </span>
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
                      {activeAsset.type === '图片' ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImageUrl(activeAsset.url)}
                          className="group relative flex aspect-video w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50"
                          aria-label="放大查看图片"
                        >
                          <img
                            src={activeAsset.url || activeAsset.thumbnail}
                            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                            referrerPolicy="no-referrer"
                            alt={activeAsset.productName}
                          />
                          <span className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-1 text-[10px] font-bold text-white">
                            点击放大
                          </span>
                        </button>
                      ) : (
                        <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200/80 bg-black">
                          <video
                            key={activeAsset.id}
                            src={activeAsset.url}
                            poster={activeAsset.thumbnail}
                            controls
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-contain"
                          >
                            当前浏览器不支持视频播放。
                          </video>
                        </div>
                      )}

                      {/* Detail Key-Value Rows */}
                      <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4.5 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">来源图片</span>
                          <span className="font-bold text-blue-600 flex items-center gap-1">
                            {activeAssetProduct?.sku ?? '—'}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">商品 ID</span>
                          <span className="font-mono font-bold text-slate-800">{activeAsset.sku}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">任务 ID</span>
                          <span className="font-mono font-bold text-slate-800">{activeAssetData?.taskId ?? '—'}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">Prompt 版本</span>
                          <span className="font-mono font-bold text-slate-800">{activeAsset.promptVersion}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">模型通道</span>
                          <span className="font-bold text-slate-700">{activeAsset.channel}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">模型名称</span>
                          <span className="font-mono font-bold text-slate-700">{activeAsset.modelName}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">审核评分</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1 font-mono">
                            {activeAsset.score == null ? '未评分' : `${activeAsset.score} 分`}
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
                          <span className={`font-bold ${activeAsset.status === '审核通过' ? 'text-emerald-500' : activeAsset.status === '待审美评分' ? 'text-amber-500' : 'text-rose-500'}`}>
                            {activeAsset.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">成本</span>
                          <span className="font-bold font-mono text-slate-800">¥ {activeAsset.cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200/65 pb-2">
                          <span className="text-slate-400 font-medium">创建时间</span>
                          <span className="font-mono text-slate-500">{activeAsset.addedTime}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">更新时间</span>
                          <span className="font-mono text-slate-500">{activeAsset.addedTime}</span>
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
                              <span>{activeAsset.type}生成 ({activeAsset.ratioDuration || '—'})</span>
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
                    <div className="space-y-3 animate-fadeIn">
                      {assetDrawerTab === 'source' && (
                        <>
                          {[
                            ['商品', activeAsset.productName],
                            ['商品 ID', activeAsset.productId],
                            ['任务 ID', activeAssetData?.taskId],
                            ['批次 ID', activeAssetData?.groupId],
                            ['任务类型', activeAsset.taskType],
                            ['风格', activeAsset.style],
                            ['场景', activeAsset.scene],
                            ['姿势', activeAsset.action],
                            ['创建时间', activeAsset.addedTime],
                          ].map(([label, value]) => (
                            <div key={label} className="flex justify-between border-b border-slate-100 py-2">
                              <span className="text-slate-400">{label}</span>
                              <span className="max-w-[280px] break-all text-right font-bold text-slate-700">{value || '—'}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {assetDrawerTab === 'audit' && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex justify-between">
                            <span>审核状态</span>
                            <span className="font-bold">{activeAsset.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>审美评分</span>
                            <span className="font-bold">{activeAsset.score == null ? '未评分' : `${activeAsset.score}分`}</span>
                          </div>
                          <div>
                            <div className="mb-1 text-slate-400">
                              {activeAsset.status === '审核通过'
                                ? '通过原因'
                                : activeAsset.status === '已打回' ? '打回原因' : '审核意见'}
                            </div>
                            <div className="rounded-lg bg-white p-3 text-slate-700">
                              {(activeAsset.status === '审核通过'
                                ? activeAssetData?.optimizationNote
                                : activeAssetData?.rejectReason || activeAssetData?.optimizationNote) || '—'}
                            </div>
                          </div>
                        </div>
                      )}
                      {assetDrawerTab === 'costs' && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex justify-between">
                            <span>模型通道</span>
                            <span className="font-bold">{activeAsset.channel}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-rose-500">
                            <span>结果成本</span>
                            <span>¥ {activeAsset.cost.toFixed(2)}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">成本来自生成结果真实 cost 字段，不展示未落库的虚构拆分项。</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Buttons inside asset drawer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <a href={activeAsset.url} target="_blank" rel="noreferrer" className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-2xs">
                      <Eye className="w-3.5 h-3.5" />
                      预览
                    </a>
                    {canDownload && <a href={activeAsset.url} target="_blank" rel="noreferrer" download className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-2xs">
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </a>}
                    <button
                      onClick={() => {
                        if (activeAssetProduct) {
                          setSelectedProduct(activeAssetProduct);
                          setDrawerType('product');
                          setProductDrawerTab('overview');
                        }
                      }}
                      className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      查看商品
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {canCreateTask && <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setScreen(AppScreen.CREATE_IMAGE_TASK);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 rounded-lg cursor-pointer transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI 重新生成
                  </button>}
                </div>

              </div>
            )}

          </div>
        </>
      )}

      {previewImageUrl && (
        <ImagePreviewModal
          images={[{ url: previewImageUrl, label: activeAsset.productName }]}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}
      {videoPreview && (
        <VideoPreviewModal
          videos={videoPreview.videos}
          initialIndex={videoPreview.initialIndex}
          onClose={() => setVideoPreview(null)}
        />
      )}

    </div>
  );
};
