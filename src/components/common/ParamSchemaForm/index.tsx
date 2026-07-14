// [新增 2026-07-12 P0/M2 前端] ParamSchemaForm 主组件
// [v2.0 2026-07-13 F1 补强] +IMAGES_URL 多图 / +DICT 字典引用
import React, { useMemo } from 'react';
import type { CapabilityDefinition } from '../../../api/modules/capability';
import { localValidate } from './utils/validate';
import { evalDependsOn } from './hooks/useDependsOn';
import { NumberField } from './fields/NumberField';
import { TextField } from './fields/TextField';
import { TextAreaField } from './fields/TextAreaField';
import { SwitchField } from './fields/SwitchField';
import { SelectField } from './fields/SelectField';
import { MultiSelectField } from './fields/MultiSelectField';
import { JsonField } from './fields/JsonField';
import { ImagePickerField } from './fields/ImagePickerField';
import { ImagesPickerField } from './fields/ImagesPickerField';
import { DictField } from './fields/DictField';

export interface ParamSchemaFormProps {
  schema: CapabilityDefinition;
  value: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  /** 推荐值(模板用),匹配上时蓝底灰显 */
  recommendValues?: Record<string, any>;
  /** 只读模式(TaskDetailsDrawer 用) */
  readOnly?: boolean;
}

export function ParamSchemaForm({
  schema, value, onChange, recommendValues = {}, readOnly = false,
}: ParamSchemaFormProps) {
  const errors = useMemo(
    () => localValidate(value || {}, schema.fields || []),
    [value, schema]
  );
  const errorMap = useMemo(() => {
    const m: Record<string, string> = {};
    errors.forEach((e) => { m[e.field] = e.message; });
    return m;
  }, [errors]);

  const setValue = (key: string, v: any) => {
    onChange({ ...(value || {}), [key]: v });
  };

  return (
    <div className="param-schema-form">
      {(schema.fields || []).map((field) => {
        // dependsOn 联动
        if (field.dependsOn && !evalDependsOn(field.dependsOn, value || {})) {
          return null;
        }
        const fieldValue = (value || {})[field.key];
        const isRecommended = recommendValues[field.key] !== undefined
          && recommendValues[field.key] === fieldValue;
        const error = errorMap[field.key];

        const commonProps: any = {
          field, value: fieldValue,
          onChange: (v: any) => setValue(field.key, v),
          error, readOnly, isRecommended,
        };

        switch (field.type) {
          case 'INT':
          case 'DECIMAL':
            return <NumberField key={field.key} {...commonProps} />;
          case 'TEXT':
            return <TextField key={field.key} {...commonProps} />;
          case 'TEXTAREA':
            return <TextAreaField key={field.key} {...commonProps} />;
          case 'BOOLEAN':
            return <SwitchField key={field.key} {...commonProps} />;
          case 'SELECT':
            return <SelectField key={field.key} {...commonProps} />;
          case 'MULTI_SELECT':
            return <MultiSelectField key={field.key} {...commonProps} />;
          case 'JSON':
            return <JsonField key={field.key} {...commonProps} />;
          case 'IMAGE_URL':
            return <ImagePickerField key={field.key} {...commonProps} />;
          case 'IMAGES_URL':
            return <ImagesPickerField key={field.key} {...commonProps} />;
          case 'DICT':
            return <DictField key={field.key} {...commonProps} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
