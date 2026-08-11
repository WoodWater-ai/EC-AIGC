import type { DictOption } from '../../api/modules/dict';
import type { ReferenceSlot } from './extractReferenceInsights';

const ASSET_ROOT = '/mock-assets/tag-icons';

export interface CanonicalVisualOption {
  code: string;
  label: string;
  description: string;
  imageUrl: string;
}

export interface CanonicalStyleDefinition extends CanonicalVisualOption {
  defaultSceneCode: string;
  defaultPoseCode: string;
  sceneCodes: string[];
  poseCodes: string[];
}

export const CANONICAL_STYLES: CanonicalStyleDefinition[] = [
  { code: 'SWEET_CREAMY', label: '奶油甜妹卧室', description: '柔光、浅色床品与轻松生活感', imageUrl: `${ASSET_ROOT}/style-sweet-creamy.png`, defaultSceneCode: 'CREAMY_BEDROOM', defaultPoseCode: 'NATURAL_STAND', sceneCodes: ['CREAMY_BEDROOM', 'QUIET_WINDOW'], poseCodes: ['NATURAL_STAND', 'BED_EDGE_SIT', 'LOOK_BACK'] },
  { code: 'QUIET_LUXURY', label: '静奢深睡品质感', description: '灰绿低饱和、垂感面料与窗边漫反射', imageUrl: `${ASSET_ROOT}/style-quiet-luxury.png`, defaultSceneCode: 'QUIET_WINDOW', defaultPoseCode: 'WINDOW_WALK', sceneCodes: ['QUIET_WINDOW', 'LIGHT_HOME', 'DARK_HOME'], poseCodes: ['NATURAL_STAND', 'BED_EDGE_SIT', 'WINDOW_WALK'] },
  { code: 'VINTAGE_HOME', label: '复古田园居家', description: '旧木、奶油织物与柔和晨光', imageUrl: `${ASSET_ROOT}/style-vintage-home.png`, defaultSceneCode: 'VINTAGE_WOOD', defaultPoseCode: 'BED_EDGE_SIT', sceneCodes: ['VINTAGE_WOOD', 'QUIET_WINDOW'], poseCodes: ['BED_EDGE_SIT', 'WINDOW_WALK', 'SLEEVE_ADJUST'] },
  { code: 'EASTERN_MATURE', label: '东方雅致轻熟', description: '雾蓝米白、端庄实穿与温和日光', imageUrl: `${ASSET_ROOT}/style-eastern-mature.png`, defaultSceneCode: 'LIGHT_HOME', defaultPoseCode: 'THREE_QUARTER', sceneCodes: ['LIGHT_HOME', 'QUIET_WINDOW', 'CHINESE_MINIMAL'], poseCodes: ['NATURAL_STAND', 'THREE_QUARTER', 'SLEEVE_ADJUST'] },
  { code: 'NEW_CHINESE_MINIMAL', label: '新中式雅致', description: '留白、木质与低饱和东方线条', imageUrl: `${ASSET_ROOT}/style-new-chinese-minimal.png`, defaultSceneCode: 'CHINESE_MINIMAL', defaultPoseCode: 'SLEEVE_ADJUST', sceneCodes: ['CHINESE_MINIMAL', 'LIGHT_HOME'], poseCodes: ['NATURAL_STAND', 'THREE_QUARTER', 'SLEEVE_ADJUST'] },
  { code: 'DOPAMINE_PLAYFUL', label: '多巴胺元气居家', description: '粉橘黄绿的明快生活氛围', imageUrl: `${ASSET_ROOT}/style-dopamine-playful.png`, defaultSceneCode: 'COLORFUL_ROOM', defaultPoseCode: 'TURN_BACK', sceneCodes: ['COLORFUL_ROOM', 'CREAMY_BEDROOM'], poseCodes: ['NATURAL_STAND', 'TURN_BACK', 'LOOK_BACK'] },
  { code: 'DARK_GOTHIC', label: '甜酷暗黑辣妹', description: '黑银侧光、修身线条与画册感', imageUrl: `${ASSET_ROOT}/style-dark-gothic.png`, defaultSceneCode: 'DARK_HOME', defaultPoseCode: 'LOOK_BACK', sceneCodes: ['DARK_HOME', 'WHITE_STUDIO'], poseCodes: ['NATURAL_STAND', 'THREE_QUARTER', 'LOOK_BACK'] },
  { code: 'SWEET_COOL_STREET', label: '甜酷美式街头', description: '低角度直给、轻松反差与个性细节', imageUrl: `${ASSET_ROOT}/style-sweet-cool-street.png`, defaultSceneCode: 'WHITE_STUDIO', defaultPoseCode: 'THREE_QUARTER', sceneCodes: ['WHITE_STUDIO', 'COLORFUL_ROOM'], poseCodes: ['NATURAL_STAND', 'THREE_QUARTER', 'TURN_BACK'] },
  { code: 'FRENCH_FEMININE', label: '法式轻奢裙装', description: '柔和轮廓、自然光与轻盈浪漫', imageUrl: `${ASSET_ROOT}/style-french-feminine.png`, defaultSceneCode: 'VINTAGE_WOOD', defaultPoseCode: 'LOOK_BACK', sceneCodes: ['VINTAGE_WOOD', 'QUIET_WINDOW', 'LIGHT_HOME'], poseCodes: ['NATURAL_STAND', 'THREE_QUARTER', 'LOOK_BACK'] },
];

