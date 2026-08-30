/** mime → 常用文件扩展名(无点号) */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/**
 * 从 mime 推断文件扩展名(无点号)。
 * 命中 MIME_EXTENSIONS 返回小写扩展名;否则返回 fallback,fallback 缺省时返回 'unknown'。
 */
export function inferExtensionFromMime(mime: string, fallback?: string): string {
  return MIME_EXTENSIONS[mime] ?? fallback ?? 'unknown';
}

/**
 * 触发浏览器保存。url 可以是 blob URL 或普通 URL。
 * openInNewTab=true 时退化为新标签页打开(用于 fetch 失败后的降级)。
 */
export function triggerBrowserDownload(
  url: string,
  fileName: string,
  openInNewTab = false,
): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noreferrer';
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * GET URL → Blob。响应非 2xx 抛错(含状态码)。
 * 不处理超时/重试,留给调用方。
 */
export async function fetchAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}
