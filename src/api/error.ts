import { toast } from 'sonner';
import { clearToken } from './auth';

/**
 * 业务错误对象 —— 拦截器 throw 用，业务组件 catch 后可读 errCode 判断语义
 */
export class ApiError extends Error {
  constructor(public errCode: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 登录异常错误码 —— 后端 EnumServiceException.A0102xx 序列（7 个）
 *
 * 来源：
 *   - dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/EnumServiceException.java:53-88
 *   - dafenqi-ai/src/main/java/com/dafenqi/ai/exception/GlobalExceptionHandler.java:181-194
 *
 * 触发行为：clearToken() + toast(errMessage) + 跳登录页（通过 onLoginRequired callback）
 *
 * 同步约定：后端新增 A0102xx 系列错误码时，前端 Set 必须同步更新。
 * A010206 = USER_PERMISSION_LACK_ERROR（用户权限不足），不属于登录异常，不在此 Set。
 */
const LOGIN_ERR_CODES: ReadonlySet<string> = new Set([
  'A010200', // token 异常
  'A010201', // 没有 token
  'A010202', // token 无效
  'A010203', // Token 已过期
  'A010204', // Token 已被顶下线（账号在其他设备登录）
  'A010205', // Token 已被踢下线
  'A010207', // 登录已过期请重新登录
]);

/** 公开导出：业务组件可用 `isLoginError(errCode)` 识别登录异常 */
export function isLoginError(errCode: string): boolean {
  return LOGIN_ERR_CODES.has(errCode);
}

/**
 * 登录态失效回调 —— 由 App.tsx 在挂载时注册为 setScreen(LOGIN)
 *
 * 为什么不用 window.location.href？
 *   - 当前架构无 React Router，全局跳转会导致白屏一闪
 *   - 后续切 React Router 时改成 navigate('/login') 即可
 *
 * 解耦原因：error.ts 是纯模块，不能 import React / hook
 */
let onLoginRequired: () => void = () => {
  // Fallback：在 App.tsx 注册前的极短窗口期，或单测环境下
  window.location.href = '/login';
};

export function setLoginRequiredHandler(handler: () => void): void {
  onLoginRequired = handler;
}

/**
 * 错误码 → toast + 特殊处理
 *
 * 设计原则：
 * - errMessage 由后端 messageSource.getMessage(errCode, [], zh_CN) 渲染
 * - 前端直接 toast(errMessage)，不翻译 errCode
 * - 登录异常（Set 命中）优先级最高：清 token + toast + 跳登录页
 * - 业务警告（约定 WARN_ 前缀）：warning toast
 * - 其它业务错误：error toast
 */
export function mapErrCodeToToast(err: ApiError): void {
  const { errCode, message } = err;

  // 1. 登录异常
  if (LOGIN_ERR_CODES.has(errCode)) {
    clearToken();
    toast.error(message || '登录已过期，请重新登录');
    onLoginRequired();
    return;
  }

  // 2. 业务警告类（约定 WARN_ 前缀）
  if (errCode.startsWith('WARN_')) {
    toast.warning(message);
    return;
  }

  // 3. 其它业务错误
  toast.error(message);
}