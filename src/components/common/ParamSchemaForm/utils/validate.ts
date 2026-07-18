// [新增 2026-07-12 P0/M2 前端] 本地粗校(type/range/required)
// [v2.0 2026-07-13 F1 补强] +IMAGES_URL 张数校验
// [v2.1 2026-07-17 F1 补强] +VIDEO_URL/AUDIO_URL/LIP_REF_URL 媒体字段校验
import type { FieldDef } from '../../../../api/modules/capability';

export interface LocalError {
  field: string;
  message: string;
}

/** 媒体类字段(IMAGES_URL/VIDEO_URL/AUDIO_URL/LIP_REF_URL)校验 */
export function validateMediaField(field: FieldDef, value: unknown): string | null {
  const { required, type, minCount, maxCount } = field as any;
  // 必填校验(含空数组)
  if (required) {
    if (value === undefined || value === null || value === '') return `${field.label}为必填项`;
    if (Array.isArray(value) && value.length === 0) return `${field.label}至少需要 1 项`;
  }
  if (Array.isArray(value)) {
    if (type === 'IMAGES_URL') {
      if (minCount && value.length < minCount) return `${field.label}至少需要 ${minCount} 张`;
      if (maxCount && value.length > maxCount) return `${field.label}最多 ${maxCount} 张`;
    }
    // VIDEO_URL / AUDIO_URL / LIP_REF_URL 同理(张数换为数量)
    if (['VIDEO_URL', 'AUDIO_URL', 'LIP_REF_URL'].includes(type)) {
      if (minCount && value.length < minCount) return `${field.label}至少需要 ${minCount} 个`;
      if (maxCount && value.length > maxCount) return `${field.label}最多 ${maxCount} 个`;
    }
  }
  return null;
}

export function localValidate(
  values: Record<string, any>,
  fields: FieldDef[]
): LocalError[] {
  const errors: LocalError[] = [];
  for (const f of fields) {
    const v = values[f.key];
    if (f.required && (v === undefined || v === null || v === '')) {
      errors.push({ field: f.key, message: `${f.label} 必填` });
      continue;
    }
    if (v === undefined || v === null || v === '') continue;
    if (f.type === 'INT' || f.type === 'DECIMAL') {
      const num = Number(v);
      if (Number.isNaN(num)) {
        errors.push({ field: f.key, message: `${f.label} 必须是数字` });
        continue;
      }
      if (f.min !== undefined && num < Number(f.min)) {
        errors.push({ field: f.key, message: `${f.label} 最小值 ${f.min}` });
      }
      if (f.max !== undefined && num > Number(f.max)) {
        errors.push({ field: f.key, message: `${f.label} 最大值 ${f.max}` });
      }
    }
    if (f.type === 'SELECT' && f.options) {
      const inOpt = f.options.some((o) => o.value === v);
      if (!inOpt) errors.push({ field: f.key, message: `${f.label} 取值非法` });
    }
    // [F1 补强] 媒体类字段统一校验
    if (['IMAGES_URL', 'VIDEO_URL', 'AUDIO_URL', 'LIP_REF_URL'].includes(f.type)) {
      const err = validateMediaField(f, v);
      if (err) errors.push({ field: f.key, message: err });
    }
  }
  return errors;
}
