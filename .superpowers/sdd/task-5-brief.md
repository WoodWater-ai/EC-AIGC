# Task 5 Brief — CreateImageTask 改造(13 state → slotRefs + 7 处 JSX)

> 来源:`EC-AIGC/docs/superpowers/plans/2026-07-14-transit-picker-resource-confirm.md` Task 5

## 目标

`src/components/CreateImageTask.tsx` 全面改造,把 7 个素材 slot 全部接入 Task 1-4 交付的设施。**这是计划里最大的一改**。

具体:
1. 删除 13 个独立 slot state(7 FileResId + 6 boolean)→ 改用 1 个 `Record<SlotKey, SlotRef | null>`
2. 删除 `isInternalTransitOpen` / `transitTargetSlot` / `handleTransitConfirmSelection` 三个中间件
3. 删除 import `AssetTransitModal` / `useCallback`(可选)
4. 7 处 slot JSX 改用 `<TransitPickerButton>`
5. `handleCompositePreview` 改用 `slotRefs.top / .bottom` 校验
6. `handleSubmitTask` 给 `buildSubmitPayload` 传 `slotRefs`
7. 删除文件末尾的 `<AssetTransitModal>` 渲染

## Files

- Modify: `EC-AIGC/src/components/CreateImageTask.tsx`(799 行,本任务改动 ~80 行)

## 当前文件结构概览(精确定位)

- line 1: `import React, { useState, useEffect } from 'react';`
- line 3: `import { AssetTransitModal } from './AssetTransitModal';` ← **删除**
- line 7: `import { buildSubmitPayload } from './createTask/buildSubmitPayload';`
- line 31-33: 内部 modal state(isInternalTransitOpen, transitTargetSlot)← **整段删除**
- line 35-42: 7 个 FileResId state ← **整段删除**
- line 44-79: `handleTransitConfirmSelection` 函数 ← **整段删除**
- line 109-116: 6 个 boolean state(topClothingUploaded 等)← **整段删除**
- line 170-182: `handleCompositePreview` 函数 ← **改 1 行校验**
- line 184-216: `handleSubmitTask` 函数 ← **加 1 行 `slotRefs`**
- line 296-315: 主图上传卡片 JSX ← **替换**
- line 328-348: 上衣 slot JSX ← **替换**
- line 353-373: 下装 slot JSX ← **替换**
- line 397-410: 细节 slot JSX ← **替换**
- line 412-433: 风格 slot JSX ← **替换**
- line 435-449: 场景 slot JSX ← **替换**
- line 451-465: 姿势 slot JSX ← **替换**
- line 786-794: `<AssetTransitModal>` 渲染 ← **删除整段**

## 改动 1: import 区(line 1-8)

**替换前**:
```ts
import React, { useState, useEffect } from 'react';
import { ProductAsset, GenerationTask, AppScreen } from '../types';
import { AssetTransitModal } from './AssetTransitModal';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { templateApi, type TemplateDTO } from '../api/modules/template';
import { TaskParamsPanel } from './createTask/TaskParamsPanel';
import { buildSubmitPayload } from './createTask/buildSubmitPayload';
import { submitTask } from '../api/modules/task';
```

**替换后**:
```ts
import React, { useState, useEffect, useCallback } from 'react';
import { ProductAsset, GenerationTask, AppScreen } from '../types';
import { TransitPickerButton } from './common/TransitPickerButton';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import { templateApi, type TemplateDTO } from '../api/modules/template';
import { TaskParamsPanel } from './createTask/TaskParamsPanel';
import { buildSubmitPayload } from './createTask/buildSubmitPayload';
import { submitTask } from '../api/modules/task';
import { type SlotKey, type SlotRef } from './createTask/slots';
```

## 改动 2: 删除并替换 line 31-79

**整段(line 31-79 全部)删除,替换为**:

