# Style / Scene / Pose 字典化改造 — 设计文档

> 日期: 2026-07-25
> 范围: EC-AIGC 前端
> 状态: 已设计,待 writing-plans 阶段产出实现计划

## 1. 背景与目标

`CreateImageTask`(创建图片任务)页面中"风格 / 场景 / 姿势"三个下拉选择器当前是**前端写死**的 mock 数据,
来源为 `src/labels/createImageTask.ts` 的 `styleOptions / sceneOptions / poseOptions` 三个常量数组。

**问题**:

- 字典变更需要前端发版,运营/管理员无法自助调整
- 后端 `GenerationTaskDO.style / scene` 字段已存在(详见 `dafenqi-ai/dao/defaults/entity/task/GenerationTaskDO.java`),
  但前端提交的"风格/场景/姿势"中文展示名是硬编码字符串,与字典管理系统的真实字典项没有强关联

**目标**:三个下拉改为从后端字典管理(`/v1/admin/dict/item/list-by-code?categoryCode=xxx`)实时拉取,
字典变更无须前端发版,前后端通过 categoryCode 契约对齐。

## 2. 前置依赖(后端已就绪,本任务不涉及)

后端字典管理(参见 `dafenqi-ai/docs/superpowers/specs/2026-07-19-dict-management-design.md`)已建好以下 3 个 categoryCode 与若干字典项:

- `STYLE` — 风格字典(例:甜美网红风、极简北欧风、科技赛博风、金秋自然风、奢华丝绸风)
- `SCENE` — 场景字典(例:自然影棚、城市街景、居家陈列)
- `POSTURE` — 姿势字典(例:自然站姿、正面站姿、轻松坐姿、行走动态)

字典项 `itemName` 字段对应前端的展示文本与提交值(value);`itemCode` 字段本期不消费,仅供后端关联用。

## 3. 现状摘要

| 位置 | 当前行为 |
|---|---|
| `src/labels/createImageTask.ts` | 写死 `styleOptions / sceneOptions / poseOptions` 三个数组,导出 `StyleOption / SceneOption / PoseOption` 字面量联合类型 |
| `src/components/CreateImageTask/center/StyleScenePoseRow.tsx` | 三个 `<select>` 直接渲染上述数组的字符串;无 loading / disabled 态 |
| `src/components/CreateImageTask/CreateImageTask.tsx:355` | 父级解构 `style / scene / pose` 与 `setStyle / setScene / setPose` 后透传给组件 |
| `src/hooks/useCreateImageTaskState.ts:207-209` | hook 初始化时用 `messages.styleOptions[0]` 等作为默认值;值作为 string 喂给 `buildPromptFromFacts` |
| `src/hooks/useCreateImageTaskState.ts:180` | 草稿 key `create-image-task-draft-v2`;持久化字段含 `style / scene / pose` |
| `src/api/hooks/useDict.ts` | 已有 `useDictOptions(code)` hook(对齐 TanStack Query 形状),`TemplateCenter` 已用 11 次 |
| `src/api/modules/dict.ts` | `dictApi.listItemsByCode(code)` 端点 `POST /v1/admin/dict/item/list-by-code?categoryCode=xxx` 返回 `DictItem[]` |
| `src/api/modules/dict.ts:150-160` | `toDictOptions(items)` 工具函数已实现 NORMAL 过滤 + sort 排序 + 转 `DictOption[]` |

## 4. 设计

### 4.1 组件改造: `StyleScenePoseRow.tsx`

**Props 由 3 个 string 数组 → 3 组 DictOption[] + 3 个 loading 标志**

```ts
import type { DictOption } from '../../../api/modules/dict';

export interface StyleScenePoseRowProps {
  // 数据
  styleOptions: DictOption[];
  sceneOptions: DictOption[];
  poseOptions:  DictOption[];
  // 加载态(来自 useDictOptions.loading)
  loadingStyle?: boolean;
  loadingScene?: boolean;
  loadingPose?:  boolean;
  // 值与变更(语义不变,value 仍为 string)
  style: string; scene: string; pose: string;
  onStyleChange: (v: string) => void;
  onSceneChange: (v: string) => void;
  onPoseChange:  (v: string) => void;
}
```

**渲染规则**(每个 select 统一套用):

