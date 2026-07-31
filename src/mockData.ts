import {
  GenerationTask,
  ImageGenerationType,
  ChannelAsyncTask,
  MockModelChannel,
  ModelProfile,
  ProductAsset,
  SystemUser,
  SystemNotification,
  VisualPromptTagCatalog,
} from './types';
import type { AssetResourceItem } from './api/modules/asset';
import type { AssetCategoryNode } from './api/modules/assetCategory';
import type { TemplateDTO } from './api/modules/template';
import type { DictItem } from './api/modules/dict';

/**
 * 来自已采集风格样本的可视化选择配置。
 * 每个枚举均使用项目内自有的效果提示图，避免将外部参考素材带入产品界面。
 */
export const mockImagePromptVisualTags: VisualPromptTagCatalog = {
  styles: [
    { id: 'SWEET_CREAMY', label: '奶油甜妹卧室', description: '柔光、浅色床品与轻松生活感', previewImage: '/mock-assets/tag-icons/style-sweet-creamy.png', defaultSceneId: 'CREAMY_BEDROOM', defaultPoseId: 'NATURAL_STAND', sceneIds: ['CREAMY_BEDROOM', 'QUIET_WINDOW'], poseIds: ['NATURAL_STAND', 'BED_EDGE_SIT', 'LOOK_BACK'] },
    { id: 'QUIET_LUXURY', label: '静奢深睡品质感', description: '灰绿低饱和、垂感面料与窗边漫反射', previewImage: '/mock-assets/tag-icons/style-quiet-luxury.png', defaultSceneId: 'QUIET_WINDOW', defaultPoseId: 'WINDOW_WALK', sceneIds: ['QUIET_WINDOW', 'LIGHT_HOME', 'DARK_HOME'], poseIds: ['NATURAL_STAND', 'BED_EDGE_SIT', 'WINDOW_WALK'] },
    { id: 'VINTAGE_HOME', label: '复古田园居家', description: '旧木、奶油织物与柔和晨光', previewImage: '/mock-assets/tag-icons/style-vintage-home.png', defaultSceneId: 'VINTAGE_WOOD', defaultPoseId: 'BED_EDGE_SIT', sceneIds: ['VINTAGE_WOOD', 'QUIET_WINDOW'], poseIds: ['BED_EDGE_SIT', 'WINDOW_WALK', 'SLEEVE_ADJUST'] },
    { id: 'EASTERN_MATURE', label: '东方雅致轻熟', description: '雾蓝米白、端庄实穿与温和日光', previewImage: '/mock-assets/tag-icons/style-eastern-mature.png', defaultSceneId: 'LIGHT_HOME', defaultPoseId: 'THREE_QUARTER', sceneIds: ['LIGHT_HOME', 'QUIET_WINDOW', 'CHINESE_MINIMAL'], poseIds: ['NATURAL_STAND', 'THREE_QUARTER', 'SLEEVE_ADJUST'] },
    { id: 'NEW_CHINESE_MINIMAL', label: '新中式雅致', description: '留白、木质与低饱和东方线条', previewImage: '/mock-assets/tag-icons/style-new-chinese-minimal.png', defaultSceneId: 'CHINESE_MINIMAL', defaultPoseId: 'SLEEVE_ADJUST', sceneIds: ['CHINESE_MINIMAL', 'LIGHT_HOME'], poseIds: ['NATURAL_STAND', 'THREE_QUARTER', 'SLEEVE_ADJUST'] },
    { id: 'DOPAMINE_PLAYFUL', label: '多巴胺元气居家', description: '粉橘黄绿的明快生活氛围', previewImage: '/mock-assets/tag-icons/style-dopamine-playful.png', defaultSceneId: 'COLORFUL_ROOM', defaultPoseId: 'TURN_BACK', sceneIds: ['COLORFUL_ROOM', 'CREAMY_BEDROOM'], poseIds: ['NATURAL_STAND', 'TURN_BACK', 'LOOK_BACK'] },
    { id: 'DARK_GOTHIC', label: '甜酷暗黑辣妹', description: '黑银侧光、修身线条与画册感', previewImage: '/mock-assets/tag-icons/style-dark-gothic.png', defaultSceneId: 'DARK_HOME', defaultPoseId: 'LOOK_BACK', sceneIds: ['DARK_HOME', 'WHITE_STUDIO'], poseIds: ['NATURAL_STAND', 'THREE_QUARTER', 'LOOK_BACK'] },
    { id: 'SWEET_COOL_STREET', label: '甜酷美式街头', description: '低角度直给、轻松反差与个性细节', previewImage: '/mock-assets/tag-icons/style-sweet-cool-street.png', defaultSceneId: 'WHITE_STUDIO', defaultPoseId: 'THREE_QUARTER', sceneIds: ['WHITE_STUDIO', 'COLORFUL_ROOM'], poseIds: ['NATURAL_STAND', 'THREE_QUARTER', 'TURN_BACK'] },
    { id: 'FRENCH_FEMININE', label: '法式轻奢裙装', description: '柔和轮廓、自然光与轻盈浪漫', previewImage: '/mock-assets/tag-icons/style-french-feminine.png', defaultSceneId: 'VINTAGE_WOOD', defaultPoseId: 'LOOK_BACK', sceneIds: ['VINTAGE_WOOD', 'QUIET_WINDOW', 'LIGHT_HOME'], poseIds: ['NATURAL_STAND', 'THREE_QUARTER', 'LOOK_BACK'] },
  ],
  scenes: [
    { id: 'CREAMY_BEDROOM', label: '奶油柔光卧室', description: '浅色床品、柔和散射光', previewImage: '/mock-assets/tag-icons/scene-creamy-bedroom.png' },
    { id: 'QUIET_WINDOW', label: '窗边安静居家', description: '自然窗光、留白与真实景深', previewImage: '/mock-assets/tag-icons/scene-quiet-window.png' },
    { id: 'VINTAGE_WOOD', label: '旧木田园空间', description: '木质、织物与温暖晨光', previewImage: '/mock-assets/tag-icons/scene-vintage-wood.png' },
    { id: 'LIGHT_HOME', label: '浅色质感家居', description: '米白雾蓝、干净生活空间', previewImage: '/mock-assets/tag-icons/scene-light-home.png' },
    { id: 'CHINESE_MINIMAL', label: '留白新中式', description: '木质屏风、淡墨绿色与留白', previewImage: '/mock-assets/tag-icons/scene-chinese-minimal.png' },
    { id: 'COLORFUL_ROOM', label: '元气彩色房间', description: '克制彩色道具与明快日光', previewImage: '/mock-assets/tag-icons/scene-colorful-room.png' },
    { id: 'DARK_HOME', label: '暗调缎面居家', description: '深灰暗红、局部高光与私域感', previewImage: '/mock-assets/tag-icons/scene-dark-home.png' },
    { id: 'WHITE_STUDIO', label: '明亮低干扰影棚', description: '商品优先、背景克制、轮廓清晰', previewImage: '/mock-assets/tag-icons/scene-white-studio.png' },
  ],
  poses: [
    { id: 'NATURAL_STAND', label: '自然站姿', description: '全身完整，手部不遮挡商品', previewImage: '/mock-assets/tag-icons/pose-natural-stand.svg' },
    { id: 'THREE_QUARTER', label: '45 度微侧身', description: '兼顾版型轮廓与正面信息', previewImage: '/mock-assets/tag-icons/pose-three-quarter.svg' },
    { id: 'BED_EDGE_SIT', label: '床边自然坐姿', description: '松弛居家，衣摆自然展开', previewImage: '/mock-assets/tag-icons/pose-bed-edge-sit.svg' },
    { id: 'WINDOW_WALK', label: '窗边缓步', description: '展示垂感与衣摆动态', previewImage: '/mock-assets/tag-icons/pose-window-walk.svg' },
    { id: 'SLEEVE_ADJUST', label: '轻整理袖口', description: '突出袖口细节，不遮挡主体', previewImage: '/mock-assets/tag-icons/pose-sleeve-adjust.svg' },
    { id: 'TURN_BACK', label: '轻转身', description: '展示侧背面轮廓与松量', previewImage: '/mock-assets/tag-icons/pose-turn-back.svg' },
    { id: 'LOOK_BACK', label: '侧身回望', description: '保留人物神态，同时保持商品可见', previewImage: '/mock-assets/tag-icons/pose-look-back.svg' },
  ],
};

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
        mediaTypes: ['image'],
        capability: { ratios: ['1:1', '3:4', '4:5', '9:16', '16:9'], maxCount: 5, resolutions: ['1024px', '1536px', '2048px'], maxReferenceImages: 4, durations: [5, 8], motions: ['轻微', '适中'] },
        cost: 8.8,
      },
      {
        id: 'imagen-stable',
        name: 'Imagen · 稳定出图',
        description: '适合高频商品主图与场景图。',
        mediaTypes: ['image'],
        capability: { ratios: ['1:1', '3:4', '4:5', '16:9'], maxCount: 5, resolutions: ['1024px', '1536px'], maxReferenceImages: 2, durations: [5], motions: ['轻微'] },
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
        mediaTypes: ['video'],
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
        mediaTypes: ['image'],
        capability: { ratios: ['1:1', '3:4'], maxCount: 2, resolutions: ['1024px'], maxReferenceImages: 1 },
        cost: 2.5,
      },
    ],
  },
];

