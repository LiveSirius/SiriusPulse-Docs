# 技能系统模块 (skills/)

## 模块概述

技能系统是 Sirius Pulse 的工具调用机制，允许 AI 通过 `[SKILL_CALL]` 标记调用外部代码。技能分为**主动技能**（AI 主动调用）和**被动技能**（后台任务/事件触发）两种类型。

## 架构设计

```
SkillRegistry（注册表）
    ├── 发现和加载技能定义
    ├── 构建工具描述文本
    └── 管理技能生命周期

SkillExecutor（执行器）
    ├── 参数校验
    ├── 安全校验
    ├── 依赖注入
    ├── 重试机制
    └── 遥测记录
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `registry.py` | SkillRegistry：发现、加载、管理技能 |
| `executor.py` | SkillExecutor：执行、校验、重试 |
| `models.py` | SkillDefinition, SkillResult 等数据模型 |
| `security.py` | 安全校验 |
| `telemetry.py` | 执行遥测 |
| `data_store.py` | SkillDataStore：技能数据持久化 |
| `dependency_resolver.py` | 依赖解析与自动安装 |
| `builtin/` | 内置技能目录 |

## 技能定义

### SKILL_META 格式

```python
# skills/hello.py
SKILL_META = {
    "name": "hello",
    "description": "返回简单问候语",
    "version": "1.0.0",
    "developer_only": False,
    "silent": False,
    "tags": ["greeting"],
    "adapter_types": [],  # 空表示所有平台可用
    "parameters": {
        "name": {
            "type": "str",
            "description": "要问候的名字",
            "required": True,
        }
    },
}

def run(name: str, **kwargs):
    return {"message": f"你好，{name}"}
```

### 被动技能定义

```python
SKILL_META = {
    "name": "health_monitor",
    "description": "系统健康监控",
    "parameters": {},
}

# 后台任务工厂
def create_background_tasks(ctx):
    return BackgroundTaskSpec(
        name="health_check",
        interval_seconds=60,
        callback=check_health,
    )

# 事件触发器工厂
def create_triggers(ctx):
    return TriggerSpec(
        name="on_message",
        event_type="message_received",
        trigger_func=handle_message,
    )

# 生命周期钩子
def create_on_load(ctx):
    async def on_load():
        await initialize()
    return on_load

def create_on_unload(ctx):
    async def on_unload():
        await cleanup()
    return on_unload
```

## SkillDefinition

```python
@dataclass
class SkillDefinition:
    name: str
    description: str
    parameters: list[SkillParameter]
    version: str = "1.0.0"
    developer_only: bool = False
    silent: bool = False
    tags: list[str] = []
    adapter_types: list[str] = []
    source_path: Path | None = None
    
    # 运行时函数
    _run_func: Callable | None = None
    _background_task_factory: Callable | None = None
    _trigger_factory: Callable | None = None
    _on_load_factory: Callable | None = None
    _on_unload_factory: Callable | None = None
```

## SkillResult

```python
@dataclass
class SkillResult:
    success: bool = True
    error: str = ""
    summary: str = ""
    data: Any = None
    text_blocks: list[str] = []
    multimodal_blocks: list[dict] = []
    
    @classmethod
    def from_raw_result(cls, result): ...
    
    def to_display_text(self) -> str: ...
```

## SKILL_CALL 标记

AI 输出中使用以下格式调用技能：

```
[SKILL_CALL: skill_name | {"param": "value"}]
[SKILL_CALL: skill_name]
```

### 解析函数

```python
from sirius_pulse.skills.executor import parse_skill_calls, strip_skill_calls

# 解析 SKILL_CALL
calls = parse_skill_calls(text)
# → [("weather", {"city": "北京"})]

# 移除 SKILL_CALL 标记
clean_text = strip_skill_calls(text)
```

## SkillExecutor

### 同步执行

```python
executor = SkillExecutor(work_path)

result = executor.execute(
    skill=skill_definition,
    params={"name": "小明"},
    invocation_context=SkillInvocationContext(
        caller_is_developer=False,
        caller_user_id="user_123",
    ),
    max_retries=1,
)
```

### 异步执行

```python
result = await executor.execute_async(
    skill=skill_definition,
    params={"url": "https://example.com"},
    timeout=30.0,
    max_retries=1,
)
```

### 依赖注入

执行器自动检测 `run()` 函数的参数签名，注入以下依赖：

```python
def run(
    name: str,                          # 用户参数
    data_store: SkillDataStore = None,  # 自动注入
    invocation_context=None,            # 自动注入
    bridge=None,                        # 自动注入（平台适配器）
    chat_context=None,                  # 自动注入（聊天上下文）
):
    pass
```

### 链式调用

```python
chain = SkillChainContext()

# 第一个技能
result1 = executor.execute(skill1, params, chain_context=chain)

# 第二个技能引用第一个的结果
result2 = executor.execute(
    skill2,
    {"input": "${skill1.summary}"},
    chain_context=chain,
)
```

## 内置技能

| 技能 | 文件 | 说明 |
|------|------|------|
| `bing_search` | `bing_search.py` | 必应搜索 |
| `url_content_reader` | `url_content_reader.py` | 网页内容读取 |
| `file_read` | `file_read.py` | 文件读取 |
| `file_write` | `file_write.py` | 文件写入 |
| `file_list` | `file_list.py` | 文件列表 |
| `system_info` | `system_info.py` | 系统信息 |
| `send_image` | `send_image.py` | 发送图片 |
| `upload_file` | `upload_file.py` | 上传文件 |
| `reminder` | `reminder.py` | 提醒功能 |
| `learn_term` | `learn_term.py` | 学习术语 |
| `desktop_screenshot` | `desktop_screenshot.py` | 桌面截图 |
| `github_monitor` | `github_monitor.py` | GitHub 监控 |

## SkillDataStore

```python
# 获取数据存储
store = executor.get_data_store("skill_name")

# 读写数据
store.set("key", value)
value = store.get("key", default=None)
store.delete("key")
store.save()  # 持久化到磁盘
```

数据存储位置：`data/personas/{name}/skill_data/{skill_name}.json`

## 安全校验

```python
from sirius_pulse.skills.security import validate_skill_access

error = validate_skill_access(
    skill=skill_definition,
    invocation_context=context,
)
if error:
    raise PermissionError(error)
```

校验内容：
- `developer_only` 权限检查
- `adapter_types` 平台匹配

## 遥测记录

```python
class SkillExecutionRecord:
    skill_name: str
    timestamp: float
    success: bool
    duration_ms: float
    error: str
    caller_user_id: str
    params: dict | None
    result_summary: str
```

遥测文件位置：`data/personas/{name}/skill_data/.telemetry.jsonl`

## 依赖自动安装

技能可以在文件顶部声明依赖：

```python
_plugin_dependencies = ["httpx", "beautifulsoup4"]
```

或在 `SKILL_META` 中声明：

```python
SKILL_META = {
    "name": "my_skill",
    "dependencies": ["httpx>=0.24.0"],
}
```

执行器会自动使用 `uv pip install` 或 `pip install` 安装缺失依赖。

## 工具描述注入

注册表会自动构建技能描述文本，注入到 AI 的系统提示词中：

```python
descriptions = registry.build_tool_descriptions(
    invocation_context=context,
    compact=False,
    adapter_type="napcat",
)
```

输出示例：

```
- hello: 返回简单问候语
    - name (str, 必填): 要问候的名字
- weather: 查询天气
    - city (str, 必填): 城市名称
    - date (str, 可选, 默认=today): 日期
```
