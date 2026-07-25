# Style / Scene / Pose 字典化改造 — 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框(`- [ ]`)语法来跟踪进度。

**目标:** 把"创建图片任务"页面的"风格 / 场景 / 姿势"三个下拉选择器从写死 mock 改为后端字典实时拉取,字典变更无须前端发版。

**架构:** 复用已有 `useDictOptions('CATEGORY_CODE')` hook(TemplateCenter 已在用)+ `dictApi.listItemsByCode(code)` 端点。父级 `CreateImageTask.tsx` 拉 3 次字典,透传给 `StyleScenePoseRow`;`useCreateImageTaskState` 改为空串初始化,默认值由父级 useEffect 异步兜底;草稿 key v2→v3,旧草稿失效。删除 `labels/createImageTask.ts` 的 3 个 mock 数组。

**技术栈:** React 19 + TypeScript 5.8 + Tailwind 4 + `useServiceQuery` + `useDictOptions`(对齐 TanStack Query 形状)

**前置依赖:** 后端字典管理(`dafenqi-ai`)已建好 `STYLE` / `SCENE` / `POSTURE` 3 个 categoryCode 及字典项,本计划不涉及后端改动。

**纪律(来自用户偏好,所有任务遵守):**
- mvn / git commit / DB DDL 一律由用户手工执行,agent 只改文件并在每任务末尾提示 commit 信息
- 不写单测(项目处于 mock → real 过渡期,`EC-AIGC/AGENTS.md` §测试明示)
- 每个文件改动完成后用 `npm run lint` 验证类型
- 不改后端代码

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `EC-AIGC/src/components/CreateImageTask/center/StyleScenePoseRow.tsx` | 修改 | 重写 Props,接 DictOption[] + loading,加 disabled / 占位 / 失配保护 |
| `EC-AIGC/src/components/CreateImageTask/CreateImageTask.tsx` | 修改 | 加 3 个 useDictOptions + 3 个 useEffect 兜底,透传 props |
| `EC-AIGC/src/hooks/useCreateImageTaskState.ts` | 修改 | 删 3 行 messages 引用,默认值空串,DRAFT_KEY v2→v3 |
| `EC-AIGC/src/labels/createImageTask.ts` | 修改 | 删 3 个 mock 数组 + 3 个 derived type |
| `EC-AIGC/docs/superpowers/specs/2026-07-25-style-scene-pose-dict-design.md` | 已存在(引用) | 设计文档,本计划遵循之 |

---

## 任务 1:重写 `StyleScenePoseRow` 组件

**文件:**
- 修改:`EC-AIGC/src/components/CreateImageTask/center/StyleScenePoseRow.tsx`(全文重写,38 行 → ~75 行)

- [ ] **步骤 1:读现有文件,确认 Props 现状**

读 `StyleScenePoseRow.tsx`(38 行,见设计文档 §3)。
预期:确认现有 Props 名称为 `style / scene / pose / onStyleChange / onSceneChange / onPoseChange` 全部为 string。

- [ ] **步骤 2:用 Edit 工具替换 import 行**

`old_string`:
```ts
import React from 'react';
import { messages } from '../../../labels/createImageTask';
```

`new_string`:
```ts
import React from 'react';
import type { DictOption } from '../../../api/modules/dict';
```

- [ ] **步骤 3:替换 Props interface**

`old_string`:
```ts
export interface StyleScenePoseRowProps {
  style: string; scene: string; pose: string;
  onStyleChange: (v: string) => void;
  onSceneChange: (v: string) => void;
  onPoseChange: (v: string) => void;
}
```

`new_string`:
```ts
export interface StyleScenePoseRowProps {
  // 数据
  styleOptions: DictOption[];
  sceneOptions: DictOption[];
  poseOptions:  DictOption[];
  // 加载态(来自 useDictOptions.loading)
  loadingStyle?: boolean;
  loadingScene?: boolean;
  loadingPose?:  boolean;
  // 值与变更
  style: string; scene: string; pose: string;
  onStyleChange: (v: string) => void;
  onSceneChange: (v: string) => void;
  onPoseChange:  (v: string) => void;
}
```