export const mockModelProfiles: ModelProfile[] = [
  { id: 'model-senior', name: '银发居家', image: '/mock-assets/reference/model-senior.jpg', source: '内部素材', tags: ['成熟', '居家', '松弛'], suitableFor: ['scene_detail', 'on_model'], reason: '来自飞书参考图，适合成熟舒适的居家睡衣场景。', status: 'active', sourceMode: 'reference', faceAnchor: { assetId: 'model-senior-face', url: '/mock-assets/reference/model-senior.jpg', position: 1, role: 'face_anchor' }, appearanceAnchor: { assetId: 'model-senior-appearance', url: '/mock-assets/reference/model-senior.jpg', position: 1, role: 'appearance_anchor' } },
  { id: 'model-pure', name: '清透温柔', image: '/mock-assets/reference/model-pure.jpg', source: '内部素材', tags: ['清透', '温柔', '居家'], suitableFor: ['product_main', 'scene_detail', 'on_model'], reason: '来自飞书参考图，适合轻柔缎面与蕾丝细节表达。', status: 'active', sourceMode: 'reference', faceAnchor: { assetId: 'model-pure-face', url: '/mock-assets/reference/model-pure.jpg', position: 1, role: 'face_anchor' }, appearanceAnchor: { assetId: 'model-pure-appearance', url: '/mock-assets/reference/model-pure.jpg', position: 1, role: 'appearance_anchor' } },
  { id: 'model-sweet', name: '年轻甜美', image: '/mock-assets/reference/model-sweet.jpg', source: '内部素材', tags: ['甜美', '元气', '居家'], suitableFor: ['scene_detail', 'on_model'], reason: '来自飞书参考图，适合绿色爱心睡衣套装。', status: 'active', sourceMode: 'reference', faceAnchor: { assetId: 'model-sweet-face', url: '/mock-assets/reference/model-sweet.jpg', position: 1, role: 'face_anchor' }, appearanceAnchor: { assetId: 'model-sweet-appearance', url: '/mock-assets/reference/model-sweet.jpg', position: 1, role: 'appearance_anchor' } },
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
    id: 'p-lark-sleepdress-senior',
    larkRecordId: 'rec8NpdFuP',
    name: '藏青碎花蕾丝吊带睡裙',
    sku: 'LARK-rec8NpdFuP',
    category: '服饰家居',
    imageCount: 3,
    videoCount: 0,
    thumbnail: '/mock-assets/lark/sleepdress-senior.jpg',
    addedTime: '2026-06-11',
    specs: {
      brand: '飞书睡衣素材演示',
      color: ['藏青色', '黑色碎花', '黑色蕾丝'],
      material: '仿真丝缎面 + 睫毛蕾丝',
      weight: '未标注',
      sellingPoints: ['V 领细肩带', '黑色睫毛蕾丝拼接', '修身微 A 中长版型', '缎面自然光泽']
    },
    files: [
      { id: 'f-senior-main', larkRecordId: 'rec8NpdFuP', name: '飞书白底图_藏青碎花蕾丝吊带睡裙.jpg', url: '/mock-assets/lark/sleepdress-senior.jpg', size: '176 KB', type: 'image' },
    ],
    fabric: '仿真丝缎面，黑色睫毛蕾丝拼接',
    forbiddenChanges: ['藏青底色', '黑色碎花', 'V 领与细肩带', '领口和下摆的黑色睫毛蕾丝位置'],
  },
  {
    id: 'p-source-green-pajama-set',
    larkRecordId: 'recvlvuL9f9t4A',
    name: '绿色小爱心蕾丝缎面睡衣三件套',
    sku: 'LARK-recvlvuL9f9t4A',
    category: '服饰家居',
    imageCount: 3,
    videoCount: 0,
    thumbnail: '/mock-assets/source/green-pajama-top.jpg',
    addedTime: '2026-06-11',
    specs: {
      brand: '原始资料 / 飞书导入样本',
      color: ['牛油果绿', '黑色爱心', '黑色蕾丝'],
      material: '冰感仿真丝缎面',
      weight: '未标注',
      sellingPoints: ['同色竖条纹肌理', '黑色爱心满印', '蕾丝拼接细节', '宽松居家版型']
    },
    files: [
      { id: 'f-green-top', larkRecordId: 'recvlvuL9f9t4A', name: 'DSC09265_绿色小爱心蕾丝缎面睡衣上衣.jpg', url: '/mock-assets/source/green-pajama-top.jpg', size: '150 KB', type: 'image' },
      { id: 'f-green-shorts', larkRecordId: 'recvlvuMhMPTNx', name: 'DSC09267_绿色小爱心蕾丝缎面睡衣短裤.jpg', url: '/mock-assets/source/green-pajama-shorts.jpg', size: '140 KB', type: 'image' },
      { id: 'f-green-pants', larkRecordId: 'recvlvuNkjWwLx', name: 'DSC09266_绿色小爱心蕾丝缎面睡衣长裤.jpg', url: '/mock-assets/source/green-pajama-pants.jpg', size: '150 KB', type: 'image' },
    ],
    fabric: '冰感仿真丝缎面，黑色蕾丝拼接',
    forbiddenChanges: ['牛油果绿色', '黑色爱心印花', '竖条纹肌理', '黑色蕾丝边与松紧腰结构'],
  },
  {
    id: 'p-lark-sleepdress-pure',
    larkRecordId: 'recvkTkZ6L8rlL',
    name: '雾蓝紫碎花蕾丝缎面睡裙',
    sku: 'LARK-recvkTkZ6L8rlL',
    category: '服饰家居',
    imageCount: 2,
    videoCount: 0,
    thumbnail: '/mock-assets/lark/sleepdress-pure.jpg',
    addedTime: '2026-06-11',
    specs: {
      brand: '飞书睡衣素材演示',
      color: ['雾感蓝紫', '黑色碎花', '黑色蕾丝'],
      material: '丝滑缎面 + 睫毛蕾丝',
      weight: '未标注',
      sellingPoints: ['修身中长吊带版型', 'V 领蕾丝拼接', '双层睫毛蕾丝下摆', '居家与外穿场景适配']
    },
    files: [
      { id: 'f-pure-main', larkRecordId: 'recvkTkZ6L8rlL', name: '飞书白底图_雾蓝紫碎花蕾丝缎面睡裙.jpg', url: '/mock-assets/lark/sleepdress-pure.jpg', size: '159 KB', type: 'image' },
    ],
    fabric: '雾感蓝紫碎花缎面，黑色睫毛蕾丝拼接',
    forbiddenChanges: ['雾蓝紫底色', '黑色碎花', '细肩带和 V 领', '下摆双层黑色睫毛蕾丝'],
  },
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
    productAssetId: product.id,
    larkRecordId: file.larkRecordId ?? product.larkRecordId,
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
    id: 301, fileResourceId: 1301, name: '奶油甜妹卧室风格参考.jpg', assetKind: 'IMAGE',
    originalUrl: '/mock-assets/reference/style-creamy-bedroom.jpg',
    thumbnailUrl: '/mock-assets/reference/style-creamy-bedroom.jpg',
    tags: '风格参考,甜美网红风,奶油甜妹卧室,原始资料', uploadUserId: 1, status: 'NORMAL', categoryIds: [21], createTime: '2026-07-28T10:00:00',
  },
  {
    id: 302, fileResourceId: 1302, name: '轻奢缎面居家场景参考.jpg', assetKind: 'IMAGE',
    originalUrl: '/mock-assets/reference/scene-satin-home.jpg',
    thumbnailUrl: '/mock-assets/reference/scene-satin-home.jpg',
    tags: '场景参考,窗边生活场景,轻奢缎面居家,原始资料', uploadUserId: 1, status: 'NORMAL', categoryIds: [22], createTime: '2026-07-28T10:00:00',
  },
  {
    id: 303, fileResourceId: 1303, name: '店主试穿自然站姿参考.jpg', assetKind: 'IMAGE',
    originalUrl: '/mock-assets/reference/pose-tryon.jpg',
    thumbnailUrl: '/mock-assets/reference/pose-tryon.jpg',
    tags: '姿势参考,自然站姿,原始资料', uploadUserId: 1, status: 'NORMAL', categoryIds: [23], createTime: '2026-07-28T10:00:00',
  },
  {
    id: 304, fileResourceId: 1304, name: 'DSC09265_绿色小爱心睡衣上衣.jpg', assetKind: 'IMAGE',
    originalUrl: '/mock-assets/source/green-pajama-top.jpg',
    thumbnailUrl: '/mock-assets/source/green-pajama-top.jpg',
    tags: '上衣,服饰搭配,商品原图,绿色小爱心', productAssetId: 'p-source-green-pajama-set', larkRecordId: 'recvlvuL9f9t4A', uploadUserId: 1, status: 'NORMAL', categoryIds: [41], createTime: '2026-06-11T10:00:00',
  },
  {
    id: 305, fileResourceId: 1305, name: 'DSC09267_绿色小爱心睡衣短裤.jpg', assetKind: 'IMAGE',
    originalUrl: '/mock-assets/source/green-pajama-shorts.jpg',
    thumbnailUrl: '/mock-assets/source/green-pajama-shorts.jpg',
    tags: '下装,服饰搭配,商品原图,绿色小爱心', productAssetId: 'p-source-green-pajama-set', larkRecordId: 'recvlvuMhMPTNx', uploadUserId: 1, status: 'NORMAL', categoryIds: [42], createTime: '2026-06-11T10:00:00',
  },
  {
    id: 401, fileResourceId: 1401, name: '春季通勤针织衫爆款节奏参考.mp4', assetKind: 'VIDEO',
    originalUrl: 'https://example.invalid/mock-trending-reference.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=640&q=80',
    durationSec: 8, tags: '爆款复刻,视频参考,已授权', uploadUserId: 1, status: 'NORMAL', categoryIds: [], createTime: '2026-07-16T10:00:00',
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
  1000: { style: 'QUIET_LUXURY', scene: 'QUIET_WINDOW', pose: 'BED_EDGE_SIT', promptHint: '保留藏青碎花缎面与睫毛蕾丝，使用安静温暖的居家叙事。' },
  1010: { style: 'SWEET_CREAMY', scene: 'CREAMY_BEDROOM', pose: 'NATURAL_STAND', promptHint: '保留牛油果绿爱心印花和蕾丝拼接，突出宽松睡衣上衣版型。' },
  1011: { style: 'SWEET_CREAMY', scene: 'CREAMY_BEDROOM', pose: 'BED_EDGE_SIT', promptHint: '突出短裤的松紧腰、宽松裤腿和黑色蕾丝裤脚。' },
  1012: { style: 'SWEET_CREAMY', scene: 'QUIET_WINDOW', pose: 'NATURAL_STAND', promptHint: '突出长裤的阔腿垂坠与黑色爱心印花，不改变裤脚蕾丝。' },
  1020: { style: 'VINTAGE_HOME', scene: 'VINTAGE_WOOD', pose: 'THREE_QUARTER', promptHint: '保留雾蓝紫碎花缎面、V 领细肩带与双层睫毛蕾丝下摆。' },
  1200: { pose: 'BED_EDGE_SIT', promptHint: '采用成熟、松弛的居家人物状态。' },
  1201: { pose: 'NATURAL_STAND', promptHint: '采用清透柔和的模特姿态，避免遮挡商品。' },
  1202: { pose: 'NATURAL_STAND', promptHint: '采用年轻甜美的居家试穿姿态，避免夸张动作。' },
  1301: { style: 'SWEET_CREAMY', promptHint: '参考奶油色卧室的柔和光线与甜美生活感。' },
  1302: { scene: 'QUIET_WINDOW', promptHint: '使用轻奢缎面居家场景，保持商品是视觉中心。' },
  1303: { pose: 'NATURAL_STAND', promptHint: '保持自然站姿，手部不遮挡商品主体。' },
};

