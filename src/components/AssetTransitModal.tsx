import React, { useState, useRef, useEffect } from 'react';
import { Globe, Lock, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductAsset } from '../types';
import { assetApi, type AssetResourceItem, type AssetResourceQueryRequest } from '../api/modules/asset';
import { ApiError } from '../api/error';
import {
  productLibraryApi,
  type ProductLibraryAsset,
} from '../api/modules/productLibrary';
import { assetCategoryApi, type AssetCategoryNode } from '../api/modules/assetCategory';
import { modelProfileApi, type ModelProfileDTO } from '../api/modules/modelProfile';
import { useAuth } from '../auth/AuthContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { useConfirm } from './common/ConfirmProvider';
import { AssetImage } from './AssetImage';
import { ResourceMergeDrawer } from './common/ResourceMergeDrawer';

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

const toTransitAsset = (asset: ProductLibraryAsset): TransitAsset => ({
  id: asset.id,
  name: [asset.productName, asset.imageType ?? asset.taskType]
    .filter(Boolean)
    .join('-') || `商品素材-${asset.id}`,
  assetKind: asset.mediaType,
  assetType: 'AI_GENERATED',
  width: asset.width,
  height: asset.height,
  durationSec: asset.durationSec,
  thumbnailUrl: asset.thumbnailUrl ?? asset.url,
  originalUrl: asset.url,
  description: asset.taskCode ? `来源任务：${asset.taskCode}` : undefined,
  tags: ['商品素材', asset.style, asset.scene, asset.action].filter(Boolean).join(','),
  uploadUserId: '',
  productId: asset.productId,
  sourceType: asset.mediaType === 'IMAGE' ? 'GENERATED_IMAGE' : 'GENERATED_VIDEO',
  sourceId: asset.id,
  status: 'NORMAL',
  visibility: 'PRIVATE',
  categoryIds: [],
  createTime: asset.createTime,
});

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
  /** 限定业务选择器可见的数据源；产品管理只开放上传资源。 */
  allowedSources?: ResourceCenterSource[];
  /** 从资源中心成功添加模特后通知上层刷新模特资源库。 */
  onModelImported?: () => void;
  /** 仅用于业务素材选择，隐藏上传、移动、删除、合并等资源管理能力。 */
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
  initialSource = 'UPLOAD',
  allowedSources = ['UPLOAD', 'PRODUCT', 'MODEL'],
  onModelImported,
  selectionOnly = false,
}) => {
  const productSourceAvailable = allowedSources.includes('PRODUCT') && assetKind !== 'AUDIO';
  const modelSourceAvailable = allowedSources.includes('MODEL') && assetKind === 'IMAGE';
  const [activeSource, setActiveSource] = useState<ResourceCenterSource>(
    initialSource === 'MODEL' && modelSourceAvailable
      ? 'MODEL'
      : initialSource === 'PRODUCT' && productSourceAvailable
        ? 'PRODUCT'
        : 'UPLOAD',
  );
  const [searchQuery, setSearchQuery] = useState('');
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
  const [isSettingAsModel, setIsSettingAsModel] = useState(false);

  // ============ 真后端数据 ============
  const { user, hasPermission } = useAuth();
  const canUpload = !selectionOnly && hasPermission('asset:upload');
  const canMove = !selectionOnly && hasPermission('asset:move');
  const canDelete = !selectionOnly && hasPermission('asset:delete');
  const canMerge = !selectionOnly && hasPermission('asset:merge');
  const canCreateModel = !selectionOnly && hasPermission('model-profile:create');
  const confirm = useConfirm();
  const currentUserId = user?.userId == null ? undefined : String(user.userId);

  // 视图分类 → 后端 query 参数映射
  // 仅由 selectedCategoryId 决定:无选中 = 全部,选中 = 后端 categoryId 过滤
  // manager mode(资源中心全局)不过滤 kind,显示所有;picker mode 按 assetKind 过滤
  const buildQuery = (): AssetResourceQueryRequest => {
    const base: AssetResourceQueryRequest = {
      pageNum: 1,
      pageSize: 100,
    };
    // picker mode 才按 kind 过滤;manager mode 不传(查全部)
    if (mode !== 'manager' && assetKind) {
      base.assetKind = assetKind as 'IMAGE' | 'VIDEO' | 'AUDIO';
    }
    if (selectedCategoryId !== null) {
      return { ...base, categoryId: selectedCategoryId };
    }
    return base;
  };

  // 当前页数据 + 刷新方法
  const [assets, setAssets] = useState<TransitAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<Error | null>(null);

  const refetch = async () => {
    setLoading(true);
    setQueryError(null);
    try {
      if (activeSource === 'MODEL') {
        const page = await modelProfileApi.page({
          pageNum: 1,
          pageSize: 100,
          keyword: searchQuery || undefined,
          status: 'active',
        });
        setAssets(page.list
          .filter((profile) => Boolean(profile.assetResourceId && profile.image))
          .map(modelProfileToTransitAsset));
      } else if (activeSource === 'PRODUCT') {
        const page = await productLibraryApi.assetPage({
          pageNum: 1,
          pageSize: 100,
          keyword: searchQuery || undefined,
          mediaType: mode !== 'manager' && assetKind !== 'AUDIO'
            ? (assetKind === 'VIDEO' ? 'VIDEO' : 'IMAGE')
            : undefined,
          sortBy: 'latest',
        });
        setAssets(page.list
          .filter((item) => Boolean(item.url))
          .map(toTransitAsset));
      } else {
        const query = { ...buildQuery(), keyword: searchQuery || undefined };
        const page = await assetApi.page(query);
        setAssets(page.list);
      }
    } catch (err) {
      setQueryError(err as Error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  // 触发刷新:searchQuery / currentUserId / productId / selectedCategoryId 任一变化都重发请求
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, currentUserId, productId, selectedCategoryId, activeSource]);

  const handleSourceChange = (source: ResourceCenterSource) => {
    if (!allowedSources.includes(source)
      || source === activeSource
      || (source === 'PRODUCT' && !productSourceAvailable)
      || (source === 'MODEL' && !modelSourceAvailable)) return;
    setActiveSource(source);
    setSelectedAssetIds([]);
    setMergeDrawerItems(null);
    setSelectedCategoryId(null);
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

  // Filter logic —— 服务端 query 已处理 keyword/categoryId,客户端不兜底过滤
  const filteredAssets = assets;
  const canDeleteSelected = canDelete
    && selectedAssetIds.length > 0
    && selectedAssetIds
      .map((id) => assets.find((asset) => asset.id === id))
      .every((asset) => asset != null
        && String(asset.uploadUserId) === currentUserId
        && !asset.productId);
  const selectedItems = selectedAssetIds
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((item): item is AssetResourceItem => item !== undefined);
  const canMergeSelected = canMerge
    && mode === 'manager'
    && activeSource === 'UPLOAD'
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

  const handleCardClick = (id: string) => {
    if (mode === 'manager' && activeSource !== 'UPLOAD') return;
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
    setMergeDrawerItems(null);
  };

  const handleMergeClick = () => {
    if (!canMerge || !canMergeSelected) return;
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

  /**
   * 批量删除选中的资源
   * - useConfirm 弹窗确认(避免误删)
   * - 调 assetApi.deleteBatch(ids)
   * - 后端:删除 asset_resource,若 file_resource 引用归 0,自动物理删除 COS 文件
   * - 成功后清空选中 + 刷新列表
   */
  const handleDeleteSelected = async () => {
    if (!canDelete || selectedAssetIds.length === 0) return;
    const count = selectedAssetIds.length;
    const ok = await confirm({
      title: '删除资源',
      message: `确认要删除选择的 ${count} 个资源吗?`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;

    try {
      const successCount = await assetApi.deleteBatch([...selectedAssetIds]);
      toast.success(`${successCount} 个资源已删除`);
      setSelectedAssetIds([]);
      await refetch();
    } catch (err) {
      toast.error(`删除失败: ${(err as Error).message}`);
    }
  };

  const [confirmingSelection, setConfirmingSelection] = useState(false);

  const handleConfirmSelection = async () => {
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

    setConfirmingSelection(true);
    try {
      const resolvedItems = activeSource === 'PRODUCT'
        ? await assetApi.resolveGenerated(selectedItems.map((item) => ({
            mediaType: item.assetKind as 'IMAGE' | 'VIDEO',
            sourceId: item.id,
          })))
        : selectedItems;

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
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 真上传 hook —— 走腾讯云 COS
  const { upload, loading: uploadLoading } = useFileUpload({
    purpose: (purpose ?? 'OTHER') as 'AVATAR' | 'PRODUCT' | 'OTHER',
    productId,
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
          productId,
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
        productId,
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
    <div className={`fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 md:p-10 select-none animate-fadeIn ${
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
      <div className="bg-white w-full max-w-[1040px] h-[720px] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header section matching prototype */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <span className="material-symbols-outlined font-bold text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>dataset</span>
            </div>
            <h1 className="text-base font-extrabold text-slate-800">资源中心</h1>
            <div className="ml-3 flex items-center rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => handleSourceChange('UPLOAD')}
                className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeSource === 'UPLOAD'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {selectionOnly ? '素材库' : '上传资源'}
              </button>
              {productSourceAvailable && (
                <button
                  type="button"
                  onClick={() => handleSourceChange('PRODUCT')}
                  className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    activeSource === 'PRODUCT'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  商品素材
                </button>
              )}
              {modelSourceAvailable && (
                <button
                  type="button"
                  onClick={() => handleSourceChange('MODEL')}
                  className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    activeSource === 'MODEL'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  模特库
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
          <aside className="w-[240px] border-r border-slate-200 bg-white flex flex-col p-4 gap-4 shrink-0 overflow-y-auto">

            {/* 我的分类 —— 真实分类树(从 assetCategoryApi.tree 加载) */}
            <div className={`flex flex-col gap-2 ${activeSource !== 'UPLOAD' ? 'hidden' : ''}`}>
              <p className="text-[10px] font-extrabold text-slate-400 px-3 uppercase tracking-wider">我的分类</p>
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
                  商品素材
                </p>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full rounded-lg bg-blue-50 px-3 py-2 text-left text-xs font-bold text-blue-600"
                >
                  <span className="material-symbols-outlined text-base">photo_library</span>
                  <span>全部商品素材</span>
                </button>
                <p className="px-3 pt-2 text-[10px] leading-5 text-slate-400">
                  展示已生成的商品图片和视频。选择后会自动转换为任务可使用的标准资源。
                </p>
              </div>
            )}

            {activeSource === 'MODEL' && (
              <div className="flex flex-col gap-2">
                <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  模特库
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
            <div className={`mt-auto p-4 bg-blue-50/50 rounded-xl border border-blue-100 ${
              activeSource !== 'UPLOAD' ? 'hidden' : ''
            }`}>
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
                <div className="flex gap-2">
                  {canUpload && <button
                    onClick={handleLocalUploadTrigger}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">cloud_upload</span>
                    <span>本地上传</span>
                  </button>}
                  {canUpload && <button
                    onClick={() => setIsScanOpen(true)}
                    className="flex items-center gap-2 bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
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
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="material-symbols-outlined text-base text-blue-500">auto_awesome</span>
                  <span>商品任务生成素材</span>
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
                        ? '搜索商品、任务或素材'
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
                      ? '商品素材'
                      : activeSource === 'MODEL'
                        ? '模特资源'
                        : '左侧选择分类'}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable grid area */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
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
                      ? '模特库'
                      : asset.tags?.split(',')[0] ?? '';
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
                          <div className={`absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm transition-all ${
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
                          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="p-3">
                          <div className="mb-1 flex items-center gap-1">
                            {asset.visibility === 'PUBLIC' ? (
                              <Globe className="h-3 w-3 shrink-0 text-emerald-500" aria-label="公共资源" />
                            ) : (
                              <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-label="个人资源" />
                            )}
                            <p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">
                              {asset.name}
                            </p>
                            <span
                              className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-bold ${
                                asset.visibility === 'PUBLIC'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {asset.visibility === 'PUBLIC' ? '公共' : '个人'}
                            </span>
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

              </div>
            </div>

            {/* Footer matching prototype strictly */}
            <footer className="p-4 px-8 bg-white border-t border-slate-200 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                  <span className="material-symbols-outlined text-blue-600 text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-xs font-extrabold text-blue-600">已选择 {selectedAssetIds.length} 个资源</span>
                </div>
                {selectedAssetIds.length > 0 && (
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
                          移动
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
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeSource === 'UPLOAD' && canDeleteSelected && (
                  <button
                    onClick={handleDeleteSelected}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline bg-transparent border-none cursor-pointer"
                  >
                    删除资源
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
                  disabled={mode === 'manager' || selectedAssetIds.length === 0 || confirmingSelection}
                  title={
                    mode === 'manager'
                      ? '管理型入口,不需要选择资源'
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
                onClose={() => setMergeDrawerItems(null)}
                onUploaded={async () => {
                  setMergeDrawerItems(null);
                  setSelectedAssetIds([]);
                  await refetch();
                }}
              />
            )}

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
