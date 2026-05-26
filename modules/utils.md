# 工具函数模块 (utils/)

## 模块概述

工具函数模块提供 Sirius Pulse 的通用工具函数和路径布局管理。

## 核心文件

| 文件 | 职责 |
|------|------|
| `layout.py` | WorkspaceLayout：工作区路径布局 |

## WorkspaceLayout

### 主要职责

管理工作区的目录结构和文件路径约定：

```python
class WorkspaceLayout:
    def __init__(self, data_root, config_path=None):
        self.data_root = Path(data_root)
        self.config_root = Path(config_path) if config_path else self.data_root
    
    # 目录创建
    def ensure_directories(self): ...
    
    # Provider 配置
    def provider_registry_path(self) -> Path: ...
    
    # 会话存储
    def session_store_path(self, session_id, backend="json") -> Path: ...
    def session_config_path(self) -> Path: ...
    
    # 人格配置
    def persona_path(self) -> Path: ...
    def orchestration_path(self) -> Path: ...
    
    # SKILL 数据
    def skill_data_dir(self) -> Path: ...
    
    # 工作区清单
    def workspace_manifest_path(self) -> Path: ...
```

### 目录结构

```
data_root/
    ├── global_config.json
    ├── providers/
    │   └── provider_keys.json
    ├── personas/
    │   └── {name}/
    │       ├── persona.json
    │       ├── orchestration.json
    │       ├── adapters.json
    │       ├── experience.json
    │       ├── engine_state/
    │       ├── memory/
    │       ├── diary/
    │       ├── skill_data/
    │       └── logs/
    ├── plugins/
    │   └── _config.json
    └── adapter_port_registry.json
```

## 其他工具函数

### core/utils.py

```python
def now_iso() -> str:
    """返回当前 UTC 时间的 ISO 8601 格式字符串。"""
    return datetime.now(timezone.utc).isoformat()
```

### token/utils.py

```python
class PromptTokenBreakdown:
    """Prompt token 分解统计。"""
    system_prompt: int = 0
    user_message: int = 0
    output_format: int = 0
    diary: int = 0
    conversation_history: int = 0
    total: int = 0

def estimate_tokens(text: str) -> int:
    """估算文本的 token 数量。"""
```
