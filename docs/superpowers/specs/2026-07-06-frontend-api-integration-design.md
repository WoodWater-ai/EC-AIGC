# 达芬奇密码 AI 素材工作台 — 前端 API 基础设施接入方案

> **范围**:为 EC-AIGC 前端 SPA 铺设"对接真实后端 API"的基础设施层,业务组件继续使用 mock
> **设计日期**:2026-07-06
> **后端契约依据**:`dafenqi-ai/src/main/java/com/dafenqi/ai/common/result/ServiceResult.java` + `GlobalExceptionHandler.java` + `EnumServiceException.java`
> **状态**:待 review

---

## 1. 背景

EC-AIGC 当前是**全 mock 阶段**(`App.tsx` 用 `useState` + `src/mockData.ts`),CLAUDE.md 已列出接入真实后端为待办。本文档定义"接入第一个真实接口"所需的所有前端底座,后续业务模块接入按模板抄即可。

**后端 `ServiceResult<T>` 实际 JSON 形态**(已读 `ServiceResult.java` + `BaseResult.java`):

```json
{
  "success": true,
  "errCode": null,
  "errMessage": null,
  "data": <T>,
  "timestamp": 1234567890,
  "costTime": 12
}
```

- `@JsonInclude(ALWAYS)`:`null` 字段也会输出键,前端 type 必须把全部字段标可选
- `timestamp` 后端默认 `System.currentTimeMillis()`,`costTime` 由业务方选填
- 业务异常(`NotLoginException` / `ServiceException` / `BindException` 等)被 `GlobalExceptionHandler` 统一包装成 **HTTP 200 + `ServiceResult{ success: false, errCode, errMessage }`**(`errMessage` 由 `messageSource.getMessage(errCode, [], zh_CN)` i18n 渲染,**前端直接显示,不翻译 errCode**)

**后端鉴权契约**:
- sa-token 1.45,`token-name: Authorization`(cookie 名 = header 名)
- `StpUtil.login()` 自动 Set-Cookie + 返回 tokenValue(给到登录响应 body)
- 默认双通道:后端**先读 cookie,读不到再读 header** —— 前端只管把 token 塞 `Authorization` header,cookie 通道自动兜底

---

## 2. 范围

### 2.1 做什么

- 铺设 `src/api/` 目录(client / error / auth / service-result / types / modules / hooks)
- axios 实例 + 请求/响应拦截器(解 ServiceResult 包装,统一错误处理)
- 鉴权工具函数(token 存取)
- A0102xx 登录异常识别 + 跳转登录页
- 轻量 `useServiceQuery` hook(API 形状对齐 TanStack Query,过渡用)
- OpenAPI 自动生成 TypeScript 类型(基础)
- 顶部居中错误 toast(sonner)
- 接入指引文档(`docs/api-integration-guide.md`)
- vite proxy 补全(`/api → http://localhost:8090`)

### 2.2 不做什么(YAGNI)

| 不做项 | 原因 | 来源 |
|---|---|---|
| 登录页 UI | 超出"基础设施"范围 | CLAUDE.md TODO |
| React Router 替换 `currentScreen` state | 超出"基础设施"范围 | CLAUDE.md TODO |
| TanStack Query 引入 | `useServiceQuery` 已对齐 `useQuery` 形状,迁移动作可控;AGENTS.md "先确认再改" | AGENTS.md |
| Vitest + RTL 单测 | AGENTS.md "当前不强制" | AGENTS.md |
| token 刷新机制 | Sa-Token `dynamic-active-timeout: true` 已开启,后端自动续期 | dev yml |
| 请求级 retry / 进度条 / 并发控制 | demo 阶段不需要 | — |

### 2.3 后端零改动

本次方案**不修改 `dafenqi-ai/` 任何代码或配置**。Sa-Token 默认双通道,前端 header 注入即可工作。

---

## 3. 关键决策汇总

