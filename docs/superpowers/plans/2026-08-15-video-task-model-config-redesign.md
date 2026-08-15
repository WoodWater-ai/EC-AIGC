# CreateVideoTask 模型配置样式与位置统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `CreateVideoTask` 4 种视频模式下的模型配置卡片统一升级到 `CompactParamPicker`(参照 `CreateImageTask` 视觉),并调整位置:智能多帧不动,其他 3 种(首帧图生 / 爆款复刻 / 电商复刻)挪到「视频模式卡片」与「提示词卡片」之间。

**Architecture:** 抽 `CompactParamPicker` 到 `components/common/` → `ImageSettingsSection` 改 import 路径(零行为变更)→ `TaskParamsPanel` videoDemo 分支 3 处 select 替换为 CompactParamPicker(不动 default 分支)→ `CreateVideoTask` 重写模型配置卡片渲染并挪位置。先公共化,再升组件,最后改页面,每步独立可验证。

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4 + lucide-react(图标库)。测试:`tsx --test`(node:test,见 `package.json:scripts.test`)。**不引入 Vitest/RTL**(本计划不新增 dev 依赖)。

---

## Global Constraints

- 前端 dev server 端口 3001(`package.json:scripts.dev`)
- 后端 dev proxy `/api/** → http://localhost:8090`(无需本计划关注)
- 包管理:`npm install`(项目根 `EC-AIGC/`)
- 测试命令:`npm test`(实际 `tsx --test "src/**/*.test.ts" "src/**/*.test.tsx"`)
- 类型检查:`npm run lint`(实际 `tsc --noEmit`)
- Tailwind 4 主题:`src/index.css` 的 `@theme {}` 块(不创建 `tailwind.config.js`)
- 严禁执行 `git` / `mvn`,提交由用户 IDE 完成(根 CLAUDE.md §重要约定 1)
- 错误码:本计划不动后端错误码
- 颜色:全局主色 `#D85C42`(terracotta,见 memory `ec-aigc-primary-color-is-terracotta`)
- 测试文件命名 `*.test.ts` / `*.test.tsx`,断言来自 `node:assert/strict`(参考 `AssetTransitModal.test.tsx:1–2`)
- 项目不是 git repo:不执行 git,SDD 用文件快照做 diff review
- CompactParamPicker 接口保持完全一致,仅搬位置;TaskParamsPanel default 分支零修改;CreateImageTask 仅修改一处 import 路径

---

## File Structure

| 文件 | 状态 | 职责 |
| --- | --- | --- |
| `EC-AIGC/src/components/common/CompactParamPicker.tsx` | 新增 | 公共 picker(图标 + label + 弹出 listbox),从 CreateImageTask 搬过来 |
| `EC-AIGC/src/components/CreateImageTask/center/CompactParamPicker.tsx` | 删除 | 旧位置,被新公共组件替代 |
| `EC-AIGC/src/components/CreateImageTask/right/ImageSettingsSection.tsx` | 修改 | 仅改 1 行 import 路径 |
| `EC-AIGC/src/components/createTask/TaskParamsPanel.tsx` | 修改 | videoDemo 分支:通道 / 能力 / 模型 三处 `<select>` → `<CompactParamPicker>`;default 分支零修改 |
| `EC-AIGC/src/components/CreateVideoTask.tsx` | 修改 | 重写模型配置卡片渲染、删除旧 chips summary、调整 3 个模式下的卡片位置 |

**职责边界**:`CompactParamPicker` 只搬不改;`TaskParamsPanel` 只动 videoDemo 分支;`CreateVideoTask` 只动模型配置相关代码。

---

## Task 1: 抽取 `CompactParamPicker` 到 `components/common/`

**Files:**
- Create: `EC-AIGC/src/components/common/CompactParamPicker.tsx`
- Delete: `EC-AIGC/src/components/CreateImageTask/center/CompactParamPicker.tsx`
- Modify: `EC-AIGC/src/components/CreateImageTask/right/ImageSettingsSection.tsx:1-9`(import 路径)

**Interfaces:**
- Consumes: 无
- Produces: 公共路径 `components/common/CompactParamPicker.tsx` 导出 `CompactParamPicker`,`CompactParamOption`,`CompactParamPickerProps`,与旧路径完全一致

