# 编写自定义技能

自定义技能是最简单的扩展方式：只需写一个 Python 文件，定义 `SKILL_META` 和 `run` 函数，放入 skills 目录即可。

## 统一 API 入口

框架提供了 `sirius_pulse.skills.api` 作为技能开发的统一导入入口，所有技能开发所需的类型和工具函数都可以从这里导入：

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
    ensure_developer_access,  # 开发者权限检查
)
```

这样就不需要记忆分散在 `sirius_pulse.skills.models`、`sirius_pulse.skills.data_store`、`sirius_pulse.skills.executor` 等不同模块的导入路径了。

> 每个 API 的详细说明见 [Skills API 参考](../reference/skills-api)。

## 快速上手

创建一个文件 `skills/my_skill.py`：

```python
# 1. 定义技能的元数据
SKILL_META = {
    "name": "my_skill",
    "description": "我的第一个技能，用于向用户打招呼",
    "version": "1.0",
    "parameters": {
        "greeting": "打招呼的方式",
        "name": "要打招呼的人的名字（可选，默认'大家'）"
    },
    "dependencies": [],  # 需要的额外 pip 包
}

# 2. 实现核心执行函数
def run(greeting: str = "你好", name: str = "大家", **kwargs) -> dict:
    """技能入口函数，可以被同步或异步调用"""
    message = f"{greeting}，{name}！"
    return {
        "success": True,
        "data": {"message": message},
        "text": message,
    }
```

放入 `skills/` 目录，重启引擎即可。AI 会在合适的时机调用它。

## SKILL_META 详解

`SKILL_META` 是一个字典，告诉系统这个技能的基本信息：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | str | ✅ | 技能唯一名称，用于 function_call (tools) 机制匹配 |
| `description` | str | ✅ | 功能描述，会被注入 LLM prompt 中供 AI 理解 |
| `version` | str | ✅ | 语义版本号 |
| `parameters` | dict | ❌ | 参数定义：`{"参数名": "参数描述"}` |
| `dependencies` | list[str] | ❌ | pip 依赖列表，自动安装 |
| `developer_only` | bool | ❌ | 仅 developer 可调用（默认 false） |
| `silent` | bool | ❌ | 静默执行（不在对话中显示） |
| `model_visible` | bool | ❌ | 是否对模型可见（默认 true）。设为 false 则技能不会出现在 function_call 工具列表中，适合仅后台使用的技能 |
| `adapter_types` | list[str] | ❌ | 限制适配器类型，如 `["napcat"]` |
| `tags` | list[str] | ❌ | 分类标签 |

### 参数定义详解

`parameters` 的每个值可以是普通描述字符串，也可以是详细字典：

```python
# 简单形式：纯描述
"parameters": {
    "query": "搜索关键词",
}

# 完整形式：详细约束
"parameters": {
    "count": "结果数量",
}
```

系统会自动处理以下类型的参数转换：

| Python 类型提示 | 转换逻辑 |
|----------------|----------|
| `str` | 原样使用 |
| `int` | `int(value)` |
| `float` | `float(value)` |
| `bool` | `"true"/"1"/"yes"` → `True` |
| `list[str]` | 原样使用（JSON 数组） |

参数无默认值的会被视作必填，缺失时报错。

## WebUI 配置表单

框架提供了 WebUI 配置界面，让用户可以在网页上可视化地配置技能参数，而无需手动编辑 JSON 文件。

### 使用 ConfigBuilder 定义配置

推荐使用 `ConfigBuilder` 来定义配置参数，它提供了链式 API 和参数分组功能：

```python
from sirius_pulse import ConfigBuilder

_builder = ConfigBuilder()
_builder.group("认证").add("api_key", type="password", description="API 密钥", required=True)
_builder.group("模型").add("model", type="model", description="使用的模型")
_builder.group("模型").add("temperature", type="float", description="温度", default=0.7, choices=[0.1, 0.3, 0.5, 0.7, 0.9])
_builder.group("高级").add("max_results", type="int", description="最大结果数", default=10)

