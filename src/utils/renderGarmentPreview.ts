export interface GarmentPreviewLayer {
  url: string;
  scale: number;
  translateX: number;
  translateY: number;
  sourceAnchorX: number;
  sourceAnchorY: number;
  targetAnchorX: number;
  targetAnchorY: number;
}

export interface GarmentPreviewResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface GarmentPlacementSource {
  partAnchorSchema: Record<string, unknown>;
  bindingAnchorMapping: Record<string, unknown>;
  bindingTransform: Record<string, unknown>;
}

export interface GarmentPlacement {
  scale: number;
  translateX: number;
  translateY: number;
  sourceAnchorX: number;
  sourceAnchorY: number;
  targetAnchorX: number;
  targetAnchorY: number;
}

/** 校准、编辑预览和 1024x1024 固化共同使用的组件基准宽度。 */
export const GARMENT_PREVIEW_BASE_WIDTH_RATIO = 0.48;
export const GARMENT_PREVIEW_BACKGROUND_COLOR = '#faf9f7';

function point(value: unknown, fallback: { x: number; y: number }) {
  if (typeof value !== 'object' || value === null) return fallback;
  const raw = value as Record<string, unknown>;
  const x = typeof raw.x === 'number' && raw.x >= 0 && raw.x <= 1 ? raw.x : fallback.x;
  const y = typeof raw.y === 'number' && raw.y >= 0 && raw.y <= 1 ? raw.y : fallback.y;
  return { x, y };
}

/** 将新旧绑定变换统一为画布 0—1 坐标；旧数据的 ±1 微调按 20% 画布解释。 */
export function resolveGarmentPlacement(source: GarmentPlacementSource): GarmentPlacement {
  const sourceAnchorName = typeof source.bindingAnchorMapping.sourceAnchor === 'string'
    ? source.bindingAnchorMapping.sourceAnchor
    : 'origin';
  const sourceAnchor = point(source.partAnchorSchema[sourceAnchorName], { x: 0.5, y: 0.5 });
  const targetAnchor = point(source.bindingAnchorMapping.targetAnchor, { x: 0.5, y: 0.5 });
  const rawScale = source.bindingTransform.scale;
  const scale = typeof rawScale === 'number' && rawScale >= 0.1 && rawScale <= 10 ? rawScale : 1;
  const rawTranslateX = typeof source.bindingTransform.translateX === 'number' ? source.bindingTransform.translateX : 0;
  const rawTranslateY = typeof source.bindingTransform.translateY === 'number' ? source.bindingTransform.translateY : 0;
  const translationFactor = source.bindingTransform.translationSpace === 'CANVAS_NORMALIZED' ? 1 : 0.2;
  return {
    scale,
    translateX: rawTranslateX * translationFactor,
    translateY: rawTranslateY * translationFactor,
    sourceAnchorX: sourceAnchor.x,
    sourceAnchorY: sourceAnchor.y,
    targetAnchorX: targetAnchor.x,
    targetAnchorY: targetAnchor.y,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`组件图片加载失败: ${url}`));
    image.src = url;
  });
}

/**
 * 将结构化组件按与编辑器一致的层序和变换固化为栅格输入。
 * 该文件是可重建预览，不替代版型/组件版本等结构化事实。
 */
export async function renderGarmentPreview(
  layers: GarmentPreviewLayer[],
  backgroundColor = GARMENT_PREVIEW_BACKGROUND_COLOR,
): Promise<GarmentPreviewResult> {
  if (layers.length === 0) throw new Error('没有可渲染的服装组件');
  const width = 1024;
  const height = 1024;
  const images = await Promise.all(layers.map((layer) => loadImage(layer.url)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 上下文不可用');

  ctx.fillStyle = /^#[0-9A-F]{6}$/i.test(backgroundColor)
    ? backgroundColor : GARMENT_PREVIEW_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);
  layers.forEach((layer, index) => {
    const image = images[index];
    const baseScale = (width * GARMENT_PREVIEW_BASE_WIDTH_RATIO) / image.naturalWidth;
    const drawWidth = image.naturalWidth * baseScale * layer.scale;
    const drawHeight = image.naturalHeight * baseScale * layer.scale;
    const x = (layer.targetAnchorX + layer.translateX) * width - layer.sourceAnchorX * drawWidth;
    const y = (layer.targetAnchorY + layer.translateY) * height - layer.sourceAnchorY * drawHeight;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('服装预览导出失败')), 'image/png');
  });
  return { blob, width, height };
}
