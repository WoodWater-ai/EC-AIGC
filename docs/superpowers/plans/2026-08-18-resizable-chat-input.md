# 创作助手输入框手动调整高度 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在创作助手页面提供一条"消息列表—输入框"之间的可拖拽横条,让用户手动调整输入框高度(2-10 行范围);跨会话记住、移动端同样支持但上限收紧。不引入新依赖。

**Architecture:** 单 React 文件 + 单 hook + 单一纯 utility 文件。Pure helpers 负责 height clamp / storage parsing;`useMediaQuery` 监听断点;`AssistantPage` 在 footer 内手动控制 textarea 高度。Flex 自带的 `flex-1` 兄弟节点回流消息列表,无需 JS。鼠标/触摸 document 级监听 + React 键盘事件绑定。`window` / `localStorage` 全部 typeof 守卫,适配 Node 测试 + SSR。

**Tech Stack:** React 19、TypeScript 5.8、Tailwind 4(CSS-first `@theme`)、Node 内置 `tsx --test` 测试运行器(无 jsdom / RTL)。

## Global Constraints

- **不引入新 npm 依赖**。代码改动只能用项目已有的 react / react-dom / sonner / lucide-react 等。
- Tailwind 4 CSS-first —— 新增 token 写在 `src/index.css` 的 `@theme {}` 块,**不要**创建 `tailwind.config.js`。
- 主色 `--color-primary` = **`#D85C42`(terracotta)**,不是项目 `CLAUDE.md` 里写的蓝色。前端团队对齐用 terracotta;改色按 memory 里 "EC-AIGC primary is terracotta" 的口径。
- 测试运行器是 `tsx --test`,不支持 jsdom / `@testing-library/react`。**React 组件 / hook 不写单元测试**(项目 `src/hooks/__tests__/useCreateImageTaskState.test.ts` 顶部已说明此约定)。只覆盖纯函数。组件层验证走 `npm run lint`(`tsc --noEmit`) + 手动烟测。
- `tsconfig.json` 用 `moduleResolution: "bundler"` + `allowImportingTsExtensions: true`,**import 不要带 `.js` 扩展**。
- 工作区根 `CLAUDE.md` 禁止直接执行 `git` 命令。**所有 commit 由开发者手动在 IDE / 终端完成**。
- 输入文件相对仓库根目录的路径,不写绝对路径(IDE 友好)。

---

## Task 1: 纯辅助函数 + 单元测试 (TDD)

**Files:**
- Create: `EC-AIGC/src/components/Assistant/inputHeight.ts`
- Create: `EC-AIGC/src/components/Assistant/inputHeight.test.ts`

**Interfaces:** 这块没有前置依赖;导出供 Task 3 引用:
- `STORAGE_KEY: string`
- `DEFAULT_HEIGHT`, `MIN_HEIGHT`, `MAX_HEIGHT_DESKTOP`, `MAX_HEIGHT_MOBILE`, `BREAKPOINT_PX`, `STEP_KEY_SMALL`, `STEP_KEY_LARGE` (number constants)
- `clampHeight(value, min, max): number`
- `parseStoredHeight(raw: string | null, min: number, max: number): number`
- `computeNextHeight(startHeight: number, delta: number, min: number, max: number): number`

- [ ] **Step 1: 写失败的测试**

