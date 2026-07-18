export enum AppScreen {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  TASKS = 'TASKS',
  CREATE_IMAGE_TASK = 'CREATE_IMAGE_TASK',
  CREATE_VIDEO_TASK = 'CREATE_VIDEO_TASK',
  TEMPLATES = 'TEMPLATES',
  ASSETS = 'ASSETS',
  ANALYTICS = 'ANALYTICS',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  ASSET_CATEGORY = 'ASSET_CATEGORY',
  /** [v1.6 2026-07-18] 商品分类管理页(纯独立分类,无 owner/编码/类型) */
  PRODUCT_CATEGORY = 'PRODUCT_CATEGORY',
  /** [v1.2 2026-07-11] Vidu 接入 — 通道异步任务列表 */
  ASYNC_TASKS = 'ASYNC_TASKS',
  // ===== [v2.0 2026-07-13 F1 基础设施] 新流程尝试(Dark Launch) =====
  /** 智能模版中心-新(D3+D5+D7 改造,模版绑 capability + 推荐参数 Tab + 用此模版按钮) */
  TEMPLATE_CENTER_NEW = 'TEMPLATE_CENTER_NEW',
  /** 新建任务-新(D1 B v2 方案,统一 CreateTask,3 group,模版预填) */
  CREATE_TASK_NEW = 'CREATE_TASK_NEW',
  /** 任务列表-新(D2+D4 改造,3 级 chip 过滤 + 通道能力角标) */
  TASK_LIST_NEW = 'TASK_LIST_NEW',
  /** AI 帮我写 prompt-新(D6 TEXT 能力独立功能) */
  PROMPT_ASSIST_NEW = 'PROMPT_ASSIST_NEW',
  /** 推荐参数管理-新(D8 独立编辑页) */
  RECOMMEND_PARAMS_MANAGE_NEW = 'RECOMMEND_PARAMS_MANAGE_NEW',
  /** 产品基础信息管理(新增 2026-07-18) */
  PRODUCT_MANAGE = 'PRODUCT_MANAGE',
  // 未来 P1:CHANNEL_MATRIX_NEW
}

export interface GenerationTask {
  id: string;
  name: string;
  type: 'image' | 'video';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rejected';
  progress: number; // 0 to 100
  productName: string;
  productImg: string;
  templateName: string;
  timestamp: string;
  creator: string;
  resultUrl?: string;
  errorMsg?: string;
  feedback?: string;
  modelChannel?: string;
  params?: {
    ratio?: string;
    model?: string;
    steps?: number;
    guidance?: number;
    prompt?: string;
    negativePrompt?: string;
  };
  rating?: number; // 1 to 5 stars
  reviews?: {
    id: string;
    reviewer: string;
    rating: number;
    status: 'approved' | 'rejected' | 'pending';
    comment: string;
    timestamp: string;
  }[];
  generatedImages?: {
    id: string;
    url: string;
    rating?: number;
    status: 'approved' | 'rejected' | 'pending';
    comment?: string;
  }[];
  costBreakdown?: {
    compute: number;
    steps: number;
    upscaler: number;
    bandwidth: number;
  };
}

// 模板类型已迁移到 src/api/modules/template.ts 的 TemplateDTO
// 业务代码: import { TemplateDTO, templateApi } from './api/modules/template';

