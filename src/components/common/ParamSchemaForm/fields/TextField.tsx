// [新增 2026-07-12 P0/M2 前端] 单行文本字段
import React from 'react';
import { Input } from 'antd';
import type { FieldDef } from '../../../../api/modules/capability';

export interface TextFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function TextField({
  field, value, onChange, error, readOnly, isRecommended,
}: TextFieldProps) {
  return (
    <div className="param-field">
      <label>
        {field.label}
        {field.required && <span className="req">*</span>}
        {isRecommended && <span className="recommend-tag">模板推荐</span>}
      </label>
      <Input
        value={value ?? ''}
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
