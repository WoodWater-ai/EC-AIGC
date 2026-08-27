import { useEffect, useState } from 'react';
import { TransitPickerButton, toSlotRef } from './TransitPickerButton';
import { AssetTransitModal } from '../AssetTransitModal';
import { mergeImagesHorizontal } from '../../utils/mergeImages';
import { withCosThumbnail } from '../../utils/cosImage';
import { useFileUpload } from '../../hooks/useFileUpload';
import { assetApi } from '../../api/modules/asset';
import type { AssetResourceItem } from '../../api/modules/asset';
import { productInfoApi } from '../../api/modules/productInfo';
import { productLibraryApi } from '../../api/modules/productLibrary';
import { buildCompositeResourceName } from '../../lib/assets/compositeNaming';
import { toast } from 'sonner';

// ── 对外暴露的类型(供 consumer 用) ─────────────────────────────────────
export interface AppliedCompositeAsset {
  /**
   * 合成图业务资源 ID —— 即 `asset_resource.id`(`/v1/admin/asset/create` 的返回值),
   * **不是** `file_resource.id`(`/v1/admin/file/upload-complete` 的返回值)。
   *
   * 已 `String()` 强转,下游 `ProductImageRef.id` 是 `string`(防雪花 ID 丢精度)。
   *
   * 字段名沿用 `fileResourceId` 是为了和 `SlotRef.fileResourceId` 命名对齐,
   * 但实际语义是 **asset_resource.id**(后端业务主键,product.image_id 关联的就是这个)。
   */
  fileResourceId: string;
  /** 缩略图 URL(COS thumbnail 压缩) */
  thumbnailUrl: string;
  /** 原图 URL(COS accessUrl) */
  originalUrl: string;
  /** 资源名，格式为“上衣商品名+下装商品名”。 */
  name: string;
  /** 合成图同时归档到的上衣、下装商品。 */
  productIds: string[];
}

interface ComposeSlotRef {
  fileResourceId: string | number;
  thumbnailUrl?: string;
  originalUrl?: string;
  name?: string;
  productId?: string;
}

interface CompositePreview {
  blob: Blob;
  dataUrl: string; // blob: URL;unmount 与 reset 时 revoke
  width: number;
  height: number;
}

// ── Props ──────────────────────────────────────────────────────────────
export interface OutfitComposePanelProps {
  /** 合成 + 上传 + 登记全部成功后的回调;调用方把 asset.fileResourceId 写回自己的 imageRef */
  onApplied: (asset: AppliedCompositeAsset) => void;
  /** 默认折叠。 */
  defaultCollapsed?: boolean;
}