新建 `EC-AIGC/src/components/Assistant/inputHeight.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STORAGE_KEY,
  DEFAULT_HEIGHT,
  MIN_HEIGHT,
  MAX_HEIGHT_DESKTOP,
  MAX_HEIGHT_MOBILE,
  clampHeight,
  parseStoredHeight,
  computeNextHeight,
} from './inputHeight';

test('STORAGE_KEY 带 v1 版本号后缀', () => {
  assert.match(STORAGE_KEY, /\.v1$/);
});

test('DEFAULT_HEIGHT 在 MIN 与 MAX_DESKTOP 之间', () => {
  assert.ok(DEFAULT_HEIGHT > MIN_HEIGHT);
  assert.ok(DEFAULT_HEIGHT < MAX_HEIGHT_DESKTOP);
});

test('MAX_HEIGHT_MOBILE < MAX_HEIGHT_DESKTOP', () => {
  assert.ok(MAX_HEIGHT_MOBILE < MAX_HEIGHT_DESKTOP);
});

test('clampHeight 在范围内返回原值', () => {
  assert.equal(clampHeight(100, 48, 240), 100);
});

test('clampHeight 低于 min 时夹到 min', () => {
  assert.equal(clampHeight(10, 48, 240), 48);
});

test('clampHeight 高于 max 时夹到 max', () => {
  assert.equal(clampHeight(999, 48, 240), 240);
});

test('parseStoredHeight:合法字符串返回其值', () => {
  assert.equal(parseStoredHeight('150', 48, 240), 150);
});

test('parseStoredHeight:null 返回 DEFAULT', () => {
  assert.equal(parseStoredHeight(null, 48, 240), DEFAULT_HEIGHT);
});

test('parseStoredHeight:空字符串返回 DEFAULT', () => {
  assert.equal(parseStoredHeight('', 48, 240), DEFAULT_HEIGHT);
});

test('parseStoredHeight:非数字字符串返回 DEFAULT', () => {
  assert.equal(parseStoredHeight('abc', 48, 240), DEFAULT_HEIGHT);
});

test('parseStoredHeight:低于 min 夹到 min,非 DEFAULT', () => {
  assert.equal(parseStoredHeight('10', 48, 144), 48);
});

test('parseStoredHeight:高于 max 夹到 max,非 DEFAULT', () => {
  assert.equal(parseStoredHeight('200', 48, 144), 144);
});

test('parseStoredHeight:合法数字夹在 [min,max] 内返回原值', () => {
  assert.equal(parseStoredHeight('120', 48, 144), 120);
});

test('computeNextHeight:在范围内正确相加', () => {
  assert.equal(computeNextHeight(100, 50, 48, 240), 150);
});

test('computeNextHeight:加过大夹到 max', () => {
  assert.equal(computeNextHeight(200, 999, 48, 240), 240);
});

test('computeNextHeight:减过小夹到 min', () => {
  assert.equal(computeNextHeight(60, -100, 48, 240), 48);
});
```

- [ ] **Step 2: 跑测试确认 RED**

```bash
cd EC-AIGC
npm run test -- src/components/Assistant/inputHeight.test.ts
```

Expected: `Cannot find module './inputHeight'` 或类似解析错误。**必须有失败输出**,不要跳过。

- [ ] **Step 3: 实现 module**

新建 `EC-AIGC/src/components/Assistant/inputHeight.ts`:

```ts
// 创作助手输入框高度相关常量与纯函数(spec §4.3 / §4.6 / §6 引用)

export const STORAGE_KEY = 'assistant.inputHeight.v1';

export const DEFAULT_HEIGHT = 88;        // ≈ 4 行
export const MIN_HEIGHT = 48;            // ≈ 2 行
export const MAX_HEIGHT_DESKTOP = 240;   // ≈ 10 行
export const MAX_HEIGHT_MOBILE = 144;    // ≈ 6 行
export const BREAKPOINT_PX = 768;        // 与 Tailwind md: 对齐

export const STEP_KEY_SMALL = 8;         // ↑ / ↓
export const STEP_KEY_LARGE = 32;        // PgUp / PgDn

/**
 * 把值钳制到 [min, max]。
 */
export function clampHeight(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 把 localStorage 取出的字符串解析为合法的输入框高度。
 * - 非法(null / 空 / 非数字)→ DEFAULT_HEIGHT
 * - 合法但在范围之外 → 钳制到最近边界(spec §6:窗口变窄钳制)
 */
export function parseStoredHeight(
  raw: string | null,
  min: number,
  max: number,
): number {
  if (raw == null || raw === '') return DEFAULT_HEIGHT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_HEIGHT;
  return clampHeight(parsed, min, max);
}

/**
 * 拖拽过程中根据起始高度与位移计算新高度,钳制在 [min, max]。
 */
export function computeNextHeight(
  startHeight: number,
  delta: number,
  min: number,
  max: number,
): number {
  return clampHeight(startHeight + delta, min, max);
}
```

