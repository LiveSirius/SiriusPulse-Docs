# Pinned Message（消息钉住）

## 概述

Pinned Message 模块提供“消息钉住”功能，允许在群聊中将重要消息“钉住”，使其在后续会话中持续作为上下文传递给语言模型，从而维持重要信息的可见性。该功能支持自动过期、携带计数自动取消等机制，帮助模型专注于持续相关的上下文。

## 核心类

### `PinnedMessage`

表示一条被钉住的消息，包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `str` | 唯一标识 |
| `content` | `str` | 消息体 |
| `speaker` | `str` | 发言者 |
| `group_id` | `str` | 所属群组 |
| `reason` | `str` | 钉住原因 |
| `pinned_at` | `float` | 钉住时间戳 |
| `ttl_hours` | `float` | 存活时间（小时） |
| `max_carry_count` | `int` | 最大携带次数 |
| `carry_count` | `int` | 当前已携带次数 |
| `metadata` | `dict` | 额外元数据 |

### `PinnedMessageManager`

管理器，负责钉住/取消、查询、自动过期和携带计数管理。初始化时接受 `max_carry_count` 参数。

## 功能

### 钉住消息 (`pin_message`)

```python
pinned = manager.pin_message(
    content="会议时间改为下午3点",
    speaker="张三",
    group_id="group_a",
    reason="重要通知",
    ttl_hours=12.0,
    max_carry_count=50,
    metadata={"priority": "high"}
)
```

- 必须参数：`content`
- 可选参数：`speaker`, `group_id`（默认 `"default"`）, `reason`, `ttl_hours`（默认从系统常量），`max_carry_count`（默认从管理器配置），`metadata`
- 返回 `PinnedMessage` 对象

### 取消钉住消息 (`unpin_message_by_id` / `unpin_by_reason` / `unpin_by_content` / `unpin_all`)

- `unpin_message(message_id: str) -> bool`：按 ID 取消
- `unpin_by_reason(reason: str) -> int`：按原因关键词取消，返回取消条数
- `unpin_by_content(content: str) -> int`：按内容关键词取消
- `unpin_all(group_id: str) -> int`：取消指定群组的所有钉住

### 获取钉住消息 (`get_pinned_messages`)

```python
messages = manager.get_pinned_messages(group_id="group_a")
# 返回 PinnedMessage 列表
```

- 支持按 `group_id` 过滤，`None` 返回所有群组

### 用于 Prompt 注入 (`get_pinned_messages_for_prompt`)

```python
msgs = manager.get_pinned_messages_for_prompt(group_id="group_a")
```

- 返回同一群组有效钉住消息的列表
- 每次调用会增加每条消息的 `carry_count`
- 若 `carry_count` 超过 `max_carry_count`，自动取消该消息
- 若消息已超出 TTL 时间，自动取消

### 统计信息 (`get_statistics`)

```python
stats = manager.get_statistics()
# 如：{"total_pinned": 5, "active": 3, "by_reason": {"重要通知": 2}}
```

## 配置常量（位于 `sirius_pulse/core/constants.py`）

| 常量名 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_PINNED_MESSAGES` | `10` | 每个群组最大可钉住消息数量 |
| `PINNED_MESSAGE_MAX_AGE_HOURS` | `24` | 钉住消息最大保留时间（小时） |
| `PINNED_MESSAGE_MAX_CARRY_COUNT` | `100` | 钉住消息最大携带次数 |

## 与引擎的集成

### 初始化

在 `_EmotionalGroupChatEngineBase._init_pinned_messages()` 中完成：

1. 从 `experience.json` 读取 `pinned_message_max_carry_count`
2. 创建 `PinnedMessageManager` 实例
3. 将 `get_pinned_messages_for_prompt` 注入到 `Brain.set_context_fns` 中

### 公开 API

引擎提供以下方法委托给 `_pinned_manager`：

- `pin_message(...)`
- `unpin_message(message_id)`
- `unpin_by_reason(reason)`
- `get_pinned_messages(group_id=None)`
- `get_pinned_messages_for_prompt(group_id)`
- `get_pinned_statistics()`

### Hook 处理模型指令

在输出后处理阶段（priority 15）注册了 `_hook_pin_messages`，解析模型回复中的钉住/取消指令：

- 使用 `parse_pin_messages(raw_text)` 提取钉住请求
- 使用 `parse_unpin_messages(raw_text)` 提取取消请求
- 支持 `#pin` / `#unpin` 等格式（具体格式由模块内部定义）
- 取消支持：`all`（全部取消）、`reason`（按原因）、`content`（按内容）

## 在 Prompt 中的使用

`PinnedMessageManager` 获取的消息列表通过 `pinned_messages` 参数传入 `PromptFactory`，最终以系统提示形式注入模型，使模型始终保持对钉住消息的关注。

## 注意事项

- 钉住消息数量受 `MAX_PINNED_MESSAGES` 限制
- 超过 TTL 或携带计数达上限的消息会被自动清理
- 携带计数仅在通过 `get_pinned_messages_for_prompt` 获取时递增，直接获取列表不会增加计数
- 该功能需在 `experience.json` 中配置 `pinned_message_max_carry_count`，否则使用常量默认值