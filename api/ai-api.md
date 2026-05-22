# AI-friendly API Reference

> 本文件为 AI 编码助手优化的完整 API 参考。提供 Skills 和 Plugins 两大扩展系统的导入路径、符号清单、类型签名和文件来源。

---

## 1. Skills API

**导入路径：** `sirius_pulse/skills/api.py`
**物理位置：** [sirius_pulse/skills/api.py](../../sirius_pulse/skills/api.py)

### 1.1 导入方式

```python
from sirius_pulse.skills.api import (
    SkillResult,
    SkillEngineContext,
    SkillInvocationContext,
    SkillChainContext,
    BackgroundTaskSpec,
    TriggerSpec,
    SkillPassiveType,
    SkillParameter,
    SkillDataStore,
    strip_skill_calls,
    ensure_developer_access,
)
```

### 1.2 `__all__` 导出清单

```
BackgroundTaskSpec, SkillChainContext, SkillDataStore, SkillEngineContext,
SkillInvocationContext, SkillParameter, SkillPassiveType, SkillResult,
TriggerSpec, ensure_developer_access, strip_skill_calls
```

### 1.3 符号详情

#### SkillResult
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `success: bool` — 执行是否成功 |
| | `data: Any = None` — 结构化数据 |
| | `error: str = ""` — 错误信息 |
| | `text_blocks: list[SkillContentBlock] = field(default_factory=list)` — 文本块 |
| | `multimodal_blocks: list[SkillContentBlock] = field(default_factory=list)` — 多模态块 |
| | `internal_metadata: dict[str, Any] = field(default_factory=dict)` — 内部元数据 |
| **方法** | `to_display_text() -> str` — 转为 AI 可读文本 |
| | `to_internal_payload() -> dict[str, Any]` — 转为 prompt 注入负载 |

---

#### SkillEngineContext
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `class SkillEngineContext(Protocol)` |
| **方法** | `async send_message(group_id: str, message: str, ...) -> None` |
| | `async generate_text(prompt: str, ...) -> str` |
| | `async execute_skill_chain(chain: list[dict], ...) -> list[dict]` |
| **属性** | `persona_name: str` |
| | `logger: logging.Logger` |
| **用途** | 被动技能后台任务通过此 Protocol 与引擎交互 |

---

#### SkillInvocationContext
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `@dataclass` |
| **字段** | `caller_name: str` — 调用者名称 |
| | `caller_role: str = "user"` — 角色：user / developer / system |
| | `group_id: str = ""` — 群 ID |
| | `user_id: str = ""` — 用户 ID |
| | `metadata: dict[str, Any] = field(default_factory=dict)` — 额外元数据 |
| **用途** | 在 run 函数声明 `invocation_context` 参数时自动注入 |

---

#### SkillChainContext
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `@dataclass` |
| **字段** | `chain_id: str` — 链 ID |
| | `depth: int = 0` — 当前链深度 |
| | `max_depth: int = 3` — 最大深度 |
| | `results: list[dict] = field(default_factory=list)` — 链中各步骤结果 |
| **用途** | 框架内部，追踪 skill chaining 调用链 |

---

#### BackgroundTaskSpec
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `@dataclass` |
| **字段** | `interval: int` — 执行间隔（秒） |
| | `callback: Callable[[], Awaitable[None]]` — 异步回调函数 |
| | `name: str = ""` — 任务名称 |
| | `start_delay: int = 0` — 启动延迟（秒） |
| | `max_instances: int = 1` — 最大并发实例数 |
| | `stop_on_error: bool = True` — 出错时是否停止 |
| **用途** | create_background_tasks() 返回此对象列表注册周期性任务 |

---

#### TriggerSpec
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `@dataclass` |
| **字段** | `name: str` — 触发器名称 |
| | `condition: Callable[[], bool]` — 触发条件 |
| | `callback: Callable[[], Awaitable[None]]` — 回调函数 |
| | `cooldown: int = 0` — 冷却时间（秒） |
| **用途** | 条件驱动触发，非周期性 |

---

#### SkillPassiveType
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `class SkillPassiveType(Enum)` |
| **成员** | `BACKGROUND_TASK = "background_task"` |
| | `TRIGGER = "trigger"` |
| | `WEBHOOK = "webhook"` |
| **用途** | 区分被动技能类型 |

---

