import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppScreen, type ProductAsset, type VideoTaskSubmitPayload } from '../types';
import type { ProductDTO } from '../api/modules/productInfo';
import {
  AssetTransitModal,
  type ResourceCenterSource,
} from './AssetTransitModal';
import type { AssetResourceItem } from '../api/modules/asset';
import { taskApi } from '../api/modules/task';
import { TaskParamsPanel } from './createTask/TaskParamsPanel';
import { ProductPickerCard } from './CreateImageTask/left/ProductPickerCard';
import { ProductPickerModal } from './CreateImageTask/ProductPickerModal';
import { creationTemplateApi } from '../api/modules/creationTemplate';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import type { PrefillState } from './createTask/useTaskParams';
import {
  buildTrendingReplicatePrompt,
  extractTrendingUserInstruction,
  TRENDING_ROLE_LABELS,
  type TrendingReplacementRole,
} from '../lib/createVideoTask/buildTrendingReplicatePrompt';

type VideoMode = 'FIRST_FRAME' | 'TRENDING_REPLICATE';
type InputRole = 'FIRST_FRAME' | 'SOURCE_VIDEO' | 'REPLACEMENT_REFERENCE';

interface SelectedAsset {
  assetId: string;
  name: string;
  assetKind: 'IMAGE' | 'VIDEO' | 'AUDIO';
  originalUrl: string;
  thumbnailUrl?: string;
  durationSec?: number;
  replacementRole?: TrendingReplacementRole;
}

interface ParamsSnapshot {
  channelId: string | null;
  channelType: string | null;
  capability: string | null;
  modelId: string | null;
  schemaParams: Record<string, unknown>;
}

interface CreateVideoTaskProps {
  products: ProductAsset[];
  onAddTask: (info: {
    groupId: string;
    taskIds: string[];
    taskKind?: 'IMAGE' | 'VIDEO';
  }) => void;
  setScreen: (
    screen: AppScreen,
    payload?: { highlightGroupId?: string; creationTemplateId?: string },
  ) => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
  creationTemplateId?: string | null;
}

const EMPTY_PARAMS: ParamsSnapshot = {
  channelId: null,
  channelType: null,
  capability: null,
  modelId: null,
  schemaParams: {},
};

const MODE_CONFIG: Record<
  VideoMode,
  {
    label: string;
    description: string;
    capability: 'IMG2VIDEO' | 'SOLUTION_TRENDING_REPL';
    group: 'VIDEO' | 'SOLUTION';
  }
> = {
  FIRST_FRAME: {
    label: '首帧图生视频',
    description: '以一张图片作为视频严格首帧生成视频',
    capability: 'IMG2VIDEO',
    group: 'VIDEO',
  },
  TRENDING_REPLICATE: {
    label: '爆款复刻',
    description: '参考原视频结构，替换为所选商品或模特素材',
    capability: 'SOLUTION_TRENDING_REPL',
    group: 'SOLUTION',
  },
};

const inferReplacementRole = (asset: AssetResourceItem): TrendingReplacementRole => {
  const hint = `${asset.tags ?? ''},${asset.assetType ?? ''},${asset.name}`;
  if (/模特|人物|人像/.test(hint)) return 'model';
  if (/场景|背景|布景/.test(hint)) return 'scene';
  if (/动作|姿势|姿态/.test(hint)) return 'pose';
  return 'style';
};

const toSelectedAsset = (
  asset: AssetResourceItem,
  replacementRole?: TrendingReplacementRole,
): SelectedAsset => ({
  assetId: asset.id,
  name: asset.name,
  assetKind: asset.assetKind,
  originalUrl: asset.originalUrl ?? asset.thumbnailUrl ?? '',
  thumbnailUrl: asset.thumbnailUrl,
  durationSec: asset.durationSec,
  replacementRole,
});

