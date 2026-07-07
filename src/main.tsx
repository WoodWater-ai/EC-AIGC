import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { AuthProvider } from './auth/AuthContext';
import App from './App.tsx';
import './index.css';

// 字体走 @fontsource(打包进项目，避开 Google Fonts 国内加载不稳)
// 不用 variable 版本是因为 variable 导出的 font-family 带 "Variable" 后缀（如 "Inter Variable"），
// 与项目 CSS 里的 "Inter" / "Material Symbols Outlined" 不匹配，非 variable 版本直接导出无后缀名
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/noto-sans-tc/400.css';
import '@fontsource/noto-sans-tc/500.css';
import '@fontsource/noto-sans-tc/700.css';
import '@fontsource/material-symbols/400.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={4000}
    />
  </StrictMode>,
);