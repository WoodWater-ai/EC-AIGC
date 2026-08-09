# 产品管理 SPU / SKU 前端改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改后端接口的前提下，将产品管理改造成以素材创作为中心的 SPU / SKU 树形列表、详情抽屉和手动新建布局。

**Architecture:** 新增纯函数视图模型适配层，把当前扁平 `ProductDTO` 安全映射为“手动创建 SPU + 单 SKU”，同时预留未来 ERP 层级数据入口。列表只负责查询、筛选和展开；详情抽屉负责 SKU 单选与创作跳转；表单继续调用现有接口，仅保存当前接口支持的单 SKU 字段。

**Tech Stack:** React 19、TypeScript 5.8、Tailwind CSS 4、Node test runner、Vite 6

---

## 文件结构

- Create: `src/components/productManagement/productManagementModel.ts` — SPU/SKU 前端视图模型与扁平数据兼容适配。
- Create: `src/components/productManagement/productManagementModel.test.ts` — 适配、来源和创作可用性纯函数测试。
- Create: `src/components/productManagement/ProductDetailDrawer.tsx` — 720px 产品详情抽屉、SKU 单选和唯一创作入口。
- Modify: `src/components/ProductManagePage.tsx` — 树形表格、来源筛选、详情状态和快捷创作。
- Modify: `src/components/ProductFormDrawer.tsx` — 720px SPU/SKU 分区表单，移除组合入口，保持现有单商品 API。
- Modify: `src/App.tsx` — 向产品管理传入现有 `setScreen`，支持跳转图片创作。

### Task 1: 建立兼容视图模型

**Files:**
- Create: `src/components/productManagement/productManagementModel.ts`
- Create: `src/components/productManagement/productManagementModel.test.ts`

- [ ] **Step 1: 写失败测试，锁定扁平产品到单 SKU 的映射**

```ts
test('maps current ProductDTO to a manual SPU with one SKU', () => {
  const spu = toProductSpu({
    id: '100', name: '连衣裙', color: '酒红', patternMaterial: '醋酸',
    silhouetteStructure: '收腰', imageId: '900', imageUrl: '/dress.jpg',
    status: 'ON_SHELF', statusDesc: '上架', categories: [{ id: '8', categoryName: '连衣裙' }],
  });
  assert.equal(spu.source, 'MANUAL');
  assert.equal(spu.skus.length, 1);
  assert.equal(spu.skus[0].productId, '100');
  assert.equal(spu.skus[0].canCreate, true);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx tsx --test src/components/productManagement/productManagementModel.test.ts`

Expected: FAIL，模块或导出不存在。

- [ ] **Step 3: 实现视图模型与映射函数**

```ts
export type ProductSource = 'MANUAL' | 'ERP';

export interface ProductSkuView {
  id: string;
  productId: string;
  name: string;
  code: string;
  imageUrl?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  status: ProductStatus;
  materialCount: number;
  canCreate: boolean;
  unavailableReason?: string;
}

export interface ProductSpuView {
  id: string;
  source: ProductSource;
  name: string;
  code: string;
  imageUrl?: string;
  categories: ProductCategoryRef[];
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  status: ProductStatus;
  statusDesc: string;
  createTime?: string;
  skus: ProductSkuView[];
  raw: ProductDTO;
}

export function toProductSpu(product: ProductDTO): ProductSpuView {
  const hasImage = Boolean(product.imageId && product.imageUrl);
  return {
    id: product.id,
    source: 'MANUAL',
    name: product.name,
    code: `SPU-${product.id}`,
    imageUrl: product.imageUrl,
    categories: product.categories ?? [],
    color: product.color,
    patternMaterial: product.patternMaterial,
    silhouetteStructure: product.silhouetteStructure,
    status: product.status,
    statusDesc: product.statusDesc,
    createTime: product.createTime,
    raw: product,
    skus: [{
      id: product.id,
      productId: product.id,
      name: product.color || product.name,
      code: `SKU-${product.id}`,
      imageUrl: product.imageUrl,
      color: product.color,
      patternMaterial: product.patternMaterial,
      silhouetteStructure: product.silhouetteStructure,
      status: product.status,
      materialCount: hasImage ? 1 : 0,
      canCreate: product.status === 'ON_SHELF' && hasImage,
      unavailableReason: hasImage ? undefined : '暂无可用素材',
    }],
  };
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `npx tsx --test src/components/productManagement/productManagementModel.test.ts`

Expected: PASS。

### Task 2: 新增产品详情抽屉

**Files:**
- Create: `src/components/productManagement/ProductDetailDrawer.tsx`

- [ ] **Step 1: 定义详情抽屉契约**

```ts
interface ProductDetailDrawerProps {
  product: ProductSpuView | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (product: ProductDTO) => void;
  onCreate: (sku: ProductSkuView) => void;
}
```

- [ ] **Step 2: 实现 720px 抽屉和 SKU 单选**

实现内容：

- 头部展示 SPU 封面、名称、编码、来源、状态和 SKU 数量。
- 单 SKU 自动选中；多 SKU 初始不选。
- SKU 行展示图片、名称、编码、参数、素材数和可用状态。
- 右上角只保留一个“进入创作”按钮；未选或不可用时禁用。
- 手动商品显示编辑按钮；ERP 来源只读。
- 当前 SKU 下方展示素材预览、商品事实和默认收起的来源信息。

- [ ] **Step 3: 运行类型检查**

Run: `npm run lint`

Expected: TypeScript 0 errors。

### Task 3: 将产品列表改为 SPU / SKU 树形表格

**Files:**
- Modify: `src/components/ProductManagePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 给产品管理增加导航契约**