export interface ProductAsset {
  id: string;
  name: string;
  sku: string;
  category: '智能硬件' | '美妆护肤' | '户外服饰' | '箱包配饰' | '珠饰轻奢';
  imageCount: number;
  videoCount: number;
  thumbnail: string;
  addedTime: string;
  specs: {
    brand: string;
    color: string[];
    material: string;
    weight: string;
    sellingPoints: string[];
  };
  files: {
    id: string;
    name: string;
    url: string;
    size: string;
    type: 'image' | 'video';
  }[];
  // V2 PRD field extensions for full compliance
  fabric?: string;
  forbiddenChanges?: string[];
  originalImages?: { name: string; url: string }[];
  compositeImages?: { name: string; url: string }[];
  detailImages?: { name: string; url: string }[];
  styleReferences?: { name: string; url: string }[];
  sceneReferences?: { name: string; url: string }[];
  poseReferences?: { name: string; url: string }[];
  recommendedModels?: { name: string; type: string; url: string; matchReason: string }[];
  passedImages?: { id: string; url: string; date: string; score: number }[];
  passedVideos?: { id: string; url: string; date: string; coverUrl: string }[];
  abandonedImages?: { id: string; url: string; reason: string }[];
  historyTasks?: { id: string; name: string; status: string; date: string; cost: string }[];
  reviewRecords?: { id: string; score: number; comment: string; reviewer: string; date: string }[];
  costDetails?: { totalCost: string; avgCostPerPass: string };
}

export interface SystemUser {
  id: string;
  name: string;
  avatar: string;
  role: '管理员' | '高级设计师' | '运营策划' | '协同客户';
  email: string;
  status: 'online' | 'offline';
  joinedDate: string;
  // 后端 UserResponse.deptId 映射,前端"员工账号"Tab 反查部门用
  deptId?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  content: string;
  type: 'success' | 'warning' | 'info' | 'error';
  time: string;
  read: boolean;
}

// ===== 权限点 / 菜单 / Drawer 类型(rbac 改造新增) =====

export interface PermissionPoint {
  id: string;
  code: string;
  name: string;
  module: string;
  pid: string;
  sort?: number;
  description?: string;
  clientType?: string;
  createTime?: number;
}

export type MenuNodeType = 'CATALOG' | 'MENU' | 'BUTTON';

export interface MenuNode {
  id: string;
  pid: string;
  menuName: string;
  permission?: string;
  icon?: string;
  clientType?: 'PC' | 'IPAD';
  applicationScope?: 'ALL' | 'CHANNEL' | 'TENANT' | 'ADMIN' | 'EMPTY';
  sort?: number;
  description?: string;
  type: MenuNodeType;
  children?: MenuNode[];
}

export type DrawerMode = 'create' | 'edit';

export interface Page<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

// ============================================================================
// 模型通道(domain: model-channel)类型定义 —— 对齐后端 ModelChannelResponse
// ============================================================================

/** 后端 channelType 枚举(对齐 com.dafenqi.ai.common.enums.channel.EnumChannelType) */
export type ChannelType =
  | 'OPENAI'
  | 'QWEN'
  | 'DOUBAO'
  | 'DEEPSEEK'
  /** [v1.2 2026-07-11] Vidu 接入(生数科技) */
  | 'VIDU'
  /** [v1.5 2026-07-12] Agnes AI 接入(Sapiens AI 旗下,文本/图像/视频 3 大能力) */
  | 'AGNES_AI';

/** ChannelType UI 标签(中文/品牌名,跟后端 EnumChannelType.describe 一致) */
export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  OPENAI: 'OpenAI',
  QWEN: '通义千问',
  DOUBAO: '豆包',
  DEEPSEEK: 'DeepSeek',
  VIDU: 'Vidu(生数科技)',
  AGNES_AI: 'Agnes AI',
};

/** 卡片筛选分类 */
export const CHANNEL_CATEGORIES = {
  CLOUD: ['OPENAI', 'QWEN', 'DOUBAO', 'DEEPSEEK', 'VIDU', 'AGNES_AI'] as ChannelType[],
} as const;

/** 通道能力选项(中文 label → 后端英文 code) — 数据驱动,改用后端矩阵下放 */
export type CapabilityGroup = 'TEXT' | 'IMAGE' | 'VIDEO' | 'SOLUTION';

export interface CapabilityOption {
  code: string;            // 后端英文 code (EnumCapability 枚举名)
  label: string;           // 中文 label
  group: CapabilityGroup;
}

/** 兜底:首次加载时(矩阵未拉回前)用空数组,实际渲染必须用后端矩阵 */
export const CAPABILITY_OPTIONS: CapabilityOption[] = [];

