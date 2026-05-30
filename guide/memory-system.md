# 记忆系统

Sirius Pulse 采用分层记忆架构，从短期的工作记忆到长期的语义理解，逐层抽象。

## 架构总览

```mermaid
flowchart TB
    A["Basic Memory<br>短期：最近 N 条对话<br>per-group"] -->|"超出窗口的旧记录"| B["Diary<br>中期：按时间段归档的对话摘要<br>per-group"]
    B -->|"知识抽取"| C["Semantic Memory<br>群聊统计<br>per-group"]
    B -->|"知识抽取"| D["User Memory<br>per-user per-group"]
    B -->|"知识抽取"| E["Glossary<br>术语表"]
```

## 基础记忆（Basic Memory）

**最底层的短期记忆**，每群独立维护一个固定大小的双端队列。

```python
# 内部结构
per-group deque:
  [entry_1, entry_2, ..., entry_N]  # N = hard_limit (默认 30)
```

### 核心参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `hard_limit` | 30 | 每群最大保留条目数 |
| `context_window` | 5 | 活跃上下文窗口（最近 5 条用于 LLM prompt） |

### 操作

- `add_entry()`: 添加对话记录到队列尾部，先进先出
- `get_context(n)`: 获取最近 n 条上下文（用于 prompt 构建）
- `get_archive_candidates()`: 获取超出 context_window 的旧条目（用于日记归档）
- `get_entries_by_user()`: 跨群查询某用户发言

### 热度计算

`HeatCalculator` 综合三个维度计算群聊热度：

- **消息速率** (40%): 最近 N 秒内的消息密度
- **发言人数** (30%): 有多少不同用户参与
- **最近性** (30%): 距离最后一条消息的时间

## 日记系统（Diary）

当群聊沉寂一段时间后，将 basic_memory 中超出窗口的旧消息归档为结构化日记。

### 组件

| 组件 | 功能 |
|------|------|
| `DiaryGenerator` | 将对话片段生成为结构化日记条目（使用 LLM） |
| `DiaryStore` | 日记持久化存储 |
| `DiaryVectorStore` | 日记向量索引（ChromaDB） |
| `DiaryRetriever` | 语义检索相关日记 |
| `DiaryConsolidator` | 合并多条日记为更高层的摘要 |

### 日记条目结构

```json
{
  "date": "2026-05-22",
  "summary": "今天群友们讨论了关于新游戏的发布...",
  "topics": ["游戏", "Steam"],
  "participants": ["user_a", "user_b"],
  "mood": "兴奋",
  "events": ["张三分享了一个游戏链接"]
}
```

### ContextAssembler 的日记集成

`ContextAssembler.build_messages()` 在构建 prompt 时会：

1. 使用当前消息作为查询检索相关日记（`diary_top_k` 条）
2. 将日记内容注入 system prompt 的背景信息区域
3. 支持 token 预算控制（`diary_token_budget`）

## 语义记忆（Semantic Memory）

基于群聊统计的长期记忆系统，追踪群聊的氛围规范与用户交互行为（不依赖向量检索）。

### 存储层级

| 层级 | 范围 | 说明 |
|------|------|------|
| `group` | 单个群聊 | 群氛围、规范、活跃时段、平均消息长度、表情/提及率、兴趣话题、禁忌话题、主导话题 |
| `user` | 单个用户在某群 | 互动率（engagement_rate）、交互次数、熟悉度、反馈追踪 |

群聊画像数据存储在 `group_semantic_profiles` 表中，除上述信息外还包括 `group_name`、`interest_topics`（兴趣话题）、`group_norms`（群规范详情）、`taboo_topics`（禁忌话题）、`dominant_topic`（主导话题）等字段。

此外，系统会持续追踪群聊的动态氛围和历史交互反馈，存储在以下两张表中：

