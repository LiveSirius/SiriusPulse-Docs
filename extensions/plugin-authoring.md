# 编写自定义插件

插件通过继承 `PluginBase` 并使用 `@command` 装饰器来定义指令。

## 统一 API 入口

框架提供了 `sirius_pulse.plugins.api` 作为插件开发的统一导入入口，所有插件开发所需的类型和工具都可以从这里导入：

```python
from sirius_pulse.plugins.api import (
    PluginBase,               # 插件基类（所有插件必须继承）
    command,                  # 声明式指令注册装饰器
    DispatchedOutput,         # 调度后的输出结构
    PluginResponse,           # 返回结果
    PluginContext,            # 运行时上下文
    EngineProxy,              # 引擎安全代理
    PluginDataStore,          # 持久化 KV 存储
    CommandAST,               # 指令抽象语法树
    PluginCommandMeta,        # @command 装饰器记录的元数据
    RenderMode,               # 输出策略枚举
    TriggerType,              # 触发方式枚举
    PatternType,              # 匹配模式枚举
)
```

这样就不需要记忆分散在 `sirius_pulse.plugins.models`、`sirius_pulse.plugins.context` 等不同模块的导入路径了。

> 每个 API 的详细说明见 [Plugins API 参考](../reference/plugins-api)。

## 快速上手

创建一个目录 `plugins/my_plugin/`，放入 `__init__.py`：

```python
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

class MyWeatherPlugin(PluginBase):
    """天气查询插件"""
    
    @command(
        name="weather",
        prefix="/",
        patterns=["/weather", "/天气"],
        pattern_type="prefix",
        description="查询指定城市的天气",
        render_mode="llm",  # 结果由 AI 人格化输出
    )
    async def handle_weather(self, city: str = "") -> PluginResponse:
        """处理 /weather 命令"""
        if not city:
            return PluginResponse.fail("请提供城市名，例如：/weather 北京")
        
        # 执行查询逻辑
        result = await self.fetch_weather(city)
        
        if result:
            return PluginResponse.ok(
                text=f"{city}天气：{result['condition']}，温度{result['temp']}°C",
                data=result,
            )
        return PluginResponse.fail(f"无法查询{city}的天气")
    
    async def fetch_weather(self, city: str):
        # 实际的天气查询逻辑
        ...
```

## project.json 配置

也可以在插件目录下放一个 `plugin.json` 替代装饰器：

```json
{
  "name": "my_weather",
  "display_name": "天气查询",
  "version": "1.0.0",
  "description": "查询指定城市的天气",
  "commands": [
    {
      "name": "weather",
      "patterns": ["/weather", "/天气"],
      "pattern_type": "prefix",
      "description": "查询天气",
      "examples": ["/weather 北京 --format=json"],
      "render_mode": "llm"
    }
  ],
  "dependencies": []
}
```

然后在 `__init__.py` 中实现 `execute` 方法。

推荐使用 `@command` 装饰器方式，更简洁且支持类型提示。

## 目录结构

```
plugins/
└── my_weather/
    ├── __init__.py      # 插件入口（PluginBase 子类）
    ├── plugin.json      # 可选：声明式定义
    └── templates/       # 可选：模板文件
        └── weather.md   # 可通过 render_template() 访问
```

## @command 装饰器详解

```python
@command(
    name: str,                  # 指令名
    prefix: str = "",           # 前缀（/ # !）
    patterns: list[str] = None, # 触发词列表
    pattern_type: str = "prefix",  # prefix / keyword / regex
    description: str = "",      # 描述（会注入 LLM prompt）
    examples: list[str] = None, # 使用示例
    render_mode: str = "direct",   # direct / llm / silent
    hidden_from_intent: bool = False,  # 对意图识别隐藏
    system_prompt_suffix: str = "",   # LLM 模式的附加提示
    max_tokens: int = 500,           # LLM 模式最大 token
    temperature: float = 0.8,        # LLM 模式温度
    mood_hint: str = "",             # LLM 模式情绪提示
    timeout: float = 0.0,            # 指令级超时（0 使用全局默认）
)
```

### 参数自动提取

`@command` 装饰的方法签名决定了如何从 `CommandAST` 提取参数：