/** 4 家供应商官方推荐 baseUrl(矩阵 placeholder + 切换供应商时自动填入默认值) */
export const BASE_URL_PLACEHOLDERS: Record<ChannelType, string> = {
  OPENAI: 'https://api.openai.com/v1',
  QWEN: 'https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  DOUBAO: 'https://ark.cn-beijing.volces.com/api/v3',
  DEEPSEEK: 'https://api.deepseek.com',
  // [v1.5 2026-07-12] Vidu + Agnes AI 官方推荐
  VIDU: 'https://api.vidu.cn/ent/v2',
  AGNES_AI: 'https://apihub.agnes-ai.com/v1',
};

/** 默认模型 placeholder(切换供应商时 input 灰色提示,仅 UI 用)
 *  - 矩阵没下发时,前端兜底用
 *  - [v1.4 2026-07-12] 改二维 map(channel × group → 提示名),因为 group 不同模型不同
 *  - 用户可手输任意值,placeholder 仅作提示
 */
export const DEFAULT_MODEL_PLACEHOLDERS: Record<ChannelType, Partial<Record<CapabilityGroup, string>>> = {
  OPENAI:   { TEXT: 'gpt-5 / gpt-4o / o3',           IMAGE: 'gpt-image-1.5 / dall-e-3',         VIDEO: 'sora-2 / sora-2-pro' },
  QWEN:     { TEXT: 'qwen3-max / qwen-plus',          IMAGE: 'qwen-image / qwen-image-2.0',     VIDEO: 'wan2.6-t2v / wan2.6-i2v' },
  DOUBAO:   { TEXT: 'doubao-seed-2.0-pro / doubao-1.5-pro', IMAGE: 'seedream-4.0 / doubao-image-3.0', VIDEO: 'seedance-1.5-pro / seedance-1.0-pro' },
  DEEPSEEK: { TEXT: 'deepseek-chat / deepseek-reasoner' },
  // [v1.4 2026-07-12] Vidu IMAGE = viduq1/viduq2(reference2image);VIDEO = 6 个模型;SOLUTION 不需要 model
  VIDU:     { IMAGE: 'viduq2 / viduq1',               VIDEO: 'viduq3-turbo / viduq2-pro / vidu2.0' },
  // [v1.5 2026-07-12] Agnes AI:3 个官方模型(文本/图像/视频各 1 个,OpenAI 兼容 + 异步视频)
  AGNES_AI: { TEXT: 'agnes-2.0-flash',                IMAGE: 'agnes-image-2.0-flash',           VIDEO: 'agnes-video-v2.0' },
};

/** 通道能力矩阵(对齐后端 CapabilityMatrixResponse)
 *  [v1.4 2026-07-12] + matrix[channelType].modelRequired 字段(后端单点收口)
 *  - 决定前端要不要渲染该 group 的 default_model input
 *  - Vidu × SOLUTION = false(不渲染,因 Vidu 4 解决方案不传 model)
 */
export interface CapabilityMatrix {
  capabilities: Array<{
    code: string;
    label: string;
    group: CapabilityGroup;
  }>;
  matrix: Record<ChannelType, {
    label: string;
    baseUrlPlaceholder: string;
    supported: string[];   // 后端 EnumCapability 枚举名
    /** [v1.4] 该 channel 在每个 group 下是否需要 default_model(groupCode → boolean) */
    modelRequired: Record<CapabilityGroup, boolean>;
  }>;
}

