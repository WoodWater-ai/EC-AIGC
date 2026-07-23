// [2026-07-21] demo 主版对齐 — 旧单文件实现迁出到子目录;
// 本入口保留为旧路径的兼容转发(下个 task 删除)。
// 旧文件本身的逻辑在 .ts 末尾备份:本次改造是从 700 行单文件 → 17 子组件 + hook。
// 新文件位置:src/components/CreateImageTask/CreateImageTask.tsx

// 旧路径兼容:同时支持 named import 与 default import
export { CreateImageTask } from './CreateImageTask/CreateImageTask';
export { CreateImageTask as default } from './CreateImageTask/CreateImageTask';