const cleanReusableVideoPrompt = (value: string): string => {
  let cleaned = value.replace(/\r\n/g, '\n').trim();
  while (true) {
    const factStart = cleaned.indexOf('【商品事实】');
    if (factStart < 0) break;
    const requirementStart = cleaned.indexOf('【生成要求】', factStart);
    if (requirementStart < 0) break;
    const blockEnd = cleaned.indexOf('\n\n', requirementStart);
    if (blockEnd < 0) {
      cleaned = cleaned.slice(0, factStart).trim();
      break;
    }
    cleaned = `${cleaned.slice(0, factStart)}${cleaned.slice(blockEnd + 2)}`.trim();
  }
  return cleaned
    .split('\n')
    .filter((line) => {
      const text = line.trim();
      return !text.startsWith('负面约束：') && !text.startsWith('负面 Prompt：');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const inferTemplateReplacementRole = (
  prompt: string,
  replacementIndex: number,
): TrendingReplacementRole => {
  const line = prompt
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`图${replacementIndex + 2}：`)) ?? '';
  if (line.includes('人物替换图')) return 'model';
  if (line.includes('场景替换图')) return 'scene';
  if (line.includes('动作/姿势')) return 'pose';
  return 'style';
};

export const CreateVideoTask: React.FC<CreateVideoTaskProps> = ({
  onAddTask,
  setScreen,
  creationTemplateId,
}) => {
  const creationPrefillQuery = useServiceQuery(
    () => creationTemplateId
      ? creationTemplateApi.reuseContext(creationTemplateId)
      : Promise.resolve(null),
    [creationTemplateId],
  );
  const creationPrefill = creationPrefillQuery.data;
  const videoParamsPrefill = useMemo<PrefillState | null>(() => {
    if (!creationPrefill || creationPrefill.mediaType !== 'VIDEO') return null;
    const snapshot = creationPrefill.snapshot;
    return {
      channelType: snapshot.channelType ?? null,
      capability: snapshot.capability ?? null,
      model: snapshot.modelCode ?? null,
      schemaParams: snapshot.schemaParams,
      lockExecution: false,
    };
  }, [creationPrefill]);
  const [selectedProductInfo, setSelectedProductInfo] = useState<ProductDTO | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [mode, setMode] = useState<VideoMode>('FIRST_FRAME');
  const [firstFrame, setFirstFrame] = useState<SelectedAsset | null>(null);
  const [sourceVideo, setSourceVideo] = useState<SelectedAsset | null>(null);
  const [replacementReferences, setReplacementReferences] = useState<
    SelectedAsset[]
  >([]);
  const [prompt, setPrompt] = useState('');
  const [manualTrendingPrompt, setManualTrendingPrompt] = useState<string | null>(null);
  const [negativePrompt, setNegativePrompt] = useState(
    '商品漂移、材质闪烁、人物畸形、镜头突变、文字变化',
  );
  const [shots, setShots] = useState(['', '', '']);
  const [storyboardGenerated, setStoryboardGenerated] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [params, setParams] = useState<ParamsSnapshot>(EMPTY_PARAMS);
  const [submitting, setSubmitting] = useState(false);
  const [productFacts, setProductFacts] = useState<
    VideoTaskSubmitPayload['productFacts']
  >({
    name: '',
    sellingPoints: '',
    productCategory: '',
    color: '',
    fabricTexture: '',
    fitStructure: '',
  });
  const [picker, setPicker] = useState<{
    role: InputRole;
    assetKind: 'IMAGE' | 'VIDEO';
    source: ResourceCenterSource;
  } | null>(null);
  const appliedCreationTemplateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!creationPrefill || creationPrefill.mediaType !== 'VIDEO') return;
    if (appliedCreationTemplateRef.current === creationPrefill.templateId) return;
    appliedCreationTemplateRef.current = creationPrefill.templateId;
    const snapshot = creationPrefill.snapshot;
    const nextMode = snapshot.videoMode === 'TRENDING_REPLICATE'
      ? 'TRENDING_REPLICATE'
      : 'FIRST_FRAME';
    setMode(nextMode);
    setSelectedProductInfo(null);
    setProductFacts({
      name: '',
      sellingPoints: '',
      productCategory: '',
      color: '',
      fabricTexture: '',
      fitStructure: '',
    });
    const references = snapshot.references ?? [];
    const toTemplateAsset = (
      reference: (typeof references)[number],
      assetKind: 'IMAGE' | 'VIDEO',
    ): SelectedAsset => ({
      assetId: reference.assetId,
      name: reference.name || (assetKind === 'VIDEO' ? '模板源视频' : '模板参考图'),
      assetKind,
      originalUrl: reference.url,
      thumbnailUrl: reference.thumbnailUrl ?? undefined,
      durationSec: reference.durationSec ?? undefined,
    });
    const firstFrameReference = references.find(
      (reference) => reference.role === 'FIRST_FRAME',
    );
    const sourceVideoReference = references.find(
      (reference) => reference.role === 'SOURCE_VIDEO',
    );
    const replacementReferenceAssets = references
      .filter((reference) => reference.role === 'REPLACEMENT_REFERENCE')
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
      .map((reference, index) => ({
        ...toTemplateAsset(reference, 'IMAGE'),
        replacementRole: inferTemplateReplacementRole(snapshot.prompt ?? '', index),
      }))
      .filter((asset) => Boolean(asset.originalUrl))
      .slice(0, 7);
    setFirstFrame(
      firstFrameReference?.url
        ? toTemplateAsset(firstFrameReference, 'IMAGE')
        : null,
    );
    setSourceVideo(
      sourceVideoReference?.url
        ? toTemplateAsset(sourceVideoReference, 'VIDEO')
        : null,
    );
    setReplacementReferences(replacementReferenceAssets);
    setManualTrendingPrompt(null);
    setPrompt(nextMode === 'TRENDING_REPLICATE'
      ? extractTrendingUserInstruction(snapshot.prompt ?? '')
      : cleanReusableVideoPrompt(snapshot.prompt ?? ''));
    setNegativePrompt(snapshot.negativePrompt ?? '');
    setCount(Math.max(1, Math.min(8, snapshot.count ?? 1)));
    setShots(['', '', '']);
    setStoryboardGenerated(false);
    toast.success(`已应用模板：${creationPrefill.templateName}，已带入视频素材与 Prompt，请选择本次商品`);
  }, [creationPrefill]);

  const config = MODE_CONFIG[mode];
  const hasProductReference = Boolean(selectedProductInfo?.imageId);
  const trendingPrompt = useMemo(() => buildTrendingReplicatePrompt({
    replacements: replacementReferences.map((asset) => ({
      replacementRole: asset.replacementRole ?? 'style',
    })),
    userInstruction: prompt,
  }), [prompt, replacementReferences]);
  const effectivePrompt = mode === 'TRENDING_REPLICATE'
    ? (manualTrendingPrompt ?? trendingPrompt)
    : prompt;
  const isInputReady =
    mode === 'FIRST_FRAME'
      ? firstFrame !== null
      : sourceVideo !== null && hasProductReference;
  const readiness = [
    selectedProductInfo !== null,
    isInputReady,
    effectivePrompt.trim().length > 0,
    params.channelType === 'VIDU' &&
      params.capability === config.capability &&
      params.channelId !== null,
  ].filter(Boolean).length;
  const duration = String(params.schemaParams.duration ?? '5');
  const outputRatio = String(
    params.schemaParams.aspect_ratio ?? '',
  );

  const handleProductPicked = (product: ProductDTO) => {
    const nextFacts = {
      name: (product.name ?? '').trim(),
      sellingPoints: (product.sellingPoints ?? '').trim(),
      productCategory: (product.category ?? '').trim(),
      color: (product.color ?? '').trim(),
      fabricTexture: (product.patternMaterial ?? '').trim(),
      fitStructure: (product.silhouetteStructure ?? '').trim(),
    };
    setSelectedProductInfo(product);
    setProductFacts(nextFacts);
    if (product.imageId) {
      setReplacementReferences((previous) => {
        const withoutProductImage = previous.filter(
          (asset) => asset.assetId !== product.imageId,
        );
        if (withoutProductImage.length > 6) {
          toast.info('商品主图将自动用于爆款复刻，其他替换参考图最多保留 6 张');
        }
        return withoutProductImage.slice(0, 6);
      });
    }
    const reusablePrompt = mode === 'TRENDING_REPLICATE'
      ? extractTrendingUserInstruction(creationPrefill?.snapshot.prompt ?? '')
      : cleanReusableVideoPrompt(creationPrefill?.snapshot.prompt ?? '');
    if (reusablePrompt) {
      const values: Record<string, string> = {
        name: nextFacts.name,
        productName: nextFacts.name,
        sellingPoints: nextFacts.sellingPoints,
        productCategory: nextFacts.productCategory,
        category: nextFacts.productCategory,
        color: nextFacts.color,
        fabricTexture: nextFacts.fabricTexture,
        fitStructure: nextFacts.fitStructure,
      };
      setPrompt(reusablePrompt.replace(/\{\{([^}]+)}}/g, (match, key: string) =>
        values[key] || match));
    }
    toast.success(`已选择产品：${product.name}`);
  };

  const handleClearProduct = () => {
    setSelectedProductInfo(null);
    setProductFacts({
      name: '',
      sellingPoints: '',
      productCategory: '',
      color: '',
      fabricTexture: '',
      fitStructure: '',
    });
    toast.info('已清除产品选择');
  };

  const switchMode = (nextMode: VideoMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setParams(EMPTY_PARAMS);
    setShots(['', '', '']);
    setStoryboardGenerated(false);
    setTemplateMenuOpen(false);
  };

  const generateStoryboard = () => {
    if (mode === 'TRENDING_REPLICATE') {
      toast.info('爆款复刻的分镜、动作和剪辑节奏直接采用源视频，无需另行生成分镜');
      setShots(['', '', '']);
      setStoryboardGenerated(false);
      return;
    }
    setShots([
      '建立主体与环境，镜头保持稳定。',
      '展示核心动作和商品细节，控制主体一致性。',
      '镜头自然收束并完成品牌或商品定格。',
    ]);
    setStoryboardGenerated(true);
  };

  const applyPromptTemplate = (template: 'PRODUCT' | 'TRENDING') => {
    setPrompt(
      template === 'TRENDING'
        ? '严格保留原视频的镜头、动作、剪辑节奏与叙事结构，仅替换图片绑定中明确指定的主体。'
        : '镜头稳定呈现商品主体，突出材质、动作和核心卖点。',
    );
    setNegativePrompt('商品漂移、材质闪烁、人物畸形、镜头突变、文字变化');
    setStoryboardGenerated(false);
    setTemplateMenuOpen(false);
    toast.success('已应用视频 Prompt 模板');
  };

  const applyAiSuggestion = () => {
    const selectedRoleNames = Array.from(new Set(
      replacementReferences.map((asset) =>
        TRENDING_ROLE_LABELS[asset.replacementRole ?? 'style']),
    ));
    const suggestion =
      mode === 'FIRST_FRAME'
        ? '保持首帧中的商品主体和构图，使用克制流畅的镜头运动，结尾以特写强化材质与核心卖点。'
        : `严格保留原视频的镜头节奏、人物动作和转场逻辑，仅使用商品${selectedRoleNames.length > 0 ? `、${selectedRoleNames.join('、')}` : ''}绑定约束明确内容。`;
    setPrompt((current) =>
      current.trim() ? `${current.trim()}\n${suggestion}` : suggestion,
    );
    setStoryboardGenerated(false);
    toast.success('已添加 AI 助手建议');
  };

  const openPicker = (
    role: InputRole,
    assetKind: 'IMAGE' | 'VIDEO',
    source: ResourceCenterSource = 'UPLOAD',
  ) => setPicker({ role, assetKind, source });

  const confirmAssets = (items: AssetResourceItem[]) => {
    if (!picker || items.length === 0) return;
    const selected = items
      .filter((item) => item.assetKind === picker.assetKind)
      .map((item) => toSelectedAsset(
        item,
        picker.role === 'REPLACEMENT_REFERENCE'
          ? inferReplacementRole(item)
          : undefined,
      ))
      .filter((item) => item.originalUrl);
    if (selected.length === 0) {
      toast.warning(
        picker.assetKind === 'VIDEO'
          ? '请选择有效的视频资源'
          : '请选择有效的图片资源',
      );
      return;
    }
    if (picker.role === 'FIRST_FRAME') {
      setFirstFrame(selected[0]);
    } else if (picker.role === 'SOURCE_VIDEO') {
      setSourceVideo(selected[0]);
    } else {
      setReplacementReferences((previous) => {
        const merged = [...previous];
        for (const item of selected) {
          if (item.assetId === selectedProductInfo?.imageId) continue;
          if (!merged.some((current) => current.assetId === item.assetId)) {
            merged.push(item);
          }
        }
        const maxReferences = 6;
        if (merged.length > maxReferences) {
          toast.warning('商品主图已自动占用 1 个复刻图片槽位，其他参考图最多选择 6 张');
        }
        return merged.slice(0, maxReferences);
      });
    }
    setPicker(null);
  };

  const updateReplacementRole = (
    assetId: string,
    replacementRole: TrendingReplacementRole,
  ) => {
    setReplacementReferences((current) => current.map((asset) =>
      asset.assetId === assetId ? { ...asset, replacementRole } : asset));
    setStoryboardGenerated(false);
  };

  const buildAssets = (): VideoTaskSubmitPayload['assets'] => {
    if (mode === 'FIRST_FRAME' && firstFrame) {
      return [
        {
          assetId: firstFrame.assetId,
          slotRole: 'FIRST_FRAME',
          sortOrder: 0,
          originalUrl: firstFrame.originalUrl,
          thumbnailUrl: firstFrame.thumbnailUrl,
          name: firstFrame.name,
        },
      ];
    }
    if (mode === 'TRENDING_REPLICATE' && sourceVideo) {
      const productReference = selectedProductInfo?.imageId
        ? {
            assetId: selectedProductInfo.imageId,
            slotRole: 'PRODUCT_REFERENCE' as const,
            sortOrder: 0,
            originalUrl: selectedProductInfo.imageUrl,
            thumbnailUrl: selectedProductInfo.imageUrl,
            name: `${selectedProductInfo.name}（商品主图）`,
          }
        : null;
      const references = replacementReferences
        .filter((asset) => asset.assetId !== productReference?.assetId)
        .slice(0, productReference ? 6 : 7);
      return [
        {
          assetId: sourceVideo.assetId,
          slotRole: 'SOURCE_VIDEO',
          sortOrder: 0,
          originalUrl: sourceVideo.originalUrl,
          thumbnailUrl: sourceVideo.thumbnailUrl,
          name: sourceVideo.name,
        },
        ...(productReference ? [productReference] : []),
        ...references.map((asset, index) => ({
          assetId: asset.assetId,
          slotRole: 'REPLACEMENT_REFERENCE' as const,
          sortOrder: index + (productReference ? 1 : 0),
          originalUrl: asset.originalUrl,
          thumbnailUrl: asset.thumbnailUrl,
          name: asset.name,
        })),
      ];
    }
    return [];
  };

  const submit = async () => {
    if (!selectedProductInfo) {
      toast.warning('请先选择产品');
      return;
    }
    if (!isInputReady) {
      toast.warning(
        mode === 'FIRST_FRAME'
          ? '请先选择视频首帧'
          : '请先选择爆款原视频，并确保已选商品具有商品主图',
      );
      return;
    }
    if (!effectivePrompt.trim()) {
      toast.warning('请输入本次视频 Prompt');
      return;
    }
    if (mode === 'TRENDING_REPLICATE' && effectivePrompt.length > 2000) {
      toast.warning('爆款复刻最终 Prompt 不能超过 2000 字，请精简素材名称或创意补充');
      return;
    }
    if (
      !params.channelId ||
      params.channelType !== 'VIDU' ||
      params.capability !== config.capability
    ) {
      toast.warning('Vidu 通道能力尚未准备完成');
      return;
    }

    const storyboard = (storyboardGenerated ? shots : [])
      .map((text, index) =>
        text.trim() ? `分镜${index + 1}：${text.trim()}` : '',
      )
      .filter(Boolean)
      .join('\n');
    const positivePrompt = storyboard
      ? `${effectivePrompt.trim()}\n\n分镜规划：\n${storyboard}`
      : effectivePrompt.trim();
    if (mode === 'TRENDING_REPLICATE' && positivePrompt.length > 2000) {
      toast.warning('爆款复刻最终 Prompt（含分镜）不能超过 2000 字，请精简创意补充');
      return;
    }
    // 负面约束使用独立字段提交，由后端统一且幂等地组装进供应商 Prompt。
    const taskPrompt = positivePrompt;
    const numericProductId = /^\d+$/.test(selectedProductInfo.id)
      ? selectedProductInfo.id
      : null;

    const payload: VideoTaskSubmitPayload = {
      title: `${config.label}_${productFacts.name}`,
      productId: numericProductId,
      productFacts,
      channelInstanceId: params.channelId,
      channelType: 'VIDU',
      capability: config.capability,
      videoMode: mode,
      modelCode: params.modelId,
      taskParamsJson: JSON.stringify(params.schemaParams ?? {}),
      taskPrompt,
      negativePrompt: negativePrompt.trim() || undefined,
      assets: buildAssets(),
      count,
      sourceCreationTemplateId: creationPrefill?.templateId,
      sourceCreationTemplateVersionId: creationPrefill?.versionId,
    };

    setSubmitting(true);
    try {
      const response = await taskApi.submitVideoTask(payload);
      sessionStorage.removeItem('beta.template.prefill');
      onAddTask({ ...response, taskKind: 'VIDEO' });
      setScreen(AppScreen.TASKS, { highlightGroupId: response.groupId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f7fb] text-slate-800">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen(AppScreen.TASKS)}
            className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100"
            title="返回任务列表"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <p className="text-[11px] font-bold text-emerald-600">
              视频任务工作台
            </p>
            <h1 className="text-base font-black">新建视频任务</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-1 text-right">
            <span className="block text-[10px] font-bold text-slate-400">
              生成准备度 {readiness}/4
            </span>
            {mode === 'FIRST_FRAME' && (
              <span className="text-[10px] text-slate-500">
                {duration} 秒{outputRatio ? ` · ${outputRatio}` : ''}
              </span>
            )}
            {/* 爆款复刻“跟随原视频”规格文案暂时隐藏，后续按需恢复。 */}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplateMenuOpen((open) => !open)}
              className="h-9 rounded-md border border-primary px-3 text-xs font-bold text-primary"
            >
              模板
            </button>
            {templateMenuOpen && (
              <div className="absolute right-0 top-11 z-40 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => applyPromptTemplate('PRODUCT')}
                  className="w-full rounded-md px-3 py-2 text-left hover:bg-primary-light"
                >
                  <span className="block text-xs font-bold text-slate-800">
                    商品动态展示
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    稳定主体，突出材质与核心卖点
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPromptTemplate('TRENDING')}
                  className="mt-1 w-full rounded-md px-3 py-2 text-left hover:bg-primary-light"
                >
                  <span className="block text-xs font-bold text-slate-800">
                    爆款节奏复刻
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    保留创意结构、镜头节奏和爆点
                  </span>
                </button>
              </div>
            )}
          </div>
          {/* AI 助手按钮暂时隐藏，后续按需解除注释。
          <button
            type="button"
            onClick={applyAiSuggestion}
            className="h-9 rounded-md border border-primary/25 bg-primary-light px-3 text-xs font-bold text-primary"
          >
            <span className="material-symbols-outlined mr-1 align-middle text-base">
              auto_awesome
            </span>
            AI 助手
          </button>
          */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="h-9 rounded-md bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? '提交中…' : '检查并生成'}
          </button>
        </div>
      </header>

      <nav className="shrink-0 border-b border-slate-200 bg-white px-6">
        <div className="mx-auto flex max-w-[1440px] gap-6 overflow-x-auto">
          {(Object.keys(MODE_CONFIG) as VideoMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchMode(item)}
              className={`h-12 shrink-0 border-b-2 text-xs font-bold ${
                mode === item
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {MODE_CONFIG[item].label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
          <section className="space-y-4">
            <ProductPickerCard
              selectedProduct={selectedProductInfo}
              onPick={() => setProductPickerOpen(true)}
              onClear={handleClearProduct}
            />
            {mode === 'FIRST_FRAME' ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-primary">输入素材</p>
                    <h2 className="mt-1 text-sm font-black">视频首帧</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPicker('FIRST_FRAME', 'IMAGE')}
                    className="text-xs font-bold text-primary"
                  >
                    资源中心
                  </button>
                </div>
                <AssetSlot
                  title="视频首帧"
                  asset={firstFrame}
                  acceptLabel="添加首帧素材"
                  onChoose={() => openPicker('FIRST_FRAME', 'IMAGE')}
                  onRemove={() => setFirstFrame(null)}
                  showLabel={false}
                />
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-primary">
                        爆款视频
                      </p>
                      <h2 className="mt-1 text-sm font-black">复刻源视频</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPicker('SOURCE_VIDEO', 'VIDEO')}
                      className="text-xs font-bold text-primary"
                    >
                      资源中心
                    </button>
                  </div>
                  <AssetSlot
                    title="爆款原视频"
                    asset={sourceVideo}
                    acceptLabel="从资源中心选择复刻源视频"
                    onChoose={() => openPicker('SOURCE_VIDEO', 'VIDEO')}
                    onRemove={() => setSourceVideo(null)}
                    showLabel={false}
                  />
                  <p className="mt-3 text-[10px] leading-4 text-slate-400">
                    支持 MP4/MOV，5～180 秒；源视频仅作为本次任务的镜头结构参考。
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-primary">
                        替换素材
                      </p>
                      <h2 className="mt-1 text-sm font-black">
                        模特、场景、风格与动作
                      </h2>
                      <p className="mt-1 text-[11px] leading-4 text-slate-400">
                        商品主图固定为图 1；其他素材选择用途后动态编译图片绑定，最多再选 6 张。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openPicker('REPLACEMENT_REFERENCE', 'IMAGE', 'UPLOAD')
                      }
                      className="text-xs font-bold text-primary"
                    >
                      资源中心
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {selectedProductInfo?.imageUrl && (
                      <div className="min-w-0">
                        <div className="relative aspect-square overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50">
                          <img
                            src={selectedProductInfo.imageUrl}
                            alt={selectedProductInfo.name}
                            className="h-full w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            图1
                          </span>
                        </div>
                        <div className="mt-1 h-7 truncate rounded border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700">
                          固定使用产品
                        </div>
                      </div>
                    )}
                    {replacementReferences.map((asset, index) => (
                      <div key={asset.assetId} className="min-w-0">
                        <AssetThumb
                          asset={asset}
                          badge={`图${index + 2}`}
                          onRemove={() =>
                            setReplacementReferences((previous) =>
                              previous.filter(
                                (item) => item.assetId !== asset.assetId,
                              ),
                            )
                          }
                        />
                        <select
                          value={asset.replacementRole ?? 'style'}
                          onChange={(event) => updateReplacementRole(
                            asset.assetId,
                            event.target.value as TrendingReplacementRole,
                          )}
                          className="mt-1 h-7 w-full rounded border border-slate-200 bg-white px-1 text-[10px] font-bold text-slate-600 outline-none focus:border-primary"
                          aria-label={`${asset.name}素材用途`}
                        >
                          {(Object.entries(TRENDING_ROLE_LABELS) as Array<[
                            TrendingReplacementRole,
                            string,
                          ]>).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        openPicker('REPLACEMENT_REFERENCE', 'IMAGE', 'UPLOAD')
                      }
                      className="aspect-square rounded-md border-2 border-dashed border-slate-300 text-slate-400 hover:border-primary hover:bg-primary-light hover:text-primary"
                      aria-label="添加替换参考图"
                    >
                      <span className="material-symbols-outlined text-2xl">
                        add
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <section className="border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold text-primary">输入依据</p>
              <h2 className="mt-1 text-sm font-black">商品事实</h2>
              <dl className="mt-3 space-y-2 text-[11px] leading-5">
              <FactRow label="商品" value={productFacts.name} />
              <FactRow label="品类" value={productFacts.productCategory} />
              <FactRow label="卖点" value={productFacts.sellingPoints} />
              <FactRow label="颜色" value={productFacts.color} />
              <FactRow label="材质" value={productFacts.fabricTexture} />
              <FactRow label="版型结构" value={productFacts.fitStructure} />
              </dl>
            </section>
          </section>

          <section className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-[11px] font-bold text-primary">任务配置</p>
              <h2 className="mt-1 font-black">{config.label}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {config.description}
              </p>
              {mode === 'TRENDING_REPLICATE' && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <label className="block text-xs font-bold">
                    用户创意补充
                    <textarea
                      value={prompt}
                      maxLength={500}
                      onChange={(event) => {
                        setPrompt(event.target.value);
                        setStoryboardGenerated(false);
                      }}
                      className="mt-1.5 h-20 w-full resize-none rounded-md border border-slate-200 p-2 text-xs font-normal leading-5 outline-none focus:border-primary"
                      placeholder="补充品牌调性、画面禁忌或其他创意要求；镜头、动作和节奏默认严格跟随源视频"
                    />
                  </label>
                  <p className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">
                    爆款复刻直接以源视频作为唯一分镜与节奏依据，不额外生成或覆盖分镜。
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-primary">内容</p>
                  <h2 className="mt-1 font-black">本次视频 Prompt</h2>
                  <p className="mt-2 text-[11px] text-slate-400">
                    先确认本次视频表达；生成后才按时长拆分为可编辑分镜。
                  </p>
                </div>
                {mode === 'FIRST_FRAME' && (
                  <span className="flex h-9 items-center rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
                    {duration} 秒
                  </span>
                )}
              </div>
              <label className="mt-4 block text-xs font-bold">
                最终 Prompt
                <textarea
                  value={effectivePrompt}
                  maxLength={mode === 'FIRST_FRAME' ? 5000 : 2000}
                  onChange={(event) => {
                    if (mode === 'TRENDING_REPLICATE') {
                      setManualTrendingPrompt(event.target.value);
                    } else {
                      setPrompt(event.target.value);
                    }
                    setStoryboardGenerated(false);
                  }}
                  className="mt-1.5 h-64 w-full resize-y rounded-md border border-slate-200 p-3 text-xs font-normal leading-5 outline-none focus:border-primary"
                  placeholder="描述商品、动作、场景和镜头目标"
                />
                {mode === 'TRENDING_REPLICATE' && (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-normal text-slate-400">
                      {manualTrendingPrompt !== null
                        ? '已手动编辑，素材或槽位变化不会覆盖当前内容'
                        : '已根据商品主图、素材用途和用户创意补充自动计算'}
                      （{effectivePrompt.length}/2000）
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setManualTrendingPrompt(null);
                        setStoryboardGenerated(false);
                      }}
                      className="shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary"
                    >
                      根据表单计算
                    </button>
                  </div>
                )}
              </label>
              {mode === 'FIRST_FRAME' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-slate-400">
                  {storyboardGenerated
                    ? `已生成 ${shots.length} 个可编辑分镜`
                    : '生成提示词后，系统将按时长拆分分镜。'}
                </p>
                <button
                  type="button"
                  onClick={generateStoryboard}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-primary bg-white px-3 text-[11px] font-bold text-primary"
                >
                  <span className="material-symbols-outlined text-base">
                    auto_fix_high
                  </span>
                  {storyboardGenerated ? '重新生成提示词' : '生成提示词'}
                </button>
              </div>
              )}
              {storyboardGenerated && (
                <details open className="mt-4 border border-slate-200">
                  <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-xs font-black">
                    分镜提示词 · {shots.length} 镜
                  </summary>
                  <div className="space-y-3 p-3">
                    {shots.map((shot, index) => (
                      <label key={index} className="block text-xs font-bold">
                        分镜 {index + 1}
                        <textarea
                          value={shot}
                          onChange={(event) =>
                            setShots((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? event.target.value
                                  : item,
                              ),
                            )
                          }
                          className="mt-1.5 h-20 w-full resize-none rounded-md border border-slate-200 p-2 text-xs font-normal leading-5 outline-none focus:border-primary"
                        />
                      </label>
                    ))}
                  </div>
                </details>
              )}
              <label className="mt-3 block text-xs font-bold">
                负面约束
                <input
                  value={negativePrompt}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-2 text-xs font-normal outline-none focus:border-primary"
                />
              </label>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {/* AI 助手建议按钮暂时隐藏，后续按需解除注释。
                <button
                  type="button"
                  onClick={applyAiSuggestion}
                  className="h-8 rounded border border-primary px-3 text-xs font-bold text-primary"
                >
                  AI 助手建议
                </button>
                */}
                <span className="text-[10px] text-slate-400">
                  内容将在最终提交时统一校验
                </span>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-[11px] font-bold text-primary">
                模型通道与模型能力
              </p>
              <h2 className="mt-1 font-black">可用视频规格</h2>
              <div className="mt-4">
                <TaskParamsPanel
                  key={mode}
                  group={config.group}
                  prefill={videoParamsPrefill}
                  unified={{
                    productName: productFacts.name ?? '',
                    sellingPoints: productFacts.sellingPoints,
                  }}
                  aspectRatio=""
                  count={count}
                  onAspectRatioChange={() => undefined}
                  onCountChange={setCount}
                  prompt={effectivePrompt}
                  onPromptChange={setPrompt}
                  negativePrompt={negativePrompt}
                  onNegativePromptChange={setNegativePrompt}
                  onParamsChange={setParams}
                  fixedChannelType="VIDU"
                  fixedCapability={config.capability}
                  showAspectRatio={false}
                  showPromptEditor={false}
                  showNegativePrompt={false}
                  showModelSelector={mode === 'FIRST_FRAME'}
                  showCapabilitySummary={false}
                  showCount={false}
                  presentation="videoDemo"
                />
              </div>
              <div className="mt-4 rounded bg-slate-50 p-3 text-xs leading-6">
                {mode === 'FIRST_FRAME' ? (
                  <>
                    <p>输出比例由首帧图片决定</p>
                    <p>时长与分辨率以当前 Vidu 模型能力为准</p>
                    <p className="text-amber-700">
                      提交前请确认生成规格与成本
                    </p>
                  </>
                ) : (
                  <>
                    <p>源视频：MP4/MOV · 5～180 秒</p>
                    <p>商品主图固定为图 1，其他角色图最多 6 张</p>
                    <p className="text-amber-700">
                      仅复刻镜头结构，不复用历史生成结果
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {picker && (
        <AssetTransitModal
          purpose={
            selectedProductInfo?.id &&
            /^\d+$/.test(selectedProductInfo.id)
              ? 'PRODUCT'
              : 'OTHER'
          }
          productId={selectedProductInfo?.id}
          assetKind={picker.assetKind}
          initialSource={picker.source}
          multiSelect={picker.role === 'REPLACEMENT_REFERENCE'}
          targetSlot={picker.role}
          onClose={() => setPicker(null)}
          onConfirmSelection={confirmAssets}
        />
      )}
      <ProductPickerModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onPick={handleProductPicked}
      />
    </div>
  );
};

const AssetSlot: React.FC<{
  title: string;
  required?: boolean;
  asset: SelectedAsset | null;
  acceptLabel: string;
  onChoose: () => void;
  onRemove: () => void;
  showLabel?: boolean;
}> = ({
  title,
  required,
  asset,
  acceptLabel,
  onChoose,
  onRemove,
  showLabel = true,
}) => (
  <div>
    {showLabel && (
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-extrabold">
          {title} {required && <span className="text-red-500">*</span>}
        </label>
        {asset && (
          <button
            type="button"
            onClick={onChoose}
            className="text-xs font-bold text-primary"
          >
            更换
          </button>
        )}
      </div>
    )}
    {asset ? (
      <div className={showLabel ? '' : 'mt-4'}>
        <AssetThumb asset={asset} onRemove={onRemove} large />
      </div>
    ) : (
      <button
        type="button"
        onClick={onChoose}
        className={`${showLabel ? '' : 'mt-4'} h-44 w-full rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-bold text-slate-400 hover:border-primary hover:bg-primary-light hover:text-primary`}
      >
        <span className="material-symbols-outlined block text-4xl">add</span>
        <span className="mt-2 block">{acceptLabel}</span>
      </button>
    )}
  </div>
);

const AssetThumb: React.FC<{
  asset: SelectedAsset;
  onRemove: () => void;
  large?: boolean;
  badge?: string;
}> = ({ asset, onRemove, large, badge }) => (
  <div
    className={`group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${
      large ? 'h-44 w-full' : 'aspect-square w-full'
    }`}
  >
    {badge && (
      <span className="absolute left-1 top-1 z-10 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
        {badge}
      </span>
    )}
    {asset.assetKind === 'VIDEO' ? (
      <video
        src={asset.originalUrl}
        poster={asset.thumbnailUrl}
        controls
        preload="metadata"
        className="h-full w-full object-contain"
      />
    ) : (
      <img
        src={asset.originalUrl}
        alt={asset.name}
        className="h-full w-full object-contain"
        referrerPolicy="no-referrer"
      />
    )}
    <button
      type="button"
      onClick={onRemove}
      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
      aria-label={`移除${asset.name}`}
    >
      <span className="material-symbols-outlined text-sm">close</span>
    </button>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8">
      <p className="truncate text-[11px] font-bold text-white">{asset.name}</p>
    </div>
  </div>
);

const FactRow: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <div className="grid grid-cols-[44px_1fr] gap-2">
    <dt className="text-slate-400">{label}</dt>
    <dd className="line-clamp-2 font-medium text-slate-700">
      {value || '未填写'}
    </dd>
  </div>
);
