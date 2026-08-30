import { fetchAsBlob, triggerBrowserDownload } from './downloadFile';

export interface DownloadFailure {
  id: string;
  name: string;
  reason: string;
}

export interface DownloadBatchResult {
  success: number;
  failed: DownloadFailure[];
}

export interface DownloadBatchOptions {
  /** 项间延迟毫秒,默认 200(规避 Chrome 多下载限速) */
  delayMs?: number;
  /** 每项完成回调(无论成功失败) */
  onItemComplete?: (idx: number) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * 顺序下载一批资源。失败项不影响后续项。
 * - 缺 originalUrl:failed,reason='缺少原图地址'
 * - fetchAsBlob 抛错:failed,reason=err.message
 * - 全程不抛错
 */
export async function downloadAssetsSequentially(
  items: Array<{ id: string; name: string; originalUrl?: string }>,
  opts?: DownloadBatchOptions,
): Promise<DownloadBatchResult> {
  const delayMs = opts?.delayMs ?? 200;
  const result: DownloadBatchResult = { success: 0, failed: [] };
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item.originalUrl) {
      result.failed.push({ id: item.id, name: item.name, reason: '缺少原图地址' });
    } else {
      try {
        const blob = await fetchAsBlob(item.originalUrl);
        const blobUrl = URL.createObjectURL(blob);
        try {
          triggerBrowserDownload(blobUrl, item.name);
        } finally {
          // 延迟 revoke,避免部分浏览器下载未启动
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }
        result.success += 1;
      } catch (err) {
        result.failed.push({
          id: item.id,
          name: item.name,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
    opts?.onItemComplete?.(idx);
    if (idx < items.length - 1 && delayMs > 0) {
      await wait(delayMs);
    }
  }
  return result;
}