```ts
interface ProductManagePageProps {
  setScreen: (screen: AppScreen) => void;
}
```

并在 `App.tsx` 中使用：

```tsx
<ProductManagePage setScreen={setScreen} />
```

- [ ] **Step 2: 增加来源和展开状态**

```ts
const [sourceFilter, setSourceFilter] = useState<ProductSource | ''>('');
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
const [detailProduct, setDetailProduct] = useState<ProductSpuView | null>(null);
const products = useMemo(() => (pageInfo?.list ?? []).map(toProductSpu), [pageInfo]);
```

- [ ] **Step 3: 替换为树形表格**

父行展示展开按钮、SPU 封面、名称/编码、分类、参数摘要、来源、状态/SKU 数和操作。展开后渲染缩进 SKU 行；单 SKU 父行和有效 SKU 子行提供“去创作”，多 SKU 父行进入详情选择。

- [ ] **Step 4: 保留现有 CRUD 和分页行为**

编辑、删除继续使用原 `ProductDTO`；分页总数仍取后端 SPU 页面的 `pageInfo.total`；来源筛选只过滤当前已加载结果，ERP 接口接入后再进入 API 查询参数。

- [ ] **Step 5: 运行类型检查**

Run: `npm run lint`

Expected: TypeScript 0 errors。

### Task 4: 重构手动新建 / 编辑抽屉

**Files:**
- Modify: `src/components/ProductFormDrawer.tsx`

- [ ] **Step 1: 移除产品管理中的组合入口**

删除 `OutfitComposePanel`、`AppliedCompositeAsset` 导入、`handleCompositeApplied` 和抽屉内的组合区块。组合能力只留在后续资源中心方案。

- [ ] **Step 2: 将抽屉扩宽并分为 SPU / SKU 两区**

```tsx
<div className="relative flex h-full w-full max-w-[720px] flex-col bg-white shadow-2xl">
  <header>{/* 新建产品 + 手动创建 */}</header>
  <main>
    <section>{/* SPU：名称、分类、状态、卖点 */}</section>
    <section>{/* SKU：图片、颜色、材质、版型 */}</section>
  </main>
  <footer>{/* 校验摘要 + 取消 / 保存 */}</footer>
</div>
```

- [ ] **Step 3: 保持真实保存边界**

现有接口只支持一个商品图片和一组创作参数，因此本期只保存一个 SKU。界面展示“添加 SKU”图标按钮但保持禁用并提供 tooltip `多 SKU 保存将在接口接入后开放`，禁止静默丢弃用户填写内容。

- [ ] **Step 4: 收紧图片理解写入范围**

`applyAiResult` 只写入 `color`、`patternMaterial`、`silhouetteStructure`，不得覆盖 SPU 名称和商品分类。

- [ ] **Step 5: 运行类型检查和测试**

Run: `npm run lint && npm test`

Expected: 类型检查通过；除仓库既有环境变量用例外，产品管理新增测试通过。

### Task 5: 页面验证

**Files:**
- No production file changes.

- [ ] **Step 1: 构建验证**

Run: `npm run build`

Expected: Vite build 成功。

- [ ] **Step 2: 启动独立开发服务**

Run: `npm run dev -- --port 3003`

Expected: 页面可通过 `http://127.0.0.1:3003/` 打开。

- [ ] **Step 3: 浏览器检查**

检查桌面与窄屏：表头不重叠、SPU 展开不改变列宽、SKU 缩进清晰、详情与表单抽屉不越界、所有按钮文本完整显示。

- [ ] **Step 4: 汇总结果，不自动提交**

列出改动文件、验证命令和后端限制。遵守项目 `AGENTS.md`，不执行自动 commit。
