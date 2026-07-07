# 前端 API 基础设施接入 — 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 EC-AIGC 前端 SPA 铺设"对接真实后端 API"的基础设施层，业务组件继续使用 mock，后续接入真实接口时按模板抄即可

**架构：** axios 实例 + 拦截器（响应层解 ServiceResult 包装） + 鉴权工具（B 模式：Authorization header + cookie 兜底） + A0102xx 登录异常识别 + sonner 顶部居中 toast + 轻量 useServiceQuery hook + OpenAPI 自动生成 TS 类型

**技术栈：** axios 1.7+ / sonner 1.7+ / openapi-typescript 7+ / React 19 / Vite 6 / TypeScript 5.8

**配套规格：** `docs/superpowers/specs/2026-07-06-frontend-api-integration-design.md`（22.8KB / 19 章）

**前置约束：**
- 项目无单测（AGENTS.md "当前不强制"）→ 验证走 `npm run lint`（tsc --noEmit）+ `npm run build` + 手工验证
- 用户偏好 IDE 工作流 → 计划中所有 `git commit` 命令由用户手工执行，不替用户跑
- 后端零改动（Sa-Token 默认双通道，前端 header 注入即可）

---

## 文件结构（任务分解前的边界锁定）

### 新建文件（11 个）

| 路径 | 职责 |
|---|---|
| `src/api/service-result.ts` | `ServiceResult<T>` 类型，对应后端 `ServiceResult.java` |
| `src/api/error.ts` | `ApiError` 类 + A0102xx Set + `mapErrCodeToToast` 映射 |
| `src/api/auth.ts` | token 存取（localStorage）：`getToken/setToken/clearToken` |
| `src/api/client.ts` | axios 实例 + 请求/响应拦截器 + ServiceResult 解构 |
| `src/api/hooks/useServiceQuery.ts` | 轻量 query hook，API 形状对齐 TanStack Query `useQuery` |
| `src/api/types.ts` | 业务 enum + re-export from `types.generated.ts` |
| `src/api/types.generated.ts` | OpenAPI 生成产物（`npm run gen:api` 产出，禁止手改） |
| `src/api/modules/task.ts` | 任务相关 API 占位 |
| `src/api/modules/template.ts` | 模板相关 API 占位 |
| `src/api/modules/asset.ts` | 素材库 API 占位 |
| `src/api/modules/channel.ts` | 模型渠道 API 占位 |
| `src/api/modules/user.ts` | 用户管理 API 占位 |
| `src/api/modules/auth.ts` | 登录 / 登出 API 占位 |
| `docs/api-integration-guide.md` | 接入指引文档（7 节） |

### 修改文件（4 个）

| 路径 | 修改内容 |
|---|---|
| `package.json` | + axios / sonner / openapi-typescript + 2 scripts（gen:api / gen:api:prod） |
| `vite.config.ts` | + `/api` proxy（CLAUDE.md 文档滞后，实际未配） |
| `.env.example` | 核对 `VITE_API_BASE_URL=/api` + `VITE_API_TARGET=http://localhost:8090` |
| `src/main.tsx` | 挂 `<Toaster position="top-center" />` |

### 不动的文件

`App.tsx` / `src/components/*.tsx`（12 个） / `src/types.ts` / `src/mockData.ts` / `tsconfig.json` / `index.html`

---

## 任务 1：依赖 + scripts

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：编辑 `package.json` 加 dependencies**

在 `dependencies` 块加：
```json
"axios": "^1.7.0",
"sonner": "^1.7.0"
```

- [ ] **步骤 2：编辑 `package.json` 加 devDependencies**

在 `devDependencies` 块加：
```json
"openapi-typescript": "^7.0.0"
```

- [ ] **步骤 3：编辑 `package.json` 加 npm scripts**

在 `scripts` 块加：
```json
"gen:api": "openapi-typescript http://localhost:8090/v3/api-docs -o src/api/types.generated.ts",
"gen:api:prod": "openapi-typescript ${VITE_API_DOCS_URL:-http://localhost:8090/v3/api-docs} -o src/api/types.generated.ts"
```

- [ ] **步骤 4：安装依赖**

运行：`npm install`
预期：node_modules 增加 axios / sonner / openapi-typescript，package-lock.json 更新，无错误