parameters = _builder.build()
```

### 使用声明式 API 定义配置

也可以使用 `config_param` 和 `secret` 标记字段来定义配置：

```python
from sirius_pulse import config_param, secret, build_parameters_from_class

class MySkillConfig:
    api_key: str = secret("API 密钥", required=True, group="认证")
    model: str = config_param("使用的模型", type="model", group="模型")
    temperature: float = config_param("温度", default=0.7, group="模型")
    max_results: int = config_param("最大结果数", default=10, group="高级")
    enable_cache: bool = config_param("启用缓存", type="boolean", default=True, group="高级")

parameters = build_parameters_from_class(MySkillConfig)
```

`secret` 是 `config_param` 的快捷方式，自动设置 `type="password"`。

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
_builder = ConfigBuilder()
_builder.group("基础设置").add("name", type="str", description="名称", required=True)
_builder.group("基础设置").add("description", type="str", description="描述")
_builder.group("高级选项").add("timeout", type="int", description="超时时间", default=30)
_builder.group("高级选项").add("retry", type="boolean", description="启用重试", default=True)
```

### 完整示例：带 WebUI 配置的搜索技能

```python
from sirius_pulse import ConfigBuilder

# 定义配置参数
_builder = ConfigBuilder()
_builder.group("搜索设置").add("api_key", type="password", description="API 密钥", required=True)
_builder.group("搜索设置").add("engine", type="str", description="搜索引擎", default="google", choices=["google", "bing", "duckduckgo"])
_builder.group("搜索设置").add("max_results", type="int", description="最大结果数", default=5)
_builder.group("高级").add("timeout", type="int", description="请求超时(秒)", default=10)
_builder.group("高级").add("safe_search", type="boolean", description="安全搜索", default=True)

parameters = _builder.build()

SKILL_META = {
    "name": "advanced_search",
    "description": "高级搜索技能，支持多引擎和配置选项",
    "version": "1.0",
    "parameters": parameters,  # 使用 ConfigBuilder 生成的参数列表
}

def run(query: str = "", api_key: str = "", engine: str = "google", 
        max_results: int = 5, timeout: int = 10, safe_search: bool = True, **kwargs) -> dict:
    """执行搜索"""
    if not query:
        return {"success": False, "error": "请提供搜索关键词"}
    
    # 使用配置的参数执行搜索
    results = perform_search(query, api_key, engine, max_results, timeout, safe_search)
    
    return {
        "success": True,
        "data": {"results": results},
        "text": f"找到 {len(results)} 条结果",
    }
```

### 配置值的获取

当用户在 WebUI 中保存配置后，配置值会自动注入到 `run` 函数的对应参数中。你也可以通过 `data_store` 手动读取配置：

```python
def run(query: str = "", data_store=None, **kwargs) -> dict:
    # 从 data_store 读取配置（如果需要）
    api_key = data_store.get("config.api_key", "")
    
    # 或者直接使用参数（推荐）
    # api_key 会自动从 kwargs 中提取
    ...
```

## run 函数规范

### 函数签名

```python
def run(param1: str, param2: int = 5, **kwargs) -> dict:
```

- 参数名必须与 `SKILL_META["parameters"]` 中的键一一对应
- 系统通过**依赖注入**自动传入特殊参数（data_store, bridge, chat_context 等）
- 必须以 `**kwargs` 接收额外的运行时参数

### 特殊注入参数

系统通过检测函数签名自动注入以下参数：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `data_store` | SkillDataStore | 技能专属 KV 持久化存储 |
| `bridge` | Any | 平台适配器引用（NapCat adapter） |
| `chat_context` | dict | 当前对话上下文（group_id, user_id） |
| `invocation_context` | SkillInvocationContext | 调用者身份信息 |

只需在函数签名中声明即可获得注入：

```python
def run(query: str = "", data_store=None, **kwargs) -> dict:
    # data_store 自动注入，可以读取/保存数据
    history = data_store.get("search_history", [])
    history.append(query)
    data_store.set("search_history", history[-100:])
    return {"success": True, "data": {"results": [...]}}
```

