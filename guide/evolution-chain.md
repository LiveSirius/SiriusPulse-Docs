# 记忆进化链（Evolution Chain）

记忆进化链是 SiriusPulse 的核心组件之一，负责追踪、管理和衰减 AI 对用户别称的记忆。它通过 `EvolutionChain` 类实现，结合持久化存储（`MemoryStorage`）和 WebUI 管理界面，为智能体提供动态、可纠错的别称知识库。

## 核心概念

### 记忆记录（Alias Record）
每条别称记忆对应一条记录，包含以下字段：
- `subject`：别称所属的实体（用户 ID）
- `subject_user_id`：用户标识
- `alias`：别称字符串
- `status`：记录状态，枚举值包括 `active`（活跃）、`shadow`（阴影）等
- `first_seen_at` 和 `last_seen_at`：首次和最后出现时间
- `source`：来源（如 `napcat`、`manual`）
- `created_at`：记录创建时间

### 状态机制
- **active**：活跃记录，参与召回，可被检索和匹配。
- **shadow**：阴影记录，不参与召回但保留可追溯性。通常用于用户手动标记错误别称后，保留错误信息以便审计。

### 时间衰减（Decay）
`EvolutionChain` 提供 `decay_alias_records` 方法，根据 `last_seen_at` 的时间戳，定期将长期未出现的别称标记为过期或移除。衰减逻辑可配置阈值（默认 7 天）。

## 核心功能

### 别称管理
- **添加别称**：通过 `mgr.register_alias()` 或存储层 `save_alias_entry()` 记录新别称。
- **标记阴影（Shadow）**：当用户手动纠正错误别称时，通过 `shadow_alias()` 方法将对应记录状态改为 `shadow`，同时从活跃索引中移除，并在记录中保留修正理由。
- **删除别称**：通过 `reject_alias()` 或存储层 `delete_alias_entry()` 完全移除记录。
- **查询别称**：支持按用户、按状态查询，如 `get_aliases_by_user(user_id, status='active')`。

### 缓存与索引
`EvolutionChain` 维护了内存缓存 `_alias_cache`（字典，键为小写别称）和 `_record_cache`（字典，键为记录 ID），以及 `_subject_index`（按 subject 分组）。`shadow` 操作会同步更新缓存和索引，确保一致性。

## 集成与配置

### PromptFactory 中的记忆规范（Memory Spec）
`PromptFactory.build_memory_spec_section()` 方法返回一段系统提示，强化模型在生成回复时的记忆约束：
- 不凭空捏造对他人事实。
- 可根据上下文推断事件，但需带可能性表述。

该 section 在 `Brain.build_system_prompt()` 中被注入到人格提示之后（优先级高于其他通用规范）。

### WebUI 管理界面
记忆进化链通过多个 WebUI 页面提供可视化操作：
- **别称索引列表**：`/api/personas/{name}/memory/alias-index` 返回当前活跃别称。
- **别称操作**：支持 `add`、`delete`、`shadow` 动作，通过 `api_persona_biography_alias_index_update` 接口处理。
- **记忆仪表盘**：`/api/personas/{name}/memory/dashboard` 展示统计概览。
- **演化记录**：`/api/personas/{name}/memory/evolution` 提供分页记录列表，支持消息内容预加载。

## API 参考

### 内部方法

```python
class EvolutionChain:
    def shadow_alias(self, alias: str, user_id: str) -> bool:
        """标记别称记录为 shadow 状态。"""
```

```python
class MemoryStorage:
    def shadow_alias_entry(self, alias: str, user_id: str) -> bool:
        """持久化标记别称状态为 shadow。"""

    def get_aliases_by_user(self, user_id: str, status: str = "active") -> list[dict]:
        """获取用户指定状态的别称列表。"""
```

### WebUI API（示例）

```http
PUT /api/personas/{name}/memory/alias-index
Content-Type: application/json

{
    "action": "shadow",
    "alias": "张三",
    "user_id": "user_abc123"
}
```

响应：
```json
{
    "success": true
}
```

## 数据库变更
`aliases` 表新增 `status` 字段（默认 `'active'`），用于区分记录状态。`shadow_alias_entry` 操作将 `status` 更新为 `'shadow'`。

## 使用建议
- 当用户反馈 AI 错误称呼时，通过 WebUI 调用 `shadow` 操作，而非直接删除，以保留修正记录。
- 定期执行 `decay_alias_records` 清理过时记忆，减少内存占用。
- 记忆规范已自动注入系统提示，无需手动配置。