- [ ] **步骤 5：验证依赖装上**

运行：`npm ls axios sonner openapi-typescript --depth=0`
预期：3 个包都列出，版本正确

- [ ] **步骤 6：Commit（用户手工执行）**

```bash
git add package.json package-lock.json
git commit -m "chore: add axios / sonner / openapi-typescript + gen:api scripts"
```

---

## 任务 2：Vite proxy 补全 + .env 核对

**文件：**
- 修改：`vite.config.ts`
- 修改：`.env.example`

- [ ] **步骤 1：编辑 `vite.config.ts`**

替换现有内容为：
```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8090',
          changeOrigin: true,
        },
      },
    },
  };
});
```

注意：保留了原文件中的 HMR 配置（CLAUDE.md "HMR is disabled in AI Studio via DISABLE_HMR env var"），只追加 `proxy` 块。

- [ ] **步骤 2：核对 `.env.example`**

打开 `.env.example`，确认包含：
```env
VITE_API_BASE_URL=/api
VITE_API_TARGET=http://localhost:8090
```

如果缺失则追加。如果本地有 `.env.local`，确保它也包含这两行（不要 commit `.env.local`）。

- [ ] **步骤 3：Commit（用户手工执行）**

```bash
git add vite.config.ts .env.example
git commit -m "chore: add vite /api proxy → :8090 + env example"
```

---

## 任务 3：ServiceResult 类型

**文件：**
- 创建：`src/api/service-result.ts`

- [ ] **步骤 1：创建文件**

```ts
/**
 * 对应后端 com.dafenqi.ai.common.result.ServiceResult<T>
 *
 * 后端 @JsonInclude(ALWAYS) → 即便字段为 null 也会输出键
 * 因此前端 type 必须把全部字段标可选（除 success）
 *
 * 来源：dafenqi-ai/src/main/java/com/dafenqi/ai/common/result/ServiceResult.java
 */
export interface ServiceResult<T> {
  /** true 成功，false 失败（唯一非可选字段） */
  success: boolean;
  /** 错误码；后端 GlobalExceptionHandler 用 EnumServiceException 填入 */
  errCode?: string;
  /** 错误信息；后端 messageSource.getMessage(errCode, [], zh_CN) i18n 渲染 */
  errMessage?: string;
  /** 业务数据；拦截器解构后业务代码直接拿这个 */
  data?: T;
  /** 后端响应时间戳（后端默认 System.currentTimeMillis()） */
  timestamp?: number;
  /** 处理时长（毫秒），后端业务方选填 */
  costTime?: number;
}
```

- [ ] **步骤 2：类型检查通过**

运行：`npm run lint`
预期：无错误，无 warning

- [ ] **步骤 3：Commit（用户手工执行）**

```bash
git add src/api/service-result.ts
git commit -m "feat(api): add ServiceResult<T> type matching backend"
```

---

## 任务 4：错误处理 + A0102xx 登录异常

**文件：**
- 创建：`src/api/error.ts`

- [ ] **步骤 1：创建文件**

```ts
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
 * 触发行为：clearToken() + toast(errMessage) + window.location.href = '/login'
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
    window.location.href = '/login'; // 占位：登录页未做
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
```

- [ ] **步骤 2：类型检查通过**

运行：`npm run lint`
预期：无错误。注意：`auth.ts` 还没创建，但 tsc 对未解析模块会报错 → 这是预期的，任务 5 创建 `auth.ts` 后通过

如果想单独验证：临时注释掉 `import { clearToken } from './auth';` 那行 + 函数体里 `clearToken();`，跑 lint 通过；任务 5 完成后取消注释。

- [ ] **步骤 3：Commit（用户手工执行）**

```bash
git add src/api/error.ts
git commit -m "feat(api): add ApiError + A0102xx login error handling"
```

---

## 任务 5：鉴权工具（B 模式 — Header-only）

**文件：**
- 创建：`src/api/auth.ts`

- [ ] **步骤 1：创建文件**

