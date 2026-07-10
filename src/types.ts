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
