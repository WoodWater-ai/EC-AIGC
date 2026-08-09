import React, { useEffect } from 'react';
import { Cpu, Route } from 'lucide-react';
import { useTaskParams } from '../../createTask/useTaskParams';
import { ParamSchemaForm } from '../../common/ParamSchemaForm';
import { localValidate } from '../../common/ParamSchemaForm/utils/validate';
import { UnsupportedNotice } from './UnsupportedNotice';
import type { PrefillState } from '../../createTask/useTaskParams';

export interface TaskParamsSnapshot {
  channelId: string | null;
  channelType: string | null;
  capability: string | null;
  /** 历史字段名；值是供应商 modelCode，不是数据库 ID。 */
  modelId: string | null;
  schemaParams?: Record<string, any>;
  executionParamsReady: boolean;
  selectionSource: string;
  fallbackReason: string | null;
}

export interface ImageSettingsSectionProps {
  onParamsChange?: (snapshot: TaskParamsSnapshot) => void;
  prefill?: PrefillState | null;
  prefillPending?: boolean;
}

export const ImageSettingsSection: React.FC<ImageSettingsSectionProps> = ({
  onParamsChange,
  prefill,
  prefillPending = false,
}) => {
  const tp = useTaskParams('IMAGE', prefill, 'REF_IMG_EDIT', prefillPending);

  useEffect(() => {
    const schemaValid = !!tp.schema
      && localValidate(tp.schemaParams, tp.schema.fields ?? []).length === 0;
    onParamsChange?.({
      channelId: tp.channelId,
      channelType: tp.channelType,
      capability: tp.capability,
      modelId: tp.effectiveModelCode,
      schemaParams: tp.schemaParams,
      selectionSource: tp.selectionSource,
      fallbackReason: tp.fallbackReason,
      executionParamsReady: !tp.initializing
        && !tp.unavailableReason
        && !!tp.channelId
        && !!tp.capability
        && !!tp.effectiveModelCode
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

  const viduInstances = tp.instances.filter((instance) => instance.channelType === 'VIDU');

  return (
    <div id="image-settings-section">
      {tp.initializing && (
        <p className="mb-2 text-[10px] text-primary">正在解析默认模型与输出规格...</p>
      )}
      {tp.fallbackReason && (
        <p className="mb-2 border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
          原执行参数已失效，已使用默认配置。
        </p>
      )}
      {tp.unavailableReason && (
        <p className="mb-2 border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
          {tp.unavailableReason}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[150px] flex-1">
          <span className="mb-1 flex items-center gap-1 text-[9px] font-bold text-slate-400">
            <Route className="h-3 w-3" />执行通道
          </span>
          <select
            value={tp.channelId ?? ''}
            disabled={tp.locked || viduInstances.length === 0}
            onChange={(event) => tp.setChannelId(event.target.value || null)}
            className="h-9 w-full border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            {viduInstances.length === 0 && <option value="">暂无可用通道</option>}
            {viduInstances.map((instance) => (
              <option key={instance.id} value={instance.id}>{instance.channelName}</option>
            ))}
          </select>
        </label>

        <label className="min-w-[180px] flex-[1.2]">
          <span className="mb-1 flex items-center gap-1 text-[9px] font-bold text-slate-400">
            <Cpu className="h-3 w-3" />模型
          </span>
          <select
            value={tp.modelId === tp.defaultModelCode ? '' : (tp.modelId ?? '')}
            disabled={tp.locked || !tp.capability}
            onChange={(event) => tp.setModelId(event.target.value || null)}
            className="h-9 w-full border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {tp.defaultModelCode ? `默认模型 (${tp.defaultModelCode})` : '未配置默认模型'}
            </option>
            {tp.modelOptionsInGroup.map((modelCode) => (
              <option key={modelCode} value={modelCode}>{modelCode}</option>
            ))}
          </select>
        </label>
      </div>

      {tp.schema && (
        <div className="mt-2 [&_.param-schema-form]:grid [&_.param-schema-form]:grid-cols-2 [&_.param-schema-form]:gap-2 [&_.param-field]:min-w-0 [&_.param-field_label]:mb-1 [&_.param-field_label]:block [&_.param-field_label]:text-[9px] [&_.param-field_label]:font-bold [&_.param-field_label]:text-slate-400 [&_.param-field_select]:h-9 [&_.param-field_select]:text-[10px]">
          <ParamSchemaForm
            schema={tp.schema}
            value={tp.schemaParams}
            onChange={tp.setSchemaParams}
            recommendValues={tp.recommendValues}
          />
        </div>
      )}

      <UnsupportedNotice show={!tp.initializing && !tp.unavailableReason && !tp.isSupported} />
    </div>
  );
};
