// src/components/CreateImageTask/CreateImageTask.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppScreen } from '../../types';
import type { ProductAsset } from '../../types';
import type { ProductDTO } from '../../api/modules/productInfo';
import type { ImageGenerationType } from '../../lib/createImageTask/readinessChecks';
import type { ReferenceSlot } from '../../lib/createImageTask/extractReferenceInsights';
import type { ProductFactsInput } from '../../lib/createImageTask/extractProductFacts';
import { toSlotRef } from '../common/TransitPickerButton';

import { TopHeader } from './header/TopHeader';
import { ThreeColumnLayout } from './layout/ThreeColumnLayout';
import { ProductPickerCard } from './left/ProductPickerCard';
import { ProductPickerModal } from './ProductPickerModal';
import { ImageSourceSection } from './left/ImageSourceSection';
import { CompositeSection } from './left/CompositeSection';
import { ReferenceGrid, type ReferenceRef } from './left/ReferenceGrid';
import { ImageTypeSelector } from './center/ImageTypeSelector';
import { TemplatePicker } from './center/TemplatePicker';
import { StyleScenePoseRow } from './center/StyleScenePoseRow';
import { AdvancedSettings } from './center/AdvancedSettings';
import { ImageContentSection } from './center/ImageContentSection';
import { ProductFactsEditor } from './center/ProductFactsEditor';
import { ImageSettingsSection, type TaskParamsSnapshot } from './right/ImageSettingsSection';
import { ReviewStrategyPanel } from './right/ReviewStrategyPanel';
import { ConflictDialog } from './dialogs/ConflictDialog';
import { TemplateOverwriteDialog } from './dialogs/TemplateOverwriteDialog';
import { ExecutionConfirmDialog } from './dialogs/ExecutionConfirmDialog';
import { AssetTransitModal } from '../AssetTransitModal';
import { useCreateImageTaskState } from '../../hooks/useCreateImageTaskState';
import { useDictOptions } from '../../api/hooks/useDict';
import { REFERENCE_SLOTS_INTERNAL } from '../../lib/createImageTask/referencesConfig';
import { withCosThumbnail } from '../../utils/cosImage';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (info: { groupId: string; taskIds: string[]; taskKind?: 'IMAGE' | 'VIDEO' }) => void;
  setScreen: (screen: AppScreen, payload?: { highlightGroupId?: string }) => void;
  openTransit: () => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
}

/**
 * 当前正在等待选资源的"目标位":
 * - 'main'             主图
 * - 其余 5 个         对应 ReferenceSlot(detail/style/scene/pose/model)
 */
type PendingSlot = 'main' | ReferenceSlot | null;

