# 产品素材库入口与合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从产品管理打开指定 SKU 的产品素材库，复用现有合并抽屉并默认将产物设为素材封面，同时隔离产品素材与通用素材视图。

**Architecture:** 前端在产品管理持有选中的 SKU，并将其作为初始上下文传给 `AssetTransitModal`；该弹窗把当前 SKU 的已选图片交给 `ResourceMergeDrawer`。合并抽屉返回新建资源 ID 后由弹窗调用既有封面 API。后端仅收紧通用素材分页的默认查询条件。

**Tech Stack:** React 19、TypeScript 5.8、Spring Boot 3.5、MyBatis-Plus、`tsx --test`。

---

### Task 1: 打开指定 SKU 的产品素材库

**Files:**
- Modify: `src/components/ProductManagePage.tsx`
- Modify: `src/components/AssetTransitModal.tsx`
- Test: `src/components/AssetTransitModal.test.tsx`

- [x] 增加 `initialProduct` 上下文，使用其初始化 `focusedProduct`。
- [x] 在 SKU 行增加带提示的素材库图标，打开管理模式的产品素材弹窗。
- [x] 为初始 SKU 上下文增加类型级测试。

### Task 2: 复用一级合并抽屉

**Files:**
- Modify: `src/components/AssetTransitModal.tsx`
- Modify: `src/components/common/ResourceMergeDrawer.tsx`
- Test: `src/components/common/ResourceMergeDrawer.test.tsx`

- [x] 在已进入 SKU 时允许选中两张及以上图片并打开 `ResourceMergeDrawer`。
- [x] 为抽屉增加可选 `defaultDirection` 与资源创建完成回调，默认行为保持一级素材库现状。
- [x] 产品素材入口传入 `VERTICAL` 和封面回调；其余入口继续默认横向且不设封面。
- [x] 为新增抽屉 props 增加类型级测试。

### Task 3: 隔离通用素材分页

**Files:**
- Modify: `../dafenqi-ai/src/main/java/com/dafenqi/ai/service/asset/impl/AssetResourceServiceImpl.java`

- [x] 未传 `productId` 时追加 `asset_resource.product_id IS NULL`；传入时保持按指定产品查询。
- [x] 保留产品素材库通过 `ProductLibraryServiceImpl` 读取产品关联资源的路径。

### Task 4: 验证

**Files:**
- Test: `src/components/AssetTransitModal.test.tsx`
- Test: `src/components/common/ResourceMergeDrawer.test.tsx`

- [x] 运行 `npm test`。
- [x] 运行 `npm run lint`。
- [x] 后端 Maven 构建需要用户显式授权，未授权时仅检查变更的 Java 语法与导入。
