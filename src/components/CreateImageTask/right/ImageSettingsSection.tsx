import React, { useEffect, useMemo } from 'react';
import { Box, Cpu, Maximize2, RectangleHorizontal, Route, Sparkles, SlidersHorizontal } from 'lucide-react';
import { useTaskParams } from '../../createTask/useTaskParams';
import { ParamSchemaForm } from '../../common/ParamSchemaForm';
import { localValidate } from '../../common/ParamSchemaForm/utils/validate';
import { UnsupportedNotice } from './UnsupportedNotice';
import { CompactParamPicker } from '../center/CompactParamPicker';
import type { PrefillState } from '../../createTask/useTaskParams';
import type { FieldDef } from '../../../api/modules/capability';

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

const INLINE_FIELD_KEYS = new Set(['aspect_ratio', 'size', 'resolution', 'quality']);

function fieldIcon(field: FieldDef) {
  if (field.key === 'aspect_ratio') return <RectangleHorizontal className="h-4 w-4" />;
  if (field.key === 'quality') return <Sparkles className="h-4 w-4" />;
  if (field.key === 'size') return <Maximize2 className="h-4 w-4" />;
  return <Cpu className="h-4 w-4" />;
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
  const inlineFields = useMemo(
    () => (tp.schema?.fields ?? []).filter((field) =>
      INLINE_FIELD_KEYS.has(field.key) && field.type === 'SELECT'),
    [tp.schema],
  );
  const advancedSchema = useMemo(() => {
    if (!tp.schema) return null;
    return {
      ...tp.schema,
      fields: tp.schema.fields.filter((field) => !inlineFields.some((inlineField) => inlineField.key === field.key)),
    };
  }, [inlineFields, tp.schema]);
  const modelOptions = useMemo(() => {
    return tp.modelOptions.map((option) => ({
      value: option.modelCode,
      label: option.displayName,
      description: option.isDefault
        ? `当前通道默认模型 · ${option.modelCode}`
        : option.modelCode,
    }));
  }, [tp.modelOptions]);
  const hasAdvancedSettings = viduInstances.length > 1 || Boolean(advancedSchema?.fields.length);

  return (
    <div id="image-settings-section" className="contents">
      {tp.initializing && (
        <p className="basis-full text-[10px] text-primary">正在解析默认模型与输出规格...</p>
      )}
      {tp.fallbackReason && (
        <p className="basis-full border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
          原执行参数已失效，已使用默认配置。
        </p>
      )}
      {tp.unavailableReason && (
        <p className="basis-full border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
          {tp.unavailableReason}
        </p>
      )}

      <CompactParamPicker
        label="模型"
        value={tp.effectiveModelCode ?? ''}
        options={modelOptions}
        disabled={tp.locked || !tp.capability}
        placeholder="未配置模型"
        widthClassName="w-[220px] max-w-full flex-none"
        icon={<Box className="h-4 w-4" />}
        onChange={(value) => tp.setModelId(value === tp.defaultModelCode ? null : value)}
      />
      {inlineFields.map((field) => {
        const options = (field.options ?? []).map((option) => ({
          value: option.value,
          label: option.label,
        }));
        if (!field.required && !field.defaultValue) {
          options.unshift({ value: '', label: '未设置' });
        }
        return (
          <CompactParamPicker
            key={field.key}
            label={field.label}
            value={String(tp.schemaParams[field.key] ?? '')}
            options={options}
            disabled={tp.locked}
            widthClassName={field.key === 'aspect_ratio'
              ? 'w-[150px] max-w-full flex-none'
              : 'w-[168px] max-w-full flex-none'}
            icon={fieldIcon(field)}
            onChange={(value) => tp.setSchemaParams({ ...tp.schemaParams, [field.key]: value })}
          />
        );
      })}

      {hasAdvancedSettings && (
        <details className="basis-full border-t border-slate-100 pt-2">
          <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5" />高级执行设置
          </summary>
          <div className="mt-2 space-y-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[9px] font-bold text-slate-400">
                <Route className="h-3 w-3" />执行通道
              </span>
              <select
                value={tp.channelId ?? ''}
                disabled={tp.locked || viduInstances.length === 0}
                onChange={(event) => tp.setChannelId(event.target.value || null)}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
              >
                {viduInstances.length === 0 && <option value="">暂无可用通道</option>}
                {viduInstances.map((instance) => (
                  <option key={instance.id} value={instance.id}>{instance.channelName}</option>
                ))}
              </select>
            </label>
            {advancedSchema && advancedSchema.fields.length > 0 && (
              <div className="[&_.param-schema-form]:grid [&_.param-schema-form]:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] [&_.param-schema-form]:gap-2 [&_.param-field]:min-w-0 [&_.param-field_label]:mb-1 [&_.param-field_label]:block [&_.param-field_label]:text-[9px] [&_.param-field_label]:font-bold [&_.param-field_label]:text-slate-400 [&_.param-field_select]:h-8 [&_.param-field_select]:rounded-md [&_.param-field_select]:text-[10px]">
                <ParamSchemaForm
                  schema={advancedSchema}
                  value={tp.schemaParams}
                  onChange={tp.setSchemaParams}
                  recommendValues={tp.recommendValues}
                />
              </div>
            )}
          </div>
        </details>
      )}

      <UnsupportedNotice show={!tp.initializing && !tp.unavailableReason && !tp.isSupported} />
    </div>
  );
};