### Steps

- [ ] **Step 1.1: 创建 `EC-AIGC/src/components/common/CompactParamPicker.tsx`(从旧路径复制)**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CompactParamOption {
  value: string;
  label: string;
  description?: string;
}

interface CompactParamPickerProps {
  label: string;
  value: string;
  options: CompactParamOption[];
  icon: React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
  widthClassName?: string;
  onChange: (value: string) => void;
}

export const CompactParamPicker: React.FC<CompactParamPickerProps> = ({
  label,
  value,
  options,
  icon,
  disabled = false,
  placeholder = '请选择',
  widthClassName = 'w-[148px]',
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const unavailable = options.length === 0;
  const pickerDisabled = disabled || unavailable;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative min-w-0 max-w-full ${widthClassName}`}>
      <button
        type="button"
        disabled={pickerDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={(selected?.label ?? value) || undefined}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 w-full items-center gap-1.5 rounded-md border bg-white px-2 text-left text-xs font-bold transition-colors ${
          pickerDisabled
            ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
            : open
              ? 'border-primary text-slate-800 shadow-sm'
              : 'border-slate-200 text-slate-700 hover:border-slate-300'
        }`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">{icon}</span>
        <span className="shrink-0 text-[10px] font-bold text-slate-400">{label}</span>
        <span className="min-w-0 flex-1 truncate text-slate-800">{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-10 z-50 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-primary-light ${
                  isSelected ? 'bg-primary-light text-primary' : 'text-slate-700'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.description && (
                  <span className="shrink-0 text-[10px] text-slate-400">{option.description}</span>
                )}
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 1.2: 修改 `EC-AIGC/src/components/CreateImageTask/right/ImageSettingsSection.tsx` 的 import 路径**

将第 7 行:
```ts
import { CompactParamPicker } from '../center/CompactParamPicker';
```
改为:
```ts
import { CompactParamPicker } from '../../common/CompactParamPicker';
```

- [ ] **Step 1.3: 删除 `EC-AIGC/src/components/CreateImageTask/center/CompactParamPicker.tsx`**

```bash
rm "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC/src/components/CreateImageTask/center/CompactParamPicker.tsx"
```

> 注:本计划所有"git 操作"步骤仅作 plan 流程标注,实际由用户 IDE 完成。`rm` 仅删除目标文件。

- [ ] **Step 1.4: 类型检查 + 全量测试,确认 ImageSettingsSection 行为不变**

Run: `cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC" && npm run lint`
Expected: exit 0

Run: `cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC" && npm test`
Expected: 全量通过,数字 ≥ 此前(以此前 SDD 终态为基线,106 个)

- [ ] **Step 1.5: 视觉对照**

启动前端 dev server(`npm run dev`),进入图片任务创建流程比对:模型 / 比例 / 分辨率 picker 应与之前完全一致。如发现差异,检查 import 路径与新文件内容是否一致。

---

## Task 2: `TaskParamsPanel` videoDemo 分支升级 select → CompactParamPicker

**Files:**
- Modify: `EC-AIGC/src/components/createTask/TaskParamsPanel.tsx`

**Interfaces:**
- Consumes: `CompactParamPicker`,`CompactParamOption` from `'../common/CompactParamPicker'`(Task 1)
- Produces: videoDemo 分支的通道 / 能力 / 模型 三处 picker 与 default 分支视觉一致

### Steps

- [ ] **Step 2.1: 在 `TaskParamsPanel.tsx` 顶部添加 import**

在第 1-4 行 import 之后追加:

```ts
import { CompactParamPicker, type CompactParamOption } from '../common/CompactParamPicker';
import { Cpu, Layers, Route } from 'lucide-react';
```

- [ ] **Step 2.2: 替换 videoDemo 分支的「模型通道」`<select>`(行 165-176)**

将原:
```tsx
          {presentation === 'videoDemo' ? (
            <select
              value={tp.channelId ?? ''}
              disabled={tp.locked}
              onChange={(event) => tp.setChannelId(event.target.value)}
              className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-primary"
            >
              {visibleInstances.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.channelName}</option>
              ))}
            </select>
          ) : (
```
替换为:
```tsx
          {presentation === 'videoDemo' ? (
            <CompactParamPicker
              label="模型通道"
              icon={<Route className="h-4 w-4" />}
              value={tp.channelId ?? ''}
              options={visibleInstances.map<CompactParamOption>((inst) => ({
                value: inst.id,
                label: inst.channelName,
              }))}
              disabled={tp.locked}
              placeholder="暂无可用通道"
              widthClassName="w-full"
              onChange={(next) => tp.setChannelId(next)}
            />
          ) : (
```

- [ ] **Step 2.3: 替换 videoDemo 分支的「能力」`<select>`(行 200-227)**

注意:行 200 的整段 `<div>` 块是 default 分支的能力选择器(`presentation !== 'videoDemo'`)。videoDemo 模式下能力走的是固定展示框(行 229-237 的 `showCapabilitySummary`)。**保留能力选择器 default 块不变**;但是 fixedCapability + showCapabilitySummary 的展示框可以保留也可以替换。

实际策略:**保留 videoDemo 下能力字段为只读 summary**(行 229-237 不动),因为视频任务 capability 已经由 `fixedCapability={config.capability}` 锁定,无 picker 必要。

- [ ] **Step 2.4: 替换 videoDemo 分支的「模型」`<select>`(行 239-268)**

将原:
```tsx
        {tp.capability && showModelSelector && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">模型</label>
            <select
              value={tp.modelId === tp.defaultModelCode ? '' : (tp.modelId ?? '')}
              disabled={tp.locked}
              onChange={(e) => tp.setModelId(e.target.value || null)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            >
              <option value="">
                {tp.defaultModelCode
                  ? `默认模型 (${tp.modelOptions.find((option) =>
                    option.modelCode === tp.defaultModelCode)?.displayName ?? tp.defaultModelCode})`
                  : '未配置默认模型，请选择'}
              </option>
              {tp.modelOptions
                .filter((option) => option.modelCode !== tp.defaultModelCode)
                .map((option) => (
                  <option key={option.modelCode} value={option.modelCode}>
                    {option.displayName}
                  </option>
                ))}
            </select>
            {tp.modelOptions.length > 0 && (
              <p className="mt-1 text-[10px] text-slate-400">
                默认值来自系统配置，也可切换为该能力目录中的其他模型。
              </p>
            )}
          </div>
        )}
```
替换为:
```tsx
        {tp.capability && showModelSelector && (() => {
          const defaultOpt = tp.modelOptions.find((option) => option.modelCode === tp.defaultModelCode);
          const isDefaultSelected = tp.modelId === tp.defaultModelCode || tp.modelId === null;
          const modelOptionsList: CompactParamOption[] = [];
          if (defaultOpt) {
            modelOptionsList.push({ value: '', label: `默认模型 (${defaultOpt.displayName})` });
          }
          tp.modelOptions
            .filter((option) => option.modelCode !== tp.defaultModelCode)
            .forEach((option) => {
              modelOptionsList.push({ value: option.modelCode, label: option.displayName });
            });
          return (
            <div>
              <CompactParamPicker
                label="模型"
                icon={<Cpu className="h-4 w-4" />}
                value={isDefaultSelected ? '' : (tp.modelId ?? '')}
                options={modelOptionsList}
                disabled={tp.locked}
                placeholder="未配置默认模型，请选择"
                widthClassName="w-full"
                onChange={(next) => tp.setModelId(next || null)}
              />
              {tp.modelOptions.length > 0 && (
                <p className="mt-1 text-[10px] text-slate-400">
                  默认值来自系统配置，也可切换为该能力目录中的其他模型。
                </p>
              )}
            </div>
          );
        })()}
```

> 注:用 IIFE 包裹而非变量声明,避免在组件顶层引入一个只在条件分支里使用的中间数组。

- [ ] **Step 2.5: 类型检查 + 全量测试**

Run: `cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC" && npm run lint`
Expected: exit 0

Run: `cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC" && npm test`
Expected: 全量通过(数字 ≥ Task 1 终态)

- [ ] **Step 2.6: 视觉对照**

启动前端 dev server,进入视频任务创建流(任意模式),展开「模型配置」折叠块,核对:
- 通道 picker:图标 + label + 当前值 + 箭头
- 能力字段:保留只读 summary(蓝色框,显示固定 capability 标签)
- 模型 picker:图标 + label + 当前值 + 箭头,默认模型占位项「默认模型 (xxx)」在 listbox 中可选项

- [ ] **Step 2.7: 确认 CreateImageTask 行为不变**

进入图片任务创建流,核对模型 / 比例 / 分辨率 picker 行为完全一致(走 default 分支未受影响)。

---

## Task 3: `CreateVideoTask.tsx` 重写模型配置卡片 + 调整位置

**Files:**
- Modify: `EC-AIGC/src/components/CreateVideoTask.tsx`

**Interfaces:**
- Consumes: `CompactParamPicker`,`CompactParamOption` from `'./common/CompactParamPicker'`(Task 1);`TaskParamsPanel` 升级后的 videoDemo 分支(Task 2)
- Produces: 新的模型配置卡片渲染;4 个模式下卡片位置符合 spec

### Steps

- [ ] **Step 3.1: 在 `CreateVideoTask.tsx` 顶部添加 import**

在已有 import 块(行 1-50 附近)中追加:

```ts
import { CompactParamPicker, type CompactParamOption } from './common/CompactParamPicker';
```

- [ ] **Step 3.2: 删除旧的 `renderVideoModelConfig` 函数(行 983-1052)**

直接删除整个函数定义(包含 chips array、`details` summary 块、`<TaskParamsPanel>` JSX 块)。**模型配置卡片改由新函数 `renderVideoModelCard` 替代,在每个模式 case 内直接调用。**

- [ ] **Step 3.3: 添加新函数 `renderVideoModelCard`,放置在 `renderVideoModelConfig` 原位置(行 983 之后)**

```tsx
  /**
   * [2026-08-15] 视频任务模型配置卡片 —— 统一视觉与 CreateImageTask 一致
   * 使用 CompactParamPicker(图标 + label + popover)替代旧 select,布局紧凑
   * 内部走 TaskParamsPanel 视频演示分支(presentation='videoDemo')
   * 4 个模式共享同一函数,位置由调用方决定
   */
  const renderVideoModelCard = (showModelSelector: boolean) => {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-bold text-primary">模型配置</p>
        <h2 className="mt-1 font-black">本次任务通道与模型</h2>
        <div className="mt-3">
          <TaskParamsPanel
            key={mode}
            group={config.group}
            prefill={activeVideoParamsPrefill}
            prefillPending={Boolean(creationTemplateId) && creationPrefillQuery.loading}
            unified={{ productName: productFacts.name ?? '', sellingPoints: productFacts.sellingPoints }}
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
            schemaParamsPatch={isEcommerceReplicate ? sourceDurationPatch : null}
            showAspectRatio={false}
            showPromptEditor={false}
            showNegativePrompt={false}
            showModelSelector={showModelSelector}
            showCapabilitySummary={true}
            showCount={false}
            presentation="videoDemo"
          />
        </div>
      </div>
    );
  };
```

> 与旧实现的关键差异:
> - 取消 `<details>` summary 折叠(始终展开)
> - 取消 chips summary 块
> - 取消 `<div className="border-t border-slate-100 pt-4">` 包裹
> - 加 `rounded-lg border border-slate-200 bg-white p-4` 卡片容器,跟 ImageSettingsSection 视觉一致
> - `showCapabilitySummary={true}`(原本 false)—— 让能力字段走只读 summary 框

- [ ] **Step 3.4: 调整首帧图生 / 爆款复刻 / 电商复刻的卡片位置**

定位到行 1477-1606 之间的非 MULTI_FRAME 分支(目前是 `<>` 包裹的两个块:Prompt 卡片 + `{renderVideoModelConfig(mode === 'FIRST_FRAME')}`)。**目标**:把 `{renderVideoModelCard(mode === 'FIRST_FRAME')}` 挪到 Prompt 卡片**之前**。

具体:在原 Prompt 卡片的 `<div className="rounded-lg border border-slate-200 bg-white p-5">` 之前插入:

```tsx
              {renderVideoModelCard(mode === 'FIRST_FRAME')}
```

并删除当前在行 1604 的 `{renderVideoModelConfig(mode === 'FIRST_FRAME')}`。

- [ ] **Step 3.5: 调整智能多帧卡片位置(保持原位)**

行 1425 的 `{renderVideoModelConfig(true)}` 替换为 `{renderVideoModelCard(true)}`。位置不变。

- [ ] **Step 3.6: 类型检查 + 全量测试**

Run: `cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC" && npm run lint`
Expected: exit 0

Run: `cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC" && npm test`
Expected: 全量通过(数字 ≥ Task 2 终态)

- [ ] **Step 3.7: 视觉对照与位置验证**

启动前端 dev server,逐个模式检查:

1. 首帧图生视频 → 模式卡片 → **模型配置卡片** → 提示词卡片 → 提交前检查
2. 爆款复刻 → 模式卡片 → **模型配置卡片** → 提示词卡片 → 提交前检查
3. 电商复刻 → 模式卡片 → **模型配置卡片** → 提示词卡片 → 提交前检查
4. 智能多帧 → 模型配置卡片(原位合适,顶部)

所有模式都应:
- 通道 / 能力(summary) / 模型 picker 图标 + label + 值 + 箭头正常
- 模型切换后,时长 / 分辨率 / 比例 / 音频 picker 自动更新
- 锁定状态(`tp.locked`)picker 不可点
- chips summary 不再出现
- `<details>` summary 折叠交互消失,卡片直接展开

- [ ] **Step 3.8: CreateImageTask 行为再核对**

进入图片任务创建流,确认模型配置(走 default 分支)未受任何影响。

---

## Task 4: 手工验收清单

**Files:** 无(纯人工操作,IDE 中进行)

### Steps

- [ ] **Step 4.1: 启动后端**

在 IDE 用 `DafenqiAiApplication` 主类 + Spring Boot 配置启动后端(`localhost:8090`)。

- [ ] **Step 4.2: 启动前端 dev server**

在 `EC-AIGC/` 目录运行 `npm run dev`(端口 3001)。

- [ ] **Step 4.3: 验证首帧图生视频**

- 模式卡片 → **模型配置卡片** → 提示词卡片 → 提交前检查
- 卡片内 picker:模型通道 / 模型 / 时长 / 分辨率 / 比例 / 音频(图标 + label + 值 + 箭头)
- 切换模型通道 → 模型 picker 自动更新选项
- 切换模型 → 时长 / 分辨率 / 比例 / 音频 picker 自动更新

- [ ] **Step 4.4: 验证爆款复刻**

- 模型配置卡片位置:模式卡片与提示词卡片之间
- picker 行为同 §4.3

- [ ] **Step 4.5: 验证电商复刻**

- 模型配置卡片位置:模式卡片与提示词卡片之间
- picker 行为同 §4.3

- [ ] **Step 4.6: 验证智能多帧**

- 模型配置卡片位置不动(原有顶部位置合适)

- [ ] **Step 4.7: 验证 CreateImageTask 不受影响**

- 进入图片任务创建流,核对模型 / 比例 / 分辨率 picker 视觉与交互完全一致

- [ ] **Step 4.8: 验证响应式**

- 屏幕宽度变窄,picker 自动换行不挤压

- [ ] **Step 4.9: 验证锁定态**

- 通过 assistantPrefill 触发 `tp.locked = true` 时,picker 不可点

---

## Summary

完成后文件清单:
- Created: `EC-AIGC/src/components/common/CompactParamPicker.tsx`
- Deleted: `EC-AIGC/src/components/CreateImageTask/center/CompactParamPicker.tsx`
- Modified: `EC-AIGC/src/components/CreateImageTask/right/ImageSettingsSection.tsx`(1 行 import)
- Modified: `EC-AIGC/src/components/createTask/TaskParamsPanel.tsx`(videoDemo 分支)
- Modified: `EC-AIGC/src/components/CreateVideoTask.tsx`(模型配置卡片 + 3 处位置)

User action items (NOT done by AI — project policy):
1. `git commit` 等任意需要 git 的操作
2. IDE 启动后端 + 手动验收