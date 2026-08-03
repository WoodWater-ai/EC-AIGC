import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AppScreen } from '../types';

interface LoginPageProps {
  /** 登录成功后跳到哪 —— 通常是 dashboard，但允许外部指定 from redirect */
  onSuccess?: (target?: AppScreen) => void;
  /** 登录前页面尝试访问的 screen（未来 React Router 接入后用得上） */
  redirectFrom?: AppScreen;
}

/**
 * 登录页 —— Split Layout（左品牌区 + 右表单卡）
 *
 * 设计要点：
 * - 左：深蓝 #0B1C30 品牌区，固定隐藏 < md（移动端折叠）
 * - 右：白底居中卡片，宽度上限 max-w-sm（384px）
 * - 表单：用户名 + 密码（带可见切换）+ 登录按钮 + 错误提示
 * - 错误处理：axios 拦截器已 toast；这里再展示一个 inline error 让用户知道哪儿填错了
 * - 键盘：Enter 提交；密码可见切换；按钮 loading 时禁用
 *
 * 风格对齐：
 * - 主色 bg-primary / text-primary（同 Header 按钮）
 * - 圆角 rounded-xl（同 Dashboard 卡片）
 * - 字号 sm / xs（同 Header）
 * - Material Symbols 图标（密码可见切换 lock / visibility）
 */
export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setInlineError(null);

    // 基础校验
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setInlineError('请输入用户名');
      return;
    }
    if (!password) {
      setInlineError('请输入密码');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedUser, password);
      // 登录成功：跳到 dashboard（由 App.tsx 提供回调）
      onSuccess?.(AppScreen.DASHBOARD);
    } catch (err) {
      // axios 拦截器已 toast；这里只把 message 挂到表单内（更醒目）
      const msg = err instanceof Error ? err.message : '登录失败，请稍后重试';
      setInlineError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base font-sans antialiased text-text-main">
      {/* ============ 左：品牌区（深蓝）============ */}
      <aside className="hidden md:flex md:w-[42%] lg:w-[44%] bg-bg-dark text-white relative overflow-hidden flex-col justify-between p-12 lg:p-16">
        {/* 背景装饰：渐变 + 几何 */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-info/15 blur-3xl" />
        </div>

        {/* 顶部 Logo + 品牌名 */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-white text-2xl">encrypted</span>
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">达芬奇密码 AI</p>
            <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">
              DaVinci Code · Asset Studio
            </p>
          </div>
        </div>

        {/* 中部 Slogan */}
        <div className="relative z-10 space-y-5">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight">
            让 AI 解锁
            <br />
            <span className="text-primary">商业创意的密码</span>
          </h1>
          <p className="text-sm lg:text-base text-slate-400 leading-relaxed max-w-md">
            一站式 AI 素材生产工作台 · 智能模板 · 商品场景融合 · 多模型调度 · 批量化渲染
          </p>

          {/* 卖点列表 */}
          <ul className="space-y-3 pt-4">
            {[
              { icon: 'auto_awesome', text: 'AI 智能模板 — 30 秒生成专业素材' },
              { icon: 'layers', text: '多模型调度 — 主流模型统一接入' },
              { icon: 'groups', text: '协同评审 — 审核流闭环管理' },
            ].map((item) => (
              <li key={item.icon} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="material-symbols-outlined text-primary text-xl shrink-0">
                  {item.icon}
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        {/* 底部版权 */}
        <div className="relative z-10 text-[11px] text-slate-500 flex items-center gap-3">
          <span>© 2026 达芬奇密码 AI</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span>v1.0.0</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span>ICP 备案中</span>
        </div>
      </aside>

      {/* ============ 右：表单区 ============ */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-10 bg-bg-base overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* 移动端 Logo（仅 md 以下显示） */}
          <div className="md:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-white text-xl">encrypted</span>
            </div>
            <p className="text-base font-bold tracking-tight">达芬奇密码 AI</p>
          </div>

          {/* 表单卡 */}
          <div className="bg-bg-card rounded-2xl shadow-sm border border-border-main p-8">
            {/* 标题 */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-text-main">
                欢迎登录
              </h2>
              <p className="text-xs text-text-muted mt-1.5">
                管理后台 · 请使用账号密码继续
              </p>
            </div>

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* 用户名 */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  用户名
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    person
                  </span>
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    disabled={submitting}
                    className="w-full pl-11 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-text-main placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  密码
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    lock
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    disabled={submitting}
                    className="w-full pl-11 pr-11 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-text-main placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 记住我 + 忘记密码 */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={submitting}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className="text-xs text-slate-600">30 天内自动登录</span>
                </label>
                <button
                  type="button"
                  tabIndex={-1}
                  className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  onClick={() => {
                    // TODO: 接入忘记密码流程（CLAUDE.md 后续）
                    setInlineError('忘记密码功能尚未开通，请联系系统管理员');
                  }}
                >
                  忘记密码？
                </button>
              </div>

              {/* inline 错误提示 */}
              {inlineError && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger/5 border border-danger/20 animate-pulse-slow">
                  <span className="material-symbols-outlined text-danger text-lg shrink-0 mt-px">
                    error
                  </span>
                  <p className="text-xs text-danger font-medium leading-snug">
                    {inlineError}
                  </p>
                </div>
              )}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] cursor-pointer transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm shadow-primary/20"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>登录中…</span>
                  </>
                ) : (
                  <>
                    <span>登录</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 账号获取提示 */}
          <div className="mt-5 px-4 py-2.5 rounded-lg bg-primary-light/50 border border-primary/10 text-center">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              账号密码请联系系统管理员获取
            </p>
          </div>

          {/* 底部备案 */}
          <p className="text-center text-[10px] text-slate-400 mt-8">
            登录即代表同意
            <a className="text-primary mx-1 hover:underline cursor-pointer">《用户协议》</a>
            和
            <a className="text-primary mx-1 hover:underline cursor-pointer">《隐私政策》</a>
          </p>
        </div>
      </main>
    </div>
  );
}
