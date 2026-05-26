# 人格资产生成模块 (persona_generation/)

## 模块概述

人格资产生成模块负责从模板或用户输入生成人格配置资产，支持多种生成方式。

## 核心文件

| 文件 | 职责 |
|------|------|
| `templates.py` | 人格模板定义 |
| `builders.py` | 人格构建器 |

## 生成方式

1. **模板生成**：从预定义模板快速创建人格
2. **关键词生成**：从关键词列表生成人格
3. **访谈生成**：通过问答形式生成人格
4. **角色扮演桥接**：从外部角色扮演配置导入

## 使用示例

```python
from sirius_pulse.persona_generation import load_generated_agent_library

agents, selected = load_generated_agent_library(work_path)
```

## 人格资产目录

```
data/personas/{name}/
    ├── persona.json           # 人格定义
    ├── orchestration.json     # 模型编排
    ├── adapters.json          # 平台适配器
    └── experience.json        # 体验参数
```