const sleepdressResultSource = {
  recordId: 'recvkTkZ6L8rlL',
  productName: '雾蓝紫碎花蕾丝睡裙',
  productImg: '/mock-assets/lark/sleepdress-pure.jpg',
} as const;

export const mockTasks: GenerationTask[] = [
  {
    id: 'T-1004',
    name: 'Nike Air Max _ 3D赛博炫彩展示 (批次#1)',
    type: 'image',
    groupId: 'G-20260703-001', groupOrder: 1, submittedAt: '2026-07-03 17:42', imageType: 'product_main',
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
    groupId: 'G-20260703-002', groupOrder: 1, submittedAt: '2026-07-03 16:10', imageType: 'scene_detail',
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
    name: '雾蓝紫碎花蕾丝睡裙 _ 模特上身三视图 (批次#1)',
    type: 'image',
    groupId: 'G-20260702-001', groupOrder: 1, submittedAt: '2026-07-02 14:05', imageType: 'on_model',
    status: 'archived',
    progress: 100,
    productName: sleepdressResultSource.productName,
    productImg: sleepdressResultSource.productImg,
    templateName: '商品上身三视图',
    timestamp: '2026-07-02 14:05',
    creator: '陈美晴',
    taskPrompt: '生成模特正面、侧面、背面上身展示，保持雾蓝紫睡裙的蕾丝花型、吊带结构、裙长和面料质感准确可辨。',
    negativePrompt: '服装款式改变、蕾丝花型错乱、颜色漂移、人物肢体异常、主体模糊',
    results: [
      {
        id: 'T-1002-result-1', url: '/mock-assets/results/sleepdress-three-view.png', version: 1, reviewStage: 'approved',
        sourceRecordId: sleepdressResultSource.recordId, sourceFileName: '1782441429457_0.png',
        aestheticReview: { reviewer: '陈美晴 · 设计/美工', timestamp: '2026-07-02 14:22', rating: 5, tags: ['商业可用'], comment: 'mock 审核：三视图完整，款式和蕾丝细节符合商品事实。', decision: 'approved' },
      },
      {
        id: 'T-1002-result-2', url: '/mock-assets/results/sleepdress-three-view-bedroom.png', version: 2, reviewStage: 'approved', parentImageId: 'T-1002-result-1',
        editInstruction: '保持三视图完整，并调整为柔和居家光线。',
        sourceRecordId: sleepdressResultSource.recordId, sourceFileName: '1782444142221_0.png',
        revisionContext: {
          rootResultId: 'T-1002-result-1', sourceTaskId: 'T-1002', basePrompt: '生成模特正面、侧面、背面上身展示，保持雾蓝紫睡裙的蕾丝花型、吊带结构、裙长和面料质感准确可辨。',
          negativePrompt: '服装款式改变、蕾丝花型错乱、颜色漂移、人物肢体异常、主体模糊', fidelityRules: ['保持睡裙款式、蕾丝花型和雾蓝紫颜色不变', '未标记区域保持原图构图和视觉关系'],
          turns: [{ id: 'edit-demo-1', role: 'user', content: '保持三视图完整，并调整为柔和居家光线。', timestamp: '2026-07-02 14:20', sourceResultId: 'T-1002-result-1' }],
        },
        aestheticReview: { reviewer: '陈美晴 · 设计/美工', timestamp: '2026-07-02 14:24', rating: 4, tags: ['细节质感', '商业可用'], comment: 'mock 审核：居家光线自然，可作为上身展示补充图。', decision: 'approved' },
      },
    ],
    modelChannel: 'DaVinci Vision v3.5 (自研推荐)',
    params: { ratio: '3:4', steps: 35, guidance: 8.0 }
  },
  {
    id: 'T-1001',
    name: 'MW Series 7 _ 能量粒子环绕动态视频 (批次#1)',
    type: 'video',
    groupId: 'G-20260703-003', groupOrder: 1, submittedAt: '2026-07-03 11:15',
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
    name: '雾蓝紫碎花蕾丝睡裙 _ 卧室场景图 (批次#2)',
    type: 'image',
    groupId: 'G-20260702-001', groupOrder: 2, submittedAt: '2026-07-02 14:05', imageType: 'scene_detail',
    status: 'rejected',
    progress: 100,
    productName: sleepdressResultSource.productName,
    productImg: sleepdressResultSource.productImg,
    templateName: '柔光卧室场景展示',
    timestamp: '2026-07-02 14:05',
    creator: '陈美晴',
    taskPrompt: '在柔和卧室环境中展示模特自然站姿，睡裙主体完整可见，保持蕾丝领口、吊带和雾蓝紫花型不变。',
    negativePrompt: '服装遮挡、商品主体过小、颜色失真、裙长变化、人物肢体异常',
    feedback: 'mock 审核：场景留白偏多，需提升商品主体在画面中的占比。',
    results: [
      {
        id: 'T-1000-result-1', url: '/mock-assets/results/sleepdress-bedroom.png', version: 1, reviewStage: 'rejected',
        sourceRecordId: sleepdressResultSource.recordId, sourceFileName: '1782444082176_0.png',
        aestheticReview: { reviewer: '陈美晴 · 设计/美工', timestamp: '2026-07-02 14:28', rating: 3, tags: ['构图问题', '商业可用'], comment: 'mock 审核：场景留白偏多，需提升商品主体在画面中的占比。', decision: 'rejected' },
      },
    ],
    modelChannel: 'Midjourney v6.1 High-Res Proxy',
    params: { ratio: '1:1', steps: 40, guidance: 12.0 }
  },
  {
    id: 'T-0999',
    name: 'Nike Air Max 炫彩户外海报 (批次#3)',
    type: 'image',
    groupId: 'G-20260703-001', groupOrder: 2, submittedAt: '2026-07-03 17:42', imageType: 'scene_detail',
    status: 'completed',
    progress: 100,
    productName: 'Nike Air Max Elite 2026 跑鞋',
    productImg: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80',
    templateName: '盛夏户外阳光与椰影沙滩',
    timestamp: '2026-07-02 09:30',
    creator: '陆永奇',
    taskPrompt: '展示商品局部材质与结构细节，保持原始颜色和边缘清晰。',
    negativePrompt: '细节模糊、材质替换、错误标识',
    resultUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    modelChannel: 'DaVinci Vision v3.5 (自研推荐)',
    params: { ratio: '16:9', steps: 30, guidance: 7.0 }
  },
  {
    id: 'T-0998',
    name: '智能运动手表概念渲染短视频 (批次#2)',
    type: 'video',
    groupId: 'G-20260701-001', groupOrder: 1, submittedAt: '2026-07-01 16:40',
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
    groupId: 'G-20260703-002', groupOrder: 2, submittedAt: '2026-07-03 16:10', imageType: 'detail_closeup',
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
    name: '雾蓝紫碎花蕾丝睡裙 _ 蕾丝细节图 (批次#3)',
    type: 'image',
    groupId: 'G-20260702-001', groupOrder: 3, submittedAt: '2026-07-02 14:05', imageType: 'detail_closeup',
    status: 'candidate',
    progress: 100,
    productName: sleepdressResultSource.productName,
    productImg: sleepdressResultSource.productImg,
    templateName: '蕾丝与面料细节特写',
    timestamp: '2026-06-30 14:12',
    creator: '陆永奇',
    taskPrompt: '近距离展示睡裙蕾丝领口、雾蓝紫提花面料和吊带连接处，保持真实纹理、颜色和花型。',
    negativePrompt: '蕾丝边缘融化、花型错乱、颜色偏移、过度磨皮、局部模糊',
    results: [
      {
        id: 'T-0996-result-1', url: '/mock-assets/results/sleepdress-lace-detail.png', version: 1, reviewStage: 'candidate',
        sourceRecordId: sleepdressResultSource.recordId, sourceFileName: '1782444206149_0.png',
        revisionContext: {
          rootResultId: 'T-0996-result-1', sourceTaskId: 'T-0996',
          basePrompt: '近距离展示睡裙蕾丝领口、雾蓝紫提花面料和吊带连接处，保持真实纹理、颜色和花型。',
          negativePrompt: '蕾丝边缘融化、花型错乱、颜色偏移、过度磨皮、局部模糊',
          fidelityRules: ['保持睡裙款式、蕾丝花型和雾蓝紫颜色不变', '未标记区域保持原图构图和视觉关系'],
          turns: [],
        },
      },
    ],
    modelChannel: 'DaVinci Vision v3.5 (自研推荐)',
    params: { ratio: '1:1', steps: 25, guidance: 6.5 }
  },
  {
    id: 'T-0995',
    name: 'Nike 跑鞋酷炫旋转飞沙视频 (批次#1)',
    type: 'video',
    groupId: 'G-20260629-001', groupOrder: 1, submittedAt: '2026-06-29 11:00',
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
