import React, { useEffect, useMemo, useRef } from 'react';
import { Cpu, Route } from 'lucide-react';
import { useTaskParams, type PrefillState } from './useTaskParams';
import { ParamSchemaForm } from '../common/ParamSchemaForm';
import { assembleTaskPrompt, applyAiOptimize } from './assembleTaskPrompt';
import { CompactParamPicker, type CompactParamOption } from '../common/CompactParamPicker';

export interface TaskParamsPanelProps {
  group: 'IMAGE' | 'VIDEO' | 'SOLUTION';
  prefill?: PrefillState | null;
  prefillPending?: boolean;
  unified: { productName: string; sellingPoints?: string; keyDetails?: string; constraints?: string[] };
  aspectRatio: string; count: number;
  onAspectRatioChange: (v: string) => void; onCountChange: (v: number) => void;
  prompt: string; onPromptChange: (v: string) => void;
  negativePrompt: string; onNegativePromptChange: (v: string) => void;
  onParamsChange: (p: {
    channelId: string | null;
    channelType: string | null;
    capability: string | null;
    modelId: string | null;
    schemaParams: Record<string, any>;
    selectionSource: string;
    fallbackReason: string | null;
    executionReady: boolean;
  }) => void;
  fixedChannelType?: string;
  fixedCapability?: string;
  schemaParamsPatch?: {
    revision: string;
    values: Record<string, unknown>;
  } | null;
  showAspectRatio?: boolean;
  showPromptEditor?: boolean;
  showNegativePrompt?: boolean;
  showModelSelector?: boolean;
  showCount?: boolean;
  showCapabilitySummary?: boolean;
  presentation?: 'default' | 'videoDemo';
}

const RATIOS = ['1:1', '3:4', '4:5', '9:16', '16:9'];

