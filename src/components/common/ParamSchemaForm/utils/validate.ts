// [新增 2026-07-12 P0/M2 前端] 本地粗校(type/range/required)
// [v2.0 2026-07-13 F1 补强] +IMAGES_URL 张数校验
import type { FieldDef } from '../../../../api/modules/capability';

export interface LocalError {
  field: string;
  message: string;
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
    // [F1 新] IMAGES_URL:张数校验
    if (f.type === 'IMAGES_URL' && Array.isArray(v)) {
      const validUrls = v.filter((u) => typeof u === 'string' && u.trim() !== '');
      if (f.required && validUrls.length === 0) {
        errors.push({ field: f.key, message: `${f.label} 至少需要 1 张图` });
      }
      if (f.minCount !== undefined && validUrls.length < f.minCount) {
        errors.push({ field: f.key, message: `${f.label} 至少 ${f.minCount} 张图,当前 ${validUrls.length} 张` });
      }
      if (f.maxCount !== undefined && validUrls.length > f.maxCount) {
        errors.push({ field: f.key, message: `${f.label} 最多 ${f.maxCount} 张图,当前 ${validUrls.length} 张` });
      }
    }
  }
  return errors;
}
