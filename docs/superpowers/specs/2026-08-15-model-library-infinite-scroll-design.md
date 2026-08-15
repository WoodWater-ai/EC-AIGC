# ModelLibrary 模特资源库无限滚动设计

> 日期：2026-08-15
> 状态：方案已确认
> 范围：EC-AIGC 前端 SPA，分页仅限前端。后端 `/v1/admin/model-profile/page` 已是 `PageInfo<ModelProfileDTO>`，本轮不动后端。

## 1. 背景

`AppScreen.MODEL_LIBRARY` 主屏渲染 `<ModelLibrary>`，当前由 `App.tsx` 通过 `useServiceQuery` 一次性拿 `pageSize = 100` 后整页铺开。模特库总量增长后会出现：

1. 一次性拉 100 条浪费首屏带宽；继续上调 pageSize 又会让响应体变大。
2. 用户滚到底部后没有任何"加载更多"入口，必须切 tag 才能再看到新模特。
3. 标签筛选目前是**纯前端 in-memory filter**，依赖首次拉的 100 条覆盖全部 tag，否则用户会误以为库里"只有这些清透"。

`AssetTransitModal` 内"产品素材" tab 已经有成熟的无限滚动实现（见 `AssetTransitModal.tsx:177–508`）。本设计把同一套模式搬到主屏 ModelLibrary，统一两处行为、复用验证结论。

## 2. 已确认原则

1. **保留 props 下传**，ModelLibrary 仍是无状态展示组件。App.tsx 持有分页 state，对外暴露 `loadNextProfilePage()`。
2. **滚动挂主屏页面（`window.scroll`）**，不引入局部滚动容器，与现有 Modal 内的局部滚动共存于不同屏。
3. **滚动事件 + requestAnimationFrame 节流** + 距底 200px 触发；不引入 IntersectionObserver（理由见 `AssetTransitModal.tsx:477–479` 的现存结论）。
4. **Tag 切换 = 重置列表 + 重拉第 1 页**，每个 tag 走独立分页查询，不在前端做 in-memory filter。
5. **后端契约不变**：`POST /v1/admin/model-profile/page` 入参 `{ pageNum, pageSize, status, keyword?, styleTag?, sourceMode?, licenseStatus? }`，返回 `PageInfo<ModelProfileDTO>`。
6. **首屏 loading 语义不变**：仍然使用 ModelLibrary 现有的 `loading` 全屏占位，只在追加阶段才显示底部 loading。

## 3. 架构与职责划分

| 文件 | 变更 |
| --- | --- |
| `EC-AIGC/src/App.tsx` | 把 `modelProfilesQuery` 拆成「首屏 useServiceQuery + 手动追加 fetch」。新增 `profileList / loadingMore / hasMore / total / appendError / nextPageRef / loadingVersionRef / queryVersionRef`，暴露 `loadNextProfilePage()` 给 ModelLibrary |
| `EC-AIGC/src/components/ModelLibrary.tsx` | 保留 props 渲染职责；新增底部 loading / 末尾提示 / 错误重试区块；新增可选 props `loadingMore / hasMore / total / appendError / onLoadMore`；新增 `useEffect` 挂 `window` scroll 事件 |
| 后端 | **不动** |

### 3.1 App.tsx 状态机

