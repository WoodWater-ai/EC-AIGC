import {
  GenerationTask,
  ImageGenerationType,
  ChannelAsyncTask,
  MockModelChannel,
  ModelProfile,
  ProductAsset,
  SystemUser,
  SystemNotification,
} from './types';
import type { AssetResourceItem } from './api/modules/asset';
import type { AssetCategoryNode } from './api/modules/assetCategory';
import type { TemplateDTO } from './api/modules/template';
import type { DictItem } from './api/modules/dict';

export const mockModelChannels: MockModelChannel[] = [
  {
    id: 'cloud-vision',
    accessType: 'cloud',
    name: '云端 API',
    health: 'healthy',
    quotaText: '本月可用额度 68%',
    models: [
      {
        id: 'gpt-image-2',
        name: 'GPT Image 2 · 保真优先',
        description: '适合商品主体、局部修改和参考图一致性。',
        capability: { ratios: ['1:1', '3:4', '4:5', '9:16', '16:9'], maxCount: 4, resolutions: ['1024px', '1536px', '2048px'], maxReferenceImages: 4, durations: [5, 8], motions: ['轻微', '适中'] },
        cost: 8.8,
      },
      {
        id: 'imagen-stable',
        name: 'Imagen · 稳定出图',
        description: '适合高频商品主图与场景图。',
        capability: { ratios: ['1:1', '3:4', '4:5', '16:9'], maxCount: 4, resolutions: ['1024px', '1536px'], maxReferenceImages: 2, durations: [5], motions: ['轻微'] },
        cost: 6.2,
      },
    ],
  },
  {
    id: 'relay-studio',
    accessType: 'relay',
    name: '中转站',
    health: 'quota_low',
    quotaText: '剩余低于 20%，提交前请确认成本',
    models: [
      {
        id: 'vidu-q2',
        name: 'Vidu Q2 · 图生视频',
        description: '支持参考图驱动的短视频生成。',
        capability: { ratios: ['9:16', '16:9', '1:1'], maxCount: 2, resolutions: ['720p', '1080p'], maxReferenceImages: 3, durations: [5, 8, 15], motions: ['轻微', '适中', '强烈'] },
        cost: 18,
      },
    ],
  },
  {
    id: 'local-lab',
    accessType: 'local',
    name: '本地模型',
    health: 'maintenance',
    quotaText: '维护中，暂不可提交',
    models: [
      {
        id: 'flux-local',
        name: 'Flux · 本地试验通道',
        description: '用于内部效果对比。',
        capability: { ratios: ['1:1', '3:4'], maxCount: 2, resolutions: ['1024px'], maxReferenceImages: 1 },
        cost: 2.5,
      },
    ],
  },
];

