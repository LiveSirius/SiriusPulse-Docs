# 会话管理模块 (session/)

## 模块概述

会话管理模块负责对话历史的持久化存储，支持 JSON 文件和 SQLite 两种后端。管理消息记录、用户画像、回复运行时状态和 token 使用统计。

## 核心文件

| 文件 | 职责 |
|------|------|
| `store.py` | SessionStore 协议及实现 |

## 存储后端

### SessionStore 协议

```python
class SessionStore(Protocol):
    @property
    def path(self) -> Path: ...
    
    def exists(self) -> bool: ...
    
    def load(self) -> Transcript: ...
    
    def save(self, transcript: Transcript) -> None: ...
    
    def clear(self) -> None: ...
```

### JsonSessionStore

JSON 文件后端，适合小规模使用：

```python
store = JsonSessionStore(work_path="./data", filename="session_state.json")

# 加载
transcript = store.load()

# 保存
store.save(transcript)

# 清空
store.clear()
```

### SqliteSessionStore

SQLite 关系数据库后端，适合大规模使用：

```python
store = SqliteSessionStore(work_path="./data", filename="session_state.db")
```

#### 数据库表结构

| 表名 | 说明 |
|------|------|
| `_meta` | 元数据（schema 版本等） |
| `session_meta` | 会话元数据（摘要、编排统计） |
| `session_messages` | 消息记录 |
| `session_reply_runtime` | 回复运行时状态 |
| `session_reply_runtime_user_turns` | 用户发言时间 |
| `session_reply_runtime_group_turns` | 群聊消息时间序列 |
| `session_reply_runtime_assistant_turns` | AI 回复时间序列 |
| `session_user_profiles` | 用户画像 |
| `session_user_runtime` | 用户运行时数据 |
| `session_user_memory_facts` | 用户记忆事实 |
| `session_token_usage_records` | Token 使用记录 |

## Transcript

### 数据结构

```python
@dataclass
class Transcript:
    messages: list[Message]                    # 消息列表
    user_memory: UserManager                   # 用户管理
    reply_runtime: ReplyRuntimeState           # 回复运行时状态
    session_summary: str = ""                  # 会话摘要
    orchestration_stats: dict = {}             # 编排统计
    token_usage_records: list[TokenUsageRecord] = []  # Token 使用记录
```

### 消息管理

```python
transcript = Transcript()

# 添加消息
transcript.add(Message(
    role="user",
    content="你好",
    speaker="小明",
))

# 记住参与者
transcript.remember_participant(
    participant=Participant(name="小明", user_id="user_123"),
    content="消息内容",
    group_id="group_456",
)

# 查找用户
user = transcript.find_user_by_channel_uid(
    channel="napcat",
    uid="123456789",
    group_id="group_456",
)
```

### 预算压缩

当消息数量或字符数超出预算时，自动压缩旧消息为摘要：

```python
transcript.compress_for_budget(
    max_messages=24,
    max_chars=6000,
)
```

压缩逻辑：
1. 超出 `max_messages` 的旧消息被归档为摘要
2. 持续检查总字符数，超出 `max_chars` 时继续压缩
3. 摘要追加到 `session_summary` 字段

### 聊天历史导出

```python
history = transcript.as_chat_history()
# → [
#     {"role": "user", "content": "小明: 你好"},
#     {"role": "assistant", "content": "你好呀！"},
# ]
```

## Message

```python
@dataclass
class Message:
    role: str                          # user / assistant / system
    content: str                       # 消息内容
    speaker: str | None = None         # 发言者名称
    nickname: str | None = None        # 昵称
    channel: str | None = None         # 渠道（如 napcat）
    channel_user_id: str | None = None # 渠道用户 ID
    group_id: str | None = None        # 群组 ID
    multimodal_inputs: list = []       # 多模态输入
    reply_mode: str = "always"         # 回复模式
    adapter_type: str | None = None    # 适配器类型
    sender_type: str = "human"         # 发送者类型
```

## Participant

```python
@dataclass
class Participant:
    name: str                              # 显示名称
    user_id: str = ""                      # 唯一标识（自动生成 UUID）
    persona: str = ""                      # 用户人设
    identities: dict[str, str] = {}        # 跨平台身份映射
    aliases: list[str] = []                # 别名
    traits: list[str] = []                 # 特征
    group_memberships: dict[str, Any] = {} # 群组成员关系
    metadata: dict[str, Any] = {}          # 元数据
    
    @property
    def is_developer(self) -> bool: ...    # 是否为开发者
```

## ReplyRuntimeState

```python
@dataclass
class ReplyRuntimeState:
    user_last_turn_at: dict[str, str] = {}           # 用户最近发言时间
    group_recent_turn_timestamps: list[str] = []     # 群聊消息时间序列
    last_assistant_reply_at: str = ""                 # AI 最近回复时间
    assistant_reply_timestamps: list[str] = []        # AI 回复时间序列（频率限制用）
```

## 数据目录结构

```
data/personas/{name}/
    └── engine_state/
        ├── session_state.json     # JSON 后端
        └── session_state.db       # SQLite 后端
```
