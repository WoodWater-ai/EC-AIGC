# ModelLibrary 模特资源库无限滚动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 EC-AIGC 主屏 `<ModelLibrary>` 添加无限滚动分页,完全复用 `AssetTransitModal` 产品 tab 已验证的 scroll-event 模式。

**Architecture:** App.tsx 持有分页 state(`profileList / loadingMore / hasMore / total / appendError` + 三个 ref);ModelLibrary 保持 props-only 展示组件,新增底部 loading / 末页 / 错误三态 + `window.scroll` 监听。滚动阈值判断抽成纯函数 `shouldTriggerLoadMore(scrollTop, scrollHeight, clientHeight, threshold)`,便于在 `node:test` 下覆盖。后端 `/v1/admin/model-profile/page` 已是 `PageInfo<ModelProfileDTO>`,本计划不动后端。

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6。测试:`tsx --test`(node:test,见 `package.json:scripts.test`)。**不引入 Vitest / RTL**(CLAUDE.md TODO 中已列但本计划不新增 dev 依赖);运行时交互验收留给后续 Playwright E2E(与现有 `AssetTransitModal.test.tsx` 注释一致)。

---

## Global Constraints

- 前端端口:dev server 跑在 3001(`package.json:scripts.dev`)
- 后端 dev proxy:`/api/**` → `http://localhost:8090`(无需本计划关注)
- 包管理:`npm install`(项目根 `EC-AIGC/`)
- 测试命令:`npm test`(实际命令 `tsx --test "src/**/*.test.ts"`)
- 类型检查:`npm run lint`(实际命令 `tsc --noEmit`)
- Tailwind 4 主题:`src/index.css` 的 `@theme {}` 块(不创建 `tailwind.config.js`)
- 严禁执行 `git` / `mvn`,提交由用户 IDE 完成(根 CLAUDE.md §重要约定 1)
- 错误码:新增异常优先走 `ServiceExceptionFactory`,本计划不涉及后端错误码
- 颜色:全局主色 `#D85C42`(terracotta,见 memory `ec-aigc-primary-color-is-terracotta`)
- 现有惯例:`tsx --test` 文件命名 `*.test.ts` / `*.test.tsx`,断言来自 `node:assert/strict`(参考 `AssetTransitModal.test.tsx:1–2`)

---

## File Structure

| 文件 | 状态 | 职责 |
| --- | --- | --- |
| `EC-AIGC/src/lib/loadMore/shouldTriggerLoadMore.ts` | 新增 | 纯函数,根据 scroll 几何信息返回是否触发下一页 |
| `EC-AIGC/src/lib/loadMore/shouldTriggerLoadMore.test.ts` | 新增 | node:test 单测,覆盖边界(刚好等于、远大于、远小于) |
| `EC-AIGC/src/lib/loadMore/createWindowScrollLoader.ts` | 新增 | 工厂函数,封装 `window` scroll + rAF 节流 + 触发回调 |
| `EC-AIGC/src/lib/loadMore/createWindowScrollLoader.test.ts` | 新增 | node:test 单测,验证 rAF 节流、cleanup、threshold 边界 |
| `EC-AIGC/src/components/ModelLibrary.tsx` | 修改 | 扩展 props + 底部 loading/末页/错误三态 + 滚动 effect |
| `EC-AIGC/src/components/ModelLibrary.test.tsx` | 新增 | node:test 类型/纯组件 props 校验 |
| `EC-AIGC/src/App.tsx` | 修改 | 拆分首屏 useServiceQuery + 追加 fetch;filter 联动;新 props 下传 |

**职责边界**:`lib/loadMore/*` 与组件解耦,可被未来其他滚动列表复用。

---

## Task 1: 抽出纯函数 `shouldTriggerLoadMore`

