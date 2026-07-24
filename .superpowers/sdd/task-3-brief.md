### Task 3: `GenerationTaskAssetRelationDO` + Mapper

**Files:**
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/dao/defaults/entity/task/GenerationTaskAssetRelationDO.java`
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/dao/defaults/mapper/task/GenerationTaskAssetRelationMapper.java`

**Interfaces:**
- Consumes: `com.dafenqi.ai.dao.defaults.entity.BaseDO`
- Produces:
  - `GenerationTaskAssetRelationDO` with fields: `taskId`, `assetId`, `slotRole` (String, stores enum name), `sortOrder`
  - `GenerationTaskAssetRelationMapper extends BaseMapper<GenerationTaskAssetRelationDO>`

- [ ] **Step 1: Create the DO**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/dao/defaults/entity/task/GenerationTaskAssetRelationDO.java`:

```java
package com.dafenqi.ai.dao.defaults.entity.task;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dafenqi.ai.dao.defaults.entity.BaseDO;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;
import java.io.Serializable;

/**
 * 任务-资源 多对多关联表(主/参考角色与顺序)
 *
 * @author system
 * @date 2026-07-24
 */
@EqualsAndHashCode(callSuper = true)
@TableName(value = "generation_task_asset_relation")
@Data
public class GenerationTaskAssetRelationDO extends BaseDO implements Serializable {

    @Serial
    @TableField(exist = false)
    private static final long serialVersionUID = 1L;

    /** generation_task.id */
    @TableField(value = "task_id")
    private Long taskId;

    /** asset_resource.id */
    @TableField(value = "asset_id")
    private Long assetId;

    /** EnumTaskAssetSlot.name(): MAIN / REFERENCE_* */
    @TableField(value = "slot_role")
    private String slotRole;

    /** slot_role 内的排序(升序) */
    @TableField(value = "sort_order")
    private Integer sortOrder;
}
```

- [ ] **Step 2: Create the Mapper**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/dao/defaults/mapper/task/GenerationTaskAssetRelationMapper.java`:

```java
package com.dafenqi.ai.dao.defaults.mapper.task;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dafenqi.ai.dao.defaults.entity.task.GenerationTaskAssetRelationDO;
import org.apache.ibatis.annotations.Mapper;

/**
 * @author system
 * @date 2026-07-24
 */
@Mapper
public interface GenerationTaskAssetRelationMapper extends BaseMapper<GenerationTaskAssetRelationDO> {
}
```

- [ ] **Step 3: Verify compile**

In IDE: Build → Rebuild Project. Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add dafenqi-ai/src/main/java/com/dafenqi/ai/dao/defaults/entity/task/GenerationTaskAssetRelationDO.java \
        dafenqi-ai/src/main/java/com/dafenqi/ai/dao/defaults/mapper/task/GenerationTaskAssetRelationMapper.java
git commit -m "feat(image-task): add GenerationTaskAssetRelationDO + Mapper"
```

---

