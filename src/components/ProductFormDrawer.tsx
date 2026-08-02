import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ProductDTO, ProductAddReq, ProductUpdateReq, ProductStatus } from '../api/modules/productInfo';
import { productInfoApi, type ProductAiAnalyzeResponse } from '../api/modules/productInfo';
import { AssetTransitModal } from './AssetTransitModal';
import type { AssetResourceItem } from '../api/modules/asset';
import { AssetImage } from './AssetImage';
import { withCosThumbnail } from '../utils/cosImage';
import { productCategoryApi, type ProductCategoryNode } from '../api/modules/productCategory';
import { useConfirm } from './common/ConfirmProvider';
import { OutfitComposePanel, type AppliedCompositeAsset } from './common/OutfitComposePanel';

/**
 * 产品图片选择状态(取自 AssetResourceItem 关键字段,够前端预览 + 提交用)
 */
interface ProductImageRef {
  /** 资源 ID —— 提交给后端的 imageId(Long) */
  id: string;
  /** 缩略图 URL —— 用于已选态预览 */
  thumbnailUrl?: string;
  /** 原图 URL —— 备选 */
  originalUrl?: string;
  /** 资源名 —— 已选态标签 */
  name?: string;
}

/** 已选中的产品分类(本地仅存 id + name;name 用于已选态展示) */
interface SelectedCategory {
  id: string;          // 后端 Long,前端存 string 防精度丢失
  categoryName: string;
}

