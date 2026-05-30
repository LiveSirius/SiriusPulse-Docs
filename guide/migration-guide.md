# 迁移指南：从旧版数据库迁移到统一数据库

## 1. 概述

新版系统引入了统一的数据库架构，将原先分散在多个数据库（`memory.db`、`token_usage.db`、`cognition_events.db`、会话目录下的 `session_state.db`）中的所有数据整合到单个 `persona.db` 文件中。本指南介绍了如何通过提供的迁移脚本将旧版数据迁移至新版结构。

迁移脚本位于 `scripts/migrate_to_unified_db.py`，同时旧版迁移脚本 `scripts/migrate_to_sqlite.py` 也进行了更新以支持新增的表结构。

## 2. 迁移内容

### 2.1 合并的数据库

| 旧数据库文件 | 迁移后存储位置 | 说明 |
|--------------|----------------|------|
| `memory.db` | `persona.db` | 用户数据、别名、语义画像、响应记录等 |
| `token/token_usage.db` | `persona.db` | Token 用量记录 |
| `cognition_events.db` | `persona.db` | 认知事件、决策事件 |
| `sessions/*/session_state.db` | `persona.db` | 各会话的状态、消息、运行时数据 |

### 2.2 新增的表结构

在 `group_semantic_profiles` 表中新增了以下字段以增强群组画像：
- `group_name`：群组名称
- `interest_topics`：兴趣话题（JSON 数组）
- `group_norms`：群组规范（JSON 对象）
- `taboo_topics`：禁忌话题（JSON 数组）
- `dominant_topic`：主导话题

此外，新增了以下两个表记录群组氛围和 AI 响应：
- `atmosphere_history`：群组氛围历史记录（情感效价、唤醒度、活跃参与者等）
- `group_pending_ai_responses`：群组中待处理的 AI 回复记录（发送时间、目标用户、话题提示、响应长度、是否已互动、互动延迟等）

## 3. 迁移前提条件

- 确保系统已升级至支持统一数据库的版本（包含新表结构）。
- 备份所有旧数据库文件（迁移脚本默认会移动旧文件到 `migrated_backup` 目录）。
- 停止所有正在运行的服务，避免数据写入冲突。
- 确保 Python 3.8+ 环境可用，且已安装所需的 SQLite3 模块（内置）。

## 4. 迁移步骤

### 4.1 识别人格目录

每个人格的数据目录通常位于 `data/personas/<persona_name>/`。请找到目标人格的路径。

### 4.2 执行统一迁移脚本

使用提供的迁移脚本 `migrate_to_unified_db.py`。命令格式如下：

```bash
python scripts/migrate_to_unified_db.py <persona_path>
```

示例：

```bash
python scripts/migrate_to_unified_db.py data/personas/sirius
```

脚本会自动完成以下操作：
1. 连接到或创建 `persona.db`。
2. 创建必要的元数据表（`_meta`）并记录迁移状态。
3. 依次迁移 `memory.db`、`token/token_usage.db`、`cognition_events.db`、以及其他会话数据库。
4. 对于每个会话目录下的 `session_state.db`，添加 `session_id` 列后迁移数据。
5. 将旧的数据库文件移动到 `migrated_backup` 目录（如果启用备份）。

### 4.3 验证迁移结果

迁移完成后，检查 `persona.db` 是否包含所有预期的表和数据。可以通过 SQLite 命令行工具或脚本查询：

```bash
sqlite3 data/personas/sirius/persona.db ".tables"
```

应包含以下表（及其他）：
`users`, `user_identities`, `group_members`, `aliases`, `semantic_profiles`, `response_records`, `group_semantic_profiles`, `atmosphere_history`, `group_pending_ai_responses`，以及 `_meta` 表中的版本信息。

同时检查备份目录 `migrated_backup` 中是否包含了移动后的旧文件。

### 4.4 更新配置

检查系统配置文件中数据库路径的相关设置。如果原配置指向独立的旧数据库文件（如 `memory.db`），应更新为指向统一的 `persona.db`。通常配置位于应用程序的配置模块（例如 `config.yaml` 或环境变量）。

## 5. 故障排除

### 5.1 迁移脚本失败

- 检查日志输出：脚本使用 `logging` 模块，默认输出到 stderr。可查看具体错误信息，如表不存在、主键冲突等。
- 确保源数据库文件未被其他进程锁定。
- 如果某个表迁移失败，脚本会记录警告并继续下一个表，不会影响已迁移的数据。

### 5.2 数据不一致

- 迁移完成后，可以手工检查关键表（如 `users`）的行数与旧数据库是否一致。
- 如果发现数据丢失，可从备份目录恢复旧数据库并再次尝试迁移（需先删除 `persona.db` 或清理已迁移的数据）。

### 5.3 旧版迁移脚本的兼容性

旧版迁移脚本 `migrate_to_sqlite.py` 已更新以包含新表（`atmosphere_history` 和 `group_pending_ai_responses`）。如果从更早期版本迁移，请先运行 `migrate_to_sqlite.py` 创建新表结构，再运行统一的迁移脚本。

## 6. 回滚方案

如果迁移后需要回退到旧版，请按以下步骤操作：
1. 停止服务。
2. 从 `migrated_backup` 目录恢复旧数据库文件到原始路径。
3. 删除 `persona.db` 文件（或重命名）。
4. 确保配置中数据库路径指向旧文件。
5. 重新启动服务。

> 注意：如果迁移后系统已经运行并产生了新数据，回滚将导致这些新数据丢失。建议在迁移前做好完整备份。

## 7. 附录：迁移脚本详解

#### `migrate_to_unified_db.py` 主要函数

| 函数 | 说明 |
|------|------|
| `migrate_persona(persona_path, backup=True)` | 入口函数，执行整个人格的迁移，包括所有子数据库 |
| `_migrate_memory_db(...)` | 迁移 `memory.db` 中的表（`_MEMORY_TABLES` 列表定义） |
| `_migrate_token_db(...)` | 迁移 `token_usage.db` 中的表，并记录 `token_schema_version` |
| `_migrate_cognition_db(...)` | 迁移 `cognition_events.db` 中的表，并记录 `cognition_schema_version` |
| `_migrate_session_db(...)` | 遍历 `sessions/` 目录下的每个会话子目录，调用 `_migrate_session_table` 迁移表 |
| `_migrate_table_data(...)` | 通用表数据迁移，自动匹配源表和目标表共同的列，支持添加额外默认值 |
| `_migrate_session_table(...)` | 专门用于会话表的迁移，额外添加 `session_id` 列 |

#### 备份机制

迁移脚本支持 `backup` 参数（默认 `True`）。启用后，每个旧数据库文件会被重命名为 `migrated_backup/` 目录下对应路径的文件，例如：
- `memory.db` → `migrated_backup/memory.db`
- `token/token_usage.db` → `migrated_backup/token_usage.db`
- `cognition_events.db` → `migrated_backup/cognition_events.db`
- `sessions/<id>/session_state.db` → `migrated_backup/sessions/<id>/session_state.db`

## 8. 历史变更

- 2024-01-22: 新增 `group_semantic_profiles` 字段（`group_name`, `interest_topics` 等）以及 `atmosphere_history` 和 `group_pending_ai_responses` 表。
- 2024-01-30: 发布统一迁移脚本 `migrate_to_unified_db.py`。