```ts
/**
 * Token 存储 —— B 模式（Header-only），localStorage
 *
 * 使用方式：
 * - 登录响应：setToken(resp.token)
 * - axios 拦截器：getToken() 注入 Authorization header
 * - 登出 / 登录异常：clearToken()
 *
 * 注意：
 * - 后端 sa-token.token-name = 'Authorization'，这里 TOKEN_KEY 也用 'satoken' 是约定俗成
 * - 实际 axios 拦截器注入的是 token 原值（不放 'Bearer '），所以 key 名对前端无影响
 * - 选 'satoken' 是因为跟后端 cookie 名（也是 'Authorization'）概念区分；后续如果切到 cookie-only 也好改
 */

const TOKEN_KEY = 'satoken';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);
```

- [ ] **步骤 2：类型检查通过**

运行：`npm run lint`
预期：无错误。此时任务 4 的 `error.ts` 也应通过完整 lint

- [ ] **步骤 3：Commit（用户手工执行）**

```bash
git add src/api/auth.ts
git commit -m "feat(api): add token storage (localStorage, B-mode header)"
```

---

## 任务 6：axios 实例 + 拦截器

**文件：**
- 创建：`src/api/client.ts`

- [ ] **步骤 1：创建文件**

```ts
import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import type { ServiceResult } from './service-result';
import { ApiError, mapErrCodeToToast } from './error';
import { getToken } from './auth';

/**
 * 全局 axios 实例
 *
 * 设计要点：
 * 1. withCredentials: true —— 即便走 header 模式，也带 cookie 兜底
 *    Sa-Token 默认先读 cookie，读不到再读 header
 * 2. 请求拦截器注入 Authorization header —— 注意不放 'Bearer '（Sa-Token 用 token 原值）
 * 3. 响应拦截器解 ServiceResult 包装，业务代码拿到的是 T 而不是 ServiceResult<T>
 * 4. 响应拦截器对 success: false 调 mapErrCodeToToast 后 throw —— 让业务 catch
 *
 * 后端契约：ServiceResult.success === true 才算请求成功；失败时 errMessage 是后端 i18n 中文
 */

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // '/api'
  withCredentials: true, // 双通道兜底
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：注入 Authorization header
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = token; // 不放 'Bearer '
  }
  return config;
});

// 响应拦截器：解 ServiceResult 包装 + 统一错误处理
http.interceptors.response.use(
  (resp) => {
    const r = resp.data as ServiceResult<unknown>;
    if (!r.success) {
      const err = new ApiError(r.errCode ?? 'UNKNOWN', r.errMessage ?? '请求失败');
      mapErrCodeToToast(err);
      throw err;
    }
    return r.data; // ★ 关键：返回 data，业务拿到的就是 T
  },
  (error) => {
    // 只有真正的网络层错误到这里（后端挂了 / CORS / 超时）
    // 注意：Sa-Token 业务异常不会触发 HTTP 401，被 GlobalExceptionHandler 包装成 ServiceResult.success=false
    toast.error(error.message || '网络错误');
    return Promise.reject(error);
  }
);

export default http;
```

- [ ] **步骤 2：类型检查通过**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：构建通过**

运行：`npm run build`
预期：构建成功，dist/ 生成

- [ ] **步骤 4：Commit（用户手工执行）**

```bash
git add src/api/client.ts
git commit -m "feat(api): add axios instance with ServiceResult unwrap + interceptors"
```

---

## 任务 7：轻量 query hook

**文件：**
- 创建：`src/api/hooks/useServiceQuery.ts`

- [ ] **步骤 1：创建 hooks 目录**

如果 `src/api/hooks/` 不存在，创建：
```bash
mkdir -p src/api/hooks
```

- [ ] **步骤 2：创建文件**

```ts
import { useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../error';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * 过渡用 query hook —— API 形状刻意对齐 TanStack Query 的 useQuery
 *
 * 当前限制（CLAUDE.md TODO 列 TanStack Query 引入时升级）：
 * - 无缓存
 * - 无 refetch
 * - 无 retry
 * - 无 staleTime
 *
 * 未来引入 TanStack Query 时：
 * - 业务组件代码不动（QueryState 形状不变）
 * - 只换 hook 实现
 */
export function useServiceQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = []
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setState({ data: null, loading: true, error: null });

    fetcher()
      .then((data) => {
        if (aliveRef.current) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: ApiError) => {
        if (aliveRef.current) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
```

- [ ] **步骤 3：类型检查通过**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 4：Commit（用户手工执行）**

