# Skills API 参考

`sirius_pulse.skills.api` 是技能开发的统一导入入口，所有技能开发所需的类型和工具函数都可以从这里导入。

## 使用方式

```python
from sirius_pulse.skills.api import (
    SkillResult,              # 结构化返回结果
    SkillEngineContext,       # 被动/后台技能的引擎上下文 Protocol
    SkillInvocationContext,   # 调用者身份信息
    SkillChainContext,        # Skill Chaining 上下文
    BackgroundTaskSpec,       # 后台任务规格
    TriggerSpec,              # 事件触发规格
    SkillPassiveType,         # 被动技能类型枚举
    SkillParameter,           # 技能参数定义
    SkillDataStore,           # 持久化 KV 存储
    strip_skill_calls,        # 移除 SKILL_CALL 标记
    ensure_developer_access,  # 开发者权限检查
)
```

---

## 数据模型

### SkillResult

技能执行后返回的结构化结果。

```python
@dataclass
class SkillResult:
    success: bool                          # 执行是否成功
    data: Any = None                       # 结构化数据
    error: str = ""                        # 错误信息
    text_blocks: list[SkillContentBlock] = field(default_factory=list)    # 文本块
    multimodal_blocks: list[SkillContentBlock] = field(default_factory=list)  # 多模态块
    internal_metadata: dict[str, Any] = field(default_factory=dict)      # 内部元数据
```

**方法：**
- `to_display_text()` — 转为 AI 可读的纯文本
- `to_internal_payload()` — 转为用于 prompt 注入的结构化负载

**使用场景：** 一般不需要手动构造此对象。run 函数返回 dict 后系统会自动归一化为 `SkillResult`。如果你正在实现被动技能的 EngineContext 回调，可能需要处理此类型。

---

### SkillEngineContext

被动技能与引擎交互的上下文 Protocol。定义了后台任务可调用的引擎能力。

```python
class SkillEngineContext(Protocol):
    async def send_message(self, group_id: str, message: str, ...) -> None
    async def generate_text(self, prompt: str, ...) -> str  # 返回已清理的文本（不含 SKILL_CALL 和 sticker 标签）
    async def execute_skill_chain(self, chain: list[dict], ...) -> list[dict]
    @property
    def persona_name(self) -> str
    @property
    def logger(self) -> logging.Logger
```

**使用场景：** 在 `create_background_tasks()` 中注册的后台任务，或者被动技能的事件回调中，通过此上下文与引擎交互（发送消息、生成文本、调用其他技能等）。

> ⚠️ `generate_text()` 返回的文本已经过内部清理（移除了 `[SKILL_CALL: ...]` 和 `[STICKERS: ...]` 标签），因此通常无需再调用 `strip_skill_calls()`。

**示例：**
```python
def create_background_tasks(ctx: SkillEngineContext) -> list[BackgroundTaskSpec]:
    async def check_and_notify():
        await ctx.send_message("group_123", "定时提醒：记得喝水！")
    return [BackgroundTaskSpec(interval=300, callback=check_and_notify)]
```

---

### SkillInvocationContext

调用者的身份信息，用于权限校验和上下文感知。

```python
@dataclass
class SkillInvocationContext:
    caller_name: str                       # 调用者名称
    caller_role: str = "user"              # 角色（user / developer / system）
    group_id: str = ""                     # 群 ID
    user_id: str = ""                      # 用户 ID
    metadata: dict[str, Any] = field(default_factory=dict)  # 额外元数据
```

**使用场景：** 当 run 函数声明了 `invocation_context` 参数时自动注入。可用于判断谁在调用技能、是否来自特定群等。

**示例：**
```python
def run(query: str = "", invocation_context=None, **kwargs) -> dict:
    if invocation_context:
        print(f"调用者: {invocation_context.caller_name}")
        print(f"来自群: {invocation_context.group_id}")
```

---

### SkillChainContext

技能链（Skill Chaining）的上下文，当一个技能触发另一个技能时传递。

```python
@dataclass
class SkillChainContext:
    chain_id: str                          # 链 ID
    depth: int = 0                         # 当前链深度
    max_depth: int = 3                     # 最大深度
    results: list[dict] = field(default_factory=list)  # 链中各步骤的结果
```

**使用场景：** 框架内部使用。在一个技能的执行结果中触发 `[SKILL_CALL: next_skill]` 时，用于防止无限递归和追踪调用链。

---

## 后台 & 被动技能

### BackgroundTaskSpec

后台任务规格定义，用于被动技能注册周期性任务。

```python
@dataclass
class BackgroundTaskSpec:
    interval: int                          # 执行间隔（秒）
    callback: Callable[[], Awaitable[None]]  # 异步回调函数
    name: str = ""                         # 任务名称（用于日志和去重）
    start_delay: int = 0                   # 启动延迟（秒）
    max_instances: int = 1                 # 最大并发实例数
    stop_on_error: bool = True             # 出错时是否停止
```