```ts
// 内部状态
const [profileList, setProfileList] = useState<ModelProfileDTO[]>([]);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [profileTotal, setProfileTotal] = useState(0);
const [appendError, setAppendError] = useState<Error | null>(null);

const profileNextPageRef = useRef(2);          // 第一页已被 useServiceQuery 拿过,下一份从 pageNum=2 开始
const profileLoadingVersionRef = useRef<number | null>(null);
const profileQueryVersionRef = useRef(0);
const profileHasMoreRef = useRef(true);

// 首屏
const modelProfilesQuery = useServiceQuery(
  () => modelProfileApi.page({ pageNum: 1, pageSize: profilePageSize, status: 'active' }),
  [profilePageSize],
  isAuthenticated,
);

// 首屏数据落进本地 list
useEffect(() => {
  const data = modelProfilesQuery.data;
  if (!data) return;
  setProfileList(data.list);
  setProfileTotal(data.total);
  setHasMore(1 < data.pages);
  profileHasMoreRef.current = 1 < data.pages;
  profileNextPageRef.current = 2;
}, [modelProfilesQuery.data]);

// 追加
const loadNextProfilePage = useCallback(async () => {
  if (profileLoadingVersionRef.current !== null || !profileHasMoreRef.current) return;
  const version = profileQueryVersionRef.current;
  profileLoadingVersionRef.current = version;
  setLoadingMore(true);
  setAppendError(null);
  const pageNum = profileNextPageRef.current;
  try {
    const page = await modelProfileApi.page({
      pageNum,
      pageSize: profilePageSize,
      status: 'active',
    });
    if (version !== profileQueryVersionRef.current) return;
    setProfileList((current) => [
      ...current,
      ...page.list.filter((next) => !current.some((existing) => existing.id === next.id)),
    ]);
    const nextHasMore = pageNum < page.pages;
    profileHasMoreRef.current = nextHasMore;
    profileNextPageRef.current = pageNum + 1;
    setHasMore(nextHasMore);
    setProfileTotal(page.total);
  } catch (error) {
    if (version !== profileQueryVersionRef.current) return;
    setAppendError(error as Error);
  } finally {
    if (version === profileQueryVersionRef.current) {
      profileLoadingVersionRef.current = null;
      setLoadingMore(false);
    }
  }
}, [profilePageSize]);
```

**`profilePageSize = 50`**：5 列 × 10 行，滚一次 fetch 一次不至于太频繁，与 `AssetTransitModal.tsx:184` 的 `productPageSize = 50` 一致。

**pageNum 演进**：`profileNextPageRef` 初始化为 `2`（首屏已被 `useServiceQuery` 拿过），每次追加成功后 `+1`，重置时回到 `2`。`loadingVersionRef` 与 `queryVersionRef` 与 `AssetTransitModal` 同构，避免闭包内 stale state 与 in-flight 竞争。

### 3.2 App.tsx → ModelLibrary props 改造

```tsx
case AppScreen.MODEL_LIBRARY:
  return (
    <ModelLibrary
      profiles={profileList}
      loading={modelProfilesQuery.loading}
      error={modelProfilesQuery.error?.message}
      loadingMore={loadingMore}
      hasMore={hasMore}
      total={profileTotal}
      appendError={appendError}
      onLoadMore={loadNextProfilePage}
      onCreateProfile={() => setModelCreatorOpen(true)}
    />
  );
```

### 3.3 ModelLibrary 接口扩展

```ts
interface ModelLibraryProps {
  profiles: ModelProfileDTO[];
  onCreateProfile: () => void;
  loading?: boolean;
  error?: string;
  // 本轮新增
  loadingMore?: boolean;
  hasMore?: boolean;
  total?: number;
  appendError?: Error | null;
  onLoadMore?: () => void;
}
```

## 4. 滚动事件

主屏页面滚动（`window`）：

```ts
useEffect(() => {
  let ticking = false;
  const handleScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const doc = document.documentElement;
      if (doc.scrollHeight - doc.scrollTop - doc.clientHeight >= 200) return;
      onLoadMore?.();
    });
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, [onLoadMore]);
```

要点：

- **`passive: true`**：不阻塞滚动。
- **rAF 节流**：每帧最多 1 次回调。
- **距底 200px**：与 `AssetTransitModal.tsx:494` 的 200px 阈值完全一致。
- **不读 ref 闭包**：`onLoadMore` 由 App.tsx 通过 props 传入，内部用 `nextPageRef / loadingVersionRef / hasMoreRef` 保证请求幂等。
- **mount 不触发**：scrollHeight 还没增长，200px 判定为 false 自然短路。

