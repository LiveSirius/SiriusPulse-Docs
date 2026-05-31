# 日记切片模块（memory/diary）

## 概述

日记切片模块是 `sirius_pulse.memory` 子系统的重要组成部分，负责将对话历史切分为结构化的**日记切片（Slice）**，并基于这些切片生成可读性强的日记条目。该模块依赖冷检测（`ColdDetector`）和背景精炼（`_background_refiner`）等机制，在合适的时机自动创建日记，从而形成持续更新的时间线记忆。

日记切片模块包括以下文件：

| 文件 | 职责 |
|------|------|
| `__init__.py` | 模块初始化，导出主要类 |
| `slicer.py` | 对话历史的切片生成逻辑 |
| `slice_models.py` | 切片数据结构定义 |
| `generator.py` | 从切片生成日记条目的 LLM 调用与处理 |
| `slice_retriever.py` | 基于条件检索日记切片 |

## 核心概念

### 日记切片（Slice）

切片是**一段连续的对话历史**，具有以下属性：

- `slice_id`：全局唯一标识
- `group_id`：所属对话群组 ID
- `start_time` / `end_time`：时间范围
- `message_ids`：包含的消息 ID 列表
- `status`：当前状态（`pending`, `processing`, `done`, `failed`）
- `metadata`：附加元数据（如情绪标签、话题摘要）

### 日记条目（Diary Entry）

基于切片由 LLM 生成的日记文本，包含：

- `diary_id`：唯一 ID
- `slice_id`：关联的切片 ID
- `content`：日记正文（Markdown 格式）
- `dominant_topic`：主导话题
- `interest_topics`：兴趣标签列表
- `summary`：简短摘要（用于检索索引）

## 工作流程

日记切片模块的完整流程分为五步：

1. **冷检测触发**：`ColdDetector` 根据群组的活跃度（`heat` 值和距上次消息的秒数）判断是否达到“暂冷”或“冰点”状态，触发切片生成。
2. **切片生成（Slicer）**：`Slicer` 接收冷检测信号，收集待处理的消息，按时间或事件边界切分为切片，并标记状态为 `pending`。
3. **背景精炼（_background_refiner）**：后台任务检查 `pending` 状态的切片，对满足条件（如切片长度、时间窗口）的切片发起 LLM 调用，生成日记条目。
4. **日记生成（Generator）**：`DiaryGenerator` 使用配置的 LLM 模型，将切片内容作为上下文，生成结构化的日记文本，并提取话题、摘要等元数据。
5. **切片检索（SliceRetriever）**：`SliceRetriever` 支持按时间范围、话题标签、关键词等条件检索已有切片和日记，供前端或其它模块使用。

流程图示例：

```
ColdDetector → 触发 → Slicer 生成切片 → _background_refiner → Generator 生成日记 → 持久化到数据库
                          ↑                          ↓
                     SliceRetriever  ←─── 查询日记/切片
```

## 模块详细说明

### 1. slicer.py — 切片生成器

**主要类**：`Slicer`

**构造方法**：
```python
class Slicer:
    def __init__(self, conn, basic_memory, diary_manager, cold_detector):
        ...
```

**核心方法**：
- `create_slice(group_id, message_ids)`：手动创建切片（用于测试）
- `autoslice(group_id)`：根据冷检测状态自动切片，返回新创建的切片列表
- `slice_all_pending()`：批量处理所有待切片群组

**切片策略**：
- 基于时间窗口：超过 `max_gap_seconds` 未更新的群组，将已有消息切分为一个切片
- 基于事件边界：检测到关键话题切换时强制分割

### 2. slice_models.py — 数据模型

使用 Pydantic 定义：

```python
class Slice(BaseModel):
    slice_id: str
    group_id: str
    start_time: datetime
    end_time: datetime
    message_ids: list[str]
    status: SliceStatus  # pending | processing | done | failed
    metadata: dict[str, Any] = {}

class DiaryEntry(BaseModel):
    diary_id: str
    slice_id: str
    content: str
    dominant_topic: str = ""
    interest_topics: list[str] = []
    summary: str = ""
```

### 3. generator.py — 日记生成器

**主要类**：`DiaryGenerator`

**核心方法**：
- `generate_from_candidates(group_id, candidates, persona_name, persona_description, brain, model_name)`：从切片候选列表生成日记。

