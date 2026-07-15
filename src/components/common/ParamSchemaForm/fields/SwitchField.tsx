// [新增 2026-07-12 P0/M2 前端] 布尔开关字段
import React from 'react';
import { Switch } from 'antd';
import type { FieldDef } from '../../../../api/modules/capability';

export interface SwitchFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function SwitchField({
  field, value, onChange, error, readOnly, isRecommended,
}: SwitchFieldProps) {
  return (
    <div className="param-field">
      <label>
        {field.label}
        {field.required && <span className="req">*</span>}
        {isRecommended && <span className="recommend-tag">模板推荐</span>}
      </label>
      <Switch
        checked={value === true || value === 'true'}
        disabled={readOnly}
        onChange={(checked) => onChange(checked)}
      />
      {field.helpText && <div className="help">{field.helpText}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