- [ ] **Step 4: 跑测试确认 GREEN**

```bash
npm run test -- src/components/Assistant/inputHeight.test.ts
```

Expected:全部 PASS,无报错。如果有失败,回到 Step 3 修实现,**不**改测试。

- [ ] **Step 5: 提交**

在 IDE 终端手动提交(项目 CLAUDE.md 禁止 Claude 直接执行 git):

Commit message 建议:

```
feat(assistant): add inputHeight utilities (clamp / parseStoredHeight)
```

---

## Task 2: useMediaQuery hook

**Files:**
- Create: `EC-AIGC/src/hooks/useMediaQuery.ts`

> 测试约定说明:本仓库用 `tsx --test` + `node:test`,**没有 jsdom / React Testing Library**(见 `src/hooks/__tests__/useCreateImageTaskState.test.ts` 顶部注释)。`useMediaQuery` 依赖 `window.matchMedia`,纯单元测试桩接复杂。**这块以代码 review + 手动烟测为主**。Hook 的 fallback(无 `window.matchMedia` 时返回 false)靠实现中的 `typeof` 守卫做防御性保护。

**Interfaces:** 单参数 `query: string`,返回 `boolean`。当 `window.matchMedia` 不存在(SSR / Node 测试)时返回 `false`(视作 desktop = max)。

- [ ] **Step 1: 实现 hook**

新建 `EC-AIGC/src/hooks/useMediaQuery.ts`:

```ts
import { useEffect, useState } from 'react';

function safeMatch(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}

/**
 * SSR / 非浏览器安全的 media query hook。
 * - SSR / 测试环境(无 window)→ 返回 false(默认 desktop = max)
 * - 浏览器内 → 监听 matchMedia change,实时响应
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => safeMatch(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: 类型检查**

```bash
cd EC-AIGC
npm run lint
```

Expected:0 error。如果报"找不到 MediaQueryListEvent"之类,确认 `tsconfig.json` 的 `lib` 包含 `"DOM"`。

- [ ] **Step 3: 提交**

Commit message 建议:

```
feat(hooks): add SSR-safe useMediaQuery
```

---

## Task 3: 在 AssistantPage 集成拖拽手柄

**Files:**
- Modify: `EC-AIGC/src/components/Assistant/AssistantPage.tsx`

> 这是改动最集中的一个任务。按"小步前进"切成 7 个 sub-step,每步都可以单独 review。

定位锚点(文件实际行号会随编辑漂移,搜索下列 className / ref):
- **textarea**:在 `className="... resize-none ... placeholder:text-[#aaa39c]"` 的 `<textarea>`
- **footer**:在 `<footer className="shrink-0 border-t border-border-main bg-gradient-to-t from-white ...`
- **imports**:第 1-18 行,`import { ... } from 'react'`

- [ ] **Step 3.1: 新增 imports**

在第 1-18 行 import 区**末尾**加入:

```ts
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  STORAGE_KEY,
  DEFAULT_HEIGHT,
  MIN_HEIGHT,
  MAX_HEIGHT_DESKTOP,
  MAX_HEIGHT_MOBILE,
  BREAKPOINT_PX,
  STEP_KEY_SMALL,
  STEP_KEY_LARGE,
  clampHeight,
  parseStoredHeight,
  computeNextHeight,
} from './inputHeight';
```

- [ ] **Step 3.2: 新增 state 与 ref**

紧接现有的 state 区之后(在 `const messageScrollRef = useRef<HTMLDivElement | null>(null);` 与 `const textareaRef = useRef<HTMLTextAreaElement | null>(null);` 附近)加入:

```ts
const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINT_PX}px)`);
const effectiveMax = isDesktop ? MAX_HEIGHT_DESKTOP : MAX_HEIGHT_MOBILE;

const [inputHeight, setInputHeight] = useState<number>(DEFAULT_HEIGHT);

