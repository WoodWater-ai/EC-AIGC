// src/components/CreateImageTask/right/ImageSettingsSection.tsx
// 右栏"任务参数"卡片(对齐 demo 主版):通道实例/能力/模型 3 级选择器 + 能力参数 schema 动态表单
import React, { useEffect } from 'react';
import { useTaskParams } from '../../createTask/useTaskParams';
import { ParamSchemaForm } from '../../common/ParamSchemaForm';
import { localValidate } from '../../common/ParamSchemaForm/utils/validate';
import { UnsupportedNotice } from './UnsupportedNotice';
import { messages } from '../../../labels/createImageTask';
import type { PrefillState } from '../../createTask/useTaskParams';

export interface TaskParamsSnapshot {
  channelId: string | null;
  channelType: string | null;
  capability: string | null;
  /** 历史字段名；值是供应商 modelCode，不是数据库 ID。 */
  modelId: string | null;
  /**
   * 能力参数(ParamSchemaForm 渲染 Vidu 能力 schema 收集),例如
   * { aspect_ratio: '9:16', resolution: '1080p' }。
   * 父组件把它透传给 useCreateImageTaskState,提交时合并到 taskParamsJson;
   * 不传则 hook 用 Vidu 能力 schema 的默认/推荐值兜底。
   */
  schemaParams?: Record<string, any>;
  executionParamsReady: boolean;
  selectionSource: string;
  fallbackReason: string | null;
}

/** ratio 由 useCreateImageTaskState 内部维护;本节不再展示。
 *  在 ImageTypeSelector 顶部 banner 加一句话提示"比例由图片类型决定 + 上方头部显示",
 *  让用户感知到 ratio 实际由 schema 与 image-set 联动,而不是孤立选择。
 */
export interface ImageSettingsSectionProps {
  /** 已废弃:由 useTaskParams.isSupported 真实判定(基于 Vidu 能力 schema);
   *  保留仅为不破坏调用方,实际不再使用。 */
  isSupported?: boolean;
  /** 选中状态变化时通知父组件,父组件用于 submit payload 的 channelInstanceId/modelId */
  onParamsChange?: (snapshot: TaskParamsSnapshot) => void;
  prefill?: PrefillState | null;
  prefillPending?: boolean;
}

export const ImageSettingsSection: React.FC<ImageSettingsSectionProps> = ({
  onParamsChange,
  prefill,
  prefillPending = false,
}) => {
  // 通道实例 / 能力 / 模型 三级联动 — 与 demo 创建图片任务 "任务参数"一致
  const tp = useTaskParams('IMAGE', prefill, 'REF_IMG_EDIT', prefillPending);

  // 选中状态变化时通知父组件
  useEffect(() => {
    const schemaValid = !!tp.schema
      && localValidate(tp.schemaParams, tp.schema.fields ?? []).length === 0;
    const modelSelected = !!tp.effectiveModelCode;
    onParamsChange?.({
      channelId: tp.channelId,
      channelType: tp.channelType,
      capability: tp.capability,
      // modelId 是历史内部命名，值实际为供应商 modelCode。
      modelId: tp.effectiveModelCode,
      // [2026-07-25 P0 修复] schemaParams 必须冒泡,否则 ParamSchemaForm 改的
      // aspect_ratio / resolution 等参数不会进提交 payload;
      // 之前 useCreateImageTaskState 写死 ratio='16:9' 正是因为收不到这个值。
      schemaParams: tp.schemaParams,
      selectionSource: tp.selectionSource,
      fallbackReason: tp.fallbackReason,
      executionParamsReady: !tp.initializing
        && !tp.unavailableReason
        && !!tp.channelId
        && !!tp.capability
        && modelSelected
        && schemaValid,
    });
  }, [
    tp.channelId,
    tp.channelType,
    tp.capability,
    tp.effectiveModelCode,
    tp.schema,
    tp.schemaParams,
    tp.selectionSource,
    tp.fallbackReason,
    tp.initializing,
    tp.unavailableReason,
    onParamsChange,
  ]);

  return (
    <div
      id="image-settings-section"
      className="bg-white border border-slate-200 rounded-lg p-5"
    >
      <p className="text-[11px] font-bold text-primary">执行参数</p>
      <h2 className="text-base font-black mt-1">
        {messages.header.title.replace('新建多类型图片任务', '任务参数与输出规格')}
      </h2>

      {tp.initializing && (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          正在解析默认通道和模型…
        </div>
      )}
      {tp.fallbackReason && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          模板原执行参数已失效,将使用默认配置,你可手动调整。
        </div>
      )}
      {tp.unavailableReason && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {tp.unavailableReason}
        </div>
      )}

      {/* ① 通道实例 chips(对齐 demo) */}
      <div className="mt-4">
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          通道实例{tp.locked && ' 🔒'}
        </label>
        <div className="flex flex-wrap gap-2">
          {tp.instances.filter((inst) => inst.channelType === 'VIDU').map((inst) => (
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

      {/* ② 能力 chips */}
      {tp.channelType && (
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            能力{tp.locked && ' 🔒'}
          </label>
          <div className="flex flex-wrap gap-2">
            {tp.capabilitiesInChannel.filter((cap) => cap.code === 'REF_IMG_EDIT').map((cap) => (
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
                {cap.isAsync && (
                  <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700">async</span>
                )}
              </button>
            ))}
            {tp.capabilitiesInChannel.length === 0 && (
              <div className="text-xs text-slate-400 py-1">
                该实例未开通该类型能力,请在系统配置 → 模型通道统管开通,或换其他实例
              </div>
            )}
          </div>
        </div>
      )}

      {/* ③ 模型 select */}
      {tp.capability && (
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">模型</label>
          <select
            value={tp.modelId === tp.defaultModelCode ? '' : (tp.modelId ?? '')}
            disabled={tp.locked}
            onChange={(e) => tp.setModelId(e.target.value || null)}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
          >
            <option value="">
              {tp.defaultModelCode
                ? `默认模型 (${tp.defaultModelCode})`
                : '未配置默认模型，请选择'}
            </option>
            {tp.modelOptionsInGroup.map((modelCode) => (
              <option key={modelCode} value={modelCode}>{modelCode}</option>
            ))}
          </select>
          {tp.modelOptionsInGroup.length > 0 && (
            <p className="mt-1 text-[10px] text-slate-400">
              默认值来自系统配置，也可切换为该能力目录中的其他模型。
            </p>
          )}
        </div>
      )}

      {/* ④ 比例/分辨率在下方"能力参数"里改(ParamSchemaForm 根据 Vidu 能力 schema 动态渲染) */}
      <p className="mt-3 text-[10px] text-slate-400">
        输出比例与分辨率由下方"能力参数"区域控制,选择会同步到提交参数。
      </p>

      {/* ⑤ 能力参数 schema 动态表单(对齐 demo 的 `ParamSchemaForm`) */}
      {tp.schema && (
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 mb-2">能力参数</label>
          <ParamSchemaForm
            schema={tp.schema}
            value={tp.schemaParams}
            onChange={tp.setSchemaParams}
            recommendValues={tp.recommendValues}
          />
        </div>
      )}

      {/* 由 useTaskParams.isSupported 真实判定(基于 Vidu 能力 schema + 当前 schemaParams),
          取代之前用写死 model.capability 的旧判定 */}
      <UnsupportedNotice show={!tp.initializing && !tp.unavailableReason && !tp.isSupported} />
    </div>
  );
};
