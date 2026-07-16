# Video Task Asset Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让新建视频任务与图片任务共用资源中心选素材的方式，并以统一图片角色清单代替独立模特选择和本地视频输入。

**Architecture:** `AssetTransitModal` 按槽位筛选图片或视频并回传完整 `AssetResourceItem`。`CreateVideoTaskV2` 将资源对象映射为一份带角色和连续顺序的图片清单；爆款复刻源视频保留为单独的可追溯资产。任务规格在中栏编辑，右栏只展示模型能力和校验结果。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS、既有 mockData、AssetTransitModal。

---

## 文件结构

| 文件 | 改动职责 |
| --- | --- |
| `src/components/AssetTransitModal.tsx` | 按视频槽位筛选 `IMAGE` 或 `VIDEO` 并显示正确文案。 |
| `src/App.tsx` | 将完整资源对象和多选配置传给视频页。 |
| `src/types.ts` | 定义视频图片输入、源视频与视频任务参数。 |
| `src/mockData.ts` | 增加可从资源中心选择的 mock 视频资产。 |
| `src/components/CreateVideoTaskV2.tsx` | 统一素材状态、角色卡片、爆款源视频选择、配置布局和提交校验。 |

项目未配置测试框架，且当前规范以 `npm run lint`、`npm run build` 与手工关键路径验收为主。本计划不新增依赖、测试目录或自动提交。

### Task 1: 资源中心按视频槽位筛选资产

**Files:**
- Modify: `src/components/AssetTransitModal.tsx:27-56,119-154`
- Modify: `src/App.tsx:116-123,314-342`

- [ ] **Step 1: 定义视频槽位的媒体类型和文案**

在 `AssetTransitModal.tsx` 槽位映射旁新增：

```ts
const SLOT_ASSET_KINDS: Record<string, AssetResourceItem['assetKind'] | undefined> = {
  'video-first-frame': 'IMAGE',
  'video-reference': 'IMAGE',
  'trending-source-video': 'VIDEO',
  'trending-replacement': 'IMAGE',
};
```

在 `SLOT_LABELS` 增加“视频首帧图”“视频参考图”“复刻源视频”“复刻替换素材”。

- [ ] **Step 2: 同时过滤 mock 与真实查询**

在 `refetch` 内计算 `const assetKind = SLOT_ASSET_KINDS[targetSlot]`。mock 过滤加入：

```ts
const matchesKind = !assetKind || asset.assetKind === assetKind;
return matchesKeyword && matchesCategory && matchesSlot && matchesKind;
```

真实请求改为：

```ts
const page = await assetApi.page({
  ...buildQuery(),
  keyword: searchQuery || undefined,
  assetKind,
});
```

- [ ] **Step 3: 保存多选状态并原样回传素材对象**

在 `App.tsx` 增加：

```ts
const [transitMultiSelect, setTransitMultiSelect] = useState(false);
```

视频页 `openTransit` 改为接收第三个参数并保存完整回调：

```ts
openTransit={(onConfirmSelection, targetSlot = 'main', multiSelect = false) => {
  setTransitSelectionHandler(() => onConfirmSelection);
  setTransitTargetSlot(targetSlot);
  setTransitMultiSelect(multiSelect);
  setIsTransitOpen(true);
}}
```

传给 `AssetTransitModal` 时增加 `multiSelect={transitMultiSelect}`。图片页两参数调用保持默认单选。

- [ ] **Step 4: 手工验证筛选**

打开 `video-first-frame`、`video-reference`、`trending-source-video` 和 `trending-replacement` 四个槽位。图片槽位不得显示视频，源视频槽位不得显示图片，多选槽位可以累计选择。

### Task 2: 定义视频输入类型并补齐 mock 视频资产

**Files:**
- Modify: `src/types.ts:62-93,122-130`
- Modify: `src/mockData.ts:279-338`

- [ ] **Step 1: 明确图片输入和源视频类型**

在 `src/types.ts` 使用以下结构。源视频不能再伪装成 `scene` 图片角色：