**Files:**
- Create: `EC-AIGC/src/lib/loadMore/shouldTriggerLoadMore.ts`
- Create: `EC-AIGC/src/lib/loadMore/shouldTriggerLoadMore.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `shouldTriggerLoadMore(scrollTop: number, scrollHeight: number, clientHeight: number, threshold: number): boolean` — 当 `scrollHeight - scrollTop - clientHeight < threshold` 时返回 `true`

### Steps

- [ ] **Step 1.1: 写失败的测试 `EC-AIGC/src/lib/loadMore/shouldTriggerLoadMore.test.ts`**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldTriggerLoadMore } from './shouldTriggerLoadMore';

test('距离底部小于阈值时返回 true', () => {
  // scrollHeight=2000, scrollTop=1800, clientHeight=200 → 距底 0px
  assert.equal(shouldTriggerLoadMore(1800, 2000, 200, 200), true);
});

test('距离底部等于阈值时返回 false(严格小于)', () => {
  // scrollHeight=2000, scrollTop=1700, clientHeight=200 → 距底 100px, 阈值 100
  assert.equal(shouldTriggerLoadMore(1700, 2000, 200, 100), false);
});

test('距离底部大于阈值时返回 false', () => {
  assert.equal(shouldTriggerLoadMore(0, 2000, 800, 200), false);
});

test('任意参数为负数时返回 false(滚动尚未发生)', () => {
  assert.equal(shouldTriggerLoadMore(-1, 2000, 800, 200), false);
});
```

- [ ] **Step 1.2: 运行测试确认失败**

Run: `cd EC-AIGC && npm test -- src/lib/loadMore/shouldTriggerLoadMore.test.ts`
Expected: FAIL — `shouldTriggerLoadMore` not exported from `./shouldTriggerLoadMore`

- [ ] **Step 1.3: 实现 `EC-AIGC/src/lib/loadMore/shouldTriggerLoadMore.ts`**

```ts
/**
 * 判断是否应触发下一页加载。
 *
 * 触发条件:`scrollHeight - scrollTop - clientHeight` < threshold
 * - 严格小于:距底刚好等于阈值不算,留出视觉缓冲
 * - 任一参数为负:页面尚未滚动或容器未挂载,返回 false
 */
export function shouldTriggerLoadMore(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number,
): boolean {
  if (scrollTop < 0 || scrollHeight < 0 || clientHeight < 0 || threshold < 0) {
    return false;
  }
  return scrollHeight - scrollTop - clientHeight < threshold;
}
```

- [ ] **Step 1.4: 运行测试确认通过**

Run: `cd EC-AIGC && npm test -- src/lib/loadMore/shouldTriggerLoadMore.test.ts`
Expected: PASS,4 passed

- [ ] **Step 1.5: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: exit 0

- [ ] **Step 1.6: 提交(由用户在 IDE 完成 — 本计划不执行 git)**

> 本计划所有"提交"步骤仅作 plan 流程标注,实际由用户 IDE 完成。

---

## Task 2: 抽工厂 `createWindowScrollLoader`

**Files:**
- Create: `EC-AIGC/src/lib/loadMore/createWindowScrollLoader.ts`
- Create: `EC-AIGC/src/lib/loadMore/createWindowScrollLoader.test.ts`

**Interfaces:**
- Consumes: `shouldTriggerLoadMore`(Task 1)
- Produces: `createWindowScrollLoader(opts: { threshold: number; onTrigger: () => void; getMetrics: () => { scrollTop: number; scrollHeight: number; clientHeight: number } }): { start(): void; stop(): void }`

### Steps

- [ ] **Step 2.1: 写失败的测试 `EC-AIGC/src/lib/loadMore/createWindowScrollLoader.test.ts`**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWindowScrollLoader } from './createWindowScrollLoader';

test('距底 < 阈值时调用 onTrigger', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 1800, scrollHeight: 2000, clientHeight: 200 }),
  });
  loader.start();
  // 触发一次内部 scroll
  window.dispatchEvent(new Event('scroll'));
  // rAF 异步,需等下一帧
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 1);
      loader.stop();
      resolve();
    }, 50);
  });
});

test('rAF 节流:同一帧多次 scroll 只触发一次', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 1800, scrollHeight: 2000, clientHeight: 200 }),
  });
  loader.start();
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('scroll'));
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 1, 'rAF 内多次 scroll 应合并');
      loader.stop();
      resolve();
    }, 50);
  });
});

test('stop 后 scroll 不再触发', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 1800, scrollHeight: 2000, clientHeight: 200 }),
  });
  loader.start();
  loader.stop();
  window.dispatchEvent(new Event('scroll'));
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 0);
      resolve();
    }, 50);
  });
});