| # | 决策 | 备选 | 选定理由 |
|---|---|---|---|
| 1 | HTTP 客户端 = **axios 1.7+** | 原生 fetch + wrapper / ky | "需要完整接完后端所有接口",工业标准 + 拦截器原生支持 |
| 2 | TS 类型来源 = **OpenAPI 生成 + 手写包装** | 纯手抄 / 纯生成 | 后端 springdoc 已开,生成免去手抄;手写包装处理 union/enum/ServiceResult |
| 3 | 鉴权模式 = **Header-only + withCredentials 兜底** | Cookie-only / 双通道 | "有些浏览器禁用 cookie" 场景需要 header;cookie 作为兜底让 Sa-Token 默认先读 cookie |
| 4 | 错误提示位置 = **顶部居中**(`<Toaster position="top-center" />`) | 右下角 / 屏幕中央 | 用户明确指定 |
| 5 | toast 库 = **sonner**(~5KB, zero deps) | 自写 / react-hot-toast | `position` 内置、API 极简、主题 CSS variables 跟 Tailwind 4 对齐 |
| 6 | 状态管理 = **useState + useServiceQuery 过渡** | 上 TanStack Query | AGENTS.md 明确"先不要引入" |
| 7 | ServiceResult 解构位置 = **响应拦截器** | 业务层各自解 | 业务代码 `http.get<T>()` 拿到 `T` 而非 `ServiceResult<T>`,体感最佳 |
| 8 | 登录异常识别 = **Set 精确匹配 A0102xx** | 前缀匹配 | 避免误伤 A0103xx / A020xxx 等业务码 |
| 9 | 跳转登录页 = **`window.location.href = '/login'` 占位** | useNavigate | 登录页未做,无 SPA 路由可跳;登录页接入时改一行即可 |
| 10 | errMessage 处理 = **直接 toast,不翻译** | 前端维护 errCode→文案对照表 | 后端 messageSource 已 i18n,前端再做会双语言错位 |

---

## 4. 文件结构

```
EC-AIGC/
├── vite.config.ts                         [改] 补 /api proxy
├── package.json                           [改] +axios +sonner +openapi-typescript +2 scripts
├── .env.example                           [改] 核对 VITE_API_TARGET=http://localhost:8090
├── tsconfig.json                          [不改] bundler mode 已支持
└── src/
    ├── main.tsx                           [改] 挂 <Toaster position="top-center" />
    ├── App.tsx                            [不改] 继续 mock
    ├── components/                        [不改] 继续 mock
    ├── types.ts                           [不改] 既有业务类型
    ├── mockData.ts                        [不改] 既有 mock
    ├── api/                               [新建]
    │   ├── client.ts                      axios 实例 + 拦截器
    │   ├── error.ts                       ApiError 类 + A0102xx 映射
    │   ├── auth.ts                        token 存取(localStorage)
    │   ├── service-result.ts              ServiceResult<T> 类型
    │   ├── types.generated.ts             OpenAPI 生成产物(进 commit,不手改)
    │   ├── types.ts                       业务 enum + re-export
    │   ├── modules/
    │   │   ├── task.ts                    任务相关 API 调用
    │   │   ├── template.ts                模板相关
    │   │   ├── asset.ts                   素材库
    │   │   ├── channel.ts                 模型渠道
    │   │   ├── user.ts                    用户管理
    │   │   └── auth.ts                    登录 / 登出
    │   └── hooks/
    │       └── useServiceQuery.ts         轻量 query hook(对齐 useQuery 形状)
└── docs/
    └── api-integration-guide.md           [新建] 接入指引(单独文档)
```

---

## 5. ServiceResult 协议

### 5.1 TypeScript 类型 — `src/api/service-result.ts`

```ts
/**
 * 对应后端 com.dafenqi.ai.common.result.ServiceResult<T>
 * 注意:后端 @JsonInclude(ALWAYS),null 字段也会输出键,因此全部字段标可选
 */
export interface ServiceResult<T> {
  success: boolean;
  errCode?: string;
  errMessage?: string;
  data?: T;
  timestamp?: number;
  costTime?: number;
}
```

