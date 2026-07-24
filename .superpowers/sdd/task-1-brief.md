### Task 1: DDL + i18n

**Files:**
- Create: `dafenqi-ai/docs/sql/2026-07-24-image-task-refactor.sql`
- Modify: `dafenqi-ai/src/main/resources/i18n/messages_zh_CN.properties`
- Modify: `dafenqi-ai/src/main/resources/i18n/messages_en.properties`

**Interfaces:**
- Consumes: existing schema `product`, `generation_task` (defined in `dafenqi-ai/docs/sql/2026-07-18-product-crud.sql` and `prd_v2_entity_ddl_20260628.sql`)
- Produces:
  - Table `generation_task_asset_relation` with indexes `idx_task_id`, `idx_asset_id`, `idx_task_role_sort`
  - Column `product.category` (idempotent add)
  - Columns `generation_task.group_id / product_id / product_snapshot_json / image_type` + 3 indexes
  - i18n keys `task.asset.duplicate` and `task.channel.unsupported` in both locales

- [ ] **Step 1: Write the DDL file**

Create `dafenqi-ai/docs/sql/2026-07-24-image-task-refactor.sql`:

```sql
-- =====================================================================
-- 图片任务改造 DDL
-- 日期: 2026-07-24
-- 关联设计: docs/superpowers/specs/2026-07-24-image-task-product-refactor-design.md
-- 数据库: dafenqi_ai_local
-- 本文件可重复执行(均带存在性判断)
-- =====================================================================

USE `dafenqi_ai_local`;

-- ---------------------------------------------------------------
-- 1. 新表 generation_task_asset_relation (任务-资源 M:M)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `generation_task_asset_relation` (
    `id`             BIGINT(20) UNSIGNED NOT NULL                  COMMENT '主键(雪花ID)',
    `task_id`        BIGINT(20) UNSIGNED NOT NULL                  COMMENT 'generation_task.id',
    `asset_id`       BIGINT(20) UNSIGNED NOT NULL                  COMMENT 'asset_resource.id',
    `slot_role`      VARCHAR(32)         NOT NULL                  COMMENT 'MAIN / REFERENCE_DETAIL / REFERENCE_STYLE / REFERENCE_SCENE / REFERENCE_POSE / REFERENCE_MODEL',
    `sort_order`     INT(11)             NOT NULL DEFAULT 0        COMMENT '在 slot_role 内的排序',
    `is_delete`      CHAR(1)             NOT NULL DEFAULT 'N'     COMMENT '逻辑删除标记 Y/N',
    `create_by`      BIGINT(20) UNSIGNED DEFAULT NULL              COMMENT '创建者ID',
    `create_time`    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_by`      BIGINT(20) UNSIGNED DEFAULT NULL              COMMENT '修改者ID',
    `update_time`    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_asset_id` (`asset_id`),
    KEY `idx_task_role_sort` (`task_id`, `slot_role`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='任务-资源 多对多关联(主/参考角色与顺序)';

-- ---------------------------------------------------------------
-- 2. product 表补 category 列(幂等)
-- ---------------------------------------------------------------
SET @col_exists := (
    SELECT COUNT(1) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product'
      AND COLUMN_NAME = 'category'
);
SET @ddl := IF(@col_exists = 0,
    'ALTER TABLE `product` ADD COLUMN `category` VARCHAR(500) DEFAULT NULL COMMENT ''品类(自由文本,与产品分类体系无关)'' AFTER `color`',
    'SELECT ''product.category 已存在,跳过''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- 3. generation_task 表加 4 列 + 3 索引(幂等)
-- ---------------------------------------------------------------
SET @col_exists := (
    SELECT COUNT(1) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'generation_task'
      AND COLUMN_NAME = 'group_id'
);
SET @ddl := IF(@col_exists = 0,
    'ALTER TABLE `generation_task`
        ADD COLUMN `group_id`              VARCHAR(64)    DEFAULT NULL COMMENT ''同一提交多类型任务共享的组ID'' AFTER `id`,
        ADD COLUMN `product_id`            BIGINT(20) UNSIGNED DEFAULT NULL COMMENT ''关联产品ID(可空)'' AFTER `group_id`,
        ADD COLUMN `product_snapshot_json` LONGTEXT       DEFAULT NULL COMMENT ''提交时6字段商品快照(JSON)'' AFTER `product_id`,
        ADD COLUMN `image_type`            VARCHAR(32)    DEFAULT NULL COMMENT ''PRODUCT_MAIN / SCENE_DETAIL / DETAIL_CLOSEUP / ON_MODEL'' AFTER `task_type`,
        ADD KEY `idx_group_id`   (`group_id`),
        ADD KEY `idx_product_id` (`product_id`),
        ADD KEY `idx_image_type` (`image_type`)',
    'SELECT ''generation_task 新列已存在,跳过''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
```

- [ ] **Step 2: Apply DDL to local DB**

Run in IDE Database tool or:

```bash
mysql -u<user> -p dafenqi_ai_local < dafenqi-ai/docs/sql/2026-07-24-image-task-refactor.sql
```

Verify:
```sql
DESC generation_task_asset_relation;
-- expect 10 columns including is_delete, 3 indexes (idx_task_id, idx_asset_id, idx_task_role_sort)

SHOW COLUMNS FROM product LIKE 'category';
-- expect 1 row: category varchar(500) NULL

SHOW COLUMNS FROM generation_task LIKE 'group_id';
-- expect 1 row: group_id varchar(64) NULL

SHOW INDEX FROM generation_task WHERE Key_name IN ('idx_group_id','idx_product_id','idx_image_type');
-- expect 3 rows
```

- [ ] **Step 3: Add i18n key for asset-duplicate error (zh)**

Append to `dafenqi-ai/src/main/resources/i18n/messages_zh_CN.properties`:

```properties
task.asset.duplicate=资产在同一任务内不允许重复出现
task.channel.unsupported=本期仅支持 VIDU + REF_IMG_EDIT
```

- [ ] **Step 4: Add i18n key for asset-duplicate error (en)**

Append to `dafenqi-ai/src/main/resources/i18n/messages_en.properties`:

```properties
task.asset.duplicate=An asset cannot appear more than once within the same task
task.channel.unsupported=Only VIDU + REF_IMG_EDIT is supported in this release
```

- [ ] **Step 5: Verify compile**

In IDE: open `DafenqiAiApplication.java`, Build → Rebuild Project. Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add dafenqi-ai/docs/sql/2026-07-24-image-task-refactor.sql \
        dafenqi-ai/src/main/resources/i18n/messages_zh_CN.properties \
        dafenqi-ai/src/main/resources/i18n/messages_en.properties
git commit -m "feat(image-task): DDL for new M:M relation + product.category + generation_task 4 cols + i18n"
```

---

