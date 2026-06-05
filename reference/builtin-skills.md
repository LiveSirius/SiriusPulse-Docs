# 内置技能文档

> 本文档介绍 Sirius Pulse 平台内置的自主消息技能（Autonomous Message Skills）。这些技能被设计为替换旧有的内联 prompt 标记，以更规范、更可靠的方式处理消息钉住、解除钉住、查看钉住消息以及发送表情包等常见操作。

## 概述

内置技能是一组预定义的工具函数，由系统自动注册并可在对话过程中被 AI 模型调用。它们的核心目标是：
- 取代诸如 `[PIN_MESSAGE: ...]`、`[UNPIN_MESSAGE: ...]`、`[STICKERS: ...]` 等文本标记
- 提供参数化、可验证的调用接口
- 通过 `silent: true` 属性避免工具调用对对话流的干扰（工具调用结果不会作为可见消息返回）
- 统一在 `sirius_pulse/skills/builtin/` 目录下管理

这些技能通过 `SkillEngineContextImpl` 暴露的 API 与底层引擎交互，确保上下文一致性和安全性。

## 技能列表

### 1. `send_sticker`

**文件** `sirius_pulse/skills/builtin/send_sticker.py`

**用途**：发送当前人格关联的表情包到当前聊天。允许模型在回复中同时表达情绪，无需等待工具结果。

**参数**：

| 参数名 | 类型 | 是否必须 | 描述 |
|--------|------|---------|------|
| `names` | `list[str]` | 是 | 候选表情包名称列表。系统会从前 3 个候选中随机选择 1 个发送。详见可选表情包配置。 |

**元数据**：

- `silent`: true
- `adapter_types`: `["napcat"]`（目前仅 napcat 适配器支持）
- `tags`: `["sticker", "messaging", "napcat"]`

**调用示例**：

```json
{
  "name": "send_sticker",
  "arguments": {
    "names": ["开心", "点赞", "加油"]
  }
}
```

**行为**：
- 调用 `engine_context.send_sticker_by_names(group_id, names)`
- 结果不会在对话中额外提示，工具调用即完成发送
- 若技能不在 napcat 适配器上下文，调用可能被过滤或返回错误

### 2. `pin_message`

**文件** `sirius_pulse/skills/builtin/pin_message.py`

**用途**：将聊天中的某条最近消息钉住，使其作为长期上下文携带在后续对话中。适用于记录重要约定、长期规则、待办事项等。

**参数**：

| 参数名 | 类型 | 是否必须 | 描述 |
|--------|------|---------|------|
| `msg_id` | `str` | 是 | 要钉住的最近消息的平台消息 ID。只能使用最近消息中真实出现的 `msg_id`。 |
| `reason` | `str` | 否 | 钉住原因，例如“重要约定”、“长期规则”。默认空字符串。 |

**元数据**：

- `silent`: true
- `tags`: `["memory", "pinned_message"]`

**行为**：
1. 通过 `engine_context.pin_recent_message_by_id(group_id, msg_id, reason)` 执行
2. 工具会检查 `group_id` 和 `msg_id` 有效性，查找最近 10 条消息中的匹配项
3. 成功时返回消息摘要；失败时返回错误信息（如 msg_id 为空、未找到消息、消息无文本内容）

**调用示例**：

```json
{
  "arguments": {
    "msg_id": "123456789",
    "reason": "用户要求始终使用简体中文回复"
  }
}
```

### 3. `unpin_message`

**文件** `sirius_pulse/skills/builtin/unpin_message.py`（需根据代码可能存在）

**用途**：取消钉住一条已被钉住的消息。当某条钉住消息已过时或不再需要时调用。

**参数**：

| 参数名 | 类型 | 是否必须 | 描述 |
|--------|------|---------|------|
| `message_id` | `str` | 是 | 钉住消息的唯一标识（pinned message id）。非平台消息 ID。 |

**元数据**：

- `silent`: true
- `tags`: `["memory", "pinned_message"]`

**底层调用**：`engine_context.unpin_message(message_id)`

**调用示例**：

```json
{
  "name": "unpin_message",
  "arguments": {
    "message_id": "pinned_msg_uuid"
  }
}
```

### 4. `list_pinned_messages`

**文件** `sirius_pulse/skills/builtin/list_pinned_messages.py`

**用途**：查看当前聊天中所有已经钉住的消息。用于确认现有长期上下文或决定哪些需要解除钉住。

**参数**：无参数。

**元数据**：

- `silent`: false（需要返回信息供模型参考）
- `tags`: `["memory", "pinned_message"]`

