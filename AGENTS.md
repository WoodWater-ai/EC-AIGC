# AGENTS.md — EC-AIGC

达芬奇密码 AI 素材工作台 — 前端 SPA 的 AI 协作入口。

## 状态

**真实接口接入阶段**。核心业务已通过 `src/api/client.ts` 和 `src/api/modules/` 对接 `../dafenqi-ai/` 后端；`src/mockData.ts` 仅保留给尚未接入的展示数据或视觉开发，不能作为已接入页面的业务数据源。

前端请求统一走 `http` 封装：浏览器请求 `/api/v1/...`，Vite 开发代理去除 `/api` 后转发到后端。组件不得直接创建 axios 实例或硬编码后端地址。

接口契约以以下顺序为准：后端 Controller / DTO 与 OpenAPI -> `src/api/modules/` 类型和方法 -> 组件。接口字段、枚举、权限或状态变化时，必须先更新 API 模块和类型，再修改界面；所有 Long ID、时间戳在前端按 `string` 处理。

## 业务模块

| 模块 | 组件 | 当前状态 | 后端对接点 |
|---|---|---|---|
| 仪表盘 | `Dashboard.tsx` | 混合 | 创作作品/模板：`/v1/creation-template/*`；其余看各子模块 |
| 任务列表 | `TaskList.tsx` + `TaskDetailsDrawer.tsx` | 已接入 | `/v1/task/my-page`、`/v1/task/group-*`、`/v1/task/detail` |
| 创建图片任务 | `components/CreateImageTask/` + `useCreateImageTaskState.ts` | 已接入 | `/v1/task/submit`、`/v1/task/generated-images*`、`/v1/task/image-revision/*` |
| 创建视频任务 | `CreateVideoTask.tsx` | 已接入 | `/v1/video-task/submit` |
| 模板中心 | `TemplateCenter.tsx` | 已接入，但存在两套模板模型 | 管理模板：`/v1/admin/prompt-template/*`；创作模板：`/v1/creation-template/*` |
| 商品素材库 | `ProductAssetLibrary.tsx` | 已接入 | `/v1/admin/product-library/*` |
| 数据分析 | `DataAnalytics.tsx` | 混合 | 以对应 `src/api/modules/` 为准 |
| 系统配置 | `SystemConfig.tsx` | 已接入 | `/v1/admin/*` |
| 素材中转 | `AssetTransitModal.tsx` | 已接入 | 资源、分类、文件等 API 模块 |

后端接口路径以 `dafenqi-ai` 的 Controller、DTO 和 OpenAPI 为准；`docs/单体项目开发规范.md` 规定接口风格，但不替代具体实现。

## 协作入口

- **本目录约定**:见 `CLAUDE.md`(技术栈、目录结构、Tailwind 主题、API 对接)
- **工作区级约定**:见 `../AGENTS.md`(协作原则、子项目路由、commit 规范)
- **产品需求**:见 `../PRD-V2-html-share/达芬奇密码AI素材工作台-内部产品化一阶段完整PRD-V2.html`
- **后端 API**:见 `../dafenqi-ai/CLAUDE.md` 和 `../dafenqi-ai/docs/单体项目开发规范.md`

## 何时直接改 vs 何时路由

**本目录直接改**(无需确认):
- 单个组件内部样式、布局、文案
- 单个组件内部状态管理逻辑
- mock 数据结构调整(`src/mockData.ts`、`src/types.ts`)
- 新增 `src/components/<Name>.tsx`

**先确认再改**:
- 新增 npm 依赖(写入 `package.json` 的 `dependencies` / `devDependencies`)
- 改 `vite.config.ts`(proxy / alias / plugin)
- 改 `tsconfig.json`(模块解析、严格选项)
- 改 `src/index.css` 的 `@theme {}`(影响全站视觉)
- 替换路由方案(从 `currentScreen` state 切到 React Router)
- 引入状态管理库(Context / Zustand / Jotai / TanStack Query)

**严禁**:
- 改后端代码(`../dafenqi-ai/`)—— 后端改动走 `dafenqi-ai/` 子流程
- 把 GEMINI_API_KEY / 任何密钥写进 `.env.example` 或提交进 git
- 把 `http://localhost:8090` 之类的硬编码 URL 写进组件代码,统一走 `import.meta.env.VITE_*`
- 自动 commit —— 改完代码后让用户手工 commit

## 状态管理策略

**当前**:`App.tsx` 顶层 `useState` + props drilling。组件树不深,够用。

**后续演进**(引入时再讨论,不要现在做):
- 跨页面共享状态(currentUser / notifications) → Context 或 Zustand
- 服务端状态(任务列表 / 素材库) → TanStack Query
- 表单状态 → React Hook Form(目前用原生 `useState` 也行,数量不大)

## 测试

- **当前不强制** —— 项目刚起步,以 `npm run lint` + 手工验证为主
- 后续:Vitest(组件单测)+ Playwright(E2E 关键流程),引入节奏看团队
- 不要现在写测试,先把 mock → real API 跑通

## TypeScript 纪律

- **不要 `any`**。后端 DTO 必须定义明确类型(放在 `src/types.ts` 或单独的 `src/api/types.ts`)
- 组件 props 必须有 interface 定义
- 业务枚举统一放在 `src/types.ts` 的 const enum / 普通 enum 对象里(参考 `AppScreen`)
- `tsconfig.json` 是 bundler 模式,不要改回 classic / node

## 能力参数 schemaParams 透传约定(2026-07-25 P0 修复后)

**核心原则**:右栏 `ParamSchemaForm` 收集的 `schemaParams` 必须**原样**作为 `taskParamsJson` 提交,**前端不做字段名映射、不做单位转换、不做供应商适配**。

链路:
```
ParamSchemaForm(useTaskParams.schemaParams)
  → ImageSettingsSection.onParamsChange 冒泡(必须有 schemaParams 字段)
  → CreateImageTask.paramsSnapshot.schemaParams
  → useCreateImageTaskState.opts.schemaParams
  → submitTasks: taskParamsJson: JSON.stringify(opts.schemaParams ?? {})
  → 后端 ChannelParamBinder.bindToBody 按 ViduCapabilities schema 字段名映射
```

**反例(P0 bug 现场,2026-07-25 修复)**:之前前端把 `schemaParams.aspect_ratio` 重命名成 `ratio`、`schemaParams.resolution` 走 `mapResolutionToVidu('2048px' → '4k')` 转换后再提交,导致后端 `ChannelParamBinder` 按 schema 字段遍历拿不到任何 key,链路断裂;同时 `task.aspectRatio` 由 `pm.get("ratio")` 写入,Vidu 收到的始终是 16:9。

**禁止**:
- 在前端给 schema 字段做 key 重命名(后端 `FieldDef.targetField` 已经管映射)
- 在前端做单位/格式转换(Vidu schema 的 `OptionItem.value` 已经是 Vidu API 接受的值)
- 在 hook 内部维护 ratio/resolution 等"前端 state"——单一权威是 schemaParams
- 写死 `'16:9'` / `'1080p'` / `'2048px'` 等默认值到 `taskParamsJson`——让 `useTaskParams` 的 schema defaults 接管

参考:`dafenqi-ai/AGENTS.md` 的"能力 schema 单一权威"段(后端侧约定)