内部调用 LLM 的 Prompt 模板位于 `generator.py` 的 `_DIARY_PROMPT` 常量中，按以下结构组织：

```
你是一个日记作者，以下对话是用户与 AI 的交流记录。
请以日记形式总结今天发生的值得记录的事情。

对话记录：
{conversation_text}

输出 JSON 格式：
{
  "diary_content": "...",
  "dominant_topic": "...",
  "interest_topics": [...],
  "summary": "..."
}
```

生成后自动存储到数据库，并更新群组语义画像。

### 4. slice_retriever.py — 检索器

**主要类**：`SliceRetriever`

**核心方法**：
- `get_slice(slice_id)`：根据 ID 获取切片
- `get_diary_entry(diary_id)`：获取日记条目
- `list_slices(group_id, status=None, start_time=None, end_time=None, limit=50)`：按条件列出切片
- `list_diary_entries(group_id, page=1, per_page=20)`：分页获取日记列表
- `search_diary(keyword, limit=10)`：全文搜索日记内容

## 配置参数

日记切片模块通过 `persona_config.py` 或运行时配置进行管理。关键参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max_slice_gap_seconds` | int | 3600 | 切片最大时间间隙（秒） |
| `max_slice_messages` | int | 30 | 单个切片最大消息数 |
| `min_slice_messages` | int | 3 | 触发生成的最低消息数 |
| `diary_volume_threshold` | int | 5 | 后台日记提升的消息数阈值 |
| `diary_generation_model` | str | "memory_extract" | 用于生成日记的 LLM 角色 |
| `diary_consolidation_interval` | int | 300 | 日记合并检查间隔（秒） |

## 与 WebUI 的集成

提供两个前端页面：

1. **日记页面** (`/webui/static/pages/diary.html` & `diary.js`)：展示已生成的日记条目，支持时间线浏览和手动触发切片。
2. **日记切片管理页面** (`/webui/static/pages/diary-slices.html` & `diary-slices.js`)：查看所有切片状态，可手动重置或重试失败切片。

相关 API 端点（在 `webui/memory_api.py` 中定义）：
- `GET /api/diary/slices?group_id=&status=`
- `GET /api/diary/entries?group_id=&page=&per_page=`
- `POST /api/diary/force_slice` (手动触发)
- `POST /api/diary/regenerate/{diary_id}` (重新生成)

## 代码示例

### 手动触发切片生成

```python
from sirius_pulse.memory.diary import Slicer, DiaryGenerator

# 假设已构建 engine 对象
slicer = Slicer(conn, basic_memory, diary_manager, cold_detector)
generator = DiaryGenerator(diary_manager)

# 对指定群组强制切片
new_slices = slicer.autoslice("group_abc123")
for sl in new_slices:
    diary = await generator.generate_from_candidates(
        group_id="group_abc123",
        candidates=[sl],
        persona_name="助手",
        persona_description="一个友善的聊天助手",
        brain=engine.brain,
        model_name="gpt-4o-mini"
    )
    print(f"生成日记: {diary.diary_id}")
```

### 调用检索器

```python
retriever = SliceRetriever(conn)
slices = retriever.list_slices(
    group_id="group_abc123",
    status="done",
    start_time=datetime(2025, 1, 1),
    limit=10
)
for s in slices:
    entry = retriever.get_diary_entry_by_slice(s.slice_id)
    if entry:
        print(entry.summary)
```

## 注意事项

1. 切片生成依赖 `ColdDetector` 的正常运行，确保 `cold_detector.py` 的 `check()` 方法正确实现。
2. 日记生成会消耗 LLM Token，建议在非高峰时段批量处理（可通过 `bg_tasks.py` 中的 `_background_refiner` 任务调度）。
3. 如果 LLM 调用失败，切片状态会置为 `failed`，可通过 WebUI 或者 API 手动重试。
4. 切片元数据可以扩展，例如添加情绪标签、用户评分等，只需修改 `slice_models.py` 中的 `metadata` 字段。

## 未来规划

- 支持多模态切片（图片、语音）
- 实现切片聚类与话题演化追踪
- 引入增量更新机制，避免重复生成

## 相关文档

- [记忆系统概览](./memory.md)
- [冷检测模块](./cold_detector.md)
- [背景任务](./bg_tasks.md)
- [WebUI 集成](./webui/memory_api.md)