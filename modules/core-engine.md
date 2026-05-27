# 核心引擎模块 (core/)

## 模块概述

核心引擎模块是 Sirius Pulse 的对话编排核心，采用**组合模式**将职责分散到多个组件中，通过 `_EmotionalGroupChatEngineBase` 基类持有所有组件实例，并在 `EmotionalGroupChatEngine` 最终类中提供向后兼容的委托方法。

## 架构设计

```
EmotionalGroupChatEngine (最终类，委托 shim)
    └── _EmotionalGroupChatEngineBase (基类)
            ├── engine._pipeline: Pipeline           # 5 阶段管线
            ├── engine._bg_tasks_mgr: BackgroundTasks  # 后台任务管理
            │       ├── .proactive: ProactiveTasks     # 主动消息任务（延迟初始化）
            │       └── .delayed: DelayedQueueTasks    # 延迟队列任务（延迟初始化）
            ├── engine._helpers: Helpers              # 技能集成、工具方法
            ├── engine._persistence: EnginePersistence # 状态持久化
            │       └── EngineStateStore               # 序列化/反序列化
            ├── engine._sticker: EngineSticker         # 表情包系统
            └── engine._prompt_factory: PromptFactory  # Prompt 构建
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `emotional_engine.py` | 最终类定义（委托 shim），组合模式继承 `_EmotionalGroupChatEngineBase` |
| `engine_core.py` | 引擎基类：`__init__`、公开 API、委托方法（thin wrappers） |
| `pipeline.py` | Pipeline 组件：5 阶段管线（感知→认知→决策→执行→后台更新） |
| `bg_tasks.py` | BackgroundTasks 组件：后台任务管理，委托给 ProactiveTasks 和 DelayedQueueTasks |
| `bg_tasks_delayed.py` | DelayedQueueTasks 组件：延迟队列任务（ticker、prompt 构建） |
| `bg_tasks_proactive.py` | ProactiveTasks 组件：主动消息任务（checker、developer chat） |
| `helpers.py` | Helpers 组件：SKILL/Plugin 集成、token 记录、异常分类 |
| `engine_persistence.py` | EnginePersistence 组件 + EngineStateStore：状态持久化（save/load） |
| `engine_sticker.py` | EngineSticker 组件：表情包系统（初始化/选择/发送） |
| `prompt_factory.py` | PromptFactory：无状态 prompt 构建工具类 |
| `brain.py` | Brain：LLM 调用封装，支持 hook 后处理 |
| `cognition.py` | CognitionAnalyzer：情感+意图+共情联合分析 |
| `response_strategy.py` | ResponseStrategyEngine：响应策略决策 |
| `threshold_engine.py` | ThresholdEngine：多因子动态阈值计算 |
| `rhythm.py` | RhythmAnalyzer：对话节奏分析 |
| `model_router.py` | ModelRouter：任务感知模型选择 |
| `events.py` | SessionEventBus：事件总线 |
| `identity_resolver.py` | IdentityResolver：用户身份解析 |
| `utils.py` | 通用工具函数：`now_iso`、`parse_sticker_tags`、`strip_conversation_history_xml` |
| `constants.py` | 核心常量定义：时间、Token、记忆、反馈相关常量 |

## 5 阶段管线

### 1. 感知阶段 (_perception)

**职责**：消息归一化、参与者注册、更新工作记忆

- 通过 `IdentityResolver` 注册参与者身份
- 将消息添加到 `BasicMemoryManager` 工作记忆
- 更新群组最后消息时间戳

### 2. 认知阶段 (_cognition)

**职责**：情感分析、意图识别、共情策略选择

- 调用 `CognitionAnalyzer.analyze()` 进行联合分析
- 输出：`IntentAnalysisV3`（意图）+ `EmotionState`（情感）+ 共情策略
- 记录认知事件到 `CognitionEventStore` 用于情感时间线分析
- 维护短期话题窗口（滑动窗口，保留最近 N 条消息的关键词快照）

### 3. 决策阶段 (_decision)

**职责**：响应策略选择，综合多因子动态阈值

```
threshold = base × activity_factor × engagement_factor × time_factor × peer_factor
```

**影响因素**：
- 群聊热度（`RhythmAnalyzer`）
- 用户互动率（`UserSemanticProfile`）
- 人格回复偏好（`reply_frequency`）
- 传记亲和力（`BiographyManager`）
- 冷却时间（`cooldown_seconds`）

**输出策略**：
- `IMMEDIATE`：立即回复
- `DELAYED`：延迟回复（加入延迟队列）
- `SILENT`：不回复
- `PLUGIN`：插件命令处理

### 4. 执行阶段 (_execution)

**职责**：生成回复或加入延迟队列

- 收集上下文（传记、记忆、语义记忆）
- 构建 prompt（`PromptFactory`）
- 调用 Brain 生成回复
- 处理 SKILL 调用标记

### 5. 后台更新 (_background_update)

**职责**：记录回复、更新语义记忆

## 后台任务

| 任务 | 间隔 | 职责 |
|------|------|------|
| `_bg_delayed_queue_ticker` | 智能休眠 | 延迟队列到期检查 |
| `_bg_proactive_checker` | 60s | 主动触发检查 |
| `_bg_diary_promoter` | 180s | 基础记忆→日记生成 |
| `_bg_diary_consolidator` | 600s | 日记合并整理 |
| `_bg_proactive_developer_chat_checker` | 1800s | 开发者私聊检查 |

## Brain 后处理 Hook

引擎在初始化时向 Brain 注册 5 个后处理 hook：

| 优先级 | Hook | 任务过滤 |
|--------|------|----------|
| 0 | 对话深度追踪 | response_generate, proactive_generate |
| 20 | 表情包发送 | response_generate, proactive_generate |
| 30 | 回复去重 | response_generate |
| 40 | 记忆记录 | response_generate, proactive_generate |
| 50 | 时间戳+持久化 | response_generate, proactive_generate |

## 关键类

### EmotionalGroupChatEngine

```python
class EmotionalGroupChatEngine(_EmotionalGroupChatEngineBase):
    """Combined EmotionalGroupChatEngine with all components.

    所有组件已通过组合模式集成到基类中：
    - engine._helpers: Helpers 组件
    - engine._bg_tasks_mgr: BackgroundTasks 组件
    - engine._pipeline: Pipeline 组件
    - engine._persistence: EnginePersistence 组件
    - engine._sticker: EngineSticker 组件
    不再需要通过继承 Mixin 方式集成。
    """
    pass