```ts
  // 7 个 slot 的资源引用(统一 Record,替代原 13 个独立 state)
  const [slotRefs, setSlotRefs] = useState<Record<SlotKey, SlotRef | null>>({
    main: null, top: null, bottom: null, detail: null,
    style: null, scene: null, pose: null,
  });
  const setSlotRef = useCallback((slot: SlotKey, ref: SlotRef | null) => {
    setSlotRefs((prev) => ({ ...prev, [slot]: ref }));
  }, []);
```

## 改动 3: 删除并替换 line 109-116

**整段(line 109-116 全部)删除,替换为**:(留空,无新增)

## 改动 4: 删除 line 119 处的 `isUploading`

**等等,先 grep 确认** `isUploading` 的位置。从上面 grep 结果,`isUploading` 在 line 119:

```
119:  // Mock Upload state for main asset
120:  const [isUploading, setIsUploading] = useState(false);
```

> **不删除**。`isUploading` 是 `handleMockUploadMain` 用的,跟 slot 无关,保留。grep 结果显示 `isUploading` 仍然需要。

## 改动 5: `handleCompositePreview` 改校验(line 170-176)

**替换前**:
```ts
  const handleCompositePreview = () => {
    if (!topClothingUploaded || !bottomClothingUploaded) {
      alert('请先添加上衣和下装素材后再进行合成！');
      return;
    }
    setHasCompositePreviewed(true);
    alert('合成预览成功！已自动将"上下装合成套图"入库并设为主体图。');
    setSelectedProduct({
      ...selectedProduct,
      name: '智能拼合秋季潮流女装套组',
      thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80',
    });
  };
```

**替换后**:
```ts
  const handleCompositePreview = () => {
    if (!slotRefs.top || !slotRefs.bottom) {
      alert('请先添加上衣和下装素材后再进行合成！');
      return;
    }
    setHasCompositePreviewed(true);
    alert('合成预览成功！已自动将"上下装合成套图"入库并设为主体图。');
    setSelectedProduct({
      ...selectedProduct,
      name: '智能拼合秋季潮流女装套组',
      thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80',
    });
  };
```

(只把 `!topClothingUploaded || !bottomClothingUploaded` 改成 `!slotRefs.top || !slotRefs.bottom`,其余不动)

## 改动 6: `handleSubmitTask` 加 slotRefs(line 184-216)

找到 `buildSubmitPayload({` 调用的最后一个属性后(在 `templateVersionId: imagePrefill?.templateVersionId,` 之后),插入:

```ts
      slotRefs,
```

完整 `handleSubmitTask` 应为:

```ts
  const handleSubmitTask = async () => {
    if (!taskParams.channelType || !taskParams.capability) {
      alert('请先在右侧选择通道和能力');
      return;
    }
    if (!taskParams.channelId) {
      alert('请先在右侧选择通道实例');
      return;
    }
    const payload = buildSubmitPayload({
      title: `图片生成任务_${productName}`,
      productId: String(selectedProduct.id),
      taskType: 'PRODUCT_MAIN',
      channelType: taskParams.channelType,
      capability: taskParams.capability,
      modelId: taskParams.modelId ?? undefined,
      modelChannelId: String(taskParams.channelId),
      aspectRatio,
      count,
      prompt: promptText,
      negativePrompt,
      schemaParams: taskParams.schemaParams,
      templateId: imagePrefill?.templateId,
      templateVersionId: imagePrefill?.templateVersionId,
      slotRefs,
    });
    try {
      await submitTask(payload);
      sessionStorage.removeItem('beta.template.prefill');
      setScreen(AppScreen.TASKS);
    } catch {
      // http 拦截器已 toast 错误
    }
  };
```

## 改动 7: 主图上传卡片 JSX(line 296-315)

