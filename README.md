# EC-AIGC — 达芬奇密码 AI 素材工作台(前端)

React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4 单页应用。对接 `../dafenqi-ai/` Spring Boot 后端(端口 8090)。

## 项目定位

达芬奇密码 AI 素材工作台的**前端工程**。正式产品需求见 `docs/product/PRD-V2.3.md`。

## 命令

```bash
npm install          # 安装依赖
npm run dev          # 启动 dev server → http://localhost:3000
npm run build        # 生产构建 → dist/
npm run preview      # 本地预览构建产物
npm run lint         # tsc --noEmit 类型检查
npm run clean        # 删除 dist/ 和 server.js
```

## 后端对接

dev 模式通过 Vite proxy 自动转发:

```
浏览器 → http://localhost:3000/api/xxx
        ↓ Vite proxy(vite.config.ts)
后端   → http://localhost:8090/api/xxx
```

详见 `.env.example` 和 `vite.config.ts`。接口路径、DTO 和调用顺序见 `docs/product/API-CONTRACT-V2.3.md`。

## 目录结构

```
EC-AIGC/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── CLAUDE.md                      # 前端项目约定
├── AGENTS.md                      # 前端项目 AI 协作入口
├── docs/
│   ├── product/                   # 三份正式产品与技术文档
│   └── implementation/            # 两份内部执行文档
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css                  # Tailwind 4 @theme
    ├── types.ts
    ├── mockData.ts
    └── components/                # 12 个业务组件
```

## 环境变量

模板在 `.env.example`,本地真实值放 `.env.local`(**不进 git**):

```env
GEMINI_API_KEY=...               # 仅 demo 用,生产走后端代理
VITE_API_BASE_URL=/api
VITE_API_TARGET=http://localhost:8090
```

## 文档

- **`CLAUDE.md`** — 技术栈、目录约定、Tailwind 主题、API 对接、安全、已知 TODO
- **`AGENTS.md`** — 业务模块状态、协作入口、何时直接改 vs 路由
- **`../AGENTS.md`** — 工作区级协作原则
- **`docs/product/PRD-V2.3.md`** — 产品范围、工作流、页面、状态、Skills 与验收唯一依据
- **`docs/product/API-CONTRACT-V2.3.md`** — 前后端接口唯一依据
- **`docs/product/BACKEND-TECHNICAL-SPEC-V2.3.md`** — 后端开发交付规范
- **`docs/implementation/FRONTEND-IMPLEMENTATION-V2.3.md`** — 前端改造任务
- **`docs/implementation/DEVELOPMENT-ROADMAP-V2.3.md`** — 排期、联调和版本管理

## 维护

- `name`: `dafenqi-ai-web`
- 改完代码后让用户手工 commit,不要自动提交
- `npm run lint` 通过后再交付