export const TaskParamsPanel: React.FC<TaskParamsPanelProps> = (props) => {
  const {
    group, prefill, prefillPending = false, unified,
    aspectRatio, count, onAspectRatioChange, onCountChange,
    prompt, onPromptChange, negativePrompt, onNegativePromptChange, onParamsChange,
    fixedChannelType,
    fixedCapability,
    schemaParamsPatch = null,
    showAspectRatio = true,
    showPromptEditor = true,
    showNegativePrompt = true,
    showModelSelector = true,
    showCount = true,
    showCapabilitySummary = true,
    presentation = 'default',
  } = props;

  const tp = useTaskParams(group, prefill, fixedCapability, prefillPending);
  const appliedSchemaPatchRef = useRef<string | null>(null);

  // 外部素材选择可联动能力参数；同一 revision 只应用一次，之后允许用户手工修改。
  useEffect(() => {
    if (!schemaParamsPatch || !tp.schema
      || appliedSchemaPatchRef.current === schemaParamsPatch.revision) return;
    const declaredKeys = new Set((tp.schema.fields ?? []).map((field) => field.key));
    const patchValues = Object.fromEntries(
      Object.entries(schemaParamsPatch.values)
        .filter(([key]) => declaredKeys.has(key)),
    );
    appliedSchemaPatchRef.current = schemaParamsPatch.revision;
    if (Object.keys(patchValues).length > 0) {
      tp.setSchemaParams({ ...tp.schemaParams, ...patchValues });
    }
  }, [schemaParamsPatch, tp.schema, tp.schemaParams, tp.setSchemaParams]);

  // 视频工作台使用业务模式固定供应商能力，避免页面模式与实际 capability 脱节。
  const visibleInstances = fixedChannelType
    ? tp.instances.filter((item) => item.channelType === fixedChannelType)
    : tp.instances;
  const basicSchema = useMemo(() => tp.schema ? ({
    ...tp.schema,
    fields: [...(tp.schema.fields ?? [])]
      .filter((field) => field.uiGroup !== 'ADVANCED')
      .sort((left, right) => (left.uiOrder ?? 0) - (right.uiOrder ?? 0)),
  }) : null, [tp.schema]);
  const advancedSchema = useMemo(() => tp.schema ? ({
    ...tp.schema,
    fields: [...(tp.schema.fields ?? [])]
      .filter((field) => field.uiGroup === 'ADVANCED')
      .sort((left, right) => (left.uiOrder ?? 0) - (right.uiOrder ?? 0)),
  }) : null, [tp.schema]);

  // 选择/参数变化回传页面
  useEffect(() => {
    onParamsChange({
      channelId: tp.channelId,
      channelType: tp.channelType,
      capability: tp.capability,
      modelId: tp.effectiveModelCode,
      schemaParams: tp.schemaParams,
      selectionSource: tp.selectionSource,
      fallbackReason: tp.fallbackReason,
      executionReady: !tp.initializing && !tp.unavailableReason && tp.isSupported,
    });
  }, [
    tp.channelId,
    tp.channelType,
    tp.capability,
    tp.effectiveModelCode,
    tp.schemaParams,
    tp.selectionSource,
    tp.fallbackReason,
    tp.initializing,
    tp.unavailableReason,
    tp.isSupported,
    onParamsChange,
  ]);

  // [2026-07-16 P0 修复] 用户编辑优先 —— 不再用 useEffect 自动重算 prompt
  // 修复前:用户在 Prompt 编辑器改了字,unified/schameParams 一变就被 assembleTaskPrompt 覆盖
  // 修复后:promptText 完全由用户控制(初始化一次),"按表单重算" / "AI 优化" 两个按钮显式触发
  const handleRegenerateFromForm = () => {
    onPromptChange(assembleTaskPrompt({
      productName: unified.productName,
      sellingPoints: unified.sellingPoints,
      keyDetails: unified.keyDetails,
      aspectRatio,
      schemaParams: tp.schemaParams,
      constraints: unified.constraints,
    }));
  };
  const handleAiOptimize = () => {
    onPromptChange(applyAiOptimize(prompt));
  };

  return (
    <div className={presentation === 'videoDemo' ? 'space-y-4' : 'p-5 space-y-5'}>
      {presentation === 'default' && (
        <h2 className="text-sm lg:text-base font-bold text-slate-800">任务参数</h2>
      )}

      {/* ① 三级选择器 */}
      <div className={presentation === 'videoDemo' ? 'flex flex-wrap items-start gap-3' : 'space-y-3'}>
        {tp.initializing && (
          <div className={presentation === 'videoDemo' ? 'basis-full rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700' : 'rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700'}>
            正在解析默认通道和模型…
          </div>
        )}
        {tp.fallbackReason && (
          <div className={presentation === 'videoDemo' ? 'basis-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800' : 'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800'}>
            模板原执行参数已失效,将使用默认配置,你可手动调整。
          </div>
        )}
        {tp.unavailableReason && (
          <div className={presentation === 'videoDemo' ? 'basis-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700' : 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'}>
            {tp.unavailableReason}
          </div>
        )}
        <div className={presentation === 'videoDemo' ? 'min-w-[160px] flex-1' : ''}>
          {presentation === 'videoDemo' ? (
            <CompactParamPicker
              label="模型通道"
              icon={<Route className="h-4 w-4" />}
              value={tp.channelId ?? ''}
              options={visibleInstances.map<CompactParamOption>((inst) => ({
                value: inst.id,
                label: inst.channelName,
              }))}
              disabled={tp.locked}
              placeholder="暂无可用通道"
              widthClassName="w-full"
              onChange={(next) => tp.setChannelId(next)}
            />
          ) : (
            <>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              通道实例{tp.locked && ' 🔒'}
            </label>
            <div className="flex flex-wrap gap-2">
              {visibleInstances.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  disabled={tp.locked}
                  onClick={() => tp.setChannelId(inst.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                    tp.channelId === inst.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : tp.locked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                  }`}
                >
                  {inst.channelName}
                  <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-700">{inst.channelType}</span>
                </button>
              ))}
            </div>
            </>
          )}
        </div>

        {tp.channelType && !fixedCapability && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">能力{tp.locked && ' 🔒'}</label>
            <div className="flex flex-wrap gap-2">
              {tp.capabilitiesInChannel.map((cap) => (
                <button
                  key={cap.code}
                  type="button"
                  disabled={tp.locked}
                  onClick={() => tp.setCapability(cap.code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 ${
                    tp.capability === cap.code
                      ? 'bg-blue-600 text-white border-blue-600'
                      : tp.locked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                  }`}
                >
                  {cap.label}
                  {cap.isAsync && <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700">async</span>}
                </button>
              ))}
              {tp.capabilitiesInChannel.length === 0 && (
                <div className="text-xs text-slate-400 py-1">该实例未开通该类型能力,请在系统配置 → 模型通道统管开通,或换其他实例</div>
              )}
            </div>
          </div>
        )}

        {tp.channelType && fixedCapability && showCapabilitySummary && (
          <div className={presentation === 'videoDemo' ? 'min-w-[160px] flex-1' : ''}>
            {presentation === 'videoDemo' ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 text-xs font-bold text-blue-700">
                <span className="shrink-0 whitespace-normal break-words text-[10px] font-bold text-slate-400">生成能力</span>
                <span className="min-w-0 flex-1 whitespace-normal break-words">
                  {tp.capabilitiesInChannel.find((item) => item.code === fixedCapability)?.label
                    ?? fixedCapability}
                </span>
              </div>
            ) : (
              <>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">生成能力</label>
                <div className="px-3 py-2 rounded-md border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700">
                  {tp.capabilitiesInChannel.find((item) => item.code === fixedCapability)?.label
                    ?? fixedCapability}
                </div>
              </>
            )}
          </div>
        )}

        {tp.capability && showModelSelector && (() => {
          const defaultOpt = tp.modelOptions.find((option) => option.modelCode === tp.defaultModelCode);
          const isDefaultSelected = tp.modelId === tp.defaultModelCode || tp.modelId === null;
          const modelOptionsList: CompactParamOption[] = [];
          if (defaultOpt) {
            modelOptionsList.push({ value: '', label: `默认模型 (${defaultOpt.displayName})` });
          }
          tp.modelOptions
            .filter((option) => option.modelCode !== tp.defaultModelCode)
            .forEach((option) => {
              modelOptionsList.push({ value: option.modelCode, label: option.displayName });
            });
          return (
            <div className={presentation === 'videoDemo' ? 'min-w-[160px] flex-1' : ''}>
              <CompactParamPicker
                label="模型"
                icon={<Cpu className="h-4 w-4" />}
                value={isDefaultSelected ? '' : (tp.modelId ?? '')}
                options={modelOptionsList}
                disabled={tp.locked}
                placeholder="未配置默认模型，请选择"
                widthClassName="w-full"
                onChange={(next) => tp.setModelId(next || null)}
              />
              {tp.modelOptions.length > 0 && (
                <p className="mt-1 text-[10px] text-slate-400">
                  默认值来自系统配置，也可切换为该能力目录中的其他模型。
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* ② 固定通用:比例 & 张数 */}
      <div className={showAspectRatio ? 'grid grid-cols-2 gap-4' : ''}>
        {showAspectRatio && <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">比例</label>
          <div className="flex flex-wrap gap-1.5">
            {RATIOS.map((r) => (
              <button key={r} type="button" onClick={() => onAspectRatioChange(r)}
                className={`px-2.5 py-1 text-xs rounded border ${aspectRatio === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>{r}</button>
            ))}
          </div>
        </div>}
        {showCount && <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">张数</label>
          <input type="number" min={1} max={8} value={count}
            onChange={(e) => onCountChange(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md" />
        </div>}
      </div>

      {/* ③ schema 差异区 */}
      {tp.schema && (
        <div className={presentation === 'videoDemo'
          ? '[&_.param-schema-form]:grid [&_.param-schema-form]:grid-cols-1 [&_.param-schema-form]:gap-3 sm:[&_.param-schema-form]:grid-cols-2 lg:[&_.param-schema-form]:grid-cols-3'
          : ''}>
          {/* [2026-08-15] 视频任务(videoDemo)的模型配置卡片已有标题,去掉冗余的「能力参数」分组标签 */}
          {presentation !== 'videoDemo' && (
            <label className="block text-xs font-bold text-slate-700 mb-2">能力参数</label>
          )}
          {presentation === 'videoDemo' && basicSchema ? (
            <>
              <ParamSchemaForm
                schema={basicSchema}
                value={tp.schemaParams}
                onChange={tp.setSchemaParams}
                recommendValues={tp.recommendValues}
                presentation="videoDemo"
              />
              {advancedSchema && advancedSchema.fields.length > 0 && (
                <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700">
                    高级参数
                  </summary>
                  <div className="mt-3">
                    <ParamSchemaForm
                      schema={advancedSchema}
                      value={tp.schemaParams}
                      onChange={tp.setSchemaParams}
                      recommendValues={tp.recommendValues}
                      presentation="videoDemo"
                    />
                  </div>
                </details>
              )}
            </>
          ) : (
            <ParamSchemaForm
              schema={tp.schema}
              value={tp.schemaParams}
              onChange={tp.setSchemaParams}
              recommendValues={tp.recommendValues}
            />
          )}
        </div>
      )}

      {/* ④ Prompt 编辑器 */}
      {showPromptEditor && <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-slate-700">Prompt 编辑器</label>
          <div className="flex gap-1.5">
            <button type="button" onClick={handleRegenerateFromForm}
              className="text-xs px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
              title="按当前商品信息/能力参数重算 prompt,会覆盖你编辑的内容">
              按表单重算
            </button>
            <button type="button" onClick={handleAiOptimize}
              className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
              title="对当前 prompt 包装 AI 优化(不重算)">
              AI 建议
            </button>
          </div>
        </div>
        <textarea rows={5} value={prompt} onChange={(e) => onPromptChange(e.target.value)}
          placeholder="支持手写 Prompt;点击「按表单重算」会用商品信息/能力参数自动组装,「AI 建议」会对当前 prompt 包装优化"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
      </div>}

      {/* 负面词 */}
      {showNegativePrompt && <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">负面约束</label>
        <textarea rows={2} value={negativePrompt} onChange={(e) => onNegativePromptChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
      </div>}
    </div>
  );
};