export const mockModelProfiles: ModelProfile[] = [
  { id: 'model-1', name: '林澈 · 清冷通勤', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', source: '虚拟模特', tags: ['通勤', '高级脸', '轻熟'], suitableFor: ['product_main', 'scene_detail', 'on_model'], reason: '适合极简通勤和轻奢女装表达。' },
  { id: 'model-2', name: '周野 · 运动街头', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80', source: '授权参考', tags: ['运动', '街头', '力量感'], suitableFor: ['scene_detail', 'on_model'], reason: '适合鞋服和运动配件的动态场景。' },
  { id: 'model-3', name: '顾南 · 自然生活', image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=300&q=80', source: '内部素材', tags: ['自然', '亲和', '生活方式'], suitableFor: ['product_main', 'scene_detail'], reason: '适合美妆和生活方式类商品。' },
];

const mockTemplateTime = '2026-07-15 10:00:00';

const makeMockDictItems = (categoryCode: string, items: Array<[string, string]>): DictItem[] => items.map(([itemCode, itemName], index) => ({
  id: `${categoryCode}-${itemCode}`,
  categoryId: categoryCode,
  itemCode,
  itemName,
  sort: index + 1,
  status: 'NORMAL',
}));

/** 模板中心抽屉的所有枚举在 mock 模式下从这里读取。 */
export const mockTemplateDicts: Record<string, DictItem[]> = {
  IMAGE_TASK_TYPE: makeMockDictItems('IMAGE_TASK_TYPE', [['MAIN', '商品主图'], ['SCENE', '详情/场景图'], ['DETAIL', '细节图'], ['MODEL', '上身/三视图']]),
  STYLE_DIMENSION: makeMockDictItems('STYLE_DIMENSION', [
    ['SWEET', '甜美网红风 (Sweet Influencer)'],
    ['NORDIC', '极简北欧风 (Minimalist Nordic)'],
    ['CYBER', '科技赛博风 (Cyberpunk Cyber)'],
    ['AUTUMN', '金秋自然风 (Autumn Natural)'],
    ['SILK', '奢华丝绸风 (Elegant Silk Satin)'],
  ]),
  VIDEO_MODE: makeMockDictItems('VIDEO_MODE', [['IMG2VIDEO', '首帧图生视频'], ['REFERENCE2VIDEO', '参考图生视频'], ['TRENDING_REPLICATE', '爆款复刻']]),
  VIDEO_DURATION: makeMockDictItems('VIDEO_DURATION', [['5', '5 秒'], ['8', '8 秒'], ['15', '15 秒']]),
  VIDEO_MOTION: makeMockDictItems('VIDEO_MOTION', [['LIGHT', '轻微'], ['MEDIUM', '适中'], ['STRONG', '强烈']]),
  TASK_TYPE: makeMockDictItems('TASK_TYPE', [['PRODUCT_MAIN', '商品主图'], ['DETAIL_PAGE', '详情页'], ['CONTENT_SEEDING', '内容种草']]),
  PLATFORM_FORMAT: makeMockDictItems('PLATFORM_FORMAT', [['JPG', 'JPG'], ['PNG', 'PNG'], ['WEBP', 'WEBP']]),
  NC_ASSET_SCOPE: makeMockDictItems('NC_ASSET_SCOPE', [['IMAGE', '图片任务'], ['VIDEO', '视频任务'], ['ALL', '全部任务']]),
  NC_SEVERITY: makeMockDictItems('NC_SEVERITY', [['LOW', '提示'], ['MEDIUM', '建议'], ['HIGH', '强制']]),
  NC_CATEGORY: makeMockDictItems('NC_CATEGORY', [['QUALITY', '质量'], ['PRODUCT', '商品主体'], ['HUMAN', '人物'], ['BRAND', '品牌合规']]),
  TEMPLATE_TASK_TYPE: makeMockDictItems('TEMPLATE_TASK_TYPE', [['PRODUCT_IMAGE', '商品生图'], ['SCENE_BLEND', '场景融合'], ['VIDEO_SCRIPT', '视频脚本'], ['SPEC_LAYOUT', '规格排版'], ['NEGATIVE_PROMPT', '负面提示']]),
};

/** 五类模板中心 Demo 数据；真实后端接入时仅替换此数据来源。 */
export const mockTemplates: TemplateDTO[] = [
  {
    id: 'tpl-image-main', templateName: '电商商品主图', templateKind: 'IMAGE_TASK', promptBody: '商品主体居中，干净商业光线，保留品牌、材质与边缘细节。', variables: '[]', defaultCount: 4, defaultRatio: '1:1', defaultStyle: '极简北欧风 (Minimalist Nordic)', applicableCategories: '通用', imageTaskType: 'MAIN', status: 'NORMAL', usageCount: 286, passRate: 0.93, avgCost: 8.8, avgScore: 4.6, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-image-model', templateName: '服装上身展示', templateKind: 'IMAGE_TASK', promptBody: '模特自然展示服装，确保版型、材质和商品细节真实，手部不遮挡主体。', variables: '[]', defaultCount: 2, defaultRatio: '4:5', defaultStyle: '甜美网红风 (Sweet Influencer)', applicableCategories: '服装', imageTaskType: 'MODEL', status: 'NORMAL', usageCount: 142, passRate: 0.9, avgCost: 10.2, avgScore: 4.4, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-style-nordic', templateName: '自然影棚柔光', templateKind: 'STYLE_SCENE', promptBody: '使用干净的柔光台面、克制阴影和明确的商品轮廓。', variables: '[]', defaultStyle: '极简北欧风 (Minimalist Nordic)', defaultScene: '自然影棚', defaultPose: '静态正面', status: 'NORMAL', usageCount: 198, passRate: 0.94, avgCost: 7.2, avgScore: 4.7, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-style-silk', templateName: '奢华丝绸陈列', templateKind: 'STYLE_SCENE', promptBody: '低饱和丝绸光泽、精致陈列和柔和渐变，强调高级材质。', variables: '[]', defaultStyle: '奢华丝绸风 (Elegant Silk Satin)', defaultScene: '精品陈列台', defaultPose: '静态特写', status: 'NORMAL', usageCount: 96, passRate: 0.88, avgCost: 8.6, avgScore: 4.5, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-video-img', templateName: '商品动态展示', templateKind: 'VIDEO_PROMPT', promptBody: '首帧稳定建立画面，缓慢推进展示商品材质，结尾聚焦核心卖点。', variables: '[]', videoDefaultDurationSec: 8, videoDefaultResolution: '1080p', videoDefaultMotion: '适中', videoThreePartStructure: JSON.stringify({ opening: '建立画面，锁定商品主体。', dynamic: '镜头缓慢推进，展示商品动作与质感。', detailEnding: '微距收束，突出核心卖点。' }), status: 'NORMAL', usageCount: 173, passRate: 0.89, avgCost: 18, avgScore: 4.3, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-video-trending', templateName: '爆款节奏复刻', templateKind: 'VIDEO_PROMPT', promptBody: '保留原视频的镜头节奏和爆点，使用新商品、模特和场景完成替换。', variables: '[]', videoDefaultDurationSec: 15, videoDefaultResolution: '1080p', videoDefaultMotion: '适中', status: 'NORMAL', usageCount: 51, passRate: 0.84, avgCost: 22, avgScore: 4.2, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-spec-main', templateName: '电商主图推荐', templateKind: 'PLATFORM_SPEC', promptBody: '电商主图推荐预设。', variables: '[]', platformUsage: '商品主图', platformFormat: 'JPG', platformRecommendedRatio: '1:1', platformWidth: 2048, platformHeight: 2048, platformMaxFileSize: '10MB', platformIsDefaultRecommended: 'Y', status: 'NORMAL', usageCount: 325, passRate: 0.95, avgCost: 8.8, avgScore: 4.7, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-spec-seeding', templateName: '内容种草竖图', templateKind: 'PLATFORM_SPEC', promptBody: '内容种草竖图推荐预设。', variables: '[]', platformUsage: '内容种草', platformFormat: 'PNG', platformRecommendedRatio: '4:5', platformWidth: 1536, platformHeight: 1920, platformMaxFileSize: '8MB', platformIsDefaultRecommended: 'N', status: 'NORMAL', usageCount: 118, passRate: 0.91, avgCost: 8.8, avgScore: 4.4, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-negative-image', templateName: '商品保真约束', templateKind: 'NEGATIVE_CONSTRAINT', promptBody: '商品漂移、错误文字、材质失真、边缘模糊、品牌标识错误。', variables: '[]', ncAssetKindScope: 'IMAGE', ncSeverity: 'HIGH', ncDefaultEnabled: 'Y', ncConflictRules: '商品主体、文字和品牌标识优先保真。', status: 'NORMAL', usageCount: 407, passRate: 0.96, avgCost: 0, avgScore: 4.8, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
  {
    id: 'tpl-negative-video', templateName: '视频稳定性约束', templateKind: 'NEGATIVE_CONSTRAINT', promptBody: '商品主体漂移、面料闪烁、人物畸形、镜头突变、文字变化。', variables: '[]', ncAssetKindScope: 'VIDEO', ncSeverity: 'HIGH', ncDefaultEnabled: 'Y', ncConflictRules: '首帧商品主体和构图优先级最高。', status: 'NORMAL', usageCount: 189, passRate: 0.92, avgCost: 0, avgScore: 4.5, createTime: mockTemplateTime, updateTime: mockTemplateTime,
  },
];

export const imageTypePromptHints: Record<ImageGenerationType, string> = {
  product_main: '纯净商业主图，商品主体完整、边缘清晰，保留品牌与材质细节。',
  scene_detail: '商品融入指定场景，强化氛围、使用感和商业叙事。',
  detail_closeup: '聚焦材质、工艺与关键卖点，使用微距和局部光影。',
  on_model: '模特自然展示商品，确保上身比例、姿态和商品细节真实。',
};

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

/** 资源中心在 mock 模式下使用的 Demo 分类与素材，可直接替换为多维表格/API 数据源。 */
export const mockAssetCategories: AssetCategoryNode[] = [
  { id: 10, parentId: 0, categoryName: '商品素材', categoryKind: 'IMAGE', children: [
    { id: 11, parentId: 10, categoryName: '商品主体图', categoryKind: 'IMAGE' },
    { id: 12, parentId: 10, categoryName: '细节参考图', categoryKind: 'IMAGE' },
  ] },
  { id: 20, parentId: 0, categoryName: '场景与风格', categoryKind: 'IMAGE', children: [
    { id: 21, parentId: 20, categoryName: '风格参考', categoryKind: 'IMAGE' },
    { id: 22, parentId: 20, categoryName: '场景参考', categoryKind: 'IMAGE' },
    { id: 23, parentId: 20, categoryName: '姿势参考', categoryKind: 'IMAGE' },
  ] },
  { id: 40, parentId: 0, categoryName: '服饰搭配', categoryKind: 'IMAGE', children: [
    { id: 41, parentId: 40, categoryName: '上衣素材', categoryKind: 'IMAGE' },
    { id: 42, parentId: 40, categoryName: '下装素材', categoryKind: 'IMAGE' },
  ] },
  { id: 30, parentId: 0, categoryName: '模特素材', categoryKind: 'IMAGE' },
];

export const mockAssetResources: AssetResourceItem[] = [
  ...mockProducts.flatMap((product, productIndex) => product.files.map((file, fileIndex) => ({
    id: 100 + productIndex * 10 + fileIndex,
    fileResourceId: 1000 + productIndex * 10 + fileIndex,
    name: file.name,
    assetKind: file.type === 'video' ? 'VIDEO' as const : 'IMAGE' as const,
    originalUrl: file.url,
    thumbnailUrl: file.url,
    fileSize: Number.parseFloat(file.size) * 1024 * 1024,
    tags: fileIndex === 0 ? '商品原图,商品主体' : '细节参考图,商品细节',
    uploadUserId: 1,
    status: 'NORMAL' as const,
    categoryIds: [fileIndex === 0 ? 11 : 12],
    createTime: '2026-07-13T10:00:00',
  }))),
  ...mockModelProfiles.map((profile, index) => ({
    id: 200 + index,
    fileResourceId: 1200 + index,
    name: `${profile.name} 模特参考图`,
    assetKind: 'IMAGE' as const,
    originalUrl: profile.image,
    thumbnailUrl: profile.image,
    tags: `模特,${profile.source}`,
    uploadUserId: 1,
    status: 'NORMAL' as const,
    categoryIds: [30],
    createTime: '2026-07-13T10:00:00',
  })),
  {
    id: 301, fileResourceId: 1301, name: '奢华丝绸光影风格板.jpg', assetKind: 'IMAGE',
    originalUrl: 'https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?auto=format&fit=crop&w=600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?auto=format&fit=crop&w=600&q=80',
    tags: '风格参考,奢华丝绸风', uploadUserId: 1, status: 'NORMAL', categoryIds: [21], createTime: '2026-07-13T10:00:00',
  },
  {
    id: 302, fileResourceId: 1302, name: '自然影棚柔光台面.jpg', assetKind: 'IMAGE',
    originalUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    tags: '场景参考,自然影棚', uploadUserId: 1, status: 'NORMAL', categoryIds: [22], createTime: '2026-07-13T10:00:00',
  },
  {
    id: 303, fileResourceId: 1303, name: '自然正面站姿参考.jpg', assetKind: 'IMAGE',
    originalUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
    tags: '姿势参考,自然正面', uploadUserId: 1, status: 'NORMAL', categoryIds: [23], createTime: '2026-07-13T10:00:00',
  },
  {
    id: 304, fileResourceId: 1304, name: '奶油白针织上衣.png', assetKind: 'IMAGE',
    originalUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=600&q=80',
    tags: '上衣,服饰搭配', uploadUserId: 1, status: 'NORMAL', categoryIds: [41], createTime: '2026-07-13T10:00:00',
  },
  {
    id: 305, fileResourceId: 1305, name: '直筒牛仔下装.png', assetKind: 'IMAGE',
    originalUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80',
    tags: '下装,服饰搭配', uploadUserId: 1, status: 'NORMAL', categoryIds: [42], createTime: '2026-07-13T10:00:00',
  },
];

export const mockChannelAsyncTasks: ChannelAsyncTask[] = [
  { id: '9001', bizId: 'I-20260715-1', channelId: 'relay-studio', channelType: 'VIDU', capability: 'IMAGE_TO_VIDEO', remoteTaskId: 'vidu_mock_9001', resultType: 'VIDEO', resultCount: 1, status: 'SUCCESS', claimedBy: 'worker-video-01', claimedAt: '2026-07-15T09:20:04', retryCount: 0, nextRetryTime: null, failReason: null, submitterUserId: 'u1', startedAt: '2026-07-15T09:20:00', finishedAt: '2026-07-15T09:20:28', durationMs: 28000, requestPayload: '{"duration":8,"mode":"reference2video"}', responsePayload: '{"resultCount":1}', createTime: '2026-07-15T09:20:00' },
  { id: '9002', bizId: 'I-20260715-2', channelId: 'relay-studio', channelType: 'VIDU', capability: 'IMAGE_TO_VIDEO', remoteTaskId: 'vidu_mock_9002', resultType: null, resultCount: 0, status: 'PROCESSING', claimedBy: 'worker-video-02', claimedAt: '2026-07-15T09:24:03', retryCount: 0, nextRetryTime: null, failReason: null, submitterUserId: 'u1', startedAt: '2026-07-15T09:24:00', finishedAt: null, durationMs: null, requestPayload: '{"duration":5,"mode":"img2video"}', responsePayload: null, createTime: '2026-07-15T09:24:00' },
  { id: '9003', bizId: 'I-20260715-3', channelId: 'cloud-vision', channelType: 'OPENAI', capability: 'MAIN_IMAGE', remoteTaskId: null, resultType: null, resultCount: 0, status: 'FAILED', claimedBy: 'worker-image-01', claimedAt: '2026-07-15T09:27:04', retryCount: 1, nextRetryTime: '2026-07-15T09:32:00', failReason: '模拟通道超时，可重试。', submitterUserId: 'u1', startedAt: '2026-07-15T09:27:00', finishedAt: '2026-07-15T09:27:45', durationMs: 45000, requestPayload: '{"ratio":"1:1"}', responsePayload: '{"error":"timeout"}', createTime: '2026-07-15T09:27:00' },
];

export const mockReferenceAnalysisByFileId: Record<number, {
  style?: string;
  scene?: string;
  pose?: string;
  promptHint: string;
}> = {
  1001: { promptHint: '突出表冠、按键与金属边缘的微距细节，避免过度锐化。' },
  1011: { promptHint: '突出气垫纹理和缓震层次，保持材质的真实反光。' },
  1021: { promptHint: '突出磨砂瓶盖与玻璃材质，保留瓶身文字的可读性。' },
  1031: { promptHint: '突出防泼水面料和水珠接触细节，保留织物纹理。' },
  1301: { style: '奢华丝绸风 (Elegant Silk Satin)', promptHint: '参考丝绸的低饱和光泽、柔和渐变与精致陈列质感。' },
  1302: { scene: '自然影棚', promptHint: '使用干净的柔光台面、克制阴影和明确的商品轮廓。' },
  1303: { pose: '自然正面', promptHint: '保持自然正面站姿，手部不遮挡商品主体。' },
};

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
