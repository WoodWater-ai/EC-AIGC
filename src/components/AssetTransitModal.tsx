import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Globe, Lock, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductAsset } from '../types';
import { assetApi, type AssetResourceItem, type AssetResourceQueryRequest } from '../api/modules/asset';
import { ApiError } from '../api/error';
import { productLibraryApi } from '../api/modules/productLibrary';
import { productInfoApi } from '../api/modules/productInfo';
import { productCategoryApi, type ProductCategoryNode } from '../api/modules/productCategory';
import { assetCategoryApi, type AssetCategoryNode } from '../api/modules/assetCategory';
import { modelProfileApi, type ModelProfileDTO } from '../api/modules/modelProfile';
import {
  toProductLibrarySpu,
  type ProductSkuView,
  type ProductSpuView,
} from './productManagement/productManagementModel';
import {
  buildProductDetailAssets,
  type ResourceMediaFilter,
} from './resourceCenterModel';
import { useAuth } from '../auth/AuthContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { useConfirm } from './common/ConfirmProvider';
import { AssetImage } from './AssetImage';
import { ResourceMergeDrawer } from './common/ResourceMergeDrawer';
import { ProductPickerModal } from './CreateImageTask/ProductPickerModal';
import { CreateProductFromAssetDialog } from './CreateImageTask/dialogs/CreateProductFromAssetDialog';

/**
 * 左侧仅"分类导航"(调用真实分类树接口),无快捷视图。
 * 默认无选中分类 = 全部资源;点击分类节点 = 后端 query 带 categoryId 过滤。
 */

/** 目录扫描结果文件的导入状态机 */
type ScanStatus = 'pending' | 'importing' | 'success' | 'failed';
interface ScannedFile {
  name: string;
  /** 缩略图 URL —— 浏览模式下为 blob:...;mock 阶段为 https://... */
  url: string;
  tag: string;
  /** 用户勾选(仅 status=pending 且 checked=true 才会在批量导入时被处理) */
  checked: boolean;
  /** 导入状态机 */
  status: ScanStatus;
  /** 0-100 进度(仅 status=importing 时动态变化) */
  progress: number;
  /** 失败原因(status=failed 时填充) */
  errorMsg?: string;
  /** 文件大小(浏览目录模式才有,字节) */
  size?: number;
  /** 扩展字段 —— 浏览模式下挂真实 File 对象,导入时直接走 useFileUpload */
  extra?: { file?: File };
}

/** TransitAsset 直接 alias 到后端 AssetResourceItem —— 单一数据源 */
type TransitAsset = AssetResourceItem;
export type ResourceCenterSource = 'UPLOAD' | 'PRODUCT' | 'MODEL';
// [2026-08-15] 通用素材「槽位」筛选:图片任务提交时会给原始素材打槽位标记(见后端 appendTags)
const SLOT_TAGS = ['风格参考', '场景参考', '细节参考', '姿势参考', '模特参考'];

const modelProfileToTransitAsset = (profile: ModelProfileDTO): TransitAsset => ({
  id: profile.assetResourceId,
  name: profile.name,
  assetKind: 'IMAGE',
  assetType: 'MODEL_PROFILE',
  thumbnailUrl: profile.image,
  originalUrl: profile.image,
  description: profile.reason,
  tags: ['模特库', profile.source, ...profile.tags].filter(Boolean).join(','),
  uploadUserId: '',
  sourceId: profile.id,
  status: 'NORMAL',
  visibility: 'PRIVATE',
  categoryIds: [],
  createTime: profile.createTime,
});

interface AssetTransitModalProps {
  /** 已废弃:父组件传 onConfirmSelection 后不再消费 products */
  products?: ProductAsset[];
  onClose: () => void;
  onSelectProduct?: (product: ProductAsset) => void;
  selectedProduct?: ProductAsset;
  /** 选中确认回调 —— 接收完整 AssetResourceItem 列表(避免父组件二次反查丢失) */
  onConfirmSelection?: (selected: AssetResourceItem[]) => void;
  /** 是否允许多选(默认 false);true 时累加,false 时点击替换 */
  multiSelect?: boolean;
  /**
   * 模式:
   * - 'picker' (默认):业务型,从 task slot 弹出的资源选择
   * - 'manager':管理型,从菜单资源中心入口直接打开,强制多选,确认选择置灰
   */
  mode?: 'picker' | 'manager';
  /** 上传用途:AVATAR / PRODUCT / OTHER —— 默认 OTHER */
  purpose?: 'AVATAR' | 'PRODUCT' | 'OTHER';
  /** 关联商品 ID —— purpose=PRODUCT 时必填 */
  productId?: string | number;
  /** 任务创建时的素材槽位提示,CreateImageTask / CreateVideoTask 用 */
  targetSlot?: string;
  /** 模特参考槽位专用:打开共享的 AI 模特创建流程。 */
  onCreateModel?: () => void;
  /** 资源类型过滤(默认 IMAGE) */
  assetKind?: 'IMAGE' | 'VIDEO' | 'AUDIO';
  /** 初始数据来源；音频选择器始终降级为上传资源。 */
  initialSource?: ResourceCenterSource;
  /** 从产品管理进入时直接打开指定 SKU 的产品素材列表。 */
  initialProduct?: {
    spuName: string;
    sku: ProductSkuView;
  };
  /** 限定业务选择器可见的数据源；产品管理只开放上传资源。 */
  allowedSources?: ResourceCenterSource[];
  /** 从资源中心成功添加模特后通知上层刷新模特资源库。 */
  onModelImported?: () => void;
  /**
   * 仅用于业务素材选择，隐藏移动、删除、合并等资源管理能力。
   * 注：上传是「产生新资源」而非「管理现有资源」，因此不受 selectionOnly 控制，
   * 业务 slot 弹出的选择器也允许用户现场上传后立即选用。
   */
  selectionOnly?: boolean;
}

