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
): Promise<{ blob: Blob; width: number; height: number }> {
  const { crossOrigin = true, quality = 0.92, mimeType = 'image/png' } = opts;

  const [a, b] = await Promise.all([loadImage(url1, crossOrigin), loadImage(url2, crossOrigin)]);

  // 目标 H = max(两图原始高度);两图按等比缩放到 H
  const targetH = Math.max(a.naturalH, b.naturalH);
  const aScale = targetH / a.naturalH;
  const bScale = targetH / b.naturalH;
  const aW = Math.round(a.naturalW * aScale);
  const bW = Math.round(b.naturalW * bScale);
  const totalW = aW + bW;

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // 左图 drawImage(x=0, y=0, w=aW, h=targetH)
  ctx.drawImage(a.img, 0, 0, aW, targetH);
  // 右图 drawImage(x=aW, y=0, w=bW, h=targetH)
  ctx.drawImage(b.img, aW, 0, bW, targetH);

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

  return { blob, width: totalW, height: targetH };
}