export const CreateImageTask: React.FC<CreateImageTaskProps> = (props) => {
  const { selectedProduct, setScreen, onAddTask } = props;

  // ---- local form state ----
  const [productFacts, setProductFacts] = useState<ProductFactsInput>({
    name: selectedProduct.name,
    sellingPoints: selectedProduct.specs.sellingPoints.join('，'),
    productCategory: selectedProduct.category,
    colorPattern: selectedProduct.specs.color[0] || '米白色',
    fabricTexture: selectedProduct.specs.material || '细腻针织纹理',
    fitStructure: '修身版型',
  });
  const [mainValue, setMainValue] = useState<{
    /** asset_resource.id(后端 aiAnalyze + 提交 assetId 用)—— 雪花 ID 必须 string 避免 JS 精度丢失 */
    id?: string;
    /** 兼容字段:历史命名,实际存的是 asset_resource.id(不是 file_resource.id) */
    fileResourceId?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
    name?: string;
  } | null>(null);

  // ---- 选择产品 ----
  // selectedFromLibrary:从 ProductPickerModal 选中的 ProductDTO(与 App 注入的 ProductAsset 不同——后者是 SKU)
  // productPickerOpen:modal 显示
  const [selectedFromLibrary, setSelectedFromLibrary] = useState<ProductDTO | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState<boolean>(false);

  // ---- 本页自己的资源中心 picker(替代 App.tsx 全局 manager modal)----
  // 由 pendingSlot 路由:点击主图 → 'main';点击参考图 slot → 该 slot id
  const [pendingSlot, setPendingSlot] = useState<PendingSlot>(null);
  const isTransitOpen = pendingSlot !== null;

  // ---- hook ----
  // 通道/能力/模型 真实值由 ImageSettingsSection 内部 useTaskParams 装载(从
  // /v1/admin/capability/supported-list 等接口拉取);子组件通过 onParamsChange
  // 回调把选中状态冒泡到此处,提交时 channelInstanceId/modelId 必须是真实雪花 ID。
  // 之前写死 channel-1 / gpt-image-1 已被替换,父组件不再自己调 useTaskParams(避免两份独立 state)。

  // 风格 / 场景 / 姿势 字典(从后端 dict 实时拉取,后端 categoryCode 由 dafenqi-ai 字典管理配置)
  const { options: styleOptions, loading: loadingStyle } = useDictOptions('STYLE');
  const { options: sceneOptions, loading: loadingScene } = useDictOptions('SCENE');
  const { options: poseOptions,  loading: loadingPose  } = useDictOptions('POSTURE');

  const [paramsSnapshot, setParamsSnapshot] = useState<TaskParamsSnapshot>({
    channelId: null,
    channelType: null,
    capability: null,
    modelId: null,
    executionParamsReady: false,
    // [2026-07-25 P0 修复] 加 schemaParams 字段,接收 ImageSettingsSection.onParamsChange
    // 冒泡上来的能力参数(包含 aspect_ratio / resolution 等),透传给 useCreateImageTaskState。
    schemaParams: {},
  });
  const state = useCreateImageTaskState({
    isProductBound: !!mainValue,
    mainAssetId: mainValue?.id ?? null,
    mainImage: mainValue,
    // 选产品(从 ProductPickerModal)用 selectedFromLibrary 的 id(真实 ProductDTO.id,雪花 ID string)
    // 顶层 selectedProduct 是 SKU(ProductAsset),仅用于初始化 form state 6 字段,不是提交用的 productId 源。
    productId: selectedFromLibrary?.id ?? null,
    // AI 助手成功后,把后端 6 字段一次回写到顶层 productFacts state,
    // 让 ProductFactsEditor 的 input 实时刷新。
    onAiComplete: setProductFacts,
    channel: {
      id: paramsSnapshot.channelId ?? '',
      name: paramsSnapshot.channelId ?? '',
      accessType: 'cloud',
      health: 'NORMAL',
    },
    model: {
      id: paramsSnapshot.modelId ?? '',
      name: paramsSnapshot.modelId ?? '',
      // [2026-07-25 P0 修复] 删 capability.ratios / resolutions 写死假数据 ——
      // 这俩字段在 isSupported 旧判定里用过,但写死值与 Vidu 真实 schema 不一致
      // (写死 resolutions=['1024px','1536px','2048px'],Vidu 实际只接受 1080p/2K/4K),
      // 导致 readiness 永远报"不支持"假阳性。只保留 maxCount(由 useTaskParams 装载)。
      capability: { maxCount: 5 },
    },
    // [2026-07-25 P0 修复] ratio / resolution 不再作为独立字段传入(前端不做供应商映射)。
    // ParamSchemaForm 收集的能力参数整体透传给 hook,直接作为 taskParamsJson 提交;
    // 后端 ChannelParamBinder 按 ViduCapabilities schema 字段名映射到 Vidu body。
    schemaParams: paramsSnapshot.schemaParams,
    executionParamsReady: paramsSnapshot.executionParamsReady,
    templateName: '默认模板',
    toSubmit: async () => '',
    onAddTask,
    setScreen,
  });

  const {
    selectedTypes, typeCounts, template,
    style, scene, pose, negativePrompt,
    promptOverrides,
    assistantState, reviewEnabled, references,
    conflictOpen, templatePickerOpen, pendingTemplate,
    templateOverwriteOpen, executionConfirmOpen,
    isSubmitting,
    setConflictOpen, setTemplateOverwriteOpen, setExecutionConfirmOpen,
    prompts, promptsComplete,
    isSupported, totalCount,
    toggleType, changeTypeCount, requestTemplateChange, applyTemplate,
    setStyle, setScene, setPose, setNegativePrompt,
    updateProductFact, setFormFactsExternal,
    setPromptOverride, runAssistantAnalysis,
    regeneratePrompts, applyAiOptimizeToSelected,
    setReviewEnabled,
    selectReference, updateReferenceOrder, checkAndGenerate, submitTasks,
  } = state;

  // 字典加载完成后,若 hook 内 style/scene/pose 仍是空串(初始化时字典尚未回来),
  // 自动选 options[0] 的中文 label (itemName),让 select 不再停留在"暂无数据"占位态
  // 注:toDictOptions 给的 opt.value 是 itemCode(英文枚举),opt.label 才是中文 itemName,
  //     这里取 label 才能保证默认值和后续 prompt 拼接都是中文
  useEffect(() => {
    if (!loadingStyle && styleOptions.length > 0 && !style) {
      setStyle(styleOptions[0].label);
    }
  }, [styleOptions, loadingStyle, style, setStyle]);

  useEffect(() => {
    if (!loadingScene && sceneOptions.length > 0 && !scene) {
      setScene(sceneOptions[0].label);
    }
  }, [sceneOptions, loadingScene, scene, setScene]);

  useEffect(() => {
    if (!loadingPose && poseOptions.length > 0 && !pose) {
      setPose(poseOptions[0].label);
    }
  }, [poseOptions, loadingPose, pose, setPose]);

  // ---- 移除参考图:走 selectReference(slot, undefined) 复用现有重排逻辑 ----
  const handleRemoveReference = useCallback(
    (slot: ReferenceSlot) => selectReference(slot, undefined),
    [selectReference],
  );

  // ---- AI assistant ----
  const handleAssistantClick = useCallback(() => {
    runAssistantAnalysis();
  }, [runAssistantAnalysis]);

  // ---- regenerate: clear overrides to fall back to computed prompts ----
  const handleRegenerateAll = useCallback(() => {
    regeneratePrompts();
  }, [regeneratePrompts]);

  // ---- AI optimize selected types ----
  const handleAiOptimizeSelected = useCallback(() => {
    applyAiOptimizeToSelected(selectedTypes);
  }, [applyAiOptimizeToSelected, selectedTypes]);

  // ---- composite applied: set as main (上下装合成预览后写主图) ----
  const handleCompositeApplied = useCallback(
    (asset: { fileResourceId?: string; originalUrl?: string; thumbnailUrl?: string; name?: string }) => {
      // 合成图通常无 asset_resource.id(file_resource 走专用合成流程),
      // 主图分支不调 AI 助手 → id 可为空。
      setMainValue({
        id: undefined,
        fileResourceId: asset.fileResourceId,
        originalUrl: asset.originalUrl,
        thumbnailUrl: withCosThumbnail(asset.thumbnailUrl, 256) ?? asset.originalUrl,
        name: asset.name,
      });
    },
    [],
  );

  // ---- 选择产品:把选中产品的 6 字段填入商品事实 + 主图写入 mainValue ----
  const handleProductPicked = useCallback(
    (product: ProductDTO) => {
      setSelectedFromLibrary(product);
      const nextFacts = {
        name: (product.name ?? '').trim(),
        sellingPoints: (product.sellingPoints ?? '').trim(),
        productCategory: (product.category ?? '').trim(),
        colorPattern: (product.color ?? '').trim(),
        fabricTexture: (product.patternMaterial ?? '').trim(),
        fitStructure: (product.silhouetteStructure ?? '').trim(),
      };
      setProductFacts(nextFacts);
      // 关键:也回写到 hook 的 formInput,触发 `prompts` useMemo 重算 → 4 类型 Prompt 自动重写
      setFormFactsExternal(nextFacts);
      // 主图:imageUrl(ossKey) → withCosThumbnail(256) 拼 COS thumbnail,
      // 与 handleTransitConfirm 的主图分支保持一致缩放规则。
      const compressedThumb = withCosThumbnail(product.imageUrl, 256) ?? product.imageUrl;
      // product.imageId 是后端 product.image_id 的字符串形式(雪花 ID),
      // 必须保持 string,绝不能 Number()(19 位 ID 超出 number 安全范围)
      setMainValue({
        id: product.imageId,
        thumbnailUrl: compressedThumb,
        originalUrl: product.imageUrl,
        name: product.name,
      });
      toast.success(`已选择产品:${product.name}`);
    },
    [setFormFactsExternal],
  );

  const handleClearProduct = useCallback(() => {
    setSelectedFromLibrary(null);
    toast.info('已清除产品卡片选择');
  }, []);

  // ---- 主图点击 → 打开 picker,target='main' ----
  const openMainPicker = useCallback(() => {
    setPendingSlot('main');
  }, []);

  // ---- 参考图 5 slot 点击 → 打开 picker,target=对应 slot ----
  const openSlotPicker = useCallback((slot: ReferenceSlot) => {
    setPendingSlot(slot);
  }, []);

  // ---- picker 确认:按 pendingSlot 路由写值 ----
  const handleTransitConfirm = useCallback(
    (items: import('../../api/modules/asset').AssetResourceItem[]) => {
      if (items.length === 0) return;
      const item = items[0];
      // CI 缩略图参数拼接(与 OutfitComposePanel.tsx:142 同款)
      // - 主图容器 w-full h-44(max 256px):用 256,与 OutfitComposePanel 一致
      // - 参考图容器 w-10 h-10(40px):用 64,与 ProductManagePage.tsx:271 一致(避免浪费带宽)
      const slotRef = toSlotRef(item);
      if (pendingSlot === 'main') {
        const compressedThumb = withCosThumbnail(slotRef.thumbnailUrl, 256) ?? slotRef.thumbnailUrl ?? slotRef.originalUrl;
        // 主图要保留 item.id(asset_resource.id,string),给后端 aiAnalyze + 提交 assetId 用;
        // toSlotRef 不带 id 字段,所以这里手写。
        setMainValue({
          id: item.id,
          fileResourceId: slotRef.fileResourceId,
          thumbnailUrl: compressedThumb,
          originalUrl: slotRef.originalUrl,
          name: slotRef.name,
        });
      } else if (pendingSlot !== null) {
        // 5 个参考图 slot 之一
        // 关键:必须携带 fileResourceId(实际是 asset_resource.id)和 id,否则后端
        //      收到的 assetId 是空串。
        const compressedThumb = withCosThumbnail(slotRef.thumbnailUrl, 64) ?? slotRef.thumbnailUrl ?? slotRef.originalUrl;
        selectReference(pendingSlot, {
          slot: pendingSlot,
          id: item.id,
          fileResourceId: slotRef.fileResourceId,
          thumbnailUrl: compressedThumb,
          originalUrl: slotRef.originalUrl,
          name: slotRef.name,
        });
      }
      setPendingSlot(null);
    },
    [pendingSlot, selectReference],
  );

  const handleTransitClose = useCallback(() => {
    setPendingSlot(null);
  }, []);

  const isProductBound = !!mainValue;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f7fb] text-slate-800">
      {/* Header */}
      <TopHeader
        selectedTypesCount={selectedTypes.length}
        totalCount={totalCount}
        onBack={() => setScreen(AppScreen.TASKS)}
        onCheckAndGenerate={checkAndGenerate}
      />

      {/* 3-column layout */}
      <ThreeColumnLayout
        left={
          <>
            {/* 选择产品卡片 —— 在输入素材上方,宽度与下方 ImageSourceSection 一致 */}
            <ProductPickerCard
              selectedProduct={selectedFromLibrary}
              onPick={() => setProductPickerOpen(true)}
              onClear={handleClearProduct}
            />
            <ImageSourceSection
              mainValue={mainValue}
              onPickMain={openMainPicker}
            />
            {selectedProduct.category === '户外服饰' && (
              <CompositeSection
                productId={
                  /^\d+$/.test(String(selectedProduct.id))
                    ? selectedProduct.id
                    : undefined
                }
                onApplied={handleCompositeApplied}
              />
            )}
            <ReferenceGrid
              orderedRefs={state.orderedRefs}
              onMove={state.moveReference}
              openSlotPicker={openSlotPicker}
              onRemove={handleRemoveReference}
            />
            <ProductFactsEditor
              value={productFacts}
              isProductBound={isProductBound}
              onChange={updateProductFact}
            />
          </>
        }
        center={
          <>
            <ImageContentSection
              isProductBound={isProductBound}
              assistantState={assistantState}
              onAssistantClick={handleAssistantClick}
              selectedTypes={selectedTypes}
              typeCounts={typeCounts}
              defaultPrompts={prompts}
              promptOverrides={promptOverrides}
              templateName={template}
              promptsComplete={promptsComplete}
              onChangePromptOverride={setPromptOverride}
              onRegenerateAll={handleRegenerateAll}
              onAiOptimizeSelected={handleAiOptimizeSelected}
              typeSelector={
                <ImageTypeSelector
                  selectedTypes={selectedTypes}
                  typeCounts={typeCounts}
                  maxCountPerType={5}
                  onToggle={toggleType}
                  onChangeCount={changeTypeCount}
                />
              }
              tagSelector={
                <StyleScenePoseRow
                  styleOptions={styleOptions}
                  sceneOptions={sceneOptions}
                  poseOptions={poseOptions}
                  loadingStyle={loadingStyle}
                  loadingScene={loadingScene}
                  loadingPose={loadingPose}
                  style={style}
                  scene={scene}
                  pose={pose}
                  onStyleChange={setStyle}
                  onSceneChange={setScene}
                  onPoseChange={setPose}
                />
              }
              templateSelector={
                <TemplatePicker
                  value={template}
                  options={[{ id: 'default', name: '默认模板' }]}
                  onPickRequest={requestTemplateChange}
                />
              }
              advancedSettings={
                <AdvancedSettings
                  negativePrompt={negativePrompt}
                  onChange={setNegativePrompt}
                />
              }
            />
          </>
        }
        right={
          <>
            <ImageSettingsSection onParamsChange={setParamsSnapshot} />
            <ReviewStrategyPanel
              reviewEnabled={reviewEnabled}
              onChange={setReviewEnabled}
            />
          </>
        }
      />

      {/* 本页自己的 picker modal:由 pendingSlot state 决定路由到主图/参考图 slot。
          mode='picker' 让确认按钮可用;onConfirmSelection 直接拿 AssetResourceItem[]。 */}
      {isTransitOpen && (
        <AssetTransitModal
          mode="picker"
          targetSlot={pendingSlot ?? 'main'}
          purpose="OTHER"
          assetKind="IMAGE"
          onClose={handleTransitClose}
          onConfirmSelection={handleTransitConfirm}
        />
      )}

      {/* Dialogs (from hook state) */}
      <TemplateOverwriteDialog
        open={templateOverwriteOpen}
        onCancel={() => setTemplateOverwriteOpen(false)}
        onConfirm={() => {
          if (pendingTemplate) applyTemplate(pendingTemplate);
          setTemplateOverwriteOpen(false);
        }}
      />
      <ExecutionConfirmDialog
        open={executionConfirmOpen}
        onSubmit={submitTasks}
        onCancel={() => setExecutionConfirmOpen(false)}
        summary={{
          productName: productFacts.name,
          templateName: template,
          selectedTypes,
          typeCounts,
          totalCount,
          // [2026-07-25 P0 修复] ratio / resolution 直接从 paramsSnapshot.schemaParams 读
          // (ParamSchemaForm 收集,ViduCapabilities schema 字段名),不经过 hook 内部 state。
          ratio: paramsSnapshot.schemaParams?.aspect_ratio ?? '',
          resolution: paramsSnapshot.schemaParams?.resolution ?? '',
        }}
      />
      <ConflictDialog
        open={conflictOpen}
        fields={[]}
        onCancel={() => setConflictOpen(false)}
        onConfirm={() => setConflictOpen(false)}
      />

      {/* 选择产品 picker modal —— 复用 productInfoApi.list */}
      <ProductPickerModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onPick={handleProductPicked}
      />
    </div>
  );
};
