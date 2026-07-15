/**
 * 智能模版中心-新 · Dark Launch 版本
 *
 * [v2.0 2026-07-13 F2]
 * 改造点:
 *   D3 模版绑 default_channel_type + default_capability + default_model(替代 defaultModelChannelId)
 *   D5 Drawer「推荐参数」Tab,展示该模版携带的 template_recommend_params
 *   D7 模版卡片「用此模版 →」按钮跳 /task/create?group=&templateId=&versionId=
 *
 * 不动原 TemplateCenter.tsx(老版本),两版并存。
 *
 * [v2.0 修订] 移除 antd,改用 Tailwind + lucide-react + sonner(项目 UI 库)
 */
import React, { useState, useMemo } from 'react';
import { AppScreen } from '../../types';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import { templateApi, type TemplateDTO } from '../../api/modules/template';
import { recommendParamsApi, type RecommendParamDTO } from '../../api/modules/templateRecommend';
import { Search, Rocket, BookOpen, X, RefreshCw, Loader2, Layers, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';

type TabKey = 'image_task' | 'video_task' | 'solution' | 'assist' | 'refine';

interface TemplateCenterNewProps {
  setScreen: (screen: AppScreen) => void;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'image_task', label: '图像主图 IMAGE_TASK' },
  { key: 'video_task', label: '视频生成 VIDEO_PROMPT' },
  { key: 'solution', label: '解决方案 PLATFORM_SPEC' },
  { key: 'assist', label: '辅助能力 STYLE_SCENE' },
  { key: 'refine', label: '图像精修' },
];

const TAB_TO_KIND: Record<TabKey, TemplateDTO['templateKind']> = {
  image_task: 'IMAGE_TASK',
  video_task: 'VIDEO_PROMPT',
  solution: 'PLATFORM_SPEC',
  assist: 'STYLE_SCENE',
  refine: 'IMAGE_TASK',
};