export function OutfitComposePanel(props: OutfitComposePanelProps) {
  const { onApplied, defaultCollapsed = true } = props;

  // —— 折叠状态 ——
  const [open, setOpen] = useState(!defaultCollapsed);

  // —— 槽位 ——
  const [topRef, setTopRef] = useState<ComposeSlotRef | null>(null);
  const [bottomRef, setBottomRef] = useState<ComposeSlotRef | null>(null);
  const [pickerSlot, setPickerSlot] = useState<'top' | 'bottom' | null>(null);

  // —— 合成 + 上传 ——
  const [compositePreview, setCompositePreview] = useState<CompositePreview | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // useFileUpload:purpose 固定 UP_DOWN_MERGE;**不传 productId**(详见 Props JSDoc)
  const { upload, progress: uploadProgress, error: uploadHookError, reset: resetUpload } = useFileUpload({
    purpose: 'UP_DOWN_MERGE',
  });

  // —— blob URL 资源回收:setPreviewSafe + unmount cleanup ——
  function setPreviewSafe(next: CompositePreview | null) {
    setCompositePreview((prev) => {
      if (prev?.dataUrl.startsWith('blob:')) URL.revokeObjectURL(prev.dataUrl);
      return next;
    });
  }

  useEffect(() => {
    return () => {
      setCompositePreview((prev) => {
        if (prev?.dataUrl.startsWith('blob:')) URL.revokeObjectURL(prev.dataUrl);
        return null;
      });
    };
  }, []);

  // —— 操作 ——
  async function handleCompositePreview(): Promise<void> {
    if (!topRef || !bottomRef) return;
    if (!topRef.productId || !bottomRef.productId) {
      setUploadError('请选择商品素材库中的上衣和下装');
      return;
    }
    if (topRef.productId === bottomRef.productId) {
      setUploadError('上衣和下装需来自两个不同商品');
      return;
    }
    const topUrl = topRef.originalUrl ?? topRef.thumbnailUrl;
    const bottomUrl = bottomRef.originalUrl ?? bottomRef.thumbnailUrl;
    if (!topUrl || !bottomUrl) {
      setUploadError('所选资源缺少可访问的 URL,无法合成');
      return;
    }
    setUploadError(null);
    setIsComposing(true);
    try {
      const result = await mergeImagesHorizontal(topUrl, bottomUrl, {
        crossOrigin: true,
        mimeType: 'image/png',
      });
      setPreviewSafe({ blob: result.blob, dataUrl: URL.createObjectURL(result.blob), width: result.width, height: result.height });
      toast.success(`合成预览完成(尺寸 ${result.width}×${result.height})`);
    } catch (e) {
      const msg = (e as Error).message ?? '未知错误';
      setUploadError(`合成预览失败: ${msg}`);
    } finally {
      setIsComposing(false);
    }
  }

  async function handleApplyComposite(): Promise<void> {
    if (!compositePreview) return;
    const selectedProductIds = Array.from(new Set(
      [topRef?.productId, bottomRef?.productId].filter((id): id is string => Boolean(id)),
    ));
    if (selectedProductIds.length !== 2) {
      setUploadError('请选择两个不同商品的上衣和下装');
      return;
    }
    setUploadError(null);
    setIsApplying(true);
    try {
      const compositeName = buildCompositeResourceName([topRef?.name, bottomRef?.name]);
      const file = new File([compositePreview.blob], `${compositeName}.png`, { type: 'image/png' });
      // upload() 返回 file_resource.id(中间产物,仅用于 assetApi.create 的入参)
      const { fileResourceId, accessUrl, fileMd5 } = await upload(file);
      // assetApi.create 返回 asset_resource.id(业务 id,product.image_id 关联的就是这个)
      const assetId = await assetApi.create({
        fileResourceId,
        fileMd5,
        name: compositeName,
        productIds: selectedProductIds,
        assetKind: 'IMAGE',
        assetType: 'PRODUCT_ORIGINAL',
      });
      const coverResults = await Promise.allSettled(
        selectedProductIds.map((productId) =>
          productLibraryApi.setInputAssetCover(productId, String(assetId))),
      );
      const coverFailureCount = coverResults.filter((result) => result.status === 'rejected').length;
      if (coverFailureCount > 0) {
        toast.warning(`合成图已创建，${coverFailureCount} 个商品封面更新失败`);
      }
      onApplied({
        fileResourceId: String(assetId), // asset_resource.id —— 后端业务主键,不是 file_resource.id
        thumbnailUrl: withCosThumbnail(accessUrl, 256),
        originalUrl: accessUrl,
        name: compositeName,
        productIds: selectedProductIds,
      });
      reset();
    } catch (e) {
      setUploadError(`上传或登记失败: ${(e as Error).message ?? '未知错误'}`);
    } finally {
      setIsApplying(false);
    }
  }

  function reset(): void {
    setPreviewSafe(null);
    setTopRef(null);
    setBottomRef(null);
    setIsComposing(false);
    setIsApplying(false);
    setUploadError(null);
    resetUpload();
    setOpen(false);
  }

  async function handlePickerConfirm(items: AssetResourceItem[]): Promise<void> {
    if (!pickerSlot || items.length === 0) {
      setPickerSlot(null);
      return;
    }
    const targetSlot = pickerSlot;
    const item = items[0];
    let ref = toSlotRef(item);
    if (item.productId) {
      try {
        const product = await productInfoApi.detail({ id: item.productId });
        ref = { ...ref, name: product.name || ref.name };
      } catch {
        toast.warning('商品名称读取失败，合成图将暂用素材名称');
      }
    }
    if (targetSlot === 'top') setTopRef(ref);
    else setBottomRef(ref);
    setPickerSlot(null);
  }

  const effectiveError = uploadError ?? uploadHookError?.message ?? null;

  // —— UI(对齐 CreateImageTask 402-483 行布局风格) ——
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium text-slate-700"
        data-testid="outfit-compose-toggle"
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">layers</span>
          上下装合成套图
        </span>
        <span className="material-symbols-outlined text-[18px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* top + bottom 槽位 */}
          <div className="flex items-center justify-center gap-2">
            <TransitPickerButton
              slot="top"
              value={topRef}
              placeholder="选择上衣"
              size="md"
              variant="primary"
              clearable
              onChange={(v) => setTopRef(v ?? null)}
              onOpenPicker={() => setPickerSlot('top')}
            />
            <span className="text-slate-400">+</span>
            <TransitPickerButton
              slot="bottom"
              value={bottomRef}
              placeholder="选择下装"
              size="md"
              variant="primary"
              clearable
              onChange={(v) => setBottomRef(v ?? null)}
              onOpenPicker={() => setPickerSlot('bottom')}
            />
          </div>

          {/* 预览图 */}
          {compositePreview && (
            <div className="rounded border border-slate-200 bg-white p-2">
              <img src={compositePreview.dataUrl} alt="合成预览" className="mx-auto max-h-64" />
              <p className="mt-1 text-center text-xs text-slate-500">
                {compositePreview.width} × {compositePreview.height}
              </p>
            </div>
          )}

          {/* 错误 */}
          {effectiveError && <p className="text-xs text-red-600">{effectiveError}</p>}

          {/* 进度 */}
          {isApplying && uploadProgress != null && (
            <div className="h-1 w-full overflow-hidden rounded bg-slate-200">
              <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleCompositePreview}
              disabled={!topRef || !bottomRef || isComposing || isApplying}
              className="h-8 px-3 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="outfit-compose-preview"
            >
              {isComposing ? '合成中…' : '合成预览'}
            </button>
            <button
              type="button"
              onClick={handleApplyComposite}
              disabled={!compositePreview || isComposing || isApplying}
              className="h-8 px-3 rounded-md bg-primary text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="outfit-compose-apply"
            >
              {isApplying ? `上传中 ${uploadProgress ?? 0}%` : '上传并应用主图'}
            </button>
          </div>
        </div>
      )}

      {/* 共享 AssetTransitModal:两个槽位只挂一份 */}
      {pickerSlot && (
        <AssetTransitModal
          mode="picker"
          assetKind="IMAGE"
          initialSource="PRODUCT"
          allowedSources={['PRODUCT']}
          selectionOnly
          multiSelect={false}
          onClose={() => setPickerSlot(null)}
          onConfirmSelection={handlePickerConfirm}
        />
      )}
    </section>
  );
}