**与弹窗方案的关键差异**：弹窗的 scroll 事件挂在 `scrollContainerRef.current`（弹窗内部 overflow 容器），ModelLibrary 直接挂 `window`，因为它没有内部滚动容器。读取的是 `document.documentElement.scrollHeight` 而非容器高度。Header / 筛选条等 sticky 元素不会污染这个计算——它们只影响 `clientHeight`（视口高度），不参与 `scrollHeight`。

## 5. UI 状态

| 状态 | 渲染位置 | 内容 |
| --- | --- | --- |
| 首屏加载中 | 整片卡片区 | 现有「正在加载模特资源…」占位（不动） |
| 首屏错误 | 整片卡片区 | 现有 `error` 文案（不动） |
| 追加加载中 | 卡片区**下方**一行 | 旋转图标 + 「正在加载更多…」 |
| 追加失败 | 卡片区**下方**一行 | 「加载失败,点击重试」按钮（点击触发 `onLoadMore`，不暴露内部重置细节） |
| 末页 | 卡片区**下方**一行 | 「已加载全部 N 个模特」（`N = total`） |
| 列表为空（任一 tag） | 整片卡片区 | 「当前筛选下暂无可用模特」（不动） |

**空列表的判定**：`profiles.length === 0` 且 `!loading` 且 `!error`，现有逻辑已覆盖。

**Tag 切换**：直接重新调用 `modelProfileApi.page({ pageNum: 1, pageSize, status: 'active', styleTag })` 重置 `profileList / total / hasMore / nextPage / queryVersionRef`。现有 ModelLibrary 的 `filter` state 改为"控制是否在追加 `styleTag` 参数"——可放在 App.tsx,也可保留在 ModelLibrary。本轮**保留 ModelLibrary 的 `filter` state**，但在 props 上把它提到 App.tsx：`selectedStyleTag?: string`，让 App.tsx 的 `useEffect([selectedStyleTag])` 重置列表并重新拉第一页。

> 决策：把 `filter` state 移到 App.tsx 是更彻底的方案，但会改动 ModelLibrary 的内部状态布局。**本轮采用最小改动**：filter 继续在 ModelLibrary 内部，但通过 `onFilterChange` 回调告诉 App.tsx；App.tsx 监听 filter 变化重置分页状态并重新拉第一页。ModelLibrary 仍按现有写法在内部 `filter === '全部' || profile.tags.includes(filter)`。这两条同时生效：前端 filter 与后端 `styleTag` 参数一致时体验最佳；不一致时（极少数 tag 拼写不匹配）以后端为准。

## 6. 数据流

```
                            ┌────────────────────────────┐
                            │ App.tsx                    │
   window scroll ──scroll──▶│ onLoadMore                 │
                            │   ↓ loadNextProfilePage    │
                            │     modelProfileApi.page   │
                            │   ↓ setProfileList         │
                            └─────────┬──────────────────┘
                                      │ props
                                      ▼
                            ┌────────────────────────────┐
                            │ ModelLibrary               │
                            │   <grid>{profileList}      │
                            │   <footer state=...>       │
                            └────────────────────────────┘
```

**筛选**：

```
filter chip click ──onFilterChange──▶ App.tsx setSelectedStyleTag
                                          ↓
                                   useEffect([selectedStyleTag])
                                          ↓
                              reset state + load page 1 with styleTag
                                          ↓
                              props 推回 ModelLibrary
```

**导入/发布后刷新**：保留现有 `onModelImported` / `onPublished` → `modelProfilesQuery.refetch`，但本轮改成只重置分页状态 + 重拉第一页：

