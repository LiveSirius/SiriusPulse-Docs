# 记忆系统

Sirius Pulse 采用分层记忆架构，从短期的工作记忆到长期的语义理解，逐层抽象。

## 架构总览

```
                  ┌──────────────────┐
                  │   Basic Memory   │  ← 短期：最近 N 条对话（可配置窗口）
                  │   (per-group)    │
                  └────────┬─────────┘
                           │ 超出窗口的旧记录
                  ┌────────▼─────────┐
                  │      Diary       │  ← 中期：按时间段归档的对话摘要
                  │   (per-group)    │
                  └────────┬─────────┘
                           │ 知识抽取
    ┌──────────────────────┼──────────────────────┐
    │                     │                      │
    ▼                     ▼                      ▼
┌──────────┐    ┌──────────────────┐    ┌──────────────┐
│  User    │    │    Semantic      │    │   Glossary   │
│  Memory  │    │    Memory        │    │   (术语表)    │
│ (per-user│    │ (向量检索)        │    │              │
│  per-    │    │ per-group +      │    └──────────────┘
│  group)  │    │ global           │
└──────────┘    └──────────────────┘
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

基于向量相似度的长期记忆系统，支持群级、用户级和全局级存储。

### 存储层级

| 层级 | 范围 | 说明 |
|------|------|------|
| `group` | 单个群聊 | 群内共享记忆 |
| `user` | 单个用户在某群 | 用户在该群的表现 |
| `global` | 跨群 | 跨群共享记忆 |

### 学习机制

引擎在认知阶段会调用 `semantic_memory.learn_from_message()` 自动学习：
- 话题关联
- 用户偏好
- 上下文信息

检索时使用 `enhance_topic_relevance()` 增强话题相关性评分。

### 记忆记录

回复生成后，`_hook_memory` 会同时写入 basic_memory 和 semantic_memory：
- 自己的回复 → 记录到语义记忆
- 用户的消息 → 关联语义记忆

## 人物传记（Biography）

`BiographyManager` 管理跨对话的人物画像：

- **speaker_card**: 发言者简介（从对话中提取）
- **mentioned_cards**: 对话中提及的人物简介
- 支持置信度评分和消歧提示

传记信息会被 `PromptFactory.build_biography_section()` 注入到 system prompt 中。

## 术语表（Glossary）

`GlossaryManager` 管理自定义术语/黑话解释。`learn_term` 技能可以动态添加术语。

## 配置调优

在 `experience.json` 中控制记忆行为：

```json
{
  "memory_depth": 5,
  "cross_group_memory": true
}
```

- `memory_depth`: 每次加载的历史消息数
- `cross_group_memory`: 是否启用跨群记忆

## 数据流示例

```
用户发消息 "今天天气真好"
  → Perception: add_entry(basic_memory), resolve user_id
  → Cognition:
      semantic_memory.search("天气", group_id) → 找到历史讨论天气的记录
      diary_retriever.retrieve("天气") → 找到上周的郊游日记
  → ContextAssembler.build_messages():
      basic_memory.get_context(5) → 最近5条对话
      diary entries → 相关日记
      biography → 人物画像
      → 组装成完整 prompt
```

详见 [引擎架构](./engine-architecture) 了解记忆在管线中的位置。