```bash
git add src/api/hooks/useServiceQuery.ts
git commit -m "feat(api): add useServiceQuery hook (transitional, useQuery-shaped)"
```

---

## 任务 8：OpenAPI 类型生成

**文件：**
- 创建：`src/api/types.ts`
- 生成：`src/api/types.generated.ts`（由 `npm run gen:api` 产出）

- [ ] **步骤 1：创建 types.ts 框架**

```ts
/**
 * 业务类型定义 —— 从 OpenAPI 生成物 re-export + 手写包装
 *
 * 约定：
 * - types.generated.ts 由 npm run gen:api 生成，禁止手改
 * - 接口变更后必须重新跑 gen:api 并 commit 新 generated 文件
 * - 业务 enum / union / ServiceResult 包装在本文件手写
 */

export type { paths, components, operations } from './types.generated';

/**
 * 业务常量 enum 占位 —— 后续接入第一个真实接口时按 knife4j 实际枚举补
 *
 * 例（任务 9 接入 task 模块时展开）：
 * export const TaskStatus = {
 *   PENDING: 'PENDING',
 *   RUNNING: 'RUNNING',
 *   COMPLETED: 'COMPLETED',
 *   FAILED: 'FAILED',
 *   REJECTED: 'REJECTED',
 * } as const;
 * export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];
 */
```

- [ ] **步骤 2：跑 gen:api 生成 types.generated.ts**

前置：后端在 8090 端口跑起来（用户操作）。

运行：`npm run gen:api`
预期：终端输出 "✨ done!"，src/api/types.generated.ts 文件生成（可能几十 KB 至几百 KB）

如果后端未跑：`openapi-typescript` 会报 ECONNREFUSED。**这种情况下**手动创建一个空占位：

```ts
// src/api/types.generated.ts —— 占位，等后端起来后跑 npm run gen:api 覆盖
export type paths = Record<string, never>;
export type components = { schemas: Record<string, never> };
export type operations = Record<string, never>;
```

- [ ] **步骤 3：类型检查通过**

运行：`npm run lint`
预期：无错误。如果用占位文件，`components['schemas']['XXX']` 取值会报类型错误 —— 这是预期的，等真实接口接入时（任务 9）补上

- [ ] **步骤 4：Commit（用户手工执行）**

```bash
git add src/api/types.ts src/api/types.generated.ts
git commit -m "feat(api): add OpenAPI-generated TS types + re-export scaffold"
```

---

## 任务 9：API modules 占位（6 个文件）

**文件：**
- 创建：`src/api/modules/task.ts`
- 创建：`src/api/modules/template.ts`
- 创建：`src/api/modules/asset.ts`
- 创建：`src/api/modules/channel.ts`
- 创建：`src/api/modules/user.ts`
- 创建：`src/api/modules/auth.ts`

- [ ] **步骤 1：创建 modules 目录**

```bash
mkdir -p src/api/modules
```

- [ ] **步骤 2：创建 task.ts**

```ts
/**
 * 任务相关 API —— 当前为空占位
 *
 * 接入第一个真实接口的步骤（详见 docs/api-integration-guide.md §1）：
 * 1. 在 knife4j 找到对应 endpoint（如 GET /v1/admin/tasks）
 * 2. 跑 npm run gen:api 同步 types.generated.ts
 * 3. 在本文件写 export const listTasks = (params: ...) => http.get<TaskDTO[]>('/v1/admin/tasks', { params })
 * 4. 业务组件用 const { data, loading, error } = useServiceQuery(() => listTasks(), [])
 */

import http from '../client';

export const _placeholder = true; // 占位文件，删除前确保至少有一个 export
```

- [ ] **步骤 3：创建 template.ts**

```ts
/** 模板相关 API —— 占位，详见 task.ts 注释 */

import http from '../client';

export const _placeholder = true;
```

- [ ] **步骤 4：创建 asset.ts**

```ts
/** 素材库 API —— 占位，详见 task.ts 注释 */

import http from '../client';

export const _placeholder = true;
```

- [ ] **步骤 5：创建 channel.ts**

```ts
/** 模型渠道 API —— 占位，详见 task.ts 注释 */

import http from '../client';

export const _placeholder = true;
```

- [ ] **步骤 6：创建 user.ts**

```ts
/** 用户管理 API —— 占位，详见 task.ts 注释 */

import http from '../client';

export const _placeholder = true;
```

