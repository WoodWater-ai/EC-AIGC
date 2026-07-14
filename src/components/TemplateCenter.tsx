/**
 * 智能模板中心 · 主组件.
 *
 * PR-2:从全 mock 重写为调真实接口,样式严格 1:1 复刻原版 TemplateCenter.tsx (1466 行内联 JSX).
 * 数据由 useServiceQuery 拉取,5 类模板筛选通过 templateKind 入参传给后端,批量停用单次请求搞定.
 *
 * 子组件已删除:原版是单文件内联 JSX,本任务不需要 TemplateDrawer/Table/Toolbar.
 * 字段映射见 docs/superpowers/specs/2026-07-10-template-mock-to-real-design.md §4.
 */
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { useDictOptions } from '../api/hooks/useDict';
import { type DictOption } from '../api/modules/dict';
import {
  templateApi,
  type TemplateDTO,
  type TemplateKind,
  type TemplateCreateRequest,
  type TemplateUpdateRequest,
} from '../api/modules/template';
import { recommendParamsApi } from '../api/modules/templateRecommend';
import { AppScreen } from '../types';

/** 从 templateKind 派生 group,决定建任务页 group */
function deriveGroup(templateKind: string | undefined): 'IMAGE' | 'VIDEO' | 'SOLUTION' {
  if (!templateKind) return 'IMAGE';
  if (templateKind === 'VIDEO_PROMPT') return 'VIDEO';
  if (templateKind.startsWith('SOLUTION_')) return 'SOLUTION';
  return 'IMAGE';
}

/** 从 templateKind 决定跳哪个建任务页 */
function deriveTargetScreen(templateKind: string | undefined): AppScreen {
  if (templateKind === 'VIDEO_PROMPT') return AppScreen.CREATE_VIDEO_TASK;
  if (templateKind && templateKind.startsWith('SOLUTION_')) return AppScreen.CREATE_VIDEO_TASK;
  return AppScreen.CREATE_IMAGE_TASK;
}

type TabKey = 'image_task' | 'style_scene' | 'video_prompt' | 'platform_spec' | 'negative_constraint';

const TAB_TO_KIND: Record<TabKey, TemplateKind> = {
  image_task: 'IMAGE_TASK',
  style_scene: 'STYLE_SCENE',
  video_prompt: 'VIDEO_PROMPT',
  platform_spec: 'PLATFORM_SPEC',
  negative_constraint: 'NEGATIVE_CONSTRAINT',
};

const TAB_LABELS: Record<TabKey, string> = {
  image_task: '图片任务模板',
  style_scene: '风格场景模板',
  video_prompt: '视频 Prompt 模板',
  platform_spec: '平台规格模板',
  negative_constraint: '负面约束模板',
};

const TABS: TabKey[] = ['image_task', 'style_scene', 'video_prompt', 'platform_spec', 'negative_constraint'];

interface TemplateCenterProps {
  setScreen: (screen: AppScreen) => void;
}

interface DrawerState {
  mode: 'create' | 'edit';
  tab: TabKey;
  data: Partial<TemplateDTO>;
}