// 拖拽过程中暂存 startY/startHeight/lastHeight,不进 React state(避免每像素 re-render)。
// lastHeight 关键:moveDrag 的 setInputHeight 是异步,endDrag 触发时(尤其是快速拖完立刻松手)
// React state 可能还没 flush,所以 endDrag 必须从 ref 取最终值(spec §4.6)。
const dragRef = useRef<{ startY: number; startHeight: number; lastHeight: number } | null>(null);
```

- [ ] **Step 3.3: 新增拖拽回调(useCallback)**

在组件内、`return (` 之前(可挨着 useEffect 簇),加入以下三个回调。**全部用 useCallback**,dependencies 明确:

```ts
const beginDrag = useCallback((clientY: number) => {
  dragRef.current = { startY: clientY, startHeight: inputHeight, lastHeight: inputHeight };
  if (typeof document !== 'undefined') {
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }
}, [inputHeight]);

const moveDrag = useCallback((clientY: number) => {
  const state = dragRef.current;
  if (!state) return;
  const delta = clientY - state.startY;
  const next = computeNextHeight(state.startHeight, delta, MIN_HEIGHT, effectiveMax);
  // 同步写 ref,供 endDrag 取真值;setInputHeight 异步
  dragRef.current = { ...state, lastHeight: next };
  setInputHeight(next);
}, [effectiveMax]);

const endDrag = useCallback(() => {
  const state = dragRef.current;
  if (!state) return;
  dragRef.current = null;
  if (typeof document !== 'undefined') {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  try {
    if (typeof localStorage !== 'undefined') {
      // 从 ref 读,不依赖 React state(可能没 flush)
      localStorage.setItem(STORAGE_KEY, String(state.lastHeight));
    }
  } catch {
    /* localStorage 不可用,静默忽略 */
  }
}, []);
```

- [ ] **Step 3.4: document 级 mousemove/touchmove 监听 useEffect**

紧随 3.3 的回调下面:

```ts
useEffect(() => {
  const onMouseMove = (e: MouseEvent) => moveDrag(e.clientY);
  const onMouseUp = () => endDrag();
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 0) return;
    moveDrag(e.touches[0].clientY);
  };
  const onTouchEnd = () => endDrag();

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd);
  return () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };
}, [moveDrag, endDrag]);
```

- [ ] **Step 3.5: 启动恢复 + 窗口变窄钳制 useEffect**

紧随 3.4:

```ts
useEffect(() => {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    setInputHeight(parseStoredHeight(raw, MIN_HEIGHT, effectiveMax));
  } catch {
    /* fall back to default */
  }
}, [effectiveMax]);

useEffect(() => {
  if (inputHeight > effectiveMax) {
    const next = clampHeight(inputHeight, MIN_HEIGHT, effectiveMax);
    setInputHeight(next);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
    } catch {
      /* ignore */
    }
  }
}, [effectiveMax, inputHeight]);
```

- [ ] **Step 3.6: 手柄键盘事件回调**

紧随 3.5:

```ts
const onHandleKeyDown = useCallback(
  (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowUp':
        next = clampHeight(inputHeight + STEP_KEY_SMALL, MIN_HEIGHT, effectiveMax);
        break;
      case 'ArrowDown':
        next = clampHeight(inputHeight - STEP_KEY_SMALL, MIN_HEIGHT, effectiveMax);
        break;
      case 'PageUp':
        next = clampHeight(inputHeight + STEP_KEY_LARGE, MIN_HEIGHT, effectiveMax);
        break;
      case 'PageDown':
        next = clampHeight(inputHeight - STEP_KEY_LARGE, MIN_HEIGHT, effectiveMax);
        break;
      case 'Home':
        next = MIN_HEIGHT;
        break;
      case 'End':
        next = effectiveMax;
        break;
      case 'Enter':
      case ' ':
        next = DEFAULT_HEIGHT;
        break;
      default:
        return;
    }
    e.preventDefault();
    setInputHeight(next);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
    } catch {
      /* ignore */
    }
  },
  [inputHeight, effectiveMax],
);
```

- [ ] **Step 3.7: 改 footer 与加手柄 DOM**

将当前 footer 块的开头从(示意):

```jsx
<footer className="shrink-0 border-t border-border-main bg-gradient-to-t from-white via-white to-white/80 px-3 pb-3 pt-3 sm:px-6 sm:pb-4 lg:px-10">
  <div className="mx-auto max-w-5xl">