#### SkillParameter
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/models.py` |
| **类型** | `@dataclass(slots=True)` — 继承 `ConfigParameter` |
| **字段** | `name: str` — 参数名 |
| | `type: str = "str"` — 参数类型 |
| | `description: str = ""` — 描述 |
| | `required: bool = False` — 是否必填 |
| | `default: Any = None` — 默认值 |
| **用途** | SKILL_META["parameters"] 自动解析为此对象 |

---

#### SkillDataStore
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/data_store.py` |
| **类型** | `class SkillDataStore` |
| **方法** | `get(key: str, default: Any = None) -> Any` |
| | `set(key: str, value: Any) -> None` |
| | `delete(key: str) -> None` |
| | `keys() -> list[str]` |
| | `clear() -> None` |
| **用途** | 技能专属 KV 持久化存储，线程安全，自动持久化 |
| **存储位置** | `data/personas/{name}/skill_data/{skill_name}.json` |

---

#### strip_skill_calls
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/executor.py`（第 103 行） |
| **签名** | `def strip_skill_calls(text: str) -> str` |
| **用途** | 移除文本中所有 `[SKILL_CALL: ...]` 标记，保留周围内容 |

---

#### ensure_developer_access
| | |
|---|---|
| **源文件** | `sirius_pulse/skills/security.py`（第 79 行） |
| **签名** | `def ensure_developer_access(*, skill_name: str, invocation_context: SkillInvocationContext | None) -> None` |
| **抛出** | `PermissionError` — 当调用者不是 developer 时 |
| **用途** | 在 run 函数中限制敏感操作仅 developer 可执行 |

---

### 1.4 SKILL 编写契约

**模块约定（`skills/my_skill.py`）：**

```python
# ── 必需 ──
SKILL_META: dict = {
    "name": str,              # 技能唯一名称（必需）
    "description": str,       # 功能描述（必需，注入 LLM prompt）
    "version": str,           # 语义版本号（必需）
    "parameters": {           # 可选：参数定义
        "param_name": {
            "type": "str|int|float|bool|list[str]",
            "description": "...",
            "required": True|False,
            "default": ...,
        },
    },
    "dependencies": [],       # 可选：pip 依赖列表
    "developer_only": bool,   # 可选：仅 developer 可调用
    "silent": bool,           # 可选：静默执行
    "adapter_types": [],      # 可选：限制适配器类型
    "tags": [],               # 可选：分类标签
}

# ── 必需 ──
def run(param1: str, param2: int = 5, **kwargs) -> dict:
    # 特殊注入参数（由 kwargs 或声明注入）：
    #   data_store: SkillDataStore
    #   bridge: Any（平台适配器）
    #   chat_context: dict（group_id, user_id）
    #   invocation_context: SkillInvocationContext
    #   skill_chain_context: SkillChainContext
    return {
        "success": bool,
        "data": Any,             # 结构化结果
        "text": str,             # 人类可读文本
        "error": str,            # 失败信息
        "text_blocks": [{"type": "text", "value": "..."}],
        "multimodal_blocks": [{"type": "image", "value": "..."}],
    }

# ── 可选：被动技能入口 ──
def create_background_tasks(ctx: SkillEngineContext) -> list[BackgroundTaskSpec]:
    ...
def create_on_load(ctx: SkillEngineContext) -> None:
    ...
def create_on_unload(ctx: SkillEngineContext) -> None:
    ...