export const CANONICAL_SCENES: CanonicalVisualOption[] = [
  { code: 'CREAMY_BEDROOM', label: '奶油柔光卧室', description: '浅色床品、柔和散射光', imageUrl: `${ASSET_ROOT}/scene-creamy-bedroom.png` },
  { code: 'QUIET_WINDOW', label: '窗边安静居家', description: '自然窗光、留白与真实景深', imageUrl: `${ASSET_ROOT}/scene-quiet-window.png` },
  { code: 'VINTAGE_WOOD', label: '旧木田园空间', description: '木质、织物与温暖晨光', imageUrl: `${ASSET_ROOT}/scene-vintage-wood.png` },
  { code: 'LIGHT_HOME', label: '浅色质感家居', description: '米白雾蓝、干净生活空间', imageUrl: `${ASSET_ROOT}/scene-light-home.png` },
  { code: 'CHINESE_MINIMAL', label: '留白新中式', description: '木质屏风、淡墨绿色与留白', imageUrl: `${ASSET_ROOT}/scene-chinese-minimal.png` },
  { code: 'COLORFUL_ROOM', label: '元气彩色房间', description: '克制彩色道具与明快日光', imageUrl: `${ASSET_ROOT}/scene-colorful-room.png` },
  { code: 'DARK_HOME', label: '暗调缎面居家', description: '深灰暗红、局部高光与私域感', imageUrl: `${ASSET_ROOT}/scene-dark-home.png` },
  { code: 'WHITE_STUDIO', label: '明亮低干扰影棚', description: '商品优先、背景克制、轮廓清晰', imageUrl: `${ASSET_ROOT}/scene-white-studio.png` },
];

