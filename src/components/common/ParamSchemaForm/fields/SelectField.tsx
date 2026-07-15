// [新增 2026-07-12 P0/M2 前端] 单选下拉字段
import React from 'react';
import { Select } from 'antd';
import type { FieldDef } from '../../../../api/modules/capability';

export interface SelectFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function SelectField({
  field, value, onChange, error, readOnly, isRecommended,
}: SelectFieldProps) {
  return (
    <div className="param-field">
      <label>
        {field.label}
        {field.required && <span className="req">*</span>}
        {isRecommended && <span className="recommend-tag">模板推荐</span>}
      </label>
      <Select
        value={value}
        placeholder={field.placeholder}
        status={error ? 'error' : ''}
        disabled={readOnly}
        onChange={onChange}
        style={{ width: '100%' }}
        options={(field.options || []).map((o) => ({
          value: o.value, label: o.label,
        }))}
      />
      {field.helpText && <div className="help">{field.helpText}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