```

---

## 2. Plugins API

**导入路径：** `sirius_pulse/plugins/api.py`
**物理位置：** [sirius_pulse/plugins/api.py](../../sirius_pulse/plugins/api.py)

### 2.1 导入方式

```python
from sirius_pulse.plugins.api import (
    PluginBase,
    command,
    PluginResponse,
    PluginContext,
    EngineProxy,
    PluginDataStore,
    CommandAST,
    PluginCommandMeta,
    RenderMode,
    TriggerType,
    PatternType,
    PluginDefinition,
    PluginCommandDef,
    PluginEventDef,
    PluginPermissionDef,
    PluginRenderDef,
    PluginNaturalLangDef,
    PluginParameterDef,
    ArgNode,
    UserMention,
    GroupMention,
    MessageReference,
    ImageAttachment,
)
```

### 2.2 `__all__` 导出清单

```
ArgNode, CommandAST, EngineProxy, GroupMention, ImageAttachment,
MessageReference, PatternType, PluginBase, PluginCommandDef,
PluginCommandMeta, PluginContext, PluginDataStore, PluginDefinition,
PluginEventDef, PluginNaturalLangDef, PluginParameterDef,
PluginPermissionDef, PluginRenderDef, PluginResponse, RenderMode,
TriggerType, UserMention, command
```

### 2.3 符号详情

#### PluginBase
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/base.py` |
| **类型** | `class PluginBase` |
| **类属性**（子类覆写） | `_plugin_name: str` — 内部标识名 |
| | `_plugin_display_name: str` — 显示名称 |
| | `_plugin_description: str` — 描述 |
| | `_plugin_version: str = "1.0.0"` |
| | `_plugin_author: str = ""` |
| | `_plugin_events: list[dict] = []` |
| | `_plugin_schedule: list[dict] = []` — `[{"time": "HH:MM", "duration": 1440}]` |
| | `_plugin_permissions: dict \| None = None` |
| | `_plugin_nl_examples: list[str] = []` |
| | `_plugin_nl_slots: dict = {}` |
| | `_plugin_dependencies: list[str] = []` |
| | `_plugin_prompt_inject: str = ""` — 注入人格 prompt 的额外提示词 |
| **属性** | `name: str` |
| | `ctx: PluginContext` |
| | `source_path: Path \| None` |
| **生命周期** | `on_load() -> None` — 加载时调用 |
| | `on_unload() -> None` — 卸载时调用 |
| **核心** | `execute(cmd: CommandAST) -> PluginResponse` — 同步 |
| | `async execute_async(cmd: CommandAST) -> list[PluginResponse]` — 异步 |
| **辅助** | `logger: logging.Logger` — 专用 logger |
| | `get_data_store() -> PluginDataStore` |
| | `get_adapter() -> BaseAdapter` |
| | `render_template(template_name: str, data: dict) -> str` |

---

#### @command 装饰器
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/decorators.py` |
| **参数** | `name: str` — 指令名 |
| | `prefix: str = ""` — 前缀（/ # !） |
| | `patterns: list[str] = None` — 触发词列表 |
| | `pattern_type: str = "prefix"` — prefix / keyword / regex |
| | `description: str = ""` |
| | `examples: list[str] = None` |
| | `render_mode: str = "direct"` — direct / llm / silent |
| | `hidden_from_intent: bool = False` |
| | `system_prompt_suffix: str = ""` |
| | `max_tokens: int = 500` |
| | `temperature: float = 0.8` |
| | `mood_hint: str = ""` |
| | `timeout: float = 0.0` |
| **参数提取规则** | 位置参数 → 从 `cmd.args` 按序消费 |
| | 命名参数 → 从 `cmd.kwargs[name]` 匹配（`--key=value` / `-k value`） |
| | 布尔标志 → 从 `cmd.flags` 匹配 |
| | 类型转换 → int / float / bool / str / list[str] 自动转换 |

---

#### PluginResponse
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 439 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `success: bool = True` |
| | `data: Any = None` — llm 模式用于人格化生成 |
| | `text: str = ""` — direct 模式直接发送 |
| | `error: str = ""` |
| | `render_mode: str = ""` — 覆盖默认渲染模式 |
| | `mood_hint: str = ""` |
| | `tone_override: str = ""` |
| | `image_urls: list[str] = field(default_factory=list)` |
| | `message_group: Any = None` — MessageGroup 多模态 |
| | `metadata: dict[str, Any] = field(default_factory=dict)` |
| **工厂方法** | `ok(text="", data=None, **kwargs) -> PluginResponse` |
| | `fail(error: str) -> PluginResponse` |

---

#### PluginContext
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/context.py`（第 359 行） |
| **类型** | `@dataclass` |
| **字段** | `engine: EngineProxy` |
| | `adapter: Any = None` — BaseAdapter 实例 |
| | `message: MessageContext` — 当前消息上下文 |
| | `data_store: PluginDataStore \| None = None` |
| | `config: dict[str, Any] = field(default_factory=dict)` |
| | `plugin_name: str = ""` |
| **属性** | `logger: logging.Logger` — 专用 logger |
| **工厂** | `create(engine=, adapter=, plugin_name=, message=, data_store=, config=) -> PluginContext` |
| **访问方式** | 通过 `self.ctx` 在 handler 内访问 |

---

#### EngineProxy
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/context.py`（第 23 行） |
| **类型** | `class EngineProxy` |
| **方法** | `async generate_text(prompt, *, group_id, ...) -> str` — 引擎完整管线 |
| | `async generate_text_analysis(prompt, *, group_id, ...) -> str` — 分析模型 |
| | `async generate_raw(prompt, *, system_prompt, inject_persona, model, ...) -> str` — 直接调用 LLM |
| | `get_persona_name() -> str` |
| | `async execute_skill_chain(chain, ...) -> list[dict]` |
| | `register_plugin_event(event_type, callback)` |
| **访问方式** | 通过 `self.ctx.engine` |

---

#### PluginDataStore
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/context.py` |
| **类型** | `class PluginDataStore` |
| **方法** | `get(key: str, default: Any = None) -> Any` |
| | `set(key: str, value: Any) -> None` |
| | `delete(key: str) -> None` |
| | `keys() -> list[str]` |
| | `clear() -> None` |
| **访问方式** | 通过 `self.ctx.data_store` 或 `self.get_data_store()` |

