# CLAUDE.md — EC-AIGC

达芬奇密码 AI 素材工作台 — 前端 SPA。React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4。

## 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 框架 | React | 19.0.1 |
| 构建 | Vite | 6.2.3 |
| 语言 | TypeScript | 5.8.2 |
| 样式 | Tailwind CSS(用 CSS-first `@theme` 配置) | 4.1.14 |
| 图标 | lucide-react + Material Symbols(网页字体) | 0.546 / latest |
| 动效 | motion(原 framer-motion) | 12.x |
| AI | @google/genai(Gemini SDK,目前仅前端 demo 用) | 2.4.0 |

## 目录约定

```
EC-AIGC/
├── index.html                       # Vite 入口 HTML
├── package.json                     # name: dafenqi-ai-web
├── vite.config.ts                   # React + Tailwind plugin,Vite proxy /api → :8090
├── tsconfig.json                    # bundler module resolution, paths "@/*" → "./*"
├── .env.example                     # 环境变量模板(不进 commit 的是 .env.local)
├── assets/                          # 静态资源(含 AI Studio 标记,后续清理)
└── src/
    ├── main.tsx                     # createRoot 入口
    ├── App.tsx                      # 顶层组件 + 路由状态(currentScreen)
    ├── index.css                    # Tailwind @theme + 全局样式(滚动条、毛玻璃、card-hover)
    ├── types.ts                     # 全局类型定义(AppScreen / GenerationTask / ProductAsset / 等)
    ├── mockData.ts                  # 临时 mock,后续要替换为 API 调用
    └── components/                  # 业务组件,一个文件一个组件
        ├── Sidebar.tsx              # 侧边导航
        ├── Header.tsx               # 顶部工具栏
        ├── Dashboard.tsx            # 仪表盘
        ├── TaskList.tsx             # 任务列表
        ├── CreateImageTask.tsx      # 独立窗口 — 图片任务创建
        ├── CreateVideoTask.tsx      # 独立窗口 — 视频任务创建
        ├── TemplateCenter.tsx       # 模板中心
        ├── ProductAssetLibrary.tsx  # 素材库
        ├── DataAnalytics.tsx        # 数据分析
        ├── SystemConfig.tsx         # 系统配置(模型渠道、用户)
        ├── TaskDetailsDrawer.tsx    # 任务详情抽屉
        └── AssetTransitModal.tsx    # 全局素材中转站 Modal
```

## 路由约定(目前)

**不是 React Router**,而是 `App.tsx` 里的 `currentScreen` state(枚举定义在 `types.ts` 的 `AppScreen`):

```ts
// 切换逻辑
const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.DASHBOARD);
// 渲染逻辑
const renderScreenContent = () => { switch (currentScreen) { ... } }
```

- 优点:零依赖,简单直接
- 缺点:无 URL 同步、无浏览器后退、不能深链。后续若引入 React Router,放在这里替换即可

## Tailwind 主题

**所有自定义颜色/字体/动画在 `src/index.css` 的 `@theme {}` 块里**(Tailwind 4 CSS-first 配置,不是 `tailwind.config.js`)。新增设计 token 必须走这里,**不要**创建 `tailwind.config.js`。

```css
@theme {
  --color-primary: #0256FF;
  --color-primary-light: #EBF2FF;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger:  #EF4444;
  --color-info:    #3B82F6;
  --color-bg-base: #F5F7FB;
  /* ... */
  --font-sans: "Inter", "Noto Sans TC", system-ui, sans-serif;
  --font-display: "Hanken Grotesk", "Inter", sans-serif;
}
```

组件里直接用 `bg-primary`、`text-text-muted` 这类工具类。

## 与后端对接

- 后端工程:`../dafenqi-ai/`(Spring Boot,端口 8090)
- Vite dev proxy(已配,见 `vite.config.ts`):
  - 前端请求 `/api/**` → 实际 `http://localhost:8090/api/**`
  - 环境变量:`VITE_API_BASE_URL=/api`、`VITE_API_TARGET=http://localhost:8090`
- 后端 API 路径规范见 `../dafenqi-ai/CLAUDE.md` 与 `../dafenqi-ai/docs/单体项目开发规范.md`
- **当前状态**:全部数据来自 `src/mockData.ts`,真实 API 接入 TODO

## 环境变量

模板在 `.env.example`,本地真实值放 `.env.local`(被 `.gitignore` 排除):

```env
GEMINI_API_KEY="MY_GEMINI_API_KEY"     # 演示用,生产走后端代理
APP_URL="MY_APP_URL"
VITE_API_BASE_URL=/api
VITE_API_TARGET=http://localhost:8090  # 后端地址
```

**Vite 只暴露 `VITE_*` 前缀的变量**给客户端代码;非 `VITE_` 变量只在构建配置里可见。

## 命令

```bash
npm install          # 安装依赖(项目根目录,不要进 src/)
npm run dev          # 启动 dev server,http://localhost:3000
npm run build        # 产出 dist/(用于部署)
npm run preview      # 本地预览构建产物
npm run lint         # tsc --noEmit,纯类型检查,无 ESLint
npm run clean        # 删除 dist/ 和 server.js
```

## 安全

- **GEMINI_API_KEY** 通过 `.env.local` 提供,**不进 commit**
- 生产环境**不要**把 Gemini key 暴露给浏览器端,优先走后端代理
- Vite dev proxy 只用于开发,生产部署需要在反向代理(Nginx/Caddy)层做同样的 `/api` 转发
- 用户鉴权由后端 Sa-Token 处理,前端只在请求拦截器里统一带 token

## 已知 TODO

- [ ] `src/mockData.ts` → 真实 API 调用(fetch 封装 + TanStack Query 候选)
- [ ] 引入 React Router,替换 `currentScreen` state
- [ ] 用户登录页(对接 `POST /v1/auth/login`)
- [ ] 鉴权拦截器(读 token,统一注入请求头)
- [ ] 全局错误兜底(ErrorBoundary)
- [ ] Vitest + React Testing Library 单元测试
- [ ] Playwright E2E(关键流程:登录 → 创建任务 → 查看结果)
