## Task 1: 加测试依赖与约定(零新增 npm 依赖)

**Files:**
- 不创建
- Modify: `package.json`(不改任何字段,只是确认 `tsx` 与 `tsx --test` 可用)
- Create: `src/lib/createImageTask/__tests__/.gitkeep`(空文件用于占目录)

**Interfaces:**
- 无

- [ ] **Step 1: 验证 tsx --test 可用**

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
node -e "console.log(require('tsx/package.json').version)"
```

预期输出:`4.x.x` 之类(项目已装 `tsx: ^4.21.0`)

- [ ] **Step 2: 占位测试文件,确认 1 个测试能跑**

Create `src/lib/createImageTask/__tests__/smoke.test.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

test('smoke', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: 跑测试,确认绿**

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
npm run test
```

预期:`tests 1` / `pass 1` / `fail 0`(脚本是 `tsx --test "src/**/*.test.ts"`,会拣到 `smoke.test.ts`)

- [ ] **Step 4: 删除 smoke 测试 + 占位 gitkeep**

Delete `src/lib/createImageTask/__tests__/smoke.test.ts` 与 `src/lib/createImageTask/__tests__/.gitkeep`

- [ ] **Step 5: 不需 commit(基础设置)**

> 此任务不需 commit;只是确认测试环境就绪。后续任务才有 commit。

---

