# 插件系统模块 (plugins/)

## 模块概述

插件系统是 Sirius Pulse 的扩展机制，允许开发者通过 Python 代码扩展引擎功能。插件支持**指令触发**、**事件响应**、**定时任务**三种激活方式，并提供完善的权限控制和生命周期管理。

## 架构设计

```
PluginLoader（加载器）
    ├── 扫描 plugins/ 目录
    ├── 自动安装依赖
    └── 导入 PluginBase 子类

PluginRegistry（注册表）
    ├── 指令索引（_commands_index）
    ├── 事件索引（_events_index）
    └── 插件定义存储（_definitions）

PluginExecutor（执行器）
    ├── 权限校验
    ├── 速率限制
    ├── 参数校验
    └── 调用 Plugin 生命周期

OutputDispatcher（输出调度器）
    └── 将 PluginResponse 渲染为平台消息
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `loader.py` | PluginLoader：扫描、导入、依赖安装 |
| `registry.py` | PluginRegistry：索引与查找 |
| `executor.py` | PluginExecutor：权限校验、执行 |
| `dispatcher.py` | OutputDispatcher：输出渲染 |
| `base.py` | PluginBase：插件基类 |
| `models.py` | PluginDefinition, PluginResponse 等数据模型 |
| `decorators.py` | @command 装饰器 |
| `context.py` | PluginContext：插件上下文 |
| `lexer.py` | 命令解析器（Tokenizer, Lexer, PluginMatcher） |
| `config.py` | 插件配置管理 |
| `events.py` | 事件定义 |
| `scheduler.py` | PluginScheduler：定时任务调度器 |
| `api.py` | WebUI 插件管理 API |

## 插件开发

### 最小示例

```python
# plugins/hello/hello.py
from sirius_pulse.plugins import PluginBase, PluginResponse
from sirius_pulse.plugins.decorators import command

class HelloPlugin(PluginBase):
    _plugin_name = "hello"
    _plugin_display_name = "问候插件"
    _plugin_version = "1.0.0"
    _plugin_description = "一个简单的问候插件"

    @command("hello", patterns=["/hello"], render_mode="direct")
    def hello(self) -> PluginResponse:
        return PluginResponse.ok(text="你好呀！")
```

### 插件目录结构

```
plugins/
    ├── hello/
    │   ├── __init__.py
    │   └── hello.py
    ├── weather/
    │   ├── __init__.py
    │   ├── weather.py
    │   └── _utils.py       # 以下划线开头的私有辅助模块
    └── README.md
```

## PluginBase 生命周期

```python
class PluginBase:
    def on_load(self):
        """插件加载时调用（支持同步和异步）。"""
        pass
    
    def on_unload(self):
        """插件卸载时调用（支持同步和异步）。"""
        pass
    
    def execute(self, cmd: CommandAST) -> PluginResponse:
        """执行指令（同步）。"""
        pass
    
    async def execute_async(self, cmd: CommandAST) -> list[PluginResponse]:
        """执行指令（异步，支持流式返回多个响应）。"""
        pass
```

## @command 装饰器

```python
from sirius_pulse.plugins.decorators import command

class MyPlugin(PluginBase):
    @command(
        "weather",                      # 指令名
        patterns=["/weather", "天气"],   # 触发模式
        render_mode="direct",           # 渲染模式
        timeout=30.0,                   # 超时时间
        hidden_from_intent=False,       # 是否对意图识别隐藏
    )
    def weather(self, city: str = "北京") -> PluginResponse:
        return PluginResponse.ok(text=f"{city}今天晴天")
```

### 参数声明

```python
@command("calc")
def calc(self, expression: str, precision: int = 2) -> PluginResponse:
    """自动从 CommandAST 提取参数。"""
    result = eval(expression)
    return PluginResponse.ok(text=f"{result:.{precision}f}")
