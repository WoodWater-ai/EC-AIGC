/**
 * COS 图片处理 URL 转换工具
 *
 * 腾讯云 COS CI(数据万象)thumbnail 参数:
 *   ?imageMogr2/thumbnail/{W}x>
 *
 * - 宽度最大 W(px),高度等比
 * - 若原图宽度 ≤ W 则不处理(避免无意义放大)
 * - 仅用于图片类型 URL;视频不适用
 *
 * 文档:
 *   https://cloud.tencent.com/document/product/436/44880
 */

/**
 * 给图片 URL 追加 COS imageMogr2 thumbnail 参数
 * @param url 原始 URL;非字符串/空值/null 原样返回
 * @param maxWidth 目标最大宽度(px),默认 400
 * @returns 处理后的 URL;若已有 imageMogr2 则不重复添加
 */
export function withCosThumbnail(
  url: string | undefined | null,
  maxWidth = 400,
): string | undefined {
  if (url == null || url === '') return undefined;
  if (url.includes('imageMogr2')) return url; // 已处理过
  // 容错:URL 已有 query 时用 & 拼,否则用 ?
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}imageMogr2/thumbnail/${maxWidth}x>`;
}
