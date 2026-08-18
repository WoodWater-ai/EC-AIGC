# 创作助手输入框手动调整高度 — Design Spec

- **日期**:2026-08-18
- **项目**:EC-AIGC
- **状态**:Design(待实施计划)
- **主文件**:`EC-AIGC/src/components/Assistant/AssistantPage.tsx`
- **依赖**:无新 npm 包

## 1. 背景与痛点

创作助手当前底部"用户输入框"高度被固定在最小 ≈ 2 行(58px)、最大 ≈ 6 行(144px)之间。当用户需要输入较长的创作需求(多镜头脚本、详细 prompt、分镜清单),内容超过 144px 就出现内部滚动条,**需滚动才能看完自己写的内容**,使用不便。

### 竞品参考(2026-08-18 调研)

| 产品 | 拖拽手柄 | 自动撑高 | 最大高度 |
|---|---|---|---|
| ChatGPT / Claude.ai / Gemini | ✗ | ✓ | ~5-7 行 |
| Kimi / 豆包 / 文心一言 / 通义千问 | ✗ | ✓ | ~5-6 行 |
| Microsoft Copilot | ✗ | ✓ | ~5 行 |
| **DeepSeek Chat** | ✓(右下角) | ✓ | 用户控制 |

大陆主流 AI 聊天产品中,DeepSeek 是唯一提供手动拖拽的。本特性落在用户明确要求的方向,且相对多数竞品为体验差异点。

## 2. 目标

让用户在创作助手页面,通过"消息列表—输入框"之间一条可拖拽横条,**手动调整输入框高度**,区间 [48px, 240px](约 2-10 行)。跨会话记住上次高度。移动端同样支持拖拽,但上限收紧为 144px(约 6 行)。

## 3. 非目标 (YAGNI)

- 内容自动撑高(基于 scrollHeight 测量自动调高)
- 全屏撰写模式、收起/重置按钮、双击自动适配
- 按行数 snap(拖到整数行)
- 不同会话独立高度(全局共享)
- 拖拽动效曲线 / 缓动
- 引入第三方依赖

## 4. 设计

### 4.1 改动范围

单文件为主:`EC-AIGC/src/components/Assistant/AssistantPage.tsx`。

### 4.2 组件层级(改动后)

```
<section className="flex min-w-0 flex-1 flex-col bg-[#fbfaf8]">
  <header />                                            // 现有
  <div className="flex-1 overflow-y-auto ...">         // 消息列表;flex-1 自动回流
    {messages.map(...)}
    <div ref={bottomRef} />
  </div>
  <footer className="shrink-0 border-t border-border-main bg-...">  
    <div ref={dragHandleRef}                            // 新增:6px 拖拽条
         role="separator"
         aria-orientation="horizontal"
         aria-label="拖动调整输入框高度"
         aria-valuenow={inputHeight}
         aria-valuemin={MIN_HEIGHT}
         aria-valuemax={effectiveMax}
         tabIndex={0}
         onMouseDown={onMouseDownOnHandle}
         onTouchStart={onTouchStartOnHandle}
         onKeyDown={onKeyDownOnHandle}
         className="flex h-1.5 cursor-ns-resize items-center justify-center select-none border-t border-border-main bg-[#f3f0ec] hover:bg-primary-light focus-visible:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span aria-hidden className="block h-[3px] w-9 rounded-full bg-[#d6d1cb] group-hover:bg-primary" />
    </div>
    <div className="px-3 pb-3 pt-2 sm:px-6 sm:pb-4 lg:px-10">
      {/* 选中资源条(若有) */}
      <textarea
        ref={textareaRef}
        rows={2}
        maxLength={5000}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={...}
        placeholder="描述你的创作需求,可以直接说要修改什么……"
        style={{ height: `${inputHeight}px` }}
        className="block w-full resize-none border-0 bg-transparent py-1.5 text-sm leading-6 text-text-main outline-none placeholder:text-[#aaa39c] will-change-[height]"
      />
      {/* 操作按钮(发送、优化等) */}
    </div>
  </footer>
</section>
```

**关键关系**:`<section>` 是 `flex flex-col`。footer 的 `shrink-0` 被保留;消息列表 `flex-1 overflow-y-auto` 在 footer 高度变化时**自动反向收缩**,不需要写 JS 来回流消息列表。

### 4.3 常量与 storage schema

```ts
// 模块作用域常量
const STORAGE_KEY = 'assistant.inputHeight.v1';
const DEFAULT_HEIGHT = 88;       // ≈ 4 行
const MIN_HEIGHT = 48;           // ≈ 2 行
const MAX_HEIGHT_DESKTOP = 240;  // ≈ 10 行
const MAX_HEIGHT_MOBILE = 144;   // ≈ 6 行
const BREAKPOINT_PX = 768;       // 与 Tailwind `md:` 一致
const STEP_KEY_SMALL = 8;        // ↑ / ↓
const STEP_KEY_LARGE = 32;       // PgUp / PgDn
```

storage key 带 `.v1` 后缀,便于将来 schema 升级。