### 返回值规范

返回一个 dict，建议包含：

```python
{
    "success": True,           # bool，执行是否成功
    "data": {...},             # Any，结构化结果数据
    "text": "人类可读文本",     # str，用于展示给用户
    "error": "错误描述",       # str，失败时的错误信息
    "text_blocks": [           # list，文本块列表
        {"type": "text", "value": "..."}
    ],
    "multimodal_blocks": [     # list，多模态块（图片等）
        {"type": "image", "value": "base64_or_path"},
    ],
}
```

系统会自动归一化返回值：
- 如果返回原始字符串，会被包装为 `{"success": True, "data": str}`
- 如果返回 list，会被提取为 `text_blocks`

### 异步技能

如果你需要异步操作（网络请求等），声明 `async def run(...)`：

```python
async def run(query: str = "", **kwargs) -> dict:
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(f"https://api.example.com/search?q={query}") as resp:
            data = await resp.json()
    return {"success": True, "data": data}
```

系统会自动识别并正确调用。

## 数据持久化

使用 `data_store` 参数实现持久化，无需手动管理文件：

```python
def run(key: str = "", value: str = "", data_store=None, **kwargs) -> dict:
    if not value:
        # 读取
        result = data_store.get(key, "未找到")
    else:
        # 写入
        data_store.set(key, value)
        result = f"已保存: {key} = {value}"
    # 无需手动 save()，系统会自动持久化
    return {"success": True, "text": result}
```

数据存储在 `data/personas/{name}/skill_data/{skill_name}.json`。

## 依赖管理

如果你的技能需要额外的 pip 包，在 `SKILL_META` 中声明：

```python
SKILL_META = {
    "name": "my_skill",
    "description": "...",
    "dependencies": ["requests", "beautifulsoup4"],
}
```

系统在加载时会自动安装缺失的依赖。

## 权限控制

### developer_only

```python
SKILL_META = {
    "developer_only": True,  # 仅标记为 developer 的用户可调用
}
```

### 适配器限制

```python
SKILL_META = {
    "adapter_types": ["napcat"],  # 仅在 NapCat 环境下可用
}
```

## 完整示例：搜索技能

```python
SKILL_META = {
    "name": "search",
    "description": "搜索指定关键词的网页摘要",
    "version": "1.0",
    "parameters": {
        "query": "搜索关键词",
        "count": "返回结果数量（1-5，默认3）"
    },
    "dependencies": ["requests", "beautifulsoup4"],
}

def run(query: str = "", count: int = 3, data_store=None, **kwargs) -> dict:
    import requests
    from bs4 import BeautifulSoup

    if not query:
        return {"success": False, "error": "请提供搜索关键词"}

    try:
        # 执行搜索
        url = f"https://www.example.com/search?q={query}"
        resp = requests.get(url, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")

        # 解析结果
        results = []
        for item in soup.select(".result-item")[:count]:
            results.append({
                "title": item.find("h3").text,
                "link": item.find("a")["href"],
                "snippet": item.find("p").text,
            })

        # 保存搜索历史
        history = data_store.get("history", [])
        history.insert(0, {"query": query, "time": __import__("datetime").datetime.now().isoformat()})
        data_store.set("history", history[:50])

        return {
            "success": True,
            "data": {"results": results},
            "text": "\n\n".join(f"**{r['title']}**\n{r['snippet']}\n{r['link']}" for r in results),
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
```

## 下一步

- [内置技能参考](./skill-builtin) — 学习现有技能的写法
- [被动技能开发](./skill-passive) — 创建后台运行或事件驱动的技能
- [插件系统总览](./plugin-overview) — 了解另一种扩展方式

> **进阶：** 框架还提供了 [Brain Hook 机制](../reference/brain-api)，允许在 LLM 生成前后注入自定义逻辑。适合需要对引擎行为做全局拦截的开发者。