- **`atmosphere_history`**：记录群聊氛围的时间序列，包含 `group_valence`（情绪效价）、`group_arousal`（唤醒度）、`active_participants`（活跃参与者数）等指标。
- **`group_pending_ai_responses`**：记录 AI 发送给群聊的消息及其后续用户互动情况，用于评估响应效果和学习互动模式。包含 `sent_at`、`target_user_id`、`topic_hint`、`response_length`、`was_engaged`、`engagement_latency_s` 等字段。

这些数据为认知引擎的决策提供依据，例如根据氛围历史调整响应策略，或者根据用户对 AI 消息的回应情况动态调整参与度。

### 学习机制

引擎在认知阶段会调用 `semantic_memory.learn_from_message()` 自动学习群聊特征：
- 消息长度分布（short / medium / long）
- 表情使用率和提及率
- 活跃时段分布
- 社交意图频率分布

### 用户交互追踪

通过 `record_user_interaction()` 实时追踪每个用户的交互模式：
- **engagement_rate**：基于 EMA（指数移动平均）计算的互动响应率
- **interaction_count**：精确交互计数器
- **familiarity**：基于对数曲线的熟悉度（`log1p(n) / log1p(50)`）
- **pending_responses**：消息级反馈队列（用于检测用户是否响应了 AI 的发言）

### 记忆记录

回复生成后，`_hook_memory` 会写入 basic_memory 和 semantic_memory：
- 自己的回复 → 记录群聊互动状态
- 用户的消息 → 更新用户交互统计

## 统一用户模型（UnifiedUser）

统一用户模型整合了原来的用户管理（`UserManager`）和人物传记（`BiographyManager`），通过 `UnifiedUserManager` 统一管理每个用户（跨群）的认知信息。

### 核心模型 `UnifiedUser`

每个用户对应一个 `UnifiedUser` 实例（通过 `user_id` 标识），包含以下字段：

| 字段 | 说明 |
|------|------|
| `name` | 用户显示名（可跨群更新） |
| `aliases` | 跨群收敛的别名列表（`AliasEntry`，含置信度、来源） |
| `short_bio` | 浓缩传记全文（不超过 500 字），描述用户身份、性格、偏好、习惯 |
| `identity_anchors` | 身份锚点（最多 5 条，每条不超过 20 字） |
| `relationships` | 该用户与其他人的关系网络（`RelationshipAnchor`，含 target_user_id、关系类型、事实描述、提及次数、时间戳） |
| `affinity_score` | 用户对 AI 的亲和力分数（-1.0=敌对, 0.0=中立, 1.0=友好），由 LLM 逐层更新时输出，经 EMA 平滑 |
| `metadata` | 附加元数据（如开发者标记 `is_developer`） |

### 别名管理

别名注册沿用四层防御机制（人格身份隔离、LLM 冲突校验、子串冲突校验、标准注册），由 `UnifiedUserManager` 维护全局别名速查表。

- **别名置信度**：首次注册时 napcat 来源 0.50，LLM 发现 0.30，后续随提及次数对数增长
- **时间衰减**：每过去一天置信度衰减 5%，低于 0.10 自动删除
- 别名数据通过 `get_aliases_for_group(group_id)` 接口暴露给认知分析器

### 亲和力反馈回路

`affinity_score` 反馈到引擎决策阶段：

- `affinity > 0.3`（友好）→ 响应阈值降低，最多降至 0.75x
- `affinity < -0.3`（不友好）→ 响应阈值提高，最多升至 1.40x
- LLM 未更新过信息（`affinity_score` 为默认值）的用户不触发调节

### 信息注入

用户信息通过 `PromptFactory.build_biography_section()` 格式化为 `【人物速查】` 段落，注入到 system prompt 中供 LLM 参考。

### 蒸馏与更新（两层凝练）