### 5.2 解构策略

**关键决策**:解构发生在 axios 响应拦截器,不在业务层。业务代码 `http.get<Task[]>('/v1/admin/tasks')` 拿到的是 `Task[]`,不是 `ServiceResult<Task[]>`。

```ts
// 拦截器
http.interceptors.response.use(
  (resp) => {
    const r = resp.data as ServiceResult<unknown>;
    if (!r.success) {
      const err = new ApiError(r.errCode ?? 'UNKNOWN', r.errMessage ?? '请求失败');
      mapErrCodeToToast(err);
      throw err;
    }
    return r.data;   // ★ 关键:返回 data,业务拿到 T
  },
  (error) => { /* ... */ }
);
```

**约定**:任何接入的接口**必须**用 `ServiceResult<T>` 包装返回。如果某个 endpoint 后端忘了 wrap,`data.success === undefined`,会被判 `!r.success` 然后 throw。**接入指引 §1 第 3 步要求每个新接口先在 knife4j 看响应结构**。

---

## 6. axios 实例 — `src/api/client.ts`

```ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { toast } from 'sonner';
import type { ServiceResult } from './service-result';
import { ApiError, mapErrCodeToToast } from './error';
import { getToken } from './auth';

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,  // '/api'
  withCredentials: true,                         // 双通道兜底:Sa-Token 默认先 cookie 后 header
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器:注入 Authorization header(B 模式)
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = token;  // 注意:不放 'Bearer ',Sa-Token 用 token 原值
  }
  return config;
});

// 响应拦截器:解 ServiceResult 包装 + 统一错误处理
http.interceptors.response.use(
  (resp) => {
    const r = resp.data as ServiceResult<unknown>;
    if (!r.success) {
      const err = new ApiError(r.errCode ?? 'UNKNOWN', r.errMessage ?? '请求失败');
      mapErrCodeToToast(err);   // 业务错误:toast + 特殊码跳转
      throw err;                // 让业务 catch
    }
    return r.data;
  },
  (error) => {
    // 只有真正的网络层错误才会到这里(后端挂了 / CORS / 超时)
    // 注意:Sa-Token 业务异常不会触发 HTTP 401,被 GlobalExceptionHandler 包装成 ServiceResult.success=false
    toast.error(error.message || '网络错误');
    return Promise.reject(error);
  }
);

export default http;
```

**3 个关键点**:
1. **`Authorization: <token>` 不放 `'Bearer '`** —— Sa-Token 直接读 token 值
2. **`withCredentials: true`** —— 即便走 header 模式,也带 cookie 兜底(Sa-Token 默认先 cookie 后 header)
3. **响应拦截器返回 `r.data`** —— 业务代码拿到的就是 `T`,体感最佳

---

## 7. 鉴权(B 模式 — Header-only) — `src/api/auth.ts`

```ts
const TOKEN_KEY = 'satoken';  // 与后端 sa-token.token-name 一致

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);
```

**使用约定**:
- **本次不实现登录页**,只提供工具函数
- 登录页接入时:`const resp = await authLogin(...); setToken(resp.token)` —— 一行调用,axios 拦截器后续自动注入 header
- 登出:`clearToken() + await http.post('/v1/auth/logout')`
- A0102xx 触发时 `error.ts` 自动调 `clearToken()`,**业务层不需要手动调**

---

## 8. 错误处理 — `src/api/error.ts`

