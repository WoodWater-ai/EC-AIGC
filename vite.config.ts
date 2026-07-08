import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // import.meta.env fallback —— 防止用户忘建 .env.local
  // loadEnv 只读 .env / .env.local / .env.[mode] / .env.[mode].local，不读 .env.example
  // 没 .env.local 时 VITE_API_BASE_URL 是 undefined，axios baseURL = undefined 会发相对路径
  // → Vite proxy 只匹配 /api/* → Vite 自己 404（而不是后端 404）
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api';
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8090';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'import.meta.env.VITE_API_TARGET': JSON.stringify(apiTarget),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // 前端 dev server 代理 /api/** 到后端 dev 端口 8090
      //
      // 关键：后端 controller 路径是 /v1/admin/user/login（不带 /api 前缀），
      // 但前端 axios baseURL = /api，所以发出 /api/v1/admin/user/login。
      // 必须用 rewrite 把 /api 前缀去掉，否则后端看到 /api/v1/... 找不到 → 404
      //
      // 最终链路：
      //   前端请求:  POST /api/v1/admin/user/login
      //   rewrite:   /v1/admin/user/login   (去掉 /api)
      //   转发:      POST http://localhost:8090/v1/admin/user/login  ✅
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },

        // COS 直传 dev proxy —— 解决开发环境 CORS 问题
        // 链路:
        //   前端 hook: PUT /cos/admin/1/other/xxx.png?sign=...
        //   rewrite:   /admin/1/other/xxx.png?sign=...   (去掉 /cos)
        //   转发:      PUT https://<bucket>.cos.<region>.myqcloud.com/admin/1/other/xxx.png?sign=...
        // 生产环境由运维在 COS 控制台配 CORS(允许 Origin),前端不需要走 proxy
        '/cos': {
          target: 'https://dafenqi-ai-1444778271.cos.ap-nanjing.myqcloud.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cos/, ''),
          // 强制 Origin / Referer 为 COS 域,绕开 COS bucket 可能配置的防盗链白名单
          // (浏览器带的是 http://localhost:3000/,会被 COS 防盗链拒绝 → 403)
          headers: {
            Origin: 'https://dafenqi-ai-1444778271.cos.ap-nanjing.myqcloud.com',
            Referer: 'https://dafenqi-ai-1444778271.cos.ap-nanjing.myqcloud.com/',
          },
        },
      },
    },
  };
});
