export type TemplateMediaType = 'image' | 'video';

export interface DashboardTemplate {
  id: string;
  name: string;
  mediaType: TemplateMediaType;
  status: 'active' | 'disabled';
  version: number;
  coverUrl: string;
  hoverPreviewUrl?: string;
  description: string;
  category: string;
  usage: string;
  style: string;
  usageCount: number;
  viewCount: number;
  favoriteCount: number;
  sourceTaskId: string;
  sourceProductName: string;
  createdAt: string;
  type: string;
  scene: string;
  poseOrShot: string;
}

const templates: Omit<DashboardTemplate, 'viewCount' | 'favoriteCount'>[] = [
  {
    id: 'I01', name: '静奢缎面晨光', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/quiet-satin-morning.jpg',
    description: '柔光、低饱和、材质清晰的室内成片。', category: '睡衣 / 轻奢女装',
    usage: '居家 / 商品图', style: '静奢质感', usageCount: 42, sourceTaskId: 'T-1002',
    sourceProductName: '雾蓝紫碎花蕾丝睡裙', createdAt: '2026-07-02 14:24',
    type: '模特上身', scene: '窗边安静居家', poseOrShot: '自然站姿',
  },
  {
    id: 'I02', name: '东方雅致轻熟', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/eastern-elegance.jpg',
    description: '克制雅致的中式空间与留白构图。', category: '轻熟女装 / 连衣裙',
    usage: '女装 / 场景图', style: '东方雅致', usageCount: 37, sourceTaskId: 'T-0996',
    sourceProductName: '东方轻奢家居套装', createdAt: '2026-06-30 14:12',
    type: '模特上身', scene: '东方雅致空间', poseOrShot: '三分之四侧身',
  },
  {
    id: 'I04', name: '甜酷暗黑辣妹', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/dark-sweet-cool.jpg',
    description: '深色边光、利落近景与情绪张力。', category: '潮流女装 / 吊带',
    usage: '女装 / 场景图', style: '甜酷暗黑', usageCount: 35, sourceTaskId: 'T-0995',
    sourceProductName: '甜酷修身吊带连衣裙', createdAt: '2026-06-29 11:00',
    type: '模特上身', scene: '纯白棚拍', poseOrShot: '自然站姿',
  },
  {
    id: 'V01', name: '静奢缎面慢镜头', mediaType: 'video', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/quiet-satin-video.jpg',
    hoverPreviewUrl: '/mock-assets/template-gallery/quiet-satin-video-preview.mp4',
    description: '轻微转身，稳定展现缎面质感。', category: '缎面睡衣 / 家居服',
    usage: '居家 / 质感展示', style: '静奢质感', usageCount: 28, sourceTaskId: 'T-0995',
    sourceProductName: '雾蓝紫碎花蕾丝睡裙', createdAt: '2026-06-29 11:00',
    type: '真人图参考', scene: '安静居家', poseOrShot: '轻微运镜',
  },
  {
    id: 'I03', name: '新中式庭院出片', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/new-chinese-garden.jpg',
    description: '庭院自然光、木质肌理与纵向留白。', category: '新中式 / 改良旗袍',
    usage: '女装 / 场景图', style: '东方雅致', usageCount: 26, sourceTaskId: 'T-0996',
    sourceProductName: '新中式刺绣长裙', createdAt: '2026-06-28 10:00',
    type: '模特上身', scene: '新中式庭院', poseOrShot: '自然站姿',
  },
  {
    id: 'I05', name: '多巴胺元气居家', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/dopamine-home.jpg',
    description: '明快纯色与自然抓拍感。', category: '睡衣 / 少女家居服',
    usage: '居家 / 商品图', style: '多巴胺元气', usageCount: 24, sourceTaskId: 'T-1002',
    sourceProductName: '少女印花家居裙', createdAt: '2026-06-27 10:00',
    type: '模特上身', scene: '明亮居家', poseOrShot: '自然抓拍',
  },
  {
    id: 'I06', name: '奶油甜妹卧室', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/creamy-bedroom.jpg',
    description: '奶油柔光、亲近日常与温柔氛围。', category: '睡衣 / 家居服',
    usage: '居家 / 商品图', style: '奶油柔光', usageCount: 22, sourceTaskId: 'T-1002',
    sourceProductName: '蕾丝边家居睡裙', createdAt: '2026-06-26 10:00',
    type: '模特上身', scene: '奶油甜妹卧室', poseOrShot: '床边坐姿',
  },
  {
    id: 'I07', name: '复古田园居家叙事', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/vintage-home.jpg',
    description: '窗边自然光与细节穿插的故事感。', category: '棉麻睡衣 / 家居服',
    usage: '居家 / 叙事图', style: '复古田园', usageCount: 19, sourceTaskId: 'T-0996',
    sourceProductName: '棉麻印花睡衣', createdAt: '2026-06-25 10:00',
    type: '场景细节', scene: '复古田园空间', poseOrShot: '自然站姿',
  },
  {
    id: 'I08', name: '高转化店主试穿', mediaType: 'image', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/owner-tryon.jpg',
    description: '商品清晰、版型可见的真实试穿视角。', category: '睡衣 / 日常女装',
    usage: '试穿 / 商品图', style: '真实试穿', usageCount: 17, sourceTaskId: 'T-0996',
    sourceProductName: '日常居家睡衣套装', createdAt: '2026-06-24 10:00',
    type: '模特上身', scene: '居家试穿', poseOrShot: '正面试穿',
  },
  {
    id: 'V02', name: '多巴胺元气动态', mediaType: 'video', status: 'active', version: 1,
    coverUrl: '/mock-assets/template-gallery/dopamine-video.jpg',
    hoverPreviewUrl: '/mock-assets/template-gallery/dopamine-video-preview.mp4',
    description: '轻快转身与明亮居家节奏。', category: '少女睡衣 / 家居服',
    usage: '居家 / 节奏展示', style: '多巴胺元气', usageCount: 15, sourceTaskId: 'T-0995',
    sourceProductName: '雾蓝紫碎花蕾丝睡裙', createdAt: '2026-06-23 10:00',
    type: '爆款复刻', scene: '明亮居家', poseOrShot: '适中运镜',
  },
];

export const mockDashboardTemplates: DashboardTemplate[] = templates.map((template, index) => ({
  ...template,
  viewCount: 328 - index * 23,
  favoriteCount: 32 - Math.min(index * 2, 18),
}));
