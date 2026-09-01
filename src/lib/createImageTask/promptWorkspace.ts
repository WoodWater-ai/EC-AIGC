import type { ImageGenerationType } from './readinessChecks';
import { DEFAULT_NEGATIVE_PROMPT } from './buildPromptFromFacts';

export type PromptWorkspaceType = Exclude<ImageGenerationType, 'product_main'>;

export const PROMPT_WORKSPACE_TYPES: readonly PromptWorkspaceType[] = [
  'scene_detail',
  'detail_closeup',
  'model_triple_view',
  'product_detail',
] as const;

type PromptDefaults = Record<ImageGenerationType, string>;
export type PromptOverrides = Partial<Record<ImageGenerationType, string>>;

export function createInitialPromptDefaults(): PromptDefaults {
  return {
    product_main: '',
    scene_detail: '',
    detail_closeup: '',
    model_triple_view: '',
    product_detail: '',
  };
}

export function getEffectivePrompt(
  type: ImageGenerationType,
  defaults: PromptDefaults,
  overrides: PromptOverrides,
): string {
  return overrides[type] ?? defaults[type] ?? '';
}

/** 每种图片类型独立维护负面提示词；未编辑时使用统一的基础默认值。 */
export function getEffectiveNegativePrompt(
  type: ImageGenerationType,
  overrides: PromptOverrides,
): string {
  return overrides[type] ?? DEFAULT_NEGATIVE_PROMPT;
}

export function derivePromptTypes(
  defaults: PromptDefaults,
  overrides: PromptOverrides,
): PromptWorkspaceType[] {
  return PROMPT_WORKSPACE_TYPES.filter(
    (type) => getEffectivePrompt(type, defaults, overrides).trim().length > 0,
  );
}

const TEMPLATE_TYPE_MAP: Record<string, PromptWorkspaceType> = {
  PRODUCT_MAIN: 'scene_detail',
  product_main: 'scene_detail',
  SCENE_DETAIL: 'scene_detail',
  scene_detail: 'scene_detail',
  DETAIL_SCENE: 'scene_detail',
  DETAIL_CLOSEUP: 'detail_closeup',
  detail_closeup: 'detail_closeup',
  DETAIL: 'detail_closeup',
  MODEL_TRIPLE_VIEW: 'model_triple_view',
  model_triple_view: 'model_triple_view',
  ON_MODEL: 'model_triple_view',
  PRODUCT_DETAIL: 'product_detail',
  product_detail: 'product_detail',
};

export function toPromptWorkspaceType(value?: string | null): PromptWorkspaceType | null {
  if (!value) return null;
  return TEMPLATE_TYPE_MAP[value] ?? null;
}
