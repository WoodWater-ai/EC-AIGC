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
export type FileUploadPurpose = 'AVATAR' | 'PRODUCT' | 'OTHER';

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
        const completeResp = await fileApi.uploadComplete({
          fileKey: cosResult.Key,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
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