```ts
export interface VideoInputAsset {
  id: string;
  fileResourceId?: number;
  productAssetId?: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  source: string;
  role: VideoAssetRole;
  position: number;
}

export interface VideoSourceAsset {
  id: string;
  fileResourceId?: number;
  name: string;
  url: string;
  thumbnailUrl: string;
  source: string;
  durationSec?: number;
  licenseText: string;
}
```

- [ ] **Step 2: 保存视频提交的业务参数**

在 `GenerationTask.params` 中新增可选字段：

```ts
duration?: number;
resolution?: string;
motion?: '轻微' | '适中' | '强烈';
mode?: VideoTaskMode;
```

- [ ] **Step 3: 增加可选的爆款视频 mock**

在 `mockAssetResources` 追加一条 `assetKind: 'VIDEO'` 资产。必须有 `fileResourceId`、`originalUrl`、`thumbnailUrl`、`durationSec: 8`、`tags: '爆款复刻,视频参考,已授权'`、`status: 'NORMAL'` 和 `categoryIds: []`。使用图片 URL 作封面，不要求浏览器实际播放 Demo 视频。

- [ ] **Step 4: 运行类型检查**

运行 `npm run lint`。预期退出码为 `0`。

### Task 3: 以统一图片角色清单替换首帧、参考图和模特状态

**Files:**
- Modify: `src/components/CreateVideoTaskV2.tsx:1-226`

- [ ] **Step 1: 改用完整资源对象的页面 props**

删除 `mockAssetResources`、`mockModelProfiles`、`ChangeEvent` 的依赖，导入 `AssetResourceItem`。将 `openTransit` 改为：

```ts
openTransit: (
  onConfirmSelection: (assets: AssetResourceItem[]) => void,
  targetSlot?: string,
  multiSelect?: boolean,
) => void;
```

新增 `toVideoInputAsset`、`toVideoSourceAsset`、`inferRole`、`normalizePositions`。`inferRole` 依据 tags 推断 `model/style/scene/action/product`，没有匹配时返回 `style`；首帧只由选择动作分配。

```ts
const normalizePositions = (assets: VideoInputAsset[]) =>
  assets.map((asset, index) => ({ ...asset, position: index + 1 }));
```

- [ ] **Step 2: 统一输入状态并删除独立模特状态**

替换 `firstFrame`、`references` 和 `selectedProfileId`：

```ts
const [inputAssets, setInputAssets] = useState<VideoInputAsset[]>([]);
const firstFrame = inputAssets.find((asset) => asset.role === 'first_frame') ?? null;
const referenceAssets = inputAssets.filter((asset) => asset.role !== 'first_frame');
```

删除 `selectedProfile`、`selectModelFromTransit` 及 Prompt 中模特名称的单独拼接。模特只从 `inputAssets` 中的 `role === 'model'` 读取。

- [ ] **Step 3: 实现选择、角色、排序和失效函数**

`img2video` 只保留一张并强制 `first_frame`。`reference2video` 追加去重后的图片，第一张默认首帧，其他图片使用 `inferRole`。实现 `changeAssetRole`、`moveAsset`、`removeAsset` 和 `invalidateAnalysis`：角色改为 `first_frame` 时，把旧首帧改为 `product` 并显示“已替换首帧”提示；角色、顺序、增删素材均清空爆款 `analysis`，但不覆盖用户已编辑的 Prompt 和分镜。

- [ ] **Step 4: 写出可提交条件和具体缺失原因**

图生视频必须恰好一张图片；参考生视频必须有且只有一张首帧，并至少一张额外参考图；非爆款图片总数不能超过模型上限。`canSubmit` 必须同时要求规格支持、通道非维护和没有输入错误。提交按钮禁用时显示“请选择首帧图”“请至少添加一张参考图”“当前模型最多支持 3 张输入图”等具体原因。

### Task 4: 重构三种模式的素材界面、爆款入口与配置位置

**Files:**
- Modify: `src/components/CreateVideoTaskV2.tsx:228-520`

- [ ] **Step 1: 新增视频素材清单卡片**