test('距底 >= 阈值时不触发', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 0, scrollHeight: 2000, clientHeight: 800 }),
  });
  loader.start();
  window.dispatchEvent(new Event('scroll'));
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 0);
      loader.stop();
      resolve();
    }, 50);
  });
});
```

- [ ] **Step 2.2: 运行测试确认失败**

Run: `cd EC-AIGC && npm test -- src/lib/loadMore/createWindowScrollLoader.test.ts`
Expected: FAIL — `./createWindowScrollLoader` 模块未找到

- [ ] **Step 2.3: 实现 `EC-AIGC/src/lib/loadMore/createWindowScrollLoader.ts`**

```ts
import { shouldTriggerLoadMore } from './shouldTriggerLoadMore';

interface CreateWindowScrollLoaderOptions {
  /** 距底阈值(px),默认 200,与 AssetTransitModal 产品 tab 一致 */
  threshold?: number;
  /** 触发时调用(由调用方保证幂等,如检查 loadingVersionRef) */
  onTrigger: () => void;
  /** 实时读取 scroll 几何信息(避免闭包 stale) */
  getMetrics: () => { scrollTop: number; scrollHeight: number; clientHeight: number };
}

/**
 * 创建 window scroll + rAF 节流的滚动加载器。
 *
 * 设计要点:
 * - passive: true,不阻塞滚动
 * - requestAnimationFrame 节流,每帧最多一次触发
 * - start()/stop() 显式控制生命周期,适配 React useEffect
 * - 通过 getMetrics 闭包读最新几何,避免重渲染不同步
 */
export function createWindowScrollLoader(opts: CreateWindowScrollLoaderOptions) {
  const { onTrigger, getMetrics } = opts;
  const threshold = opts.threshold ?? 200;
  let ticking = false;
  let active = false;

  const handleScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const { scrollTop, scrollHeight, clientHeight } = getMetrics();
      if (!shouldTriggerLoadMore(scrollTop, scrollHeight, clientHeight, threshold)) return;
      onTrigger();
    });
  };

  return {
    start() {
      if (active) return;
      active = true;
      window.addEventListener('scroll', handleScroll, { passive: true });
    },
    stop() {
      if (!active) return;
      active = false;
      window.removeEventListener('scroll', handleScroll);
    },
  };
}
```

- [ ] **Step 2.4: 运行测试确认通过**

Run: `cd EC-AIGC && npm test -- src/lib/loadMore/createWindowScrollLoader.test.ts`
Expected: PASS,4 passed

- [ ] **Step 2.5: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: exit 0

---

## Task 3: 扩展 `ModelLibrary` props + 三态渲染 + 滚动 effect

**Files:**
- Modify: `EC-AIGC/src/components/ModelLibrary.tsx`(整文件重写)
- Create: `EC-AIGC/src/components/ModelLibrary.test.tsx`

**Interfaces:**
- Consumes: `createWindowScrollLoader`(Task 2)
- Produces: 扩展的 `ModelLibraryProps`:
  ```ts
  interface ModelLibraryProps {
    profiles: ModelProfileDTO[];
    onCreateProfile: () => void;
    loading?: boolean;
    error?: string;
    // 本计划新增
    loadingMore?: boolean;
    hasMore?: boolean;
    total?: number;
    appendError?: Error | null;
    onLoadMore?: () => void;
    onFilterChange?: (filter: (typeof FILTERS)[number]) => void;
  }
  ```

### Steps

- [ ] **Step 3.1: 写类型层测试 `EC-AIGC/src/components/ModelLibrary.test.tsx`**

```tsx
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { ModelLibrary } from './ModelLibrary';
import type { ModelProfileDTO } from '../api/modules/modelProfile';

const sampleProfile: ModelProfileDTO = {
  id: 'p1',
  assetResourceId: 'a1',
  name: '样例模特',
  image: 'https://example.com/a.png',
  source: 'text',
  sourceMode: 'text',
  modelType: 'human',
  licenseStatus: 'cleared',
  tags: ['甜美'],
  categories: [],
  suitableFor: ['product_main'],
  status: 'active',
  usageCount: 0,
  averageAestheticScore: 0,
  passRate: 0,
};

test('ModelLibrary 接受新的无限滚动 props(类型层校验)', () => {
  const el = (
    <ModelLibrary
      profiles={[sampleProfile]}
      onCreateProfile={() => {}}
      loadingMore={false}
      hasMore={true}
      total={1}
      onLoadMore={() => {}}
      onFilterChange={() => {}}
    />
  );
  assert.ok(el);
});