**使用场景：** 在技能模块中定义 `create_background_tasks(ctx)` 函数时，返回此对象的列表以注册周期性任务。

**示例：**
```python
def create_background_tasks(ctx) -> list[BackgroundTaskSpec]:
    async def cleanup():
        # 每 10 分钟清理一次过期缓存
        await do_cleanup(ctx)
    return [BackgroundTaskSpec(interval=600, callback=cleanup, name="cache_cleanup")]
```

---

### TriggerSpec

事件触发规格定义，用于被动技能注册一次性或条件触发的回调。

```python
@dataclass
class TriggerSpec:
    name: str                              # 触发器名称
    condition: Callable[[], bool]          # 触发条件
    callback: Callable[[], Awaitable[None]]  # 回调函数
    cooldown: int = 0                      # 冷却时间（秒）
```

**使用场景：** 注册需要满足特定条件才触发的回调，与 `BackgroundTaskSpec` 不同，它不是周期性执行，而是条件驱动。

---

### SkillPassiveType

被动技能类型枚举，描述技能的被动行为模式。

```python
class SkillPassiveType(Enum):
    BACKGROUND_TASK = "background_task"    # 后台周期性任务
    TRIGGER = "trigger"                    # 条件触发器
    WEBHOOK = "webhook"                    # Webhook 监听
```

**使用场景：** 在 `create_background_tasks()` 或 `create_on_load()` 中用于区分被动技能的类型。

---

## 技能参数

### SkillParameter

技能参数定义，继承自 `ConfigParameter`。

```python
@dataclass
class SkillParameter(ConfigParameter):
    name: str                              # 参数名
    type: str = "str"                      # 参数类型
    description: str = ""                  # 描述
    required: bool = False                 # 是否必填
    default: Any = None                    # 默认值
```

**使用场景：** `SKILL_META["parameters"]` 中定义参数时，由 `SkillRegistry` 自动解析为 `SkillParameter` 对象。一般不需要手动构造。

---

## 数据持久化

### SkillDataStore

技能专属的键值持久化存储。线程安全，自动持久化。

```python
class SkillDataStore:
    def get(self, key: str, default: Any = None) -> Any
    def set(self, key: str, value: Any) -> None
    def delete(self, key: str) -> None
    def keys(self) -> list[str]
    def clear(self) -> None
```

**使用场景：** 在 run 函数中声明 `data_store` 参数时自动注入。用于存储技能的持久化状态。

**示例：**
```python
def run(query: str = "", data_store=None, **kwargs) -> dict:
    history = data_store.get("search_history", [])
    history.append(query)
    data_store.set("search_history", history[-50:])  # 保留最近 50 条
    return {"success": True, "data": {"history": history}}
```

**存储位置：** 数据在 `data/personas/{name}/skill_data/{skill_name}.json`，无需手动管理文件。

---

## 工具函数

### strip_skill_calls

从文本中移除所有 `[SKILL_CALL: ...]` 标记，保留周围内容。

```python
def strip_skill_calls(text: str) -> str
```

**使用场景：** 在被动技能的回调中，若需要获取不带 SKILL_CALL 标记的纯净文本时使用。

> ℹ️ 由于 `generate_text()` 已经返回清理后的文本，此函数通常不再需要，但作为额外安全措施仍然可用。

**示例：**
```python
from sirius_pulse.skills.api import strip_skill_calls

raw_text = "你好[SKILL_CALL: weather | {\"city\":\"北京\"}]啊"
clean = strip_skill_calls(raw_text)  # → "你好啊"
```

---

### ensure_developer_access

检查当前调用者是否为开发者，如果不是则抛出 `PermissionError`。

```python
def ensure_developer_access(
    *,
    skill_name: str,
    invocation_context: SkillInvocationContext | None,
) -> None
```

**使用场景：** 在 run 函数中需要限制某些操作仅 developer 可执行时使用。

**示例：**
```python
def run(action: str = "", invocation_context=None, **kwargs) -> dict:
    try:
        ensure_developer_access(
            skill_name="admin_tool",
            invocation_context=invocation_context,
        )
    except PermissionError:
        return {"success": False, "error": "仅开发者可执行此操作"}
    # 执行管理员操作...
    return {"success": True, "data": "操作成功"}
```

---

## 相关文档

- [编写自定义技能](../extensions/skill-authoring) — 完整教程与示例
- [被动技能开发](../extensions/skill-passive) — 后台/事件驱动技能
- [内置技能参考](../extensions/skill-builtin) — 学习内置技能的写法
- [插件 API 参考](./plugins-api) — 插件开发对应的 API 入口
