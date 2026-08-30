import React, { useCallback, useEffect, useState } from 'react';
import { fetchAsBlob, triggerBrowserDownload } from '../utils/downloadFile';

export interface PreviewImage {
  /** 原图完整 URL(不带 imageMogr2 缩略参数) */
  url: string;
  /** 可选:批次/版本说明,展示在计数旁 */
  label?: string;
  /** 调用方显式指定的下载文件名(含扩展名) */
  filename?: string;
}

export interface ImagePreviewModalProps {
  images: PreviewImage[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * filename 优先 → URL 路径最后一段 → preview-N.<ext>
 */
function resolveFilename(
  item: { url: string; filename?: string },
  index: number,
  ext: 'jpg',
): string {
  if (item.filename) return item.filename;
  try {
    const last = new URL(item.url).pathname.split('/').pop();
    if (last) return last;
  } catch {
    /* fallthrough */
  }
  return `preview-${index + 1}.${ext}`;
}

/**
 * 简洁图片预览弹层:居中大图 + 多图左右切换。
 *  - 无第三方依赖,复用现有 fixed overlay 样式
 *  - 单图时隐藏箭头与缩略图条
 *  - 支持 ESC 关闭、← / → 切换、点击遮罩关闭
 */
export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  images,
  initialIndex = 0,
  onClose,
}) => {
  const safeInitial = Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0));
  const [index, setIndex] = useState(safeInitial);
  const [errored, setErrored] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const total = images.length;
  const current = images[index];

  const handleDownloadCurrent = useCallback(async () => {
    if (!current) return;
    const filename = resolveFilename(current, index, 'jpg');
    setIsDownloading(true);
    try {
      try {
        const blob = await fetchAsBlob(current.url);
        const blobUrl = URL.createObjectURL(blob);
        try {
          triggerBrowserDownload(blobUrl, filename);
        } finally {
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }
      } catch {
        // CORS / 网络失败 → 新标签页打开作为降级(对齐 AssistantPage)
        triggerBrowserDownload(current.url, filename, true);
      }
    } finally {
      setIsDownloading(false);
    }
  }, [current, index]);

  const goPrev = useCallback(() => {
    setErrored(false);
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setErrored(false);
    setIndex((i) => (i + 1) % total);
  }, [total]);

  // 键盘:ESC 关闭,← / → 切换
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && total > 1) goPrev();
      else if (e.key === 'ArrowRight' && total > 1) goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext, total]);

  if (total === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 下载按钮(关闭按钮左边) */}
        <button
          onClick={() => void handleDownloadCurrent()}
          disabled={isDownloading || !current}
          className="absolute -top-2 right-10 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          aria-label="下载"
          title="下载当前图片"
        >
          <span className="material-symbols-outlined text-lg">download</span>
        </button>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
          aria-label="关闭"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* 大图区 */}
        <div className="relative flex items-center justify-center">
          {total > 1 && (
            <button
              onClick={goPrev}
              className="absolute left-2 z-10 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:bg-white cursor-pointer"
              aria-label="上一张"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}

          {current && !errored ? (
            <img
              src={current.url}
              alt={current.label ?? `image-${index}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setErrored(true)}
            />
          ) : (
            <div className="w-[60vw] max-w-lg aspect-square rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-6xl">broken_image</span>
            </div>
          )}

          {total > 1 && (
            <button
              onClick={goNext}
              className="absolute right-2 z-10 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:bg-white cursor-pointer"
              aria-label="下一张"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          )}
        </div>

        {/* 计数 + label */}
        <div className="text-xs text-white/90 font-mono flex items-center gap-2">
          <span>{index + 1} / {total}</span>
          {current?.label && <span className="opacity-70">· {current.label}</span>}
        </div>

        {/* 底部缩略图条(多图时) */}
        {total > 1 && (
          <div className="flex gap-1.5 max-w-[90vw] overflow-x-auto p-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => { setErrored(false); setIndex(i); }}
                className={`grid w-12 h-12 place-items-center rounded overflow-hidden border-2 bg-white p-1 shrink-0 cursor-pointer ${
                  i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                aria-label={`查看第 ${i + 1} 张`}
              >
                <img
                  src={img.url}
                  alt={img.label ?? `thumb-${i}`}
                  className="block h-auto max-h-full w-auto max-w-full object-contain object-center"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