**替换前**:
```tsx
            {/* Primary Image Upload Box */}
            <div 
              onClick={() => {
                setTransitTargetSlot('main');
                setIsInternalTransitOpen(true);
              }}
              className="relative border-2 border-dashed border-blue-250 rounded-xl p-5 bg-blue-50/50 flex flex-col items-center justify-center text-center hover:bg-blue-50 transition-colors cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center mb-2.5 shadow-xs group-hover:shadow text-blue-500 transition-shadow">
                <span className="material-symbols-outlined text-xl">cloud_upload</span>
              </div>
              <div className="text-blue-600 font-bold text-xs lg:text-sm mb-1">
                点击上传图片打开资源中心
              </div>
              <div className="text-[10px] lg:text-xs text-slate-400 leading-relaxed max-w-[240px]">
                所有资源选择都要打开资源中心，支持本地上传与目录扫描，可多选及勾选上传。
              </div>
              <div className="text-[9px] lg:text-[10px] text-slate-400 mt-2 font-mono">
                通过资源中心统一管理和添加主体素材
              </div>
            </div>
```

**替换后**:
```tsx
            {/* Primary Image Upload Box */}
            <div className="relative border-2 border-dashed border-blue-250 rounded-xl p-5 bg-blue-50/50 flex flex-col items-center justify-center text-center hover:bg-blue-50 transition-colors group">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center mb-2.5 shadow-xs group-hover:shadow text-blue-500 transition-shadow">
                <span className="material-symbols-outlined text-xl">cloud_upload</span>
              </div>
              <TransitPickerButton
                slot="main"
                value={slotRefs.main}
                onChange={(next) => setSlotRef('main', next)}
                size="lg"
                variant="primary"
                placeholder="点击上传图片打开资源中心"
                selectedLabel="已选择主图"
              />
              <div className="text-[10px] lg:text-xs text-slate-400 leading-relaxed max-w-[240px] mt-2">
                所有资源选择都要打开资源中心，支持本地上传与目录扫描，可多选及勾选上传。
              </div>
              <div className="text-[9px] lg:text-[10px] text-slate-400 mt-2 font-mono">
                通过资源中心统一管理和添加主体素材
              </div>
            </div>
```

(主图卡片有图标 + 主按钮 + 副标题三层结构,外层 div 控制 dashed box 视觉,内嵌 TransitPickerButton 提供点击行为。删掉外层 div 的 onClick,因为点击由 TransitPickerButton 内部 button 处理。)

## 改动 8: 上衣 slot JSX(line 328-348)

**替换前**:
```tsx
                  {/* Top slot */}
                  <div 
                    onClick={() => {
                      setTransitTargetSlot('top');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      topClothingUploaded ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {topClothingUploaded ? (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1 text-blue-500">check_circle</span>
                        <span className="text-[9px] lg:text-[10px] font-bold">已添加上衣</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1">checkroom</span>
                        <span className="text-[9px] lg:text-[10px]">添加上衣</span>
                      </>
                    )}
                  </div>
```

**替换后**:
```tsx
                  {/* Top slot */}
                  <div
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                      slotRefs.top ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="top"
                      value={slotRefs.top}
                      onChange={(next) => setSlotRef('top', next)}
                      size="md"
                      placeholder="添加上衣"
                      selectedLabel="已添加上衣"
                      icon="checkroom"
                      selectedIcon="check_circle"
                    />
                  </div>
```

(删外层 div 的 onClick;`topClothingUploaded` 全部替换为 `slotRefs.top` 布尔判断;占位/已选态由 TransitPickerButton 内部 button 提供)

## 改动 9: 下装 slot JSX(line 353-373)

**替换前**:
```tsx
                  {/* Bottom slot */}
                  <div 
                    onClick={() => {
                      setTransitTargetSlot('bottom');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      bottomClothingUploaded ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {bottomClothingUploaded ? (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1 text-blue-500">check_circle</span>
                        <span className="text-[9px] lg:text-[10px] font-bold">已添加下装</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl mb-1">accessibility_new</span>
                        <span className="text-[9px] lg:text-[10px]">添加下装</span>
                      </>
                    )}
                  </div>
```

**替换后**:
```tsx
                  {/* Bottom slot */}
                  <div
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                      slotRefs.bottom ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="bottom"
                      value={slotRefs.bottom}
                      onChange={(next) => setSlotRef('bottom', next)}
                      size="md"
                      placeholder="添加下装"
                      selectedLabel="已添加下装"
                      icon="accessibility_new"
                      selectedIcon="check_circle"
                    />
                  </div>
```