```python
@command(name="echo")
async def echo(self, message: str, count: int = 1, uppercase: bool = False):
    """参数自动从用户输入中提取并转换类型"""
    result = message * count
    if uppercase:
        result = result.upper()
    return PluginResponse.ok(text=result)
```

用户输入 `/echo hello --count=3 --uppercase` → `echo("hello", 3, True)`

系统通过 `inspect.signature` 和 `get_type_hints` 解析 handler 参数，自动映射：
- 位置参数 → 从 `cmd.args` 按序消费
- 命名参数 → 从 `cmd.kwargs[name]` 匹配（支持 `--key=value`、`-k value`）
- 布尔标志 → 从 `cmd.flags` 匹配（`--uppercase` 不用带值）
- 类型转换：`int` / `float` / `bool` / `str` / `list[str]` 自动转换

## 异步方法

可以用 `async def` 声明异步 handler：

```python
@command(name="search")
async def search(self, keyword: str) -> PluginResponse:
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(f"https://api.example.com?q={keyword}") as r:
            data = await r.json()
    return PluginResponse.ok(data=data, text=str(data))
```

系统会自动检测异步函数并正确 await。

### 流式输出（Async Generator）

返回 `AsyncGenerator` 可以持续产出多条 `PluginResponse`：

```python
@command(name="progress")
async def progress(self) -> AsyncGenerator[PluginResponse, None]:
    for i in range(5):
        yield PluginResponse.ok(text=f"进度: {(i+1)*20}%")
        await asyncio.sleep(1)
    yield PluginResponse.ok(text="完成！")
```

## 使用 ctx 上下文

插件通过 `self.ctx` 访问运行时环境：

```python
@command(name="whoami")
async def whoami(self) -> PluginResponse:
    """获取当前对话信息"""
    persona = self.ctx.engine.get_persona_name()
    user = self.ctx.message.user_id
    group = self.ctx.message.group_id
    return PluginResponse.ok(
        text=f"我是{persona}，当前在群{group}，你是{user}"
    )
```

## LLM 模式配置

`render_mode="llm"` 时，插件结果会经过 AI 人格化处理。你可以控制这个过程：

```python
@command(
    name="sysinfo",
    render_mode="llm",
    system_prompt_suffix="请用活泼的语气报告系统状态",
    mood_hint="开心",
    temperature=1.0,
    max_tokens=100,
)
async def sysinfo(self) -> PluginResponse:
    info = {"cpu": "85%", "memory": "12G/16G"}
    return PluginResponse.ok(text=str(info))
```

## 错误处理

使用 `PluginResponse.fail()` 返回错误：

```python
@command(name="ban")
async def ban(self, user: str) -> PluginResponse:
    if not self.ctx.adapter:
        return PluginResponse.fail("当前平台不支持此操作")
    
    try:
        await self.ctx.adapter.ban_user(user)
        return PluginResponse.ok(text=f"已封禁 {user}")
    except Exception as e:
        self.ctx.logger.error("封禁失败: %s", e)
        return PluginResponse.fail(f"封禁失败: {e}")
```

## 完整示例：骰子插件

```python
import random
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

class DicePlugin(PluginBase):
    """骰子插件"""
    
    @command(
        name="dice",
        prefix="/",
        patterns=["/dice", "/骰子", "/roll"],
        description="掷骰子，支持 NdX 格式（如 2d6）和简单数字（如 /dice 100）",
        examples=["/dice 100", "/dice 2d6", "/dice 3d20"],
        render_mode="direct",
    )
    async def roll(self, dice: str = "100") -> PluginResponse:
        """掷骰子"""
        try:
            if "d" in dice.lower():
                # NdX 格式
                n, x = dice.lower().split("d")
                n, x = int(n) if n else 1, int(x)
                if n < 1 or n > 100 or x < 2:
                    return PluginResponse.fail("格式: NdX，N=1~100，X≥2")
                
                rolls = [random.randint(1, x) for _ in range(n)]
                total = sum(rolls)
                text = f"掷出 {dice}: {rolls} = **{total}**"
            else:
                # 简单数字
                max_num = int(dice)
                result = random.randint(1, max_num)
                text = f"掷出 1~{max_num}: **{result}**"
            
            return PluginResponse.ok(text=text)
        except Exception as e:
            return PluginResponse.fail(f"格式错误: {e}，支持 /dice 100 或 /dice 2d6")
```