```tsx
const handleModelImported = () => {
  profileQueryVersionRef.current += 1;
  profileLoadingVersionRef.current = null;
  profileNextPageRef.current = 2;
  profileHasMoreRef.current = true;
  setProfileList([]);
  setAppendError(null);
  setLoadingMore(false);
  setHasMore(true);
  setProfileTotal(0);
  modelProfilesQuery.refetch();  // 首屏 useServiceQuery 重新跑,完成后 useEffect 会同步给 profileList
};
```

## 7. 错误处理

| 错误源 | 处理 |
| --- | --- |
| 首屏 `modelProfileApi.page` 抛错 | 现有 `error` 文案占位（不变） |
| 追加 `loadNextProfilePage` 抛错 | 底部「加载失败，点击重试」；点击重试不清空列表，只再发一次请求 |
| 用户在追加请求未完成时切 tag | `queryVersionRef++`，旧请求回调进入时直接 return，不污染新列表 |
| 用户在追加请求未完成时离开 MODEL_LIBRARY 屏 | App.tsx 卸载 / 切屏时无显式清理，但请求用 `cancelled`/`version` 标记保护；自然 cleanup |

## 8. 测试

### 8.1 单元（Vitest + React Testing Library，CLAUDE.md TODO 已列）

`EC-AIGC/src/components/ModelLibrary.test.tsx`（新文件）：

1. **滚动不触发**：`window.scroll` 后距底 > 200px，不调 `onLoadMore`
2. **滚动触发**：距底 < 200px 且 `hasMore = true`，调一次
3. **rAF 节流**：同一帧内多次 `scroll` 事件只调一次
4. **cleanup**：组件卸载时移除 scroll listener（`removeEventListener` 被调用）
5. **loadingMore** 渲染「正在加载更多…」
6. **appendError + onLoadMore 链路**：点击「重试」按钮调用 `onLoadMore`
7. **hasMore=false** 渲染「已加载全部 N 个模特」（`N = total`）
8. **filter 切换触发 onFilterChange**：点击「甜美」chip 调一次 `onFilterChange('甜美')`

### 8.2 手工验收

- 网络限速 → 滚到底部看到「正在加载更多…」
- 强制 500 → 看到「加载失败，点击重试」，点击重试成功
- 切「甜美」→ 列表清空、重新加载、只显示甜美
- 滚到末页 → 「已加载全部 N 个模特」
- 切回「全部」→ 重新拉第一页，列表含全部 tag
- 在追加中点「新建 AI 模特」→ 弹窗关闭后 modelProfilesQuery 重跑，list 同步刷新

## 9. 风险与不做的事

### 风险

1. **页面级 sticky 与 scrollHeight 同步**：浏览器在 sticky 元素位置变更时仍以 `documentElement.scrollHeight` 为准，不会出现读不到正确高度的情况。
2. **页面同时存在其他弹窗（AssetTransitModal）**：弹窗自身 scroll 容器独立，监听 `window.scroll` 的 ModelLibrary 不会与它冲突。
3. **首次拉取的 100 条 → 改为 50 条**：首屏响应体变小，但首屏卡片数变少；如果用户期望首屏就能看到 50 个模特，需要观察体验。决定保留 50，与产品 tab 一致。

### 不做

- ❌ 不引入 IntersectionObserver（理由见 §2）
- ❌ 不引入虚拟滚动（数据量未到，YAGNI）
- ❌ 不改后端分页契约
- ❌ 不动 ModelLibrary 内 `filter` 内部的 in-memory filter 逻辑（保留向后兼容；后端 `styleTag` 与前端 filter 双轨运行）
- ❌ 不做"无结果时加载下一页"的探测：空结果直接展示「当前筛选下暂无可用模特」

## 10. 文件清单

| 文件 | 动作 |
| --- | --- |
| `EC-AIGC/src/App.tsx` | 修改 |
| `EC-AIGC/src/components/ModelLibrary.tsx` | 修改 |
| `EC-AIGC/src/components/ModelLibrary.test.tsx` | 新增 |