# Biography API

## Overview

Biography API provides endpoints to view, refresh, and manage user biographies. Biographies are generated from memory evolution records, diary slices, and semantic profiles. The API is built on FastAPI and is part of the Sirius Pulse WebUI.

## Authentication

All endpoints require a valid API key passed via the `X-API-Key` header, or session-based authentication (JWT). Refer to the main WebUI documentation for setup.

## Endpoints

### 1. Get Biography (Default)

**`GET /api/biography/{user_id}`**

Returns the main biography text for the specified user.

**Parameters**

| Name | Type | In | Required | Description |
|------|------|----|----------|-------------|
| `user_id` | string | path | yes | User ID (UUID) or username |
| `format` | string | query | no | Output format: `text` (default) or `json` |

**Response (format=text)**
- Content-Type: `text/plain`
- Body: Plain text biography.

**Response (format=json)**
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

### 2. Get Full Biography

**`GET /api/biography/{user_id}/full`**

Returns detailed biography including all underlying evolution records, diary references, and semantic profiles.

**Parameters**

| Name | Type | In | Required | Description |
|------|------|----|----------|-------------|
| `user_id` | string | path | yes | User ID (UUID) or username |
| `include_raw` | boolean | query | no | Include raw evolution records (default: `false`) |

**Response**
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

### 3. Refresh Biography

**`POST /api/biography/{user_id}/refresh`**

Forces an immediate regeneration of the biography from underlying memory sources. This is an asynchronous operation; returns immediately with a task ID.

**Parameters**

| Name | Type | In | Required | Description |
|------|------|----|----------|-------------|
| `user_id` | string | path | yes | User ID (UUID) or username |

**Response**
```json
{
  "task_id": "uuid",
  "status": "queued",
  "estimated_time_seconds": 30
}
```

To check task status: `GET /api/tasks/{task_id}`

---

### 4. List Biography Users

**`GET /api/biography/users`**

Returns a list of users that have biographies available.

**Response**
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

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Invalid user_id or parameters |
| 401 | Authentication failure |
| 404 | User not found |
| 500 | Internal server error (e.g., generation failure) |

## Notes

- Biographies are dynamically generated from the evolution chain, diary archive, and semantic memory. The default biography text is a condensation of the user’s most important facts.
- The `/full` endpoint is intended for debugging and data inspection; it may return large payloads.
- Refreshing a biography does not delete the existing one; it creates a new version. Previous versions can be accessed via history endpoints (see versioning documentation).

## Related Documents

- [Evolution Chain API](./evolution-api.md)
- [Memory Dashboard API](./memory-api.md)
- [Diary API](./diary-api.md)