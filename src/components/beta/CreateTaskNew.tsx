/**
 * @deprecated 2026-07-13 — 逻辑已吸收进 CreateImageTask/CreateVideoTask 右列(TaskParamsPanel)。
 * 保留以便对照;新功能勿在此扩展。待确认无引用后删除。
 */
/**
 * 新建任务-新 · Dark Launch 版本
 *
 * [v2.0 2026-07-13 F2]
 * 设计:
 *   5 步:Step 0 模版条(可选)+ Step 1 选 Channel + Step 2 选 Capability + Step 3 动态表单 + Step 4 视频字段
 *   group 由 URL 或模版预填决定(去 TEXT · D1)
 *   模版预填:sessionStorage.beta.template.prefill(由 TemplateCenterNew 写入)
 *   提交调 POST /v1/task/submit
 *
 * 不动原 CreateImageTask / CreateVideoTask(老版本),两版并存。
 *
 * [v2.0 修订] 移除 antd,改用 Tailwind + lucide-react + sonner(项目 UI 库)
 */
import React, { useState, useMemo, useEffect } from 'react';
import { AppScreen } from '../../types';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import { useTemplateRecommend } from '../../api/hooks/useTemplateRecommend';
import {
  fetchCapabilityMatrix,
  fetchCapabilitySchema,
  type MatrixResponse,
  type CapabilityDefinition,
} from '../../api/modules/capability';
import { Loader2, Rocket, X, Info, Zap, Check, ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CreateTaskNewProps {
  /** 用于跳转到 AI 帮我写 prompt-新 */
  setScreen: (screen: AppScreen) => void;
}

/** sessionStorage 双向传值 key(AI 帮我写 prompt-新) */
const PROMPT_ASSIST_DRAFT_KEY = 'beta.promptAssist.draft';
const PROMPT_ASSIST_RESULT_KEY = 'beta.promptAssist.result';

type Group = 'IMAGE' | 'VIDEO' | 'SOLUTION';
type PrefillState = {
  templateId: string;
  templateVersionId: string;
  group: Group;
  channelType: string | null;
  capability: string | null;
  model: string | null;
};

export const CreateTaskNew: React.FC<CreateTaskNewProps> = ({ setScreen }) => {
  const [prefill, setPrefill] = useState<PrefillState | null>(() => {
    try {
      const raw = sessionStorage.getItem('beta.template.prefill');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [channelType, setChannelType] = useState<string | null>(prefill?.channelType ?? null);
  const [capability, setCapability] = useState<string | null>(prefill?.capability ?? null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [duration, setDuration] = useState<number>(15);
  const [motion, setMotion] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');
  const [resolution, setResolution] = useState<'720P' | '1080P'>('1080P');
  const [sourceImages, setSourceImages] = useState<string>('');

  const { data: matrix, loading: matrixLoading } = useServiceQuery<MatrixResponse>(
    () => fetchCapabilityMatrix(),
    [],
  );

  const group: Group = useMemo(() => {
    if (prefill) return prefill.group;
    if (capability?.startsWith('SOLUTION_')) return 'SOLUTION';
    if (matrix && capability) {
      for (const ch of matrix.channels) {
        for (const cap of ch.capabilities) {
          if (cap.code === capability) return cap.group as Group;
        }
      }
    }
    return 'IMAGE';
  }, [prefill, capability, matrix]);

  const channelsInGroup = useMemo(() => {
    if (!matrix) return [];
    return matrix.channels.filter((ch) =>
      ch.capabilities.some((c) => c.group === group),
    );
  }, [matrix, group]);

  const capabilitiesInChannel = useMemo(() => {
    if (!matrix || !channelType) return [];
    const ch = matrix.channels.find((c) => c.channelType === channelType);
    return ch?.capabilities.filter((c) => c.group === group) ?? [];
  }, [matrix, channelType, group]);

  const { data: schema, loading: schemaLoading } = useServiceQuery<CapabilityDefinition>(
    () => (channelType && capability
      ? fetchCapabilitySchema(channelType, capability)
      : Promise.resolve(null as any)),
    [channelType, capability],
  );

  const { data: recommendList } = useTemplateRecommend(
    prefill?.templateId, prefill?.templateVersionId, channelType, capability,
  );

  useEffect(() => {
    if (!prefill || !recommendList || recommendList.length === 0) return;
    const next: Record<string, any> = {};
    for (const rec of recommendList) {
      try {
        next[rec.paramsKey] = JSON.parse(rec.paramsJson);
      } catch {
        next[rec.paramsKey] = rec.paramsJson;
      }
    }
    setParams(next);
  }, [recommendList, prefill]);

  // [v2.0 2026-07-13 F3 集成] 从 AI 帮我写 prompt-新 回填结果
  useEffect(() => {
    const result = sessionStorage.getItem(PROMPT_ASSIST_RESULT_KEY);
    if (result) {
      setParams((p) => ({ ...p, prompt: result }));
      sessionStorage.removeItem(PROMPT_ASSIST_RESULT_KEY);
      toast.success('AI 建议已应用到 prompt 字段');
    }
  }, []);

  const removeTemplate = () => {
    sessionStorage.removeItem('beta.template.prefill');
    setPrefill(null);
    setParams({});
  };

  const submit = () => {
    if (!channelType || !capability) {
      toast.error('请先选 Channel 和 Capability');
      return;
    }
    const sourceList = sourceImages.split(',').map((s) => s.trim()).filter(Boolean);
    if (sourceList.length === 0 && (group === 'VIDEO' || group === 'SOLUTION')) {
      toast.error('视频/解决方案任务请至少上传 1 张源图');
      return;
    }
    const payload = {
      channelType, capability, params, group, duration, motion, resolution,
      sourceImages: sourceList,
      templateId: prefill?.templateId, templateVersionId: prefill?.templateVersionId,
    };
    console.log('[CreateTaskNew] 提交参数(后端 F4 上线后走真实 POST /v1/task/submit):', payload);
    toast.success('任务已提交(mock,F2 阶段后端 F4 联调后走真实接口)');
  };

  // [v2.0 2026-07-13 F3 集成] AI 帮我写 prompt-新 跳转
  const openPromptAssist = () => {
    sessionStorage.setItem(PROMPT_ASSIST_DRAFT_KEY, String(params.prompt ?? ''));
    setScreen(AppScreen.PROMPT_ASSIST_NEW);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            新建任务
            <span className="text-rose-500 text-sm font-bold">-新</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-bold tracking-wider">BETA</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-mono">{group}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            统一 CreateTask · 3 group(去 TEXT)· 模版预填 · 能力驱动 · Step 4 视频字段条件渲染
          </p>
        </div>

        {/* Step 0 模版条 */}
        {prefill && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <Rocket className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-800">已应用模版 #{prefill.templateId} (V{prefill.templateVersionId})</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {recommendList?.length ?? 0} 个推荐参数已预填 · Channel/Capability 锁住,可点 ✕ 放弃预填
              </div>
            </div>
            <button
              type="button"
              onClick={removeTemplate}
              className="px-2.5 py-1 text-xs text-rose-600 border border-rose-200 rounded hover:bg-rose-50 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              移除模版
            </button>
          </div>
        )}

        {/* Step 1 选 Channel */}
        <SectionCard step={1} title="选 Channel" tip={`按 group=${group} 过滤 · ${prefill ? '🔒 模版锁定' : '可自由切换'}`}>
          {matrixLoading ? (
            <div className="flex items-center text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />加载中…
            </div>
          ) : channelsInGroup.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <Info className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-sm">该 group 无可用 Channel</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {channelsInGroup.map((ch) => {
                const supported = ch.capabilities.filter((c) => c.group === group).length;
                const active = channelType === ch.channelType;
                return (
                  <button
                    key={ch.channelType}
                    type="button"
                    onClick={() => !prefill && setChannelType(ch.channelType)}
                    disabled={!!prefill}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : prefill
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                    }`}
                  >
                    {ch.channelType}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {supported} cap
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Step 2 选 Capability */}
        {channelType && (
          <SectionCard step={2} title="选 Capability" tip={`Channel × ${group} 二次过滤`}>
            {capabilitiesInChannel.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Info className="w-8 h-8 mx-auto mb-1 opacity-30" />
                <p className="text-sm">该 Channel 在当前 group 下无 Capability</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {capabilitiesInChannel.map((cap) => {
                  const active = capability === cap.code;
                  return (
                    <button
                      key={cap.code}
                      type="button"
                      onClick={() => !prefill && setCapability(cap.code)}
                      disabled={!!prefill}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : prefill
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                      }`}
                    >
                      {cap.label}
                      <span className="text-[10px] font-mono opacity-70">{cap.code}</span>
                      {cap.isAsync && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">async</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        {/* Step 3 动态表单 */}
        {capability && (
          <SectionCard step={3} title="动态表单" tip="按 schema 渲染 · 推荐值蓝底灰显">
            {schemaLoading ? (
              <div className="flex items-center text-slate-400 py-4">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />加载 schema…
              </div>
            ) : schema ? (
              <>
                {/* [v2.0 2026-07-13 F3 集成] AI 帮我写 prompt 按钮(schema 有 prompt 字段时显示) */}
                {(schema.fields ?? []).some((f) => f.key === 'prompt') && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
                    <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <div className="flex-1 text-xs text-slate-600">
                      当前 prompt 字段为空或想优化?用 AI 生成参考建议
                    </div>
                    <button
                      type="button"
                      onClick={openPromptAssist}
                      className="px-2.5 py-1 text-xs font-medium text-white rounded-md flex items-center gap-1 hover:opacity-90"
                      style={{ background: '#6366f1' }}
                    >
                      <Sparkles className="w-3 h-3" />
                      AI 帮我写
                    </button>
                  </div>
                )}
                <SchemaForm
                  schema={schema}
                  value={params}
                  onChange={setParams}
                  recommendValues={Object.fromEntries(
                    (recommendList ?? []).map((r) => [r.paramsKey, tryParse(r.paramsJson)]),
                  )}
                />
              </>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <Info className="w-8 h-8 mx-auto mb-1 opacity-30" />
                <p className="text-sm">schema 加载失败</p>
              </div>
            )}
          </SectionCard>
        )}

        {/* Step 4 视频字段(条件渲染) */}
        {capability && (group === 'VIDEO' || group === 'SOLUTION') && (
          <SectionCard step={4} title="视频字段" tip="条件渲染 · 仅当 group=VIDEO/SOLUTION">
            <div className="space-y-3">
              <FieldRow label="源图 URLs(逗号分隔,Vidu SOLUTION 必填 1~7 张)">
                <textarea
                  rows={2}
                  value={sourceImages}
                  placeholder="https://..., https://..."
                  onChange={(e) => setSourceImages(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <div className="text-xs text-slate-500 mt-1">
                  当前 {sourceImages.split(',').map((s) => s.trim()).filter(Boolean).length} 张
                </div>
              </FieldRow>
              <div className="grid grid-cols-3 gap-3">
                <FieldRow label="时长 (秒)">
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
                  >
                    {[5, 8, 15, 30].map((s) => (
                      <option key={s} value={s}>{s}s</option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="运动幅度">
                  <select
                    value={motion}
                    onChange={(e) => setMotion(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
                  >
                    <option value="SMALL">SMALL</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LARGE">LARGE</option>
                  </select>
                </FieldRow>
                <FieldRow label="分辨率">
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
                  >
                    <option value="720P">720P</option>
                    <option value="1080P">1080P</option>
                  </select>
                </FieldRow>
              </div>
            </div>
          </SectionCard>
        )}

        {/* 提交 */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => sessionStorage.removeItem('beta.template.prefill')}
            className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!channelType || !capability}
            className="px-5 py-2 text-sm font-medium text-white rounded-md flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#6366f1' }}
          >
            <Zap className="w-4 h-4" />
            提交任务
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== 辅助组件 =====

const SectionCard: React.FC<{
  step: number; title: string; tip?: string; children: React.ReactNode;
}> = ({ step, title, tip, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-3">
      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
        {step}
      </span>
      <span className="text-sm font-semibold text-slate-800">{title}</span>
      {tip && <span className="text-xs text-slate-400 ml-2">— {tip}</span>}
    </div>
    {children}
  </div>
);

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
    {children}
  </div>
);

// 极简 SchemaForm(只支持基础类型,完整版走 ParamSchemaForm 复用)
const SchemaForm: React.FC<{
  schema: CapabilityDefinition;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  recommendValues?: Record<string, any>;
}> = ({ schema, value, onChange, recommendValues = {} }) => {
  const set = (k: string, v: any) => onChange({ ...(value || {}), [k]: v });
  return (
    <div className="space-y-3">
      {(schema.fields ?? []).map((f) => {
        const v = (value || {})[f.key];
        const isRec = recommendValues[f.key] !== undefined && recommendValues[f.key] === v;
        const commonLabel = (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-700">{f.label}</span>
            {f.required && <span className="text-rose-500 text-xs">*</span>}
            {isRec && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-0.5">
                <Check className="w-3 h-3" />推荐
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono ml-auto">{f.type}</span>
          </div>
        );
        if (f.type === 'TEXT' || f.type === 'TEXTAREA') {
          return (
            <div key={f.key}>
              {commonLabel}
              <textarea
                rows={f.type === 'TEXTAREA' ? 3 : 1}
                value={v ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                className={`w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  isRec ? 'bg-blue-50' : 'bg-white'
                }`}
              />
            </div>
          );
        }
        if (f.type === 'INT' || f.type === 'DECIMAL') {
          return (
            <div key={f.key}>
              {commonLabel}
              <input
                type="number"
                value={v ?? ''}
                onChange={(e) => set(f.key, e.target.value === '' ? null : Number(e.target.value))}
                className={`w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md ${
                  isRec ? 'bg-blue-50' : 'bg-white'
                }`}
              />
            </div>
          );
        }
        if (f.type === 'SELECT' && f.options) {
          return (
            <div key={f.key}>
              {commonLabel}
              <select
                value={v ?? ''}
                onChange={(e) => set(f.key, e.target.value || undefined)}
                className={`w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md ${
                  isRec ? 'bg-blue-50' : 'bg-white'
                }`}
              >
                <option value="">请选择 {f.label}</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          );
        }
        if (f.type === 'BOOLEAN') {
          return (
            <div key={f.key}>
              {commonLabel}
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!v}
                  onChange={(e) => set(f.key, e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="ml-2 text-sm text-slate-600">{v ? '是' : '否'}</span>
              </label>
            </div>
          );
        }
        if (f.type === 'MULTI_SELECT' && f.options) {
          return (
            <div key={f.key}>
              {commonLabel}
              <div className="flex flex-wrap gap-1.5">
                {f.options.map((opt) => {
                  const list: string[] = Array.isArray(v) ? v : [];
                  const active = list.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set(f.key, active ? list.filter((x) => x !== opt.value) : [...list, opt.value])}
                      className={`px-2.5 py-1 text-xs rounded-full border ${
                        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        // 其他类型(IMAGE_URL / IMAGES_URL / DICT / JSON)F2 用 fallback text,F3 接 ParamSchemaForm 完整版
        return (
          <div key={f.key}>
            {commonLabel}
            <input
              type="text"
              value={typeof v === 'string' ? v : JSON.stringify(v ?? '')}
              placeholder={`${f.label} (${f.type} 字段 F3 接 ParamSchemaForm 完整版)`}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            />
          </div>
        );
      })}
    </div>
  );
};

function tryParse(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}
