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
  ASSET_CATEGORY = 'ASSET_CATEGORY'
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

export interface AdTemplate {
  id: string;
  title: string;
  type: 'image' | 'video';
  category: '电商主图' | '社群海报' | '节日促销' | '场景融合' | '短视频脚本' | '主打短视频';
  ratio: string;
  usedCount: number;
  status: 'active' | 'draft';
  modifier: string;
  updatedTime: string;
  previewUrl: string;
  promptTemplate: string;
  // Prototype extension fields
  tabCategory?: 'image_task' | 'style_scene' | 'video_prompt' | 'platform_spec' | 'negative_constraint';
  taskType?: string;
  applicableCategory?: string;
  defaultStyle?: string;
  defaultCount?: string;
  defaultChannel?: string;
  version?: string;
  avgAestheticScore?: number;
  approvalRate?: string;
  negativePrompt?: string;

  // 1. 图片任务 (Image Task) Specific fields
  imageTaskType?: '主图' | '场景图' | '细节图' | '上身三视图' | '通用';
  variableFields?: string[]; // e.g., ["商品名", "颜色", "面料", "卖点"]
  relatedNegativeConstraints?: string[]; // e.g., ["高精度手部与面部保真约束"]

  // 2. 风格场景 (Style Scene) Specific fields
  styleType?: '风格' | '场景' | '动作姿势' | '组合预设';
  styleTags?: string[]; // e.g., ["甜美网红风", "中式国风"]
  sceneTags?: string[]; // e.g., ["室内影棚", "室外街拍"]
  poseTags?: string[]; // e.g., ["站姿", "坐姿", "抱臂"]
  promptFragment?: string; // Prompt Fragment text
  stylePreviewUrl?: string; // Aesthetic preview image

  // 3. 视频 Prompt (Video Prompt) Specific fields
  videoMode?: 'reference2video' | 'img2video';
  applicableImageTypes?: string[]; // e.g., ["主图", "场景图", "细节图"]
  recommendationConditions?: string; // Conditions for recommended
  defaultDuration?: string; // e.g., "5s", "8s", "15s"
  defaultResolution?: string; // e.g., "1080p", "4K"
  motionRange?: 'small' | 'medium' | 'large';
  threeStageStructure?: {
    opening: string; // 开场主体
    dynamic: string; // 动态展示
    detailEnding: string; // 细节收束
  };

  // 4. 平台规格 (Platform Spec) Specific fields
  specUsage?: '商品主图' | '详情页场景图' | '短视频素材' | '通用';
  specMaterialType?: '图片' | '视频' | '双核通用';
  specWidth?: number;
  specHeight?: number;
  specFormat?: 'jpg' | 'png' | 'webp' | 'mp4' | 'gif';
  maxFileSize?: string; // e.g., "5MB", "50MB"
  isDefaultRecommended?: boolean;

  // 5. 负面约束 (Negative Constraint) Specific fields
  applicableMaterialTypes?: '图片' | '视频' | '通用';
  applicableTaskTypes?: string[]; // e.g., ["主图", "场景图", "视频"]
  constraintCategory?: '商品保真' | '人物人体' | '画面质量' | '视频稳定性';
  severityLevel?: 'P0' | 'P1' | 'P2';
  chineseDescription?: string; // Explanation for operators
  referencedTemplatesCount?: number;
  conflictRules?: string[];
}

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

export interface ModelChannel {
  id: string;
  name: string;
  provider: 'DaVinci Core' | 'Midjourney' | 'Runway' | 'Stable Diffusion' | 'Kling AI';
  status: 'active' | 'inactive';
  todayUsage: number;
  limit: number;
  latency: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  concurrencyLimit?: number;
  timeoutSeconds?: number;
  retryPolicy?: 'exponential' | 'linear' | 'none';
  costRatio?: number;
  capabilities?: string[];
}

export interface SystemUser {
  id: string;
  name: string;
  avatar: string;
  role: '管理员' | '高级设计师' | '运营策划' | '协同客户';
  email: string;
  status: 'online' | 'offline';
  joinedDate: string;
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