```ts
import { toast } from 'sonner';
import { clearToken } from './auth';

export class ApiError extends Error {
  constructor(public errCode: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 登录异常错误码 —— 后端 EnumServiceException.A0102xx 序列(7 个)
 * 来源:
 *   - dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/EnumServiceException.java:53-88
 *   - dafenqi-ai/src/main/java/com/dafenqi/ai/exception/GlobalExceptionHandler.java:181-194
 *
 * 触发行为:toast(errMessage) + clearToken() + window.location.href = '/login'
 *
 * 同步约定:后端新增 A0102xx 系列错误码时,前端 Set 必须同步更新。
 * A010206 = USER_PERMISSION_LACK_ERROR(用户权限不足),不属于登录异常,不在此 Set。
 */
const LOGIN_ERR_CODES: ReadonlySet<string> = new Set([
  'A010200',  // token 异常
  'A010201',  // 没有 token
  'A010202',  // token 无效
  'A010203',  // Token 已过期
  'A010204',  // Token 已被顶下线(账号在其他设备登录)
  'A010205',  // Token 已被踢下线
  'A010207',  // 登录已过期请重新登录
]);

export function isLoginError(errCode: string): boolean {
  return LOGIN_ERR_CODES.has(errCode);
}

/**
 * 错误码 → toast + 特殊处理
 *
 * 设计原则:
 * - errMessage 由后端 messageSource.getMessage(errCode, [], zh_CN) 渲染
 * - 前端直接 toast(errMessage),不翻译 errCode
 * - 登录异常(Set 命中)优先级最高:清 token + toast + 跳登录页
 * - 业务警告(约定 WARN_ 前缀):warning toast
 * - 其它业务错误:error toast
 */
export function mapErrCodeToToast(err: ApiError): void {
  const { errCode, message } = err;

  // 1. 登录异常
  if (LOGIN_ERR_CODES.has(errCode)) {
    clearToken();
    toast.error(message || '登录已过期,请重新登录');
    window.location.href = '/login';  // 占位:登录页未做
    return;
  }

  // 2. 业务警告类(可选约定)
  if (errCode.startsWith('WARN_')) {
    toast.warning(message);
    return;
  }

  // 3. 其它业务错误
  toast.error(message);
}
```

**关键决策**:
- **Set 精确匹配** 7 个错误码,不是前缀(避免误伤 A0103xx / A020xxx 等业务码)
- **`window.location.href = '/login'`** 是占位,登录页接入时改这一行
- **`errMessage` 后端 i18n**,前端**不翻译 errCode**
- **登录异常优先级最高** —— 哪怕 messageSource 渲染出空 message,Set 命中就跳登录页

---

## 9. 轻量 query hook — `src/api/hooks/useServiceQuery.ts`

```ts
import { useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../error';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * 过渡用 query hook —— API 形状刻意对齐 TanStack Query 的 useQuery({ data, loading, error })
 * 未来引入 TanStack Query 时,业务组件代码不动,只换 hook 实现。
 *
 * 注意:当前实现无缓存、无 refetch、无 retry、无 staleTime。CLAUDE.md TODO 列 TanStack Query 引入时再升级。
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

**约定**:不引入 TanStack Query(`AGENTS.md` "先确认再改")。此 hook 的 `QueryState<T>` 形状对齐 `useQuery` 返回值,迁移成本最低。

---

## 10. OpenAPI 类型生成

### 10.1 新增 npm script

`package.json`:
```json
{
  "scripts": {
    "gen:api": "openapi-typescript http://localhost:8090/v3/api-docs -o src/api/types.generated.ts",
    "gen:api:prod": "openapi-typescript ${VITE_API_DOCS_URL:-http://localhost:8090/v3/api-docs} -o src/api/types.generated.ts"
  }
}
```

### 10.2 新增 devDependency

- `openapi-typescript@^7.x`(~150KB,仅生成脚本运行时用)

### 10.3 生成产物使用约定

- `src/api/types.generated.ts` 进 commit,但**禁止手改**(每次跑 `gen:api` 会被覆盖)
- 业务 enum / union / ServiceResult 包装在 `src/api/types.ts` 手写,从 `types.generated.ts` re-export
- 接口变更后必须**重新跑 `gen:api` 并 commit 新 generated 文件**

### 10.4 接入指引约定

业务 DTO 类型从 `types.generated.ts` 取:
```ts
// src/api/types.ts
export type { paths, components } from './types.generated';
export type Task = components['schemas']['TaskDTO'];
// ...
```

---

## 11. Vite proxy 补全 — `vite.config.ts`

CLAUDE.md 写"Vite dev proxy 已配",实际未配。顺手补:

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

`.env.example`(核对):
```env
VITE_API_BASE_URL=/api
VITE_API_TARGET=http://localhost:8090
```

---

## 12. main.tsx — 挂载 Toaster

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

---

## 13. 依赖变更

### 13.1 `dependencies`

| 包 | 版本 | 用途 |
|---|---|---|
| `axios` | `^1.7.x` | HTTP 客户端(请求/响应拦截器原生支持) |
| `sonner` | `^1.7.x` | 顶部居中 toast 库(~5KB, zero deps) |

### 13.2 `devDependencies`

| 包 | 版本 | 用途 |
|---|---|---|
| `openapi-typescript` | `^7.x` | OpenAPI → TS 类型生成脚本 |

### 13.3 scripts

| 名称 | 命令 | 用途 |
|---|---|---|
| `gen:api` | `openapi-typescript http://localhost:8090/v3/api-docs -o src/api/types.generated.ts` | dev 环境生成类型 |
| `gen:api:prod` | `openapi-typescript ${VITE_API_DOCS_URL:-http://localhost:8090/v3/api-docs} -o src/api/types.generated.ts` | 生产/staging 环境(支持 env override) |

