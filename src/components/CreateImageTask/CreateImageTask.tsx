// src/components/CreateImageTask/CreateImageTask.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppScreen } from '../../types';
import type { ProductAsset, GenerationTask } from '../../types';
import type { ProductDTO } from '../../api/modules/productInfo';
import type { ImageGenerationType, ReadinessCheck } from '../../lib/createImageTask/readinessChecks';
import type { ReferenceSlot } from '../../lib/createImageTask/extractReferenceInsights';
import type { ProductFactsInput } from '../../lib/createImageTask/extractProductFacts';
import { toSlotRef } from '../common/TransitPickerButton';

import { TopHeader } from './header/TopHeader';
import { ReadinessBanner } from './header/ReadinessBanner';
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
import { ImageSettingsSection } from './right/ImageSettingsSection';
import { ReviewStrategyPanel } from './right/ReviewStrategyPanel';
import { ConflictDialog } from './dialogs/ConflictDialog';
import { TemplateOverwriteDialog } from './dialogs/TemplateOverwriteDialog';
import { ExecutionConfirmDialog } from './dialogs/ExecutionConfirmDialog';
import { AssetTransitModal } from '../AssetTransitModal';
import { useCreateImageTaskState } from '../../hooks/useCreateImageTaskState';
import { REFERENCE_SLOTS_INTERNAL } from '../../lib/createImageTask/referencesConfig';
import { withCosThumbnail } from '../../utils/cosImage';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
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
    /** asset_resource.id(后端 aiAnalyze 需要) */
    id?: number;
    /** file_resource.id(原有 SlotRef 主键,提交 payload 用) */
    fileResourceId?: number;
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
  const state = useCreateImageTaskState({
    isProductBound: !!mainValue,
    mainAssetId: mainValue?.id ?? null,
    product: selectedProduct,
    // AI 助手成功后,把后端 6 字段一次回写到顶层 productFacts state,
    // 让 ProductFactsEditor 的 input 实时刷新。
    onAiComplete: setProductFacts,
    channel: { id: 'channel-1', name: '云端 API', accessType: 'cloud', health: 'NORMAL' },
    model: {
      id: 'gpt-image-1',
      name: 'gpt-image-1',
      capability: {
        ratios: ['1:1', '3:4', '4:5', '9:16', '16:9'],
        maxCount: 5,
        resolutions: ['1024px', '1536px', '2048px'],
      },
    },
    ratio: '3:4',
    resolution: '1536px',
    templateName: '默认模板',
    toSubmit: async () => '',
    onAddTask,
    setScreen,
  });

  const {
    selectedTypes, typeCounts, template,
    style, scene, pose, negativePrompt,
    promptOverrides, factsConfirmed, promptsConfirmed,
    assistantState, reviewEnabled, references, readinessIssue,
    conflictOpen, templatePickerOpen, pendingTemplate,
    templateOverwriteOpen, executionConfirmOpen,
    isSubmitting,
    ratio, resolution,
    setConflictOpen, setTemplateOverwriteOpen, setExecutionConfirmOpen,
    setRatio, setResolution,
    readinessCount, prompts, promptsComplete, factsComplete,
    isSupported, totalCount,
    toggleType, changeTypeCount, requestTemplateChange, applyTemplate,
    setStyle, setScene, setPose, setNegativePrompt,
    updateProductFact, setFormFactsExternal, setFactsConfirmed, confirmFacts,
    setPromptOverride, confirmPrompts, runAssistantAnalysis,
    regeneratePrompts, applyAiOptimizeToSelected,
    applyPreset, setReviewEnabled,
    selectReference, updateReferenceOrder, checkAndGenerate, submitTasks,
  } = state;

  // ---- 移除参考图(本期未在 UI 暴露:用户点卡片走 picker 选图覆盖,顺序拖拽走 moveReference) ----