在同文件新增局部 `VideoAssetList`，接收 `assets`、`maxAssets`、`allowRoleChange`、`onPick`、`onRoleChange`、`onMove`、`onRemove`。每个卡片显示缩略图、名称、资源中心来源、角色下拉、顺序、上移、下移和移除按钮。

`img2video` 传 `allowRoleChange={false}`，只有“从资源中心选择首帧图”卡片。`reference2video` 的添加按钮调用：

```ts
openTransit(addReferenceAssets, 'video-reference', true);
```

不渲染 `ModelSelection` 或“模特上下文”卡片。

- [ ] **Step 2: 爆款复刻只从资源中心选择源视频**

重写 `TrendingInputs`，删除 file input 和本地上传。空状态保留资源中心大号加号卡片，并在同一卡片提供视频链接导入；链接进入任务暂存状态，导入完成前不得分析。资源中心入口调用：

```ts
openTransit(selectTrendingSource, 'trending-source-video');
```

选择后展示封面、名称、时长、来源、授权标签与移除按钮。替换素材复用 `VideoAssetList`，调用：

```ts
openTransit(addTrendingAssets, 'trending-replacement', true);
```

- [ ] **Step 3: 保持爆款分析的最小门槛**

源视频只接收第一条视频资源并映射为 `VideoSourceAsset`。替换素材只接收图片、去重、最多 7 张。分析按钮仅在有源视频和至少一张 `product` 替换图时可用；禁用文案为“请选择复刻源视频和至少一张商品替换图”。

- [ ] **Step 4: 移除规格的重复编辑入口**

把比例、分辨率、运动幅度的 `SelectField` 从右栏移至中栏“任务配置”，与时长一起编辑。右栏保留通道、模型、当前规格支持状态、参考图上限、成本、健康度和额度。模型切换冲突弹窗沿用现有确认方式，确认前不修改业务规格。

- [ ] **Step 5: 用角色清单构建提交上下文**

新增：

```ts
const describeAssets = (assets: VideoInputAsset[]) => assets
  .slice()
  .sort((a, b) => a.position - b.position)
  .map((asset) => `${ROLE_LABELS[asset.role]}-${asset.name}`)
  .join('、');
```

图片模式使用 `inputAssets`，爆款模式使用 `trendingAssets`。提交时 `params` 保存 `ratio`、`duration`、`resolution`、`motion`、`mode`、`prompt` 和 `negativePrompt`。素材变更后只提示重新分析，不静默删除 Prompt。

### Task 5: 验证改造结果

**Files:**
- Verify: `src/App.tsx`
- Verify: `src/components/AssetTransitModal.tsx`
- Verify: `src/components/CreateVideoTaskV2.tsx`
- Verify: `src/mockData.ts`
- Verify: `src/types.ts`

- [ ] **Step 1: 静态和构建验证**

运行 `npm run lint`、`npm run build`、`git diff --check`。预期三个命令退出码均为 `0`。构建允许出现既有包体积提示，但不得有 TypeScript、模块解析或构建错误。

- [ ] **Step 2: 验收图生视频**

新建视频任务保持 `img2video`，从资源中心选择一张图片。确认只有首帧图、不出现模特选择或参考图清单；补全规格后可提交 mock 任务。

- [ ] **Step 3: 验收参考生视频**

切到 `reference2video`，从资源中心多选三张图。标记一张首帧，另两张模特和场景，使用上移/下移改变顺序。确认首帧唯一，缩略图、来源、角色和顺序可见；超出模型上限不能提交。

- [ ] **Step 4: 验收爆款复刻**

切到 `trending_replicate`。确认没有本地上传和 URL 输入；从资源中心选择视频源，再多选商品、模特、场景替换图。确认源视频显示封面、时长、来源、授权；没有商品替换图时不能分析，添加后可生成 mock 分析。

- [ ] **Step 5: 交给用户手工提交**

运行 `git status --short`，区分本次代码、规格文档和 `.superpowers/brainstorm/` 浏览器辅助文件。不要执行 `git add`、`git commit`、删除文件或修改 `.env`；由用户决定暂存范围并手工提交。
