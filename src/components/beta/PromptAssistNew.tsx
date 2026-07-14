/**
 * AI 帮我写 prompt-新 · Dark Launch 版本
 *
 * [v2.0 2026-07-13 F3]
 * 设计: TEXT 能力独立功能 · 用户在 prompt 输入时调 CHAT 通道生成参考 prompt
 * F3 阶段:F4 PR 上线前走 mock,展示 "AI 生成建议" UI
 *
 * 不动现有任何页面,独立全屏页。
 *
 * [v2.0 修订] Tailwind + lucide-react + sonner(项目 UI 库)
 */
import React, { useState, useEffect } from 'react';
import { Sparkles, Send, Loader2, Copy, Check, ArrowLeft, Wand2, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

interface PromptAssistNewProps {
  /** [F3 简化] 跳回按钮 */
  onBack?: () => void;
}

const MOCK_SUGGESTIONS = [
  '展示夏季新品,模特在纯白背景下 360° 展示产品细节,光线柔和,画面简约高端,8K 高清质感。',
  '高端女装主图,法式浪漫风格,模特优雅站姿,自然光影,背景虚化突出产品,色调温暖。',
  '极简商业产品图,中心构图,产品悬浮展示,光圈效果,科技感背景,适合电商详情页。',
];

export const PromptAssistNew: React.FC<PromptAssistNewProps> = ({ onBack }) => {
  const [context, setContext] = useState({
    taskType: 'PRODUCT_MAIN',
    productCategory: '女装',
    styleTags: '高端,简约',
    sceneTags: '纯白背景,商业感',
    channelType: 'OpenAI',
  });
  // [v2.0 2026-07-13 F3 集成] 从 CreateTaskNew 读草稿
  const [draft, setDraft] = useState(() => sessionStorage.getItem('beta.promptAssist.draft') ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // 写回草稿到 sessionStorage(让用户编辑时 CreateTaskNew 也能拿到最新值)
  useEffect(() => {
    sessionStorage.setItem('beta.promptAssist.draft', draft);
  }, [draft]);

  const generate = async () => {
    setGenerating(true);
    setSuggestions([]);
    try {
      // [F3 mock] F4 PR 上线后接真实 /v1/ai/prompt-assist
      // 当前用 setTimeout 模拟网络延迟 + 3 条 mock 建议
      await new Promise((r) => setTimeout(r, 1500));
      setSuggestions(MOCK_SUGGESTIONS);
      toast.success('已生成 3 条参考 prompt');
    } catch (e) {
      toast.error('生成失败,稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const copyOne = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      toast.success('已复制到剪贴板,3 秒后跳回新建任务-新');
      // [v2.0 2026-07-13 F3 集成] 写结果到 sessionStorage,跳回 CreateTaskNew
      sessionStorage.setItem('beta.promptAssist.result', text);
      // 清草稿(避免下次进 PromptAssist 残留)
      sessionStorage.removeItem('beta.promptAssist.draft');
      setTimeout(() => {
        onBack?.();
      }, 1500);
    } catch {
      toast.error('复制失败,请手动选中');
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-500" />
              AI 帮我写 prompt
              <span className="text-rose-500 text-sm font-bold">-新</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-bold tracking-wider">BETA</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">用 CHAT 通道生成参考 prompt · 调好后一键复制到「新建任务-新」</p>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左:上下文输入 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Wand2 className="w-4 h-4 text-indigo-500" />
              上下文
            </div>

            <FieldRow label="任务类型">
              <select
                value={context.taskType}
                onChange={(e) => setContext({ ...context, taskType: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="PRODUCT_MAIN">PRODUCT_MAIN 主图</option>
                <option value="DETAIL_SCENE">DETAIL_SCENE 细节场景</option>
                <option value="DETAIL">DETAIL 细节</option>
                <option value="MODEL_TRIPLE_VIEW">MODEL_TRIPLE_VIEW 三视图</option>
              </select>
            </FieldRow>

            <FieldRow label="商品类目">
              <input
                type="text"
                value={context.productCategory}
                onChange={(e) => setContext({ ...context, productCategory: e.target.value })}
                placeholder="女装 / 男装 / 3C / 美妆 ..."
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </FieldRow>

            <FieldRow label="风格标签(逗号分隔)">
              <input
                type="text"
                value={context.styleTags}
                onChange={(e) => setContext({ ...context, styleTags: e.target.value })}
                placeholder="高端,简约,法式,科技感 ..."
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </FieldRow>

            <FieldRow label="场景标签(逗号分隔)">
              <input
                type="text"
                value={context.sceneTags}
                onChange={(e) => setContext({ ...context, sceneTags: e.target.value })}
                placeholder="纯白背景,商业感,户外 ..."
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </FieldRow>

            <FieldRow label="调用通道">
              <select
                value={context.channelType}
                onChange={(e) => setContext({ ...context, channelType: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option>OpenAI</option>
                <option>Qwen</option>
                <option>Doubao</option>
                <option>Deepseek</option>
              </select>
            </FieldRow>

            <FieldRow label="当前草稿 prompt(可选)">
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="已有草稿可填,AI 基于此优化..."
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </FieldRow>

            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-md flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
              style={{ background: '#6366f1' }}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 生成中…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  生成参考 prompt
                </>
              )}
            </button>
          </div>

          {/* 右:建议列表 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              AI 建议
              {suggestions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {suggestions.length} 条
                </span>
              )}
            </div>

            {generating ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-indigo-400" />
                <p>AI 正在生成建议…</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">填写左侧上下文,点「生成参考 prompt」获取 AI 建议</p>
                <p className="text-[10px] mt-2 text-slate-300">F3 阶段 mock · F4 PR 上线后接真实 CHAT 通道</p>
              </div>
            ) : (
              suggestions.map((s, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold flex items-center justify-center">
                      {i + 1}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">推荐</span>
                    <button
                      type="button"
                      onClick={() => copyOne(s, i)}
                      className="ml-auto px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
                    >
                      {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      复制
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-mono">{s}</p>
                </div>
              ))
            )}

            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={generate}
                className="w-full px-3 py-2 text-xs text-slate-500 border border-dashed border-slate-300 rounded-md hover:border-indigo-500 hover:text-indigo-600"
              >
                重新生成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
    {children}
  </div>
);
