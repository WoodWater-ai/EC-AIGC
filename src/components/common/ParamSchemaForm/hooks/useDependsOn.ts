// [新增 2026-07-12 P0/M2 前端] dependsOn 表达式求值
//
// [P2-4 安全约束 2026-07-12] schema 来源必须可信!
// 当前 schema 来自后端 SPI 注解(编译期固化,无外部输入),
// 如果未来考虑"运营在线编辑 schema",本求值器是 XSS 入口,
// 需要: ① 表达式白名单(只允许简单布尔运算)
//       ② 后端白名单校验(不通过则拒绝 schema)

export function evalDependsOn(
  expr: string | undefined,
  values: Record<string, any>
): boolean {
  if (!expr) return true;
  try {
    const fn = new Function('value', `with(value) { return (${expr}); }`);
    return Boolean(fn(values));
  } catch (e) {
    console.warn('[dependsOn] eval failed:', expr, e);
    return true;
  }
}
