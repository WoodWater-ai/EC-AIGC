import { GenerationTask, ProductAsset, ModelChannel, SystemUser, SystemNotification } from './types';

export const mockUsers: SystemUser[] = [
  { id: 'u1', name: '陆永奇', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', role: '管理员', email: 'lu.yq@davinci.ai', status: 'online', joinedDate: '2025-01-15' },
  { id: 'u2', name: '陈美晴', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', role: '高级设计师', email: 'chen.mq@davinci.ai', status: 'online', joinedDate: '2025-03-22' },
  { id: 'u3', name: '张思豪', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', role: '运营策划', email: 'zhang.sh@davinci.ai', status: 'offline', joinedDate: '2025-05-10' },
  { id: 'u4', name: '林若云', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80', role: '协同客户', email: 'client.lin@nike.com', status: 'online', joinedDate: '2026-02-18' }
];

export const mockNotifications: SystemNotification[] = [
  { id: 'n1', title: '任务生成成功', content: '「智能运动手表_夏日活力宣传图」批次生成已完成（10/10），已自动存入资源中心。', type: 'success', time: '10 分钟前', read: false },
  { id: 'n2', title: '算力额度预警', content: '本月企业算力点数已使用 78.4%，建议及时补充以免影响批次任务。', type: 'warning', time: '1 小时前', read: false },
  { id: 'n3', title: '任务生成失败', content: '「极地防寒羽绒服_动态飞雪场景短视频」由于底图复杂度过高导致渲染超时（Error Code: 504）。', type: 'error', time: '2 小时前', read: true },
  { id: 'n4', title: '新模板审核提醒', content: '设计师 陈美晴 提交了「3D极简展示模板」待审核发布。', type: 'info', time: '1 天前', read: true }
];

export const mockModelChannels: ModelChannel[] = [
  { id: 'm1', name: 'DaVinci Vision v3.5 (自研推荐)', provider: 'DaVinci Core', status: 'active', todayUsage: 1420, limit: 5000, latency: '1.2s' },
  { id: 'm2', name: 'Midjourney v6.1 High-Res Proxy', provider: 'Midjourney', status: 'active', todayUsage: 890, limit: 2000, latency: '4.5s' },
  { id: 'm3', name: 'Stable Diffusion 3.5 Large Inpaint', provider: 'Stable Diffusion', status: 'active', todayUsage: 350, limit: 3000, latency: '1.8s' },
  { id: 'm4', name: 'Runway Gen-3 Alpha Video API', provider: 'Runway', status: 'active', todayUsage: 120, limit: 500, latency: '8.2s' },
  { id: 'm5', name: 'Kling AI 1.5 Pro Video Engine', provider: 'Kling AI', status: 'inactive', todayUsage: 0, limit: 500, latency: 'N/A' }
];

export const mockProducts: ProductAsset[] = [
  {
    id: 'p1',
    name: 'MW Series 7 智联运动手表',
    sku: 'SKU-MW7-BLK',
    category: '智能硬件',
    imageCount: 12,
    videoCount: 3,
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80',
    addedTime: '2026-06-15',
    specs: {
      brand: 'MatrixWear',
      color: ['曜石黑', '极光银', '深海蓝'],
      material: '航天级钛金属 + 氟橡胶表带',
      weight: '48.5g',
      sellingPoints: ['双频多星GPS定位', '14天极致续航', '动态血氧/心率深度监测', '50米专业防水']
    },
    files: [
      { id: 'f1_1', name: '手表主体_正面免抠.png', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80', size: '2.4 MB', type: 'image' },
      { id: 'f1_2', name: '手表右侧按键微距.png', url: 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&w=400&q=80', size: '4.1 MB', type: 'image' },
      { id: 'f1_3', name: '钛金属表盘拉丝质感.png', url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=400&q=80', size: '3.8 MB', type: 'image' },
      { id: 'f1_4', name: '表带卡扣与人体工学.mov', url: 'https://assets.mixkit.co/videos/preview/mixkit-smartwatch-on-a-desk-close-up-34440-large.mp4', size: '28.5 MB', type: 'video' }
    ]
  },
  {
    id: 'p2',
    name: 'Nike Air Max Elite 2026 跑鞋',
    sku: 'SKU-NK-AM26-RED',
    category: '户外服饰',
    imageCount: 18,
    videoCount: 5,
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80',
    addedTime: '2026-06-20',
    specs: {
      brand: 'Nike',
      color: ['火焰红', '荧光绿', '极简白'],
      material: 'Flyknit 编织鞋面 + 氮气缓震大底',
      weight: '240g',
      sellingPoints: ['全掌蜂窝氮气气垫', '超透气编织纤维包裹', '抗扭碳纤维支撑片', '夜间反光安全涂层']
    },
    files: [
      { id: 'f2_1', name: '跑鞋免抠主图.png', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80', size: '1.9 MB', type: 'image' },
      { id: 'f2_2', name: '气垫避震拉丝微距.png', url: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=400&q=80', size: '3.2 MB', type: 'image' },
      { id: 'f2_3', name: '编织鞋面特写.png', url: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=400&q=80', size: '2.7 MB', type: 'image' }
    ]
  },
  {
    id: 'p3',
    name: '极致臻颜草本精华保湿乳',
    sku: 'SKU-SKN-ESS-100',
    category: '美妆护肤',
    imageCount: 8,
    videoCount: 2,
    thumbnail: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=500&q=80',
    addedTime: '2026-06-25',
    specs: {
      brand: 'PhytoGlow',
      color: ['乳白色'],
      material: '磨砂防紫外线玻璃瓶',
      weight: '100ml',
      sellingPoints: ['95% 天然草本精萃', '72小时角质层长效锁水', '清爽不粘腻配方', '敏感肌无添加安全认证']
    },
    files: [
      { id: 'f3_1', name: '精华乳白色去背.png', url: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=400&q=80', size: '1.5 MB', type: 'image' },
      { id: 'f3_2', name: '瓶盖磨砂奢华细节.png', url: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=400&q=80', size: '2.9 MB', type: 'image' }
    ]
  },
  {
    id: 'p4',
    name: '超轻便透气抗撕裂防风羽绒服',
    sku: 'SKU-OUT-JKT-GRY',
    category: '户外服饰',
    imageCount: 14,
    videoCount: 4,
    thumbnail: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=500&q=80',
    addedTime: '2026-06-30',
    specs: {
      brand: 'PeakTech',
      color: ['火山灰', '极夜黑', '苔原绿'],
      material: 'DWR防泼水涂层 + 800蓬松白鸭绒',
      weight: '310g',
      sellingPoints: ['极轻量可收纳设计', '防风透湿Gore-Tex结构', '抗撕裂格纹编织面料', '智能恒温蓄热里布']
    },
    files: [
      { id: 'f4_1', name: '羽绒服正面模特展示.png', url: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=400&q=80', size: '3.6 MB', type: 'image' },
      { id: 'f4_2', name: '防泼水面料荷叶效应.png', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80', size: '4.2 MB', type: 'image' }
    ]
  }
];

export const mockTasks: GenerationTask[] = [
  {
    id: 'T-1004',
    name: 'Nike Air Max _ 3D赛博炫彩展示 (批次#1)',
    type: 'image',
    status: 'running',
    progress: 68,
    productName: 'Nike Air Max Elite 2026 跑鞋',
    productImg: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80',
    templateName: '3D 赛博虚拟炫彩展示架',
    timestamp: '2026-07-03 17:42',
    creator: '陈美晴',
    modelChannel: 'DaVinci Vision v3.5 (自研推荐)',
    params: { ratio: '1:1', steps: 30, guidance: 7.5, prompt: 'Glowing neon cyan grid background, floating podium' }
  },
  {
    id: 'T-1003',
    name: '轻便防风羽绒服 _ 动态风雪覆盖 (批次#4)',
    type: 'image',
    status: 'failed',
    progress: 100,
    productName: '超轻便透气抗撕裂防风羽绒服',
    productImg: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=150&q=80',
    templateName: '冬季风雪覆盖深色岩石展示',
    timestamp: '2026-07-03 16:10',
    creator: '陆永奇',
    errorMsg: 'GPU Out of Memory (CUDA Error 2)。建议降低生成批次数量（当前为 10）或减少高保真去噪步数。',
    modelChannel: 'Stable Diffusion 3.5 Large Inpaint',
    params: { ratio: '4:3', steps: 50, guidance: 11.0 }
  },
  {
    id: 'T-1002',
    name: '精华保湿乳 _ 极简北欧大理石展示 (批次#1)',
    type: 'image',
    status: 'completed',
    progress: 100,
    productName: '极致臻颜草本精华保湿乳',
    productImg: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=150&q=80',
    templateName: '极简北欧冷淡风大理石',
    timestamp: '2026-07-03 15:30',
    creator: '陈美晴',
    resultUrl: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=600&q=80',
    modelChannel: 'DaVinci Vision v3.5 (自研推荐)',
    params: { ratio: '3:4', steps: 35, guidance: 8.0 }
  },
  {
    id: 'T-1001',
    name: 'MW Series 7 _ 能量粒子环绕动态视频 (批次#1)',
    type: 'video',
    status: 'completed',
    progress: 100,
    productName: 'MW Series 7 智联运动手表',
    productImg: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80',
    templateName: '动态爆破能量粒子环绕视频',
    timestamp: '2026-07-03 11:15',
    creator: '张思豪',
    resultUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
    modelChannel: 'Runway Gen-3 Alpha Video API',
    params: { ratio: '9:16', steps: 50, guidance: 9.0 }
  },
  {
    id: 'T-1000',
    name: '精华保湿乳 _ 高奢丝绸漂浮 (批次#2)',
    type: 'image',
    status: 'rejected',
    progress: 100,
    productName: '极致臻颜草本精华保湿乳',
    productImg: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=150&q=80',
    templateName: '高奢丝绸缎面优雅漂浮场景',
    timestamp: '2026-07-02 14:05',
    creator: '陈美晴',
    feedback: '高光部分过曝，文字反差度不够，已拒绝。需要调整模型引导系数 (CFG) 到 6.5 以下，重渲染。',
    modelChannel: 'Midjourney v6.1 High-Res Proxy',
    params: { ratio: '1:1', steps: 40, guidance: 12.0 }
  },
  {
    id: 'T-0999',
    name: 'Nike Air Max 炫彩户外海报 (批次#3)',
    type: 'image',
    status: 'completed',
    progress: 100,
    productName: 'Nike Air Max Elite 2026 跑鞋',
    productImg: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80',
    templateName: '盛夏户外阳光与椰影沙滩',
    timestamp: '2026-07-02 09:30',
    creator: '陆永奇',
    resultUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    modelChannel: 'DaVinci Vision v3.5 (自研推荐)',
    params: { ratio: '16:9', steps: 30, guidance: 7.0 }
  },
  {
    id: 'T-0998',
    name: '智能运动手表概念渲染短视频 (批次#2)',
    type: 'video',
    status: 'running',
    progress: 45,
    productName: 'MW Series 7 智联运动手表',
    productImg: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80',
    templateName: '动态爆破能量粒子环绕视频',
    timestamp: '2026-07-01 16:40',
    creator: '张思豪',
    modelChannel: 'Runway Gen-3 Alpha Video API',
    params: { ratio: '9:16', steps: 60, guidance: 8.5 }
  },
  {
    id: 'T-0997',
    name: '防风羽绒服 _ 极地探险图 (批次#1)',
    type: 'image',
    status: 'completed',
    progress: 100,
    productName: '超轻便透气抗撕裂防风羽绒服',
    productImg: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=150&q=80',
    templateName: '冬季风雪覆盖深色岩石展示',
    timestamp: '2026-07-01 10:15',
    creator: '陈美晴',
    resultUrl: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=600&q=80',
    modelChannel: 'Stable Diffusion 3.5 Large Inpaint',
    params: { ratio: '4:3', steps: 35, guidance: 8.5 }
  },
  {
    id: 'T-0996',
    name: '极致草本精华白色背景主图 (批次#1)',
    type: 'image',
    status: 'completed',
    progress: 100,
    productName: '极致臻颜草本精华保湿乳',
    productImg: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=150&q=80',
    templateName: '极简北欧冷淡风大理石',
    timestamp: '2026-06-30 14:12',
    creator: '陆永奇',
    resultUrl: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=600&q=80',
    modelChannel: 'DaVinci Vision v3.5 (自研推荐)',
    params: { ratio: '1:1', steps: 25, guidance: 6.5 }
  },
  {
    id: 'T-0995',
    name: 'Nike 跑鞋酷炫旋转飞沙视频 (批次#1)',
    type: 'video',
    status: 'completed',
    progress: 100,
    productName: 'Nike Air Max Elite 2026 跑鞋',
    productImg: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80',
    templateName: '动态爆破能量粒子环绕视频',
    timestamp: '2026-06-29 11:00',
    creator: '张思豪',
    resultUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    modelChannel: 'Kling AI 1.5 Pro Video Engine',
    params: { ratio: '16:9', steps: 80, guidance: 9.5 }
  }
];