/** 模型通道 DTO(对齐后端 ModelChannelResponse) */
export interface ModelChannelDTO {
  id: string;                              // 后端 Long + @JsonSerialize → 前端 string
  channelName: string;                     // 通道名称
  channelType: ChannelType;                // 通道类型
  baseUrl: string | null;
  apiKey: string | null;                   // ★ 明文回显(后端 jasypt 解密后返回,字段名对齐后端 Response.apiKey)
  apiKeyConfigured: 'Y' | 'N';             // 是否已配置 Key
  defaultModels: Partial<Record<CapabilityGroup, string | null>> | null;  // [v1.4] group 级默认模型(替代旧 defaultModel 单值)
  capabilityTags: string | null;           // 逗号分隔(后端保留字段)
  capabilities: string[] | null;           // 能力编码列表
  callMode: 'SYNC' | 'ASYNC' | 'POLL' | 'CALLBACK' | null;
  concurrency: number | null;
  monthlyBudget: number | null;            // 月度预算(元)
  timeoutSeconds: number | null;
  retryStrategy: string | null;
  retryMax: number | null;
  costRate: number | null;                 // 成本换算率
  status: 'NORMAL' | 'DISABLED' | 'MAINTAINING';
  dailyCostCache: number | null;
  errorRate1hCache: number | null;
  supportsRefImgCount: number | null;
  supportsVideoDuration: string | null;
  supportsVideoResolution: string | null;
  supportsVideoMotion: 'SMALL' | 'MEDIUM' | 'LARGE' | null;
  p95LatencyMs: number | null;
  todayCost: number | null;                // 今日消耗(元)
  todayCallCount: number | null;           // 今日调用次数
  testEndpoint: string | null;             // 仅本地模型
  healthStatus: 'NORMAL' | 'RATE_LIMITED' | 'AUTH_FAIL' | 'QUOTA_LOW' | 'CIRCUIT_OPEN' | null;
}

/** 模型通道新增请求(对齐 ModelChannelAddRequest) */
export interface ModelChannelAddRequest {
  channelName: string;
  channelType: ChannelType;
  baseUrl?: string;
  apiKey?: string;                         // ★ 明文,后端 jasypt 加密存
  /** [v1.4] group 级默认模型(后端按 EnumChannelCapability.modelRequired 强约束) */
  defaultModels?: Partial<Record<CapabilityGroup, string>>;
  capabilityTags?: string;
  callMode?: 'SYNC' | 'ASYNC' | 'POLL' | 'CALLBACK';
  concurrency?: number;
  monthlyBudget?: number;
  timeoutSeconds?: number;
  retryStrategy?: string;
  retryMax?: number;
  costRate?: number;
  capabilities?: string[];
}

/** 模型通道更新请求(对齐 ModelChannelUpdateRequest) */
export interface ModelChannelUpdateRequest extends ModelChannelAddRequest {
  id: string;
  status?: 'NORMAL' | 'DISABLED' | 'MAINTAINING';
}

/** 模型通道分页查询请求(对齐 ModelChannelQueryRequest) */
export interface ModelChannelQueryRequest {
  pageNum: number;
  pageSize: number;
  status?: 'NORMAL' | 'DISABLED' | 'MAINTAINING';
  channelType?: ChannelType;
  /** 多值 IN 筛选(配合"云端 API"分类) */
  channelTypes?: ChannelType[];
  keyword?: string;
}

// ============================================================================
// 通道异步任务(domain: channel-async-task)类型定义 —— 对齐后端 ChannelAsyncTaskResponse
// [v1.2 2026-07-11] Vidu 接入
// ============================================================================

/** 异步任务状态机(对齐后端 EnumChannelAsyncTaskStatus) */
export type AsyncTaskStatus =
  | 'PENDING_SUBMIT'    // 占位待提交
  | 'PENDING'           // 已提交待轮询
  | 'PROCESSING'        // 轮询中
  | 'SUCCESS'           // 成功
  | 'FAILED'            // 失败(可重试)
  | 'DEAD_LETTER';      // 死信(超 10 次)

/** 异步任务 DTO(对齐后端 ChannelAsyncTaskResponse) */
export interface ChannelAsyncTask {
  id: string;                              // 后端 Long + @JsonSerialize → string
  bizId: string;                           // 业务 ID(generation_task.id)
  channelId: string;
  channelType: ChannelType;
  capability: string;
  remoteTaskId: string | null;
  resultType: 'IMAGE' | 'VIDEO' | null;
  resultCount: number;
  status: AsyncTaskStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  retryCount: number;
  nextRetryTime: string | null;
  failReason: string | null;
  submitterUserId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  requestPayload: string | null;
  responsePayload: string | null;
  createTime: string;
}