## WebUI 配置表单

框架提供了 WebUI 配置界面，让用户可以在网页上可视化地配置插件参数，而无需手动编辑 JSON 文件。

### 使用 _plugin_parameters 定义配置

在插件类中定义 `_plugin_parameters` 类属性来声明配置参数：

```python
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

class MyPlugin(PluginBase):
    _plugin_name = "my_plugin"
    _plugin_description = "示例插件"
    
    # 定义 WebUI 配置参数
    _plugin_parameters = [
        {
            "name": "api_key",
            "type": "password",
            "description": "API 密钥",
            "required": True,
            "group": "认证",
        },
        {
            "name": "model",
            "type": "model",
            "description": "使用的模型",
            "group": "模型",
        },
        {
            "name": "temperature",
            "type": "float",
            "description": "生成温度",
            "default": 0.7,
            "group": "模型",
        },
        {
            "name": "enable_logging",
            "type": "boolean",
            "description": "启用日志记录",
            "default": True,
            "group": "高级",
        },
    ]
```

### 使用 ConfigBuilder 定义配置

也可以使用 `ConfigBuilder` 来构建参数列表：

```python
from sirius_pulse import ConfigBuilder
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

# 构建配置参数
_builder = ConfigBuilder()
_builder.group("认证").add("api_key", type="password", description="API 密钥", required=True)
_builder.group("模型").add("model", type="model", description="使用的模型")
_builder.group("模型").add("temperature", type="float", description="温度", default=0.7)
_builder.group("高级").add("enable_logging", type="boolean", description="启用日志", default=True)

class MyPlugin(PluginBase):
    _plugin_name = "my_plugin"
    _plugin_description = "示例插件"
    _plugin_parameters = _builder.build()
```

### 使用声明式 API 定义配置

也可以使用 `config_param` 和 `secret` 标记字段：

```python
from sirius_pulse import config_param, secret, build_parameters_from_class
from sirius_pulse.plugins.api import PluginBase

class MyPluginConfig:
    api_key: str = secret("API 密钥", required=True, group="认证")
    model: str = config_param("使用的模型", type="model", group="模型")
    temperature: float = config_param("温度", default=0.7, group="模型")
    enable_logging: bool = config_param("启用日志", type="boolean", default=True, group="高级")

class MyPlugin(PluginBase):
    _plugin_name = "my_plugin"
    _plugin_description = "示例插件"
    _plugin_parameters = build_parameters_from_class(MyPluginConfig)
```

### 支持的参数类型

WebUI 会根据参数类型自动渲染对应的表单控件：

| 参数类型 | 渲染控件 | 说明 |
|---------|---------|------|
| `str` / `string` | 文本输入框 | 普通文本输入 |
| `int` / `number` | 数字输入框 | 带 +/- 按钮的数字调节器 |
| `float` | 数字输入框 | 同上，支持小数 |
| `boolean` | 复选框 | 勾选框 |
| `list` / `array` | 列表编辑器 | 可添加/删除列表项 |
| `model` | 下拉选择框 | 自动获取可用模型列表 |
| `password` / `secret` | 密码输入框 | 带显示/隐藏切换按钮 |
| `object_array` | 对象数组编辑器 | 用于编辑结构化数组数据 |
| `checkbox_group` | 复选框组 | 多选一或多选多 |

### 参数分组

使用 `group` 参数可以将相关配置项分组显示，在 WebUI 中会以折叠面板的形式呈现：

```python
_plugin_parameters = [
    {"name": "name", "type": "str", "description": "名称", "required": True, "group": "基础设置"},
    {"name": "description", "type": "str", "description": "描述", "group": "基础设置"},
    {"name": "timeout", "type": "int", "description": "超时时间", "default": 30, "group": "高级选项"},
    {"name": "retry", "type": "boolean", "description": "启用重试", "default": True, "group": "高级选项"},
]
```

### 配置值的获取

当用户在 WebUI 中保存配置后，配置值会存储在插件的 `data_store` 中，可以通过 `self.ctx.data_store` 访问：

