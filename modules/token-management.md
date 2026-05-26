# Token 管理模块 (token/)

## 模块概述

Token 管理模块负责记录和分析 LLM 调用的 token 使用情况，支持 SQLite 持久化和成本分析。

## 核心文件

| 文件 | 职责 |
|------|------|
| `token_store.py` | TokenUsageStore：SQLite 持久化 |
| `token_utils.py` | Token 工具函数 |
| `analytics.py` | 成本分析 |
| `usage.py` | 使用统计 |
| `utils.py` | PromptTokenBreakdown 等 |

## TokenUsageStore

```python
class TokenUsageStore:
    def __init__(self, db_path, session_id="default"):
        self._db_path = Path(db_path)
        self._session_id = session_id
    
    def record(self, record: TokenUsageRecord): ...
    def get_records(self, limit=100): ...
    def get_summary(self): ...
    def clear(self): ...
```

## TokenUsageRecord

```python
@dataclass
class TokenUsageRecord(JsonSerializable):
    timestamp: str = ""
    actor_id: str = ""
    task_name: str = ""          # cognition_analyze / response_generate / ...
    model: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    input_chars: int = 0
    output_chars: int = 0
    estimation_method: str = "char_div4"
    retries_used: int = 0
    duration_ms: float = 0.0
```

## PromptTokenBreakdown

```python
@dataclass
class PromptTokenBreakdown:
    system_prompt: int = 0
    user_message: int = 0
    output_format: int = 0
    diary: int = 0
    conversation_history: int = 0
    biography: int = 0
    skill_descriptions: int = 0
    plugin_descriptions: int = 0
    total: int = 0
    
    def to_dict(self) -> dict: ...
```

## 使用场景

```python
from sirius_pulse.token.token_store import TokenUsageStore

store = TokenUsageStore(db_path="token_usage.db")

# 记录使用
store.record(TokenUsageRecord(
    task_name="response_generate",
    model="gpt-4o",
    prompt_tokens=1000,
    completion_tokens=200,
    total_tokens=1200,
))

# 获取统计
summary = store.get_summary()
```