- [ ] **步骤 7：创建 auth.ts**

```ts
/**
 * 登录 / 登出 API —— 占位
 *
 * 登录页接入时（CLAUDE.md TODO）补：
 * import type { AdminUserInfoResponse } from '../types'; // generated
 * export const login = (req: LoginRequest) => http.post<AdminUserInfoResponse>('/v1/auth/login', req);
 * export const logout = () => http.post<void>('/v1/auth/logout');
 *
 * 调用示例：
 * const resp = await login({ username, password });
 * setToken(resp.token);
 */

import http from '../client';

export const _placeholder = true;
```

- [ ] **步骤 8：类型检查通过**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 9：Commit（用户手工执行）**

```bash
git add src/api/modules/
git commit -m "feat(api): add API module placeholders (6 modules)"
```

---

## 任务 10：main.tsx 挂载 Toaster

**文件：**
- 修改：`src/main.tsx`

- [ ] **步骤 1：读取当前 main.tsx 内容**

```bash
cat src/main.tsx
```

- [ ] **步骤 2：编辑 main.tsx 加入 Toaster**

最终内容：
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={4000}
    />
  </StrictMode>
);
```

注意：
- `Toaster` 必须放在 `<App />` 之外作为 sibling，不能嵌套
- `position="top-center"` 对齐用户"页面中间靠顶部"需求
- `richColors` 让 success/error/warning 用语义色
- `closeButton` 让用户手动关闭
- `duration={4000}` 4 秒自动消失

- [ ] **步骤 3：类型检查通过**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 4：构建通过**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 5：dev server 起来后验证 Toaster 在顶部居中**

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`，打开 DevTools console，运行：
```ts
import('/src/main.tsx'); // hot reload
// 或在控制台直接：
const ev = new MouseEvent('click');
```

更简单的验证方式：临时在 `src/App.tsx` 顶部加一行：
```ts
import { toast } from 'sonner';
toast.error('test top-center');
```
刷新页面，看到顶部居中红色 toast 后，**撤销这行**（不要 commit）。

- [ ] **步骤 6：Commit（用户手工执行）**

```bash
git add src/main.tsx
git commit -m "feat(app): mount Toaster (top-center) in main.tsx"
```

---

## 任务 11：接入指引文档

**文件：**
- 创建：`docs/api-integration-guide.md`

- [ ] **步骤 1：创建文档**

```markdown
# EC-AIGC API 接入指引

> **范围：** 业务组件接入真实后端 API 的流程约定，配套基础设施见 `docs/superpowers/specs/2026-07-06-frontend-api-integration-design.md`
> **目标读者：** 后续接入真实接口的前端开发

---

## §0 前置项

| 项 | 说明 |
|---|---|
| 后端 sa-token 配置 | **不动**（默认双通道：先 cookie 后 header） |
| 后端 dev 端口 | `localhost:8090`（dev profile 覆盖 application.yml 的 8080） |
| Vite proxy | `/api → http://localhost:8090`，dev server 起来后 `npm run gen:api` 必须能联通 |
| OpenAPI 文档地址 | `http://localhost:8090/v3/api-docs`（springdoc-openapi 暴露） |
| Knife4j UI | `http://localhost:8090/swagger-ui.html`（可视化接口调试） |

---

## §1 接入第一个真实接口（5 步流程）

**以 `GET /v1/admin/tasks`（获取任务列表）为例：**

### Step 1：确认接口路径和响应结构

打开 Knife4j，找到对应 endpoint：
- 看 Request URL、Method、Query 参数、Response 200 结构
- **关键：确认 Response 用 ServiceResult 包装**（应该有 `success / errCode / errMessage / data` 四个键）
- 如果后端忘了 wrap，**停下来找后端同事加**；前端拦截器对未 wrap 的响应会 throw

### Step 2：跑 gen:api 同步类型

```bash
npm run gen:api
```

预期：`src/api/types.generated.ts` 更新，**git diff** 应该能看到新增的 DTO 类型。

**约定：** 接口变更后必须重新跑 `gen:api` 并 commit 新 generated 文件 —— 这能 catch 后端字段漂移。

### Step 3：在 src/api/modules/<module>.ts 写 API 函数

