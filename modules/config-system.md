# 配置系统模块 (config/)

## 模块概述

配置系统负责管理 Sirius Pulse 的各类配置，包括全局配置、人格配置、会话配置等。支持 JSONC 格式、环境变量替换、配置合并与验证。

## 核心文件

| 文件 | 职责 |
|------|------|
| `manager.py` | ConfigManager：配置加载、验证、合并 |
| `models.py` | 配置数据模型（SessionConfig, WorkspaceConfig 等） |
| `helpers.py` | 配置辅助函数 |
| `jsonc.py` | JSONC 解析器 |
| `file_io.py` | 文件读写工具 |
| `config_helpers.py` | 配置构建辅助 |

## 配置层次

```
全局配置 (global_config.json)
    ├── 全局 Provider 配置
    ├── NapCat 基础端口
    └── 日志级别

人格配置 (personas/{name}/)
    ├── persona.json         # 人格定义
    ├── orchestration.json   # 模型编排
    ├── adapters.json        # 平台适配器
    └── experience.json      # 体验参数

会话配置 (SessionConfig)
    ├── 工作路径
    ├── 人格预设
    ├── 历史限制
    └── 编排策略
```

## ConfigManager

### 加载配置

```python
manager = ConfigManager(base_path=Path("./"))

# 从 JSON 文件加载
config = manager.load_from_json("session.json")

# 加载工作区配置
workspace_config = manager.load_workspace_config(
    work_path="./data",
    data_path="./data",
)

# 构建会话配置
session_config = manager.build_session_config(
    work_path="./data",
    session_id="default",
    overrides={"history_max_messages": 50},
)
```

### 配置合并

```python
merged = manager.merge_configs(
    base={"a": 1, "b": {"c": 2}},
    override={"b": {"d": 3}, "e": 4},
)
# → {"a": 1, "b": {"c": 2, "d": 3}, "e": 4}
```

## 配置数据模型

### ExpressivenessConfig

单旋钮活泼度调节器：

```python
@dataclass
class ExpressivenessConfig:
    expressiveness: float = 0.5  # 0.0~1.0
    overrides: dict[str, float] = {}
    
    # 派生阈值（自动推导）
    @property
    def directed_threshold(self) -> float:
        """0.0→0.8, 0.5→0.6, 1.0→0.4"""
        return 0.8 - self.expressiveness * 0.4
    
    @property
    def cooldown_seconds(self) -> float:
        """0.0→90s, 0.5→30s, 1.0→5s"""
        return 90 - self.expressiveness * 85
```

### SessionConfig

```python
@dataclass
class SessionConfig:
    work_path: Path
    data_path: Path
    preset: AgentPreset
    history_max_messages: int = 24
    history_max_chars: int = 6000
    max_recent_participant_messages: int = 5
    enable_auto_compression: bool = True
```

### WorkspaceConfig

```python
@dataclass
class WorkspaceConfig:
    work_path: Path
    data_path: Path
    layout_version: str
    active_agent_key: str
    session_defaults: SessionDefaults
    orchestration_defaults: dict
    agent_library: dict[str, AgentPreset]
```

### OrchestrationPolicy

多模型编排策略：

```python
@dataclass
class OrchestrationPolicy:
    # 方式 1：统一模型
    unified_model: str = ""
    
    # 方式 2：按任务配置
    task_models: dict[str, str] = {}
    
    # 任务启用控制
    task_enabled: dict[str, bool] = {
        "memory_extract": True,
        "cognition_analyze": True,
    }
    
    # 每任务参数调优
    task_temperatures: dict[str, float] = {}
    task_max_tokens: dict[str, int] = {}
    
    # 技能系统
    enable_skills: bool = True
    max_skill_rounds: int = 3
    skill_execution_timeout: float = 30.0
```

### MemoryPolicy

```python
@dataclass
class MemoryPolicy:
    max_facts_per_user: int = 50
    transient_confidence_threshold: float = 0.85
    event_dedup_window_minutes: int = 5
    max_observed_set_size: int = 100
    decay_schedule: dict[int, float] = {
        7: 0.95,    # 7 天后衰减到 95%
        30: 0.80,   # 30 天后衰减到 80%
        60: 0.55,
        90: 0.30,
        180: 0.05,
    }
```

## 环境变量替换

配置文件中支持环境变量引用：

```json
{
  "api_key": "${OPENAI_API_KEY}",
  "base_url": "https://${API_HOST}/v1"
}
```

解析时自动替换为环境变量值。

## JSONC 支持

支持带注释的 JSON 格式：

```jsonc
{
  // 这是注释
  "model": "gpt-4o",
  /* 多行
     注释 */
  "temperature": 0.7
}
```

## 人格级配置

### persona.json

```json
{
  "name": "小星",
  "aliases": ["星酱", "Star"],
  "persona_summary": "一个活泼可爱的 AI 助手",
  "personality_traits": ["活泼", "好奇", "友善"],
  "backstory": "来自未来的 AI 助手...",
  "communication_style": "casual",
  "reply_frequency": "moderate"
}
```

### orchestration.json

```json
{
  "analysis_model": "gpt-4o-mini",
  "chat_model": "gpt-4o",
  "memory_model": "gpt-4o-mini",
  "plugin_model": "gpt-4o-mini",
  "task_temperatures": {
    "cognition_analyze": 0.3,
    "response_generate": 0.7
  }
}
```

### experience.json

```json
{
  "reply_mode": "auto",
  "engagement_sensitivity": 0.5,
  "expressiveness": 0.5,
  "proactive_enabled": true,
  "proactive_interval_seconds": 300,
  "memory_depth": "deep",
  "enable_skills": true
}
```

## 配置验证

```python
from sirius_pulse.config.config_helpers import _validate_config

_validate_config(config_dict)
# 验证必填字段、类型、范围等
```

## 配置文件位置

```
data/
    ├── global_config.json           # 全局配置
    ├── providers/
    │   └── provider_keys.json       # Provider 凭证
    ├── personas/{name}/
    │   ├── persona.json             # 人格定义
    │   ├── orchestration.json       # 模型编排
    │   ├── adapters.json            # 平台适配器
    │   └── experience.json          # 体验参数
    └── plugins/
        └── _config.json             # 插件配置
```