export const CANONICAL_POSES: CanonicalVisualOption[] = [
  { code: 'NATURAL_STAND', label: '自然站姿', description: '全身完整，手部不遮挡商品', imageUrl: `${ASSET_ROOT}/pose-natural-stand.svg` },
  { code: 'THREE_QUARTER', label: '45 度微侧身', description: '兼顾版型轮廓与正面信息', imageUrl: `${ASSET_ROOT}/pose-three-quarter.svg` },
  { code: 'BED_EDGE_SIT', label: '床边自然坐姿', description: '松弛居家，衣摆自然展开', imageUrl: `${ASSET_ROOT}/pose-bed-edge-sit.svg` },
  { code: 'WINDOW_WALK', label: '窗边缓步', description: '展示垂感与衣摆动态', imageUrl: `${ASSET_ROOT}/pose-window-walk.svg` },
  { code: 'SLEEVE_ADJUST', label: '轻整理袖口', description: '突出袖口细节，不遮挡主体', imageUrl: `${ASSET_ROOT}/pose-sleeve-adjust.svg` },
  { code: 'TURN_BACK', label: '轻转身', description: '展示侧背面轮廓与松量', imageUrl: `${ASSET_ROOT}/pose-turn-back.svg` },
  { code: 'LOOK_BACK', label: '侧身回望', description: '保留人物神态，同时保持商品可见', imageUrl: `${ASSET_ROOT}/pose-look-back.svg` },
];

const toDictOptions = (
  definitions: CanonicalVisualOption[],
  apiOptions: DictOption[],
): DictOption[] => definitions.map((definition) => {
  const apiOption = apiOptions.find((option) => option.value === definition.code);
  return {
    id: apiOption?.id ?? definition.code,
    value: definition.code,
    label: definition.label,
    description: definition.description,
    imageUrl: apiOption?.imageUrl ?? definition.imageUrl,
    fileResourceId: apiOption?.fileResourceId,
    fileKey: apiOption?.fileKey,
  };
});

export const getCanonicalStyleOptions = (options: DictOption[]) =>
  toDictOptions(CANONICAL_STYLES, options);

export const getLinkedSceneOptions = (styleCode: string, options: DictOption[]) => {
  const style = CANONICAL_STYLES.find((item) => item.code === styleCode);
  const allowed = style?.sceneCodes ?? CANONICAL_SCENES.map((item) => item.code);
  return toDictOptions(CANONICAL_SCENES.filter((item) => allowed.includes(item.code)), options);
};

export const getLinkedPoseOptions = (styleCode: string, options: DictOption[]) => {
  const style = CANONICAL_STYLES.find((item) => item.code === styleCode);
  const allowed = style?.poseCodes ?? CANONICAL_POSES.map((item) => item.code);
  return toDictOptions(CANONICAL_POSES.filter((item) => allowed.includes(item.code)), options);
};

export const optionCodeFromValue = (options: DictOption[], value: string) =>
  options.find((option) => option.label === value || option.value === value)?.value ?? '';

export interface ReferenceAsset {
  id?: string | number;
  fileResourceId?: string | number;
  originalUrl?: string;
  thumbnailUrl?: string;
  name?: string;
  analysis?: { promptHint?: string };
}

export interface TaggedReference {
  key: string;
  ref: ReferenceAsset;
  roles: ReferenceSlot[];
}

const ROLE_ORDER: ReferenceSlot[] = ['model', 'detail', 'style', 'scene', 'pose'];

const referenceKey = (ref: ReferenceAsset) => String(
  ref.id ?? ref.fileResourceId ?? ref.originalUrl ?? ref.thumbnailUrl ?? ref.name ?? '',
);

export function groupReferenceSlots(
  orderedRefs: Array<{ slot: ReferenceSlot; ref: ReferenceAsset }>,
): TaggedReference[] {
  const grouped = new Map<string, TaggedReference>();
  orderedRefs.forEach(({ slot, ref }) => {
    const key = referenceKey(ref) || `${slot}-${grouped.size}`;
    const current = grouped.get(key);
    if (current) {
      if (!current.roles.includes(slot)) current.roles.push(slot);
      return;
    }
    grouped.set(key, { key, ref, roles: [slot] });
  });
  return [...grouped.values()].map((item) => ({
    ...item,
    roles: ROLE_ORDER.filter((role) => item.roles.includes(role)),
  }));
}

export const sameReferenceAsset = (left: ReferenceAsset | undefined, right: ReferenceAsset) =>
  Boolean(left && referenceKey(left) === referenceKey(right));
