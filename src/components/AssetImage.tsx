import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface AssetImageProps {
  /** URL 数组,按顺序尝试加载;任一加载成功就停在当前 src,全部失败显示缺损图 */
  urls: (string | undefined | null)[];
  alt?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
  /** 自定义 fallback(覆盖默认缺损图),传 null/false 时不渲染任何东西 */
  fallback?: React.ReactNode;
}

/**
 * 通用资产图片预览 —— 统一防盗链 + 多 URL fallback + 缺损状态图
 *
 * 设计要点:
 *   - urls 按顺序尝试(typical: [originalUrl, thumbnailUrl])
 *   - 任一 URL 加载成功就停在那一帧
 *   - 全部失败显示缺损占位(图标 + 提示)
 *   - referrerPolicy="no-referrer" 防止 OSS CDN 防盗链拦截
 *
 * 使用:
 *   <AssetImage urls={[asset.originalUrl, asset.thumbnailUrl]} aspectRatio="square" />
 *   <AssetImage urls={[asset.thumbnailUrl]} fallback={<CustomBroken />} />
 */
export const AssetImage: React.FC<AssetImageProps> = ({
  urls,
  alt = '',
  className,
  aspectRatio = 'square',
  fallback,
}) => {
  // 过滤掉空值,记录当前尝试到第几个
  const validUrls = urls.filter((u): u is string => !!u);
  const [urlIndex, setUrlIndex] = useState(0);

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
        ? 'aspect-video'
        : '';

  const handleError = () => {
    setUrlIndex((prev) => prev + 1);
  };

  // 全部失败:显示 fallback 或默认缺损图
  if (urlIndex >= validUrls.length) {
    if (fallback === null || fallback === false) return null;
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`relative overflow-hidden bg-slate-100 flex flex-col items-center justify-center text-slate-400 ${aspectClass} ${className ?? ''}`}
      >
        <ImageOff className="w-8 h-8 mb-1" strokeWidth={1.5} />
        <span className="text-[10px] font-medium">图片加载失败</span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-50 ${aspectClass} ${className ?? ''}`}
    >
      <img
        src={validUrls[urlIndex]}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={handleError}
        className="w-full h-full object-cover"
      />
    </div>
  );
};