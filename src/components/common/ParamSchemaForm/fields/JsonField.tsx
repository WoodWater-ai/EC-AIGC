// [新增 2026-07-12 P0/M2 前端] JSON 字段(简化:作为 textarea,JSON.stringify 存)
import React from 'react';
import { Input } from 'antd';
import type { FieldDef } from '../../../../api/modules/capability';

export interface JsonFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function JsonField({
  field, value, onChange, error, readOnly, isRecommended,
}: JsonFieldProps) {
  const str = typeof value === 'string' ? value
    : value ? JSON.stringify(value, null, 2) : '';
  return (
    <div className="param-field">
      <label>
        {field.label}
        {field.required && <span className="req">*</span>}
        {isRecommended && <span className="recommend-tag">模板推荐</span>}
      </label>
      <Input.TextArea
        rows={4}
        value={str}
        placeholder={field.placeholder || '{"key": "value"}'}
        status={error ? 'error' : ''}
        disabled={readOnly}
        onChange={(e) => {
          try {
            onChange(e.target.value ? JSON.parse(e.target.value) : '');
          } catch {
            onChange(e.target.value);
          }
        }}
        className={isRecommended ? 'input-recommend' : ''}
      />
      {field.helpText && <div className="help">{field.helpText}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
