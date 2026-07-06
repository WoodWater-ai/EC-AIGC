# AGENTS.md — EC-AIGC

达芬奇密码 AI 素材工作台 — 前端 SPA 的 AI 协作入口。

## 状态

**全 mock 阶段**。`src/App.tsx` 用 `useState` + `src/mockData.ts` 维护所有数据,尚未接入后端 API。开发目标是逐步把 mock 替换为 `../dafenqi-ai/` 后端真实接口。

## 业务模块

| 模块 | 组件 | 当前状态 | 后端对接点 |
|---|---|---|---|
| 仪表盘 | `Dashboard.tsx` | mock | `GET /v1/dashboard/summary` (TBD) |
| 任务列表 | `TaskList.tsx` + `TaskDetailsDrawer.tsx` | mock | `GET/POST /v1/tasks` (TBD) |
| 创建图片任务 | `CreateImageTask.tsx` | mock | `POST /v1/tasks/image` (TBD) |
| 创建视频任务 | `CreateVideoTask.tsx` | mock | `POST /v1/tasks/video` (TBD) |
| 模板中心 | `TemplateCenter.tsx` | mock | `GET/POST /v1/templates` (TBD) |
| 素材库 | `ProductAssetLibrary.tsx` | mock | `GET /v1/assets` (TBD) |
| 数据分析 | `DataAnalytics.tsx` | mock | `GET /v1/analytics/...` (TBD) |
| 系统配置 | `SystemConfig.tsx` | mock | `GET /v1/admin/...` (TBD) |
| 素材中转 | `AssetTransitModal.tsx` | mock | 全局 Modal |

(后端接口路径待与 `dafenqi-ai/` 团队对齐,以 `dafenqi-ai/docs/单体项目开发规范.md` 为准)

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