// 保持 onRemove 入口为 future 留位

  // ---- derived readiness state for banner ----
  const readiness = useMemo(() => {
    const checks = state.readinessChecks;
    const map = new Map<number, boolean>();
    checks.forEach((c) => map.set(c.id, c.complete));
    return {
      selectMain: !!mainValue,
      confirmFacts: map.get(2) ?? false,
      confirmPrompts: map.get(3) ?? false,
      unsupportedSpec: map.get(4) ?? false,
    };
  }, [state.readinessChecks, mainValue]);

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

  // ---- preset apply: update ratio/resolution via hook ----
  const handlePresetApply = useCallback(
    (preset: { name: string; ratio: string; resolution: string }) => {
      if (preset.ratio === ratio && preset.resolution === resolution) return;
      setRatio(preset.ratio);
      setResolution(preset.resolution);
      applyPreset(preset);
    },
    [applyPreset, ratio, resolution, setRatio, setResolution],
  );

  // ---- composite applied: set as main (上下装合成预览后写主图) ----
  const handleCompositeApplied = useCallback(
    (asset: { fileResourceId?: number; originalUrl?: string; thumbnailUrl?: string; name?: string }) => {
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
      setFactsConfirmed(false);
      // 主图:imageUrl(ossKey) → withCosThumbnail(256) 拼 COS thumbnail,
      // 与 handleTransitConfirm 的主图分支保持一致缩放规则。
      const compressedThumb = withCosThumbnail(product.imageUrl, 256) ?? product.imageUrl;
      setMainValue({
        id: product.imageId ? Number(product.imageId) : undefined,
        thumbnailUrl: compressedThumb,
        originalUrl: product.imageUrl,
        name: product.name,
      });
      toast.success(`已选择产品:${product.name}`);
    },
    [setFormFactsExternal, setFactsConfirmed],
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
        // 主图要保留 item.id(asset_resource.id),给后端 aiAnalyze 用;
        // toSlotRef 不带 id 字段,所以这里手写。
        setMainValue({
          id: item.id,
          fileResourceId: slotRef.fileResourceId,
          thumbnailUrl: compressedThumb,
          originalUrl: slotRef.originalUrl,
          name: slotRef.name,
        });
      } else if (pendingSlot !== null) {
        // 5 个参考图 slot 之一(不需要 aiAnalyze,只存 URL 信息即可)
        const compressedThumb = withCosThumbnail(slotRef.thumbnailUrl, 64) ?? slotRef.thumbnailUrl ?? slotRef.originalUrl;
        selectReference(pendingSlot, {
          slot: pendingSlot,
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
    <div className="h-screen flex flex-col bg-white overflow-hidden text-slate-800">
      {/* Header */}
      <TopHeader
        selectedTypesCount={selectedTypes.length}
        totalCount={totalCount}
        readinessCount={readinessCount}
        onBack={() => setScreen(AppScreen.TASKS)}
        onCheckAndGenerate={checkAndGenerate}
      />

      {/* Readiness banner */}
      <ReadinessBanner readiness={readiness} />

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
            />
          </>
        }
        center={
          <>
            <ImageTypeSelector
              selectedTypes={selectedTypes}
              typeCounts={typeCounts}
              maxCountPerType={5}
              onToggle={toggleType}
              onChangeCount={changeTypeCount}
            />
            <TemplatePicker
              value={template}
              options={[{ id: 'default', name: '默认模板' }]}
              onPickRequest={requestTemplateChange}
            />
            <StyleScenePoseRow
              style={style}
              scene={scene}
              pose={pose}
              onStyleChange={setStyle}
              onSceneChange={setScene}
              onPoseChange={setPose}
            />
            <AdvancedSettings
              negativePrompt={negativePrompt}
              onChange={setNegativePrompt}
            />
            <ImageContentSection
              isProductBound={isProductBound}
              assistantState={assistantState}
              onAssistantClick={handleAssistantClick}
              productFacts={productFacts}
              factsComplete={factsComplete}
              factsConfirmed={factsConfirmed}
              onChangeFact={updateProductFact}
              onConfirmFacts={confirmFacts}
              promptsConfirmed={promptsConfirmed}
              selectedTypes={selectedTypes}
              defaultPrompts={prompts}
              promptOverrides={promptOverrides}
              templateName={template}
              promptsComplete={promptsComplete}
              onChangePromptOverride={setPromptOverride}
              onRegenerateAll={handleRegenerateAll}
              onAiOptimizeSelected={handleAiOptimizeSelected}
              onConfirmPrompts={confirmPrompts}
            />
          </>
        }
        right={
          <>
            <ImageSettingsSection isSupported={isSupported} />
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
          ratio,
          resolution,
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
