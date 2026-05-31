# Biography API

## 概述

Biography API 提供查看、刷新和管理用户传记的端点。传记由记忆演化链、日记切片和语义画像自动生成。该 API 基于 FastAPI 构建，是 Sirius Pulse WebUI 的组成部分。

## 认证

所有端点都需要通过 `X-API-Key` 请求头传递有效的 API 密钥，或使用基于会话的认证（JWT）。具体配置请参考 WebUI 主文档。

## 端点

### 1. 获取传记（默认）

**`GET /api/biography/{user_id}`**

返回指定用户的主要传记文本。

**参数**

| 名称 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| `user_id` | string | path | 是 | 用户 ID（UUID）或用户名 |
| `format` | string | query | 否 | 输出格式：`text`（默认）或 `json` |

**响应（format=text）**
- Content-Type: `text/plain`
- Body: 纯文本传记

**响应（format=json）**
```json
{
  "user_id": "string",
  "biography": "string",
  "generated_at": "2025-03-20T12:34:56Z",
  "sources": ["evolution_chain", "diary"],
  "confidence": 0.85
}
```

---

### 2. 获取完整传记

**`GET /api/biography/{user_id}/full`**

返回详细传记，包括所有底层演化记录、日记引用和语义画像。

**参数**

| 名称 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| `user_id` | string | path | 是 | 用户 ID（UUID）或用户名 |
| `include_raw` | boolean | query | 否 | 是否包含原始演化记录（默认：`false`） |

**响应**
```json
{
  "user_id": "string",
  "biography": "string",
  "generated_at": "2025-03-20T12:34:56Z",
  "evolution_records": [
    {
      "record_id": "uuid",
      "subject": "Alice",
      "predicate": "loves",
      "obj": "gardening",
      "confidence": 0.95,
      "status": "active",
      "source_type": "extraction"
    }
  ],
  "diary_sources": [
    {
      "group_id": "string",
      "entry_id": "string",
      "excerpt": "string",
      "date": "2025-03-19"
    }
  ],
  "semantic_profile": {
    "dominant_topic": "hobbies",
    "interest_topics": ["coding", "reading"]
  }
}
```

---

### 3. 刷新传记

**`POST /api/biography/{user_id}/refresh`**

强制从底层记忆源重新生成传记。这是一个异步操作，会立即返回任务 ID。

**参数**

| 名称 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| `user_id` | string | path | 是 | 用户 ID（UUID）或用户名 |

**响应**
```json
{
  "task_id": "uuid",
  "status": "queued",
  "estimated_time_seconds": 30
}
```

查询任务状态：`GET /api/tasks/{task_id}`

---

### 4. 列出传记用户

**`GET /api/biography/users`**

返回已有传记的用户列表。

**响应**
```json
{
  "users": [
    {
      "user_id": "string",
      "name": "Alice",
      "last_generated": "2025-03-20T12:00:00Z"
    }
  ]
}
```

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 400 | 无效的 user_id 或参数 |
| 401 | 认证失败 |
| 404 | 用户未找到 |
| 500 | 服务器内部错误（如生成失败） |

## 说明

- 传记由演化链、日记归档和语义记忆动态生成。默认传记文本是用户最重要信息的浓缩。
- `/full` 端点用于调试和数据检查，可能返回较大的响应体。
- 刷新传记不会删除现有传记，而是创建新版本。历史版本可通过历史端点访问（参见版本管理文档）。

## 相关文档

- [演化链 API](./evolution-api.md)
- [WebUI API](./webui-api.md)
- [日记切片存储](./diary-slice-storage.md)
