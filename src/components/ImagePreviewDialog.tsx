import React, { useEffect, useMemo, useState } from 'react';

export interface PreviewImage {
  id: string;
  url: string;
  alt: string;
}

interface ImagePreviewDialogProps {
  images: PreviewImage[];
  initialImageId: string;
  onClose: () => void;
}

const zoomLevels = [1, 1.5, 2];

export const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = ({ images, initialImageId, onClose }) => {
  const initialIndex = useMemo(() => Math.max(0, images.findIndex((image) => image.id === initialImageId)), [images, initialImageId]);
  const [index, setIndex] = useState(initialIndex);
  const [zoomIndex, setZoomIndex] = useState(0);
  const current = images[index] ?? images[0];

  useEffect(() => {
    setIndex(initialIndex);
    setZoomIndex(0);
  }, [initialIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (images.length > 1 && event.key === 'ArrowLeft') setIndex((currentIndex) => (currentIndex - 1 + images.length) % images.length);
      if (images.length > 1 && event.key === 'ArrowRight') setIndex((currentIndex) => (currentIndex + 1) % images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [images.length, onClose]);

  if (!current) return null;
  const previous = () => { setIndex((currentIndex) => (currentIndex - 1 + images.length) % images.length); setZoomIndex(0); };
  const next = () => { setIndex((currentIndex) => (currentIndex + 1) % images.length); setZoomIndex(0); };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4" role="dialog" aria-modal="true" aria-label="图片预览">
    <button onClick={onClose} className="absolute inset-0 cursor-default" aria-label="关闭图片预览" />
    <div className="relative z-10 flex h-full w-full max-w-6xl flex-col items-center justify-center">
      <div className="absolute right-0 top-0 flex items-center gap-2">
        <button onClick={() => setZoomIndex((value) => (value + 1) % zoomLevels.length)} className="grid h-9 w-9 place-items-center rounded-md bg-white/95 text-slate-700 shadow-sm" aria-label="切换图片缩放">
          <span className="material-symbols-outlined text-lg">zoom_in</span>
        </button>
        <a href={current.url} download className="grid h-9 w-9 place-items-center rounded-md bg-white/95 text-slate-700 shadow-sm" aria-label="下载当前图片">
          <span className="material-symbols-outlined text-lg">download</span>
        </a>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md bg-white/95 text-slate-700 shadow-sm" aria-label="关闭图片预览">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-auto px-12 py-14">
        <img src={current.url} alt={current.alt} className="max-h-[78vh] max-w-full object-contain transition-transform duration-200" style={{ transform: `scale(${zoomLevels[zoomIndex]})` }} />
      </div>
      <div className="absolute bottom-1 flex items-center gap-3 text-xs font-bold text-white">
        {images.length > 1 && <button onClick={previous} className="grid h-9 w-9 place-items-center rounded-md bg-white/15 hover:bg-white/25" aria-label="查看上一张图片"><span className="material-symbols-outlined">chevron_left</span></button>}
        <span>{index + 1} / {images.length}</span>
        {images.length > 1 && <button onClick={next} className="grid h-9 w-9 place-items-center rounded-md bg-white/15 hover:bg-white/25" aria-label="查看下一张图片"><span className="material-symbols-outlined">chevron_right</span></button>}
      </div>
    </div>
  </div>;
};
