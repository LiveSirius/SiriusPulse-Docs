# 记忆系统模块 (memory/)

## 模块概述

记忆系统是 Sirius Pulse 的多层级记忆架构，负责对话上下文管理、历史记忆存储与检索。采用**四层记忆模型**：

```
工作记忆 (BasicMemory)  →  短期上下文窗口
     ↓ 群聊冷却后
日记记忆 (Diary)        →  LLM 总结的历史记录
     ↓ 向量化
语义记忆 (Semantic)     →  用户/群组画像
     ↓ 累积蒸馏
传记记忆 (Biography)    →  用户传记卡
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `basic/manager.py` | 基础记忆管理器：工作窗口 + 热度追踪 |
| `basic/models.py` | BasicMemoryEntry 数据模型 |
| `basic/store.py` | BasicMemoryFileStore：文件持久化 |
| `diary/manager.py` | 日记管理器：生成、索引、存储、检索 |
| `diary/generator.py` | DiaryGenerator：LLM 生成日记 |
| `diary/indexer.py` | DiaryIndexer + DiaryRetriever：索引与检索 |
| `diary/consolidator.py` | DiaryConsolidator：日记合并 |
| `diary/vector_store.py` | DiaryVectorStore：ChromaDB 向量存储 |
| `diary/models.py` | DiaryEntry 数据模型 |
| `diary/store.py` | DiaryFileStore：文件持久化 |
| `semantic/manager.py` | 语义记忆管理器：用户/群组画像 |
| `semantic/models.py` | GroupSemanticProfile / UserSemanticProfile |
| `semantic/store.py` | SemanticProfileStore：文件持久化 |
| `glossary/manager.py` | 名词解释管理器 |
| `user/simple.py` | UserManager：用户管理 |
| `context_assembler.py` | ContextAssembler：上下文组装器 |
| `cognition_store.py` | CognitionEventStore：认知事件存储 |

## 基础记忆 (BasicMemoryManager)

### 设计原则

- **全量保留窗口**：保留最近 `HARD_LIMIT`（默认 30）条消息
- **活跃上下文**：始终保留最近 `CONTEXT_WINDOW`（默认 5）条消息
- **归档候选**：超出上下文窗口的消息作为日记生成的候选

### 热度计算

```python
heat = msg_rate_factor * 0.4 + unique_speakers_factor * 0.3 + recency_factor * 0.3
```

- `msg_rate_factor`：最近 5 分钟消息频率
- `unique_speakers_factor`：最近 5 分钟独立发言人数
- `recency_factor`：最后消息的指数衰减

### 冷却检测

当 `heat < 0.25` 且 `silence >= 300s` 时，群组被判定为"冷却"，触发日记生成。

## 日记记忆 (DiaryManager)

### 生成流程

```
基础记忆归档候选
    ↓ 检查数量阈值（默认 8 条）
    ↓ 添加前次日记尾部重叠（默认 3 条）
    ↓ LLM 生成（DiaryGenerator）
DiaryEntry
    ↓ 向量化（EmbeddingClient）
    ↓ 索引（DiaryIndexer）
    ↓ 持久化（DiaryFileStore）
```

### 日记合并 (DiaryConsolidator)

定期扫描相似日记条目，通过 LLM 合并：

1. `find_clusters()`：查找相似日记簇
2. `build_merge_prompt()`：构建合并提示词
3. `parse_merge_result()`：解析合并结果
4. `rebuild_entries()`：重建索引

### 向量检索

- 使用 ChromaDB 存储日记向量
- 支持语义相似度检索
- 自动迁移旧数据到向量存储

## 语义记忆 (SemanticMemoryManager)

### 群组画像 (GroupSemanticProfile)

```python
class GroupSemanticProfile:
    group_id: str
    group_norms: dict           # 群聊规范（消息长度、emoji 使用率等）
    dominant_topic: str         # 主导话题
    interest_topics: list[str]  # 兴趣话题列表
    atmosphere_history: list    # 氛围历史快照
    response_engagement_rate: float  # AI 回复参与率
    pending_ai_responses: list  # 待反馈的 AI 回复
```

### 用户画像 (UserSemanticProfile)

```python
class UserSemanticProfile:
    user_id: str
    name: str
    first_interaction_at: str
    interaction_count: int
    engagement_rate: float      # 参与率（EMA 平滑）
    last_interaction_at: str
    pending_responses: list     # 待反馈的回复
```

### 反馈驱动机制

AI 发送消息后记录"反馈锚点"，用户后续消息到达时结算：

- 120 秒内到达且 `directed_score >= 0.3` → `was_engaged = True`
- 120 秒内到达但 `directed_score < 0.3` → 不结算（群聊噪音）
- 超过 120 秒 → `was_engaged = False`

### 被动学习

从消息流中学习群聊规范：

```python
semantic_memory.learn_from_message(
    group_id="group_123",
    content="消息内容",
    social_intent="闲聊",
)
```

自动更新：
- 平均消息长度
- 消息长度分布
- emoji 使用率
- @ 提及率
- 活跃时段分布
- 话题切换频率

## 传记记忆 (BiographyManager)

### 两层蒸馏架构

```
原始消息（feed_messages）
    ↓ 累积到消息池
    ↓ 达到阈值后
蒸馏要点（maybe_distill）→ 从原始消息提炼关于用户的要点
    ↓ 累积到要点池
    ↓ 达到阈值后
传记卡（maybe_update_biography）→ 从要点构建传记卡
```

### 传记卡结构

```python
class BiographyCard:
    user_id: str
    name: str
    aliases: list[str]
    identity_anchors: list[str]    # 身份锚点
    relationships: list            # 人际关系
    affinity_score: float          # 亲和力分数（EMA 平滑）
    last_updated_at: str
```

## 名词解释 (GlossaryManager)

管理群聊中的专有名词解释，支持：

- 术语注册与查询
- 按群组隔离
- 持久化存储

## 上下文组装器 (ContextAssembler)

将各层记忆组装成 LLM 可消费的 messages 列表：

```python
messages, breakdown = context_assembler.build_messages_with_breakdown(
    group_id="group_123",
    current_query="当前消息",
    system_prompt="系统提示词",
    search_query="检索查询",
    recent_n=10,
    include_pending=True,
)
```

组装内容：
1. 系统提示词（人格 + 场景 + 能力）
2. 日记 RAG 检索结果
3. XML 格式的对话历史
4. 当前用户消息

## 数据隔离

```
data/personas/{name}/
    ├── memory/          # 语义记忆
    ├── diary/           # 日记记忆
    │   └── vector_db/   # ChromaDB 向量存储
    └── cognition_events.db  # 认知事件存储
```

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `basic_memory_hard_limit` | 30 | 工作记忆最大条目数 |
| `basic_memory_context_window` | 5 | 活跃上下文窗口大小 |
| `diary_top_k` | 5 | 日记检索返回数量 |
| `diary_token_budget` | 800 | 日记检索 token 预算 |
| `diary_volume_threshold` | 8 | 日记生成最小候选数 |
| `memory_promote_interval_seconds` | 180 | 记忆提升检查间隔 |
| `consolidation_interval_seconds` | 600 | 日记合并间隔 |
