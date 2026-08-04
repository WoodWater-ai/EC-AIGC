import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AssetResourceItem } from '../../api/modules/asset';
import { assetApi } from '../../api/modules/asset';
import { useFileUpload } from '../../hooks/useFileUpload';
import { mergeImages, type MergeDirection } from '../../utils/mergeImages';
import { AssetImage } from '../AssetImage';

interface CompositePreview {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

interface ResourceMergeDrawerProps {
  items: AssetResourceItem[];
  categoryId?: number;
  onClose: () => void;
  onUploaded: () => void | Promise<void>;
}

const defaultResourceName = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `合并套图-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
};

export function ResourceMergeDrawer({
  items,
  categoryId,
  onClose,
  onUploaded,
}: ResourceMergeDrawerProps) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [direction, setDirection] = useState<MergeDirection>('VERTICAL');
  const [resourceName, setResourceName] = useState(defaultResourceName);
  const [preview, setPreview] = useState<CompositePreview | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload, progress, error: uploadError, reset: resetUpload } = useFileUpload({
    purpose: 'UP_DOWN_MERGE',
  });

  const usableUrls = useMemo(
    () => orderedItems.map((item) => item.originalUrl ?? item.thumbnailUrl ?? ''),
    [orderedItems],
  );

  useEffect(() => {
    return () => {
      if (preview?.url.startsWith('blob:')) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isComposing && !isUploading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isComposing, isUploading, onClose]);

  const invalidatePreview = () => {
    setPreview(null);
    setError(null);
    resetUpload();
  };

  const handleDirectionChange = (next: MergeDirection) => {
    if (next === direction) return;
    setDirection(next);
    invalidatePreview();
  };

  const moveItem = (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= orderedItems.length) return;
    setOrderedItems((previous) => {
      const next = [...previous];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    invalidatePreview();
  };

  const handleCompose = async () => {
    if (usableUrls.some((url) => !url)) {
      setError('部分资源缺少可访问的原图地址，无法合并。');
      return;
    }
    setIsComposing(true);
    setError(null);
    try {
      const result = await mergeImages(usableUrls, direction, {
        crossOrigin: true,
        mimeType: 'image/png',
      });
      setPreview({
        blob: result.blob,
        url: URL.createObjectURL(result.blob),
        width: result.width,
        height: result.height,
      });
    } catch (err) {
      setError(`合并预览失败：${(err as Error).message ?? '未知错误'}`);
    } finally {
      setIsComposing(false);
    }
  };

  const handleUpload = async () => {
    if (!preview || !resourceName.trim()) return;
    setIsUploading(true);
    setError(null);
    try {
      const name = resourceName.trim();
      const file = new File([preview.blob], `${name}.png`, { type: 'image/png' });
      const { fileResourceId, fileMd5 } = await upload(file);
      await assetApi.create({
        fileResourceId,
        fileMd5,
        name,
        assetKind: 'IMAGE',
        assetType: 'PRODUCT_ORIGINAL',
        description: `${orderedItems.length} 张图片${direction === 'VERTICAL' ? '上下' : '左右'}合成`,
        tags: `合并套图,${direction === 'VERTICAL' ? '上下合成' : '左右合成'}`,
        categoryIds: categoryId == null ? undefined : [String(categoryId)],
      });
      toast.success('合并套图已上传到资源中心');
      await onUploaded();
    } catch (err) {
      setError(`上传失败：${(err as Error).message ?? '未知错误'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const effectiveError = error ?? uploadError?.message ?? null;
  const busy = isComposing || isUploading;

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/20" aria-hidden={false}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-merge-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl animate-fadeIn"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="resource-merge-title" className="text-base font-extrabold text-slate-800">合并图片</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              按编号顺序拼接 {orderedItems.length} 张图片，生成预览后上传到资源中心。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭合并抽屉"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="mb-2 text-xs font-extrabold text-slate-700">合成方式</h3>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {([
                ['VERTICAL', 'vertical_align_center', '上下合成'],
                ['HORIZONTAL', 'align_horizontal_left', '左右合成'],
              ] as const).map(([value, icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleDirectionChange(value)}
                  disabled={busy}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                    direction === value
                      ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-700">图片顺序</h3>
              <span className="text-[10px] text-slate-400">可用箭头调整</span>
            </div>
            <div className="space-y-2">
              {orderedItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-extrabold text-white">
                    {index + 1}
                  </span>
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <AssetImage
                      urls={[item.originalUrl, item.thumbnailUrl]}
                      alt={item.name}
                      assetKind="IMAGE"
                      objectFit="contain"
                      className="h-full w-full"
                    />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700" title={item.name}>{item.name}</p>
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0 || busy}
                      aria-label={`上移 ${item.name}`}
                      className="flex h-5 w-6 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-blue-600 disabled:opacity-20"
                    >
                      <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === orderedItems.length - 1 || busy}
                      aria-label={`下移 ${item.name}`}
                      className="flex h-5 w-6 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-blue-600 disabled:opacity-20"
                    >
                      <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-700">合成预览</h3>
              {preview && <span className="text-[10px] font-mono text-slate-400">{preview.width} × {preview.height}</span>}
            </div>
            <div className="flex min-h-52 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px] p-3">
              {preview ? (
                <img src={preview.url} alt="合成预览" className="max-h-80 max-w-full object-contain" />
              ) : (
                <div className="text-center text-slate-400">
                  <span className="material-symbols-outlined text-3xl">view_quilt</span>
                  <p className="mt-1 text-[11px]">点击“生成预览”查看合成效果</p>
                </div>
              )}
            </div>
            {effectiveError && <p className="mt-2 text-xs leading-5 text-red-600">{effectiveError}</p>}
          </section>

          {preview && (
            <section>
              <label htmlFor="merge-resource-name" className="mb-2 block text-xs font-extrabold text-slate-700">资源名称</label>
              <input
                id="merge-resource-name"
                value={resourceName}
                onChange={(event) => setResourceName(event.target.value)}
                maxLength={80}
                disabled={busy}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </section>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white px-5 py-4">
          {isUploading && (
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500">
                <span>正在上传到资源中心</span><span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCompose}
              disabled={busy}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isComposing ? '合成中...' : preview ? '重新生成预览' : '生成预览'}
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!preview || !resourceName.trim() || busy}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? `上传中 ${progress}%` : '上传到资源中心'}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
