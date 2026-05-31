# Evolution API

Evolution API 提供对演化链（Evolution Chain）中结构化记忆记录的访问和操作接口。该 API 支持查询、创建、更新和删除演化记录，并允许客户端根据条件筛选记录。

## Endpoints

所有端点均以 `/api/evolution/` 为前缀。

### GET /api/evolution/records

获取演化记录列表。支持按用户、谓词、对象、状态、置信度范围、时间范围等条件过滤。

**Query Parameters**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `subject_user_id` | string | 否 | 主体用户 ID |
| `predicate` | string | 否 | 谓词（精确匹配） |
| `obj` | string | 否 | 对象（精确匹配） |
| `status` | string | 否 | 状态：`ACTIVE`, `ARCHIVED`, `DELETED` |
| `min_confidence` | float | 否 | 最低置信度 (0-1) |
| `max_confidence` | float | 否 | 最高置信度 (0-1) |
| `source_type` | string | 否 | 来源类型：`MIGRATION`, `DIARY`, `MANUAL` 等 |
| `offset` | integer | 否 | 分页偏移量，默认 0 |
| `limit` | integer | 否 | 每页条数，默认 50，最大 200 |

**Response**

```json
{
  "records": [
    {
      "id": "uuid",
      "subject": "用户A",
      "subject_user_id": "user_123",
      "predicate": "喜欢",
      "obj": "猫",
      "status": "ACTIVE",
      "confidence": 0.85,
      "initial_confidence": 0.5,
      "source_type": "DIARY",
      "source_group_id": "group_001",
      "source_message_ids": ["msg_001"],
      "extracted_by_model": "gpt-4o",
      "created_at": "2025-03-01T12:00:00Z",
      "updated_at": "2025-03-01T12:00:00Z"
    }
  ],
  "total": 100,
  "offset": 0,
  "limit": 50
}
```

### POST /api/evolution/records

创建一条新的演化记录。

**Request Body**

```json
{
  "subject": "用户A",
  "subject_user_id": "user_123",
  "predicate": "喜欢",
  "obj": "猫",
  "confidence": 0.8,
  "source_type": "MANUAL",
  "source_group_id": "",
  "source_message_ids": []
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `subject` | string | 是 | 主体名称 |
| `subject_user_id` | string | 否 | 主体用户 ID，用于关联用户 |
| `predicate` | string | 是 | 谓词 |
| `obj` | string | 是 | 对象 |
| `confidence` | float | 否 | 初始置信度，默认 0.5 |
| `source_type` | string | 否 | 来源类型，默认 `MANUAL` |
| `source_group_id` | string | 否 | 来源群组 ID |
| `source_message_ids` | array[string] | 否 | 来源消息 ID 列表 |

**Response**

```json
{
  "id": "uuid",
  "subject": "用户A",
  "predicate": "喜欢",
  "obj": "猫",
  "status": "ACTIVE",
  "confidence": 0.8,
  "created_at": "2025-03-01T12:00:00Z"
}
```

### PUT /api/evolution/records/:id

更新一条演化记录（例如调整置信度、状态）。

**Path Parameters**

| 参数 | 类型 | 描述 |
|------|------|------|
| `id` | string | 记录 ID |

**Request Body**（仅包含需要更新的字段）

```json
{
  "confidence": 0.9,
  "status": "ACTIVE"
}
```

**Response**

更新后的完整记录对象。

### DELETE /api/evolution/records/:id

软删除一条演化记录（状态设为 `DELETED`）。

**Path Parameters**

| 参数 | 类型 | 描述 |
|------|------|------|
| `id` | string | 记录 ID |

**Response**

```json
{"status": "deleted", "id": "uuid"}
```

### GET /api/evolution/records/:id

获取单条记录的详细信息。

**Path Parameters**

| 参数 | 类型 | 描述 |
|------|------|------|
| `id` | string | 记录 ID |

**Response**

单个记录对象，与列表中的格式相同。

### GET /api/evolution/stats

获取演化链的统计信息，例如总记录数、各状态分布、来源分布等。

**Response**

```json
{
  "total_records": 500,
  "status_counts": {"ACTIVE": 450, "ARCHIVED": 30, "DELETED": 20},
  "source_type_counts": {"DIARY": 300, "MIGRATION": 150, "MANUAL": 50}
}
```

## 错误处理

所有端点均按标准 RESTful 方式返回错误：

| HTTP 状态码 | 描述 |
|-------------|------|
| 400 | 请求参数不合法 |
| 404 | 记录不存在 |
| 500 | 服务器内部错误 |

错误响应体：

```json
{"error": "描述信息"}
```

## 示例

### 查询用户“小明”的所有关于“喜欢”的主动记录

```shell
curl "http://localhost:8000/api/evolution/records?subject_user_id=user_xiaoming&predicate=喜欢&status=ACTIVE"
```

### 手动添加一条记录

```shell
curl -X POST "http://localhost:8000/api/evolution/records" \
  -H "Content-Type: application/json" \
  -d '{"subject": "小明", "predicate": "居住在", "obj": "北京", "confidence": 0.9}'
```

## 注意事项

- 创建记录时，`confidence` 默认为 0.5。若从迁移脚本创建，置信度固定为 0.5。
- 所有时间戳均为 UTC ISO8601 格式。
- 删除操作为软删除，记录仍保留在数据库中，但状态变为 `DELETED`。
- 分页查询建议使用 `offset` 和 `limit`，避免一次性拉取大量数据。