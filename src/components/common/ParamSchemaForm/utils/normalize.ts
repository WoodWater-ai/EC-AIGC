// [新增 2026-07-12 P0/M2 前端] 类型转换工具
export function normalizeValue(type: string, raw: any): any {
  if (raw === undefined || raw === null || raw === '') return raw;
  switch (type) {
    case 'INT':
    case 'DECIMAL':
      return Number(raw);
    case 'BOOLEAN':
      return raw === true || raw === 'true' || raw === 1;
    default:
      return raw;
  }
}