export const AssetTransitModal: React.FC<AssetTransitModalProps> = ({
  products,
  onClose,
  onSelectProduct,
  selectedProduct,
  onConfirmSelection,
  purpose = 'OTHER',
  productId,
  targetSlot = 'main',
  onCreateModel,
  assetKind = 'IMAGE',
  multiSelect = false,
  mode = 'picker',
  initialSource,
  initialProduct,
  allowedSources = ['UPLOAD', 'PRODUCT', 'MODEL'],
  onModelImported,
  selectionOnly = false,
}) => {
  const productSourceAvailable = allowedSources.includes('PRODUCT') && assetKind !== 'AUDIO';
  const modelSourceAvailable = allowedSources.includes('MODEL') && assetKind === 'IMAGE';
  const requestedInitialSource = initialSource ?? (mode === 'manager' ? 'PRODUCT' : 'UPLOAD');
  const [activeSource, setActiveSource] = useState<ResourceCenterSource>(
    requestedInitialSource === 'MODEL' && modelSourceAvailable
      ? 'MODEL'
      : requestedInitialSource === 'PRODUCT' && productSourceAvailable
        ? 'PRODUCT'
        : 'UPLOAD',
  );
  // picker 模式按 assetKind 锁死 mediaFilter:从源头杜绝"图片 picker 混入视频" / "视频 picker 混入图片"。
  // manager 模式(资源中心全局)仍显示全部。
  const [mediaFilter, setMediaFilter] = useState<ResourceMediaFilter>(
    mode === 'manager' && assetKind !== 'AUDIO' ? 'ALL' : assetKind,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [productSpus, setProductSpus] = useState<ProductSpuView[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  /**
   * [v1.x 2026-08-13] 追加加载状态 —— 与 productLoading 分开
   * 首次加载(pageNum=1)用 productLoading(覆盖整片 loading);
   * 追加加载(pageNum>1)用 productAppending(只在底部显示,不破坏已渲染的列表)
   * —— 否则追加时整片列表会因 productLoading=true 被"正在加载产品..."覆盖,视觉上"整个区域刷新"
   */
  const [productAppending, setProductAppending] = useState(false);
  const [productError, setProductError] = useState<Error | null>(null);
  const [productAppendError, setProductAppendError] = useState<Error | null>(null);
  /**
   * [v1.x 2026-08-13] 产品素材 tab 无限滚动分页
   * - productHasMore: 后端是否还有下一页(根据 total / pageSize 推算)
   * - productTotal: 后端总产品数(用于「已加载 X / Y」展示)
   * - productPageSize: 写死 50,5 列 × 10 行,滚一次 fetch 一次不至于太频繁
   */
  const [productHasMore, setProductHasMore] = useState(true);
  const [productTotal, setProductTotal] = useState(0);
  const productPageSize = 50;
  /** 弹窗内滚动容器 ref(scroll event listener 挂在这里) */
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  /**
   * 无限滚动同步状态。React state 更新存在一个渲染窗口，不能单独作为请求锁：
   * - loadingVersion:同一查询版本只允许一个分页请求在途
   * - queryVersion:筛选变化/进入详情时使旧请求结果立即失效
   * - nextPage / hasMore:滚动事件同步读取，不依赖闭包中的旧 state
   */
  const productLoadingVersionRef = useRef<number | null>(null);
  const productQueryVersionRef = useRef(0);
  const productNextPageRef = useRef(1);
  const productHasMoreRef = useRef(true);
  const [focusedProduct, setFocusedProduct] = useState<{
    spuName: string;
    productId: string;
    sku: ProductSkuView;
  } | null>(() => initialProduct ? {
    spuName: initialProduct.spuName,
    productId: initialProduct.sku.productId,
    sku: initialProduct.sku,
  } : null);
  const [selectedProductSkuIds, setSelectedProductSkuIds] = useState<string[]>([]);
  const [selectedProductCategoryId, setSelectedProductCategoryId] = useState<string | null>(null);
  const [productCategoryTree, setProductCategoryTree] = useState<ProductCategoryNode[]>([]);
  const [productCategoryTreeError, setProductCategoryTreeError] = useState<string | null>(null);
  const [collapsedProductCategoryIds, setCollapsedProductCategoryIds] = useState<Set<string>>(new Set());
  const [primaryFilter, setPrimaryFilter] = useState<'all' | 'recent' | 'archived'>('all');
  // [2026-08-15] 槽位筛选(多选;空数组 = 不过滤;点选切换,再点取消)
  const [slotTagFilter, setSlotTagFilter] = useState<string[]>([]);
  /** 分类树折叠状态 —— 存被折叠的节点 id,默认空 = 全部展开 */
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const toggleCollapse = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  /** 左侧分类树选中节点(联动后端 categoryId 过滤) */
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  /** 真实分类树(从 assetCategoryApi.tree 加载) */
  const [categoryTree, setCategoryTree] = useState<AssetCategoryNode[]>([]);
  const [categoryTreeError, setCategoryTreeError] = useState<string | null>(null);

  // Selected asset list(资源 ID,number)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  /** 合并抽屉使用打开瞬间的选择快照，避免合成过程中素材顺序被列表操作改变。 */
  const [mergeDrawerItems, setMergeDrawerItems] = useState<AssetResourceItem[] | null>(null);
  /** 商品合并目标也使用打开瞬间的快照，避免抽屉打开后列表选择变化导致归属错位。 */
  const [mergeTargetProductIds, setMergeTargetProductIds] = useState<string[]>([]);
  const [isSettingAsModel, setIsSettingAsModel] = useState(false);
  const [associationAsset, setAssociationAsset] = useState<AssetResourceItem | null>(null);
  const [productAssociationPickerOpen, setProductAssociationPickerOpen] = useState(false);
  const [productCreationAsset, setProductCreationAsset] = useState<AssetResourceItem | null>(null);

  // ============ 真后端数据 ============
  const { user, hasPermission } = useAuth();
  // 上传是产生新资源,不归 selectionOnly(管理动作屏蔽)管;权限完全交给 RBAC
  const canUpload = hasPermission('asset:upload');
  const canMove = !selectionOnly && hasPermission('asset:move');
  const canDelete = !selectionOnly && hasPermission('asset:delete');
  const canMerge = !selectionOnly && hasPermission('asset:merge');
  // 产品合并会生成并上传一份新的商品素材，按上传权限控制；
  // 内置运营角色默认有 asset:upload，但没有通用素材的 asset:merge。
  const canMergeProducts = !selectionOnly && canUpload;
  const canCreateModel = !selectionOnly && hasPermission('model-profile:create');
  const confirm = useConfirm();
  const currentUserId = user?.userId == null ? undefined : String(user.userId);

  // 视图分类 → 后端 query 参数映射
  // 仅由 selectedCategoryId 决定:无选中 = 全部,选中 = 后端 categoryId 过滤
  // manager mode(资源中心全局)不过滤 kind,显示所有;picker mode 按 assetKind 过滤
  const assetPageSize = 50;
  const buildQuery = useCallback((pageNum: number): AssetResourceQueryRequest => {
    const base: AssetResourceQueryRequest = {
      pageNum,
      pageSize: assetPageSize,
    };
    if (mediaFilter !== 'ALL') {
      base.assetKind = mediaFilter;
    }
    if (primaryFilter === 'recent') {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      base.startTime = String(since.getTime());
    }
    // [2026-08-15] 槽位筛选走后端(tags 过滤,任一命中);前端不再二次过滤
    if (slotTagFilter.length > 0) {
      base.tags = slotTagFilter;
    }
    if (selectedCategoryId !== null) {
      return { ...base, categoryId: selectedCategoryId };
    }
    return base;
  }, [mediaFilter, primaryFilter, selectedCategoryId, slotTagFilter]);

  // 当前页数据 + 刷新方法
  const [assets, setAssets] = useState<TransitAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [assetAppending, setAssetAppending] = useState(false);
  const [assetHasMore, setAssetHasMore] = useState(true);
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetAppendError, setAssetAppendError] = useState<Error | null>(null);
  const assetLoadingVersionRef = useRef<number | null>(null);
  const assetQueryVersionRef = useRef(0);
  const assetNextPageRef = useRef(1);
  const assetHasMoreRef = useRef(true);

  const loadPagedAssets = useCallback(async (pageNum: number, version: number) => {
    if (!['UPLOAD', 'MODEL'].includes(activeSource)) return;
    if (assetLoadingVersionRef.current !== null || !assetHasMoreRef.current) return;
    assetLoadingVersionRef.current = version;
    if (pageNum === 1) setLoading(true);
    else setAssetAppending(true);
    setAssetAppendError(null);
    if (pageNum === 1) setQueryError(null);
    try {
      let pageCount = 0;
      let reportedTotal = 0;
      if (activeSource === 'MODEL') {
        const page = await modelProfileApi.page({
          pageNum,
          pageSize: assetPageSize,
          keyword: searchQuery || undefined,
          status: 'active',
        });
        const mapped = page.list
          .filter((profile) => Boolean(profile.assetResourceId && profile.image))
          .map(modelProfileToTransitAsset);
        if (version !== assetQueryVersionRef.current) return;
        setAssets((current) => pageNum === 1 ? mapped : [
          ...current,
          ...mapped.filter((next) => !current.some((existing) => existing.id === next.id)),
        ]);
        pageCount = page.pages;
        reportedTotal = page.total;
      } else {
        const page = await assetApi.page({
          ...buildQuery(pageNum),
          keyword: searchQuery || undefined,
        });
        if (version !== assetQueryVersionRef.current) return;
        setAssets((current) => pageNum === 1 ? page.list : [
          ...current,
          ...page.list.filter((next) => !current.some((existing) => existing.id === next.id)),
        ]);
        pageCount = page.pages;
        reportedTotal = page.total;
      }
      if (version !== assetQueryVersionRef.current) return;
      const hasMore = pageNum < pageCount;
      assetHasMoreRef.current = hasMore;
      assetNextPageRef.current = pageNum + 1;
      setAssetHasMore(hasMore);
      setAssetTotal(reportedTotal);
    } catch (error) {
      if (version !== assetQueryVersionRef.current) return;
      if (pageNum === 1) {
        setQueryError(error as Error);
        setAssets([]);
      } else {
        setAssetAppendError(error as Error);
      }
    } finally {
      if (version === assetQueryVersionRef.current) {
        assetLoadingVersionRef.current = null;
        setLoading(false);
        setAssetAppending(false);
      }
    }
  }, [activeSource, buildQuery, searchQuery]);

  const refetch = useCallback(async () => {
    assetQueryVersionRef.current += 1;
    const version = assetQueryVersionRef.current;
    assetLoadingVersionRef.current = null;
    assetNextPageRef.current = 1;
    assetHasMoreRef.current = true;
    setAssets([]);
    setLoading(false);
    setAssetAppending(false);
    setAssetHasMore(true);
    setAssetTotal(0);
    setQueryError(null);
    setAssetAppendError(null);

    if (activeSource === 'UPLOAD' || activeSource === 'MODEL') {
      await loadPagedAssets(1, version);
      return;
    }
    assetHasMoreRef.current = false;
    setAssetHasMore(false);
    if (!focusedProduct) return;

    assetLoadingVersionRef.current = version;
    setLoading(true);
    try {
      const detail = await productLibraryApi.productDetail(
        focusedProduct.productId,
        primaryFilter !== 'archived',  // [2026-08-25] 已归档 tab 显式传 false;其余(全部/最近使用)默认 true 排除已归档
      );
      if (version !== assetQueryVersionRef.current) return;
      const recentThreshold = primaryFilter === 'recent'
        ? Date.now() - 30 * 24 * 60 * 60 * 1000
        : null;
      const keyword = searchQuery.trim().toLowerCase();
      const nextAssets = buildProductDetailAssets(detail, mediaFilter).filter((asset) => {
        // [2026-08-25] 已归档 tab:productDetail 没有 onlyArchived 参数,前端再过滤一次
        // (其他 tab 由后端 excludeArchived 控制,这里不重复过滤)
        if (primaryFilter === 'archived' && asset.status !== 'ARCHIVED') return false;
        if (recentThreshold !== null) {
          const createdAt = asset.createTime ? new Date(asset.createTime).getTime() : 0;
          if (!createdAt || createdAt < recentThreshold) return false;
        }
        if (!keyword) return true;
        return [asset.name, asset.description, asset.tags]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword));
      });
      setAssets(nextAssets);
      setAssetTotal(nextAssets.length);
    } catch (error) {
      if (version !== assetQueryVersionRef.current) return;
      setQueryError(error as Error);
    } finally {
      if (version === assetQueryVersionRef.current) {
        assetLoadingVersionRef.current = null;
        setLoading(false);
      }
    }
  }, [activeSource, focusedProduct, loadPagedAssets, mediaFilter, primaryFilter, searchQuery]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadProductPage = useCallback(async (pageNum: number, version: number) => {
    if (productLoadingVersionRef.current !== null || !productHasMoreRef.current) return;
    productLoadingVersionRef.current = version;
    if (pageNum === 1) setProductLoading(true);
    else setProductAppending(true);
    setProductAppendError(null);
    if (pageNum === 1) setProductError(null);
    try {
      const page = await productLibraryApi.productPage({
        pageNum,
        pageSize: productPageSize,
        keyword: searchQuery || undefined,
        productCategoryId: selectedProductCategoryId || undefined,
        sortBy: 'latest',
      });
      if (version !== productQueryVersionRef.current) return;
      const mapped = page.list.map(toProductLibrarySpu);
      setProductSpus((current) => pageNum === 1 ? mapped : [
        ...current,
        ...mapped.filter((next) => !current.some((existing) => existing.id === next.id)),
      ]);
      const hasMore = pageNum < page.pages;
      productHasMoreRef.current = hasMore;
      productNextPageRef.current = pageNum + 1;
      setProductHasMore(hasMore);
      setProductTotal(page.total);
    } catch (error) {
      if (version !== productQueryVersionRef.current) return;
      if (pageNum === 1) {
        setProductError(error as Error);
        setProductSpus([]);
      } else {
        setProductAppendError(error as Error);
      }
    } finally {
      if (version === productQueryVersionRef.current) {
        productLoadingVersionRef.current = null;
        setProductLoading(false);
        setProductAppending(false);
      }
    }
  }, [searchQuery, selectedProductCategoryId]);

  // 筛选变化时创建新的查询版本，清空旧列表并只请求第一页。
  useEffect(() => {
    productQueryVersionRef.current += 1;
    const version = productQueryVersionRef.current;
    productLoadingVersionRef.current = null;
    productNextPageRef.current = 1;
    productHasMoreRef.current = true;
    setProductSpus([]);
    setProductHasMore(true);
    setProductTotal(0);
    setProductError(null);
    setProductAppendError(null);
    setProductLoading(false);
    setProductAppending(false);
    if (activeSource !== 'PRODUCT' || focusedProduct) return;
    scrollContainerRef.current?.scrollTo({ top: 0 });
    void loadProductPage(1, version);
  }, [activeSource, focusedProduct, loadProductPage]);

  // 资源中心三个列表共用同一个滚动容器，按当前 tab 分发下一页请求。
  // 原因:sticky + IntersectionObserver 在 React 18 + 嵌套 overflow 链下不稳定,
  //     哨兵被内容追加推到 viewport 外时 observer 不触发,死锁。
  //     改用 scroll event 手动判断"距离底部 < 200px",完全绕开 sticky / observer。
  // - passive: true 提升滚动性能
  // - requestAnimationFrame 节流,每秒最多 60 次
  // - 不在 mount 时立即调 handleScroll():productSpus 还在空,会立即误触 setPageNum
  // - 标准无限滚动语义:user 滚一次 → 加载 1 页 → user 再滚 → 再加载 1 页
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight >= 200) return;
        if (activeSource === 'PRODUCT' && !focusedProduct) {
          if (productLoadingVersionRef.current !== null || !productHasMoreRef.current) return;
          void loadProductPage(productNextPageRef.current, productQueryVersionRef.current);
          return;
        }
        if (activeSource === 'UPLOAD' || activeSource === 'MODEL') {
          if (assetLoadingVersionRef.current !== null || !assetHasMoreRef.current) return;
          void loadPagedAssets(assetNextPageRef.current, assetQueryVersionRef.current);
        }
      });
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeSource, focusedProduct, loadPagedAssets, loadProductPage]);

  const handleSourceChange = (source: ResourceCenterSource) => {
    if (!allowedSources.includes(source)
      || source === activeSource
      || (source === 'PRODUCT' && !productSourceAvailable)
      || (source === 'MODEL' && !modelSourceAvailable)) return;
    setActiveSource(source);
    setSelectedAssetIds([]);
    setMergeDrawerItems(null);
    setMergeTargetProductIds([]);
    setSelectedCategoryId(null);
    setSelectedProductSkuIds([]);
    setSelectedProductCategoryId(null);
    setFocusedProduct(null);
    setPrimaryFilter('all');
    setSlotTagFilter([]);
    // picker 模式按 assetKind 锁死,不允许回到 'ALL';manager 模式仍允许 'ALL'。
    setMediaFilter(
      source === 'MODEL'
        ? 'IMAGE'
        : mode === 'picker'
          ? assetKind
          : 'ALL',
    );
  };

  /**
   * 加载真实分类树(用户打开 modal 时一次性加载)
   * 失败时只提示,不阻塞主流程(顶部 4 个视图按钮仍可用)
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tree = await assetCategoryApi.tree();
        if (!cancelled) {
          setCategoryTree(tree ?? []);
          setCategoryTreeError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCategoryTreeError((err as Error).message);
          setCategoryTree([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    productCategoryApi.tree()
      .then((tree) => {
        if (cancelled) return;
        setProductCategoryTree(tree ?? []);
        setProductCategoryTreeError(null);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setProductCategoryTree([]);
        setProductCategoryTreeError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Directory Scan Drawer overlay state
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  /** 扫描到的文件 + 导入状态机 */
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  /** 浏览模式暂存的目录句柄 —— 扫描时用 */
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // Hidden inputs refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAssets = assets.filter((asset) => {
    if (activeSource === 'PRODUCT') {
      return primaryFilter === 'archived'
        ? asset.status === 'ARCHIVED'
        : asset.status !== 'ARCHIVED';
    }
    if (activeSource !== 'UPLOAD') return true;
    if (asset.productId) return false;
    if (asset.inModelLibrary) return false;
    if (currentUserId && String(asset.uploadUserId) !== currentUserId) return false;
    // [2026-08-15] 槽位筛选已改为后端 tags 过滤,前端不再二次过滤
    return true;
  });
  // 通用素材存在“本人且未关联”等前端二次过滤；若一页过滤后不足一屏，自动补下一页。
  useEffect(() => {
    if (!['UPLOAD', 'MODEL'].includes(activeSource)
      || loading
      || assetAppending
      || queryError
      || !assetHasMore) return;
    const container = scrollContainerRef.current;
    if (!container || container.scrollHeight > container.clientHeight + 1) return;
    void loadPagedAssets(assetNextPageRef.current, assetQueryVersionRef.current);
  }, [
    activeSource,
    assetAppending,
    assetHasMore,
    assets.length,
    filteredAssets.length,
    loadPagedAssets,
    loading,
    queryError,
  ]);
  // 产品素材列表中的 sku.id 就是后端 productId。直接以选择状态为单一来源，
  // 避免分页、筛选或列表刷新后从当前 productSpus 反查不到已选 SKU。
  const selectedProductIds: string[] = Array.from(new Set<string>(selectedProductSkuIds));
  const selectedUploadProductId = selectedProductIds.length === 1
    ? selectedProductIds[0]
    : undefined;
  const effectiveProductId = activeSource === 'PRODUCT'
    ? selectedUploadProductId ?? focusedProduct?.productId
    : productId;
  const currentSelectionCount = activeSource === 'PRODUCT' && !focusedProduct
    ? selectedProductSkuIds.length
    : selectedAssetIds.length;
  const canDeleteSelected = canDelete
    && selectedAssetIds.length > 0
    && selectedAssetIds
      .map((id) => assets.find((asset) => asset.id === id))
      .every((asset) => asset != null
        && (activeSource === 'PRODUCT' && focusedProduct
          ? !asset.isProductMainImage
          : String(asset.uploadUserId) === currentUserId && !asset.productId));
  const selectedItems = selectedAssetIds
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((item): item is AssetResourceItem => item !== undefined);
  const canSetProductCover = canMove
    && activeSource === 'PRODUCT'
    && focusedProduct !== null
    && selectedItems.length === 1
    && selectedItems[0].sourceType === 'UPLOAD'
    && selectedItems[0].assetKind === 'IMAGE';
  const canAssociateSelectedAsset = canMove
    && activeSource === 'UPLOAD'
    && selectedItems.length === 1
    && selectedItems[0].assetKind !== 'AUDIO';
  const canMergeSelected = canMerge
    && mode === 'manager'
    && activeSource === 'UPLOAD'
    && selectedItems.length >= 2
    && selectedItems.length === selectedAssetIds.length
    && selectedItems.every((item) => item.assetKind === 'IMAGE');
  const canMergeFocusedProductAssets = canMergeProducts
    && activeSource === 'PRODUCT'
    && focusedProduct !== null
    && selectedItems.length >= 2
    && selectedItems.length === selectedAssetIds.length
    && selectedItems.every((item) => item.assetKind === 'IMAGE');
  const showSetAsModel = canCreateModel
    && mode === 'manager'
    && activeSource === 'UPLOAD'
    && selectedAssetIds.length > 0;
  const setAsModelDisabledReason = (() => {
    if (isSettingAsModel) return '正在添加到模特资源库';
    if (selectedItems.length !== selectedAssetIds.length) return '部分所选资源已不存在，请重新选择';
    if (selectedItems.length > 20) return '单次最多可将 20 张图片设为模特';
    if (selectedItems.some((item) => item.assetKind !== 'IMAGE')) return '只有图片资源可以设为模特';
    if (selectedItems.some((item) => item.status !== 'NORMAL')) return '已归档的图片不能设为模特';
    if (selectedItems.some((item) => item.inModelLibrary)) return '选择中包含已在模特库的图片';
    if (selectedItems.some((item) => String(item.uploadUserId) !== currentUserId)) {
      return '只能将本人上传的图片设为模特';
    }
    return undefined;
  })();
  const canSetSelectedAsModel = showSetAsModel && setAsModelDisabledReason === undefined;

  // mode='manager' 强制多选;picker 模式尊重调用方的 multiSelect
  const effectiveMultiSelect = mode === 'manager' ? true : multiSelect;

  // [2026-08-15] 任务选素材(picker):产品素材 tab 选中 SKU 后可直接确认,SKU 主图作为素材
  const canConfirmProductSku = mode !== 'manager'
    && activeSource === 'PRODUCT'
    && !focusedProduct
    && selectedProductSkuIds.length === 1;

  const handleCardClick = (id: string) => {
    if (mode === 'manager' && activeSource !== 'UPLOAD' && !(activeSource === 'PRODUCT' && focusedProduct)) return;
    if (effectiveMultiSelect) {
      // 多选:toggle 累加
      setSelectedAssetIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
      );
    } else {
      // 单选:替换(单选场景下选别的就覆盖,不需要 toggle)
      setSelectedAssetIds([id]);
    }
  };

  const handleClearSelection = () => {
    setSelectedAssetIds([]);
    setSelectedProductSkuIds([]);
    setSelectedProductCategoryId(null);
    setMergeDrawerItems(null);
    setMergeTargetProductIds([]);
  };

  const handleMergeClick = () => {
    if (!canMerge || !canMergeSelected) return;
    setMergeTargetProductIds([]);
    setMergeDrawerItems(selectedItems);
  };

  const productComposeDisabledReason = selectedProductIds.length < 2
    ? '至少选择两个 SKU'
    : undefined;

  const handleProductCompose = async () => {
    if (!canMergeProducts || productComposeDisabledReason) return;
    const productIds = selectedProductIds;
    try {
      const details = await Promise.all(productIds.map((id) => productLibraryApi.productDetail(id)));
      const whiteBaseAssets = details.map((detail) => buildProductDetailAssets(detail, 'IMAGE')
        .find((asset) => ['PRODUCT_ORIGINAL', 'WHITE_BACKGROUND'].includes(asset.assetType ?? '')));
      if (whiteBaseAssets.some((asset) => !asset)) {
        toast.warning('所选 SKU 中存在缺少白底图的产品，无法搭配合成');
        return;
      }
      setMergeTargetProductIds(productIds);
      setMergeDrawerItems(whiteBaseAssets.filter((asset): asset is AssetResourceItem => Boolean(asset)));
    } catch {
      toast.error('读取产品白底图失败，请稍后重试');
    }
  };

  const handleFocusedProductMerge = () => {
    if (!focusedProduct || !canMergeFocusedProductAssets) return;
    setMergeTargetProductIds([focusedProduct.productId]);
    setMergeDrawerItems(selectedItems);
  };

  const handleSetAsModel = async () => {
    if (!canSetSelectedAsModel) return;
    const count = selectedItems.length;
    const ok = await confirm({
      title: '设为模特',
      message: `确认将选中的 ${count} 张图片设为模特并添加到模特资源库吗？`,
      confirmText: '确认添加',
    });
    if (!ok) return;

    setIsSettingAsModel(true);
    try {
      const firstName = selectedItems[0]?.name.trim().replace(/\.[^/.]+$/, '') || '已有模特';
      const profileIds = await modelProfileApi.importExisting({
        assetResourceIds: selectedItems.map((item) => item.id),
        name: firstName,
        tags: ['已有模特', '人物资产'],
        suitableFor: ['product_main', 'scene_detail', 'model_triple_view'],
        reason: '由资源中心已有图片创建。',
      });
      toast.success(`${profileIds.length} 张图片已添加到模特资源库`);
      setSelectedAssetIds([]);
      await refetch();
      onModelImported?.();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast.error(`设为模特失败: ${(err as Error).message}`);
      }
    } finally {
      setIsSettingAsModel(false);
    }
  };

  // ============ 移动到分类(批量) ============
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveTargetCategoryId, setMoveTargetCategoryId] = useState<number | null>(null);
  const [moveTargetCategoryName, setMoveTargetCategoryName] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  const handleMoveClick = () => {
    if (!canMove || selectedAssetIds.length === 0) return;
    setMoveTargetCategoryId(null);
    setMoveTargetCategoryName('');
    setIsMoveModalOpen(true);
  };

  const handleMoveCancel = () => {
    if (isMoving) return;
    setIsMoveModalOpen(false);
  };

  /**
   * 批量移动:把 selectedAssetIds 的每个资源都更新到 moveTargetCategoryId(replace 语义)
   * - 后端 updateCategories 是 per-resource,前端循环调用
   * - 任一失败立刻中断,提示失败信息;成功的数量不回滚(移动不可逆)
   */
  const handleMoveConfirm = async () => {
    if (!canMove || moveTargetCategoryId === null || selectedAssetIds.length === 0) return;
    setIsMoving(true);
    try {
      for (const id of selectedAssetIds) {
        await assetApi.updateCategories(id, [String(moveTargetCategoryId)]);
      }
      toast.success('移动完成,');
      setIsMoveModalOpen(false);
      setSelectedAssetIds([]);
      await refetch();
    } catch (err) {
      toast.error(`移动失败: ${(err as Error).message}`);
    } finally {
      setIsMoving(false);
    }
  };

  /** 判断节点是否为叶子(children 为空 / null / undefined) */
  const isLeaf = (node: AssetCategoryNode): boolean =>
    !node.children || node.children.length === 0;

  /**
   * 根据 File 推 assetKind(IMAGE/VIDEO)
   * - 优先 mime 头(浏览器能识别就走 mime)
   * - 兜底用扩展名(部分视频格式浏览器识别不出 mime)
   */
  const inferAssetKind = (file: File): 'IMAGE' | 'VIDEO' => {
    if (file.type.startsWith('video/')) return 'VIDEO';
    if (file.type.startsWith('image/')) return 'IMAGE';
    if (/\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|mpg|mpeg|3gp)$/i.test(file.name)) return 'VIDEO';
    if (/\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) return 'IMAGE';
    return 'IMAGE';
  };

  /**
   * 视频抽帧:从本地 video File 截取首帧,生成 base64 dataURL(用作 <img> 缩略图)
   * 失败返回空串(让 UI 显示缺损图)
   * 抽帧后立即 revoke video blob URL,避免内存泄漏
   */
  const generateVideoThumbnail = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const blobUrl = URL.createObjectURL(file);
      video.src = blobUrl;
      let settled = false;
      const cleanup = () => {
        URL.revokeObjectURL(blobUrl);
        video.removeAttribute('src');
        video.load();
      };
      video.onloadedmetadata = () => {
        // 跳到首帧(0.1s 避免部分视频黑帧;clamp 到 duration/2 防止超长视频)
        video.currentTime = Math.min(0.1, (video.duration || 0.1) / 2);
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 240;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas 2d unavailable');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataURL = canvas.toDataURL('image/jpeg', 0.7);
          settled = true;
          cleanup();
          resolve(dataURL);
        } catch (err) {
          settled = true;
          cleanup();
          reject(err);
        }
      };
      video.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('video load failed'));
      };
    });

  /** 删除通用资源或当前 SKU 下选中的产品素材。 */
  const handleDeleteSelected = async () => {
    if (!canDelete || selectedAssetIds.length === 0) return;
    const count = selectedAssetIds.length;
    const ok = await confirm({
      title: activeSource === 'PRODUCT' ? '删除产品素材' : '删除资源',
      message: `确认要删除选择的 ${count} 个${activeSource === 'PRODUCT' ? '产品素材' : '资源'}吗?`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;

    try {
      let successCount: number;
      if (activeSource === 'PRODUCT' && focusedProduct) {
        const inputs = selectedItems.filter((item) => item.sourceType === 'UPLOAD');
        const generated = selectedItems.filter((item) => item.sourceType !== 'UPLOAD');
        const results = await Promise.all([
          inputs.length > 0
            ? productLibraryApi.deleteInputAssets(focusedProduct.productId, inputs.map((item) => item.id))
            : Promise.resolve(0),
          generated.length > 0
            ? productLibraryApi.archiveBatch(generated.map((item) => ({
                id: item.id,
                mediaType: item.assetKind as 'IMAGE' | 'VIDEO',
              })))
            : Promise.resolve(0),
        ]);
        successCount = results[0] + results[1];
      } else {
        successCount = await assetApi.deleteBatch([...selectedAssetIds]);
      }
      toast.success(`${successCount} 个${activeSource === 'PRODUCT' ? '产品素材' : '资源'}已删除`);
      setSelectedAssetIds([]);
      await refetch();
    } catch (err) {
      toast.error(`删除失败: ${(err as Error).message}`);
    }
  };

  const handleSetProductCover = async () => {
    if (!canSetProductCover || !focusedProduct) return;
    try {
      await productLibraryApi.setInputAssetCover(focusedProduct.productId, selectedItems[0].id);
      toast.success('已设为产品素材封面');
      setSelectedAssetIds([]);
      await refetch();
    } catch (err) {
      toast.error(`设置封面失败: ${(err as Error).message}`);
    }
  };

  const handleAssociateSelectedAsset = async () => {
    if (!canAssociateSelectedAsset) return;
    const asset = selectedItems[0];
    if (productId != null) {
      try {
        await assetApi.bindToProduct(asset.id, String(productId));
        toast.success('素材已关联到当前产品');
        setSelectedAssetIds([]);
        await refetch();
      } catch (err) {
        toast.error(`关联产品失败: ${(err as Error).message}`);
      }
      return;
    }
    setAssociationAsset(asset);
    setProductAssociationPickerOpen(true);
  };

  const handleAssociateExistingProduct = async (product: { id: string; name: string }) => {
    if (!associationAsset) return;
    try {
      await assetApi.bindToProduct(associationAsset.id, product.id);
      toast.success(`素材已关联商品“${product.name}”`);
      setProductAssociationPickerOpen(false);
      setAssociationAsset(null);
      setSelectedAssetIds([]);
      await refetch();
    } catch (err) {
      toast.error(`关联产品失败: ${(err as Error).message}`);
    }
  };

  const [confirmingSelection, setConfirmingSelection] = useState(false);

  /**
   * [2026-08-15] 任务选素材:产品素材 tab 选中 SKU 直接确认 ——
   * 通过 productInfoApi.detail 拿 SKU 主图 assetId,再取完整 AssetResourceItem 作为素材。
   */
  const confirmSelectedSkuAsAsset = async () => {
    const skuId = selectedProductSkuIds[0];
    const sku = productSpus
      .flatMap((spu) => spu.skus)
      .find((item) => item.id === skuId);
    if (!sku) {
      toast.error('所选 SKU 不存在，请重新选择');
      return;
    }
    setConfirmingSelection(true);
    try {
      const detail = await productInfoApi.detail({ id: sku.productId });
      if (!detail || !detail.imageId) {
        toast.warning('该 SKU 暂无可用主图素材，请通过「查看素材」选择具体图片');
        return;
      }
      const asset = await assetApi.get(String(detail.imageId));
      onConfirmSelection?.([asset]);
      onClose();
    } catch (err) {
      toast.error('素材获取失败：' + (err as Error).message);
    } finally {
      setConfirmingSelection(false);
    }
  };

  const handleConfirmSelection = async () => {
    // [2026-08-15] 产品素材 tab 选中 SKU 未聚焦:直接把 SKU 主图作为素材确认
    if (canConfirmProductSku) {
      await confirmSelectedSkuAsAsset();
      return;
    }
    if (selectedAssetIds.length === 0) {
      toast.warning('请至少选择一个资源');
      return;
    }

    const selectedItems = selectedAssetIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((item): item is AssetResourceItem => item !== undefined);
    if (selectedItems.length === 0) {
      toast.error('所选资源已不在当前列表，请重新选择');
      return;
    }

    const compatibleItems = selectedItems.filter((item) => item.assetKind === assetKind);
    if (compatibleItems.length !== selectedItems.length) {
      toast.warning(`当前任务仅支持选择${assetKind === 'VIDEO' ? '视频' : assetKind === 'AUDIO' ? '音频' : '图片'}素材`);
      return;
    }

    setConfirmingSelection(true);
    try {
      let resolvedItems = selectedItems;
      if (activeSource === 'PRODUCT') {
        // 产品详情同时展示上传素材和 AI 生成素材：只有后者需要转换成业务资源。
        // 上传素材本身已经是 asset_resource，直接带入任务，避免被误判为生成结果。
        const generatedItems = selectedItems.filter((item) =>
          item.sourceType === 'GENERATED_IMAGE' || item.sourceType === 'GENERATED_VIDEO');
        if (generatedItems.length > 0) {
          const convertedItems = await assetApi.resolveGenerated(generatedItems.map((item) => ({
            mediaType: item.assetKind as 'IMAGE' | 'VIDEO',
            sourceId: item.sourceId ?? item.id,
          })));
          const convertedBySource = new Map(convertedItems.map((item) => [
            `${item.assetKind}:${item.sourceId ?? item.id}`,
            item,
          ]));
          resolvedItems = selectedItems.map((item) => {
            if (item.sourceType !== 'GENERATED_IMAGE' && item.sourceType !== 'GENERATED_VIDEO') {
              return item;
            }
            const converted = convertedBySource.get(
              `${item.assetKind}:${item.sourceId ?? item.id}`,
            );
            if (!converted) throw new Error('生成素材转换失败，请重试');
            return converted;
          });
        }
      }

      if (onConfirmSelection) {
        onConfirmSelection(resolvedItems);
      } else if (onSelectProduct && products && products.length > 0) {
        const firstItem = resolvedItems[0];
        if (firstItem) {
          onSelectProduct({
            ...products[0],
            name: firstItem.name,
            thumbnail: firstItem.thumbnailUrl ?? products[0].thumbnail,
          });
        }
      }
      onClose();
    } catch (err) {
      toast.error(`资源选择失败：${(err as Error).message}`);
    } finally {
      setConfirmingSelection(false);
    }
  };

  // Local File Upload
  const handleLocalUploadTrigger = () => {
    if (!canUpload) return;
    if (activeSource === 'PRODUCT' && !effectiveProductId) {
      toast.warning('请先选择一个 SKU');
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDirectoryScanOpen = () => {
    if (activeSource === 'PRODUCT' && !effectiveProductId) {
      toast.warning('请先选择一个 SKU');
      return;
    }
    setIsScanOpen(true);
  };

  // 真上传 hook —— 走腾讯云 COS
  const { upload, loading: uploadLoading } = useFileUpload({
    purpose: effectiveProductId == null
      ? (purpose ?? 'OTHER') as 'AVATAR' | 'PRODUCT' | 'OTHER'
      : 'PRODUCT',
    productId: effectiveProductId,
  });

  const handleLocalUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpload) return;
    if (!e.target.files || e.target.files.length === 0) return;
    const files: File[] = Array.from(e.target.files);

    let successCount = 0;
    let failCount = 0;
    for (const file of files) {
      try {
        // 1) COS 直传
        const { fileResourceId, fileMd5 } = await upload(file);
        // 2) 创建业务资源 —— 后端自动 confirm file_resource
        // assetType 兜底 PRODUCT_ORIGINAL(主图/商品原图),task-level slot 区分在 task 创建时再做
        // assetKind 根据 mime/扩展名自动推断(IMAGE/VIDEO)
        await assetApi.create({
          fileResourceId,
          fileMd5,
          name: file.name,
          productId: effectiveProductId,
          assetKind: inferAssetKind(file),
          assetType: 'PRODUCT_ORIGINAL',
        });
        successCount++;
      } catch (err) {
        console.error('[Transit] 上传失败:', err);
        // ApiError 已由全局响应拦截器展示后端业务提示，避免重复 toast。
        if (!(err instanceof ApiError)) {
          toast.error(`文件上传失败: ${(err as Error).message}`);
        }
        failCount++;
      }
    }
    // 成功后简短提示(不带文件名)
    if (successCount > 0) {
      toast.success(
        files.length > 1
          ? `${successCount} 个文件上传成功`
          : '文件上传成功',
      );
    }
    // 失败汇总(多文件场景)
    if (files.length > 1 && failCount > 0) {
      toast.error(`${failCount} 个文件上传失败`);
    }
    // 3) 上传完成后清空 input + 刷新列表
    e.target.value = '';
    await refetch();
  };

  // ============ 目录扫描真实数据(只走浏览模式,无 mock) ============

  /**
   * 触发扫描:enumerate 真实 PC 本地文件夹
   * 必须先点"浏览"选择目录(dirHandleRef 有值),否则报错提示
   */
  const handleTriggerScan = async () => {
    if (!canUpload) return;
    const dirHandle = dirHandleRef.current;
    if (!dirHandle) {
      toast.error('请先点击"浏览"选择文件夹');
      return;
    }
    setIsScanning(true);
    setHasScanned(false);
    // 释放旧 objectURL
    scannedFiles.forEach((f) => f.url.startsWith('blob:') && URL.revokeObjectURL(f.url));

    try {
      const imageExts = /\.(jpe?g|png|webp|bmp|gif)$/i;
      const videoExts = /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|mpg|mpeg|3gp)$/i;
      const collected: ScannedFile[] = [];
      const MAX = 50;
      // values() 在 TS 类型里可能未定义,实际运行时可用
      for await (const entry of (dirHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values()) {
        if (collected.length >= MAX) break;
        if (entry.kind !== 'file') continue;
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        // 接受图片或视频(优先 mime,fallback 扩展名)
        const isMedia =
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          imageExts.test(file.name) ||
          videoExts.test(file.name);
        if (!isMedia) continue;
        // 推断类型 + 生成缩略图(视频需抽帧,图片直接用 blob URL)
        const kind = inferAssetKind(file);
        let thumbUrl = '';
        if (kind === 'VIDEO') {
          try {
            thumbUrl = await generateVideoThumbnail(file);
          } catch {
            // 抽帧失败 → thumbUrl 空,UI 显示缺损图(不会上传,因为 extra.file 还在)
            thumbUrl = '';
          }
        } else {
          thumbUrl = URL.createObjectURL(file);
        }
        collected.push({
          name: file.name,
          url: thumbUrl,
          tag: kind === 'VIDEO' ? '视频' : '图片',
          checked: true,
          status: 'pending',
          progress: 0,
          size: file.size,
          extra: { file },
        });
      }
      setIsScanning(false);
      setHasScanned(true);
      setScannedFiles(collected);
      if (collected.length === 0) {
        toast.error('所选目录中没有图片文件');
      } else {
        toast.success(`已扫描到 ${collected.length} 个图片文件`);
      }
    } catch (err) {
      setIsScanning(false);
      toast.error(`扫描失败: ${(err as Error).message}`);
    }
  };

  /**
   * 浏览器原生"选择目录" —— 使用 File System Access API 的 showDirectoryPicker
   * 行为:只把 handle.name 回填到输入框,把 handle 存到 dirHandleRef
   * 实际 enumerate 由"开始扫描"按钮触发(handleBrowseClick 不读取任何文件)
   * 支持:Chrome / Edge / Opera;Safari 部分支持;Firefox 不支持
   */
  const handleBrowseClick = async () => {
    if (!canUpload) return;
    type DirectoryPickerWindow = Window & {
      showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    };
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      toast.error('当前浏览器不支持目录选择 API,请使用 Chrome / Edge,或手动输入路径');
      return;
    }
    try {
      const dirHandle = await picker({ mode: 'read' });
      dirHandleRef.current = dirHandle;
      setScanPath(`/${dirHandle.name}/`);
      // 释放旧 objectURL,清空旧结果
      scannedFiles.forEach((f) => f.url.startsWith('blob:') && URL.revokeObjectURL(f.url));
      setHasScanned(false);
      setScannedFiles([]);
      toast.success(`已选择目录: /${dirHandle.name}/请点击"开始扫描"`);
    } catch (err) {
      // 用户取消选择 → 静默
      if ((err as Error).name === 'AbortError') return;
      toast.error(`目录选择失败: ${(err as Error).message}`);
    }
  };

  /**
   * 真实导入单文件 —— 走 useFileUpload 上传到 COS,然后 assetApi.create 创建业务资源
   * 失败时记录真实错误信息,允许"重试"
   */
  const importOneFile = async (idx: number) => {
    if (!canUpload) return false;
    const target = scannedFiles[idx];
    // 标记 importing + 清空错误
    setScannedFiles((prev) =>
      prev.map((f, i) =>
        i === idx
          ? { ...f, status: 'importing', progress: 0, errorMsg: undefined, checked: false }
          : f,
      ),
    );

    if (!target.extra?.file) {
      // 正常不会到这里(扫描必须经过浏览模式)—— 兜底提示
      setScannedFiles((prev) =>
        prev.map((f, i) =>
          i === idx
            ? { ...f, status: 'failed', progress: 0, errorMsg: '文件对象丢失,请重新扫描', checked: true }
            : f,
        ),
      );
      return false;
    }

    try {
      const { fileResourceId, fileMd5 } = await upload(target.extra.file, (pct) => {
        setScannedFiles((prev) =>
          prev.map((f, i) => (i === idx ? { ...f, progress: pct } : f)),
        );
      });
      // 创建业务资源(与本地上传一致)
      // assetKind 根据 target.extra.file 推断(IMAGE/VIDEO)
      const kind = target.extra?.file ? inferAssetKind(target.extra.file) : 'IMAGE';
      await assetApi.create({
        fileResourceId,
        fileMd5,
        name: target.name,
        productId: effectiveProductId,
        assetKind: kind,
        assetType: 'PRODUCT_ORIGINAL',
      });
      setScannedFiles((prev) =>
        prev.map((f, i) => (i === idx ? { ...f, status: 'success', progress: 100 } : f)),
      );
      return true;
    } catch (err) {
      setScannedFiles((prev) =>
        prev.map((f, i) =>
          i === idx
            ? {
                ...f,
                status: 'failed',
                progress: 0,
                errorMsg: (err as Error).message,
                checked: true,
              }
            : f,
        ),
      );
      return false;
    }
  };

  const [isImporting, setIsImporting] = useState(false);

  /**
   * 批量导入 —— 对所有 checked + status='pending' 的文件并行模拟上传
   */
  const handleImportScanned = async () => {
    if (!canUpload) return;
    const pendingIdx = scannedFiles
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.checked && f.status === 'pending')
      .map(({ i }) => i);
    if (pendingIdx.length === 0) {
      toast.error('请至少勾选一个待导入的文件');
      return;
    }

    setIsImporting(true);
    const results = await Promise.all(pendingIdx.map((i) => importOneFile(i)));
    setIsImporting(false);

    const successCount = results.filter(Boolean).length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      toast.success(`已导入 ${successCount} 个文件`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} 个文件失败,点击行尾"重试"按钮可重新导入`);
    }
  };

  /**
   * 单文件重试 —— 把状态回到 pending 后调 importOneFile
   */
  const handleRetryFile = async (idx: number) => {
    if (!canUpload || isImporting) return;
    setIsImporting(true);
    await importOneFile(idx);
    setIsImporting(false);
  };

  /** 分类类型(categoryKind) → 图标 + 颜色 的映射(我的分类区 + 移动 modal 共用) */
  const KIND_META: Record<string, { icon: string; cls: string }> = {
    IMAGE: { icon: 'image', cls: 'text-blue-500' },
    VIDEO: { icon: 'videocam', cls: 'text-purple-500' },
    MIXED: { icon: 'perm_media', cls: 'text-amber-500' },
  };

  /** 公开/私有(isPublic: 'Y' / 'N') → Lucide 图标 + 颜色 的映射(对齐 ResourceCategoryList) */
  const VISIBILITY_META: Record<'Y' | 'N', { Icon: typeof Globe; cls: string; title: string }> = {
    Y: { Icon: Globe, cls: 'text-emerald-500', title: '公开分类' },
    N: { Icon: Lock, cls: 'text-slate-300', title: '私有分类' },
  };

  /**
   * 关闭扫描 modal —— 检查是否有上传成功的资源,有则刷新资源中心列表
   * 适用于:头部 X、footer 取消、全成功时的"完成"按钮
   */
  /** 关闭整个 AssetTransitModal —— 重置折叠状态 + 调父组件 onClose */
  const handleMainClose = () => {
    setCollapsedIds(new Set());
    setSelectedCategoryId(null);
    setSelectedAssetIds([]);
    setMergeDrawerItems(null);
    setMergeTargetProductIds([]);
    onClose();
  };

  const closeScanModal = () => {
    const successCount = scannedFiles.filter((f) => f.status === 'success').length;
    // 释放 objectURL
    scannedFiles.forEach((f) => f.url.startsWith('blob:') && URL.revokeObjectURL(f.url));
    dirHandleRef.current = null;
    setIsScanOpen(false);
    setHasScanned(false);
    setScannedFiles([]);
    setScanPath('');  // 下次打开是空白状态,需重新选择
    if (successCount > 0) {
      refetch();
    }
  };

  /** 完成按钮 —— 全部 success 时显示,与 closeScanModal 行为一致(都刷新) */
  const handleFinishImport = () => {
    closeScanModal();
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black/40 p-4 md:p-8 select-none animate-fadeIn ${
      targetSlot.startsWith('model-profile-') ? 'z-[90]' : 'z-50'
    }`}>
      
      {/* Hidden Upload Input */}
      {canUpload && (
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          ref={fileInputRef}
          onChange={handleLocalUploadChange}
          className="hidden"
        />
      )}

      {/* Main Modal Container */}
      <div className="bg-white w-full max-w-[1280px] h-[min(820px,calc(100vh-64px))] min-h-[620px] rounded-lg shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header section matching prototype */}
        <header className="flex min-h-16 items-center justify-between gap-5 border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white">
              <span className="material-symbols-outlined font-bold text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>dataset</span>
            </div>
            <h1 className="text-base font-extrabold text-slate-800">资源中心</h1>
            <div className="ml-4 flex h-16 items-end gap-6">
              {productSourceAvailable && (
                <button
                  type="button"
                  onClick={() => handleSourceChange('PRODUCT')}
                  className={`relative flex h-16 items-center gap-2 border-b-2 px-0 text-xs font-extrabold transition-colors ${
                    activeSource === 'PRODUCT'
                      ? 'border-blue-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">inventory_2</span>
                  产品素材
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSourceChange('UPLOAD')}
                className={`relative flex h-16 items-center gap-2 border-b-2 px-0 text-xs font-extrabold transition-colors ${
                  activeSource === 'UPLOAD'
                    ? 'border-blue-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-base">category</span>
                通用素材
              </button>
              {modelSourceAvailable && (
                <button
                  type="button"
                  onClick={() => handleSourceChange('MODEL')}
                  className={`relative flex h-16 items-center gap-2 border-b-2 px-0 text-xs font-extrabold transition-colors ${
                    activeSource === 'MODEL'
                      ? 'border-blue-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">person</span>
                  模特素材
                </button>
              )}
            </div>
          </div>
          <button
            onClick={handleMainClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        {/* Modal body container */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Navigation (分类导航) */}
          <aside className="w-[210px] shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">

            {activeSource !== 'MODEL' && assetKind !== 'AUDIO' && (() => {
              // picker 模式按 assetKind 锁定 tab,只显示对应 kind 的单个 tab;
              // manager 模式仍显示 IMAGE + VIDEO 两个 tab。
              const visibleKinds: Array<'IMAGE' | 'VIDEO'> =
                mode === 'picker'
                  ? [assetKind as 'IMAGE' | 'VIDEO']
                  : (['IMAGE', 'VIDEO'] as const);
              return (
              <div>
                <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">素材类型</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                  {visibleKinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        const nextMediaFilter = mediaFilter === kind ? 'ALL' : kind;
                        setMediaFilter(nextMediaFilter);
                        setSelectedAssetIds([]);
                      }}
                      className={`flex h-8 items-center justify-center gap-1 rounded-md text-[11px] font-bold ${
                        mediaFilter === kind
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{kind === 'IMAGE' ? 'image' : 'videocam'}</span>
                      {kind === 'IMAGE' ? '图片' : '视频'}
                    </button>
                  ))}
                </div>
              </div>
              );
            })()}

            {/* 我的分类 —— 真实分类树(从 assetCategoryApi.tree 加载) */}
            <div className={`flex flex-col gap-2 ${activeSource !== 'UPLOAD' ? 'hidden' : ''}`}>
              <p className="text-[10px] font-extrabold text-slate-400 px-3 uppercase tracking-wider">通用素材分类</p>
              {categoryTreeError ? (
                <div className="px-3 py-2 text-[10px] text-red-500 font-medium">
                  加载失败: {categoryTreeError}
                </div>
              ) : categoryTree.length === 0 ? (
                <div className="px-3 py-2 text-[10px] text-slate-400 font-medium">
                  暂无分类
                </div>
              ) : (() => {
// 分类类型(categoryKind) → 图标 + 颜色 来自外层 KIND_META

                // 递归渲染分类树 —— 折叠/展开支持
                const renderNode = (node: AssetCategoryNode, depth: number): React.ReactNode => {
                  const isSelected = selectedCategoryId === node.id;
                  const kindMeta = node.categoryKind ? KIND_META[node.categoryKind] : undefined;
                  const visMeta = node.isPublic === 'Y' || node.isPublic === 'N' ? VISIBILITY_META[node.isPublic] : undefined;
                  const hasChildren = (node.children?.length ?? 0) > 0;
                  const isCollapsed = collapsedIds.has(node.id);
                  return (
                    <React.Fragment key={node.id}>
                      <button
                        onClick={() => {
                          // 切换选中:再次点同一节点取消选中(回到全部)
                          setSelectedCategoryId(isSelected ? null : node.id);
                        }}
                        className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                        style={{ paddingLeft: `${12 + depth * 12}px` }}
                      >
                        {/* 展开/折叠按钮(对齐 ResourceCategoryList) */}
                        {hasChildren ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(node.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleCollapse(node.id);
                              }
                            }}
                            className="shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            title={isCollapsed ? '展开' : '折叠'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        ) : (
                          <span className="shrink-0 w-4 h-4" />
                        )}
                        <span
                          className="material-symbols-outlined text-base shrink-0"
                          style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          {depth === 0 ? 'label' : 'subdirectory_arrow_right'}
                        </span>
                        <span className="truncate flex-1">{node.categoryName ?? '未命名分类'}</span>
                        {kindMeta && (
                          <span
                            className={`material-symbols-outlined text-[14px] shrink-0 ${kindMeta.cls}`}
                            title={node.categoryKind}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {kindMeta.icon}
                          </span>
                        )}
                        {visMeta && (
                          <visMeta.Icon
                            className={`shrink-0 w-3.5 h-3.5 ${visMeta.cls}`}
                            title={visMeta.title}
                            strokeWidth={2.5}
                          />
                        )}
                      </button>
                      {!isCollapsed && node.children?.map((child) => renderNode(child, depth + 1))}
                    </React.Fragment>
                  );
                };
                return (
                  <nav className="flex flex-col gap-0.5">
                    {categoryTree.map((node) => renderNode(node, 0))}
                  </nav>
                );
              })()}
            </div>

            {activeSource === 'PRODUCT' && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-extrabold text-slate-400 px-3 uppercase tracking-wider">
                  产品分类
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedProductCategoryId(null)}
                  disabled={focusedProduct !== null}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold ${
                    selectedProductCategoryId == null ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-white'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="material-symbols-outlined text-base">photo_library</span>
                  <span>全部产品</span>
                </button>
                {productCategoryTreeError && (
                  <p className="px-3 text-[10px] leading-5 text-red-400">产品分类加载失败：{productCategoryTreeError}</p>
                )}
                {(() => {
                  const renderProductCategory = (node: ProductCategoryNode, depth: number): React.ReactNode => {
                    const nodeId = String(node.id);
                    const selected = selectedProductCategoryId === nodeId;
                    const hasChildren = Boolean(node.children?.length);
                    const collapsed = collapsedProductCategoryIds.has(nodeId);
                    return (
                      <React.Fragment key={nodeId}>
                        <button
                          type="button"
                          onClick={() => setSelectedProductCategoryId(selected ? null : nodeId)}
                          disabled={focusedProduct !== null}
                          className={`flex w-full items-center gap-1 rounded-lg py-2 pr-3 text-left text-[11px] font-bold ${
                            selected ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-white'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          style={{ paddingLeft: `${12 + depth * 12}px` }}
                        >
                          {hasChildren ? (
                            <span
                              role="button"
                              tabIndex={focusedProduct ? -1 : 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (focusedProduct) return;
                                setCollapsedProductCategoryIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(nodeId)) next.delete(nodeId);
                                  else next.add(nodeId);
                                  return next;
                                });
                              }}
                              className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400"
                              title={collapsed ? '展开' : '折叠'}
                            >
                              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </span>
                          ) : (
                            <span className="h-4 w-4 shrink-0" />
                          )}
                          <span className="material-symbols-outlined shrink-0 text-sm">
                            {depth === 0 ? 'folder' : 'subdirectory_arrow_right'}
                          </span>
                          <span className="truncate">{node.categoryName}</span>
                        </button>
                        {!collapsed && node.children?.map((child) => renderProductCategory(child, depth + 1))}
                      </React.Fragment>
                    );
                  };
                  return productCategoryTree.map((node) => renderProductCategory(node, 0));
                })()}
                <p className="px-3 pt-2 text-[10px] leading-5 text-slate-400">
                  {focusedProduct
                    ? '当前正在查看 SKU 素材，产品分类筛选暂不生效。'
                    : '按产品分类筛选产品，再选择 SKU 查看其图片或视频素材。'}
                </p>
              </div>
            )}

            {activeSource === 'MODEL' && (
              <div className="flex flex-col gap-2">
                <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  模特素材
                </p>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-left text-xs font-bold text-blue-600"
                >
                  <span className="material-symbols-outlined text-base">face_3</span>
                  <span>全部可用模特</span>
                </button>
                <p className="px-3 pt-2 text-[10px] leading-5 text-slate-400">
                  展示已发布的模特档案。选择后会作为标准图片资源用于当前任务。
                </p>
              </div>
            )}

            {/* Storage Progress Meter in bottom of navigation */}
            <div className="mt-auto rounded-lg border border-blue-100 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">存储空间</span>
                <span className="text-[10px] font-bold text-slate-500">82%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[82%]" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-2">已使用 4.1GB / 5.0GB</p>
            </div>
          </aside>

          {/* Main workspace layout */}
          <main className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden relative">
            
            {/* Action panel & search filters */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
              {activeSource === 'UPLOAD' ? (
                <div className="flex items-center gap-2">
                  {canMerge && (
                    <button
                      type="button"
                      onClick={handleMergeClick}
                      disabled={!canMergeSelected}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">view_quilt</span>
                      合并图片
                    </button>
                  )}
                  {canUpload && <button
                    onClick={handleLocalUploadTrigger}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-sm">cloud_upload</span>
                    <span>本地上传</span>
                  </button>}
                  {canUpload && <button
                    onClick={handleDirectoryScanOpen}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-sm">scan</span>
                    <span>目录扫描</span>
                  </button>}
                  {canCreateModel && targetSlot === 'reference-model' && onCreateModel && (
                    <button
                      type="button"
                      onClick={onCreateModel}
                      className="flex items-center gap-2 border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      <span>新建 AI 模特</span>
                    </button>
                  )}
                </div>
              ) : activeSource === 'PRODUCT' ? (
                <div className="flex items-center gap-2">
                  {focusedProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedProduct(null);
                        setSelectedAssetIds([]);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      返回产品列表
                    </button>
                  )}
                  {focusedProduct && canMergeProducts && (
                    <button
                      type="button"
                      onClick={handleFocusedProductMerge}
                      disabled={!canMergeFocusedProductAssets}
                      title={canMergeFocusedProductAssets ? '合并选中的产品素材' : '请先选择至少两张图片素材'}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">view_quilt</span>
                      合并图片
                    </button>
                  )}
                  {!focusedProduct && canMergeProducts && selectedProductIds.length >= 2 && (
                    <span>
                      <button
                        type="button"
                        onClick={() => void handleProductCompose()}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-sm">view_quilt</span>
                        合并
                      </button>
                    </span>
                  )}
                  {canUpload && (
                    <button
                      type="button"
                      onClick={handleLocalUploadTrigger}
                      disabled={!effectiveProductId}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      本地上传
                    </button>
                  )}
                  {canUpload && (
                    <button
                      type="button"
                      onClick={handleDirectoryScanOpen}
                      disabled={!effectiveProductId}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">scan</span>
                      目录扫描
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span className="material-symbols-outlined text-base text-blue-500">face_3</span>
                    <span>已发布模特资源</span>
                  </div>
                  {canCreateModel && onCreateModel && (
                    <button
                      type="button"
                      onClick={onCreateModel}
                      className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      <span>新建 AI 模特</span>
                    </button>
                  )}
                </div>
              )}

              {/* Filters search */}
              <div className="flex items-center gap-3 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input 
                    type="text" 
                    placeholder={
                      activeSource === 'PRODUCT'
                        ? focusedProduct ? '搜索当前 SKU 素材' : '搜索 ERP 商品名称、SPU 或 SKU'
                        : activeSource === 'MODEL'
                          ? '搜索模特名称或标签'
                          : '搜索资源文件名'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold text-slate-400 self-center">
                    {activeSource === 'PRODUCT'
                      ? focusedProduct ? `${focusedProduct.spuName} · ${focusedProduct.sku.code}` : '按 SKU 展示'
                      : activeSource === 'MODEL'
                        ? '模特资源'
                        : '仅我的未关联素材'}
                  </span>
                </div>
              </div>
            </div>

            {/* 产品素材详情只保留状态/时间筛选，不显示通用素材的图片槽位标签。 */}
            {activeSource === 'PRODUCT' && focusedProduct && (
              <div className="flex min-h-14 items-center gap-2 border-b border-slate-200 bg-white px-5">
                {(['all', 'recent', 'archived'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPrimaryFilter(value)}
                    className={`h-8 rounded-md border px-3 text-[11px] font-bold ${
                      primaryFilter === value
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {value === 'all' ? '全部' : value === 'recent' ? '最近使用' : '已归档'}
                  </button>
                ))}
              </div>
            )}

            {/* 通用图片、视频及全部类型共用时间筛选和槽位快捷筛选；音频不展示。 */}
            {activeSource === 'UPLOAD' && mediaFilter !== 'AUDIO' && (
              <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-5 py-2">
                {(['all', 'recent'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPrimaryFilter(value)}
                    className={`h-8 rounded-md border px-3 text-[11px] font-bold ${
                      primaryFilter === value
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {value === 'all' ? '全部' : '最近使用'}
                  </button>
                ))}
                <div className="ml-2 flex flex-wrap items-center gap-1.5">
                  {SLOT_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSlotTagFilter((current) =>
                        current.includes(tag)
                          ? current.filter((item) => item !== tag)
                          : [...current, tag],
                      )}
                      className={`h-8 rounded-md border px-3 text-[11px] font-bold ${
                        slotTagFilter.includes(tag)
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                      }`}
                    >
                      {tag.replace(/参考$/, '')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scrollable grid area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
              {activeSource === 'PRODUCT' && !focusedProduct ? (
                <div className="space-y-6">
                  {productLoading && (
                    <div className="flex items-center justify-center py-16 text-xs font-bold text-slate-400">
                      <span className="material-symbols-outlined mr-2 animate-spin text-base">progress_activity</span>
                      正在加载产品...
                    </div>
                  )}
                  {!productLoading && productError && (
                    <div className="py-16 text-center text-xs font-bold text-red-500">产品加载失败：{productError.message}</div>
                  )}
                  {!productLoading && !productError && (() => {
                    const renderSkuCard = (spu: ProductSpuView, sku: ProductSkuView) => {
                      const selected = selectedProductSkuIds.includes(sku.id);
                      return (
                        <article
                          key={sku.id}
                          onClick={() => {
                            // [2026-08-15] 任务选素材(picker):SKU 单选,再点取消;管理端保持多选
                            if (mode === 'picker') {
                              setSelectedProductSkuIds((current) =>
                                current.includes(sku.id) ? [] : [sku.id]);
                            } else {
                              setSelectedProductSkuIds((current) =>
                                current.includes(sku.id)
                                  ? current.filter((id) => id !== sku.id)
                                  : [...current, sku.id],
                              );
                            }
                          }}
                          className={`group relative min-w-0 cursor-pointer overflow-hidden rounded-lg border bg-white transition-all hover:shadow-md ${
                            selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                          }`}
                        >
                          <div className="relative aspect-square overflow-hidden bg-white">
                            <AssetImage
                              urls={[sku.imageUrl, spu.imageUrl]}
                              alt={`${spu.name} ${sku.name}`}
                              assetKind="IMAGE"
                              objectFit="contain"
                              className="h-full w-full"
                            />
                            <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border text-[11px] ${
                              selected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white/95 text-transparent'
                            }`}>✓</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setFocusedProduct({ spuName: spu.name, productId: sku.productId, sku });
                                setSelectedAssetIds([]);
                              }}
                              className="absolute bottom-2 right-2 flex h-8 items-center gap-1 rounded-md border border-blue-200 bg-white/95 px-2 text-[10px] font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                            >
                              <span className="material-symbols-outlined text-sm">photo_library</span>
                              查看素材
                            </button>
                          </div>
                          <div className="p-3">
                            <h4 className="truncate text-xs font-extrabold text-slate-800">{spu.name}</h4>
                            <p className="mt-1 truncate text-[10px] text-slate-500">{sku.name} · {sku.code}</p>
                            <div className="mt-3 flex min-h-5 items-end justify-between gap-2">
                              <span className="text-[9px] text-slate-400">{sku.materialCount} 张素材</span>
                            </div>
                          </div>
                        </article>
                      );
                    };
                    const multiSpec = productSpus.filter((spu) => spu.skus.length > 1);
                    const singleSpec = productSpus.filter((spu) => spu.skus.length === 1);
                    return (
                      <>
                        {multiSpec.map((spu) => (
                          <section key={spu.id}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <h3 className="text-xs font-extrabold text-slate-800">{spu.name}</h3>
                                <span className="rounded bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">{spu.code}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">{spu.skus.length} 个 SKU</span>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                              {spu.skus.map((sku) => renderSkuCard(spu, sku))}
                            </div>
                          </section>
                        ))}
                        {singleSpec.length > 0 && (
                          <section>
                            <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-extrabold text-slate-800">单规格商品</h3><span className="text-[10px] text-slate-400">直接按 SKU 展示</span></div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                              {singleSpec.map((spu) => renderSkuCard(spu, spu.skus[0]))}
                            </div>
                          </section>
                        )}
                        {productSpus.length === 0 && (
                          <div className="py-16 text-center text-xs font-bold text-slate-400">暂无符合条件的产品</div>
                        )}
                        {productSpus.length > 0 && (
                          <>
                            {productAppending && (
                              <div className="flex items-center justify-center border-t border-slate-100 bg-white py-3 text-xs font-bold text-slate-400">
                                <span className="material-symbols-outlined mr-2 animate-spin text-base">progress_activity</span>
                                正在加载更多产品...
                              </div>
                            )}
                            {!productAppending && productAppendError && productHasMore && (
                              <div className="flex items-center justify-center gap-3 border-t border-red-100 bg-red-50/70 py-3 text-xs font-bold text-red-500">
                                <span>加载更多失败：{productAppendError.message}</span>
                                <button
                                  type="button"
                                  onClick={() => void loadProductPage(
                                    productNextPageRef.current,
                                    productQueryVersionRef.current,
                                  )}
                                  className="rounded-md border border-red-200 bg-white px-3 py-1 text-[11px] text-red-600 hover:bg-red-50"
                                >
                                  重试
                                </button>
                              </div>
                            )}
                            {!productAppending && !productHasMore && (
                              <div className="border-t border-slate-100 bg-white py-3 text-center text-xs font-bold text-slate-400">
                                — 已经到底了 —(共 {productTotal} 个产品)
                              </div>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
              <>
              {focusedProduct && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{focusedProduct.spuName}</h3>
                    <p className="mt-1 text-[10px] text-slate-500">{focusedProduct.sku.name} · {focusedProduct.sku.code}</p>
                  </div>
                  <span className="rounded bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">产品素材</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {loading && (
                  <div className="col-span-full flex items-center justify-center py-16 text-xs font-bold text-slate-400">
                    <span className="material-symbols-outlined mr-2 animate-spin text-base">progress_activity</span>
                    正在加载资源...
                  </div>
                )}
                {!loading && queryError && (
                  <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-xs font-bold text-red-500">
                    <span>资源加载失败：{queryError.message}</span>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-red-600 cursor-pointer"
                    >
                      重新加载
                    </button>
                  </div>
                )}

                {/* 固定首位:上传资源占位卡片(点击触发本地上传) */}
                {canUpload && !loading && !queryError && activeSource === 'UPLOAD' && (
                  <div
                    onClick={handleLocalUploadTrigger}
                    className="group relative flex flex-col bg-white rounded-xl border border-slate-200 border-dashed overflow-hidden hover:bg-slate-50 transition-all cursor-pointer justify-center items-center p-6 aspect-square"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-3xl group-hover:text-blue-500 mb-2 transition-colors">add_photo_alternate</span>
                    <p className="text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors">上传资源...</p>
                  </div>
                )}

                {!loading && !queryError && (() => {
                  return filteredAssets.map((asset) => {
                    const isSelected = selectedAssetIds.includes(asset.id);
                    const selectIndex = selectedAssetIds.indexOf(asset.id) + 1;
                    const resourceLabel = asset.inModelLibrary
                      ? '模特素材'
                      : asset.tags?.split(',')[0] ?? '';
                    // [2026-08-15] 槽位标签(图片任务参考图标记)
                    const slotTags = (asset.tags ?? '')
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter((tag) => SLOT_TAGS.includes(tag));
                    return (
                      <div
                        key={asset.id}
                        onClick={() => handleCardClick(asset.id)}
                        className={`group relative flex flex-col bg-white rounded-xl border overflow-hidden hover:shadow-md transition-all cursor-pointer ${
                          isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200'
                        }`}
                      >
                        <div className="aspect-square relative overflow-hidden bg-slate-50">
                          <AssetImage
                            urls={[asset.originalUrl, asset.thumbnailUrl]}
                            alt={asset.name}
                            assetKind={asset.assetKind}
                            objectFit="contain"
                            className="w-full h-full"
                          />
                          {/* Selected Index circular badge top-left */}
                          <div className={`pointer-events-none absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm transition-all ${
                            isSelected ? 'bg-blue-600 text-white' : 'border-2 border-white bg-black/20 text-transparent'
                          }`}>
                            {isSelected ? selectIndex : ''}
                          </div>
                          {/* 资源类型三角形角标(右上角,小尺寸) */}
                          {asset.assetKind && (
                            <div
                              className="absolute top-0 right-0 w-7 h-7 pointer-events-none"
                              title={asset.assetKind === 'VIDEO' ? '视频' : '图片'}
                            >
                              {/* 三角形(右上等腰,斜边 45°) */}
                              <div
                                className={`absolute inset-0 ${
                                  asset.assetKind === 'VIDEO' ? 'bg-purple-500/90' : 'bg-blue-500/90'
                                }`}
                                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}
                              />
                              {/* 图标嵌在三角形"内角"位置 */}
                              <span
                                className="absolute top-0.5 right-0.5 material-symbols-outlined text-white text-[10px] leading-none"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                {asset.assetKind === 'VIDEO' ? 'videocam' : 'image'}
                              </span>
                            </div>
                          )}
                          {/* 纯视觉蒙层必须允许鼠标事件穿透，否则会挡住 AssetImage 的视频 hover 播放监听。 */}
                          <div className="pointer-events-none absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {(asset.isProductMainImage || (activeSource === 'PRODUCT' && focusedProduct && asset.isProductCover)) && (
                            <span className={`pointer-events-none absolute bottom-2 left-2 rounded px-2 py-1 text-[9px] font-bold ${
                              asset.isProductCover
                                ? 'border border-blue-200 bg-blue-50/95 text-blue-700'
                                : 'border border-slate-200 bg-white/95 text-slate-600'
                            }`}>
                              {asset.isProductMainImage && asset.isProductCover
                                ? '商品主图 · 封面图'
                                : asset.isProductMainImage
                                  ? '商品主图'
                                  : '封面图'}
                            </span>
                          )}
                          {/* [2026-08-15] 图片底部槽位标签(中文,去掉"参考"后缀) */}
                          {slotTags.length > 0 && (
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-1 pointer-events-none">
                              {slotTags.map((tag) => (
                                <span key={tag} className="rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                  {tag.replace(/参考$/, '')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="mb-1 flex items-center gap-1">
                            <p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">
                              {asset.name}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                              asset.inModelLibrary ? 'bg-violet-50 text-violet-600' :
                              asset.tags?.includes('商品原图') ? 'bg-slate-100 text-slate-600' :
                              asset.tags?.includes('白底图') ? 'bg-emerald-50 text-emerald-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {resourceLabel}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono font-medium">{asset.createTime?.split('T')[0] ?? ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                {!loading && !queryError && (activeSource === 'UPLOAD' || activeSource === 'MODEL') && (
                  <div className="col-span-full">
                    {assetAppending && (
                      <div className="flex items-center justify-center border-t border-slate-100 bg-white py-3 text-xs font-bold text-slate-400">
                        <span className="material-symbols-outlined mr-2 animate-spin text-base">progress_activity</span>
                        正在加载更多{activeSource === 'MODEL' ? '模特' : '素材'}...
                      </div>
                    )}
                    {!assetAppending && assetAppendError && assetHasMore && (
                      <div className="flex items-center justify-center gap-3 border-t border-red-100 bg-red-50/70 py-3 text-xs font-bold text-red-500">
                        <span>加载更多失败：{assetAppendError.message}</span>
                        <button
                          type="button"
                          onClick={() => void loadPagedAssets(
                            assetNextPageRef.current,
                            assetQueryVersionRef.current,
                          )}
                          className="rounded-md border border-red-200 bg-white px-3 py-1 text-[11px] text-red-600 hover:bg-red-50"
                        >
                          重试
                        </button>
                      </div>
                    )}
                    {!assetAppending && !assetHasMore && assets.length > 0 && (
                      <div className="border-t border-slate-100 bg-white py-3 text-center text-xs font-bold text-slate-400">
                        — 已经到底了 —(共 {assetTotal} 个{activeSource === 'MODEL' ? '模特' : '素材'})
                      </div>
                    )}
                  </div>
                )}

              </div>
              </>
              )}
            </div>

            {/* Footer matching prototype strictly */}
            <footer className="p-4 px-8 bg-white border-t border-slate-200 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                  <span className="material-symbols-outlined text-blue-600 text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-xs font-extrabold text-blue-600">
                    已选择 {currentSelectionCount} 个{activeSource === 'PRODUCT' && !focusedProduct ? ' SKU' : '资源'}
                  </span>
                </div>
                {currentSelectionCount > 0 && (
                  <>
                    <button
                      onClick={handleClearSelection}
                      className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      清除选择
                    </button>
                    {activeSource === 'UPLOAD' && (
                      <>
                        {canMove && <button
                          onClick={handleMoveClick}
                          className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                        >
                          设置分类
                        </button>}
                        {canMergeSelected && (
                          <button
                            type="button"
                            onClick={handleMergeClick}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">view_quilt</span>
                            合并
                          </button>
                        )}
                        {showSetAsModel && (
                          <button
                            type="button"
                            onClick={handleSetAsModel}
                            disabled={!canSetSelectedAsModel}
                            title={setAsModelDisabledReason}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                          >
                            <span className="material-symbols-outlined text-sm">person_add</span>
                            {isSettingAsModel ? '添加中...' : '设为模特'}
                          </button>
                        )}
                      </>
                    )}
                    {activeSource === 'PRODUCT'
                      && !focusedProduct
                      && canMergeProducts
                      && selectedProductIds.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => void handleProductCompose()}
                          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">view_quilt</span>
                          合并
                        </button>
                      )}
                    {activeSource === 'PRODUCT' && focusedProduct && canMergeFocusedProductAssets && (
                      <button
                        type="button"
                        onClick={handleFocusedProductMerge}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">view_quilt</span>
                        合并
                      </button>
                    )}
                    {canSetProductCover && (
                      <button
                        type="button"
                        onClick={handleSetProductCover}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        设为封面
                      </button>
                    )}
                    {canAssociateSelectedAsset && (
                      <button
                        type="button"
                        onClick={handleAssociateSelectedAsset}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        关联产品
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {canDeleteSelected && (activeSource === 'UPLOAD' || (activeSource === 'PRODUCT' && focusedProduct)) && (
                  <button
                    onClick={handleDeleteSelected}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline bg-transparent border-none cursor-pointer"
                  >
                    {activeSource === 'PRODUCT' ? '删除素材' : '删除资源'}
                  </button>
                )}
                <button
                  onClick={handleMainClose}
                  className="px-6 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmSelection}
                  disabled={
                    mode === 'manager'
                    || confirmingSelection
                    || (!canConfirmProductSku && selectedAssetIds.length === 0)
                    || (!canConfirmProductSku && activeSource === 'PRODUCT' && !focusedProduct)
                  }
                  title={
                    mode === 'manager'
                      ? '管理型入口,不需要选择资源'
                      : canConfirmProductSku
                        ? undefined
                        : selectedAssetIds.length === 0
                          ? '请先选择资源'
                          : undefined
                  }
                  className="px-8 py-2 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {confirmingSelection ? '处理中...' : '确认选择'}
                </button>
              </div>
            </footer>

            {mergeDrawerItems && (
              <ResourceMergeDrawer
                items={mergeDrawerItems}
                categoryId={selectedCategoryId ?? undefined}
                productIds={mergeTargetProductIds}
                defaultDirection={mergeTargetProductIds.length === 1 && focusedProduct
                  && mergeTargetProductIds[0] === focusedProduct.productId
                  ? 'VERTICAL'
                  : undefined}
                onAssetCreated={mergeTargetProductIds.length === 1 && focusedProduct
                  && mergeTargetProductIds[0] === focusedProduct.productId
                  ? async (assetId) => {
                    await productLibraryApi.setInputAssetCover(focusedProduct.productId, assetId);
                  }
                  : undefined}
                onClose={() => {
                  setMergeDrawerItems(null);
                  setMergeTargetProductIds([]);
                }}
                onUploaded={async () => {
                  setMergeDrawerItems(null);
                  setMergeTargetProductIds([]);
                  setSelectedAssetIds([]);
                  setSelectedProductSkuIds([]);
                  await refetch();
                }}
              />
            )}

            <ProductPickerModal
              open={productAssociationPickerOpen}
              requireCreatable={false}
              onClose={() => {
                setProductAssociationPickerOpen(false);
                setAssociationAsset(null);
              }}
              onPick={handleAssociateExistingProduct}
              onCreate={associationAsset?.assetKind === 'IMAGE'
                ? () => {
                    setProductAssociationPickerOpen(false);
                    setProductCreationAsset(associationAsset);
                  }
                : undefined}
            />
            <CreateProductFromAssetDialog
              asset={productCreationAsset}
              onCancel={() => setProductCreationAsset(null)}
              onCreated={() => {
                setProductCreationAsset(null);
                setAssociationAsset(null);
                setSelectedAssetIds([]);
                void refetch();
              }}
            />

            {/* MOVE TO CATEGORY OVERLAY */}
            {isMoveModalOpen && (
              <div className="absolute inset-0 bg-black/40 z-40 flex items-center justify-center p-6 animate-fadeIn">
                <div
                  className="bg-white max-w-md w-full rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[80%] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">移动到分类</h3>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        已选择 {selectedAssetIds.length} 个资源,请选择目标分类(仅叶子节点可选)
                      </p>
                    </div>
                    <button
                      onClick={handleMoveCancel}
                      disabled={isMoving}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>

                  {/* Tree body */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {categoryTreeError ? (
                      <div className="px-3 py-3 text-xs text-red-500 font-medium">
                        分类加载失败: {categoryTreeError}
                      </div>
                    ) : categoryTree.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-400 font-medium">
                        暂无可用分类
                      </div>
                    ) : (() => {
                      // 递归渲染 —— 叶子可点选,非叶子灰色 + 图标提示
                      const renderMoveNode = (node: AssetCategoryNode, depth: number): React.ReactNode => {
                        const leaf = isLeaf(node);
                        const isSelected = moveTargetCategoryId === node.id;
                        const kindMeta = node.categoryKind ? KIND_META[node.categoryKind] : undefined;
                        const visMeta = node.isPublic === 'Y' || node.isPublic === 'N' ? VISIBILITY_META[node.isPublic] : undefined;
                        return (
                          <React.Fragment key={node.id}>
                            <button
                              type="button"
                              disabled={!leaf || isMoving}
                              onClick={() => {
                                if (!leaf) return;
                                setMoveTargetCategoryId(node.id);
                                setMoveTargetCategoryName(node.categoryName ?? '');
                              }}
                              className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-600 cursor-pointer'
                                  : leaf
                                    ? 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                                    : 'text-slate-300 cursor-not-allowed'
                              } ${isMoving ? 'opacity-60' : ''}`}
                              style={{ paddingLeft: `${12 + depth * 14}px` }}
                            >
                              <span
                                className="material-symbols-outlined text-sm shrink-0"
                                style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}
                              >
                                {leaf ? (isSelected ? 'check_box' : 'check_box_outline_blank') : 'folder'}
                              </span>
                              <span className="truncate flex-1">{node.categoryName ?? '未命名分类'}</span>
                              {kindMeta && (
                                <span
                                  className={`material-symbols-outlined text-[14px] shrink-0 ${kindMeta.cls} ${!leaf ? 'opacity-40' : ''}`}
                                  title={node.categoryKind}
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  {kindMeta.icon}
                                </span>
                              )}
                              {visMeta && (
                                <visMeta.Icon
                                  className={`shrink-0 w-3.5 h-3.5 ${visMeta.cls} ${!leaf ? 'opacity-40' : ''}`}
                                  title={visMeta.title}
                                  strokeWidth={2.5}
                                />
                              )}
                              {!leaf && (
                                <span className="text-[10px] text-slate-300 font-medium shrink-0">
                                  非叶子
                                </span>
                              )}
                            </button>
                            {node.children?.map((child) => renderMoveNode(child, depth + 1))}
                          </React.Fragment>
                        );
                      };
                      return (
                        <div className="flex flex-col gap-0.5">
                          {categoryTree.map((node) => renderMoveNode(node, 0))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      目标: <span className="text-blue-600 font-bold">{moveTargetCategoryName || '未选择'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleMoveCancel}
                        disabled={isMoving}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleMoveConfirm}
                        disabled={moveTargetCategoryId === null || isMoving}
                        className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isMoving ? '移动中...' : '确认移动'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DIRECTORY SCAN OVERLAY DRAWER */}
            {isScanOpen && (
              <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center p-6 animate-fadeIn">
                <div className="bg-white max-w-lg w-full rounded-xl shadow-xl border border-slate-200 flex flex-col max-h-[90%] overflow-hidden">

                  {/* Scan Header */}
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2 text-slate-800">
                      <span className="material-symbols-outlined text-blue-600 font-bold">scan</span>
                      <h3 className="text-sm font-extrabold">目录扫描获取素材</h3>
                    </div>
                    <button
                      onClick={() => {
                        if (isImporting) return;
                        closeScanModal();
                      }}
                      disabled={isImporting}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>

                  {/* Scan Body */}
                  <div className="p-5 flex-1 overflow-y-auto space-y-4">

                    {/* Path input + 浏览 + 扫描 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        当前选择的文件夹路径 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={scanPath}
                          readOnly
                          placeholder="请点击右侧'浏览'选择文件夹"
                          disabled={isImporting}
                          className="flex-1 min-w-0 h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium outline-none bg-slate-50 text-slate-600 cursor-not-allowed disabled:cursor-not-allowed"
                        />
                        <button
                          onClick={handleBrowseClick}
                          disabled={isScanning || isImporting}
                          className="px-3 h-9 border border-slate-200 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-sm">folder_open</span>
                          浏览
                        </button>
                        <button
                          onClick={handleTriggerScan}
                          disabled={isScanning || isImporting}
                          className="px-4 h-9 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 cursor-pointer flex items-center shrink-0 disabled:bg-blue-400 disabled:cursor-not-allowed"
                        >
                          {isScanning ? '扫描中...' : '开始扫描'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        请点击"浏览"选择文件夹(会自动列出其中的图片)
                      </p>
                    </div>

                    {isScanning && (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <span className="material-symbols-outlined text-4xl text-blue-600 animate-spin">sync</span>
                        <p className="text-xs font-bold text-slate-500">正在快速检索文件路径，读取元数据...</p>
                      </div>
                    )}

                    {hasScanned && scannedFiles.length > 0 && (() => {
                      // 状态计数
                      const successCount = scannedFiles.filter((f) => f.status === 'success').length;
                      const failedCount = scannedFiles.filter((f) => f.status === 'failed').length;
                      const importingCount = scannedFiles.filter((f) => f.status === 'importing').length;
                      const pendingCheckedCount = scannedFiles.filter((f) => f.checked && f.status === 'pending').length;
                      const allSuccess = successCount === scannedFiles.length && scannedFiles.length > 0;
                      return (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-slate-600 flex justify-between items-center">
                            <span>
                              已扫描到以下文件 ({scannedFiles.length} 个):
                              {importingCount > 0 && (
                                <span className="ml-2 text-blue-600 font-mono">导入中 {importingCount}</span>
                              )}
                              {successCount > 0 && (
                                <span className="ml-2 text-green-600 font-mono">已完成 {successCount}</span>
                              )}
                              {failedCount > 0 && (
                                <span className="ml-2 text-red-600 font-mono">失败 {failedCount}</span>
                              )}
                            </span>
                          </p>

                          {/* Files Checklist —— 每行带状态机视觉 */}
                          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
                            {scannedFiles.map((file, idx) => {
                              const isLocked = file.status === 'success' || file.status === 'importing';
                              return (
                                <div
                                  key={idx}
                                  className={`p-3 flex items-center gap-3 transition-colors ${
                                    file.status === 'success' ? 'bg-green-50/40' :
                                    file.status === 'failed' ? 'bg-red-50/40' :
                                    file.status === 'importing' ? 'bg-blue-50/30' :
                                    'hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={file.checked}
                                    disabled={isLocked}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setScannedFiles((prev) =>
                                        prev.map((f, i) => (i === idx ? { ...f, checked } : f)),
                                      );
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                  />
                                  <div className="w-10 h-10 rounded shrink-0 relative overflow-hidden bg-slate-100">
                                    {file.url ? (
                                      <img
                                        src={file.url}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          // 抽帧失败或 URL 无效 → 隐藏 img,显示下方占位
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : null}
                                    {file.tag === '视频' && (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span
                                          className="material-symbols-outlined text-purple-400 text-base"
                                          style={{ fontVariationSettings: "'FILL' 1" }}
                                        >
                                          play_circle
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`truncate text-xs font-bold ${
                                      file.status === 'success'
                                        ? 'text-slate-400 line-through'
                                        : 'text-slate-800'
                                    }`}>
                                      {file.name}
                                    </div>
                                    {/* 进度条(只在 importing 显示) */}
                                    {file.status === 'importing' && (
                                      <div className="mt-1.5 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-blue-600 transition-all duration-200"
                                          style={{ width: `${file.progress}%` }}
                                        />
                                      </div>
                                    )}
                                    {/* 失败原因 */}
                                    {file.status === 'failed' && file.errorMsg && (
                                      <div className="text-[10px] text-red-500 font-medium mt-0.5 truncate">
                                        {file.errorMsg}
                                      </div>
                                    )}
                                  </div>
                                  {/* 行尾状态徽标/按钮 */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {file.status === 'success' && (
                                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-green-50 text-green-600">
                                        <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                        已导入
                                      </span>
                                    )}
                                    {file.status === 'failed' && (
                                      <button
                                        onClick={() => handleRetryFile(idx)}
                                        disabled={isImporting}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold text-red-600 hover:bg-red-50 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <span className="material-symbols-outlined text-[12px]">refresh</span>
                                        重试
                                      </button>
                                    )}
                                    {file.status === 'pending' && (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                          file.tag === '视频'
                                            ? 'bg-purple-50 text-purple-600'
                                            : 'bg-blue-50 text-blue-600'
                                        }`}
                                      >
                                        {file.tag}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* 状态提示(全失败/有失败可重试) */}
                          {failedCount > 0 && successCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                              <span className="material-symbols-outlined text-amber-500 text-sm">info</span>
                              <span className="text-[10px] font-bold text-amber-700">
                                {successCount} 个已导入,{failedCount} 个失败,请点击失败行"重试"按钮重新导入
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {hasScanned && scannedFiles.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs font-bold">
                        该路径下暂未检索到可导入的图片文件。
                      </div>
                    )}

                  </div>

                  {/* Scan Footer */}
                  {hasScanned && scannedFiles.length > 0 && (() => {
                    const allSuccess = scannedFiles.every((f) => f.status === 'success');
                    const pendingCheckedCount = scannedFiles.filter((f) => f.checked && f.status === 'pending').length;
                    return (
                      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                        <div className="text-[10px] text-slate-500 font-medium truncate">
                          待导入 <span className="text-blue-600 font-extrabold">{pendingCheckedCount}</span> 个
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() => {
                              if (isImporting) return;
                              closeScanModal();
                            }}
                            disabled={isImporting}
                            className="px-4 py-2 border border-slate-200 font-bold text-slate-500 rounded-lg text-xs bg-white hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            取消
                          </button>
                          {allSuccess ? (
                            <button
                              onClick={handleFinishImport}
                              className="px-6 py-2 bg-green-600 text-white font-extrabold rounded-lg text-xs hover:bg-green-700 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                              完成
                            </button>
                          ) : (
                            <button
                              onClick={handleImportScanned}
                              disabled={isImporting || pendingCheckedCount === 0}
                              className="px-6 py-2 bg-blue-600 text-white font-extrabold rounded-lg text-xs hover:bg-blue-700 transition-colors cursor-pointer disabled:bg-blue-400 disabled:cursor-not-allowed"
                            >
                              {isImporting ? '导入中...' : '导入至资源中心'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}

          </main>

        </div>

      </div>
    </div>
  );
};