```python
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

class MyPlugin(PluginBase):
    _plugin_name = "my_plugin"
    _plugin_parameters = [
        {"name": "api_key", "type": "password", "description": "API 密钥", "required": True},
        {"name": "max_results", "type": "int", "description": "最大结果数", "default": 10},
    ]
    
    @command(name="search")
    async def search(self, query: str) -> PluginResponse:
        # 从 data_store 读取配置
        store = self.get_data_store()
        api_key = store.get("config.api_key", "")
        max_results = store.get("config.max_results", 10)
        
        # 或者从 self.ctx.config 读取（如果已加载）
        # api_key = self.ctx.config.get("api_key", "")
        
        # 使用配置执行搜索
        results = await self.do_search(query, api_key, max_results)
        return PluginResponse.ok(data=results)
```

### 完整示例：带 WebUI 配置的翻译插件

```python
from sirius_pulse import ConfigBuilder
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

# 定义配置参数
_builder = ConfigBuilder()
_builder.group("API 设置").add("api_key", type="password", description="翻译 API 密钥", required=True)
_builder.group("API 设置").add("api_url", type="str", description="API 端点", default="https://api.example.com/translate")
_builder.group("翻译选项").add("source_lang", type="str", description="源语言", default="auto", choices=["auto", "zh", "en", "ja", "ko"])
_builder.group("翻译选项").add("target_lang", type="str", description="目标语言", default="zh", choices=["zh", "en", "ja", "ko"])
_builder.group("高级").add("timeout", type="int", description="请求超时(秒)", default=10)
_builder.group("高级").add("cache_enabled", type="boolean", description="启用缓存", default=True)

class TranslatePlugin(PluginBase):
    """翻译插件"""
    _plugin_name = "translate"
    _plugin_display_name = "翻译"
    _plugin_description = "支持多语言翻译"
    _plugin_parameters = _builder.build()
    
    @command(
        name="translate",
        prefix="/",
        patterns=["/translate", "/翻译"],
        description="翻译文本",
        examples=["/translate Hello", "/翻译 你好世界"],
        render_mode="llm",
    )
    async def handle_translate(self, text: str = "") -> PluginResponse:
        """处理翻译命令"""
        if not text:
            return PluginResponse.fail("请提供要翻译的文本")
        
        # 从 data_store 读取配置
        store = self.get_data_store()
        api_key = store.get("config.api_key", "")
        api_url = store.get("config.api_url", "")
        source_lang = store.get("config.source_lang", "auto")
        target_lang = store.get("config.target_lang", "zh")
        
        if not api_key:
            return PluginResponse.fail("请先在 WebUI 中配置 API 密钥")
        
        # 执行翻译
        result = await self.do_translate(text, api_key, api_url, source_lang, target_lang)
        
        return PluginResponse.ok(
            text=f"翻译结果：{result}",
            data={"original": text, "translated": result, "source": source_lang, "target": target_lang},
        )
    
    async def do_translate(self, text, api_key, api_url, source_lang, target_lang):
        # 实际的翻译逻辑
        ...
```

## 声明式定时任务

除了通过 `@command` 处理主动指令外，插件还支持声明式定时触发任务。在 `PluginBase` 子类中定义 `_plugin_schedule` 类属性，可以设置每日定时执行的事件：

```python
class MyTimedPlugin(PluginBase):
    _plugin_events = [
        PluginEvent(
            type="timer.schedule",
            cron="0 8 * * *",
            description="每日定时上报",
        ),
        PluginEvent(
            type="timer.schedule",
            interval_seconds=1800,
            description="状态健康检查",
        ),
    ]
```

`_plugin_schedule` 中每个条目包含 `time`（格式 `HH:MM`）和 `duration`（持续分钟数，默认 1440）。系统会自动将这些定时设置转换为内部事件，并在相应时间触发插件逻辑。定时事件的处理函数需要定义一个对应的事件监听（参见 [生命周期与上下文](./plugin-lifecycle)）。

## 下一步

- [指令系统详解](./plugin-command) — 理解完整的指令解析链路
- [生命周期与上下文](./plugin-lifecycle) — 深入 PluginContext、EngineProxy

> **进阶：** 框架还提供了 [Brain Hook 机制](../reference/brain-api)，允许在 LLM 生成前后注入自定义逻辑。适合需要对引擎行为做全局拦截的开发者。