1. `loading === true` → `disabled` + 首项 `<option value="">加载中…</option>`
2. `options.length === 0`(空态 / 拉取失败)→ `disabled` + 首项 `<option value="">暂无数据,请联系管理员</option>`
3. 当前 `value` 不在 options 列表里(防御:草稿恢复时旧值不在新字典) → 追加一个隐藏的 `<option value={value}>{value} (已不在字典中)</option>`,
   保留用户已选,不让 select 跳空
   (`toDictOptions` 已过滤 DISABLED,故"字典项被禁"场景不会出现,这里只防草稿恢复)
4. 正常态 → `options.map((opt) => <option key={opt.id} value={opt.value}>{opt.label}</option>)`

删 `import { messages } from '../../../labels/createImageTask'`(不再用其 options)。

### 4.2 父级注入: `CreateImageTask.tsx`

新增 3 个 useDictOptions 调用:

```ts
import { useDictOptions } from '../../api/hooks/useDict';

// 在 CreateImageTask 组件内
const { options: styleOptions, loading: loadingStyle } = useDictOptions('STYLE');
const { options: sceneOptions, loading: loadingScene } = useDictOptions('SCENE');
const { options: poseOptions,  loading: loadingPose  } = useDictOptions('POSTURE');
```

**默认值兜底**(关键 — hook 初始化时字典尚未加载完成,options 为空数组):

```ts
// 在 CreateImageTask 组件内,父级从 useCreateImageTaskState() 解构 style / setStyle 后追加
useEffect(() => {
  if (!loadingStyle && styleOptions.length > 0 && !style) {
    setStyle(styleOptions[0].value);
  }
}, [styleOptions, loadingStyle, style, setStyle]);
// scene / pose 同理 2 个 useEffect(deps 替换为对应局部变量)
```

> 注:`setStyle` 是 `useCallback` 包出来的引用稳定,可安全放 deps(不引起循环)。
> `style` 必须放 deps,否则用户主动清空 select 后,字典再刷新会"重置"回首个。

**Props 透传**(原 line 355-364 处):

```tsx
<StyleScenePoseRow
  styleOptions={styleOptions}
  sceneOptions={sceneOptions}
  poseOptions={poseOptions}
  loadingStyle={loadingStyle}
  loadingScene={loadingScene}
  loadingPose={loadingPose}
  style={style}
  scene={scene}
  pose={pose}
  onStyleChange={setStyle}
  onSceneChange={setScene}
  onPoseChange={setPose}
/>
```

### 4.3 hook 默认值与草稿 key 升级: `useCreateImageTaskState.ts`

**默认值由 messages → 空字符串**(等父级 useEffect 异步注入):

```ts
// 原来
const [style, setStyle] = useState<string>(messages.styleOptions[0]);
const [scene, setScene] = useState<string>(messages.sceneOptions[0]);
const [pose,  setPose]  = useState<string>(messages.poseOptions[0]);
// 现在
const [style, setStyle] = useState<string>('');
const [scene, setScene] = useState<string>('');
const [pose,  setPose]  = useState<string>('');
```

**草稿 key 升级** `v2 → v3`(旧草稿自动失效,与用户确认不需要兼容):

```ts
const DRAFT_KEY = 'create-image-task-draft-v3';
```

**草稿恢复过滤**(原有逻辑已经做 `if (data.style) setStyle(data.style)`,空串不入,不动)。

**messages import 处理**:

- hook 还在用 `messages.assistant.timeout / complete` 等(第 495 / 534 行),**import 保留**
- 仅删 `useState<string>(messages.styleOptions[0])` 等 3 行对 messages 数组的引用

### 4.4 删 mock: `labels/createImageTask.ts`

删除以下内容(grep 全项目确认仅 StyleScenePoseRow 和 useCreateImageTaskState 两处引用):

- `styleOptions` 数组
- `sceneOptions` 数组
- `poseOptions` 数组
- `StyleOption` / `SceneOption` / `PoseOption` 三个 derived 类型导出

`messages` 对象其它字段(readiness / assistant / facts / type / template / refSlot / presetPlatforms / ...)保留不动。

## 5. 数据流