**行为**：
1. 通过 `engine_context.get_pinned_messages(group_id)` 获取列表
2. 返回格式化文本，包含每条钉住消息的 ID、说话者、原因和内容摘要

**输出格式**（示例）：

```
当前聊天共有 2 条钉住消息：
- msg_abc: 用户 | 重要约定 | 以后我们都在晚上8点讨论
- msg_def: 系统 | 长期规则 | 禁止讨论敏感话题
```

## 权限与执行控制

在 `sirius_pulse/core/bg_tasks_delayed.py` 中，引入了一个新的权限检查例外：
- 对于属于 `_AUTONOMOUS_MESSAGE_SKILLS` 集合（`send_sticker`, `pin_message`, `unpin_message`, `list_pinned_messages`）且其 `source_path` 位于 `sirius_pulse/skills/builtin/` 目录下的技能，**即使调用者的互动度（engagement）低于 0.1，也不会被拒绝**。
- 这允许系统自主执行这些内置操作，无需用户交互度门槛。

### 判断逻辑 `_is_autonomous_message_skill(skill)`

```python
@staticmethod
def _is_autonomous_message_skill(skill: Any) -> bool:
    if getattr(skill, "name", "") not in _AUTONOMOUS_MESSAGE_SKILLS:
        return False
    source_path = getattr(skill, "source_path", None)
    if source_path is None:
        return False
    try:
        builtin_dir = (Path(__file__).resolve().parents[1] / "skills" / "builtin").resolve()
        return source_path.resolve().is_relative_to(builtin_dir)
    except Exception:
        return False
```

## 工程上下文集成

技能的执行依赖于 `SkillEngineContextImpl` 中新增的方法：

- `send_sticker_by_names(group_id, names)` -> `dict`
- `list_sticker_names()` -> `list[str]`
- `pin_recent_message_by_id(group_id, msg_id, reason)` -> `dict`
- `unpin_message(message_id)` -> `dict`
- `get_pinned_messages(group_id)` -> `list[dict]`

这些方法在 `sirius_pulse/core/skill_engine_context.py` 中实现，委托给引擎的核心方法（如 `_send_stickers_by_names`、`pin_message`、`unpin_message`、`get_pinned_messages`）。

此外，在 `sirius_pulse/core/helpers.py` 中的 `Helpers` 类初始化时，会设置 `brain.current_adapter_type_fn` 以便在注册技能时根据适配器类型过滤（如 `send_sticker` 仅对 napcat 适配器可见）。

## Prompt 模板更新

`prompt_factory.py` 中对应的 prompt 模板已更新：
- 不再提示模型使用 `[PIN_MESSAGE: ...]`、`[UNPIN_MESSAGE: ...]` 或 `[STICKERS: ...]` 标记
- 改为直接指导模型调用对应的工具（`pin_message`、`unpin_message`、`list_pinned_messages`、`send_sticker`）
- 要求工具调用与自然语言回复可以同时发生，不需要等待工具结果再解释

## 配置说明

### 表情包配置（`send_sticker`）

当前人格的表情包名称列表通过 `sticker_names` 属性配置，系统会根据 `list_sticker_names()` 返回的值提供可选表情包列表。在 prompt 中会动态注入可选名称。

### 钉住消息限制

钉住消息的携带次数和最大数量由底层引擎控制（非本技能范围），可通过 `PinnedMessageStore` 等现有配置调整。

## 测试

对应的测试文件 `tests/test_builtin_message_skills.py` 覆盖了主要场景，包括：
- 成功发送表情包、钉住消息、解除钉住、列出钉住消息
- 参数验证（空 msg_id、无效 msg_id、缺失 group_id）
- 权限豁免检查（低互动度用户仍可成功调用内置技能）
- 非内置技能（如自定义技能）不会获得权限豁免

## 目录结构

```
sirius_pulse/skills/builtin/
├── send_sticker.py
├── pin_message.py
├── unpin_message.py
├── list_pinned_messages.py
```

## 常见问题

**Q: 如何让模型学会使用这些技能？**
A: prompt 模板已自动包含引导；无需额外训练。模型在生成回复时会根据语境选择合适的工具。

**Q: 调用 `send_sticker` 后需要模型回复确认吗？**
A: 不需要。技能声明为 `silent: true`，系统自动发送表情包后不会在对话中增加工具消息。

**Q: 低互动度群组能否使用钉住消息技能？**
A: 可以。内置技能豁免了互动度检查，允许系统维护重要上下文。

**Q: 如何适配其他平台（如 Telegram）的表情包？**
A: 需要实现对应的 `_send_stickers_by_names` 并在 `adapter_types` 中注册。

---

*本文档根据代码变更自动生成，版本对应代码提交哈希 `82d54d5..c81308d`。*