```

## PluginResponse

```python
@dataclass
class PluginResponse:
    success: bool
    text: str | None = None
    data: Any = None
    error: str | None = None
    render_mode: str = "direct"  # direct|markdown|silent|image|file
    
    @classmethod
    def ok(cls, text="", data=None): ...
    
    @classmethod
    def fail(cls, error=""): ...
```

### 渲染模式

| 模式 | 说明 |
|------|------|
| `direct` | 直接发送文本 |
| `markdown` | 渲染为 Markdown 后发送 |
| `silent` | 静默，不发送任何内容 |
| `image` | 渲染为图片发送 |
| `file` | 作为文件发送 |

## 权限控制

### PluginPermissions

```python
@dataclass
class PluginPermissions:
    developer_only: bool = False           # 仅开发者可用
    hidden_from_intent: bool = False       # 对意图识别隐藏
    group_blacklist: list[str] = []        # 群组黑名单
    rate_limit_calls_per_minute: int = 30  # 每分钟调用限制
    rate_limit_calls_per_hour: int = 200   # 每小时调用限制
```

### 权限校验流程

```
execute()
    ├── Layer 1: developer_only 检查
    ├── Layer 2: group_blacklist 检查
    ├── Layer 3: 速率限制检查
    └── 通过 → 执行插件
```

## 命令解析

### Tokenizer → Lexer → PluginMatcher

```python
# 1. Tokenizer：将文本分词
tokens = Tokenizer().tokenize("/weather 北京")
# → [Token(COMMAND, "/weather"), Token(ARGUMENT, "北京")]

# 2. Lexer：解析为 CommandAST
lexer = Lexer(Tokenizer())
cmd = lexer.lex(tokens, raw_text="/weather 北京")
# → CommandAST(command="weather", args=[ArgNode(value="北京")])

# 3. PluginMatcher：匹配已注册的插件
result = registry.match_message("/weather 北京")
# → MatchResult(plugin_name="weather", command_name="weather", ...)
```

## 自然语言触发

```python
class WeatherPlugin(PluginBase):
    _plugin_name = "weather"
    
    _plugin_natural_language = NaturalLanguageConfig(
        examples=[
            "帮我查一下{city}的天气",
            "{city}今天天气怎么样",
        ],
        slots=[
            {"name": "city", "type": "str", "required": True},
        ],
    )
```

## PluginContext

```python
class PluginContext:
    plugin_name: str
    data_store: PluginDataStore      # 持久化数据存储
    config: dict[str, Any]           # 插件配置
    engine: Any                      # 引擎引用
    adapter: Any                     # 平台适配器引用
    message: MessageContext | None    # 消息上下文

class MessageContext:
    group_id: str
    user_id: str
    channel: str
    channel_user_id: str
    message_id: str
    content: str
    speaker_name: str
```

## PluginDataStore

```python
# 获取数据存储
store = ctx.data_store

# 读写数据
store.set("key", value)
value = store.get("key", default=None)
store.delete("key")
store.save()  # 持久化到磁盘
```

数据存储位置：`data/personas/{name}/plugin_data/{plugin_name}.json`

## 定时任务

```python
class MyPlugin(PluginBase):
    _plugin_events = [
        EventConfig(
            type="daily_report",
            cron="0 9 * * *",           # 每天 9:00
            description="每日报告",
        ),
        EventConfig(
            type="health_check",
            interval_seconds=300,        # 每 5 分钟
            description="健康检查",
        ),
    ]
    
    async def on_event(self, event_type, data):
        if event_type == "daily_report":
            await self._generate_daily_report()
```

## WebUI 管理 API

### 插件列表

```
GET /api/plugins
```

### 插件配置

```
GET /api/plugins/{name}/config
PUT /api/plugins/{name}/config
```

### 插件重载

```
POST /api/plugins/{name}/reload
```

## 配置文件

### plugins/_config.json

```json
{
  "weather": {
    "permissions": {
      "developer_only": false,
      "group_blacklist": ["group_123"],
      "rate_limit_calls_per_minute": 10
    },
    "settings": {
      "api_key": "xxx",
      "default_city": "北京"
    }
  }
}
```
