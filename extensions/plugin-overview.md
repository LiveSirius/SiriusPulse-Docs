# 插件系统总览

插件（Plugin）是面向用户命令行的扩展机制。用户可以输入 `/` `#` `!` 等前缀命令，由插件响应。

## 工作原理

```mermaid
flowchart TB
    A["用户发送: /weather 北京 --format=json"] --> B[Tokenizer<br>文本 → Token 序列]
    B --> C[Lexer<br>Token → 结构化命令]
    C --> D[CommandParser<br>构建 CommandAST]
    D --> E[PluginMatcher<br>匹配哪个插件]
    E --> F[PluginExecutor.execute]
    F --> F1[权限校验<br>developer_only / group_blacklist]
    F --> F2[速率限制<br>rate_limit_calls_per_minute]
    F --> F3[实例化插件 / 复用已有实例]
    F --> F4[PluginBase.execute_async]
    F4 --> G[OutputDispatcher.dispatch]
    G --> G1[direct: 直接输出结果文本]
    G --> G2[llm: 用 AI 人格化输出]
    G --> G3[silent: 静默执行，无输出]
```

## 关键概念

### 指令前缀

默认支持三种前缀：

| 前缀 | 示例 |
|------|------|
| `/` | `/weather 北京` |
| `#` | `#骰子 6` |
| `!` | `!roll 2d6` |

### 渲染模式（RenderMode）

插件执行后的输出有三种展示方式：

| 模式 | 说明 | 适用场景 |
|------|------|------|
| `direct` | 直接输出原始文本，不做修改 | 格式化数据、查询结果 |
| `llm` | 结果传给 AI 做人格化润色 | 需要自然语言表达 |
| `silent` | 静默执行，不在聊天中显示 | 后台操作、副作用 |

### 参数匹配模式（PatternType）

| 模式 | 说明 | 示例 |
|------|------|------|
| `prefix` | 前缀精确匹配 | `/weather` 匹配 `/weather` |
| `keyword` | 关键词包含匹配 | `/天气` 中 "天气" 匹配 `/北京天气` |
| `regex` | 正则表达式匹配 | `/roll\s+\d+d\d+` 匹配 `/roll 2d6` |

### @command 装饰器

替代传统 `execute()` 方法的新范式：

```python
from sirius_pulse.plugins import PluginBase, command

class MyPlugin(PluginBase):
    @command(
        name="weather",
        prefix="/",
        patterns=["/weather"],
        description="查询天气",
        render_mode="llm",
    )
    async def handle_weather(self, city: str, format: str = "text"):
        # 自动从 CommandAST 提取 city 和 format
        ...
```

## 系统架构

```mermaid
flowchart TB
    A[CommandAST<br>结构化命令数据] --> B[PluginRegistry<br>多维度索引]
    A --> C[PluginLoader<br>加载器]
    A --> D[PluginExecutor<br>执行器]
    A --> E[OutputDispatcher<br>输出调度]
    A --> F[PluginConfigManager<br>配置管理]

    B --> B1["_commands_index:<br>(pattern, type, plugin, cmd_meta)"]
    B --> B2["_events_index:<br>[PluginDefinition]"]
    B --> B3["match_message(text)<br>→ MatchResult"]

    C --> C1[扫描 plugins/ 目录]
    C --> C2[import_plugin_class<br>找到 PluginBase 子类]
    C --> C3["PluginDefinition.from_class()<br>构建定义"]
    C --> C4["安装依赖<br>AST 解析 _plugin_dependencies"]

    D --> D1["权限校验<br>_check_permissions"]
    D --> D2["速率限制<br>_check_rate_limit"]
    D --> D3["PluginContext.create<br>engine, adapter, ..."]
    D --> D4["PluginBase.execute_async<br>cmd"]
    D --> D5[超时保护]

    E --> E1["direct<br>直接输出"]
    E --> E2["llm<br>engine.brain.generate_text()"]
    E --> E3["silent<br>无输出"]

    F --> F1[启用/禁用]
    F --> F2[权限配置]
    F --> F3[热重载]
```

## 与技能的对比

| | 插件 | 技能 |
|---|---|---|
| **调用者** | 用户显式命令 | AI 自主决定 |
| **语法** | `/command args` | `[SKILL_CALL: ...]` |
| **触发方式** | 文本模式匹配 | LLM 意图驱动 |
| **开发范式** | 继承 PluginBase + @command | 函数 + SKILL_META |
| **输出** | direct / llm / silent | 注入 LLM 上下文 |
| **权限** | 细粒度（群黑名单、速率限制） | developer_only 标记 |
| **适用** | 固定功能、快速命令 | AI 辅助工具调用 |

## 下一步

- [编写自定义插件](./plugin-authoring) — 从零创建一个插件
- [指令系统详解](./plugin-command) — Tokenizer → Lexer → Parser 完整链路
- [生命周期与上下文](./plugin-lifecycle) — PluginContext、EngineProxy、数据持久化