---

## 14. 接入指引文档结构 — `docs/api-integration-guide.md`(配套文档)

| 章节 | 内容 |
|---|---|
| §0 前置项 | 后端 sa-token 现状(双通道)、OpenAPI 生成命令、known issues |
| §1 接入第一个接口的 5 步流程 | 以 `GET /v1/admin/tasks` 为例:① 跑 `gen:api` ② 在 `src/api/modules/task.ts` 写 `export const listTasks = () => http.get<Task[]>('/v1/admin/tasks')` ③ 组件用 `useServiceQuery` ④ 在 knife4j 验证响应 ⑤ `tsc --noEmit` 通过 |
| §2 错误处理约定 | `ServiceResult.success=false` 时已 toast + throw,业务 catch 决定是否额外 UI;A0102xx 自动跳登录页 |
| §3 鉴权约定 | `getToken/setToken/clearToken` 用法、登录页接入点(`setToken(resp.token)`) |
| §4 后端错误码契约 | 成功判断规则、`errMessage` 后端 i18n 不翻译、登录异常 Set |
| §5 未来迁移 TanStack Query | `useServiceQuery` → `useQuery`,业务代码不动 |
| §6 已知 TODO | CLAUDE.md 已列(login / router / vitest) |

---

## 15. 测试

- **不写单测**(AGENTS.md "当前不强制,以 `npm run lint` + 手工验证为主")
- `npm run lint`(=`tsc --noEmit`)必须过 —— 已有
- 类型生成检查:`tsc --noEmit` 能 catch 后端字段类型漂移
- 手工验证清单(交付时):
  - [ ] `npm run dev` 起来,sonner 在顶部居中显示
  - [ ] `npm run gen:api` 能生成 `src/api/types.generated.ts`
  - [ ] `npm run build` 通过
  - [ ] mockData 不变,业务组件正常运行

---

## 16. Trade-off 汇总(不藏)

