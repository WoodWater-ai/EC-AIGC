// [新增 2026-07-12 P0/M2 前端] 图片 URL 字段
// 简化版:文本输入 + "选择素材库" 按钮
import React from 'react';
import { Input, Button } from 'antd';
import type { FieldDef } from '../../../../api/modules/capability';

export interface ImagePickerFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function ImagePickerField({
  field, value, onChange, error, readOnly, isRecommended,
}: ImagePickerFieldProps) {
  return (
    <div className="param-field">
      <label>
        {field.label}
        {field.required && <span className="req">*</span>}
        {isRecommended && <span className="recommend-tag">模板推荐</span>}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          value={value ?? ''}
          placeholder={field.placeholder || '输入图片 URL 或点击右侧选择'}
          status={error ? 'error' : ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className={isRecommended ? 'input-recommend' : ''}
        />
        {!readOnly && (
          <Button
            onClick={() => {
              // 集成 ProductAssetLibrary 的选择 modal(项目已有)
              // 简化:此处省略,实际可在父组件接 onAssetPicked 回调
              console.warn('[ImagePickerField] 需接入素材库选择 modal');
            }}
          >
            选择素材
          </Button>
        )}
      </div>
      {field.helpText && <div className="help">{field.helpText}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
