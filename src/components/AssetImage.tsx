import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { withCosThumbnail } from '../utils/cosImage';

interface AssetImageProps {
  /** URL 数组,按顺序尝试加载;任一加载成功就停在当前 src,全部失败显示缺损图 */
  urls: (string | undefined | null)[];
  alt?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
  /** 媒体在预览框中的缩放方式；资源中心使用 contain 保证长图/宽图完整显示。 */
  objectFit?: 'cover' | 'contain';
  /** 自定义 fallback(覆盖默认缺损图),传 null/false 时不渲染任何东西 */
  fallback?: React.ReactNode;
  /** 资源类型:视频用 <video> 元素,图片用 <img> */
  assetKind?: 'IMAGE' | 'VIDEO';
  /**
   * 图片最大宽度(px)。仅对 IMAGE 类型生效,VIDEO 不适用。
   * 给 URL 追加 COS imageMogr2 thumbnail 参数,服务端按宽度等比缩放,避免原图流量浪费。
   * 默认 400。传 0 或负数禁用(不添加参数)。
   */
  maxWidth?: number;
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
  objectFit = 'cover',
  fallback,
  assetKind,
  maxWidth = 400,
}) => {
  // 过滤掉空值,记录当前尝试到第几个
  const validUrls = urls.filter((u): u is string => !!u);
  // COS thumbnail 应用于所有"图片用途"URL:
  //   - IMAGE 类型的 src(主用途)
  //   - VIDEO 类型的 poster(避免 thumbnailUrl 是大图)
  // VIDEO 类型的 src(视频本体)保持原 URL —— 它走 preload="metadata",只下头部几 KB
  // maxWidth <= 0 时不应用(留作"禁用"开关)
  const processedUrls =
    maxWidth > 0
      ? validUrls.map((u) => withCosThumbnail(u, maxWidth) ?? u)
      : validUrls;
  const [urlIndex, setUrlIndex] = useState(0);

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
        ? 'aspect-video'
        : 'max-h-full';  // [2026-07-16 P0] auto 模式不加 aspect 约束,避免长图被裁剪;配合 object-contain 完整显示

  const handleError = () => {
    setUrlIndex((prev) => prev + 1);
  };

  // 全部失败:显示 fallback 或默认缺损图
  if (urlIndex >= processedUrls.length) {
    if (fallback === null || fallback === false) return null;
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`relative overflow-hidden bg-slate-100 flex flex-col items-center justify-center text-slate-400 ${aspectClass} ${className ?? ''}`}
      >
        <ImageOff className="w-8 h-8 mb-1" strokeWidth={1.5} />
        <span className="text-[10px] font-medium">
          {assetKind === 'VIDEO' ? '视频加载失败' : '图片加载失败'}
        </span>
      </div>
    );
  }

  // 视频:用 <video> 元素,preload="metadata" 只下载头部(几 KB),显示首帧
  if (assetKind === 'VIDEO') {
    // poster 也走 COS imageMogr2:thumbnailUrl 可能是大尺寸原图,需服务端压缩
    const processedPoster = validUrls[1]
      ? (processedUrls[1] ?? validUrls[1])
      : undefined;
    return (
      <div
        className={`relative overflow-hidden bg-slate-900 ${aspectClass} ${className ?? ''}`}
      >
        <video
          src={validUrls[urlIndex]}
          // 第二个 URL(thumbnailUrl)作为 poster 海报
          poster={processedPoster}
          preload="metadata"
          muted
          playsInline
          onError={handleError}
          className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
        {/* 中心 play 图标(指示这是视频) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <span
              className="material-symbols-outlined text-white text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              play_arrow
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 图片:用 <img> 元素
  return (
    <div
      className={`relative overflow-hidden bg-slate-50 ${aspectClass} ${className ?? ''}`}
    >
      <img
        src={processedUrls[urlIndex]}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={handleError}
        loading="lazy"
        className={`w-full h-full ${
          aspectRatio === 'auto' || objectFit === 'contain' ? 'object-contain' : 'object-cover'
        }`}
      />
    </div>
  );
};
