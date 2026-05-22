# 人格配置

人格级配置文件存放在 `data/personas/{name}/` 目录下，包括四个独立文件。

## persona.json — 角色定义

```json
{
  "name": "小星",
  "aliases": ["小星", "星酱"],
  "backstory": "角色背景故事",
  "personality_traits": {
    "core": "核心性格",
    "emotional_style": "情绪表达方式",
    "speech_style": "说话风格",
    "response_habit": "回应习惯",
    "social_preference": "社交偏好",
    "humor_style": "幽默风格（可选）"
  },
  "communication_style": "chatty",
  "taboo_topics": ["话题1", "话题2"],
  "gender": "female",
  "age_group": "young_adult",
  "interests": ["兴趣1", "兴趣2"],
  "language": "zh-CN"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | str | ✅ | 角色名（唯一标识） |
| `aliases` | list[str] | ❌ | 别名列表 |
| `backstory` | str | ❌ | 背景故事 |
| `personality_traits` | dict | ✅ | 六个维度的性格特质 |
| `communication_style` | str | ❌ | `chatty` / `normal` / `selective` |
| `taboo_topics` | list[str] | ❌ | 敏感话题回避列表 |
| `gender` | str | ❌ | `male` / `female` / `other` |
| `age_group` | str | ❌ | `child` / `teen` / `young_adult` / `adult` / `elder` |
| `interests` | list[str] | ❌ | 兴趣标签 |
| `language` | str | ❌ | 语言代码，如 `zh-CN` |

## orchestration.json — 模型编排

```json
{
  "chat_model": "deepseek-chat",
  "analysis_model": "deepseek-chat",
  "vision_model": null,
  "proactive_model": "deepseek-chat",
  "embedding_model": null
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `chat_model` | str | (必填) | 对话生成模型名 |
| `analysis_model` | str | (必填) | 认知分析模型名（建议用轻量模型） |
| `vision_model` | str | `null` | 图片理解模型名（可选） |
| `proactive_model` | str | 同 chat | 主动发起的模型名 |
| `embedding_model` | str | `null` | 覆盖全局嵌入模型（可选） |

模型名需与 Provider 配置中的名称对应（如 `deepseek-chat`、`Qwen/Qwen2.5-7B-Instruct`）。

## adapters.json — 平台适配器

```json
{
  "adapters": [
    {
      "type": "napcat",
      "ws_url": "ws://127.0.0.1:3001",
      "qq": 123456789,
      "ws_token": "your-token",
      "group_whitelist": [],
      "private_whitelist": [],
      "peer_ai_ids": []
    }
  ]
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | str | `"napcat"` | 适配器类型 |
| `ws_url` | str | ❌ | NapCat WebSocket 地址 |
| `qq` | int | ❌ | QQ 号 |
| `ws_token` | str | ❌ | WebSocket 认证 token |
| `group_whitelist` | list[int] | `[]` | 群聊白名单（空=不限制） |
| `private_whitelist` | list[int] | `[]` | 私聊白名单（空=不限制） |
| `peer_ai_ids` | list[int] | `[]` | 群中其他 AI 的 QQ 号 |

## experience.json — 体验参数

```json
{
  "sensitivity": 0.7,
  "reply_frequency": "normal",
  "proactive_behavior": "low",
  "memory_depth": 5,
  "skill_timeout": 30.0,
  "plugin_timeout": 30.0,
  "max_response_tokens": 512,
  "temperature": 0.8,
  "cooldown_seconds": 5.0,
  "private_chat_reply_always": true,
  "cross_group_memory": true,
  "send_stickers": true,
  "log_inner_thoughts": false
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sensitivity` | float (0-1) | `0.7` | 回复敏感度 |
| `reply_frequency` | str | `"normal"` | `high` / `normal` / `selective` |
| `proactive_behavior` | str | `"low"` | 主动发起对话强度 |
| `memory_depth` | int | `5` | 携带的历史消息数 |
| `skill_timeout` | float | `30.0` | 技能执行超时（秒） |
| `plugin_timeout` | float | `30.0` | 插件执行超时（秒） |
| `max_response_tokens` | int | `512` | 单次回复最大 token |
| `temperature` | float | `0.8` | 模型随机性（0-2） |
| `cooldown_seconds` | float | `5.0` | 群聊回复冷却 |
| `private_chat_reply_always` | bool | `true` | 私聊是否实时回复 |
| `cross_group_memory` | bool | `true` | 启用跨群记忆 |
| `send_stickers` | bool | `true` | 自动发送表情包 |
| `log_inner_thoughts` | bool | `false` | 记录内心活动 |

### reply_frequency 效果

| 值 | engine 行为 |
|----|------------|
| `high` | 降低回复阈值，更频繁地参与对话 |
| `normal` | 标准行为 |
| `selective` | 提高阈值，仅高相关度时回复 |