### 4.4 state / refs

```ts
// 在 AssistantPage 组件内
const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINT_PX}px)`);
const effectiveMax = isDesktop ? MAX_HEIGHT_DESKTOP : MAX_HEIGHT_MOBILE;

const [inputHeight, setInputHeight] = useState<number>(DEFAULT_HEIGHT);

// 拖拽过程不应触发 React re-render;用 ref 暂存
const dragRef = useRef<{
  startY: number;
  startHeight: number;
  pointerId: number | null;
} | null>(null);

// textarea 引用,清除本地选中(防御性)
const textareaRef = useRef<HTMLTextAreaElement | null>(null);
```

### 4.5 启动恢复

```ts
useEffect(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw == null ? NaN : Number(raw);
    if (Number.isFinite(parsed) && parsed >= MIN_HEIGHT && parsed <= effectiveMax) {
      setInputHeight(parsed);
    }
  } catch {
    // localStorage 不可用(隐私模式 / 配额 / SSR),静默回落到 DEFAULT_HEIGHT
  }
}, [effectiveMax]);
```

### 4.6 拖拽生命周期

```ts
const beginDrag = (clientY: number) => {
  dragRef.current = { startY: clientY, startHeight: inputHeight, pointerId: null };
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
};

const moveDrag = (clientY: number) => {
  const state = dragRef.current;
  if (!state) return;
  const delta = clientY - state.startY;
  const next = Math.max(MIN_HEIGHT, Math.min(effectiveMax, state.startHeight + delta));
  setInputHeight(next);
};

const endDrag = () => {
  if (!dragRef.current) return;
  dragRef.current = null;
  // 始终清理 body 样式,即使后续逻辑抛错
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  try {
    localStorage.setItem(STORAGE_KEY, String(inputHeight));
  } catch {
    // 静默忽略
  }
};
```

用 ref 暂存拖拽初始状态以避免每像素 re-render;每帧 `moveDrag` 写入 React state 是因为 textarea 的 height 属性需要随之更新。`inputHeight` 是闭包引用,在 `endDrag` 时取最新值。

### 4.7 事件绑定(在 useEffect 内)

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
  // 依赖 moveDrag / endDrag —— 它们依赖 inputHeight 和 effectiveMax
}, [moveDrag, endDrag]);
```

> 实现提示:`moveDrag` / `endDrag` 应当用 `useCallback` 包裹,或直接读到 ref 上的 inputHeight,以避免 useEffect 频繁重绑定。这里采用 `useCallback` 方案。

### 4.8 textarea 改造

**改动前**(AssistantPage.tsx 第 811-825 行):
```tsx
<textarea
  ref={textareaRef}
  value={content}
  onChange={(event) => setContent(event.target.value)}
  onKeyDown={...}
  rows={2}
  maxLength={5000}
  placeholder="..."
  className="min-h-[58px] max-h-36 w-full resize-none border-0 bg-transparent py-1.5 text-sm leading-6 text-text-main outline-none placeholder:text-[#aaa39c]"
/>
```

**改动后**:
```tsx
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

要点:
- `style.height` 取代 `min-h-[58px] max-h-36`,**移除**这两个 utility。
- `resize-none` **保留**(避免浏览器原生右下角手柄与自定义拖拽条视觉冲突)。
- 加 `block`(把 textarea 从 inline 默认变为 block,确保 `style.height` 严格生效)和 `will-change-[height]`(拖拽期间浏览器优化提示)。

### 4.9 键盘操作(手柄聚焦时)

```ts
const onKeyDownOnHandle = (e: React.KeyboardEvent<HTMLDivElement>) => {
  let next: number | null = null;
  switch (e.key) {
    case 'ArrowUp':   next = Math.min(effectiveMax, inputHeight + STEP_KEY_SMALL); break;
    case 'ArrowDown': next = Math.max(MIN_HEIGHT, inputHeight - STEP_KEY_SMALL); break;
    case 'PageUp':    next = Math.min(effectiveMax, inputHeight + STEP_KEY_LARGE); break;
    case 'PageDown':  next = Math.max(MIN_HEIGHT, inputHeight - STEP_KEY_LARGE); break;
    case 'Home':      next = MIN_HEIGHT; break;
    case 'End':       next = effectiveMax; break;
    case 'Enter':
    case ' ':
      next = DEFAULT_HEIGHT; break;
    default: return;
  }
  e.preventDefault();
  setInputHeight(next);
  // 键盘事件没有 mouseup 对应 → 立即持久化
  try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
};
```

| 键 | 行为 |
|---|---|
| ↑ / ↓ | ±8px |
| PgUp / PgDn | ±32px |
| Home | MIN_HEIGHT(48px) |
| End | effectiveMax(桌面 240 / 移动 144) |
| Enter / Space | 复位 DEFAULT_HEIGHT(88px) |

键盘调节完成后立即写 storage(无需 mouseup),刷新页面保留新值。

### 4.10 消息列表滚动

**不主动干预**。flex 自动回流时,浏览器保留原 scroll offset。

理由:用户拖拽调整输入框时通常在编辑文字;其视点要么在最末尾(键盘)在准备发送)、要么在某条历史消息上。强行 scrollIntoView 会**打断用户意图**。

新消息到达仍然走现有的 `bottomRef.current?.scrollIntoView()` 逻辑,与 resize 无关。

### 4.11 `useMediaQuery` helper

项目当前没有该 hook。新增到 `EC-AIGC/src/hooks/useMediaQuery.ts`(若团队有现成 hook 复用,优先复用):

```ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
```

若项目已有同款 hook,直接 import,不要重复。

## 5. 视觉规范

| 状态 | 手柄背景 | grip 颜色 | cursor |
|---|---|---|---|
| 默认 | `#f3f0ec` | `#d6d1cb` | ns-resize |
| hover | `--color-primary-light` | `--color-primary` | ns-resize |
| focus-visible | `--color-primary-light` | `--color-primary` | ns-resize |
| 拖拽中 | `--color-primary-light` | `--color-primary` | body 全局 ns-resize |