export const TemplateCenterNew: React.FC<TemplateCenterNewProps> = ({ setScreen }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('image_task');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'NORMAL' | 'DISABLED'>('all');
  const [drawer, setDrawer] = useState<{ templateId: string; versionId: string } | null>(null);

  const { data: list, loading, refetch } = useServiceQuery<TemplateDTO[]>(
    () => templateApi.page({
      templateKind: TAB_TO_KIND[activeTab],
      pageSize: 200,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(searchTerm ? { keyword: searchTerm } : {}),
    }).then((r) => r.list),
    [activeTab, statusFilter, searchTerm],
  );

  const filtered = useMemo(() => list ?? [], [list]);

  const useTemplate = (tpl: TemplateDTO) => {
    const group =
      tpl.templateKind === 'VIDEO_PROMPT' ? 'VIDEO' :
      tpl.templateKind === 'PLATFORM_SPEC' ? 'SOLUTION' :
      'IMAGE';
    sessionStorage.setItem('beta.template.prefill', JSON.stringify({
      templateId: tpl.id,
      templateVersionId: tpl.currentVersion ?? '1',
      group,
      channelType: (tpl as any).defaultChannelType ?? null,
      capability: (tpl as any).defaultCapability ?? null,
      model: (tpl as any).defaultModel ?? null,
    }));
    toast.success('已应用模版,正在跳转到新建任务-新…');
    setScreen(AppScreen.CREATE_TASK_NEW);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            智能模版中心
            <span className="text-rose-500 text-sm font-bold">-新</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-bold tracking-wider">BETA</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">模版绑定 channelType + capability + model · 推荐参数 Tab · 「用此模版」跳新建任务</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 筛选条 */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索模版名称"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
        >
          <option value="all">全部状态</option>
          <option value="NORMAL">启用</option>
          <option value="DISABLED">停用</option>
        </select>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          刷新
        </button>
        <div className="text-xs text-slate-400 ml-auto">
          共 {filtered.length} 条 · D3/D5/D7 改造中
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>暂无模版</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">模版名称</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">绑定能力</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">通道</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">模型</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">使用</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tpl) => (
                <tr key={tpl.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800 text-sm">{tpl.templateName}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {tpl.currentVersion ?? 'V1'} · {tpl.code ?? '系统'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono">
                      {(tpl as any).defaultCapability ?? tpl.applicableTaskTypes ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{(tpl as any).defaultChannelType ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{(tpl as any).defaultModel ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      tpl.status === 'NORMAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {tpl.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{tpl.usageCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => useTemplate(tpl)}
                        className="px-3 py-1 text-xs font-medium text-white rounded-md flex items-center gap-1 hover:opacity-90"
                        style={{ background: '#c97b3f' }}
                      >
                        <Rocket className="w-3 h-3" />
                        用此模版
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawer({ templateId: tpl.id, versionId: tpl.currentVersion ?? '1' })}
                        className="px-3 py-1 text-xs text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
                      >
                        详情
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TemplateDrawerNew
        templateId={drawer?.templateId}
        templateVersionId={drawer?.versionId}
        open={!!drawer}
        onClose={() => setDrawer(null)}
        onUseTemplate={(tpl) => {
          setDrawer(null);
          useTemplate(tpl);
        }}
      />
    </div>
  );
};

// ===== Drawer 详情(基础信息 Tab + 推荐参数 Tab) =====

interface TemplateDrawerNewProps {
  templateId?: string;
  templateVersionId?: string;
  open: boolean;
  onClose: () => void;
  onUseTemplate: (tpl: TemplateDTO) => void;
}

const TemplateDrawerNew: React.FC<TemplateDrawerNewProps> = ({
  templateId, templateVersionId, open, onClose, onUseTemplate,
}) => {
  const [drawerTab, setDrawerTab] = useState<'basic' | 'recommend'>('basic');

  const { data: tpl, loading: tplLoading } = useServiceQuery<TemplateDTO>(
    () => templateId
      ? templateApi.get(templateId)
      : Promise.resolve(null as any),
    [templateId],
  );

  const { data: recommendList, loading: recLoading } = useServiceQuery<RecommendParamDTO[]>(
    () => (templateId && templateVersionId)
      ? recommendParamsApi.listByCapability({
          channelType: (tpl as any)?.defaultChannelType ?? 'VIDU',
          capability: (tpl as any)?.defaultCapability ?? 'MAIN_IMAGE',
        }).then((r) => r.list.filter(
          (p) => p.templateId === templateId && p.templateVersionId === templateVersionId
        ))
      : Promise.resolve([]),
    [templateId, templateVersionId, tpl],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-[720px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            模版详情
            <span className="text-rose-500 text-xs font-bold">-新</span>
          </h2>
          <div className="flex items-center gap-2">
            {tpl && (
              <button
                type="button"
                onClick={() => onUseTemplate(tpl)}
                className="px-3 py-1.5 text-sm font-medium text-white rounded-md flex items-center gap-1.5 hover:opacity-90"
                style={{ background: '#c97b3f' }}
              >
                <Rocket className="w-4 h-4" />
                用此模版
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tplLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中…
            </div>
          ) : !tpl ? (
            <div className="text-center py-12 text-slate-400">模版不存在</div>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-800">{tpl.templateName}</h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{tpl.currentVersion ?? 'V1'}</span>
                  <span className={`px-1.5 py-0.5 rounded ${
                    tpl.status === 'NORMAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>{tpl.status}</span>
                  <span className="font-mono">{tpl.code}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center border-b border-slate-200 mb-4">
                {(['basic', 'recommend'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDrawerTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      drawerTab === tab
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'basic' ? '基础信息' : `推荐参数 (${recommendList?.length ?? 0})`}
                  </button>
                ))}
              </div>

              {drawerTab === 'basic' && (
                <div className="space-y-3">
                  {/* D3 三件套 */}
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">绑定能力三件套</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-bold">D3</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded">
                        <div className="text-[10px] text-slate-500 uppercase">通道类型</div>
                        <div className="font-mono text-sm mt-1">{(tpl as any).defaultChannelType ?? '—'}</div>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <div className="text-[10px] text-slate-500 uppercase">能力编码</div>
                        <div className="font-mono text-sm mt-1">{(tpl as any).defaultCapability ?? '—'}</div>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <div className="text-[10px] text-slate-500 uppercase">默认模型</div>
                        <div className="font-mono text-sm mt-1">{(tpl as any).defaultModel ?? '—'}</div>
                      </div>
                    </div>
                    {!(tpl as any).defaultChannelType && (
                      <div className="text-[10px] text-amber-700 mt-2 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        模版暂未绑定 channelType/capability/model(后端 D3 DDL 待 F4 上线后回填)
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded">
                      <div className="text-[10px] text-slate-500 uppercase">主 Prompt</div>
                      <div className="font-mono text-xs mt-1 whitespace-pre-wrap">{tpl.promptBody}</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded">
                      <div className="text-[10px] text-slate-500 uppercase">negativePrompt</div>
                      <div className="font-mono text-xs mt-1">{tpl.negativePrompt ?? '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'recommend' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                    <span>推荐参数 = 模版携带的 params JSON,CreateTask-新 用此模版时自动预填 Step 3 动态表单。
                    每条可绑定到特定 model(model 字段空 = 任意 model 都用这条推荐)。</span>
                  </div>
                  {recLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      加载中…
                    </div>
                  ) : (recommendList ?? []).length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">该模版暂无推荐参数</p>
                    </div>
                  ) : (
                    (recommendList ?? []).map((p, i) => (
                      <div key={p.id} className="bg-white border border-slate-200 rounded p-3 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{p.paramsKey}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">推荐</span>
                            <span className="text-[10px] text-slate-400 font-mono">model = {p.model ?? '任意'}</span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 font-mono break-all">
                            {p.paramsJson.length > 80 ? p.paramsJson.slice(0, 80) + '...' : p.paramsJson}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toast.info('F2 阶段只读,编辑在「推荐参数管理-新」')}
                          className="px-2.5 py-1 text-xs text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 flex-shrink-0"
                        >
                          编辑
                        </button>
                      </div>
                    ))
                  )}
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>F2 阶段推荐参数 Tab 只读展示,完整编辑在 F3 「推荐参数管理-新」独立页。</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
