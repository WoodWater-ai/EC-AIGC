import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import type { ServiceResult } from './service-result';
import { ApiError, mapErrCodeToToast } from './error';
import { getToken } from './auth';
import { signRequest } from '../utils/sign';

/**
 * 全局 axios 实例
 *
 * 设计要点：
 * 1. withCredentials: true —— 即便走 header 模式，也带 cookie 兜底
 *    Sa-Token 默认先读 cookie，读不到再读 header
 * 2. 请求拦截器注入 Authorization header —— 注意不放 'Bearer '（Sa-Token 用 token 原值）
 * 3. 响应拦截器只做错误检查：success=false 调 mapErrCodeToToast 后 throw
 *    （不修改 resp.data，让 axios 类型签名保持兼容）
 * 4. 业务层 wrapper (`http` 的 getter 方法) 解构 resp.data → T
 *    这样业务代码 `http.get<TaskDTO[]>(url)` 拿到的就是 `TaskDTO[]`
 *
 * 后端契约：ServiceResult.success === true 才算请求成功；失败时 errMessage 是后端 i18n 中文
 */

const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL ?? '/api';

const httpRaw: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true, // 双通道兜底
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：注入 Authorization header + 请求签名(@RequestSign 端点)
httpRaw.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = token; // 不放 'Bearer '
  }
  // [2026-07-17] /v1/task/submit 等端点有 @RequestSign 拦截,前端必须注入 X-Sign/X-Sign-Nonce/X-Sign-Timestamp
  // 这里对所有 POST/PUT 请求统一签名(只有少数端点需要,目前项目内除 GET 外的请求都走签名)
  if (config.data && (config.method === 'post' || config.method === 'put')) {
    const signHeaders = signRequest(config.data);
    for (const [k, v] of Object.entries(signHeaders)) {
      config.headers.set(k, v);
    }
  }
  return config;
});

// 响应拦截器：只做错误检查，不修改 resp.data（保持 axios 类型兼容）
httpRaw.interceptors.response.use(
  (resp) => {
    if (resp.config.responseType === 'blob') return resp;
    const r = resp.data as ServiceResult<unknown>;
    if (!r.success) {
      const err = new ApiError(r.errCode ?? 'UNKNOWN', r.errMessage ?? '请求失败');
      mapErrCodeToToast(err);
      throw err;
    }
    return resp;
  },
  (error) => {
    // 只有真正的网络层错误到这里（后端挂了 / CORS / 超时）
    // 注意：Sa-Token 业务异常不会触发 HTTP 401，被 GlobalExceptionHandler 包装成 ServiceResult.success=false
    toast.error(error.message || '网络错误');
    return Promise.reject(error);
  }
);

/**
 * 业务层 http —— 拦截器已经把 resp.data 解构为 T，业务代码直接拿到
 *
 * 用法：
 *   const tasks = await http.get<TaskDTO[]>('/v1/admin/tasks');
 *   const result = await http.post<CreatedTaskDTO>('/v1/admin/tasks', body);
 */
export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    httpRaw.get<ServiceResult<T>>(url, config).then((r) => r.data.data as T),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    httpRaw.post<ServiceResult<T>>(url, data, config).then((r) => r.data.data as T),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    httpRaw.put<ServiceResult<T>>(url, data, config).then((r) => r.data.data as T),

  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    httpRaw.delete<ServiceResult<T>>(url, config).then((r) => r.data.data as T),

  getBlob: (url: string): Promise<Blob> =>
    httpRaw.get<Blob>(url, { responseType: 'blob' }).then(async (response) => {
      const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
      if (contentType.includes('application/json')) {
        const payload = JSON.parse(await response.data.text()) as ServiceResult<unknown>;
        throw new ApiError(payload.errCode ?? 'UNKNOWN', payload.errMessage ?? '证据原件读取失败');
      }
      if (!contentType.includes('application/pdf')) {
        throw new ApiError('INVALID_EVIDENCE_RESPONSE', '证据原件响应类型不正确');
      }
      return response.data;
    }),
};

export default http;