编辑 `src/api/modules/task.ts`：
```ts
import http from '../client';
import type { components } from '../types';

type TaskDTO = components['schemas']['TaskDTO'];
type PageQuery = components['schemas']['PageQuery']; // 视后端类型名而定
type PageResultTaskDTO = components['schemas']['PageResultTaskDTO']; // 同上

export const listTasks = (params: PageQuery) =>
  http.get<PageResultTaskDTO>('/v1/admin/tasks', { params });

// 后续按需加：getTask / createTask / updateTask / deleteTask
```

**关键：**
- axios 拦截器自动解 `ServiceResult<T>`，所以返回类型是 `TaskDTO[]` / `PageResultTaskDTO` 而不是 `ServiceResult<TaskDTO[]>`
- 路径要写**完整**，例如 `/v1/admin/tasks`，不要省略 `/api` 前缀（baseURL 自动加）

### Step 4：在业务组件用 useServiceQuery

编辑业务组件（假设是 `src/components/TaskList.tsx`）：
```tsx
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { listTasks } from '../api/modules/task';

export function TaskList() {
  const { data, loading, error } = useServiceQuery(
    () => listTasks({ pageNum: 1, pageSize: 20 }),
    []
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  return <Table rows={data.records} />;
}
```

**注意：**
- 不要在 useEffect 里手写 fetch —— 全部走 `useServiceQuery`，未来切 TanStack Query 时代码不动
- 错误已经在 axios 拦截器层 toast 过了，业务组件**不需要再弹**，但仍可 `if (error) return <ErrorState>` 提供降级 UI

### Step 5：lint + 手工验证

```bash
npm run lint   # tsc --noEmit，catch 类型错误
npm run dev    # 手工点一遍功能
```

---

## §2 错误处理约定

| 后端行为 | 前端处理 |
|---|---|
| `ServiceResult.success === true` | 拦截器返回 `data`，业务拿到的就是 `T` |
| `ServiceResult.success === false` + 业务错误码 | 拦截器 toast + throw `ApiError(errCode, errMessage)` |
| `ServiceResult.success === false` + A0102xx | 拦截器 clearToken + toast + 跳登录页 |
| HTTP 网络错误（CORS / 超时 / 后端挂了） | 拦截器 toast "网络错误" |

**业务组件 catch ApiError 的两种用法：**
```ts
// 1. 仅展示自定义 UI（toast 已经在拦截器弹过）
try {
  await createTask(req);
} catch (err) {
  if (err instanceof ApiError && err.errCode === 'TASK_DUPLICATE') {
    setShowDuplicateDialog(true);
  }
}

// 2. 区分登录异常和其它业务错误
try {
  await createTask(req);
} catch (err) {
  if (err instanceof ApiError && isLoginError(err.errCode)) {
    // 已被拦截器处理（跳登录页），这里只做清理
    cleanup();
  }
}
```

**errMessage 处理原则：**
- 后端 `messageSource.getMessage(errCode, [], zh_CN)` 已 i18n 渲染
- 前端**不翻译 errCode**，直接 `toast.error(err.message)`
- 前端**不维护** errCode → 文案对照表

---

## §3 鉴权约定

### 3.1 token 存储位置

- localStorage key: `'satoken'`（约定俗成，跟后端 cookie 名 `Authorization` 不冲突）
- axios 拦截器自动注入：`config.headers.Authorization = token`（不放 `'Bearer '`）

### 3.2 登录页接入点（CLAUDE.md TODO）

登录页（待做）接入时，登录成功后：
```ts
import { setToken } from '../api/auth';
import { login } from '../api/modules/auth';

const resp = await login({ username, password });
setToken(resp.token);
// 后续 navigate 到 dashboard
```

### 3.3 跳转登录页目标

当前在 `src/api/error.ts` 是占位 `window.location.href = '/login'`。

**登录页接入时改这一行** —— 如果后续引入 React Router，改成 `useNavigate('/login')`：
```ts
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
// ...
LOGIN_ERR_CODES.has(errCode) {
  clearToken();
  toast.error(message);
  navigate('/login', { replace: true });
}
```

### 3.4 多端登录冲突

Sa-Token `token-name: Authorization` 在多 StpKit（ADMIN/H5/DEFAULT）共用同一 cookie 名时**会冲突**。

