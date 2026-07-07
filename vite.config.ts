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
      },
    },
  };
});
