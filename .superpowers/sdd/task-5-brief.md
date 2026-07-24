### Task 5: `ITaskDispatcher` Interface + Impl

**Files:**
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/dispatch/ITaskDispatcher.java`
- Create: `dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/dispatch/impl/TaskDispatcherImpl.java`

**Interfaces:**
- Consumes: existing `TaskWorker` at `dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/worker/TaskWorker.java`
- Produces:
  - `ITaskDispatcher.dispatch(Long taskId)` — single method abstraction
  - `TaskDispatcherImpl` — `@Service` Spring bean delegating to `TaskWorker.executeAsync`

- [ ] **Step 1: Read existing `TaskWorker` to confirm `executeAsync(Long)` signature**

Open `dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/worker/TaskWorker.java`. Find the public method signature. Expect: `public void executeAsync(Long taskId)`. If signature differs (e.g. `executeAsyncTask`), update the impl below to match the actual name.

- [ ] **Step 2: Create the interface**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/dispatch/ITaskDispatcher.java`:

```java
package com.dafenqi.ai.service.task.dispatch;

/**
 * 任务派发抽象:解耦 GenerationTaskService 与 TaskWorker,
 * 便于单测注入 mock,且为后续多种任务类型(视频、组合任务)预留扩展点。
 *
 * @author system
 * @date 2026-07-24
 */
public interface ITaskDispatcher {

    /**
     * 异步派发一个已入库的任务到执行通道。
     * 实现负责读取任务行、调用 channel invoker、更新任务状态。
     *
     * @param taskId generation_task.id
     */
    void dispatch(Long taskId);
}
```

- [ ] **Step 3: Create the default impl**

Create `dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/dispatch/impl/TaskDispatcherImpl.java`:

```java
package com.dafenqi.ai.service.task.dispatch.impl;

import com.dafenqi.ai.service.task.dispatch.ITaskDispatcher;
import com.dafenqi.ai.service.task.worker.TaskWorker;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 默认派发实现:薄包装委托给现有 TaskWorker。
 *
 * @author system
 * @date 2026-07-24
 */
@Slf4j
@Service
public class TaskDispatcherImpl implements ITaskDispatcher {

    @Resource
    private TaskWorker taskWorker;

    @Override
    public void dispatch(Long taskId) {
        // TaskWorker.executeAsync 内部已经走异步派发(可能是 @Async 或线程池)
        // 这里只负责转发,不要再包一层 CompletableFuture(避免重复调度)
        taskWorker.executeAsync(taskId);
    }
}
```

> **Note:** The real async dispatch (e.g. `CompletableFuture.runAsync`) is done by `GenerationTaskServiceImpl` in Task 9 — this method is synchronous-from-caller's-POV but the worker itself may execute asynchronously.

- [ ] **Step 4: Verify compile**

In IDE: Build → Rebuild Project. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/dispatch/ITaskDispatcher.java \
        dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/dispatch/impl/TaskDispatcherImpl.java
git commit -m "feat(image-task): add ITaskDispatcher abstraction"
```

---