## 改动 10: 细节 slot JSX(line 397-410)

**替换前**:
```tsx
                {/* Slot 1: Details */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('detail');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center cursor-pointer mb-1 transition-all ${
                      detailRefUploaded ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{detailRefUploaded ? 'check' : '+'}</span>
                  </button>
                  <span className={`text-[10px] font-medium ${detailRefUploaded ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>细节</span>
                </div>
```

**替换后**:
```tsx
                {/* Slot 1: Details */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center mb-1 transition-all ${
                      slotRefs.detail ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="detail"
                      value={slotRefs.detail}
                      onChange={(next) => setSlotRef('detail', next)}
                      size="sm"
                      placeholder="细节"
                      selectedLabel="已添加细节"
                      icon="add"
                      selectedIcon="check"
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${slotRefs.detail ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>细节</span>
                </div>
```

(原用 `<button>`,改用 `<div>` 包 TransitPickerButton;`detailRefUploaded` → `slotRefs.detail`)

## 改动 11: 风格 slot JSX(line 412-433)

**替换前**:
```tsx
                {/* Slot 2: Style */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('style');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border rounded-lg flex flex-col relative overflow-hidden cursor-pointer mb-1 shadow-xs transition-all ${
                      styleRefParsed ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <div className={`flex-1 flex items-center justify-center ${styleRefParsed ? 'text-blue-500' : 'text-slate-400'}`}>
                      <span className="material-symbols-outlined text-xl">palette</span>
                    </div>
                    {styleRefParsed && (
                      <div className="bg-blue-500 text-white text-[8px] text-center py-[2px] absolute bottom-0 w-full font-bold">
                        已解析
                      </div>
                    )}
                  </button>
                  <span className={`text-[10px] font-medium ${styleRefParsed ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>风格</span>
                </div>
```

**替换后**:
```tsx
                {/* Slot 2: Style */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full aspect-square border rounded-lg flex flex-col relative overflow-hidden mb-1 shadow-xs transition-all ${
                      slotRefs.style ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <div className={`flex-1 flex items-center justify-center ${slotRefs.style ? 'text-blue-500' : 'text-slate-400'}`}>
                      <span className="material-symbols-outlined text-xl">palette</span>
                    </div>
                    {slotRefs.style && (
                      <div className="bg-blue-500 text-white text-[8px] text-center py-[2px] absolute bottom-0 w-full font-bold">
                        已解析
                      </div>
                    )}
                    <TransitPickerButton
                      slot="style"
                      value={slotRefs.style}
                      onChange={(next) => setSlotRef('style', next)}
                      size="sm"
                      placeholder="风格"
                      selectedLabel="已添加风格"
                      icon="palette"
                      selectedIcon="palette"
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${slotRefs.style ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>风格</span>
                </div>
```

(原 `<button>` 嵌套了 icon + 已解析 badge + TransitPickerButton 三层;新方案把 TransitPickerButton 作为内嵌点击元素,palette icon 仍是外层可见的视觉)

## 改动 12: 场景 slot JSX(line 435-449)

**替换前**:
```tsx
                {/* Slot 3: Scene */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('scene');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center cursor-pointer mb-1 transition-all ${
                      sceneRefUploaded ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{sceneRefUploaded ? 'check' : '+'}</span>
                  </button>
                  <span className={`text-[10px] font-medium ${sceneRefUploaded ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>场景</span>
                </div>
```

**替换后**:
```tsx
                {/* Slot 3: Scene */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center mb-1 transition-all ${
                      slotRefs.scene ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="scene"
                      value={slotRefs.scene}
                      onChange={(next) => setSlotRef('scene', next)}
                      size="sm"
                      placeholder="场景"
                      selectedLabel="已添加场景"
                      icon="add"
                      selectedIcon="check"
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${slotRefs.scene ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>场景</span>
                </div>
```

## 改动 13: 姿势 slot JSX(line 451-465)

**替换前**:
```tsx
                {/* Slot 4: Pose */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={() => {
                      setTransitTargetSlot('pose');
                      setIsInternalTransitOpen(true);
                    }}
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center cursor-pointer mb-1 transition-all ${
                      poseRefUploaded ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{poseRefUploaded ? 'check' : '+'}</span>
                  </button>
                  <span className={`text-[10px] font-medium ${poseRefUploaded ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>姿势</span>
                </div>
```

**替换后**:
```tsx
                {/* Slot 4: Pose */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center mb-1 transition-all ${
                      slotRefs.pose ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="pose"
                      value={slotRefs.pose}
                      onChange={(next) => setSlotRef('pose', next)}
                      size="sm"
                      placeholder="姿势"
                      selectedLabel="已添加姿势"
                      icon="add"
                      selectedIcon="check"
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${slotRefs.pose ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>姿势</span>
                </div>
```

## 改动 14: 删除文件末尾 `<AssetTransitModal>` 渲染(line 786-794)

**删除整段**:

```tsx
      {isInternalTransitOpen && (
        <AssetTransitModal
          purpose="PRODUCT"
          productId={selectedProduct?.id ? Number(selectedProduct.id) : undefined}
          onClose={() => setIsInternalTransitOpen(false)}
          onConfirmSelection={handleTransitConfirmSelection}
          targetSlot={transitTargetSlot}
        />
      )}
```

(由 7 个 `<TransitPickerButton>` 各自挂自己的 modal 实例)

## 执行步骤

1. **不写 test**(本任务纯 JSX 重构,无新测试;slot 行为由 Task 4 test + 端到端 smoke 覆盖)
2. 备份当前关键段(line 31-79 / 109-116 / 170-216 / 296-465 / 786-794),便于回退
3. 按改动 1 → 14 顺序应用
4. 每改完一组(3 处),跑 `cd EC-AIGC && npm run lint` 验证 TS 不报错
5. 全部改完后再跑一次完整 lint
6. 跑 `npx tsx src/components/createTask/buildSubmitPayload.test.ts` 验证未破坏 Task 2 test
7. 不做 git commit

## 验证清单

- 13 个旧 state 全部消失(grep `FileResId\|Uploaded\|RefParsed` 仅剩 `slotRefs`)
- 7 处 JSX 全部含 `<TransitPickerButton`
- 7 个 setSlotRef 调用一对一对应 7 个 slot
- `handleCompositePreview` 用 `slotRefs.top / .bottom` 校验
- `handleSubmitTask` 传 `slotRefs` 给 `buildSubmitPayload`
- `<AssetTransitModal>` 顶层实例已删除
- `import { AssetTransitModal }` 已删除
- `isInternalTransitOpen` / `transitTargetSlot` / `handleTransitConfirmSelection` 全部消失
- `npm run lint` 不报新错
- 7/7 buildSubmitPayload tests 仍 pass

## Global Constraints

1. 不要 `any`
2. slot 常量走 `SLOT_KEYS / SLOT_META`(通过 `SlotKey` 类型消费)
3. 不引入新依赖
4. 不自动 commit
5. 不动 AssetTransitModal / TransitPickerButton / slots.ts / buildSubmitPayload.ts
6. 不重构 handleCompositePreview 的 alert(不在本任务范围,后续可独立处理)
7. 不重构 TaskParamsPanel / selectedProduct 逻辑
8. 不动 onAddTask / openTransit / products / setScreen / selectedProduct / setSelectedProduct props

## 上下文接口(给本任务用)

- 消费:`TransitPickerButton` from `./common/TransitPickerButton`(Task 4)
- 消费:`SlotKey / SlotRef` from `./createTask/slots`(Task 1)
- 消费:`buildSubmitPayload({ ..., slotRefs })` from `./createTask/buildSubmitPayload`(Task 2)
- 消费:`AssetResourceItem[]` 回调签名(已删除,父组件不再直接处理)
- 输出:改造后的 CreateImageTask,7 个 slot 全部接 TransitPickerButton,提交 payload 携带 slotRefs
- 后续 Task 6 跑端到端 smoke 验证