`UnifiedUserManager` 继承原 `BiographyManager` 的两层凝练架构：
1. **层1 蒸馏（distill）**：攒够 5 条消息或 8 小时后，LLM 从原始对话中提炼关于该用户的关键要点和别名
2. **层2 传记更新（update）**：攒够 3 个蒸馏要点或 24 小时后，LLM 综合旧传记和新要点，重写完整的用户档案（`short_bio`、`identity_anchors`、`relationships`、`affinity_score`）

## 术语表（Glossary）

`GlossaryManager` 管理自定义术语/黑话解释。`learn_term` 技能可以动态添加术语。

## 消息钉住（Pinned Messages）

消息钉住功能允许 AI 在对话上下文中保留重要信息，即使这些信息超出短期记忆窗口。钉住的消息会随每次 prompt 注入到上下文中，直到达到携带次数上限或时间过期。

### 核心参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MAX_PINNED_MESSAGES` | 10 | 全局最大可钉住消息数量 |
| `PINNED_MESSAGE_MAX_AGE_HOURS` | 24 | 钉住消息最大保留时间（小时） |
| `PINNED_MESSAGE_MAX_CARRY_COUNT` | 100 | 钉住消息最大携带次数（每次 prompt 注入计数+1，超过后自动取消） |

### 消息钉住管理器

`PinnedMessageManager` 负责管理钉住消息的生命周期，支持以下操作：

- `pin_message()`: 钉住一条消息，可指定内容、发言人、群组、原因、TTL、最大携带次数
- `unpin_message()`: 根据消息 ID 取消钉住
- `unpin_by_reason()`: 根据原因取消钉住（如“钉住此规则”）
- `unpin_by_content()`: 根据内容关键词取消钉住
- `unpin_all()`: 取消指定群组的所有钉住
- `get_pinned_messages_for_prompt()`: 获取钉住消息并增加携带计数，用于 prompt 注入

### 钉住/取消钉住指令

AI 在回复中使用特殊语法来钉住或取消钉住消息：

- 钉住：`<pin reason="原因">需要保留的内容</pin>`
- 取消钉住：`<unpin reason="原因"/>` 或 `<unpin all/>`

系统会自动解析这些指令并执行对应的钉住/取消钉住操作。

### 信息注入

钉住消息会在构建 prompt 时被注入到 system prompt 中，格式为：

```
【钉住消息】
- 内容...
```

`ContextAssembler` 在 `build_messages()` 中会调用 `pinned_messages_fn` 获取当前群组的有效钉住消息，并将其添加到系统提示中。

### 携带计数与自动过期

每条钉住消息记录 `carry_count`，每次被用于 prompt 注入时加 1。当 `carry_count` 超过 `MAX_CARRY_COUNT` 时，消息自动取消钉住。同时，超过 `MAX_AGE_HOURS` 的消息也会被清理。

## 配置调优

在 `experience.json` 中控制记忆行为：

```json
{
  "memory_depth": 5,
  "cross_group_memory": true,
  "pinned_message_max_carry_count": 100
}
```

- `memory_depth`: 每次加载的历史消息数
- `cross_group_memory`: 是否启用跨群记忆
- `pinned_message_max_carry_count`: 钉住消息的最大携带次数，超过后自动取消

## 数据流示例

```mermaid
flowchart TB
    A["用户发消息: 今天天气真好"] --> B["Perception<br>add_entry(basic_memory), resolve user_id"]
    B --> C["Cognition"]
    C --> C1["learn_from_message<br>群聊统计学习"]
    C --> C2["diary_retriever.retrieve<br>天气 → 找到上周郊游日记"]
    C1 --> D["ContextAssembler.build_messages()"]
    C2 --> D
    D --> D1["basic_memory.get_context(5)<br>最近5条对话"]
    D --> D2["diary entries<br>相关日记"]
    D --> D3["biography<br>人物画像"]
    D1 --> E[组装成完整 prompt]
    D2 --> E
    D3 --> E
```

详见 [引擎架构](./engine-architecture) 了解记忆在管线中的位置。