**当前 dev 阶段不处理**（admin 单一端）。如果将来加 H5 端，后端需要给不同端配不同 `token-name`（如 `Admin-Authorization` / `H5-Authorization`），前端 axios 实例需要分端配置 baseURL。

---

## §4 后端错误码契约

```
成功：ServiceResult.success === true，data 是业务数据
失败：ServiceResult.success === false，errMessage 是 i18n 中文（直接 toast，不翻译）
登录异常：A0102xx 7 个错误码，自动清 token + 跳登录页
  - A010200: token 异常
  - A010201: 没有 token
  - A010202: token 无效
  - A010203: Token 已过期
  - A010204: Token 已被顶下线
  - A010205: Token 已被踢下线
  - A010207: 登录已过期请重新登录
业务警告类：约定 WARN_ 前缀 → warning toast
其它业务错误：默认 error toast
HTTP 层错误：拦截器统一 toast "网络错误"
```

**同步约定：** 后端新增 A0102xx 系列错误码时，前端 `src/api/error.ts` 的 `LOGIN_ERR_CODES` Set 必须同步更新。**每次接入接口前用 knife4j 验证错误码**，Set 变更作为 commit 时 review 项。

---

## §5 未来迁移 TanStack Query

`useServiceQuery` 的 `QueryState<T> { data, loading, error }` 形状刻意对齐 TanStack Query 的 `useQuery`。

迁移步骤：
1. 引入 `@tanstack/react-query`，配 `<QueryClientProvider>`
2. `src/api/hooks/useServiceQuery.ts` 保留作为 fallback，新增 `useApiQuery.ts`：
   ```ts
   import { useQuery } from '@tanstack/react-query';
   export function useApiQuery<T>(key: unknown[], fetcher: () => Promise<T>) {
     return useQuery({ queryKey: key, queryFn: fetcher });
   }
   ```
3. 业务组件批量替换 `useServiceQuery` → `useApiQuery`，把 `loading/error` 改成 `isPending/error`
4. 全部迁移后删除 `useServiceQuery.ts`

**业务代码组件层面只改 hook 引用，props 形状不变。**

---

## §6 已知 TODO（CLAUDE.md 已列）

| TODO | 来源 |
|---|---|
| 登录页 UI | CLAUDE.md |
| React Router 替换 currentScreen state | CLAUDE.md |
| TanStack Query 引入 | CLAUDE.md |
| Vitest + RTL 单测 | CLAUDE.md |
| token 刷新机制（Sa-Token dynamic-active-timeout 已开） | — |
| 请求级 retry / 进度条 / 并发控制 | — |

---

## §7 验证清单

每次新接入接口，跑一遍：

- [ ] knife4j 看响应结构（确认 ServiceResult 包装）
- [ ] `npm run gen:api` 跑通，generated 文件 diff 提交
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] `npm run dev` 手工点一遍功能
- [ ] 主动构造一次失败（如网络断开 / 故意改错密码）看 toast 在顶部居中
- [ ] 登录态失效场景：清 localStorage 后访问受保护接口，看是否跳 `/login`（占位路由，目前会 404）
```

- [ ] **步骤 2：Commit（用户手工执行）**

```bash
git add docs/api-integration-guide.md
git commit -m "docs: add API integration guide for future module wiring"
```

---

## 任务 12：最终验证

- [ ] **步骤 1：完整 lint + build**

```bash
npm run lint
npm run build
```

预期：两个都通过，无错误无 warning。

- [ ] **步骤 2：dev server 起来**

```bash
npm run dev
```

预期：浏览器 `http://localhost:3000` 打开，业务组件正常运行（仍用 mockData），控制台无报错。

- [ ] **步骤 3：手工验证 Toaster 位置**

打开 DevTools console 运行：
```ts
// 通过模块导入或临时在 App.tsx 加一行验证
import { toast } from 'sonner';
toast.error('test top-center');
```

看到顶部居中红色 toast 后，**撤销任何验证代码**。

- [ ] **步骤 4：核对 EC-AIGC/CLAUDE.md 已知 TODO**

打开 `EC-AIGC/CLAUDE.md`，已知 TODO 列表应该新增：
- [x] `src/api/` 基础设施（axios / sonner / OpenAPI / useServiceQuery）已铺

