/**
 * Canvas 拼接两张图为一张
 *
 * 规则:
 *   - 目标 H = max(img1.h, img2.h)
 *   - 两图按比例缩放到 height = H(允许放大到 H 但不超出)
 *   - 等于 H 的不缩放
 *   - 直接拼接(无 gap)
 *   - 返回 Blob(PNG)
 *
 * 用例: CreateImageTask 上下装合成
 */

export interface MergeOptions {
  /** 跨域图片:传 true 给 image.crossOrigin = 'anonymous',需要 COS / CDN 配 CORS */
  crossOrigin?: boolean;
  /** 输出图片质量 0-1(仅 JPEG / WebP 有效) */
  quality?: number;
  /** 输出格式;默认 image/png */
  mimeType?: string;
}

export type MergeDirection = 'VERTICAL' | 'HORIZONTAL';

export interface MergeResult {
  blob: Blob;
  width: number;
  height: number;
}

interface LoadedImage {
  img: HTMLImageElement;
  naturalW: number;
  naturalH: number;
}

/**
 * 加载一张图片(走 CORS 模式)
 * 失败抛 Error('image load failed: <url>')
 */
function loadImage(url: string, crossOrigin: boolean): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    let settled = false;
    img.onload = () => {
      if (settled) return;
      settled = true;
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error(`image has zero dimensions: ${url}`));
        return;
      }
      resolve({ img, naturalW: img.naturalWidth, naturalH: img.naturalHeight });
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`image load failed: ${url}`));
    };
    img.src = url;
  });
}

/**
 * 横向(左右)拼接两张图
 * @returns Blob + width + height(便于上层做预览)
 */
export async function mergeImagesHorizontal(
  url1: string,
  url2: string,
  opts: MergeOptions = {},
): Promise<MergeResult> {
  return mergeImages([url1, url2], 'HORIZONTAL', opts);
}

/**
 * 按选择顺序合并两张及以上图片。
 * - 左右合成：统一到最高图片的高度后从左向右排列
 * - 上下合成：统一到最宽图片的宽度后从上向下排列
 */
export async function mergeImages(
  urls: string[],
  direction: MergeDirection,
  opts: MergeOptions = {},
): Promise<MergeResult> {
  if (urls.length < 2) throw new Error('at least two images are required');
  const { crossOrigin = true, quality = 0.92, mimeType = 'image/png' } = opts;

  const images = await Promise.all(urls.map((url) => loadImage(url, crossOrigin)));
  const isHorizontal = direction === 'HORIZONTAL';
  const targetCrossAxis = isHorizontal
    ? Math.max(...images.map((item) => item.naturalH))
    : Math.max(...images.map((item) => item.naturalW));
  let sizes = images.map((item) => {
    const scale = targetCrossAxis / (isHorizontal ? item.naturalH : item.naturalW);
    return {
      width: Math.round(item.naturalW * scale),
      height: Math.round(item.naturalH * scale),
    };
  });
  let totalW = isHorizontal
    ? sizes.reduce((sum, size) => sum + size.width, 0)
    : targetCrossAxis;
  let totalH = isHorizontal
    ? targetCrossAxis
    : sizes.reduce((sum, size) => sum + size.height, 0);

  // 多图拼接可能轻易突破浏览器 Canvas 上限，统一缩小后再绘制，避免空白预览或内存暴涨。
  const MAX_CANVAS_EDGE = 16_384;
  const MAX_CANVAS_PIXELS = 24_000_000;
  const outputScale = Math.min(
    1,
    MAX_CANVAS_EDGE / totalW,
    MAX_CANVAS_EDGE / totalH,
    Math.sqrt(MAX_CANVAS_PIXELS / (totalW * totalH)),
  );
  if (outputScale < 1) {
    sizes = sizes.map((size) => ({
      width: Math.max(1, Math.round(size.width * outputScale)),
      height: Math.max(1, Math.round(size.height * outputScale)),
    }));
    totalW = isHorizontal
      ? sizes.reduce((sum, size) => sum + size.width, 0)
      : Math.max(...sizes.map((size) => size.width));
    totalH = isHorizontal
      ? Math.max(...sizes.map((size) => size.height))
      : sizes.reduce((sum, size) => sum + size.height, 0);
  }

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  let offset = 0;
  images.forEach((item, index) => {
    const size = sizes[index];
    const x = isHorizontal ? offset : 0;
    const y = isHorizontal ? 0 : offset;
    ctx.drawImage(item.img, x, y, size.width, size.height);
    offset += isHorizontal ? size.width : size.height;
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('canvas toBlob returned null'));
      },
      mimeType,
      quality,
    );
  });

  return { blob, width: totalW, height: totalH };
}
