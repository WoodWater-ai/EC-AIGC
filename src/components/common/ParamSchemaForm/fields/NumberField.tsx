// [新增 2026-07-12 P0/M2 前端] 数字输入字段
import React from 'react';
import { Input } from 'antd';
import type { FieldDef } from '../../../../api/modules/capability';

export interface NumberFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function NumberField({
  field, value, onChange, error, readOnly, isRecommended,
}: NumberFieldProps) {
  const minValue = field.min !== undefined && field.min !== null && field.min !== ''
    ? Number(field.min)
    : null;
  const maxValue = field.max !== undefined && field.max !== null && field.max !== ''
    ? Number(field.max)
    : null;

  const clampToRange = (input: number): number => {
    let next = input;
    if (minValue !== null && Number.isFinite(minValue)) next = Math.max(minValue, next);
    if (maxValue !== null && Number.isFinite(maxValue)) next = Math.min(maxValue, next);
    return next;
  };

  return (
    <div className="param-field">
      <label>
        {field.label}
        {field.required && <span className="req">*</span>}
        {isRecommended && <span className="recommend-tag">模板推荐</span>}
      </label>
      <Input
        type="number"
        value={value ?? ''}
        min={field.min}
        max={field.max}
        placeholder={field.placeholder}
        status={error ? 'error' : ''}
        disabled={readOnly}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const numericValue = Number(raw);
          // 最大值可立即限制；最小值留到失焦处理，避免输入 10 时首位 1 被强制改成 min。
          if (maxValue !== null && Number.isFinite(maxValue) && numericValue > maxValue) {
            onChange(maxValue);
            return;
          }
          onChange(numericValue);
        }}
        onBlur={() => {
          if (value === undefined || value === null || value === '') return;
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue)) return;
          const clampedValue = clampToRange(numericValue);
          if (clampedValue !== numericValue) onChange(clampedValue);
        }}
        className={isRecommended ? 'input-recommend' : ''}
      />
      {field.helpText && <div className="help">{field.helpText}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