（用户手工编辑，不在 commit 里改 CLAUDE.md）

- [ ] **步骤 5：Commit 验证产物（如有）**

如果步骤 1-4 改了任何文件（不应该有），提交；否则跳过。

---

## 自检

**1. 规格覆盖度：**

| 规格章节 | 对应任务 |
|---|---|
| §2 范围 / §2.1 做什么 | 任务 1-11 全覆盖 |
| §2.2 不做（YAGNI） | 任务全部不涉及 login / router / TanStack Query 替换 |
| §2.3 后端零改动 | 全文无后端命令 |
| §4 文件结构 | 任务 1-11 锁定所有文件 |
| §5 ServiceResult 协议 | 任务 3（类型）+ 任务 6（拦截器解构） |
| §6 axios 实例 + 拦截器 | 任务 6 |
| §7 鉴权 B 模式 | 任务 5 |
| §8 错误处理 + A0102xx | 任务 4 |
| §9 轻量 query hook | 任务 7 |
| §10 OpenAPI 类型生成 | 任务 8 |
| §11 vite proxy 补全 | 任务 2 |
| §12 main.tsx Toaster | 任务 10 |
| §13 依赖变更 | 任务 1 |
| §14 接入指引文档结构 | 任务 11 |
| §15 测试 | 任务 12（lint + build + 手工验证） |
| §16 trade-off | 文档已记录在 spec，plan 不重复 |
| §17 未来演进 | 接入指引 §3/§5 |
| §18 不在本文档范围 | 接入指引 §6 |
| §19 验收清单 | 任务 12 + 接入指引 §7 |

**结论：所有规格章节都有对应任务。**

**2. 占位符扫描：**

- "占位" 出现位置：
  - 任务 4 step 1: `window.location.href = '/login'; // 占位：登录页未做` — 标注真实占位状态，规格 §3 决策 9 明确
  - 任务 8 step 2: types.generated.ts 手动占位 — 后端未跑时的应急方案，规格 §10 明确
  - 任务 9 step 2-7: 模块文件 `_placeholder = true` — 明确标"占位文件"，规格 §4 文件结构明确
  - 接入指引 §3.3: "当前是占位" — 标注真实占位状态，规格 §3 决策 9 明确

**所有占位都是规格明确允许的状态，不是"未实现的细节"。**

**3. 类型一致性：**

- `ApiError` 类：定义于 `error.ts`（任务 4）→ 被 `client.ts`（任务 6）`new ApiError(...)` → 被 `useServiceQuery.ts`（任务 7）catch 标注类型 → 接入指引 §2 演示用法。一致。
- `ServiceResult<T>`：定义于 `service-result.ts`（任务 3）→ `client.ts`（任务 6）`as ServiceResult<unknown>`。一致。
- `LOGIN_ERR_CODES`：定义于 `error.ts`（任务 4）→ `isLoginError` 导出 → `mapErrCodeToToast` 内部使用 → 接入指引 §2 演示用法。一致。
- `clearToken`：`auth.ts`（任务 5）定义 → `error.ts`（任务 4）import 使用。一致（任务顺序保证）。
- `getToken`：`auth.ts`（任务 5）定义 → `client.ts`（任务 6）import 使用。一致。
- `useServiceQuery`/`QueryState`：定义于 `useServiceQuery.ts`（任务 7）→ 接入指引 §1 step 4 使用。一致。
- `http.get<T>` / `http.post<T>`：`client.ts`（任务 6）默认导出 → 所有 module 文件 import 使用。一致。

**无类型 / 方法名不一致。**

---

## 执行方式

**计划已完成并保存到 `EC-AIGC/docs/superpowers/plans/2026-07-06-frontend-api-integration.md`（~600 行 / 12 任务）。**

**两种执行方式：**

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** — 在当前会话中使用 executing-plans 逐任务执行，批量执行并设有检查点

**选哪种方式？**

如果你倾向"我自己边看边做"（考虑到 EC-AIGC 没单测、IDE 调试体验重要），可以走 **方式 2 + 你手工 commit**；如果想快速跑完，可以走方式 1 让 agent 并行做掉。

> 注：根 CLAUDE.md "禁止直接执行 git 命令" + AGENTS.md "提交走用户" → 本计划里所有 commit 命令由用户手工执行。
