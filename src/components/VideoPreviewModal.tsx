import React, { useCallback, useEffect, useState } from 'react';
import { fetchAsBlob, triggerBrowserDownload } from '../utils/downloadFile';

export interface PreviewVideo {
  /** 视频完整 URL */
  url: string;
  /** 封面图 URL —— 用作 <video poster> + 缩略图条 */
  poster?: string | null;
  /** 可选:批次/版本说明,展示在计数旁 */
  label?: string;
  /** 调用方显式指定的下载文件名(含扩展名) */
  filename?: string;
}

export interface VideoPreviewModalProps {
  videos: PreviewVideo[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * filename 优先 → URL 路径最后一段 → preview-N.<ext>
 */
function resolveFilename(
  item: { url: string; filename?: string },
  index: number,
  ext: 'mp4',
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
 * 视频预览弹层:居中 video + 多视频左右切换。
 *  - 与 ImagePreviewModal 风格一致(同一套遮罩/关闭按钮/计数/缩略图条)
 *  - 切换 src 时用 key 强制重挂载,避免上一个视频残留播放
 *  - 单视频时隐藏箭头与缩略图条
 *  - 浏览器原生 controls(播放/暂停/进度条/全屏);preload=metadata 不预加载整段
 *  - 不自动播放,避免噪音
 *  - 键盘:ESC 关闭,← / → 切换
 */
export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  videos,
  initialIndex = 0,
  onClose,
}) => {
  const safeInitial = Math.min(Math.max(initialIndex, 0), Math.max(videos.length - 1, 0));
  const [index, setIndex] = useState(safeInitial);
  const [isDownloading, setIsDownloading] = useState(false);

  const total = videos.length;
  const current = videos[index];

  const handleDownloadCurrent = useCallback(async () => {
    if (!current) return;
    const filename = resolveFilename(current, index, 'mp4');
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
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

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
          title="下载当前视频"
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

        {/* 视频区 */}
        <div className="relative flex items-center justify-center">
          {total > 1 && (
            <button
              onClick={goPrev}
              className="absolute left-2 z-10 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:bg-white cursor-pointer"
              aria-label="上一个视频"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}

          {current && (
            <video
              // 切换 src 时强制重挂载,避免上一个视频残留播放/进度
              key={current.url}
              src={current.url}
              poster={current.poster ?? undefined}
              controls
              preload="metadata"
              playsInline
              className="max-w-[90vw] max-h-[80vh] rounded-lg shadow-2xl bg-black"
            />
          )}

          {total > 1 && (
            <button
              onClick={goNext}
              className="absolute right-2 z-10 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:bg-white cursor-pointer"
              aria-label="下一个视频"
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

        {/* 底部缩略图条(用封面 cover 作为缩略图) */}
        {total > 1 && (
          <div className="flex gap-1.5 max-w-[90vw] overflow-x-auto p-1">
            {videos.map((v, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-16 h-12 rounded overflow-hidden border-2 shrink-0 cursor-pointer relative ${
                  i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                aria-label={`查看第 ${i + 1} 个视频`}
              >
                {v.poster ? (
                  <img
                    src={v.poster}
                    alt={v.label ?? `thumb-${i}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-base">movie</span>
                  </div>
                )}
                {/* 缩略图右上角小播放标 */}
                <span className="absolute top-0.5 right-0.5 material-symbols-outlined text-[12px] text-white drop-shadow">
                  play_circle
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