export default function TemplateCenter({ setScreen }: TemplateCenterProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('image_task');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'NORMAL' | 'DISABLED'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const kind = TAB_TO_KIND[activeTab];

  // ===== 数据拉取 =====
  const { data, loading, error, refetch } = useServiceQuery(
    () =>
      templateApi.page({
        pageNum: 1,
        pageSize: 50,
        templateKind: kind,
        status: statusFilter === 'all' ? undefined : statusFilter,
        keyword: searchTerm || undefined,
      }),
    [activeTab, statusFilter, searchTerm],
  );

  const templates: TemplateDTO[] = data?.list ?? [];

  // ===== 字典数据(从后端 dict 拉取) =====
  const { options: imageTaskTypeOptions } = useDictOptions('IMAGE_TASK_TYPE');
  const { options: styleDimensionOptions } = useDictOptions('STYLE_DIMENSION');
  const { options: videoModeOptions } = useDictOptions('VIDEO_MODE');
  const { options: videoDurationOptions } = useDictOptions('VIDEO_DURATION');
  const { options: videoMotionOptions } = useDictOptions('VIDEO_MOTION');
  const { options: platformUsageOptions } = useDictOptions('TASK_TYPE'); // 复用现有 TASK_TYPE
  const { options: platformFormatOptions } = useDictOptions('PLATFORM_FORMAT');
  const { options: ncAssetScopeOptions } = useDictOptions('NC_ASSET_SCOPE');
  const { options: ncSeverityOptions } = useDictOptions('NC_SEVERITY');
  const { options: ncCategoryOptions } = useDictOptions('NC_CATEGORY');
  const { options: templateTaskTypeOptions } = useDictOptions('TEMPLATE_TASK_TYPE');

  /**
   * TAB → 任务类型(itemCode)映射,从 templateTaskTypeOptions 动态构建.
   * 任务类型的 itemCode 与 TabKey 的对应关系由后端 dict 数据决定,
   * 当前约定:商品生图/场景融合/视频脚本/规格排版/负面提示 五个 itemCode
   * 对应 image_task / style_scene / video_prompt / platform_spec / negative_constraint 五个 Tab.
   */
  // 用 opt.label (itemName 中文) 而非 opt.value (itemCode 英文),保持原版行为:
  // 后端 applicableTaskTypes 字段存"商品生图"等中文展示文本,前端列表/抽屉直接显示中文
  const TAB_TO_TASK_TYPE: Record<TabKey, string> = useMemo(() => {
    const byValue = (v: string): DictOption | undefined =>
      templateTaskTypeOptions.find((opt) => opt.value === v);
    return {
      image_task: byValue('PRODUCT_IMAGE')?.label ?? '',
      style_scene: byValue('SCENE_BLEND')?.label ?? '',
      video_prompt: byValue('VIDEO_SCRIPT')?.label ?? '',
      platform_spec: byValue('SPEC_LAYOUT')?.label ?? '',
      negative_constraint: byValue('NEGATIVE_PROMPT')?.label ?? '',
    };
  }, [templateTaskTypeOptions]);

  // ===== 工具函数 =====

  /** 从 promptBody 提取 {{变量}} */
  const extractVariables = (prompt: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(prompt)) !== null) {
      const v = match[1].trim();
      if (!matches.includes(v)) matches.push(v);
    }
    return matches;
  };

  /** 后端 variables 是 JSON 字符串,前端读时解析;回写时再 stringify */
  const parseVariables = (json: string | undefined): string[] => {
    if (!json) return [];
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  };

  /** 把 string 字段转 number(留空返回 undefined) */
  const toNum = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  /** 把 editable state 转成后端 create/update 请求体 */
  const buildSavePayload = (state: DrawerState): TemplateCreateRequest | TemplateUpdateRequest => {
    const d = state.data;
    const payload: TemplateCreateRequest = {
      templateName: d.templateName ?? '',
      templateKind: TAB_TO_KIND[state.tab],
      code: d.code,
      applicableTaskTypes: d.applicableTaskTypes,
      promptBody: d.promptBody ?? '',
      negativePrompt: d.negativePrompt,
      // 统一从 _variablesArr 强制 JSON 序列化(避免 undefined 字段被省略)
      variables: JSON.stringify((d as { _variablesArr?: string[] })._variablesArr ?? []),
      defaultCount: toNum(d.defaultCount),
      defaultModelChannelId: d.defaultModelChannelId,
      defaultAspectRatio: d.defaultAspectRatio, // legacy
      defaultRatio: d.defaultRatio, // V11 业务主字段
      defaultStyle: d.defaultStyle,
      defaultScene: d.defaultScene,
      defaultPose: d.defaultPose,
      applicableCategories: d.applicableCategories,
      applicableImageTypes: d.applicableImageTypes,
      imageTaskType: d.imageTaskType,
      videoDefaultDurationSec: toNum(d.videoDefaultDurationSec),
      videoDefaultResolution: d.videoDefaultResolution,
      videoDefaultMotion: d.videoDefaultMotion,
      videoThreePartStructure: d.videoThreePartStructure,
      platformUsage: d.platformUsage,
      platformRecommendedRatio: d.platformRecommendedRatio,
      platformWidth: toNum(d.platformWidth),
      platformHeight: toNum(d.platformHeight),
      platformMaxFileSize: d.platformMaxFileSize,
      platformIsDefaultRecommended: d.platformIsDefaultRecommended,
      ncAssetKindScope: d.ncAssetKindScope,
      ncSeverity: d.ncSeverity,
      ncDefaultEnabled: d.ncDefaultEnabled,
      ncConflictRules: d.ncConflictRules,
    };
    // create 模式也带 status(handleNew 已预设 'NORMAL'),edit 模式带 id + 覆盖 status
    if (state.mode === 'edit' && d.id) {
      return { ...payload, id: d.id, status: d.status };
    }
    return { ...payload, status: d.status };
  };

  // ===== 事件处理 =====

  const handleCopyPrompt = async (tpl: TemplateDTO) => {
    try {
      await navigator.clipboard.writeText(tpl.promptBody);
      toast.success(`已成功复制「${tpl.templateName}」提示词指令！`);
    } catch {
      toast.error('复制失败,请检查浏览器权限');
    }
  };

  const handleBatchCopy = async () => {
    if (selectedIds.length === 0) {
      toast.info('请选择要复制提示词的模板！');
      return;
    }
    const prompts = selectedIds
      .map((id) => {
        const found = templates.find((t) => t.id === id);
        return found ? `【${found.templateName}】\n${found.promptBody}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(prompts);
      toast.success(`已复制 ${selectedIds.length} 个模板指令至剪贴板！`);
    } catch {
      toast.error('复制失败,请检查浏览器权限');
    }
  };

  const handleBatchDeactivate = async () => {
    if (selectedIds.length === 0) {
      toast.info('请先选择要停用的模板！');
      return;
    }
    try {
      await templateApi.batchUpdateStatus(selectedIds, 'DISABLED');
      toast.success(`已批量停用 ${selectedIds.length} 个模板资源！`);
      setSelectedIds([]);
      await refetch();
    } catch (e) {
      console.error('批量停用失败', e);
      toast.error('批量停用失败');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(templates.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleNew = () => {
    setDrawer({
      mode: 'create',
      tab: activeTab,
      data: {
        templateName: '',
        templateKind: TAB_TO_KIND[activeTab],
        status: 'NORMAL',
        // 预设默认值,避免受控组件 value={d.field ?? '默认'} 但 state 实际是 undefined
        // 导致 buildSavePayload JSON 序列化时省略字段,后端 @NotBlank / 业务字段为空
        defaultCount: 4,
        defaultStyle: '白底',
        // IMAGE_TASK 类字段(只在 IMAGE_TASK tab 合理,其它 tab 用户填 platformRecommendedRatio 等)
        ...(activeTab === 'image_task' ? { defaultRatio: '3:4' } : {}),
        applicableCategories: '通用',
        imageTaskType: 'MAIN',
        _variablesArr: [], // 配合 buildSavePayload 强制发 '[]'
        // 当前 tab 的任务类型(中文,如"商品生图"),避免用户首次进入抽屉时该字段为空
        // 后续切换 tab 会通过 onTabChange 覆盖
        applicableTaskTypes: TAB_TO_TASK_TYPE[activeTab],
      },
    });
  };

  const handleRowClick = (tpl: TemplateDTO) => {
    const tabKey = (Object.keys(TAB_TO_KIND) as TabKey[]).find((k) => TAB_TO_KIND[k] === tpl.templateKind) ?? activeTab;
    setDrawer({
      mode: 'edit',
      tab: tabKey,
      data: { ...tpl, _variablesArr: parseVariables(tpl.variables) } as Partial<TemplateDTO> & { _variablesArr?: string[] },
    });
  };

  const handleCloseDrawer = () => {
    setDrawer(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawer) return;
    if (!drawer.data.templateName?.trim()) {
      toast.error('请填写模板名称！');
      return;
    }
    try {
      const payload = buildSavePayload(drawer);
      if (drawer.mode === 'edit') {
        await templateApi.update(payload as TemplateUpdateRequest);
        toast.success(`模板「${drawer.data.templateName}」已成功保存并同步！`);
      } else {
        await templateApi.create(payload as TemplateCreateRequest);
        toast.success(`自定义模板「${drawer.data.templateName}」创建成功！`);
      }
      setDrawer(null);
      setSelectedIds([]);
      await refetch();
    } catch (err) {
      console.error('保存模板失败', err);
      toast.error('保存失败');
    }
  };

  const getTabCount = (tab: TabKey): number => {
    if (tab === activeTab) return templates.length;
    return 0;
  };

  const launchWithTemplate = async (tpl: TemplateDTO) => {
    // 1. 写 prefill 基础字段
    const group = deriveGroup(tpl.templateKind);
    const prefill: {
      templateId: string;
      templateVersionId: string;
      group: 'IMAGE' | 'VIDEO' | 'SOLUTION';
      channelType: string | null;
      capability: string | null;
      model: string | null;
    } = {
      templateId: tpl.id,
      templateVersionId: tpl.currentVersion ?? '',
      group,
      channelType: null,
      capability: null,
      model: null,
    };
    // 2. 异步拉推荐行,拿第一行作为锁 + 回填的基准(失败/返空降级)
    try {
      const page = await recommendParamsApi.page({
        templateId: tpl.id,
        templateVersionId: tpl.currentVersion ?? undefined,
      });
      const firstRow = page?.list?.[0];
      if (firstRow) {
        prefill.channelType = firstRow.channelType;
        prefill.capability = firstRow.capabilityCode;
        prefill.model = firstRow.model ?? null;
      }
    } catch (e) {
      console.warn('[TemplateCenter] 拉推荐参数失败,降级到不锁', e);
    }
    // 3. 写 sessionStorage
    try {
      sessionStorage.setItem('beta.template.prefill', JSON.stringify(prefill));
    } catch (e) {
      console.warn('[TemplateCenter] sessionStorage 写失败', e);
    }
    // 4. 跳页面
    setScreen(deriveTargetScreen(tpl.templateKind));
  };

  // ===== 渲染 =====

  return (
    <div className="space-y-6">
      {/* 页面头 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">模板资源库</h2>
          <p className="text-xs text-slate-500">维护可复用 Prompt 模板,提升生成质量与一致性。</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100 border-dashed">
          <Info className="w-4 h-4 text-blue-600" />
          <p className="text-xs text-slate-600">
            当前权限：<span className="font-semibold text-blue-600">管理员</span>,可编辑和发布模板。普通员工仅可查看及复制。
          </p>
        </div>
      </div>

      {/* 主工作区卡片 */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
        {/* Tab 切换 */}
        <div className="flex border-b border-slate-100 bg-slate-50/40 px-4 pt-2 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedIds([]);
              }}
              className={`px-4 py-3 border-b-2 font-semibold text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-blue-600'
              }`}
              data-testid={`template-tab-${tab}`}
            >
              {TAB_LABELS[tab]} ({getTabCount(tab)})
            </button>
          ))}
        </div>

        {/* 工具栏 + 过滤 */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all outline-none"
                placeholder="搜索模板名称或关键字"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="template-search"
              />
            </div>
            <select
              className="py-1.5 pl-3 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-600 focus:bg-white transition-all outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'NORMAL' | 'DISABLED')}
              data-testid="template-status-filter"
            >
              <option value="all">状态: 全部</option>
              <option value="NORMAL">启用中</option>
              <option value="DISABLED">已停用</option>
            </select>
          </div>
          <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
            <button
              onClick={handleBatchCopy}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              复制
            </button>
            <button
              onClick={handleBatchDeactivate}
              className="px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
              data-testid="template-batch-deactivate"
            >
              <span className="material-symbols-outlined text-sm text-rose-500">block</span>
              批量停用
            </button>
            <button
              onClick={handleNew}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-xs ml-2 cursor-pointer"
              data-testid="template-new"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              新建模板
            </button>
          </div>
        </div>

        {/* 表格区 */}
        {loading && (
          <div className="p-12 text-center text-slate-400 text-sm font-bold" data-testid="template-loading">
            加载中...
          </div>
        )}
        {error && !loading && (
          <div className="p-12 text-center text-rose-500 text-sm font-bold" data-testid="template-error">
            加载失败:{String(error)}
          </div>
        )}
        {!loading && !error && (
          <TemplateTableArea
            templates={templates}
            activeTab={activeTab}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectRow={handleSelectRow}
            onRowClick={handleRowClick}
            onCopy={handleCopyPrompt}
            launchWithTemplate={launchWithTemplate}
          />
        )}

        {/* 表尾 */}
        {!loading && !error && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <span>
              共 {templates.length} 个模板,已选择 {selectedIds.length} 个
            </span>
            <div className="flex items-center gap-1.5">
              <button className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 cursor-pointer">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button className="w-6 h-6 rounded bg-blue-600 text-white font-semibold flex items-center justify-center">1</button>
              <button className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 抽屉(内联在主组件闭包内,使用 setDrawer 直接更新) */}
      {drawer && (
        <TemplateDrawerInline
          drawer={drawer}
          setDrawer={setDrawer}
          onClose={handleCloseDrawer}
          onSave={handleSave}
          imageTaskTypeOptions={imageTaskTypeOptions}
          styleDimensionOptions={styleDimensionOptions}
          videoModeOptions={videoModeOptions}
          videoDurationOptions={videoDurationOptions}
          videoMotionOptions={videoMotionOptions}
          platformUsageOptions={platformUsageOptions}
          platformFormatOptions={platformFormatOptions}
          ncAssetScopeOptions={ncAssetScopeOptions}
          ncSeverityOptions={ncSeverityOptions}
          ncCategoryOptions={ncCategoryOptions}
          tabToTaskType={TAB_TO_TASK_TYPE}
          extractVariables={extractVariables}
        />
      )}
    </div>
  );
}

// =====================================================================
// 表格区(只在 TemplateCenter 内部使用,保持单文件组织)
// =====================================================================

interface TemplateTableAreaProps {
  templates: TemplateDTO[];
  activeTab: TabKey;
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onRowClick: (tpl: TemplateDTO) => void;
  onCopy: (tpl: TemplateDTO) => void;
  launchWithTemplate: (tpl: TemplateDTO) => Promise<void>;
}

function TemplateTableArea(props: TemplateTableAreaProps) {
  const { templates, activeTab, selectedIds, onSelectAll, onSelectRow, onRowClick, onCopy, launchWithTemplate } = props;
  if (templates.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 font-medium">
        <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">space_dashboard</span>
        <p className="text-sm font-semibold text-slate-600">暂无该分类下的可复用规则模板</p>
        <p className="text-slate-400 text-xs mt-1">您可以通过上方「新建模板」按钮为该大类创建新规约</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse min-w-[1250px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 tracking-wider">
            <th className="p-4 w-12 text-center">
              <input
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer w-4 h-4"
                type="checkbox"
                checked={selectedIds.length === templates.length}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            {activeTab === 'image_task' && (
              <>
                <th className="p-4 font-semibold text-slate-700">模板名称</th>
                <th className="p-4 font-semibold text-slate-700">图片任务类型</th>
                <th className="p-4 font-semibold text-slate-700">适用品类</th>
                <th className="p-4 font-semibold text-slate-700">默认风格</th>
                <th className="p-4 font-semibold text-slate-700">默认比例 / 张数</th>
                <th className="p-4 font-semibold text-slate-700">默认模型通道</th>
                <th className="p-4 font-semibold text-slate-700">关联负面约束</th>
                <th className="p-4 font-semibold text-slate-700">状态</th>
                <th className="p-4 font-semibold text-slate-700">使用次数</th>
              </>
            )}
            {activeTab === 'style_scene' && (
              <>
                <th className="p-4 font-semibold text-slate-700">风格场景名称</th>
                <th className="p-4 font-semibold text-slate-700">模板类型</th>
                <th className="p-4 font-semibold text-slate-700">风格标签</th>
                <th className="p-4 font-semibold text-slate-700">场景标签</th>
                <th className="p-4 font-semibold text-slate-700">动作/姿势标签</th>
                <th className="p-4 font-semibold text-slate-700">审美评分</th>
                <th className="p-4 font-semibold text-slate-700">推荐任务</th>
                <th className="p-4 font-semibold text-slate-700">状态</th>
                <th className="p-4 font-semibold text-slate-700">调用频次</th>
              </>
            )}
            {activeTab === 'video_prompt' && (
              <>
                <th className="p-4 font-semibold text-slate-700">视频脚本名称</th>
                <th className="p-4 font-semibold text-slate-700">视频生成模式</th>
                <th className="p-4 font-semibold text-slate-700">推荐适用首帧</th>
                <th className="p-4 font-semibold text-slate-700">参数限制 (时长/幅度)</th>
                <th className="p-4 font-semibold text-slate-700">三段结构建议</th>
                <th className="p-4 font-semibold text-slate-700">约束项</th>
                <th className="p-4 font-semibold text-slate-700">状态</th>
                <th className="p-4 font-semibold text-slate-700">使用次数</th>
              </>
            )}
            {activeTab === 'platform_spec' && (
              <>
                <th className="p-4 font-semibold text-slate-700">规格规范名称</th>
                <th className="p-4 font-semibold text-slate-700">输出类型</th>
                <th className="p-4 font-semibold text-slate-700">推荐画幅比例</th>
                <th className="p-4 font-semibold text-slate-700">宽度 x 高度 (px)</th>
                <th className="p-4 font-semibold text-slate-700">文件格式</th>
                <th className="p-4 font-semibold text-slate-700">体积大小限制</th>
                <th className="p-4 font-semibold text-slate-700">默认推荐带入</th>
                <th className="p-4 font-semibold text-slate-700">状态</th>
              </>
            )}
            {activeTab === 'negative_constraint' && (
              <>
                <th className="p-4 font-semibold text-slate-700">负面约束名称</th>
                <th className="p-4 font-semibold text-slate-700">适用素材</th>
                <th className="p-4 font-semibold text-slate-700">约束分类</th>
                <th className="p-4 font-semibold text-slate-700">严重级别</th>
                <th className="p-4 font-semibold text-slate-700">中文避坑说明</th>
                <th className="p-4 font-semibold text-slate-700">默认全局启用</th>
                <th className="p-4 font-semibold text-slate-700">正在被引用数</th>
                <th className="p-4 font-semibold text-slate-700">状态</th>
              </>
            )}
            <th className="p-4 font-semibold text-slate-700 text-right w-28">操作</th>
          </tr>
        </thead>
        <tbody className="text-xs divide-y divide-slate-100">
          {templates.map((tpl) => {
            const isChecked = selectedIds.includes(tpl.id);
            return (
              <tr
                key={tpl.id}
                onClick={() => onRowClick(tpl)}
                className={`hover:bg-slate-50/50 transition-colors cursor-pointer group ${
                  isChecked ? 'bg-blue-50/20' : ''
                } ${tpl.status === 'DISABLED' ? 'opacity-75 bg-slate-50/30' : ''}`}
              >
                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer w-4 h-4"
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onSelectRow(tpl.id, e.target.checked)}
                  />
                </td>
                {activeTab === 'image_task' && (
                  <ImageTaskRow tpl={tpl} />
                )}
                {activeTab === 'style_scene' && (
                  <StyleSceneRow tpl={tpl} />
                )}
                {activeTab === 'video_prompt' && (
                  <VideoPromptRow tpl={tpl} />
                )}
                {activeTab === 'platform_spec' && (
                  <PlatformSpecRow tpl={tpl} />
                )}
                {activeTab === 'negative_constraint' && (
                  <NegativeConstraintRow tpl={tpl} />
                )}
                <td className="p-4 text-right font-semibold" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onCopy(tpl)}
                      title="复制正文指令"
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">content_copy</span>
                    </button>
                    <button
                      onClick={() => onRowClick(tpl)}
                      title="编辑修改规则"
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">edit</span>
                    </button>
                    <button
                      onClick={() => launchWithTemplate(tpl)}
                      title="以此规则发布新任务"
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">rocket_launch</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// 5 类行渲染
function ImageTaskRow({ tpl }: { tpl: TemplateDTO }) {
  return (
    <>
      <td className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-lg text-blue-600">add_photo_alternate</span>
          <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{tpl.templateName}</span>
        </div>
      </td>
      <td className="p-4">
        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-medium text-[10px]">
          {tpl.imageTaskType ?? '主图'}
        </span>
      </td>
      <td className="p-4 text-slate-500 font-medium">{tpl.applicableCategories ?? '通用品类'}</td>
      <td className="p-4 text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          {tpl.defaultStyle ?? '默认自然风格'}
        </span>
      </td>
      <td className="p-4 font-mono text-slate-600 font-medium">
        {tpl.defaultRatio ?? '3:4'} <span className="text-slate-300 mx-1">/</span> {tpl.defaultCount ?? 4}张
      </td>
      <td className="p-4 text-slate-500 font-medium">{tpl.defaultModelChannelId ?? 'DaVinci Vision v2'}</td>
      <td className="p-4 text-slate-400 max-w-[150px] truncate" title={tpl.ncConflictRules ?? '通用物理防走形约束'}>
        {tpl.ncConflictRules ?? '通用防形变约束'}
      </td>
      <td className="p-4">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            tpl.status === 'NORMAL'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          {tpl.status === 'NORMAL' ? '启用中' : '已停用'}
        </span>
      </td>
      <td className="p-4 font-mono font-semibold text-slate-700">{(tpl.usageCount ?? 0).toLocaleString()}</td>
    </>
  );
}

function StyleSceneRow({ tpl }: { tpl: TemplateDTO }) {
  return (
    <>
      <td className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-lg text-indigo-500">palette</span>
          <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{tpl.templateName}</span>
        </div>
      </td>
      <td className="p-4">
        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-[10px]">
          {tpl.defaultScene ? '场景' : '风格'}
        </span>
      </td>
      <td className="p-4">
        <div className="flex flex-wrap gap-1 max-w-[150px]">
          <span className="px-1 bg-slate-100 text-slate-600 rounded text-[9px]">{tpl.defaultStyle ?? '通用'}</span>
        </div>
      </td>
      <td className="p-4">
        <div className="flex flex-wrap gap-1 max-w-[150px]">
          <span className="px-1 bg-slate-100 text-slate-600 rounded text-[9px]">{tpl.defaultScene ?? '精致电商摄影棚'}</span>
        </div>
      </td>
      <td className="p-4">
        <div className="flex flex-wrap gap-1 max-w-[120px]">
          <span className="px-1 bg-slate-100 text-slate-600 rounded text-[9px]">{tpl.defaultPose ?? '正面站姿/侧微动'}</span>
        </div>
      </td>
      <td className="p-4 font-mono text-amber-600 font-bold flex items-center gap-0.5">
        <span className="material-symbols-outlined text-xs text-amber-500">star</span>
        {tpl.avgScore?.toFixed(1) ?? '8.5'}
      </td>
      <td className="p-4 text-slate-500">{tpl.applicableTaskTypes ?? '场景融合'}</td>
      <td className="p-4">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            tpl.status === 'NORMAL'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          {tpl.status === 'NORMAL' ? '启用中' : '已停用'}
        </span>
      </td>
      <td className="p-4 font-mono font-semibold text-slate-700">{(tpl.usageCount ?? 0).toLocaleString()}</td>
    </>
  );
}

function VideoPromptRow({ tpl }: { tpl: TemplateDTO }) {
  let threeStageTitle = '【开场】正面模特静态\n【动态】自然微动转身\n【收尾】细节收尾';
  let openingText = '模特正面静立展示';
  if (tpl.videoThreePartStructure) {
    try {
      const ts = JSON.parse(tpl.videoThreePartStructure) as { opening?: string; dynamic?: string; detailEnding?: string };
      if (ts.opening) openingText = ts.opening;
      threeStageTitle = `【开场】${ts.opening ?? ''}\n【动态】${ts.dynamic ?? ''}\n【收尾】${ts.detailEnding ?? ''}`;
    } catch {
      // 忽略,保留 fallback
    }
  }
  return (
    <>
      <td className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-lg text-amber-500">movie_creation</span>
          <span className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">{tpl.templateName}</span>
        </div>
      </td>
      <td className="p-4">
        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 font-bold text-[10px]">
          {tpl.videoDefaultMotion === 'reference2video' ? 'Reference (垫图录制)' : 'Image2Video (图生视频)'}
        </span>
      </td>
      <td className="p-4 text-slate-600">
        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
          {tpl.applicableImageTypes ?? '电商主图, 场景融合首帧'}
        </span>
      </td>
      <td className="p-4 font-mono text-slate-600">
        {tpl.videoDefaultDurationSec ?? 8}秒 <span className="text-slate-300">/</span> 幅度:{' '}
        {tpl.videoDefaultMotion === 'large' ? '高' : tpl.videoDefaultMotion === 'small' ? '低' : '中'}
      </td>
      <td className="p-4">
        <div
          className="max-w-[200px] truncate bg-slate-50 p-1.5 rounded border border-slate-100 text-[10px] text-slate-500"
          title={threeStageTitle}
        >
          开场: {openingText}...
        </div>
      </td>
      <td
        className="p-4 text-rose-500 max-w-[120px] truncate font-medium"
        title={tpl.negativePrompt ?? '人体崩溃, 脸部融化, 画面强闪烁, 异常漂移'}
      >
        {tpl.negativePrompt ?? '画面闪烁/漂移变色'}
      </td>
      <td className="p-4">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            tpl.status === 'NORMAL'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          {tpl.status === 'NORMAL' ? '启用中' : '已停用'}
        </span>
      </td>
      <td className="p-4 font-mono font-semibold text-slate-700">{(tpl.usageCount ?? 0).toLocaleString()}</td>
    </>
  );
}

function PlatformSpecRow({ tpl }: { tpl: TemplateDTO }) {
  return (
    <>
      <td className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-lg text-emerald-500">grid_on</span>
          <span className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">{tpl.templateName}</span>
        </div>
      </td>
      <td className="p-4">
        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[10px]">
          图片
        </span>
      </td>
      <td className="p-4 font-bold text-slate-700 font-mono">{tpl.platformRecommendedRatio ?? '1:1'}</td>
      <td className="p-4 font-mono text-slate-600 font-bold">
        {tpl.platformWidth ?? 1024} x {tpl.platformHeight ?? 1365}
      </td>
      <td className="p-4 font-mono text-slate-500 font-semibold">{(tpl.platformUsage ?? 'JPG').toUpperCase()}</td>
      <td className="p-4 font-mono text-slate-400 font-semibold">{tpl.platformMaxFileSize ?? '10MB'}</td>
      <td className="p-4">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            tpl.platformIsDefaultRecommended !== 'N' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {tpl.platformIsDefaultRecommended !== 'N' ? '默认智能带入' : '按需手动选择'}
        </span>
      </td>
      <td className="p-4">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            tpl.status === 'NORMAL'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          {tpl.status === 'NORMAL' ? '启用中' : '已停用'}
        </span>
      </td>
    </>
  );
}

function NegativeConstraintRow({ tpl }: { tpl: TemplateDTO }) {
  return (
    <>
      <td className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-lg text-rose-500">warning</span>
          <span className="font-semibold text-slate-800 group-hover:text-rose-600 transition-colors">{tpl.templateName}</span>
        </div>
      </td>
      <td className="p-4">
        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px]">
          {tpl.ncAssetKindScope ?? '通用'}
        </span>
      </td>
      <td className="p-4 font-medium text-slate-600">商品保真</td>
      <td className="p-4">
        <span
          className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
            tpl.ncSeverity === 'P0'
              ? 'bg-rose-100 text-rose-700 border border-rose-200'
              : tpl.ncSeverity === 'P1'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {tpl.ncSeverity ?? 'P0'}
        </span>
      </td>
      <td
        className="p-4 text-rose-700 font-medium max-w-[200px] truncate"
        title="规避肢体扭曲异常,强力纠偏"
      >
        规避肢体扭曲与细节融化异常
      </td>
      <td className="p-4">
        <span className="font-bold text-slate-500">
          {tpl.ncDefaultEnabled !== 'N' ? '⚠️ 强全局启用' : '手动勾选启用'}
        </span>
      </td>
      <td className="p-4 font-mono font-bold text-indigo-600">{tpl.usageCount ?? 0} 次引用</td>
      <td className="p-4">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            tpl.status === 'NORMAL'
              ? 'bg-rose-50 text-rose-600 border border-rose-100'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          {tpl.status === 'NORMAL' ? '监控中' : '已停用'}
        </span>
      </td>
    </>
  );
}

// =====================================================================
// 抽屉(内联子组件,持有 setDrawer 引用,可直接更新数据)
// =====================================================================

interface TemplateDrawerInlineProps {
  drawer: DrawerState;
  setDrawer: React.Dispatch<React.SetStateAction<DrawerState | null>>;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  imageTaskTypeOptions: DictOption[];
  styleDimensionOptions: DictOption[];
  videoModeOptions: DictOption[];
  videoDurationOptions: DictOption[];
  videoMotionOptions: DictOption[];
  platformUsageOptions: DictOption[];
  platformFormatOptions: DictOption[];
  ncAssetScopeOptions: DictOption[];
  ncSeverityOptions: DictOption[];
  ncCategoryOptions: DictOption[];
  tabToTaskType: Record<TabKey, string>;
  extractVariables: (prompt: string) => string[];
}

type VariableArrayHolder = Partial<TemplateDTO> & { _variablesArr?: string[] };

function TemplateDrawerInline(props: TemplateDrawerInlineProps) {
  const {
    drawer,
    setDrawer,
    onClose,
    onSave,
    imageTaskTypeOptions,
    styleDimensionOptions,
    videoModeOptions,
    videoDurationOptions,
    videoMotionOptions,
    platformUsageOptions,
    platformFormatOptions,
    ncAssetScopeOptions,
    ncSeverityOptions,
    ncCategoryOptions,
    tabToTaskType,
    extractVariables,
  } = props;

  const d = drawer.data as VariableArrayHolder;
  const variablesArr: string[] = d._variablesArr ?? [];

  const update = (patch: Partial<TemplateDTO>) => {
    setDrawer({ ...drawer, data: { ...drawer.data, ...patch } });
  };

  const updateVariableArr = (arr: string[]) => {
    setDrawer({
      ...drawer,
      data: { ...drawer.data, _variablesArr: arr } as VariableArrayHolder,
    });
  };

  // 切换 tab 时同步 applicableTaskTypes
  const onTabChange = (newTab: TabKey) => {
    update({
      templateKind: TAB_TO_KIND[newTab],
      applicableTaskTypes: tabToTaskType[newTab],
    });
    setDrawer({ ...drawer, tab: newTab, data: { ...drawer.data, templateKind: TAB_TO_KIND[newTab], applicableTaskTypes: tabToTaskType[newTab] } });
    toast.info(`已按最新 PRD 初始化任务类型为「${tabToTaskType[newTab]}」！`);
  };

  // threeStageStructure JSON 编解码
  const parseThreeStage = (json: string | undefined): { opening: string; dynamic: string; detailEnding: string } => {
    if (!json) return { opening: '', dynamic: '', detailEnding: '' };
    try {
      const ts = JSON.parse(json) as { opening?: string; dynamic?: string; detailEnding?: string };
      return {
        opening: ts.opening ?? '',
        dynamic: ts.dynamic ?? '',
        detailEnding: ts.detailEnding ?? '',
      };
    } catch {
      return { opening: '', dynamic: '', detailEnding: '' };
    }
  };

  const setThreeStage = (patch: Partial<{ opening: string; dynamic: string; detailEnding: string }>) => {
    const current = parseThreeStage(d.videoThreePartStructure);
    const next = { ...current, ...patch };
    update({ videoThreePartStructure: JSON.stringify(next) });
  };

  const handleCopyPromptBody = async () => {
    try {
      await navigator.clipboard.writeText(d.promptBody ?? '');
      toast.success('复制提示词成功！');
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity" />
      <div className="fixed top-0 right-0 w-full max-w-[600px] h-screen bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col animate-slideInRight">
        <form onSubmit={onSave} className="h-full flex flex-col">
          {/* 抽屉头 */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-blue-600/10 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">
                  {drawer.mode === 'create' ? 'add_circle' : 'architecture'}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">
                  {drawer.mode === 'create' ? '创建全新模板' : `编辑模板: ${d.templateName ?? ''}`}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {drawer.mode === 'create' ? '版本 v1.0.0 自动生成' : `模板唯一标识: ${d.id ?? ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyPromptBody}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="复制提示词"
              >
                <span className="material-symbols-outlined text-sm font-bold">content_copy</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>
          </div>

          {/* 抽屉内容(可滚动) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-600">
            {/* 基本字段 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">
                  模板名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-blue-600"
                  value={d.templateName ?? ''}
                  onChange={(e) => update({ templateName: e.target.value })}
                  placeholder="例：秋季复古慵懒风温暖针织"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">适用品类</label>
                <input
                  type="text"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-blue-600"
                  value={d.applicableCategories ?? ''}
                  onChange={(e) => update({ applicableCategories: e.target.value })}
                  placeholder="如：通用 / 女装/外套"
                />
              </div>
            </div>

            {/* 模板类别 + 任务类型 + 默认风格 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">模板类别</label>
                <select
                  className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-semibold focus:bg-white focus:border-blue-600"
                  value={drawer.tab}
                  onChange={(e) => onTabChange(e.target.value as TabKey)}
                >
                  <option value="image_task">图片任务</option>
                  <option value="style_scene">风格场景</option>
                  <option value="video_prompt">视频</option>
                  <option value="platform_spec">平台规格</option>
                  <option value="negative_constraint">负面约束</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">任务类型 (已根据类别初始化)</label>
                <input
                  type="text"
                  className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-500 font-semibold cursor-not-allowed"
                  value={d.applicableTaskTypes ?? ''}
                  readOnly
                  title="任务类型根据模板分类自动进行第一性原理映射"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">默认风格</label>
                <input
                  type="text"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-blue-600"
                  value={d.defaultStyle ?? ''}
                  onChange={(e) => update({ defaultStyle: e.target.value })}
                  placeholder="简约白底"
                />
              </div>
            </div>

            {/* 子表单(按 tab 切换) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-blue-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">settings_suggest</span>
                {drawer.tab === 'image_task' && '图片任务 (Image Task) 专有配置字段'}
                {drawer.tab === 'style_scene' && '风格场景 (Style Scene) 审美微调参数'}
                {drawer.tab === 'video_prompt' && '视频 (Video Prompt) 三阶段动态编排'}
                {drawer.tab === 'platform_spec' && '平台规格 (Platform Spec) 尺寸规范参数'}
                {drawer.tab === 'negative_constraint' && '负面约束 (Negative Constraint) 避坑防御规约'}
              </h4>

              {/* 1. IMAGE_TASK */}
              {drawer.tab === 'image_task' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">图片任务类型</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600"
                        value={d.imageTaskType ?? '主图'}
                        onChange={(e) => update({ imageTaskType: e.target.value })}
                      >
                        {imageTaskTypeOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">默认模型通道</label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-medium"
                        value={d.defaultModelChannelId ?? ''}
                        onChange={(e) => update({ defaultModelChannelId: e.target.value })}
                        placeholder="如 DaVinci Core v2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">默认比例 (e.g. 3:4)</label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-center"
                        value={d.defaultRatio ?? '3:4'}
                        onChange={(e) => update({ defaultRatio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">默认生图张数</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 text-center"
                        value={d.defaultCount ?? 4}
                        onChange={(e) => update({ defaultCount: toNumLocal(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">发布状态</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-semibold"
                        value={d.status ?? 'NORMAL'}
                        onChange={(e) => update({ status: e.target.value as 'NORMAL' | 'DISABLED' })}
                      >
                        <option value="NORMAL">启用中</option>
                        <option value="DISABLED">已停用</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">可变参数变量 (以逗号分隔)</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-xs"
                      value={variablesArr.length > 0 ? variablesArr.join(', ') : '商品名, 颜色, 材质'}
                      onChange={(e) =>
                        updateVariableArr(
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        )
                      }
                      placeholder="例如: 商品主体, 背景风格, 卖点文案"
                    />
                  </div>
                </div>
              )}

              {/* 2. STYLE_SCENE */}
              {drawer.tab === 'style_scene' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">风格维度划分</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-semibold"
                        value={d.defaultScene ? '场景' : '风格'}
                        onChange={(e) => update({ defaultStyle: e.target.value })}
                      >
                        {styleDimensionOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">推荐调优模型通道</label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-medium"
                        value={d.defaultModelChannelId ?? ''}
                        onChange={(e) => update({ defaultModelChannelId: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">审美期望分 (0-10)</label>
                      <input
                        type="number"
                        step={0.1}
                        max={10}
                        min={1}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-center font-bold"
                        value={d.avgScore ?? 8.5}
                        onChange={(e) => update({ avgScore: Number(e.target.value) || 8.5 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">画布输出比例</label>
                      <input
                        type="text"
                        className="mt-1 w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-center"
                        value={d.platformRecommendedRatio ?? ''}
                        onChange={(e) => update({ platformRecommendedRatio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">发布状态</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-semibold"
                        value={d.status ?? 'NORMAL'}
                        onChange={(e) => update({ status: e.target.value as 'NORMAL' | 'DISABLED' })}
                      >
                        <option value="NORMAL">启用中</option>
                        <option value="DISABLED">已停用</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">艺术风格特征标签</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-xs"
                      value={d.defaultStyle ?? '新中式、极简冷淡、复古港风'}
                      onChange={(e) => update({ defaultStyle: e.target.value })}
                      placeholder="新中式、极简冷淡、复古港风"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">物理背景场景标签</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-xs"
                      value={d.defaultScene ?? '极简白影棚、都市街区、大理石底台'}
                      onChange={(e) => update({ defaultScene: e.target.value })}
                      placeholder="极简白影棚、都市街区、大理石底台"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">模特肢体姿态标签</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-xs"
                      value={d.defaultPose ?? '正面站姿、微侧脸、手插口袋'}
                      onChange={(e) => update({ defaultPose: e.target.value })}
                      placeholder="正面站姿、微侧脸、手插口袋"
                    />
                  </div>
                </div>
              )}

              {/* 3. VIDEO_PROMPT */}
              {drawer.tab === 'video_prompt' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">视频生成模式</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-bold text-[11px]"
                        value={d.videoDefaultMotion === 'reference2video' ? 'reference2video' : 'img2video'}
                        onChange={(e) => update({ videoDefaultMotion: e.target.value })}
                      >
                        {videoModeOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">默认调用模型通道</label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-medium"
                        value={d.defaultModelChannelId ?? ''}
                        onChange={(e) => update({ defaultModelChannelId: e.target.value })}
                        placeholder="Sora Fast Video Engine"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">默认时长参数</label>
                      <select
                        className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600"
                        value={String(d.videoDefaultDurationSec ?? 8)}
                        onChange={(e) => update({ videoDefaultDurationSec: Number(e.target.value) })}
                      >
                        {videoDurationOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">运动幅度限制</label>
                      <select
                        className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600"
                        value={d.videoDefaultMotion && ['small', 'medium', 'large'].includes(d.videoDefaultMotion) ? d.videoDefaultMotion : 'medium'}
                        onChange={(e) => update({ videoDefaultMotion: e.target.value })}
                      >
                        {videoMotionOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">状态</label>
                      <select
                        className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-semibold"
                        value={d.status ?? 'NORMAL'}
                        onChange={(e) => update({ status: e.target.value as 'NORMAL' | 'DISABLED' })}
                      >
                        <option value="NORMAL">启用中</option>
                        <option value="DISABLED">已停用</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">推荐适用首帧类型 (逗号分隔)</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 text-xs"
                      value={d.applicableImageTypes ?? '电商商品主图, 细节白底图'}
                      onChange={(e) => update({ applicableImageTypes: e.target.value })}
                      placeholder="电商商品主图, 细节白底图"
                    />
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg space-y-2 border border-slate-200">
                    <span className="font-bold text-[10px] text-slate-500 uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-amber-500">splitscreen</span>
                      三段结构细化规则建议 (Three Stage Directive)
                    </span>
                    <div className="space-y-2 text-[11px]">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600 block">① 开场画面主体设定 (Opening Stage)</label>
                        <input
                          type="text"
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded outline-none text-slate-800 text-[11px]"
                          value={parseThreeStage(d.videoThreePartStructure).opening}
                          onChange={(e) => setThreeStage({ opening: e.target.value })}
                          placeholder="例如：第一阶段开场模特身着毛衣正面,静立光影正常"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600 block">② 动态镜头或姿体展示 (Dynamic Stage)</label>
                        <input
                          type="text"
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded outline-none text-slate-800 text-[11px]"
                          value={parseThreeStage(d.videoThreePartStructure).dynamic}
                          onChange={(e) => setThreeStage({ dynamic: e.target.value })}
                          placeholder="例如：第二阶段模特慢动作半转身,毛衣面料产生轻微晃动"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600 block">③ 特写或细节镜头收束 (Ending Stage)</label>
                        <input
                          type="text"
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded outline-none text-slate-800 text-[11px]"
                          value={parseThreeStage(d.videoThreePartStructure).detailEnding}
                          onChange={(e) => setThreeStage({ detailEnding: e.target.value })}
                          placeholder="例如：第三阶段微距镜头缓慢推向领口,展示精致针织走线细节"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. PLATFORM_SPEC */}
              {drawer.tab === 'platform_spec' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">输出场景用途</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600"
                        value={d.platformUsage ?? '商品主图'}
                        onChange={(e) => update({ platformUsage: e.target.value })}
                      >
                        {platformUsageOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">对应素材物理类型</label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600"
                        value="图片"
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">输出画布分辨率宽度 (px)</label>
                      <input
                        type="number"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-center font-bold"
                        value={d.platformWidth ?? 1024}
                        onChange={(e) => update({ platformWidth: Number(e.target.value) || 1024 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">输出画布分辨率高度 (px)</label>
                      <input
                        type="number"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-center font-bold"
                        value={d.platformHeight ?? 1024}
                        onChange={(e) => update({ platformHeight: Number(e.target.value) || 1024 })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">强制文件格式</label>
                      <select
                        className="w-full h-9 px-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-xs"
                        value={(d.platformUsage ?? 'jpg').toLowerCase()}
                        onChange={(e) => update({ platformUsage: e.target.value })}
                      >
                        {platformFormatOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.value.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">最大体积大小限制</label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-mono text-center"
                        value={d.platformMaxFileSize ?? '5MB'}
                        onChange={(e) => update({ platformMaxFileSize: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">推荐画幅比例 (e.g. 1:1)</label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 text-center font-mono font-bold"
                        value={d.platformRecommendedRatio ?? '1:1'}
                        onChange={(e) => update({ platformRecommendedRatio: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      id="platformIsDefaultRecommended"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 w-4 h-4 cursor-pointer"
                      checked={d.platformIsDefaultRecommended !== 'N'}
                      onChange={(e) => update({ platformIsDefaultRecommended: e.target.checked ? 'Y' : 'N' })}
                    />
                    <label
                      htmlFor="platformIsDefaultRecommended"
                      className="font-bold text-slate-700 cursor-pointer select-none"
                    >
                      设为新任务默认推荐带入的画布规格模板
                    </label>
                  </div>
                </div>
              )}

              {/* 5. NEGATIVE_CONSTRAINT */}
              {drawer.tab === 'negative_constraint' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">适用素材范围</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600"
                        value={d.ncAssetKindScope ?? '通用'}
                        onChange={(e) => update({ ncAssetKindScope: e.target.value })}
                      >
                        {ncAssetScopeOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">规约严重级别</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-bold text-rose-600"
                        value={d.ncSeverity ?? 'P0'}
                        onChange={(e) => update({ ncSeverity: e.target.value })}
                      >
                        {ncSeverityOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">约束分类</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-medium"
                        value="商品保真"
                        readOnly
                      >
                        {ncCategoryOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">发布状态</label>
                      <select
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 font-semibold"
                        value={d.status ?? 'NORMAL'}
                        onChange={(e) => update({ status: e.target.value as 'NORMAL' | 'DISABLED' })}
                      >
                        <option value="NORMAL">运行中 (监控守卫)</option>
                        <option value="DISABLED">已停用</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">负面约束规则 (JSON 字符串,后台解析)</label>
                    <textarea
                      rows={3}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-blue-600 text-xs font-mono"
                      value={d.ncConflictRules ?? ''}
                      onChange={(e) => update({ ncConflictRules: e.target.value })}
                      placeholder="例如：人体关节畸变、面部崩塌、画面闪烁等"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      id="ncDefaultEnabled"
                      className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                      checked={d.ncDefaultEnabled !== 'N'}
                      onChange={(e) => update({ ncDefaultEnabled: e.target.checked ? 'Y' : 'N' })}
                    />
                    <label
                      htmlFor="ncDefaultEnabled"
                      className="font-bold text-slate-700 cursor-pointer select-none text-rose-700 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">gavel</span>
                      强力开启全局自动强绑定 (默认向该素材任务底层注入此负面词)
                    </label>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Prompt 正文 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-600">text_fields</span>
                  Prompt 正文指令
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const enhanced = (d.promptBody ?? '') + ', studio lighting, extremely detailed, octane render, 8k resolution';
                    update({ promptBody: enhanced });
                    toast.success('已通过 AI 加持画面精细度！');
                  }}
                  className="text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer text-[10px]"
                >
                  <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                  AI 智能优化
                </button>
              </div>
              <div className="relative rounded-xl border border-slate-200 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10 bg-slate-50 overflow-hidden">
                <div className="bg-slate-100/80 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update({ promptBody: (d.promptBody ?? '') + ' {{product_feature}}' })}
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-50 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">data_object</span>
                    插入自定义变量
                  </button>
                </div>
                <textarea
                  className="w-full h-36 p-3 bg-white border-none focus:ring-0 resize-none font-mono leading-relaxed text-slate-800 text-xs"
                  value={d.promptBody ?? ''}
                  onChange={(e) => update({ promptBody: e.target.value })}
                  placeholder="输入 prompt 模板内容,例如：A professional photo of {{product_name}}, on top of {{platform}}, soft focus..."
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400">
                使用双大括号包裹的{' '}
                <code className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded">{'{{变量名}}'}</code>{' '}
                将会被识别为任务表单的可变填充字段。
              </p>
            </div>

            {/* 检测到的变量 */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-indigo-500">data_object</span>
                检测到的提示词变量 ({extractVariables(d.promptBody ?? '').length}个)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {extractVariables(d.promptBody ?? '').length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic">提示词中未发现变量字段</span>
                ) : (
                  extractVariables(d.promptBody ?? '').map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 font-mono text-indigo-500 text-[10px] font-bold"
                    >
                      {'{{'}
                      {v}
                      {'}}'}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Negative Prompt */}
            <div className="space-y-2">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-rose-500">block</span>
                负面约束 (Negative Prompt)
              </label>
              <textarea
                className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 resize-none font-mono leading-relaxed text-slate-700"
                value={d.negativePrompt ?? ''}
                onChange={(e) => update({ negativePrompt: e.target.value })}
                placeholder="输入需要避开的异常。例如：bad anatomy, deformed, texts, messy background"
              />
            </div>
          </div>

          {/* 抽屉脚 */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">最新版本:</span>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-mono rounded-full font-bold text-[10px]">
                {d.currentVersion ?? 'v1.0.0'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">{drawer.mode === 'create' ? 'publish' : 'save'}</span>
                {drawer.mode === 'create' ? '创建并发布' : '保存更新'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

/** 内联辅助:把 number input 的 string 转换成 number 或 undefined */
function toNumLocal(v: string): number | undefined {
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

