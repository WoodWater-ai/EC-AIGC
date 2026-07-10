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

---

## 智能模板中心 · 模板模块对接

### 端点

| 操作 | 端点 | 备注 |
|------|------|------|
| 分页查询 | `POST /v1/admin/prompt-template/page` | `templateKind` 必填(5 类之一) |
| 详情 | `POST /v1/admin/prompt-template/detail` | 单条 |
| 创建 | `POST /v1/admin/prompt-template/add` | 返回新模板 ID(string) |
| 更新 | `POST /v1/admin/prompt-template/update` | 完整字段覆盖 |
| 删除(软) | `POST /v1/admin/prompt-template/delete` | |
| 批量停用 | `POST /v1/admin/prompt-template/batch-update-status` | 单次请求,免循环 |
| 版本创建 | `POST /v1/admin/prompt-template/version/create` | |
| 版本列表 | `POST /v1/admin/prompt-template/version/list` | |

### 鉴权

admin 域 Sa-Token。token 走 `Authorization: <token>` header(无 `Bearer ` 前缀)。

### DTO 镜像

详见 `src/api/modules/template.ts`,所有字段严格对齐后端 `PromptTemplateResponse`。Long 字段前端用 `string` 接收(后端 `@JsonSerialize(ToStringSerializer)` 防 JS 精度丢失)。

### 5 类差异化

`templateKind` 5 类:`IMAGE_TASK` / `STYLE_SCENE` / `VIDEO_PROMPT` / `PLATFORM_SPEC` / `NEGATIVE_CONSTRAINT`。每类对应一组差异字段,详见 `TemplateDTO` interface。

### 数据流

```
TemplateCenter.tsx
  └─ useServiceQuery(() => templateApi.page({ templateKind: activeTab }))
       └─ http.post('/v1/admin/prompt-template/page', q)
            └─ Vite proxy /api → :8090
                 └─ AdminPromptTemplateController
```

### 状态映射

后端 `status` 是 `NORMAL` / `DISABLED`,前端直接使用这两个值(无映射层,以后端为权威源)。