interface Props {
  open: boolean;
  initial?: ProductDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 新增/编辑产品 Drawer
 *
 * 视觉风格对齐 ProductCategoryList/CategoryDrawer:
 *  - 右侧抽屉(fixed inset-0 z-50 flex justify-end)
 *  - bg-black/30 遮罩 + bg-white w-[480px] h-full shadow-2xl
 *  - Header:border-b + close icon
 *  - Body:flex-1 overflow-y-auto px-5 py-4 space-y-4
 *  - Footer:border-t + 取消/保存按钮
 *  - 必填项 * 红星标识
 *
 * 图片选择:
 *  - 占位态:虚线方框 + add icon + "选择图片" 文字
 *  - 已选态:AssetImage 缩略图 + 文件名 + hover × 清除
 *  - 点击 → 弹 AssetTransitModal(multiSelect=false),确认后写 imageId 到 state
 *  - 提交时只发 imageId(后端校验资源 + 转换为 URL)
 *
 * 产品分类多选:
 *  - 抽屉打开时一次性拉 product-category/tree,平铺为 {id, name, depth} 列表
 *  - 通过 select multiple + 已选 pill 区(×)增删
 *  - 提交流程把 selected.map(s => s.id) 作为 categoryIds 发给后端
 */
export default function ProductFormDrawer({ open, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [color, setColor] = useState('');
  const [patternMaterial, setPatternMaterial] = useState('');
  const [silhouetteStructure, setSilhouetteStructure] = useState('');
  const [category, setCategory] = useState('');
  const [imageRef, setImageRef] = useState<ProductImageRef | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [status, setStatus] = useState<ProductStatus>('ON_SHELF');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const confirm = useConfirm();

  // 产品分类相关
  const [categoryTree, setCategoryTree] = useState<ProductCategoryNode[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  // 展开的父节点 id 集合 —— 抽屉每次打开时重置为"全展开"
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // AI 分析相关
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSnapshot, setAiSnapshot] = useState<{
    name: string;
    sellingPoints: string;
    color: string;
    patternMaterial: string;
    silhouetteStructure: string;
    category: string;
  } | null>(null);

  // 初始化 + 打开时回填
  // 注意:依赖同时含 initial 和 categoryTree —— 后端返回 categories 含全链父分类,
  // 这里过滤出"叶子节点"才是用户原始选择,避免在编辑时把祖先也当成已选项。
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSellingPoints(initial?.sellingPoints ?? '');
      setColor(initial?.color ?? '');
      setPatternMaterial(initial?.patternMaterial ?? '');
      setSilhouetteStructure(initial?.silhouetteStructure ?? '');
      setCategory(initial?.category ?? '');
      setStatus((initial?.status as ProductStatus) ?? 'ON_SHELF');
      // 回填已关联的产品分类
      if (initial?.categories && initial.categories.length > 0) {
        // 后端已在 ProductServiceImpl 中把响应过滤为叶子节点,前端直接拿即可
        setSelectedCategories(
          initial.categories.map((c) => ({
            id: String(c.id),
            categoryName: c.categoryName ?? '',
          }))
        );
      } else {
        setSelectedCategories([]);
      }
      // 图片:从 response 的 imageId + imageUrl(ossKey)重建;preview URL 用 withCosThumbnail 拼 COS thumbnail
      // ⚠️ 关键:imageId 是 19 位雪花 ID,超过 JS Number.MAX_SAFE_INTEGER (2^53-1)
      //   必须全程保持 string,避免 Number() ↔ String() 双向转换的精度丢失
      if (initial?.imageId && initial?.imageUrl) {
        setImageRef({
          id: String(initial.imageId),
          thumbnailUrl: withCosThumbnail(initial.imageUrl, 200) ?? initial.imageUrl,
          originalUrl: initial.imageUrl,
        });
      } else {
        setImageRef(null);
      }
      setPickerOpen(false);
      setCategoryDropdownOpen(false);
      // 默认全展开 —— 收齐所有父节点 id(递归)
      const allParents = new Set<string>();
      const collectParents = (nodes: ProductCategoryNode[]) => {
        for (const n of nodes) {
          if (n.children && n.children.length > 0) {
            allParents.add(String(n.id));
            collectParents(n.children);
          }
        }
      };
      collectParents(categoryTree);
      setExpandedIds(allParents);
      setDirty(false);
    }
  }, [open, initial, categoryTree]);

  // 抽屉第一次打开时拉一次分类树(只在树为空时拉,避免重复)
  useEffect(() => {
    if (open && categoryTree.length === 0) {
      void productCategoryApi
        .tree()
        .then(setCategoryTree)
        .catch(() => {
          // http 拦截器已 toast
        });
    }
  }, [open, categoryTree.length]);

  // 关闭抽屉时清除 AI 分析状态
  useEffect(() => {
    if (!open) {
      setAiSnapshot(null);
      setAiAnalyzing(false);
    }
  }, [open]);

  // 收集所有父节点 id(用于顶部"全部展开/收起")
  const allParentIds = useMemo(() => {
    const ids = new Set<string>();
    const walk = (nodes: ProductCategoryNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          ids.add(String(n.id));
          walk(n.children);
        }
      }
    };
    walk(categoryTree);
    return ids;
  }, [categoryTree]);

  // dirty 追踪
  useEffect(() => {
    if (!open) return;
    const initialImageId = initial?.imageId ? String(initial.imageId) : null;
    const initialCategoryIds = (initial?.categories ?? [])
      .map((c) => String(c.id))
      .sort()
      .join(',');
    const currentCategoryIds = selectedCategories
      .map((c) => c.id)
      .sort()
      .join(',');
    setDirty(
      name !== (initial?.name ?? '') ||
        sellingPoints !== (initial?.sellingPoints ?? '') ||
        color !== (initial?.color ?? '') ||
        patternMaterial !== (initial?.patternMaterial ?? '') ||
        silhouetteStructure !== (initial?.silhouetteStructure ?? '') ||
        category !== (initial?.category ?? '') ||
        status !== ((initial?.status as ProductStatus) ?? 'ON_SHELF') ||
        (imageRef?.id ?? null) !== initialImageId ||
        currentCategoryIds !== initialCategoryIds
    );
  }, [
    open,
    name,
    sellingPoints,
    color,
    patternMaterial,
    silhouetteStructure,
    category,
    status,
    imageRef,
    initial,
    selectedCategories,
  ]);

  if (!open) return null;

  async function handleClose() {
    if (dirty) {
      const ok = await confirm({
        title: '放弃修改',
        message: '当前产品有未保存的修改,确认关闭?已填写的内容将丢失。',
        confirmText: '放弃修改',
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }

  function handlePickerConfirm(items: AssetResourceItem[]) {
    if (items.length === 0) return;
    const item = items[0];
    setImageRef({
      // 资源库的 id 字段类型是 number(JS Number) —— 强转 string 防止精度丢失
      // 19 位雪花 ID 超过 Number.MAX_SAFE_INTEGER,任何 Number↔String 转换都会丢精度
      id: String(item.id),
      // 资源库返回的 thumbnailUrl/originalUrl 通常已是完整 URL;不再二次拼 withCosThumbnail
      thumbnailUrl: item.thumbnailUrl ?? item.originalUrl,
      originalUrl: item.originalUrl,
      name: item.name,
    });
    setPickerOpen(false);
  }

  function handleClearImage(e: React.MouseEvent) {
    e.stopPropagation();
    setImageRef(null);
  }

  function handleAppliedComposite(asset: AppliedCompositeAsset): void {
    setImageRef({
      id: asset.fileResourceId, // 已是 string
      thumbnailUrl: asset.thumbnailUrl,
      originalUrl: asset.originalUrl,
      name: asset.name,
    });
    setComposeOpen(false);
  }

  function toggleCategory(id: string, categoryName: string) {
    setSelectedCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, { id, categoryName }];
    });
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(allParentIds));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function removeCategory(id: string) {
    setSelectedCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleAiAnalyze() {
    if (!imageRef?.id) {
      toast.error('请先选择产品图片');
      return;
    }
    // 快照当前 6 字段(下一次分析会刷新快照)
    setAiSnapshot({
      name,
      sellingPoints,
      color,
      patternMaterial,
      silhouetteStructure,
      category,
    });
    setAiAnalyzing(true);
    try {
      const resp = await productInfoApi.aiAnalyze({ imageId: imageRef.id });
      applyAiResult(resp);
      // toast 由 http 拦截器处理
    } catch {
      // 失败:等同"没分析过",清掉 snapshot(避免出现"恢复原值"按钮却没东西可恢复)
      setAiSnapshot(null);
    } finally {
      setAiAnalyzing(false);
    }
  }

  function applyAiResult(r: ProductAiAnalyzeResponse) {
    if (r.name !== undefined) setName(r.name ?? '');
    if (r.sellingPoints !== undefined) setSellingPoints(r.sellingPoints ?? '');
    if (r.color !== undefined) setColor(r.color ?? '');
    if (r.patternMaterial !== undefined) setPatternMaterial(r.patternMaterial ?? '');
    if (r.silhouetteStructure !== undefined) setSilhouetteStructure(r.silhouetteStructure ?? '');
    if (r.category !== undefined) setCategory(r.category ?? '');
    // fabricTexture / keyDetails / unchangeable 暂不消费
  }

  function restoreSnapshot() {
    if (!aiSnapshot) return;
    setName(aiSnapshot.name);
    setSellingPoints(aiSnapshot.sellingPoints);
    setColor(aiSnapshot.color);
    setPatternMaterial(aiSnapshot.patternMaterial);
    setSilhouetteStructure(aiSnapshot.silhouetteStructure);
    setCategory(aiSnapshot.category);
    setAiSnapshot(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('产品名称不能为空');
      return;
    }
    if (!imageRef?.id) {
      toast.error('请选择产品图片');
      return;
    }
    setSaving(true);
    try {
      const imageId = imageRef?.id;
      // 后端期望 categoryIds: List<Long>;前端拿到的 product_category id 来自后端
      // JSON 字符串(雪花 ID),全程保持 string 不走 Number() 避免精度丢失。
      const categoryIds: string[] = selectedCategories.map((c) => c.id);
      if (initial?.id) {
        const req: ProductUpdateReq = {
          id: initial.id,
          name: name.trim(),
          sellingPoints: sellingPoints || undefined,
          color: color || undefined,
          patternMaterial: patternMaterial || undefined,
          silhouetteStructure: silhouetteStructure || undefined,
          category: category || undefined,
          imageId: imageId !== undefined ? String(imageId) : undefined,
          categoryIds,
          status,
        };
        await productInfoApi.update(req);
        toast.success('更新成功');
      } else {
        const req: ProductAddReq = {
          name: name.trim(),
          sellingPoints: sellingPoints || undefined,
          color: color || undefined,
          patternMaterial: patternMaterial || undefined,
          silhouetteStructure: silhouetteStructure || undefined,
          category: category || undefined,
          imageId: imageId !== undefined ? String(imageId) : undefined,
          categoryIds,
          status,
        };
        await productInfoApi.add(req);
        toast.success('新增成功');
      }
      onSaved();
      onClose();
    } catch {
      // toast 由 http 拦截器统一弹
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative bg-white w-[480px] h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">
            {initial?.id ? '编辑产品' : '新建产品'}
          </h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
            title="关闭"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 图片选择 —— 从资源库(必填,放在第一位) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              产品图片 <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-start gap-2">
              {imageRef ? (
                // 已选态:缩略图 + hover × 清除
                <div
                  className="relative group w-32 h-32 rounded-lg border border-slate-200 cursor-pointer overflow-hidden"
                  onClick={() => setPickerOpen(true)}
                  title="点击重新选择"
                >
                  <AssetImage
                    urls={[imageRef.thumbnailUrl ?? imageRef.originalUrl ?? '']}
                    alt={imageRef.name ?? ''}
                    maxWidth={200}
                    className="w-full h-full"
                    aspectRatio="auto"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <span className="material-symbols-outlined text-2xl text-slate-300">image</span>
                      </div>
                    }
                  />
                  {imageRef.name && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 pointer-events-none">
                      <span className="text-[10px] text-white font-bold truncate block">
                        {imageRef.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="清除选择"
                  >
                    <span className="material-symbols-outlined text-[14px] leading-none">close</span>
                  </button>
                </div>
              ) : (
                // 未选态:虚线占位按钮
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-32 h-32 flex flex-col items-center justify-center border border-dashed border-rose-300 rounded-lg bg-rose-50/40 text-slate-500 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-3xl mb-1">add_photo_alternate</span>
                  <span className="text-[10px] font-bold">必填 · 选择图片</span>
                </button>
              )}
              {/* 新增右侧按钮组 */}
              <div className="flex flex-col gap-1.5 pt-2">
                <button
                  type="button"
                  disabled={!imageRef?.id || aiAnalyzing}
                  onClick={handleAiAnalyze}
                  className="h-8 px-3 text-xs font-semibold rounded-md border border-slate-300 bg-white text-primary hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="基于产品图片,调用 AI 提取商品属性"
                >
                  {aiAnalyzing ? (
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                  )}
                  {aiAnalyzing ? '分析中…' : 'AI分析'}
                </button>
                {aiSnapshot && (
                  <button
                    type="button"
                    onClick={restoreSnapshot}
                    className="h-8 px-3 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md flex items-center gap-1.5"
                    title="恢复到点击 AI 分析前的输入"
                  >
                    <span className="material-symbols-outlined text-base">undo</span>
                    恢复原值
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setComposeOpen((o) => !o)}
                  className={`h-8 px-3 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors ${
                    composeOpen
                      ? 'bg-blue-50 text-primary border-blue-200 hover:bg-blue-100'
                      : 'bg-white text-primary border-slate-300 hover:bg-blue-50'
                  }`}
                  title="基于两张图片合成新的产品主图"
                >
                  <span className="material-symbols-outlined text-base">layers</span>
                  上下装合成套图
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              从资源库中选择已上传的图片;后端会校验资源并自动转换 URL 存储。
            </p>
          </div>

          {/* 上下装合成套图 —— 替换产品主图 */}
          <OutfitComposePanel
            productId={initial?.id}
            onApplied={handleAppliedComposite}
            defaultCollapsed
          />

          {/* 名称 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              产品名称 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={128}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="如:2024 春夏款连衣裙"
            />
          </div>

          {/* 核心卖点 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              核心卖点(可选)
            </label>
            <textarea
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none resize-none"
              placeholder="如:新款上市,限时折扣"
            />
          </div>

          {/* 颜色 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              颜色(可选)
            </label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              maxLength={500}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="如:雾霾蓝 / 米白 / 焦糖棕"
            />
          </div>

          {/* 图案/材质 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              图案/材质(可选)
            </label>
            <input
              type="text"
              value={patternMaterial}
              onChange={(e) => setPatternMaterial(e.target.value)}
              maxLength={500}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="如:纯色 / 条纹 / 雪纺 / 棉麻"
            />
          </div>

          {/* 版型/结构 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              版型/结构(可选)
            </label>
            <input
              type="text"
              value={silhouetteStructure}
              onChange={(e) => setSilhouetteStructure(e.target.value)}
              maxLength={500}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="如:A 字裙 / H 型 / 收腰"
            />
          </div>

          {/* 产品分类多选(从 product_category) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              产品分类(可选,可多选)
            </label>

            {/* 已选 Tag pill 列表 */}
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedCategories.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-primary text-xs px-2 py-1"
                  >
                    <span>{c.categoryName}</span>
                    <button
                      type="button"
                      onClick={() => removeCategory(c.id)}
                      className="w-4 h-4 flex items-center justify-center hover:text-rose-600"
                      title="移除"
                    >
                      <span className="material-symbols-outlined text-[14px] leading-none">close</span>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 下拉:点开显示所有分类;点击 + 切换选中 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoryDropdownOpen((v) => !v)}
                className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white text-left flex items-center justify-between hover:border-primary focus:border-primary focus:outline-none"
              >
                <span className="text-slate-500">
                  {categoryTree.length === 0
                    ? '加载中…'
                    : categoryDropdownOpen
                      ? '收起分类列表'
                      : '选择产品分类'}
                </span>
                <span className="material-symbols-outlined text-base text-slate-400">
                  {categoryDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {categoryDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
                  {categoryTree.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-400 text-center">暂无分类</div>
                  ) : (
                    <CategoryTreeBody
                      tree={categoryTree}
                      expandedIds={expandedIds}
                      selectedIds={new Set(selectedCategories.map((c) => c.id))}
                      onToggleExpand={toggleExpand}
                      onToggleSelect={toggleCategory}
                      onExpandAll={expandAll}
                      onCollapseAll={collapseAll}
                      totalParents={allParentIds.size}
                    />
                  )}
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              从「商品分类管理」中选取,后端会按整体替换已选列表。
            </p>
          </div>

          {/* 品类(自由文本) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              品类(可选)
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={255}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="如:连衣裙 / 童装 / 配饰"
            />
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              上下架状态
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white focus:border-primary focus:outline-none"
            >
              <option value="ON_SHELF">上架</option>
              <option value="OFF_SHELF">下架</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={handleClose}
            disabled={saving}
            className="h-9 px-4 bg-slate-100 text-slate-700 text-sm rounded-md hover:bg-slate-200 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            )}
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      {/* AssetTransitModal —— 图片选择弹窗 */}
      {pickerOpen && (
        <AssetTransitModal
          multiSelect={false}
          mode="picker"
          assetKind="IMAGE"
          onClose={() => setPickerOpen(false)}
          onConfirmSelection={handlePickerConfirm}
        />
      )}
    </div>
  );
}

// =============================================================================
// 分类树渲染(支持展开/折叠)
// =============================================================================

interface CategoryTreeBodyProps {
  tree: ProductCategoryNode[];
  expandedIds: Set<string>;
  selectedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string, name: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  totalParents: number;
}

const CategoryTreeBody: React.FC<CategoryTreeBodyProps> = ({
  tree,
  expandedIds,
  selectedIds,
  onToggleExpand,
  onToggleSelect,
  onExpandAll,
  onCollapseAll,
  totalParents,
}) => {
  const allExpanded = totalParents > 0 && totalParents === expandedIds.size;
  return (
    <>
      {/* 顶部工具条:全部展开 / 全部折叠 */}
      <div className="flex items-center justify-end gap-2 px-2 py-1 border-b border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={onExpandAll}
          disabled={allExpanded}
          className="text-[10px] text-slate-500 hover:text-primary disabled:opacity-40 disabled:cursor-default"
        >
          全部展开
        </button>
        <span className="text-slate-200">|</span>
        <button
          type="button"
          onClick={onCollapseAll}
          disabled={expandedIds.size === 0}
          className="text-[10px] text-slate-500 hover:text-primary disabled:opacity-40 disabled:cursor-default"
        >
          全部折叠
        </button>
      </div>
      {tree.map((node) => (
        <CategoryTreeNode
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          selectedIds={selectedIds}
          onToggleExpand={onToggleExpand}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </>
  );
};

interface CategoryTreeNodeProps {
  node: ProductCategoryNode;
  depth: number;
  expandedIds: Set<string>;
  selectedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string, name: string) => void;
}

const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = ({
  node,
  depth,
  expandedIds,
  selectedIds,
  onToggleExpand,
  onToggleSelect,
}) => {
  const id = String(node.id);
  const isParent = !!(node.children && node.children.length > 0);
  const isExpanded = expandedIds.has(id);
  const isSelected = selectedIds.has(id);

  if (!isParent) {
    // 叶子节点:点击切换选中
    const interactiveClasses = isSelected
      ? 'bg-blue-50 border-l-2 border-primary text-primary font-semibold'
      : 'text-slate-700 hover:bg-slate-50';
    return (
      <div
        onClick={() => onToggleSelect(id, node.categoryName)}
        title={isSelected ? '点击取消选择' : '点击选择'}
        className={`pl-${Math.min(depth, 6) * 4 + 9} pr-3 py-1.5 text-sm cursor-pointer transition-colors flex items-center gap-1.5 ${interactiveClasses}`}
        style={{ paddingLeft: `${9 + depth * 16}px` }}
      >
        <span aria-hidden className="inline-block text-xs w-3 text-primary shrink-0">
          {isSelected ? '●' : ' '}
        </span>
        <span className="truncate">{node.categoryName}</span>
      </div>
    );
  }

  // 父节点:[toggle] 分类名(不可选)
  return (
    <>
      <div
        onClick={(e) => {
          // 点击折叠箭头:展开/折叠;点击其他区域:toast 提示
          const target = e.target as HTMLElement;
          if (target.closest('[data-tree-toggle]')) {
            e.stopPropagation();
            onToggleExpand(id);
            return;
          }
          toast.info('该分类下还有子分类,请选择最末级子分类');
        }}
        title="折叠/展开 或 提示"
        className="pr-3 py-1.5 text-sm cursor-pointer transition-colors text-slate-500 hover:bg-slate-50 font-semibold flex items-center gap-1.5"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <span
          data-tree-toggle
          className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base leading-none">
            {isExpanded ? 'expand_more' : 'chevron_right'}
          </span>
        </span>
        <span aria-hidden className="material-symbols-outlined text-sm text-slate-400 shrink-0">
          {isExpanded ? 'folder_open' : 'folder'}
        </span>
        <span className="truncate">{node.categoryName}</span>
      </div>
      {isExpanded &&
        node.children!.map((child) => (
          <CategoryTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            selectedIds={selectedIds}
            onToggleExpand={onToggleExpand}
            onToggleSelect={onToggleSelect}
          />
        ))}
    </>
  );
};
