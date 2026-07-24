import http from '../client';

/**
 * 文件上传相关 API 封装
 *
 * 仅暴露前端业务方直接调用的 2 个接口:
 *   - uploadToken:      签发上传凭证(走腾讯云 COS,返回 uploadUrl)
 *   - uploadComplete:   上传成功后回调后端,获得 fileResourceId
 *
 * 业务方拿到 fileResourceId 后,通过 assetApi.create(...) 创建业务资源,
 * 由后端在 asset/create 内部自动调用 FileResourceManager.confirm(...),
 * 不需要前端直接调 /file/confirm。
 */

export type UploadTokenPurpose = 'AVATAR' | 'PRODUCT' | 'OTHER' | 'UP_DOWN_MERGE';

export interface UploadTokenRequest {
  purpose: UploadTokenPurpose;
  fileName: string;
  productId?: number;
}

export interface UploadTokenResponse {
  storage: 'QINIU' | 'COS';
  fileKey: string;
  accessUrl: string;
  uploadTokenInfo: {
    /** QINIU 专用(本项目不实现) */
    upToken?: string;
    /** COS 临时凭证 */
    tmpSecretId?: string;
    tmpSecretKey?: string;
    sessionToken?: string;
    expiredTime?: number;
    startTime?: number;
    region?: string;
    bucket?: string;
    /** COS 预签名 PUT URL —— 本项目主用 */
    uploadUrl?: string;
    fileKey?: string;
  };
}

export interface UploadCompleteRequest {
  fileKey: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface UploadCompleteResponse {
  /** 后端 Long → string,避免 JS 精度丢失 */
  fileResourceId: string;
  fileKey: string;
  accessUrl: string;
  uploadedAt: number;
}

export const fileApi = {
  uploadToken: (req: UploadTokenRequest) =>
    http.post<UploadTokenResponse>('/v1/admin/file/upload-token', req),

  uploadComplete: (req: UploadCompleteRequest) =>
    http.post<UploadCompleteResponse>(
      '/v1/admin/file/upload-complete',
      req,
    ),
};