test('ModelLibrary 不传新 props 时 TS 不报错(向后兼容)', () => {
  const el = <ModelLibrary profiles={[sampleProfile]} onCreateProfile={() => {}} />;
  assert.ok(el);
});
```

- [ ] **Step 3.2: 运行测试确认失败**

Run: `cd EC-AIGC && npm test -- src/components/ModelLibrary.test.tsx`
Expected: FAIL — `loadingMore` / `hasMore` / `onLoadMore` / `onFilterChange` props 不存在

- [ ] **Step 3.3: 重写 `EC-AIGC/src/components/ModelLibrary.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { ModelProfileDTO } from '../api/modules/modelProfile';
import type { ImageGenerationType } from '../types';
import { withCosThumbnail } from '../utils/cosImage';
import { ImagePreviewModal } from './ImagePreviewModal';
import { useAuth } from '../auth/AuthContext';
import { createWindowScrollLoader } from '../lib/loadMore/createWindowScrollLoader';

const FILTERS = ['全部', '清透', '甜美', '成熟', '居家'] as const;
type FilterValue = (typeof FILTERS)[number];
const TASK_LABELS: Record<ImageGenerationType, string> = {
  product_main: '商品主图',
  scene_detail: '场景细节',
  detail_closeup: '细节特写',
  model_triple_view: '模特三视图',
};

interface ModelLibraryProps {
  profiles: ModelProfileDTO[];
  onCreateProfile: () => void;
  loading?: boolean;
  error?: string;
  /** 是否正在追加加载下一页 */
  loadingMore?: boolean;
  /** 后端是否还有下一页 */
  hasMore?: boolean;
  /** 后端返回的总条数(用于末页提示) */
  total?: number;
  /** 追加加载失败的错误 */
  appendError?: Error | null;
  /** 触发加载下一页 */
  onLoadMore?: () => void;
  /** tag 切换时通知上层(用于上层联动后端 styleTag) */
  onFilterChange?: (filter: FilterValue) => void;
}

