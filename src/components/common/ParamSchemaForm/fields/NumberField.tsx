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
        onChange={(e) => onChange(e.target.value)}
        className={isRecommended ? 'input-recommend' : ''}
      />
      {field.helpText && <div className="help">{field.helpText}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