```

改为:

```jsx
<footer className="shrink-0 border-border-main bg-gradient-to-t from-white via-white to-white/80">
  <div
    role="separator"
    aria-orientation="horizontal"
    aria-label="拖动调整输入框高度"
    aria-valuenow={inputHeight}
    aria-valuemin={MIN_HEIGHT}
    aria-valuemax={effectiveMax}
    tabIndex={0}
    onKeyDown={onHandleKeyDown}
    onMouseDown={(e) => {
      e.preventDefault();
      beginDrag(e.clientY);
    }}
    onTouchStart={(e) => {
      if (e.touches.length === 0) return;
      beginDrag(e.touches[0].clientY);
    }}
    className="group flex h-1.5 cursor-ns-resize select-none items-center justify-center border-t border-border-main bg-[#f3f0ec] transition-colors hover:bg-primary-light focus:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <span
      aria-hidden
      className="block h-[3px] w-9 rounded-full bg-[#d6d1cb] transition-colors group-hover:bg-primary"
    />
  </div>
  <div className="mx-auto max-w-5xl px-3 pb-3 pt-2 sm:px-6 sm:pb-4 lg:px-10">
```

> 注意 1:把原本 footer 的 padding 从 footer 上移到内层 `<div>`,让手柄**横跨 footer 全宽**(用户拖拽区 = 整条线)。
>
> 注意 2:React 19 中 ref 接受函数 ref 会收到 `null` 然后 `HTMLDivElement`。如果不喜欢 callback ref,改用 `useRef<HTMLDivElement>(null)` + 同步 ref 赋值(`const dragHandleRef = useRef<HTMLDivElement | null>(null);`,并把 `dragHandleRef.current = node` 改成 inline `(node) => { dragHandleRef.current = node; }` 或同等形式)。
>
> 注意 3:onMouseDown / onTouchStart 用 inline 函数而不是再抽 useCallback —— 这两个回调只用一次,inline 不增加复杂度。如果觉得啰嗦,可以提一层 useCallback(同理 onHandleKeyDown 的命名规范)。

- [ ] **Step 3.8: 改 textarea**

把 footer 内 textarea 的 className + props 改成:

```jsx
<textarea
  ref={textareaRef}
  rows={2}
  maxLength={5000}
  value={content}
  onChange={(event) => setContent(event.target.value)}
  onKeyDown={(event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }}
  placeholder="描述你的创作需求,可以直接说要修改什么……"
  style={{ height: `${inputHeight}px` }}
  className="block w-full resize-none border-0 bg-transparent py-1.5 text-sm leading-6 text-text-main outline-none placeholder:text-[#aaa39c] will-change-[height]"
/>
```

具体差异:
- 加 `style={{ height: ... }}`
- 移除 `min-h-[58px]` 与 `max-h-36` Tailwind class
- 加 `block` 与 `will-change-[height]`
- 保留 `resize-none`

- [ ] **Step 3.9: 类型检查**

```bash
cd EC-AIGC
npm run lint
```

Expected:0 error。

如果有 `Cannot find name 'beginDrag'` / `onHandleKeyDown` / `dragHandleRef` 报错 → 回到 Step 3.2 / 3.3 / 3.6 检查是否遗漏。如果有 `unused` 警告 → 检查是否 Step 3.7 接错了事件。

- [ ] **Step 3.10: 手动烟测**

启动项目(按项目 CLAUDE.md "命令" 一节使用 IDE,不要 npm 命令直接启):

- `npm run dev`(在 IDE 或本地终端)
- 浏览器打开 `http://localhost:3000`,通过 `currentScreen` 切到创作助手