export function ModelLibrary({
  profiles: allProfiles,
  onCreateProfile,
  loading,
  error,
  loadingMore,
  hasMore,
  total,
  appendError,
  onLoadMore,
  onFilterChange,
}: ModelLibraryProps) {
  const { hasPermission } = useAuth();
  const canCreateProfile = hasPermission('model-profile:create');
  const [filter, setFilter] = useState<FilterValue>('全部');
  const [previewProfile, setPreviewProfile] = useState<ModelProfileDTO>();
  const profiles = useMemo(
    () => allProfiles.filter(
      (profile) => profile.status === 'active'
        && (filter === '全部' || profile.tags.includes(filter)),
    ),
    [allProfiles, filter],
  );

  // 主屏页面滚动(window):距底 200px 触发加载下一页
  useEffect(() => {
    if (!onLoadMore) return;
    const loader = createWindowScrollLoader({
      threshold: 200,
      onTrigger: onLoadMore,
      getMetrics: () => ({
        scrollTop: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: window.innerHeight,
      }),
    });
    loader.start();
    return () => loader.stop();
  }, [onLoadMore]);

  const handleFilterClick = (next: FilterValue) => {
    setFilter(next);
    onFilterChange?.(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-black text-slate-900">模特资源库</h2>
          <p className="mt-2 text-sm text-slate-500">选择已保存的人物资产,用于商品图片和视频任务。</p>
        </div>
        {canCreateProfile && <button onClick={onCreateProfile} className="h-9 rounded-md bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover">
          新建 AI 模特
        </button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            onClick={() => handleFilterClick(item)}
            className={`rounded-md border px-3 py-2 text-xs font-bold ${
              filter === item
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400">
          正在加载模特资源…
        </div>
      ) : error ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-red-200 bg-red-50 px-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : profiles.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-400">
          当前筛选下暂无可用模特
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {profiles.map((profile) => (
              <article
                key={profile.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white transition-all hover:border-slate-300 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setPreviewProfile(profile)}
                  className="flex aspect-square w-full cursor-zoom-in items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50"
                  aria-label={`放大查看模特图片:${profile.name}`}
                  title="点击查看大图"
                >
                  <img
                    src={withCosThumbnail(profile.image, 640) ?? profile.image}
                    alt={profile.name}
                    className="max-h-full max-w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>
                <div className="space-y-2 p-3.5">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-sm font-black text-slate-900" title={profile.name}>{profile.name}</h3>
                    <span className="shrink-0 whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500">{profile.source}</span>
                  </div>
                  <div className="mt-2 flex max-h-11 flex-wrap gap-1 overflow-hidden">
                    {profile.tags.map((tag) => (
                      <span key={tag} className="whitespace-nowrap rounded bg-blue-50 px-2 py-1 text-[10px] text-primary">{tag}</span>
                    ))}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">
                    适用任务:{profile.suitableFor
                      .map((type) => TASK_LABELS[type as ImageGenerationType] ?? type)
                      .join('、')}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* 底部追加加载状态区 —— 不动已渲染卡片 */}
          {appendError ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-red-500">
              <span>加载失败,点击重试</span>
              <button
                type="button"
                onClick={() => onLoadMore?.()}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:border-red-300"
              >
                重试
              </button>
            </div>
          ) : loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
              正在加载更多…
            </div>
          ) : hasMore === false && typeof total === 'number' ? (
            <div className="py-6 text-center text-xs text-slate-400">
              已加载全部 {total} 个模特
            </div>
          ) : null}
        </>
      )}

      {previewProfile && (
        <ImagePreviewModal
          images={[{
            url: previewProfile.image,
            label: previewProfile.name,
          }]}
          initialIndex={0}
          onClose={() => setPreviewProfile(undefined)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3.4: 运行新增测试**

Run: `cd EC-AIGC && npm test -- src/components/ModelLibrary.test.tsx`
Expected: PASS,2 passed

- [ ] **Step 3.5: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: exit 0

---

## Task 4: App.tsx 拆分首屏 / 追加两路 state + filter 联动

**Files:**
- Modify: `EC-AIGC/src/App.tsx`(仅 `MODEL_LIBRARY` 相关三处:`modelProfilesQuery`、`MODEL_LIBRARY` case、`onModelImported`/`onPublished` 链路)

**Interfaces:**
- Consumes: `<ModelLibrary>` 新 props(Task 3)
- Produces: `loadNextProfilePage(): void`,`profileList: ModelProfileDTO[]`,`loadingMore: boolean`,`hasMore: boolean`,`profileTotal: number`,`profileAppendError: Error | null`

### Steps

- [ ] **Step 4.1: 添加 pageSize 常量与 import**

在 `App.tsx` 顶部 `import` 之后,模块作用域加入:

```ts
const profilePageSize = 50;
```

- [ ] **Step 4.2: 重写分页 state 段**

替换 `App.tsx:240-244`(原 `modelProfilesQuery` 块)为:

```tsx
  // ========== 模特资源库分页 state ==========
  const [profileList, setProfileList] = useState<ModelProfileDTO[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profileAppendError, setProfileAppendError] = useState<Error | null>(null);
  const profileNextPageRef = useRef(2);
  const profileLoadingVersionRef = useRef<number | null>(null);
  const profileQueryVersionRef = useRef(0);
  const profileHasMoreRef = useRef(true);
  const [selectedStyleTag, setSelectedStyleTag] = useState<string | null>(null);

  const modelProfilesQuery = useServiceQuery(
    () => modelProfileApi.page({
      pageNum: 1,
      pageSize: profilePageSize,
      status: 'active',
      styleTag: selectedStyleTag ?? undefined,
    }),
    [selectedStyleTag],
    isAuthenticated,
  );

  // 首屏 useServiceQuery 完成 → 同步到本地 list
  useEffect(() => {
    const data = modelProfilesQuery.data;
    if (!data) return;
    setProfileList(data.list);
    setProfileTotal(data.total);
    const nextHasMore = 1 < data.pages;
    setHasMore(nextHasMore);
    profileHasMoreRef.current = nextHasMore;
    profileNextPageRef.current = 2;
  }, [modelProfilesQuery.data]);

  // 追加下一页
  const loadNextProfilePage = useCallback(async () => {
    if (profileLoadingVersionRef.current !== null || !profileHasMoreRef.current) return;
    const version = profileQueryVersionRef.current;
    profileLoadingVersionRef.current = version;
    setLoadingMore(true);
    setProfileAppendError(null);
    const pageNum = profileNextPageRef.current;
    try {
      const page = await modelProfileApi.page({
        pageNum,
        pageSize: profilePageSize,
        status: 'active',
        styleTag: selectedStyleTag ?? undefined,
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
      setProfileAppendError(error as Error);
    } finally {
      if (version === profileQueryVersionRef.current) {
        profileLoadingVersionRef.current = null;
        setLoadingMore(false);
      }
    }
  }, [selectedStyleTag]);

  const handleProfileFilterChange = useCallback((tag: string) => {
    // 把 FILTERS 文案映射到后端 styleTag:目前 tag 与后端一致,直接传;
    // 后续若不一致在此处加映射表
    const next = tag === '全部' ? null : tag;
    profileQueryVersionRef.current += 1;
    profileLoadingVersionRef.current = null;
    profileNextPageRef.current = 2;
    profileHasMoreRef.current = true;
    setProfileAppendError(null);
    setLoadingMore(false);
    setSelectedStyleTag(next);
    // selectedStyleTag 变化触发 useServiceQuery 重跑
  }, []);
```

并确保在 `App.tsx` 顶部 import 已包含:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelProfileDTO } from './api/modules/modelProfile';
```

(若已有 `useEffect` import 则只补 `useCallback`、`useRef`、`ModelProfileDTO`。)

- [ ] **Step 4.3: 改写 `MODEL_LIBRARY` case 透传 props**

替换 `App.tsx:336-344` 为:

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
            appendError={profileAppendError}
            onLoadMore={loadNextProfilePage}
            onFilterChange={handleProfileFilterChange}
            onCreateProfile={() => setModelCreatorOpen(true)}
          />
        );
```

- [ ] **Step 4.4: 替换 `onModelImported` / `onPublished` 回调**

定位现有所有 `onModelImported={modelProfilesQuery.refetch}` 与 `onPublished={modelProfilesQuery.refetch}` 用法,把对 `modelProfilesQuery.refetch` 的调用全部替换为新 helper(避免拉到的数据覆盖分页 state 时序错乱):

新建 helper:

```tsx
  // 模特导入/发布后:重置分页 state + 触发首屏重拉
  const refetchProfileList = useCallback(() => {
    profileQueryVersionRef.current += 1;
    profileLoadingVersionRef.current = null;
    profileNextPageRef.current = 2;
    profileHasMoreRef.current = true;
    setProfileList([]);
    setProfileAppendError(null);
    setLoadingMore(false);
    setHasMore(true);
    setProfileTotal(0);
    modelProfilesQuery.refetch();
  }, [modelProfilesQuery]);
```

把所有 `onModelImported={modelProfilesQuery.refetch}` 改为 `onModelImported={refetchProfileList}`,`onPublished={modelProfilesQuery.refetch}` 改为 `onPublished={refetchProfileList}`。

- [ ] **Step 4.5: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: exit 0

- [ ] **Step 4.6: 全部测试运行**

Run: `cd EC-AIGC && npm test`
Expected: PASS,所有测试通过(应至少含本计划新增 4 个测试文件:shouldTriggerLoadMore、createWindowScrollLoader、ModelLibrary、原有 suite)

---

## Task 5: 手工验收(代码完成后)

**Files:** 无(纯人工操作,IDE 中进行)

### Steps

- [ ] **Step 5.1: 启动后端**

在 IDE 用 `DafenqiAiApplication` 主类 + Spring Boot 配置启动后端(`localhost:8090`)。

- [ ] **Step 5.2: 启动前端 dev server**

在 `EC-AIGC/` 目录运行 `npm run dev`(端口 3001)。

- [ ] **Step 5.3: 验证首屏**

打开 `http://localhost:3001`,进入「模特资源库」屏。确认:

- 首屏卡片数 ≤ `profilePageSize`(50)
- 首次进入有 loading 占位 → 卡片渐入

- [ ] **Step 5.4: 验证滚动加载**

- 滚到底部 → 看到「正在加载更多…」,1~2 秒后出现新卡片
- 若故意把后端接口改为 500(临时改 controller 或用 Charles)→ 看到「加载失败,点击重试」,点重试 → 恢复
- 滚到最后一页 → 「已加载全部 N 个模特」(`N = profileTotal`)

- [ ] **Step 5.5: 验证 tag 切换**

- 点「甜美」chip → 列表清空,重新加载,只剩 tag 含「甜美」的模特
- 切回「全部」→ 重新加载,展示全部

- [ ] **Step 5.6: 验证导入刷新**

- 点「新建 AI 模特」,走完发布流
- 返回 ModelLibrary → 列表自动刷新到第一页(由 `refetchProfileList` 触发)

- [ ] **Step 5.7: 验证 isAuthenticated 切换**

- 触发登出/登入 → ModelLibrary 重新挂载,首屏 loading 占位正常出现