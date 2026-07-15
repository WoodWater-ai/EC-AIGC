/**
 * 推荐参数管理-新 · Dark Launch 版本
 *
 * [v2.0 2026-07-13 F3]
 * 改造点:
 *   D8 独立编辑页(全量 / 按能力 / 按模型 / 空白清单 4 视图)
 *   跨模版复制 Drawer
 *   空白清单覆盖率统计
 *
 * [v2.0 2026-07-13 F4 完整 CRUD] 接入后端 4 个 CRUD 端点:
 *   - 新增:recommendParamsApi.add → POST /add
 *   - 编辑:recommendParamsApi.update → POST /update
 *   - 删除:recommendParamsApi.delete → POST /delete
 *   - 批量导入:recommendParamsApi.batchImport → POST /batch-import
 *   - 跨模版复制:recommendParamsApi.batchCopy → POST /batch-copy
 *
 * 不动原 TemplateCenter.tsx(老版本),两版并存。
 *
 * [v2.0 修订] Tailwind + lucide-react + sonner(项目 UI 库)
 */
import React, { useState } from 'react';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import { useBlankCoverage } from '../../api/hooks/useTemplateRecommend';
import {
  recommendParamsApi,
  type RecommendParamDTO,
  type RecommendParamAddRequest,
  type BlankCoverageResponse,
} from '../../api/modules/templateRecommend';
import { SlidersHorizontal, ListFilter, BarChart3, Copy, Edit, Trash2, Search, X, Plus, Info, Layers, AlertTriangle, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

type ViewMode = 'byTemplate' | 'byCapability' | 'byModel' | 'blank';

// [F3 mock] 后端 F4 上线前用 mock 数据
const MOCK_PARAMS: RecommendParamDTO[] = [
  { id: '101', templateId: '42', templateName: '夏季女装电商成片', templateVersionId: '7', channelType: 'VIDU', capabilityCode: 'SOLUTION_AD_FILM', model: 'viduq3-turbo', paramsKey: 'prompt', paramsJson: '"展示夏季新品,模特在纯白背景下 360° 展示产品细节..."', sort: 1, createTime: '2026-07-12 10:00', updateTime: '2026-07-12 10:00' },
  { id: '102', templateId: '42', templateName: '夏季女装电商成片', templateVersionId: '7', channelType: 'VIDU', capabilityCode: 'SOLUTION_AD_FILM', model: null, paramsKey: 'aspect_ratio', paramsJson: '"9:16"', sort: 2, createTime: '2026-07-12 10:00', updateTime: '2026-07-12 10:00' },
  { id: '103', templateId: '43', templateName: '春季美妆电商成片', templateVersionId: '2', channelType: 'VIDU', capabilityCode: 'SOLUTION_GENERAL_FILM', model: 'viduq2', paramsKey: 'scene_style', paramsJson: '"清新自然 · 春日光影"', sort: 1, createTime: '2026-07-11 15:00', updateTime: '2026-07-11 15:00' },
];

const CHANNEL_OPTIONS = ['VIDU', 'QWEN', 'DOUBAO', 'OpenAI', 'DEEPSEEK', 'AGNES_AI'];
const CAPABILITY_OPTIONS = ['CHAT', 'MAIN_IMAGE', 'IMG2VIDEO', 'TEXT2VIDEO', 'REF2VIDEO', 'SOLUTION_AD_FILM', 'SOLUTION_GENERAL_FILM'];

// [v2.0 2026-07-13 F4 完整 CRUD] AddEditDrawer 表单初值
const EMPTY_FORM: RecommendParamAddRequest = {
  templateId: '',
  versionId: '1',
  channelType: 'VIDU',
  capability: 'SOLUTION_AD_FILM',
  model: '',
  paramsKey: 'prompt',
  paramsJson: '{}',
  sort: 1,
};

export const RecommendParamsManageNew: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('byTemplate');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState<RecommendParamDTO | null>(null);
  const [editingForm, setEditingForm] = useState<RecommendParamAddRequest>(EMPTY_FORM);
  const [copying, setCopying] = useState<RecommendParamDTO | null>(null);
  const [copyingTargets, setCopyingTargets] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importJson, setImportJson] = useState('[\n  {\n    "templateId": "42",\n    "versionId": "1",\n    "channelType": "VIDU",\n    "capability": "MAIN_IMAGE",\n    "paramsKey": "prompt",\n    "paramsJson": "\\"\\""",\n    "sort": 1\n  }\n]');
  const [saving, setSaving] = useState(false);

  // [F3 mock] 后端 F4 上线前用 mock 数据
  // [P1 2026-07-12] 用 ?? fallback 不用 ES6 解构默认值(useServiceQuery.data 初始是 null 不是 undefined)
  const listQuery = useServiceQuery<RecommendParamDTO[]>(
    () => recommendParamsApi.page({ view: viewMode }).then((r) => r.list.length > 0 ? r.list : MOCK_PARAMS),
    [viewMode],
  );
  const list = listQuery.data ?? MOCK_PARAMS;
  const loading = listQuery.loading;
  const reload = listQuery.refetch;

  // 空白覆盖率
  const coverageQuery = useBlankCoverage(undefined);
  const coverage = coverageQuery.data ?? {
    totalCombinations: 24, coveredCombinations: 17, blankCombinations: 7, coverageRate: 0.708, blanks: [],
  };

  // 客户端过滤
  const filtered = list.filter((p) => {
    if (channelFilter !== 'all' && p.channelType !== channelFilter) return false;
    if (searchTerm && !(
      p.paramsKey.includes(searchTerm) ||
      p.paramsJson?.includes(searchTerm) ||
      p.templateName?.includes(searchTerm) ||
      p.capabilityCode.includes(searchTerm)
    )) return false;
    return true;
  });

  // 统计
  const stats = {
    total: list.length,
    bound: new Set(list.map((p) => p.templateId)).size,
    blank: coverage.blankCombinations,
    coverage: Math.round((coverage.coverageRate ?? 0) * 100),
  };

  // ===== [v2.0 2026-07-13 F4 完整 CRUD] 4 个按钮的 handler =====

  // 点击"新增推荐参数" → 弹 Drawer(空表单)
  const handleOpenAdd = () => {
    setEditingForm(EMPTY_FORM);
    setEditing({ id: '', templateId: '', templateVersionId: '', channelType: '', capabilityCode: '', paramsKey: '', paramsJson: '', sort: 0, createTime: '', updateTime: '' });
  };

  // 点击"编辑" → 弹 Drawer(填充原数据)
  const handleOpenEdit = (p: RecommendParamDTO) => {
    setEditing(p);
    setEditingForm({
      templateId: p.templateId,
      versionId: p.templateVersionId,
      channelType: p.channelType,
      capability: p.capabilityCode,
      model: p.model ?? '',
      paramsKey: p.paramsKey,
      paramsJson: p.paramsJson,
      sort: p.sort,
    });
  };

  // AddEditDrawer 提交
  const handleSubmitEdit = async () => {
    // 校验
    if (!editingForm.templateId || !editingForm.versionId || !editingForm.channelType
        || !editingForm.capability || !editingForm.paramsKey || !editingForm.paramsJson) {
      toast.error('请填写完整必填项');
      return;
    }
    try {
      setSaving(true);
      if (editing && editing.id) {
        // 编辑模式
        await recommendParamsApi.update({
          recommendId: editing.id,
          paramsJson: editingForm.paramsJson,
          sort: editingForm.sort,
        });
        toast.success('编辑成功');
      } else {
        // 新增模式
        await recommendParamsApi.add(editingForm);
        toast.success('新增成功');
      }
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(`${editing?.id ? '编辑' : '新增'}失败: ${e?.message ?? '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  // 点击"删除" → 二次确认 + 调 API
  const handleDelete = async (p: RecommendParamDTO) => {
    if (!window.confirm(`确定删除推荐参数 "${p.paramsKey}" 吗?\n模板: ${p.templateName ?? p.templateId}\n该操作不可恢复。`)) {
      return;
    }
    try {
      await recommendParamsApi.delete(p.id);
      toast.success('删除成功');
      reload();
    } catch (e: any) {
      toast.error(`删除失败: ${e?.message ?? '未知错误'}`);
    }
  };

  // 批量导入
  const handleBatchImport = async () => {
    let items: RecommendParamAddRequest[];
    try {
      items = JSON.parse(importJson);
    } catch (e: any) {
      toast.error(`JSON 解析失败: ${e?.message ?? '格式错误'}`);
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      toast.error('请输入有效 JSON 数组');
      return;
    }
    try {
      setSaving(true);
      const success = await recommendParamsApi.batchImport(items);
      toast.success(`导入完成,成功 ${success}/${items.length} 条(已存在自动跳过)`);
      setImporting(false);
      reload();
    } catch (e: any) {
      toast.error(`批量导入失败: ${e?.message ?? '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  // 跨模版复制:打开 Drawer 时初始化目标勾选(从 list 抽 unique (templateId, versionId) 排除自己)
  const handleOpenCopy = (p: RecommendParamDTO) => {
    setCopying(p);
    const others = new Set<string>();
    list.forEach((x) => {
      if (x.templateId !== p.templateId) {
        others.add(x.templateId);
      }
    });
    setCopyingTargets(others);
  };

  // 跨模版复制:提交
  const handleSubmitCopy = async () => {
    if (!copying) return;
    const targets: string[] = Array.from(copyingTargets);
    if (targets.length === 0) {
      toast.warning('请至少选择 1 个目标模板');
      return;
    }
    try {
      setSaving(true);
      const success = await recommendParamsApi.batchCopy({
        sourceId: copying.id,
        targetTemplateIds: targets,
      });
      toast.success(`复制完成,成功 ${success}/${targets.length} 个模板(后端自动取最新 version,已存在跳过)`);
      setCopying(null);
      reload();
    } catch (e: any) {
      toast.error(`复制失败: ${e?.message ?? '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-slate-700" />
            推荐参数管理
            <span className="text-rose-500 text-sm font-bold">-新</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-bold tracking-wider">BETA</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            全量浏览/编辑所有 template_recommend_params · 跨模版复制 · 空白清单覆盖率
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-3 py-1.5 text-sm font-medium text-white rounded-md flex items-center gap-1.5 hover:opacity-90"
          style={{ background: '#2f6f5e' }}
        >
          <Plus className="w-4 h-4" />
          新增推荐参数
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="总推荐数" value={stats.total} icon={<Layers className="w-4 h-4" />} />
        <StatCard label="已绑定模版" value={stats.bound} icon={<BookOpen className="w-4 h-4" />} />
        <StatCard
          label="空白组合"
          value={stats.blank}
          icon={<AlertTriangle className="w-4 h-4" />}
          color={stats.blank > 0 ? 'text-amber-600' : 'text-emerald-600'}
          sub={stats.blank > 0 ? '未配置推荐' : '已全部覆盖'}
        />
        <StatCard
          label="覆盖能力"
          value={`${stats.coverage}%`}
          icon={<BarChart3 className="w-4 h-4" />}
          color={stats.coverage >= 80 ? 'text-emerald-600' : stats.coverage >= 50 ? 'text-amber-600' : 'text-rose-600'}
        />
      </div>

      {/* 视图切换 + 筛选 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center border-b border-slate-200 -mx-4 -mt-4 px-4 pt-2">
          {([
            ['byTemplate', '按模版'],
            ['byCapability', '按能力'],
            ['byModel', '按模型'],
            ['blank', '空白清单'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setViewMode(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                viewMode === k
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索 key / 模版 / 能力"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
          >
            <option value="all">全部通道</option>
            {CHANNEL_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
          >
            <ListFilter className="w-4 h-4" />
            批量导入
          </button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          加载中…
        </div>
      ) : viewMode === 'blank' ? (
        <BlankListView blanks={coverage.blanks} />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl text-center py-16 text-slate-400">
          <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>当前视图无数据</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">key</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">绑定模版</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">能力</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">通道</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">模型</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm font-semibold text-slate-800">{p.paramsKey}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-md">
                      {p.paramsJson.length > 50 ? p.paramsJson.slice(0, 50) + '…' : p.paramsJson}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold">{p.templateName ?? `T-${p.templateId}`}</div>
                    <div className="text-[10px] text-slate-400 font-mono">V{p.templateVersionId}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{p.capabilityCode}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.channelType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.model ?? '任意'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCopy(p)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                        title="复制到其他模版"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AddEditDrawer 新增/编辑通用 */}
      {editing && (
        <SimpleDrawer
          title={editing.id ? `编辑推荐参数 (id=${editing.id})` : '新增推荐参数'}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-3">
            <div className="text-xs text-slate-500 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>
                {editing.id
                  ? '编辑模式:仅可改 paramsJson 和 sort。改 channelType/capability 请先删除再新增。'
                  : '新增模式:填好完整字段,UNIQUE KEY 冲突会报错。'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="模板 ID *"
                value={editingForm.templateId}
                onChange={(v) => setEditingForm({ ...editingForm, templateId: v })}
                disabled={!!editing.id}
              />
              <Field
                label="版本 ID *"
                value={editingForm.versionId}
                onChange={(v) => setEditingForm({ ...editingForm, versionId: v })}
                disabled={!!editing.id}
              />
              <SelectField
                label="通道 *"
                value={editingForm.channelType}
                onChange={(v) => setEditingForm({ ...editingForm, channelType: v })}
                options={CHANNEL_OPTIONS}
                disabled={!!editing.id}
              />
              <SelectField
                label="能力 *"
                value={editingForm.capability}
                onChange={(v) => setEditingForm({ ...editingForm, capability: v })}
                options={CAPABILITY_OPTIONS}
                disabled={!!editing.id}
              />
              <Field
                label="模型(可空=任意)"
                value={editingForm.model ?? ''}
                onChange={(v) => setEditingForm({ ...editingForm, model: v })}
                disabled={!!editing.id}
              />
              <Field
                label="paramsKey *"
                value={editingForm.paramsKey}
                onChange={(v) => setEditingForm({ ...editingForm, paramsKey: v })}
                disabled={!!editing.id}
              />
            </div>
            <Field
              label="paramsJson * (JSON 字符串)"
              value={editingForm.paramsJson}
              onChange={(v) => setEditingForm({ ...editingForm, paramsJson: v })}
              multiline
            />
            <Field
              label="sort"
              type="number"
              value={String(editingForm.sort)}
              onChange={(v) => setEditingForm({ ...editingForm, sort: Number(v) || 0 })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmitEdit}
                className="px-3 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                style={{ background: '#2f6f5e' }}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing.id ? '保存' : '新增')}
              </button>
            </div>
          </div>
        </SimpleDrawer>
      )}

      {/* CopyDrawer 跨模版复制 */}
      {copying && (
        <SimpleDrawer title="跨模版复制" onClose={() => setCopying(null)}>
          <div className="space-y-3">
            <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
              <span>后端自动取每个目标模板的最新 version.id,UNIQUE 冲突静默跳过(已存在不会覆盖)。</span>
            </div>
            <div className="bg-slate-50 p-3 rounded space-y-1">
              <div className="text-[10px] text-slate-500 uppercase">源推荐</div>
              <div className="font-mono text-sm">{copying.paramsKey} = {copying.paramsJson}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                源模板: {copying.templateName ?? `T-${copying.templateId}`} (V{copying.templateVersionId})
                · {copying.channelType} · {copying.capabilityCode}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-500 uppercase">目标模板(可多选,已排除源模板)</div>
              {Array.from(new Set(list.filter((x) => x.templateId !== copying.templateId).map((x) => x.templateId)))
                .sort()
                .map((tid) => {
                  const checked = copyingTargets.has(tid);
                  const sample = list.find((x) => x.templateId === tid);
                  return (
                    <label key={tid} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(copyingTargets);
                          if (e.target.checked) next.add(tid);
                          else next.delete(tid);
                          setCopyingTargets(next);
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm flex-1 font-medium">{sample?.templateName ?? `T-${tid}`}</span>
                      <span className="text-[10px] text-slate-400 font-mono">T-{tid}</span>
                    </label>
                  );
                })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCopying(null)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmitCopy}
                className="px-3 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                style={{ background: '#2f6f5e' }}
                disabled={saving || copyingTargets.size === 0}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `复制到 ${copyingTargets.size} 个模版`}
              </button>
            </div>
          </div>
        </SimpleDrawer>
      )}

      {/* ImportDrawer 批量导入 */}
      {importing && (
        <SimpleDrawer title="批量导入推荐参数" onClose={() => setImporting(false)}>
          <div className="space-y-3">
            <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
              <span>粘贴 JSON 数组,每项是 RecommendParamAddRequest(无 id,无 createTime)。已存在(UNIQUE 冲突)自动跳过。</span>
            </div>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={16}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              spellCheck={false}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImporting(false)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBatchImport}
                className="px-3 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                style={{ background: '#2f6f5e' }}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '执行导入'}
              </button>
            </div>
          </div>
        </SimpleDrawer>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  label: string; value: number | string; icon: React.ReactNode; color?: string; sub?: string;
}> = ({ label, value, icon, color = 'text-slate-700', sub }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={color}>{icon}</span>
    </div>
    <div className={`text-2xl font-bold mt-2 ${color}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
  </div>
);

const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  type?: 'text' | 'number'; disabled?: boolean; multiline?: boolean;
}> = ({ label, value, onChange, type = 'text', disabled, multiline }) => (
  <div>
    <label className="block text-[10px] text-slate-500 uppercase mb-1">{label}</label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        disabled={disabled}
        className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
        spellCheck={false}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
      />
    )}
  </div>
);

const SelectField: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; disabled?: boolean;
}> = ({ label, value, onChange, options, disabled }) => (
  <div>
    <label className="block text-[10px] text-slate-500 uppercase mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white disabled:bg-slate-100 disabled:text-slate-500"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const BlankListView: React.FC<{ blanks: BlankCoverageResponse['blanks'] }> = ({ blanks }) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-1.5">
      <AlertTriangle className="w-4 h-4" />
      <span>以下 channel × capability × model 组合还没推荐参数,建议补全</span>
    </div>
    {blanks.length === 0 ? (
      <div className="text-center py-12 text-slate-400 text-sm">F4 上线后展示真实空白组合</div>
    ) : (
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">通道</th>
            <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">能力</th>
            <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">模型</th>
            <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">缺失</th>
          </tr>
        </thead>
        <tbody>
          {blanks.map((b, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="px-4 py-3 font-mono text-sm">{b.channelType}</td>
              <td className="px-4 py-3 font-mono text-sm text-indigo-700">{b.capabilityCode}</td>
              <td className="px-4 py-3 font-mono text-sm">{b.model}</td>
              <td className="px-4 py-3 text-right text-amber-600 text-sm">{b.missingCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const SimpleDrawer: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
    <div className="fixed top-0 right-0 bottom-0 w-[520px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  </>
);