---

#### CommandAST
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 61 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `command: str` — 指令名 |
| | `raw_text: str` — 原始文本 |
| | `prefix: str = ""` — 触发前缀 |
| | `args: list[ArgNode]` — 位置参数 |
| | `kwargs: dict[str, ArgNode]` — 命名参数 |
| | `flags: set[str]` — 布尔开关 |
| **方法** | `get_str(name, default="") -> str` |
| | `get_int(name, default=0) -> int` |
| | `get_float(name, default=0.0) -> float` |
| | `get_bool(name, default=False) -> bool` |
| | `to_dict() -> dict` |

---

#### PluginCommandMeta
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/decorators.py`（第 49 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `name: str` |
| | `prefix: str = ""` |
| | `patterns: list[str]` |
| | `pattern_type: str = "prefix"` |
| | `render_mode: str = "direct"` |
| | `description: str = ""` |
| | `examples: list[str]` |
| | `hidden_from_intent: bool = False` |
| | `handler: Callable \| None = None` |
| | `handler_is_async: bool = False` |

---

#### PluginDefinition
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 196 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `name: str` |
| | `display_name: str = ""` |
| | `description: str = ""` |
| | `version: str = "1.0.0"` |
| | `author: str = ""` |
| | `min_framework_version: str = "1.2.0"` |
| | `commands: list[PluginCommandDef]` |
| | `events: list[PluginEventDef]` |
| | `parameters: list[PluginParameterDef]` |
| | `natural_language: PluginNaturalLangDef \| None` |
| | `permissions: PluginPermissionDef` |
| | `render: PluginRenderDef` |
| | `dependencies: list[str]` |
| | `resources: list[str]` |
| | `prompt_inject: str = ""` |
| | `source_path: Path \| None` |
| **属性** | `all_patterns -> list[tuple[str, str, str]]` — (指令名, 触发词, 匹配类型) |
| | `is_passive -> bool` — 仅事件触发，无指令 |
| **工厂** | `from_dict(data: dict, source_path) -> PluginDefinition` |
| | `from_class(cls: type, source_path) -> PluginDefinition` |

---

#### PluginCommandDef
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 132 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `name: str` |
| | `patterns: list[str]` |
| | `pattern_type: str = "prefix"` |
| | `description: str = ""` |
| | `examples: list[str]` |
| | `hidden_from_intent: bool = False` |

---

#### PluginEventDef
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 144 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `type: str` — timer.daily / webhook / engine.xxx |
| | `cron: str = ""` |
| | `interval_seconds: float = 0.0` |
| | `description: str = ""` |

---

#### PluginParameterDef
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 155 行） |
| **类型** | `@dataclass(slots=True)` — 继承 `ConfigParameter` |
| **字段** | `position: int = 0` — 位置参数序号 |
| | `choices: list[str] \| None = None` — 可选值限制 |

---

#### PluginPermissionDef
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 162 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `developer_only: bool = False` |
| | `hidden_from_intent: bool = False` |
| | `adapter_types: list[str]` |
| | `group_blacklist: list[str]` |
| | `rate_limit_calls_per_minute: int = 60` |
| | `rate_limit_calls_per_hour: int = 1000` |

---

#### PluginRenderDef
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 178 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `mode: str = "direct"` — direct / llm / silent |
| | `system_prompt_suffix: str = ""` |
| | `max_tokens: int = 500` |
| | `temperature: float = 0.8` |

---

#### PluginNaturalLangDef
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 188 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `examples: list[str]` — 示例语料 |
| | `slots: dict[str, dict]` — 槽位定义 |

---

#### ArgNode
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 52 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `value: str \| int \| float \| bool` |
| | `raw: str` |
| | `type_hint: str = "str"` |

---

#### RenderMode
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py` |
| **类型** | `class RenderMode(Enum)` |
| **成员** | `DIRECT = "direct"` — 直接输出 |
| | `LLM = "llm"` — 引擎人格化 |
| | `SILENT = "silent"` — 静默 |

---

