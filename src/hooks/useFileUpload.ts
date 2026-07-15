import { useState, useCallback } from 'react';
import COS from 'cos-js-sdk-v5';
import { fileApi } from '../api/modules/file';

/**
 * 通用文件上传 hook —— 通过腾讯云 COS JS SDK 上传
 *
 * 流程:
 *   1. POST /v1/admin/file/upload-token    → 后端签发 STS 凭证 + uploadUrl/fileKey
 *   2. cos.uploadFile({ Bucket, Region, Key, Body, ...STS })  → COS 直传
 *   3. POST /v1/admin/file/upload-complete → 后端 markUploaded,返回 fileResourceId
 *
 * 使用官方 cos-js-sdk-v5 SDK:
 *   - SDK 自动处理 STS token 注入
 *   - SDK 自动计算 PUT 请求签名(避免自己拼 URL 漏算法)
 *   - SDK 自动处理 CORS 预检(浏览器侧)
 *
 * 错误处理:
 *   - token 签发失败  → throw Error(message)
 *   - COS 上传失败    → throw Error(COS 返回的错误码 + message)
 *   - upload-complete 失败 → throw Error(message)
 */
export type FileUploadPurpose = 'AVATAR' | 'PRODUCT' | 'OTHER' | 'UP_DOWN_MERGE';

export interface UseFileUploadOptions {
  purpose: FileUploadPurpose;
  productId?: number;
  onProgress?: (percent: number) => void;
}

export interface FileUploadResult {
  fileResourceId: number;
  fileKey: string;
  accessUrl: string;
}

/** 懒加载 SDK 实例(避免每次 hook 调用都创建) */
let cachedCos: COS | null = null;
let cachedTokenKey = '';

function getCos(tmpSecretId: string, tmpSecretKey: string, sessionToken: string): COS {
  // STS 凭证变化时重建实例(SecretId/SecretKey/SecurityToken 是构造参数,无法热更新)
  const tokenKey = `${tmpSecretId}|${tmpSecretKey}|${sessionToken}`;
  if (!cachedCos || cachedTokenKey !== tokenKey) {
    cachedCos = new COS({
      SecretId: tmpSecretId,
      SecretKey: tmpSecretKey,
      SecurityToken: sessionToken,
      Protocol: 'https:',
    });
    cachedTokenKey = tokenKey;
  }
  return cachedCos;
}

/** 媒体元数据 —— 上传 complete 时回传给后端 */
export interface MediaMeta {
  width?: number;
  height?: number;
  durationSec?: number;
}

/**
 * 本地读取文件媒体元数据(图片读宽高,视频读时长)
 * - 图片:走 createImageBitmap 异步 API(无需 DOM)
 * - 视频:用 <video> 元素 + loadedmetadata 事件
 * - 失败返回空对象(不会阻塞上传)
 */
export async function readMediaMeta(file: File): Promise<MediaMeta> {
  const mime = file.type || '';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');

  if (!isImage && !isVideo) return {};

  if (isImage) {
    try {
      const bitmap = await createImageBitmap(file);
      const meta = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return meta;
    } catch {
      return {};
    }
  }

  // 视频:用 <video> 元素
  return new Promise<MediaMeta>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.removeAttribute('src');
      video.load();
    };
    const finish = (meta: MediaMeta) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(meta);
    };
    video.onloadedmetadata = () => {
      finish({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSec: Number.isFinite(video.duration) ? Math.round(video.duration) : undefined,
      });
    };
    video.onerror = () => finish({});
    video.src = URL.createObjectURL(file);
    // 安全超时:3s 后强制返回
    setTimeout(() => finish({}), 3000);
  });
}

export function useFileUpload(options: UseFileUploadOptions) {
  const { purpose, productId, onProgress } = options;

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<FileUploadResult | null>(null);

  const upload = useCallback(
    async (file: File): Promise<FileUploadResult> => {
      setLoading(true);
      setProgress(0);
      setError(null);

      try {
        // Step 1: 签发 token
        const tokenResp = await fileApi.uploadToken({
          purpose,
          fileName: file.name,
          productId: purpose === 'PRODUCT' ? productId : undefined,
        });
        const info = tokenResp.uploadTokenInfo;
        if (!info || !info.fileKey || !info.bucket || !info.region) {
          throw new Error('上传凭证不完整(缺少 fileKey/bucket/region)');
        }

        // Step 1.5: 本地读取媒体元数据(宽高 / 时长)
        // 失败不阻塞上传;后端可选地用这些字段入库
        const mediaMeta = await readMediaMeta(file);

        // Step 2: 用 COS SDK 上传
        const cos = getCos(
          info.tmpSecretId ?? '',
          info.tmpSecretKey ?? '',
          info.sessionToken ?? '',
        );

        const cosResult = await new Promise<{ Location: string; Key: string }>(
          (resolve, reject) => {
            cos.uploadFile(
              {
                Bucket: info.bucket!,
                Region: info.region!,
                Key: info.fileKey!,
                Body: file,
                SliceSize: 5 * 1024 * 1024, // 5MB 分片(SDK 内部会决定是否分片)
                onTaskReady: (taskId) => {
                  console.debug('[COS] taskId:', taskId);
                },
                onProgress: (progressData) => {
                  const pct = Math.round((progressData.loaded / progressData.total) * 100);
                  setProgress(pct);
                  onProgress?.(pct);
                },
              },
              (err: unknown, data: { Location?: string; Key?: string }) => {
                if (err) {
                  const e = err as { code?: string; message?: string };
                  reject(new Error(`COS 上传失败: ${e.code ?? ''} ${e.message ?? ''}`));
                  return;
                }
                resolve({
                  Location: data.Location ?? '',
                  Key: data.Key ?? info.fileKey!,
                });
              },
            );
          },
        );

        // Step 3: 上传完成回调(只调 complete,create 由调用方决定,assetType 由业务上下文决定)
        // 携带本地读取的 width/height/durationSec,后端入库用
        const completeResp = await fileApi.uploadComplete({
          fileKey: cosResult.Key,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          width: mediaMeta.width,
          height: mediaMeta.height,
          durationSec: mediaMeta.durationSec,
        });

        const out: FileUploadResult = {
          fileResourceId: completeResp.fileResourceId,
          fileKey: completeResp.fileKey,
          accessUrl: completeResp.accessUrl,
        };
        setResult(out);
        return out;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [purpose, productId, onProgress],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return { upload, loading, progress, error, result, reset };
}