### Task 2: Enums (`EnumTaskAssetSlot`, `EnumImageTaskType`)

**Files:**
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/task/EnumTaskAssetSlot.java`
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/task/EnumImageTaskType.java`

**Interfaces:**
- Consumes: existing `EnumUtils` from Hutool (already imported across project)
- Produces:
  - `EnumTaskAssetSlot` with 6 values, `describe` field, `ofName(String)`, `priority()` int method
  - `EnumImageTaskType` with 4 values + `describe`

- [ ] **Step 1: Create `EnumTaskAssetSlot`**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/task/EnumTaskAssetSlot.java`:

```java
package com.dafenqi.ai.common.enums.task;

import cn.hutool.core.util.EnumUtil;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 任务资源槽位角色(主体 + 5 类参考图)
 *
 * @author system
 * @date 2026-07-24
 */
@Getter
@AllArgsConstructor
public enum EnumTaskAssetSlot {
    MAIN("主体素材", 0),
    REFERENCE_DETAIL("参考-细节", 10),
    REFERENCE_STYLE("参考-风格", 20),
    REFERENCE_SCENE("参考-场景", 30),
    REFERENCE_POSE("参考-动作", 40),
    REFERENCE_MODEL("参考-模特", 50);

    @Getter
    private final String describe;

    /**
     * 用于 Vidu images[] 内拼接优先级:数值越小越靠前。
     * 注意:priority 字段不是 enum name,需要在构造器额外传入。
     */
    @Getter
    private final int priority;

    /**
     * 根据 name 解析,找不到返回 null(上层抛错)。
     */
    public static EnumTaskAssetSlot ofName(String name) {
        return EnumUtil.getByName(EnumTaskAssetSlot.class, name);
    }
}
```

> **Note on `describe` + `priority`:** The project standard is `@Getter @AllArgsConstructor` with field named `describe`. We extend the constructor to also accept `priority` — Lombok's `@AllArgsConstructor` generates a constructor with **all** fields in declaration order, so adding `priority` as a second arg keeps the pattern valid.

- [ ] **Step 2: Create `EnumImageTaskType`**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/task/EnumImageTaskType.java`:

```java
package com.dafenqi.ai.common.enums.task;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 图片任务类型(与前端 ImageGenerationType 一一对应)
 *
 * @author system
 * @date 2026-07-24
 */
@Getter
@AllArgsConstructor
public enum EnumImageTaskType {
    PRODUCT_MAIN("商品主图"),
    SCENE_DETAIL("场景图"),
    DETAIL_CLOSEUP("细节图"),
    ON_MODEL("三视图");

    @Getter
    private final String describe;
}
```

- [ ] **Step 3: Verify compile**

In IDE: Build → Rebuild Project. Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/task/EnumTaskAssetSlot.java \
        dafenqi-ai/src/main/java/com/dafenqi/ai/common/enums/task/EnumImageTaskType.java
git commit -m "feat(image-task): add EnumTaskAssetSlot + EnumImageTaskType"
```

---

