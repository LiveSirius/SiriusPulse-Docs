# 指令系统详解

从用户输入文本到 `CommandAST` 的完整解析链路。

## 解析流水线

```
用户输入: "  /weather Beijing --format=json -v"
  │
  ▼
┌─────────────────────────────────────┐
│ 1. Tokenizer（词法分析）             │
│    "  /weather Beijing --format=json -v"
│    → [WS, CMD_HEAD("weather"), WS,  │
│       ARG_VALUE("Beijing"), WS,      │
│       LONG_OPT("format"), EQ,        │
│       ARG_VALUE("json"), WS,         │
│       SHORT_OPT("v")]               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Lexer（语法分析）                 │
│    Tokens → LexedCommand             │
│    {                                 │
│      command: "weather",             │
│      prefix: "/",                    │
│      positional_args: ["Beijing"],   │
│      named_args: {"format": "json"}, │
│      flags: {"v"},                   │
│      raw_text: "..."                 │
│    }                                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. CommandParser（命令解析）          │
│    LexedCommand + PluginDefinition   │
│    → CommandAST                      │
│    {                                 │
│      command: "weather",             │
│      args: [ArgNode("Beijing")],     │
│      kwargs: {"format": ArgNode("json")},│
│      flags: {"v"}                    │
│    }                                │
└─────────────────────────────────────┘
```

## 1. Tokenizer — 词法分析

将原始文本分解为 Token 序列。

### Token 类型

| Token 类型 | 说明 | 示例 |
|------------|------|------|
| `CMD_HEAD` | 命令头（去掉前缀） | `weather` |
| `LONG_OPT` | 长选项 | `--format` |
| `SHORT_OPT` | 短选项 | `-v` |
| `EQ` | 等号 | `=` |
| `ARG_VALUE` | 参数值 | `Beijing`, `json` |
| `WS` | 空白字符 | 空格 |
| `LITERAL` | 字面量文本 | 引号包裹的 |
| `MENTION` | @提及 | `@someone` |

### 前缀识别

| 前缀 | 识别规则 |
|------|----------|
| `/` | `/command` |
| `#` | `#command` |
| `!` | `!command` |

只有以这些字符开头的消息才会进入 Tokenize 流程。

## 2. Lexer — 语法分析

将 Token 序列转换为结构化的 `LexedCommand`：

### 选项解析

```
--format=json      → named_args["format"] = "json"
--format json      → named_args["format"] = "json"
-format json       → 同上（短选项无 - 前缀时）
-format=json       → 同上
```

### 位置参数

无 `--` 或 `-` 前缀、非等号右侧的值被视为位置参数。

### 布尔标志

`-v`、`--verbose` 形式且没有值的选项作为布尔标志：

```
 --verbose         → flags.add("verbose")
 -v                → flags.add("v")
```

### 完整示例

```
输入: /deploy app.js --env=production --force
Tokenize → Lex:
  command: "deploy"
  positional_args: ["app.js"]
  named_args: {"env": "production"}
  flags: {"force"}
```

## 3. CommandParser — 命令解析

将 `LexedCommand` 与 `PluginDefinition` 合并，产生 `CommandAST`。

### 参数位置映射

根据 `PluginDefinition.parameters` 的定义进行位置映射：

```python
# Plugin 参数定义：["action", "target", "reason"]
input: /mod ban user123 spam
→ position 0 = "ban" → action
→ position 1 = "user123" → target
→ position 2 = "spam" → reason

# 超出的位置参数合并到最后一个参数
input: /mod ban user123 spam bad behavior
→ reason = "spam bad behavior"
```

### 类型转换（_coerce_value）

| 类型提示 | 转换逻辑 |
|----------|----------|
| `str` | 原样使用 |
| `int` | `int(value)` |
| `float` | `float(value)` |
| `bool` | `value.lower() in ("true", "1", "yes")` |
| `list[str]` | 原样使用 |

### CommandAST API

```python
cmd = CommandAST(
    command="weather",
    raw_text="/weather Beijing --format=json",
    prefix="/",
    args=[ArgNode(value="Beijing", raw="Beijing", type_hint="str")],
    kwargs={"format": ArgNode(value="json", raw="json", type_hint="str")},
    flags={"v"},
)

# 便捷方法
cmd.get_positional(0)          # "Beijing"
cmd.get_str("format", "text")  # "json"
cmd.get_int("count", 5)        # 默认值
cmd.get_bool("verbose", False) # True（从 flags 中）
cmd.to_dict()                  # 转为普通 dict
```

## 4. PluginMatcher — 模式匹配

决定用户输入匹配哪个插件。

### 匹配策略

按优先级依次尝试：

1. **遍历 commands_index**：检查 prefix/keyword/regex
2. **精确 Lexer 匹配**：优先使用 tokenized 结果
3. **关键词匹配**：子串包含
4. **正则匹配**：正则表达式测试

### MatchResult

```python
MatchResult(
    plugin_name="my_weather",
    command_name="weather",
    pattern="/weather",
    pattern_type="prefix",
    confidence=1.0,  # 0.0 ~ 1.0
    lexed=LexedCommand(...),
)
```

### 匹配示例

```
注册: patterns=["/weather"], pattern_type="prefix"
→ "/weather 北京" 匹配 ✓
→ "/天气" 不匹配 ✗

注册: patterns=["天气"], pattern_type="keyword"
→ "/北京天气" 匹配 ✓（子串包含）
→ "/weather" 不匹配 ✗

注册: patterns=["/roll\s+\d+d\d+"], pattern_type="regex"
→ "/roll 2d6" 匹配 ✓
→ "/roll abc" 不匹配 ✗
```

## @command 参数映射完整流程

```python
@command(name="deploy")
async def deploy(self, app: str, env: str = "dev", force: bool = False):
    ...

# 用户输入: /deploy app.js --env=production --force
# 
# 1. Tokenize + Lex + Parse → CommandAST(command="deploy", 
#                                         args=[ArgNode("app.js")],
#                                         kwargs={"env": ArgNode("production")},
#                                         flags={"force"})
# 2. 按 handler 签名映射:
#    - app: str → cmd.kwargs["app"] 未找到 → 回退 cmd.args[0] → "app.js" ✓
#    - env: str → cmd.kwargs["env"] = "production" ✓
#    - force: bool → cmd.flags contains "force" → True ✓
# 3. 调用: deploy("app.js", "production", True)
```

## 模块级便捷函数

```python
from sirius_pulse.plugins import lexer
from sirius_pulse.plugins.models import CommandAST

# 快速解析（使用共享单例）
cmd = lexer.parse_command(text, plugin_def)
match = lexer.match_plugin(text, plugin_def)
```

## 调试技巧

当指令没有被正确匹配时，检查：

1. **前缀是否正确**：确认用户输入以 `/` `#` `!` 开头
2. **pattern 匹配**：检查 `patterns` 是否与用户输入匹配
3. **pattern_type**：确保类型正确：
   - `prefix` → 精确前缀匹配（最常用）
   - `keyword` → 子串匹配
   - `regex` → 正则匹配
4. **参数数量溢出**：位置参数超出定义时会被合并到最后一个参数
5. **hidden_from_intent**：意图识别阶段隐藏的指令需显式触发