#### TriggerType
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py` |
| **类型** | `class TriggerType(Enum)` |
| **成员** | `COMMAND = "command"` |
| | `EVENT_TIMER = "timer"` |
| | `EVENT_WEBHOOK = "webhook"` |
| | `EVENT_ENGINE = "engine"` |
| | `EVENT_FILESYSTEM = "fs"` |

---

#### PatternType
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py` |
| **类型** | `class PatternType(Enum)` |
| **成员** | `PREFIX = "prefix"` |
| | `REGEX = "regex"` |
| | `KEYWORD = "keyword"` |

---

#### UserMention
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 479 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `user_id: str` |
| | `nickname: str = ""` |
| | `group_card: str \| None = None` |

---

#### GroupMention
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 487 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `group_id: str` |
| | `group_name: str \| None = None` |

---

#### MessageReference
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 495 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `message_id: str` |
| | `sender_id: str = ""` |
| | `original_content: str = ""` |

---

#### ImageAttachment
| | |
|---|---|
| **源文件** | `sirius_pulse/plugins/models.py`（第 504 行） |
| **类型** | `@dataclass(slots=True)` |
| **字段** | `url: str` |
| | `local_path: str \| None = None` |
| | `is_sticker: bool = False` |

---

### 2.4 Plugin 编写契约

**目录结构：**
```
plugins/{plugin_name}/
├── __init__.py      # PluginBase 子类（必需）
├── plugin.json      # 声明式定义（可选）
└── templates/       # 模板文件（可选）
    └── *.md
```

**代码约定（`__init__.py`）：**

```python
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

class MyPlugin(PluginBase):
    # ── 类属性（元数据声明） ──
    _plugin_name = "my_plugin"
    _plugin_display_name = "我的插件"
    _plugin_description = "示例插件"
    _plugin_version = "1.0.0"
    _plugin_dependencies: list[str] = []  # pip 依赖

    # ── 生命周期 ──
    def on_load(self) -> None:
        # 初始化资源
        pass

    def on_unload(self) -> None:
        # 释放资源
        pass

    # ── @command 装饰器方式（推荐） ──
    @command(
        name="hello",
        prefix="/",
        patterns=["/hello", "/你好"],
        pattern_type="prefix",
        description="打招呼",
        render_mode="direct",
    )
    async def hello(self, name: str = "") -> PluginResponse:
        """方法签名决定参数提取规则"""
        return PluginResponse.ok(text=f"你好，{name or '世界'}！")

    # ── 传统 execute 方式 ──
    def execute(self, cmd: CommandAST) -> PluginResponse:
        return PluginResponse.fail("请使用装饰器方式")
```

---

## 3. 快速对比

| 特性 | Skills | Plugins |
|---|---|---|
| **触发方式** | AI 通过 `[SKILL_CALL: name]` 调用 | 用户通过前缀命令 `/cmd` 触发 |
| **编写方式** | 一个 `.py` 文件 + `SKILL_META` + `run()` | 一个目录 + `PluginBase` 子类 + `@command` |
| **返回值** | `dict`（自动归一化为 SkillResult） | `PluginResponse` |
| **数据持久化** | `data_store` 自动注入 | `self.ctx.data_store` |
| **后台任务** | `create_background_tasks(ctx)` | `_plugin_schedule` / `_plugin_events` |
| **AI 参与** | 由 AI 决定何时调用 | 用户直接输入触发 |
| **统一入口** | `sirius_pulse.skills.api` | `sirius_pulse.plugins.api` |

---

## 4. 文件索引

| 文件 | 用途 |
|---|---|
| `sirius_pulse/skills/api.py` | Skills 统一入口（re-export） |
| `sirius_pulse/skills/models.py` | 数据模型定义 |
| `sirius_pulse/skills/data_store.py` | KV 持久化存储 |
| `sirius_pulse/skills/executor.py` | 执行器 + strip_skill_calls |
| `sirius_pulse/skills/security.py` | ensure_developer_access |
| `sirius_pulse/skills/registry.py` | 技能注册表 |
| `sirius_pulse/plugins/api.py` | Plugins 统一入口（re-export） |
| `sirius_pulse/plugins/base.py` | PluginBase 基类 |
| `sirius_pulse/plugins/models.py` | 数据模型定义 |
| `sirius_pulse/plugins/context.py` | PluginContext + EngineProxy + PluginDataStore |
| `sirius_pulse/plugins/decorators.py` | @command 装饰器 |
| `sirius_pulse/plugins/registry.py` | 插件注册表 |
| `sirius_pulse/plugins/loader.py` | 插件加载器 |
| `sirius_pulse/plugins/executor.py` | 插件执行器 |