- grip 是一个横置椭圆(`h-[3px] w-9 rounded-full`),作为"可抓"暗示
- 默认色低对比,hover/focus/active 切到主色系
- 所有颜色走 CSS 变量 `--color-primary` (#D85C42, terracotta)、`--color-primary-light`,不引入新颜色 token

## 6. 边界与错误处理

| 边界 | 处理 |
|---|---|
| 拖到 min/max | 钳制,不回弹,无报错 |
| localStorage 不可用(隐私模式 / 配额) | try/catch,静默,fallback 默认 |
| SSR / 测试环境无 `window` | useEffect 内部读取;`useMediaQuery` 用 `typeof window` 守卫 |
| 拖拽期间异常抛错 | endDrag 用 `try { ... } finally { ... }` 保证 body 样式清理 |
| 视图宽度变化导致 max 变窄 | 当前高度若超过新的 effectiveMax,在 useEffect 中钳制并写 storage |

最后一条对应的代码:
```ts
useEffect(() => {
  if (inputHeight > effectiveMax) {
    const clamped = Math.max(MIN_HEIGHT, effectiveMax);
    setInputHeight(clamped);
    try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch {}
  }
}, [effectiveMax]);
```

## 7. a11y

- `role="separator"` + `aria-orientation="horizontal"`(视觉横条,语义分隔)
- `aria-label="拖动调整输入框高度"`
- `aria-valuenow` / `aria-valuemin` / `aria-valuemax` 实时同步
- `tabIndex={0}` + 键盘事件(4.9)
- 焦点环 `focus-visible:ring-2 focus-visible:ring-primary`
- 拖拽期间手柄自身不需要单独提示,因为 cursor 与 grab 视觉已传达

## 8. 测试

### 8.1 单元测试(`useMediaQuery`、`clamp`、storage 解析)

- `clampHeight(value, min, max)` 纯函数:低于 min → min,高于 max → max,中间 → 原值
- `parseStoredHeight(raw, min, max)`:有效数字返其值;NaN/null/越界返 DEFAULT
- `useMediaQuery`(可跳过,实现简单)

### 8.2 组件测试(@testing-library/react)

- **初始渲染**(无 storage,isDesktop=true):`style.height === '88px'`
- **storage 恢复**(写入 160 后 mount):高度为 160
- **storage 越界**(写入 999):回落到 DEFAULT
- **拖拽**:模拟 `mousedown` → `mousemove({ clientY: 原+50 })` → `mouseup`,断言 `style.height` 反映 50px 增量(在范围内),断言 storage 写入
- **钳制**:从 200 拖到 +100(clientY 超 max 边界)→ 结果 = 240
- **键盘**:↑ → +8,End → 240,Enter → 88,各场景 storage 写入
- **isDesktop=false**(mobile width):最大 144 生效

### 8.3 手动烟测

- 真鼠标拖一轮,看 hover/focus/拖拽中三态样式
- DevTools 切 mobile viewport,触摸拖一遍
- 改高度 → 刷新页面 → 高度保留
- 拖到 max,确认消息列表仍可滚动,无布局塌陷
- 横向窗口从 desktop 切到 mobile,确认高度被钳制

## 9. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 手柄与大屏触控板手势冲突 | 手柄只在 handle 元素响应 mousedown,不会抢占 textarea |
| 拖拽期间 React re-render 影响手感 | drag 状态用 ref,只在最终 setInputHeight;非受控渲染 |
| `will-change: height` 长期挂着 | 浏览器会自动回收;或可在 endDrag 后清除(非必须) |
| storage 值长期遗留 | key 带 `.v1`,后续如改 storage schema 可加 `.v2` 时一次性清理 |

回滚:本次改动集中在 `AssistantPage.tsx`。如遇紧急问题,可直接 `git revert` 一次提交,无需数据迁移。

## 10. 开放问题

无 ——brainstorming 阶段已确定:方案 A / 顶边手柄 / 2-10 行 / 跨会话记住 / 移动同样拖并收紧上限。
