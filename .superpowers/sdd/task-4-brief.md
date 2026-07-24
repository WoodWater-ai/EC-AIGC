### Task 4: `IGenerationTaskAssetRelationDepository` + Impl

**Files:**
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/manager/depository/task/IGenerationTaskAssetRelationDepository.java`
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/manager/depository/task/impl/GenerationTaskAssetRelationDepositoryImpl.java`

**Interfaces:**
- Consumes: `GenerationTaskAssetRelationMapper`, `GenerationTaskAssetRelationDO`, MyBatis-Plus `LambdaQueryWrapper`
- Produces:
  - `void batchInsert(List<GenerationTaskAssetRelationDO> records)` — wraps MP `insertBatch`
  - `List<GenerationTaskAssetRelationDO> listByTaskId(Long taskId)` — orders by slot_role enum priority, then sortOrder asc
  - `List<GenerationTaskAssetRelationDO> listByAssetId(Long assetId)` — orders by task_id desc, slot_role asc

- [ ] **Step 1: Create the interface**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/manager/depository/task/IGenerationTaskAssetRelationDepository.java`:

```java
package com.dafenqi.ai.manager.depository.task;

import com.dafenqi.ai.dao.defaults.entity.task.GenerationTaskAssetRelationDO;

import java.util.List;

/**
 * 任务-资源关联 仓储接口
 *
 * @author system
 * @date 2026-07-24
 */
public interface IGenerationTaskAssetRelationDepository {

    /**
     * 批量插入。底层走 MyBatis-Plus insertBatch,适合单任务 ≤ 50 条的场景。
     */
    void batchInsert(List<GenerationTaskAssetRelationDO> records);

    /**
     * 列出某任务下的全部资源,顺序为:
     * 1) slot_role.priority() 升序(MAIN 在最前)
     * 2) sort_order 升序
     * 该顺序即 Vidu images:[] 的填入顺序。
     */
    List<GenerationTaskAssetRelationDO> listByTaskId(Long taskId);

    /**
     * 反向查询:某资产被哪些任务引用,按 task_id 降序。
     */
    List<GenerationTaskAssetRelationDO> listByAssetId(Long assetId);
}
```

- [ ] **Step 2: Create the impl**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/manager/depository/task/impl/GenerationTaskAssetRelationDepositoryImpl.java`:

```java
package com.dafenqi.ai.manager.depository.task.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dafenqi.ai.common.enums.task.EnumTaskAssetSlot;
import com.dafenqi.ai.dao.defaults.entity.task.GenerationTaskAssetRelationDO;
import com.dafenqi.ai.dao.defaults.mapper.task.GenerationTaskAssetRelationMapper;
import com.dafenqi.ai.manager.depository.task.IGenerationTaskAssetRelationDepository;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;

/**
 * @author system
 * @date 2026-07-24
 */
@Repository
public class GenerationTaskAssetRelationDepositoryImpl
        implements IGenerationTaskAssetRelationDepository {

    @Resource
    private GenerationTaskAssetRelationMapper mapper;

    @Override
    public void batchInsert(List<GenerationTaskAssetRelationDO> records) {
        if (records == null || records.isEmpty()) return;
        mapper.insertBatch(records);
    }

    @Override
    public List<GenerationTaskAssetRelationDO> listByTaskId(Long taskId) {
        LambdaQueryWrapper<GenerationTaskAssetRelationDO> w = new LambdaQueryWrapper<>();
        w.eq(GenerationTaskAssetRelationDO::getTaskId, taskId);
        List<GenerationTaskAssetRelationDO> list = mapper.selectList(w);
        // 排序:先 slot_role.priority() 升序,再 sort_order 升序
        // 不要在 wrapper 里用 orderByAsc(slot_role) — VARCHAR 字典序不是业务优先级
        list.sort(Comparator
                .comparingInt((GenerationTaskAssetRelationDO r) ->
                        EnumTaskAssetSlot.ofName(r.getSlotRole()).priority())
                .thenComparingInt(GenerationTaskAssetRelationDO::getSortOrder));
        return list;
    }

    @Override
    public List<GenerationTaskAssetRelationDO> listByAssetId(Long assetId) {
        LambdaQueryWrapper<GenerationTaskAssetRelationDO> w = new LambdaQueryWrapper<>();
        w.eq(GenerationTaskAssetRelationDO::getAssetId, assetId);
        w.orderByDesc(GenerationTaskAssetRelationDO::getTaskId);
        return mapper.selectList(w);
    }
}
```

- [ ] **Step 3: Verify compile**

In IDE: Build → Rebuild Project. Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add dafenqi-ai/src/main/java/com/dafenqi/ai/manager/depository/task/IGenerationTaskAssetRelationDepository.java \
        dafenqi-ai/src/main/java/com/dafenqi/ai/manager/depository/task/impl/GenerationTaskAssetRelationDepositoryImpl.java
git commit -m "feat(image-task): add relation depository (batchInsert, listByTaskId, listByAssetId)"
```

---

