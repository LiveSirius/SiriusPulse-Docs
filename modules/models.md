# 模型定义模块 (models/)

## 模块概述

模型定义模块包含 Sirius Pulse 的核心数据契约，定义了消息、参与者、情感状态、意图分析等数据结构。所有模型均使用 `@dataclass` 定义，支持 JSON 序列化/反序列化。

## 核心文件

| 文件 | 职责 |
|------|------|
| `models.py` | Message, Participant, Transcript |
| `persona.py` | PersonaProfile：人格定义 |
| `emotion.py` | EmotionState, AssistantEmotionState |
| `intent_v3.py` | IntentAnalysisV3：意图分析 |
| `response_strategy.py` | ResponseStrategy, StrategyDecision |

## Message

```python
@dataclass
class Message(JsonSerializable):
    role: str                          # user / assistant / system
    content: str                       # 消息内容
    speaker: str | None = None         # 发言者名称
    nickname: str | None = None        # 昵称
    channel: str | None = None         # 渠道
    channel_user_id: str | None = None # 渠道用户 ID
    group_id: str | None = None        # 群组 ID
    multimodal_inputs: list = []       # 多模态输入
    reply_mode: str = "always"         # always / never / auto
    adapter_type: str | None = None    # 适配器类型
    sender_type: str = "human"         # human / self_ai / other_ai / system
```

## Participant

```python
@dataclass
class Participant(JsonSerializable):
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

# 外部别名
User = Participant
```

## PersonaProfile

```python
@dataclass
class PersonaProfile:
    # 身份
    name: str = "小星"
    aliases: list[str] = []
    persona_summary: str = ""
    full_system_prompt: str = ""
    
    # 性格
    personality_traits: list[str] = []
    backstory: str = ""
    core_values: list[str] = []
    flaws: list[str] = []
    
    # 表达风格
    communication_style: str = ""      # concise/detailed/formal/casual/humorous
    speech_rhythm: str = ""
    emoji_preference: str = ""         # heavy/moderate/light/none
    humor_style: str = ""              # sarcastic/wholesome/dark/dry/witty
    
    # 情感基线
    emotional_baseline: dict = {"valence": 0.2, "arousal": 0.3}
    empathy_style: str = ""            # warm/practical/distant/playful/mentor
    
    # 行为边界
    boundaries: list[str] = []
    taboo_topics: list[str] = []
    preferred_topics: list[str] = []
    social_role: str = ""              # observer/mediator/leader/jester/caregiver
    
    # 运行时偏好
    reply_frequency: str = "moderate"  # high/moderate/low/selective
    
    def build_system_prompt(self) -> str: ...
```

## EmotionState

```python
@dataclass
class EmotionState:
    valence: float = 0.0       # -1.0 ~ 1.0（消极 → 积极）
    arousal: float = 0.3       # 0.0 ~ 1.0（平静 → 激动）
    basic_emotion: BasicEmotion | None = None
    intensity: float = 0.5     # 0.0 ~ 1.0
    confidence: float = 0.8    # 0.0 ~ 1.0
```

### BasicEmotion（19 种基本情感）

```python
class BasicEmotion(Enum):
    JOY = ("喜悦", 0.8, 0.7)
    CONTENTMENT = ("满足", 0.6, 0.3)
    RELIEF = ("释然", 0.5, 0.2)
    EXCITEMENT = ("兴奋", 0.9, 0.9)
    SADNESS = ("悲伤", -0.8, 0.2)
    GRIEF = ("悲痛", -0.9, 0.3)
    ANGER = ("愤怒", -0.7, 0.9)
    IRRITATION = ("恼怒", -0.5, 0.6)
    ANXIETY = ("焦虑", -0.6, 0.8)
    FEAR = ("恐惧", -0.8, 0.9)
    DISGUST = ("厌恶", -0.6, 0.5)
    SURPRISE = ("惊讶", 0.3, 0.9)
    TRUST = ("信任", 0.7, 0.4)
    ANTICIPATION = ("期待", 0.4, 0.6)
    LOVE = ("喜爱", 0.9, 0.5)
    LONELINESS = ("孤独", -0.7, 0.3)
    GRATITUDE = ("感激", 0.8, 0.4)
    HOPE = ("希望", 0.7, 0.5)
    NEUTRAL = ("中性", 0.0, 0.3)
```

## AssistantEmotionState

AI 自身的持久化情感状态：

```python
@dataclass
class AssistantEmotionState:
    valence: float = 0.2
    arousal: float = 0.3
    inertia_factor: float = 0.3              # 惯性因子
    recovery_rate_per_10min: float = 0.1     # 恢复速率
    baseline_valence: float = 0.2
    baseline_arousal: float = 0.3
    
    def update_from_interaction(self, user_emotion, user_id): ...
    def tick_recovery(self): ...
```

## IntentAnalysisV3

意图分析结果（12 维度）：

```python
@dataclass
class IntentAnalysisV3:
    # 核心意图
    social_intent: SocialIntent = SocialIntent.CASUAL_CHAT
    intent_type: str = "chat"
    
    # 12 维度评分
    directed_score: float = 0.0        # 指向性分数
    urgency_score: float = 0.0         # 紧急度
    relevance_score: float = 0.5       # 相关性
    confidence: float = 0.8            # 置信度
    
    # 细粒度信号
    mention_score: float = 0.0         # @提及分数
    reference_score: float = 0.0       # 引用分数
    name_match_score: float = 0.0      # 名字匹配分数
    second_person_score: float = 0.0   # 第二人称分数
    question_score: float = 0.0        # 问句分数
    imperative_score: float = 0.0      # 祈使句分数
    topic_relevance_score: float = 0.0 # 话题相关性
    emotional_disclosure_score: float = 0.0  # 情感表露分数
    attention_seeking_score: float = 0.0     # 求关注分数
    recency_score: float = 0.0         # 时效性分数
    turn_taking_score: float = 0.0     # 话轮转换分数
    
    # 其他
    sarcasm_score: float = 0.0         # 讽刺分数
    entitlement_score: float = 0.0     # 资格分数
    threshold: float = 0.5             # 动态阈值
    activity_factor: float = 1.0       # 活跃因子
    time_factor: float = 1.0           # 时间因子
    engagement_factor: float = 1.0     # 参与因子
    
    # 插件相关
    plugin_intent: str | None = None
    plugin_slots: dict = {}
    plugin_render_mode: str = "direct"
```

## ResponseStrategy

```python
class ResponseStrategy(Enum):
    IMMEDIATE = "immediate"    # 立即回复
    DELAYED = "delayed"        # 延迟回复
    SILENT = "silent"          # 不回复
    PLUGIN = "plugin"          # 插件命令

@dataclass
class StrategyDecision:
    strategy: ResponseStrategy
    score: float = 0.0
    threshold: float = 0.5
    urgency: float = 0.0
    relevance: float = 0.5
    reason: str = ""
```

## Transcript

```python
@dataclass
class Transcript:
    messages: list[Message] = []
    user_memory: UserManager = UserManager()
    reply_runtime: ReplyRuntimeState = ReplyRuntimeState()
    session_summary: str = ""
    orchestration_stats: dict = {}
    token_usage_records: list[TokenUsageRecord] = []
    
    def add(self, message: Message): ...
    def compress_for_budget(self, max_messages, max_chars): ...
    def as_chat_history(self) -> list[dict]: ...
```