```

### Pipeline

Pipeline 组件封装 5 阶段管线方法：

```python
class Pipeline:
    def __init__(self, engine: _EmotionalGroupChatEngineBase) -> None: ...
    def perception(self, group_id, message, participants) -> str: ...
    async def cognition(self, content, user_id, group_id, **kwargs) -> tuple: ...
    def decision(self, intent, emotion, group_id, user_id, sender_type="human") -> StrategyDecision: ...
    async def execution(self, decision, message, intent, emotion, memories, group_id, empathy, user_id) -> dict: ...
    def background_update(self, group_id, message, emotion, intent, user_id) -> None: ...
```

### BackgroundTasks

后台任务管理组件，子任务委托给 ProactiveTasks 和 DelayedQueueTasks：

```python
class BackgroundTasks:
    def __init__(self, engine: _EmotionalGroupChatEngineBase) -> None: ...
    @property
    def proactive(self) -> ProactiveTasks: ...  # 延迟初始化
    @property
    def delayed(self) -> DelayedQueueTasks: ...  # 延迟初始化
    def start(self) -> None: ...
    def stop(self) -> None: ...
    async def _diary_promoter(self) -> None: ...
    async def _diary_consolidator(self) -> None: ...
```

### Helpers

技能集成、工具方法组件：

```python
class Helpers:
    def __init__(self, engine: _EmotionalGroupChatEngineBase) -> None: ...
    def set_skill_runtime(self, *, skill_registry=None, skill_executor=None) -> None: ...
    def set_plugin_runtime(self, *, plugin_registry=None, plugin_executor=None, plugin_dispatcher=None) -> None: ...
    async def execute_plugin_command(self, decision, message, group_id, user_id) -> dict: ...
    def record_subtask_tokens(self, task_name, model_name, group_id, **kwargs) -> None: ...
    def classify_exception(self, exc: Exception) -> str: ...
```

### EnginePersistence

状态持久化组件：

```python
class EnginePersistence:
    def __init__(self, engine: _EmotionalGroupChatEngineBase) -> None: ...
    def persist_group_state(self, group_id: str) -> None: ...
    def persist_full_state(self) -> None: ...
    def save_state(self) -> None: ...
    def load_state(self) -> None: ...
    def set_proactive_enabled(self, group_id: str, enabled: bool) -> None: ...
    def is_proactive_enabled(self, group_id: str) -> bool: ...
```

### EngineSticker

表情包系统组件：

```python
class EngineSticker:
    def __init__(self, engine: _EmotionalGroupChatEngineBase) -> None: ...
    def _init_sticker_system(self) -> None: ...
    def _pick_sticker_file(self, names: list[str]) -> Path | None: ...
    async def _send_stickers_by_names(self, group_id: str, names: list[str]) -> dict: ...
```

### PromptFactory

无状态 prompt 构建工具类，所有方法均为静态方法：

- `build_persona_prompt()`：从人格字段构建角色 prompt
- `build_output_spec()`：输出规范
- `build_emotion_context()`：情绪上下文
- `build_relationship_context()`：关系上下文
- `build_biography_section()`：人物传记 section

### StyleAdapter

根据对话节奏适配回复风格：

```python
style = style_adapter.adapt(pace="steady")
# → StyleParams(max_tokens=4096, temperature=0.7, ...)
```

## 初始化流程

```
__init__
    ├── _init_expressiveness()          # 活泼度配置
    ├── _init_persona()                 # 人格加载
    ├── _init_orchestration_and_task_models()  # 模型编排
    ├── _init_memory_system()           # 记忆系统
    ├── _init_cognitive_layer()         # 认知层
    ├── _init_decision_layer()          # 决策层
    ├── _init_model_router()            # 模型路由
    ├── _init_brain()                   # Brain 初始化
    ├── _init_event_bus_and_persistence()  # 事件总线+持久化
    ├── _init_skill_plugin_and_runtime()   # SKILL/Plugin 运行时
    ├── _init_helpers()                 # 组合模式：Helpers 组件
    ├── _init_bg_tasks()                # 组合模式：BackgroundTasks 组件
    ├── _init_pipeline()                # 组合模式：Pipeline 组件
    ├── _init_persistence()             # 组合模式：EnginePersistence 组件
    ├── _init_sticker()                 # 组合模式：EngineSticker 组件
    └── _register_engine_hooks()        # 注册后处理 hook
```

## 使用示例

```python
from sirius_pulse.core.emotional_engine import create_emotional_engine

engine = create_emotional_engine(
    work_path="./data/personas/akane",
    provider=provider,
    persona=persona_profile,
)

# 启动后台任务
engine.start_background_tasks()

# 处理消息
result = await engine.process_message(
    group_id="group_123",
    message=message,
    participants=participants,
)
```