| # | 选择 | 代价 | 缓解 |
|---|---|---|---|
| 1 | 响应拦截器解 `data` 是约定 | 某个 endpoint 后端忘了 wrap 成 ServiceResult,会 throw | 接入指引 §1 第 3 步要求 knife4j 验证 |
| 2 | `useServiceQuery` 简易版无缓存/refetch/retry | 频繁切换数据需手动重渲 | 引入时升级为 TanStack Query(API 形状已对齐) |
| 3 | OpenAPI 生成不强制编译失败 | 后端字段漂移可能漏检 | 流程约定:接口变更必跑 `gen:api` + commit |
| 4 | `window.location.href = '/login'` 全页面跳转 | 体验不如 SPA 路由跳转 | 登录页接入时改这一行 |
| 5 | A0102xx Set 是静态硬编码 | 后端新增 A0102xx 必须前端同步 | 接入指引 §4 要求每次接口变更 review 此 Set |
| 6 | 业务组件本次继续 mock | 没有真实端到端验证 | 这是范围的代价,不是疏漏;mock → real 的 demo 走"接入第一个真实接口" task |
| 7 | axios 选型偏离零依赖路径 | +1 npm 依赖(~14KB gzipped) | 工程权衡:工业标准 + 拦截器原生支持;用户最终决策 |
| 8 | sonner 选型偏离零依赖路径 | +1 npm 依赖(~5KB) | 工程权衡:用户提出"顶部居中" UX 需求,sonner 该能力内置;本项由我代用户选型 |
| 9 | 业务组件不验证 token 存在 | 进入页面时如果 token 失效,第一次请求才跳登录 | 不影响功能,只影响"无感知跳登录"的体验;登录页接入时补前置检查 |

---

## 17. 未来演进路径

1. **登录页接入**:新增 `src/components/Login.tsx` + `src/api/modules/auth.ts`,登录响应 `setToken(resp.token)`;`error.ts` 里 `window.location.href` 改成 `useNavigate('/login')`
2. **React Router 替换 `currentScreen` state**:`main.tsx` 加 `<BrowserRouter>`,`App.tsx` 把 state 换成 `<Routes>`;`error.ts` 跳登录页改成 SPA 路由
3. **TanStack Query 引入**:`useServiceQuery.ts` 文件保留作为 fallback,新增 `useQuery.ts` 真版本;业务组件切到 `useQuery`,迁完删 fallback
4. **登录异常 Set 自动化**:`gen:api` 后跑一个后处理脚本,从 `EnumServiceException.java` 解析登录异常码生成 Set(避免手动同步)

---

## 18. 不在本文档范围

- **第一个真实接口接入**:由后续 task 负责(以 `GET /v1/admin/tasks` 为例)
- **登录页 UI**:CLAUDE.md TODO
- **后端 sa-token 配置变更**:本次**不动**(Sa-Token 默认双通道已够用)
- **vite proxy /api 之外的反代配置**(生产 Nginx):部署文档范围
- **OpenAPI 类型生成的 CI 接入**(GitHub Actions 跑 `gen:api` 校验漂移):后续优化项

---

## 19. 验收清单

- [ ] `package.json` 增加 axios / sonner / openapi-typescript 依赖
- [ ] `package.json` 增加 `gen:api` / `gen:api:prod` scripts
- [ ] `vite.config.ts` 补 `/api` proxy
- [ ] `.env.example` 核对 `VITE_API_BASE_URL=/api` + `VITE_API_TARGET=http://localhost:8090`
- [ ] `src/main.tsx` 挂 `<Toaster position="top-center" />`
- [ ] `src/api/client.ts` 创建 + 配置
- [ ] `src/api/error.ts` 创建 + A0102xx Set
- [ ] `src/api/auth.ts` 创建 + token 工具
- [ ] `src/api/service-result.ts` 创建 + 类型定义
- [ ] `src/api/hooks/useServiceQuery.ts` 创建 + 实现
- [ ] `src/api/modules/*.ts` 创建占位(6 个模块文件)
- [ ] `src/api/types.generated.ts` 由 `gen:api` 生成(空 run 也行,验证脚本可跑)
- [ ] `src/api/types.ts` 创建 + re-export 框架
- [ ] `docs/api-integration-guide.md` 创建
- [ ] `npm run lint`(tsc --noEmit)通过
- [ ] `npm run build` 通过
- [ ] `npm run dev` 起来,业务组件用 mock 正常运行,sonner 在顶部居中(可在控制台手动 `toast.error('test')` 验证)
