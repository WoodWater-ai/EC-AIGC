import React, { useEffect } from 'react';
import { useTaskParams, type PrefillState } from './useTaskParams';
import { ParamSchemaForm } from '../common/ParamSchemaForm';
import { assembleTaskPrompt, applyAiOptimize } from './assembleTaskPrompt';

export interface TaskParamsPanelProps {
  group: 'IMAGE' | 'VIDEO' | 'SOLUTION';
  prefill?: PrefillState | null;
  unified: { productName: string; sellingPoints?: string; keyDetails?: string; constraints?: string[] };
  aspectRatio: string; count: number;
  onAspectRatioChange: (v: string) => void; onCountChange: (v: number) => void;
  prompt: string; onPromptChange: (v: string) => void;
  negativePrompt: string; onNegativePromptChange: (v: string) => void;
  onParamsChange: (p: { channelId: string | null; channelType: string | null; capability: string | null; modelId: string | null; schemaParams: Record<string, any> }) => void;
}

const RATIOS = ['1:1', '3:4', '4:5', '9:16', '16:9'];

export const TaskParamsPanel: React.FC<TaskParamsPanelProps> = (props) => {
  const {
    group, prefill, unified,
    aspectRatio, count, onAspectRatioChange, onCountChange,
    prompt, onPromptChange, negativePrompt, onNegativePromptChange, onParamsChange,
  } = props;

  const tp = useTaskParams(group, prefill);

  // 选择/参数变化回传页面
  useEffect(() => {
    onParamsChange({
      channelId: tp.channelId,
      channelType: tp.channelType,
      capability: tp.capability,
      modelId: tp.modelId,
      schemaParams: tp.schemaParams,
    });
  }, [tp.channelId, tp.channelType, tp.capability, tp.modelId, tp.schemaParams, onParamsChange]);

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
    <div className="p-5 space-y-5">
      <h2 className="text-sm lg:text-base font-bold text-slate-800">任务参数</h2>

      {/* ① 三级选择器 */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">通道实例{tp.locked && ' 🔒'}</label>
          <div className="flex flex-wrap gap-2">
            {tp.instances.map((inst) => (
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
        </div>

        {tp.channelType && (
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

        {tp.capability && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">模型</label>
            <select
              value={tp.modelId ?? ''}
              onChange={(e) => tp.setModelId(e.target.value || null)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            >
              <option value="">
                {tp.modelsInGroup.length > 0
                  ? `默认模型 (${tp.modelsInGroup[0].model})`
                  : '未配默认模型 (手填)'}
              </option>
              {tp.modelsInGroup.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ② 固定通用:比例 & 张数 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">比例</label>
          <div className="flex flex-wrap gap-1.5">
            {RATIOS.map((r) => (
              <button key={r} type="button" onClick={() => onAspectRatioChange(r)}
                className={`px-2.5 py-1 text-xs rounded border ${aspectRatio === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>{r}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">张数</label>
          <input type="number" min={1} max={8} value={count}
            onChange={(e) => onCountChange(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md" />
        </div>
      </div>

      {/* ③ schema 差异区 */}
      {tp.schema && (
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">能力参数</label>
          <ParamSchemaForm
            schema={tp.schema}
            value={tp.schemaParams}
            onChange={tp.setSchemaParams}
            recommendValues={tp.recommendValues}
          />
        </div>
      )}

      {/* ④ Prompt 编辑器 */}
      <div>
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
      </div>

      {/* 负面词 */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">负面约束</label>
        <textarea rows={2} value={negativePrompt} onChange={(e) => onNegativePromptChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
      </div>
    </div>
  );
};