/** 异步任务分页查询请求 */
export interface ChannelAsyncTaskQueryRequest {
  page?: number;
  size?: number;
  channelId?: string;
  channelType?: ChannelType;
  status?: AsyncTaskStatus;
  bizId?: string;
}

// ==================== [2026-07-16] 子任务产出的图 ====================

/**
 * 生成图片响应(对齐后端 GeneratedImageResponse)
 * <p>子任务产出的图列表 —— 用于 TaskList 子任务 chip 缩略图
 * <p>imageUrl 存的是 COS fileKey(不带 / 不带 domain);展示层拼接 + 加 CI 缩放参数
 */
export interface ChannelAsyncTaskImage {
  id: string;
  taskId: string;
  channelAsyncTaskId: string;        // 父 task_id + 子任务 id 双锚
  batchIdx: number;                   // 子任务在父任务内的序号
  version: string | null;
  /** 完整 URL(COS 域名前缀 + fileKey);本期不用,前端用 fileKey + 拼接 domain + ?imageMogr2 拼缩略图 */
  imageUrl: string;
  /** 缩略图 URL —— 本期不存,前端走 CI imageMogr2 实时缩放 */
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  modelChannelId: string;
  promptVersion: string | null;
  status: string;
  createTime: string;
}

/** 状态 chip 颜色映射(后端 6 状态) */
export const ASYNC_TASK_STATUS_STYLES: Record<AsyncTaskStatus, { bg: string; text: string; label: string }> = {
  PENDING_SUBMIT: { bg: 'bg-slate-100', text: 'text-slate-700', label: '占位待提交' },
  PENDING:        { bg: 'bg-blue-50',   text: 'text-blue-700',  label: '已提交' },
  PROCESSING:     { bg: 'bg-indigo-50', text: 'text-indigo-700',label: '轮询中' },
  SUCCESS:        { bg: 'bg-emerald-50',text: 'text-emerald-700',label: '成功' },
  FAILED:         { bg: 'bg-amber-50',  text: 'text-amber-700', label: '失败(可重试)' },
  DEAD_LETTER:    { bg: 'bg-rose-50',   text: 'text-rose-700',  label: '死信' },
};

// ==================== [2026-07-16 老版 TaskList 对接后端] 父任务响应 ====================

/** 父任务状态机(对齐后端 EnumTaskStatus) */
export type TaskStatus =
  | 'PENDING'              // 已提交,待执行
  | 'GENERATING'           // 生成中
  | 'PENDING_REVIEW_SCORE' // 已完成,待评分
  | 'FAILED'               // 失败
  | 'CANCELED'             // 取消
  | 'COMPLETED';           // 完成(二期引入,本期不一定用到)

/** 父任务响应 DTO(对齐后端 TaskResponse) */
export interface GenerationTaskResponse {
  id: string;                          // 后端 Long + @JsonSerialize → string
  taskCode: string;                    // 业务编号 TASK-yyyyMMddHHmmss-XXXX
  title: string;
  productId: string | null;            // MVP 可空(autoCreateProduct 路径)
  taskType: string;
  style: string | null;
  scene: string | null;
  aspectRatio: string | null;
  count: number;
  modelChannelId: string;
  templateId: string | null;
  status: TaskStatus;
  progress: number;
  progressTotal: number;
  progressPercent: number;
  failReason: string | null;
  failCode: string | null;
  retryCount: number;
  estimatedCost: number | null;
  actualCost: number | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  submitterUserId: string;
  createTime: string;
}

// ============================================================================
// 系统内置通道配置(2026-07-18)
// ============================================================================

/** 系统内置通道键,与后端 EnumBuiltinKey.name() 对齐 */
export type BuiltinKey = 'BUILTIN_CHAT' | 'BUILTIN_IMAGE_UNDERSTAND';

/** 单条更新项(channelId=null 表示清空) */
export interface SystemBuiltinChannelItem {
  builtinKey: BuiltinKey;
  channelId: string | null;
}