- [ ] **步骤 4:提取共用渲染逻辑到内部 `renderSelect` 工具函数**

为避免 3 处重复,定义内部辅助函数(放在 component 之前):

```ts
function renderSelect(opts: {
  label: string;
  value: string;
  options: DictOption[];
  loading?: boolean;
  onChange: (v: string) => void;
}) {
  const { label, value, options, loading, onChange } = opts;
  const isEmpty = !loading && options.length === 0;
  const disabled = loading || isEmpty;
  // 防御:草稿恢复时旧值不在新字典,保留用户已选不让 select 跳空
  const valueInOptions = options.some((o) => o.value === value);
  const placeholder = loading
    ? '加载中…'
    : isEmpty
      ? '暂无数据,请联系管理员'
      : null;

  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <select
        className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-bold disabled:bg-slate-50 disabled:text-slate-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {value && !valueInOptions && (
          <option value={value}>{value} (已不在字典中)</option>
        )}
        {options.map((opt) => (
          <option key={opt.id} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **步骤 5:替换组件主体,使用 renderSelect**

`old_string`:
```tsx
export const StyleScenePoseRow: React.FC<StyleScenePoseRowProps> = ({
  style, scene, pose,
  onStyleChange, onSceneChange, onPoseChange,
}) => (
  <div className="grid md:grid-cols-3 gap-3">
    <label className="block">
      <span className="text-xs font-bold text-slate-700">风格</span>
      <select className={fieldClass} value={style} onChange={(e) => onStyleChange(e.target.value)}>
        {messages.styleOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="text-xs font-bold text-slate-700">场景</span>
      <select className={fieldClass} value={scene} onChange={(e) => onSceneChange(e.target.value)}>
        {messages.sceneOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="text-xs font-bold text-slate-700">姿势</span>
      <select className={fieldClass} value={pose} onChange={(e) => onPoseChange(e.target.value)}>
        {messages.poseOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
  </div>
);
```

`new_string`:
```tsx
export const StyleScenePoseRow: React.FC<StyleScenePoseRowProps> = ({
  styleOptions, sceneOptions, poseOptions,
  loadingStyle, loadingScene, loadingPose,
  style, scene, pose,
  onStyleChange, onSceneChange, onPoseChange,
}) => (
  <div className="grid md:grid-cols-3 gap-3">
    {renderSelect({ label: '风格', value: style, options: styleOptions, loading: loadingStyle, onChange: onStyleChange })}
    {renderSelect({ label: '场景', value: scene, options: sceneOptions, loading: loadingScene, onChange: onSceneChange })}
    {renderSelect({ label: '姿势', value: pose,  options: poseOptions,  loading: loadingPose,  onChange: onPoseChange })}
  </div>
);
```

- [ ] **步骤 6:删除未使用的 `fieldClass` 常量**

文件第 12 行的 `const fieldClass = 'mt-1.5 w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-bold';` 已不再被引用,删除该行。

- [ ] **步骤 7:运行 `npm run lint` 验证类型**

命令:在 `EC-AIGC/` 目录运行 `npm run lint`(用户手工执行)
预期:无 TypeScript 报错。若有错,通常是 import 路径或类型签名不一致,按报错修正。

- [ ] **步骤 8:commit(由用户手工执行)**

提示用户运行:
```bash
git add EC-AIGC/src/components/CreateImageTask/center/StyleScenePoseRow.tsx
git commit -m "refactor(EC-AIGC): StyleScenePoseRow 接 DictOption[] 替换写死 mock"
```

---

## 任务 2:父级 `CreateImageTask.tsx` 注入字典

**文件:**
- 修改:`EC-AIGC/src/components/CreateImageTask/CreateImageTask.tsx`(line 1-2 + line ~355 处)

- [ ] **步骤 1:加 `useDictOptions` import**

定位到 CreateImageTask.tsx 顶部 import 区(line 1-33)。在 `useCreateImageTaskState` 的 import 之后(line 31 后)插入:

```ts
import { useDictOptions } from '../../api/hooks/useDict';
```

- [ ] **步骤 2:在组件顶部加 3 个 useDictOptions 调用**

定位到组件 `useCreateImageTaskState` 调用之前(line 89 `useState<TaskParamsSnapshot>` 之前),插入:

```ts
// 风格/场景/姿势字典(从后端 dict 实时拉取)
const { options: styleOptions, loading: loadingStyle } = useDictOptions('STYLE');
const { options: sceneOptions, loading: loadingScene } = useDictOptions('SCENE');
const { options: poseOptions,  loading: loadingPose  } = useDictOptions('POSTURE');
```

- [ ] **步骤 3:加 3 个 useEffect 默认值兜底**

定位到 `const { ... style, scene, pose, setStyle, setScene, setPose, ... } = state;` 解构之后(line 152 之后),插入:

```tsx
// 字典加载完成后,若 hook 内 style/scene/pose 是空串,自动选 options[0]
// 让 select 不再停留在"暂无数据"占位态
useEffect(() => {
  if (!loadingStyle && styleOptions.length > 0 && !style) {
    setStyle(styleOptions[0].value);
  }
}, [styleOptions, loadingStyle, style, setStyle]);

useEffect(() => {
  if (!loadingScene && sceneOptions.length > 0 && !scene) {
    setScene(sceneOptions[0].value);
  }
}, [sceneOptions, loadingScene, scene, setScene]);

useEffect(() => {
  if (!loadingPose && poseOptions.length > 0 && !pose) {
    setPose(poseOptions[0].value);
  }
}, [poseOptions, loadingPose, pose, setPose]);
```

- [ ] **步骤 4:更新 StyleScenePoseRow 渲染(line 355)**

`old_string`(仅 props 部分,需精确匹配 line 355-364):
```tsx
            <StyleScenePoseRow
              style={style}
              scene={scene}
              pose={pose}
              onStyleChange={setStyle}
              onSceneChange={setScene}
              onPoseChange={setPose}
            />
```

`new_string`:
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

- [ ] **步骤 5:运行 `npm run lint` 验证类型**

命令:`cd EC-AIGC && npm run lint`
预期:无 TS 报错。

- [ ] **步骤 6:commit(用户手工)**

```bash
git add EC-AIGC/src/components/CreateImageTask/CreateImageTask.tsx
git commit -m "feat(EC-AIGC): CreateImageTask 注入 STYLE/SCENE/POSTURE 字典 + 默认值兜底"
```

---

## 任务 3:hook 默认值与草稿 key 升级

**文件:**
- 修改:`EC-AIGC/src/hooks/useCreateImageTaskState.ts`

- [ ] **步骤 1:改 DRAFT_KEY 常量 v2 → v3**

定位到 line 180:
```ts
const DRAFT_KEY = 'create-image-task-draft-v2';
```

替换为:
```ts
const DRAFT_KEY = 'create-image-task-draft-v3';
```

- [ ] **步骤 2:改 3 个 useState 默认值 messages → 空串**

定位到 line 207-209:
```ts
  const [style, setStyle] = useState<string>(messages.styleOptions[0]);
  const [scene, setScene] = useState<string>(messages.sceneOptions[0]);
  const [pose, setPose] = useState<string>(messages.poseOptions[0]);
```

替换为:
```ts
  const [style, setStyle] = useState<string>('');
  const [scene, setScene] = useState<string>('');
  const [pose, setPose] = useState<string>('');
```

- [ ] **步骤 3:运行 `npm run lint` 验证类型**

预期:TypeScript 报错"messages.styleOptions 已不存在"或"messages 上找不到 styleOptions"。

这是预期的中间态,不要慌。报错来自第 4 步删除 `labels/createImageTask.ts` 的 mock 数组后,这里的引用就消失了。继续下一步。

- [ ] **步骤 4:删除 hook 中残留的 messages 引用(若 lint 报)**

如果第 3 步 lint 报错指向本文件,定位到所有 `messages.*` 引用,只保留 `messages.assistant.*` 系列(timeout / complete / processing 等),其它一律去掉。

grep 一下:`rg "messages\." EC-AIGC/src/hooks/useCreateImageTaskState.ts`
预期:只剩 `messages.assistant.timeout` 和 `messages.assistant.complete` 两处(line 495 和 534)。这两处保留,messages import 不动。

- [ ] **步骤 5:再次 `npm run lint`**

预期:无 TS 报错。

- [ ] **步骤 6:commit(用户手工)**

```bash
git add EC-AIGC/src/hooks/useCreateImageTaskState.ts
git commit -m "refactor(EC-AIGC): 移除 hook 写死 style/scene/pose 默认值,草稿 v2→v3"
```

---

## 任务 4:删除 `labels/createImageTask.ts` 的 mock

**文件:**
- 修改:`EC-AIGC/src/labels/createImageTask.ts`

- [ ] **步骤 1:grep 全项目确认无其它引用**

```bash
rg "styleOptions|sceneOptions|poseOptions|StyleOption|SceneOption|PoseOption" EC-AIGC/src
```

预期:仅本文件 + `StyleScenePoseRow.tsx` + `useCreateImageTaskState.ts` 引用,且前两个文件的任务 1/3 已清理完毕,本文件应是唯一剩余引用源。

若还有其它文件引用(除本文件外),先停下处理那些引用(很可能要把它们也升级到 DictOption 模式),再继续。

- [ ] **步骤 2:删除 styleOptions 数组**

定位到 line 57-59:
```ts
  styleOptions: [
    '甜美网红风', '极简北欧风', '科技赛博风', '金秋自然风', '奢华丝绸风',
  ] as const,
```

直接删除这 3 行(含 trailing 逗号)。

- [ ] **步骤 3:删除 sceneOptions 数组**

定位到 line 60-62:
```ts
  sceneOptions: [
    '自然影棚', '城市街景', '居家陈列',
  ] as const,
```

删除。

- [ ] **步骤 4:删除 poseOptions 数组**

定位到 line 63-65:
```ts
  poseOptions: [
    '自然站姿', '正面站姿', '轻松坐姿', '行走动态',
  ] as const,
```

删除。

- [ ] **步骤 5:删除 derived type 导出**

定位到文件末尾(line 114-116):
```ts
export type StyleOption = (typeof messages.styleOptions)[number];
export type SceneOption = (typeof messages.sceneOptions)[number];
export type PoseOption  = (typeof messages.poseOptions)[number];
```

删除这 3 行。

- [ ] **步骤 6:运行 `npm run lint` 验证类型**

命令:`cd EC-AIGC && npm run lint`
预期:无 TS 报错。若有 `Cannot find name 'styleOptions'` 之类,说明前序任务有遗漏,回到对应任务排查。

- [ ] **步骤 7:commit(用户手工)**

```bash
git add EC-AIGC/src/labels/createImageTask.ts
git commit -m "chore(EC-AIGC): 移除 style/scene/pose 写死 mock 数组,字典接管"
```

---

## 任务 5:手工冒烟验证

- [ ] **步骤 1:启动后端 + 前端 dev server(用户手工)**

后端:在 `dafenqi-ai/` 跑 Spring Boot 主类(或 IDE Run Config,带 `-Djasypt.encryptor.password=xxx`)
前端:`cd EC-AIGC && npm run dev`

- [ ] **步骤 2:验证正常态**

浏览器打开 http://localhost:3000,进仪表盘 → 创建图片任务。

预期:
- 风格 / 场景 / 姿势 3 个 select 正常渲染,选项是后端字典里的 itemName(中文)
- 默认值 = 每个分类的首项(字典 sort 升序的 itemName)

- [ ] **步骤 3:验证切换正常**

点开每个 select,切换到中间项。
预期:value 切换,select 显示新中文;hook 内部 `style` / `scene` / `pose` state 同步更新(可临时在控制台打 `useCreateImageTaskState` 调试,本期可跳过)。

- [ ] **步骤 4:验证 DISABLED 字典项不出现**

后端字典管理 → 把 `STYLE` 下的 `科技赛博风` 改为 DISABLED → 刷新创建图片任务页。
预期:风格 select 里看不到该项(被 `toDictOptions` 过滤)。

- [ ] **步骤 5:验证字典空态**

后端字典管理 → 把 `POSTURE` 下所有项都 DISABLED → 刷新创建图片任务页。
预期:姿势 select 显示"暂无数据,请联系管理员"占位 + 禁用;风格 / 场景仍可用。

- [ ] **步骤 6:验证提交透传**

回到正常态,填好其它必填项,提交一个图片任务。
然后在后端 DB 直接查:
```sql
SELECT style, scene, pose FROM generation_task ORDER BY id DESC LIMIT 1;
```
预期:`style / scene / pose` 3 列填入中文(字典 itemName),与前端 select 选项一致。

- [ ] **步骤 7:验证草稿 v2 失效**

浏览器 devtools → Application → Session Storage → 手动写一条旧版草稿:
```
Key: create-image-task-draft-v2
Value: {"style":"甜美网红风","scene":"自然影棚","pose":"自然站姿"}
```
刷新创建图片任务页。
预期:无"已恢复上次编辑"toast 提示(因为新代码只读 v3 key)。

- [ ] **步骤 8:验证草稿 v3 正常**

正常编辑一下,选择新的风格/场景/姿势,触发 autosave(800ms 节流)。
再刷新页面。
预期:看到"已恢复上次编辑"toast,3 个 select 保留用户上次选值。

- [ ] **步骤 9:commit(若有改动)**

如果冒烟过程中发现需要的小修,提一个 fix commit;无改动则跳过。

---

## 任务 6:文档 commit(收尾)

- [ ] **步骤 1:commit 设计文档(用户手工)**

```bash
git add EC-AIGC/docs/superpowers/specs/2026-07-25-style-scene-pose-dict-design.md
git add EC-AIGC/docs/superpowers/plans/2026-07-25-style-scene-pose-dict.md
git commit -m "docs(EC-AIGC): style/scene/pose 字典化设计 + 实现计划"
```

- [ ] **步骤 2:本地 push + 创建 PR(用户手工)**

(若走 PR 流程)推送分支,创建 PR,标题建议:
"feat(EC-AIGC): 创建图片任务 风格/场景/姿势 接后端字典管理"

---

## 自检(执行前我已内联完成)

**1. 规格覆盖度**(对照设计文档 §4-§6):

| 设计文档条款 | 对应任务 |
|---|---|
| §4.1 组件 Props 改造 | 任务 1 |
| §4.1 renderSelect 渲染规则 3 条 | 任务 1 步骤 4 |
| §4.2 useDictOptions 注入 | 任务 2 步骤 2 |
| §4.2 useEffect 默认值兜底 | 任务 2 步骤 3 |
| §4.2 透传 props | 任务 2 步骤 4 |
| §4.3 hook 默认值空串 | 任务 3 步骤 2 |
| §4.3 DRAFT_KEY v2→v3 | 任务 3 步骤 1 |
| §4.4 删 mock 数组 | 任务 4 步骤 2/3/4 |
| §4.4 删 derived type | 任务 4 步骤 5 |
| §6 错误处理 4 场景 | 任务 5 步骤 4/5/6 |
| §8 手工冒烟清单 6 项 | 任务 5 步骤 2-7 |

**2. 占位符扫描**:无"TODO"/"待定"/"适当"/"类似"等模糊词。

**3. 类型一致性**:
- `DictOption` 引用:§4.1 声明 import,任务 1 步骤 2 实际 import,任务 1 步骤 3 接口定义 — 一致
- `useDictOptions` 返回 `{ options, loading }`:任务 2 步骤 2 解构正确
- 草稿 key `create-image-task-draft-v3`:任务 3 步骤 1 字符串字面量与冒烟步骤 7/8 一致

**4. 范围检查**:聚焦 4 个文件改动,无扩散;后端 0 改动(已就绪)。