逐项核对(spec §8.3):

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 首次进入 | 输入框高度 ≈ 88px;消息列表与输入框之间能看到一条低对比横条 |
| 2 | 输入几行文字(不超 6 行) | 输入框**不**自动撑高,仍 ≈ 88px;内部滚动条按 textarea 默认行为 |
| 3 | 鼠标悬停消息—输入框之间的横条 | cursor 变为 `ns-resize`;横条底色略变浅、grip 标志变主色 |
| 4 | 按住横条,鼠标向下拖 ~80px | 输入框实时变高;消息列表相应变短 |
| 5 | 松开 | 高度稳定;再点鼠标到别处,不变 |
| 6 | 浏览器整页刷新(Cmd/Ctrl+R) | 输入框仍停在拖到的那个高度 |
| 7 | 拖宽到最大 | 输入框不再增长,触钳制 |
| 8 | 拖窄到最小 | 同上 |
| 9 | 浏览器窗口宽度拖到 < 768px | 高度被钳到 ≤ 144(若之前高度 > 144) |
| 10 | 浏览器窗口宽度再拉回 ≥ 768px | 高度保留之前钳到的值 |
| 11 | Tab 让手柄聚焦 | 出现主色焦点环 |
| 12 | 按 End | 输入框撑到该断点对应的 max |
| 13 | 按 Home | 输入框缩到 48px |
| 14 | 按 Enter 或 Space | 高度回到 88px |
| 15 | DevTools → Application → Local Storage,删 `assistant.inputHeight.v1` → 刷新 | 高度回到 88px |

任何一项不及格,先回到对应 step 修复,**不**进入 Step 4。

- [ ] **Step 3.11: 提交**

Commit message 建议:

```
feat(assistant): drag-to-resize user input box (top-edge handle)
```

---

## Task 4: 收尾自审

**Files:** 无新增文件;只做 spec 对照。

- [ ] **Step 4.1: spec 覆盖检查**

打开 `EC-AIGC/docs/superpowers/specs/2026-08-18-resizable-chat-input-design.md`,逐节核对 Task 1-3 是否落地:

| Spec 节 | 落地处 |
|---|---|
| §2 目标 | Task 3 整体 |
| §4.1 改动范围 | Task 1 / 2 / 3 |
| §4.2 层级结构 | Task 3 Step 3.7 |
| §4.3 常量 / storage schema | Task 1 Step 3 |
| §4.4 state / refs | Task 3 Step 3.2 |
| §4.5 启动恢复 | Task 3 Step 3.5 |
| §4.6 拖拽生命周期 | Task 3 Step 3.3 |
| §4.7 事件绑定 | Task 3 Step 3.4 |
| §4.8 textarea 改造 | Task 3 Step 3.8 |
| §4.9 键盘操作 | Task 3 Step 3.6 |
| §4.10 滚动处理 | 不主动干预(无需新增代码) |
| §4.11 useMediaQuery | Task 2 |
| §5 视觉 | Task 3 Step 3.7(类名 + 主色对齐) |
| §6 边界与错误 | Task 1(parseStoredHeight 钳制)+ Task 3 Step 3.5(窗口变窄 useEffect) |
| §7 a11y | Task 3 Step 3.7(`role` / `aria-*` / `tabIndex`)+ Step 3.6(键盘) |
| §8.1 单测 | Task 1 |
| §8.3 烟测 | Task 3 Step 3.10 |

任何空白 → 写一个 micro-step 补,完成后回归 Task 1 / 2 / 3 测试 + 烟测。

- [ ] **Step 4.2: 完整测试套件 + lint**

```bash
cd EC-AIGC
npm run test
npm run lint
```

Expected:`npm run test` 全部 PASS;`npm run lint` 0 error。

- [ ] **Step 4.3: 提交(若 Step 4.1 补了 micro-step)**

如有补,commit message:

```
chore(assistant): address spec coverage gaps in resizable input
```

无补则跳过此步。

---

## Out of Plan (YAGNI)

明确**不**做的事(spec §3 与产品讨论结果):
- 内容自动撑高
- 全屏撰写模式 / 收起按钮 / 双击自动适配
- 按行数 snap
- 不同会话不同高度
- 第三方依赖

任何 PR 涉及上面任一项,**先回到 brainstorming**,不要顺手加。
