# Plugin Intent 系统

## 概述

Plugin Intent 系统是 SiriusPulse 中用于识别和验证用户意图以触发插件功能的核心模块。它替代了旧版通过在 LLM 输出中嵌入 `[SKILL_CALL:]` 标记的机制，转向基于专用匹配器 (`plugin_intent_matcher`) 和验证器 (`plugin_intent_verifier`) 的结构化方式。该系统与 function_call (tools) 机制协作，使得 AI 代理能够通过工具调用而非文本标记来执行插件代码，提升安全性和可维护性。

## 核心模块

### plugin_intent_matcher

**文件位置**: `sirius_pulse/core/plugin_intent_matcher.py`

**职责**: 分析用户输入消息，识别是否包含触发某个插件功能的意图。匹配器可基于规则（关键词、正则表达式）或轻量级模型进行判断，输出候选插件及置信度评分。

**主要特性**:
- 支持多种匹配策略（精确匹配、模糊匹配、语义匹配）
- 可配置的插件描述和触发条件
- 输出结果包含 `plugin_name`、`confidence` 和提取的 `params`（参数）

**典型用法**:

```python
from sirius_pulse.core.plugin_intent_matcher import PluginIntentMatcher

matcher = PluginIntentMatcher(registry=skill_registry)
result = matcher.match(user_message)
if result and result.confidence > 0.6:
    # 触发插件执行
    plugin_name = result.plugin_name
    params = result.params
```

### plugin_intent_verifier

**文件位置**: `sirius_pulse/core/plugin_intent_verifier.py`

**职责**: 对匹配器产生的候选插件进行二次验证，确保意图真实且安全。验证器可检查用户权限、参数完整性、上下文合理性等，防止误触发或恶意利用。

**主要特性**:
- 可组合的验证链（白名单、参数校验、上下文检查）
- 集成安全策略（如拒绝执行未注册的插件）
- 返回验证后的 `VerifiedIntent` 对象，或抛出拒绝异常

**典型用法**:

```python
from sirius_pulse.core.plugin_intent_verifier import PluginIntentVerifier

verifier = PluginIntentVerifier(security_policy=security_policy)
verified = verifier.verify(candidate, context)
if verified:
    # 执行已验证的插件调用
    await skill_registry.execute(verified.plugin_name, verified.params)
```

## 变更要点

本次重构主要变更如下：

| 旧机制 | 新机制 |
|--------|--------|
| 通过 LLM 输出 JSON 中包含 `plugin_intent`、`plugin_slots` 字段 | 通过专用匹配器/验证器识别意图 |
| 文本中嵌入 `[SKILL_CALL:]` 标记 | 使用 function_call (tools) 调用 |
| `PluginMatchInfo` 数据类（定义于 `cognition.py`） | 移除，由 `plugin_intent_matcher` 内部定义结果类 |
| `LLM_COGNITION_PROMPT` 中包含插件相关指令 | 提示词精简，插件意图由单独模块处理 |
| `strip_skill_calls` 工具函数调用 | 不再需要，回复中不再出现 marker |

核心影响：
- **cognition.py**: 移除了 `PluginMatchInfo` 以及 `LLM_COGNITION_PROMPT` 中的 `plugin_descriptions`、`plugin_intent` 和 `plugin_slots` 字段。`social_intent` 的允许值也不再包含 `plugin_command`。
- **brain.py**: 新增 `skill_registry` 参数，用于在生成过程中向插件匹配器提供可用插件列表。
- **bg_tasks_proactive.py / bg_tasks_delayed.py**: 移除 `strip_skill_calls` 的调用，因为不再需要清理标记。
- **config/models.py**: 添加了 `WorkspaceConfig.from_dict()` 工厂方法；`OrchestrationPolicy` 注释更新为“通过 function_call (tools) 调用代码”。
- **config/helpers.py** 和 **config_helpers.py**: 移除 `skill_call_marker` 相关字段。

## 配置说明

Plugin Intent 系统通常不需要额外配置，但可以通过 `brain.skill_registry` 传递已注册的插件列表给匹配器。对于自定义插件，建议在插件注册时提供明确的意图触发描述（如关键词列表），以便匹配器高效工作。

示例：在 `WorkspaceConfig` 中注册插件时设置触发描述：

```python
from sirius_pulse.plugins.config import PluginConfig

weather_plugin = PluginConfig(
    name="weather",
    triggers=["天气", "温度", "climate"],  # 匹配器的触发词
    description="查询当前天气信息",
    ...
)
```

## 使用示例

假设有一个“天气查询”插件，用户发送“今天北京天气怎么样？”：

1. `plugin_intent_matcher` 根据触发词“天气”匹配到 weather 插件，提取参数 `{location: “北京”}`，置信度 0.92。
2. `plugin_intent_verifier` 检查用户是否有权限（假设允许），参数是否完整（location 非空），验证通过。
3. 系统通过 function_call 调用天气插件，返回结果，最终回复不包含任何标记。

代码层面：

```python
# 伪代码流程
user_msg = "今天北京天气怎么样？"
candidate = matcher.match(user_msg)
if candidate and candidate.confidence > 0.8:
    try:
        verified = verifier.verify(candidate, context)
        result = await skill_registry.execute(verified.plugin_name, verified.params)
        # result 直接作为回复文本
        reply = result
    except VerificationError as e:
        reply = "无法执行该插件: " + str(e)
else:
    # 普通对话处理
    reply = await generate_normal_reply()
```

## 注意事项

- **向后兼容性**: 旧的 `[SKILL_CALL:]` 标记和 prompt 字段已完全移除，使用旧版配置文件（包含 `skill_call_marker`）的实例需要更新配置。
- **自定义匹配器**: 开发者可以继承 `PluginIntentMatcher` 并重写 `match` 方法以实现自定义逻辑（如调用外部 NLU 服务）。
- **验证安全**: 强烈建议始终启用验证器，特别是在多用户生产环境中，以防止未授权的插件执行。
- **性能**: 匹配器和验证器均设计为轻量级，但若使用语义匹配（如向量检索），需注意延迟影响。