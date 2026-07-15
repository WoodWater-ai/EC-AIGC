/**
 * 当前项目仍以浏览器端 mock 工作流为默认运行方式。
 * 接入真实后端时，在环境变量中设置 VITE_USE_MOCK=false。
 */
export const isMockRuntime = import.meta.env.VITE_USE_MOCK !== 'false';