```
进入 CreateImageTask 页面
  ↓
父级 useDictOptions('STYLE' / 'SCENE' / 'POSTURE') 触发 3 次 dictApi.listItemsByCode
  ↓
useServiceQuery → 响应 → toDictOptions 过滤 NORMAL + sort 排序
  ↓
options 通过 props 下传给 StyleScenePoseRow
  ↓
StyleScenePoseRow 渲染 <option>(value=itemName, label=itemName)
  ↓
用户切换 → onChange → 父级 state.setStyle / setScene / setPose
  ↓
hook 内 style/scene/pose 变化 → buildPromptFromFacts 重算 prompts
  ↓
提交时透传到 ImageTaskSubmitPayload(由 GenerationTaskServiceImpl 写入 task.style / task.scene)
```

## 6. 错误处理

| 场景 | UI 行为 | 副作用 |
|---|---|---|
| 拉取中 | select disabled + "加载中…" | 无 |
| 字典项为空(0 项 / 全 DISABLED) | select disabled + "暂无数据,请联系管理员" | prompt 拼接走空串,用户无法提交(因 readinessChecks 会拦截) |
| 接口失败(网络/500) | select 显示"暂无数据…"占位 + 拦截器 toast | hook 内 style/scene/pose 保留旧值(不主动清),等下次刷新恢复 |
| 草稿恢复时旧值不在新字典 | 同上 select 失配处理(渲染"已不在字典中"option) | 用户需手动改;或下拉重选首个 |

## 7. 改动文件清单

| 文件 | 改动 |
|---|---|
| `src/components/CreateImageTask/center/StyleScenePoseRow.tsx` | 重写:接 DictOption[] + loading props,加 disabled / 占位 / 失配保护 |
| `src/components/CreateImageTask/CreateImageTask.tsx` | 新增 3 个 useDictOptions + 3 个 useEffect 兜底,透传 props |
| `src/hooks/useCreateImageTaskState.ts` | 删 3 行 `messages.*Options[0]`,改为空串;`DRAFT_KEY` v2→v3;删 messages import(如全无用) |
| `src/labels/createImageTask.ts` | 删 `styleOptions` / `sceneOptions` / `poseOptions` 数组 + 3 个 derived type |

不改:`api/modules/dict.ts`、`api/hooks/useDict.ts`、`api/hooks/useServiceQuery.ts`、`buildPromptFromFacts.ts`、
`buildSubmitPayload.ts`、提交 payload 字段、GenerationTaskServiceImpl(后端)。

## 8. 测试 / 验证

本期项目处于"mock → real"过渡阶段,前端**不强制单测**(见 `EC-AIGC/AGENTS.md` §测试),用 `npm run lint`
(纯 `tsc --noEmit`) 验证类型 + 手工冒烟验证。

**手工冒烟清单**:

1. 后端字典 3 个分类均有 ≥3 个 NORMAL 项 → 进创建页,3 个 select 渲染正常,默认值取首项
2. 把后端某个字典项置为 DISABLED → 刷新页面,该选项消失(被 `toDictOptions` 过滤)
3. 把后端 STYLE 分类下所有项 DISABLED → 进创建页,style select 显示"暂无数据…",scene/pose 仍可用
4. 后端 /v1/admin/dict/item/list-by-code 端点人为 500 → 拦截器 toast,select 显示"暂无数据…",旧草稿恢复时旧值仍渲染为"已不在字典中"
5. 提交一个任务,后端 `task.style / task.scene / task.pose` 写入为字典 itemName(中文) — 数据库直接查询确认
6. 旧版本(v2 草稿 key)sessionStorage 数据不恢复(`DRAFT_KEY` 已升级)

## 9. 风险与权衡

| 风险 | 缓解 |
|---|---|
| 字典项 value = itemName 提交到后端是中文,后端无强校验,字典管理可改中文导致 prompt 拼接语义漂移 | 本期接受;后续若需强校验可加 itemCode 双字段模式 |
| 3 次 useDictOptions = 3 次接口调用(useServiceQuery 当前无 dedup) | 字典量小(<100 项/分类),< 1s;待 TanStack Query 引入时统一缓存 |
| 草稿 v2 → v3 切,旧编辑未提交的草稿丢失 | 用户确认不需要兼容,文档明示 |
| 父级 useEffect 兜底默认值与"用户主动清空 select"在视觉上区分不开 | select value='空串' 与 value='itemName' 视觉一致;短期可接受 |

## 10. 后续可演进点(本期不做)

- 字典项 value 改为 `{ code, name }` 双字段,提交用 code
- 引入 TanStack Query 全局缓存,3 个 useDictOptions 合并为 1 次请求
- 字典变更实时推送(WebSocket / SSE) → 自动 invalidate
