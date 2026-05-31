# 记忆演化链（Memory Evolution Chain）

记忆演化链是 SiriusPulse 记忆系统的一个独立子模块，用于管理记忆的渐进式演化。它通过记录结构化三元组（subject-predicate-obj）并标记其来源、置信度、状态，支持记忆的逐步验证、替换和合并，从而实现记忆从原始观察到稳定知识的动态演进。

## 概述

传统记忆系统通常将用户描述、关系、身份锚点等事实直接存储，但这些事实可能包含噪声、矛盾或过时信息。记忆演化链引入了一种**链式进化**机制：

- 每条记忆记录（`EvolutionRecord`）都是一个有向边（subject → predicate → obj），附带元信息。
- 记录具有**置信度**（confidence），初始值可能较低，随着时间或交叉验证逐步提升。
- 记录可以处于不同**状态**（ACTIVE、PENDING、DEPRECATED 等），允许废弃旧记录并用新记录替换。
- 每条记录都标记**来源类型**（MetaTag），以区分是人工输入、LLM 提取、迁移数据还是系统推断。

该模块主要用于：
- 将旧系统的记忆数据（distilled_points、identity_anchors、relationships）迁移到结构化演化链。
- 在后台持续从对话中提取新事实并加入链中。
- 支持 Web UI 查看和管理演化链。

## 核心组件

### EvolutionRecord
定义在 `models.py` 中，表示一条演化记录：

| 字段 | 类型 | 说明 |
|------|------|------|
| `subject` | str | 主体（通常为人名或实体名） |
| `subject_user_id` | str | 主体对应的用户 ID（方便关联用户） |
| `predicate` | str | 谓词（关系/动作/属性） |
| `obj` | str | 宾语（值、实体名或其他描述） |
| `status` | RecordStatus | 记录状态（ACTIVE 等） |
| `confidence` | float | 置信度 0.0~1.0 |
| `initial_confidence` | float | 初始置信度 |
| `source_type` | MetaTag | 来源类型（MIGRATION、LLM_EXTRACT、USER_INPUT 等） |
| `source_group_id` | str | 来源对话群组 ID（可选） |
| `source_message_ids` | list[str] | 来源消息 ID 列表 |
| `extracted_by_model` | str | 提取该记录的模型标识（如 `gpt-4o-mini` 或 `migration:direct`） |

### MetaTag (标签枚举)
定义记录的生产方式：

| 标签 | 含义 |
|------|------|
| `MIGRATION` | 从旧系统迁移而来 |
| `LLM_EXTRACT` | 由 LLM 从对话中提取 |
| `USER_INPUT` | 用户直接输入 |
| `SYSTEM_INFERRED` | 系统推理产生 |

### RecordStatus (状态枚举)

| 状态 | 含义 |
|------|------|
| `ACTIVE` | 当前活跃的记录 |
| `PENDING` | 待验证 |
| `DEPRECATED` | 已被替代或废弃 |

### EvolutionChain
定义在 `chain.py` 中，是演化链的核心管理类。

- `__init__(conn: sqlite3.Connection)`：接受数据库连接。
- `_persist_record(record: EvolutionRecord)`：将记录写入数据库。
- `query(subject: str | None = None)`：按主体查询记录。
- `get_active_records(subject: str)`：获取指定主体的全部活跃记录。
- `update_status(record_id: str, new_status: RecordStatus)`：更新记录状态。
- `close()`：关闭连接。

### Store (存储层)
定义在 `store.py` 中，封装了 SQLite 表的创建、插入、查询逻辑。表结构如下：

```sql
CREATE TABLE IF NOT EXISTS evolution_records (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    subject_user_id TEXT,
    predicate TEXT NOT NULL,
    obj TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    confidence REAL NOT NULL DEFAULT 0.5,
    initial_confidence REAL NOT NULL DEFAULT 0.5,
    source_type TEXT NOT NULL,
    source_group_id TEXT,
    source_message_ids TEXT,
    extracted_by_model TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

## 数据流

### 1. 数据迁移
迁移脚本 `scripts/migrate_to_evolution.py` 将旧系统的以下数据源转化为 `EvolutionRecord`：

- **distilled_points**：通过 LLM 提取结构化三元组（subject-predicate-obj），使用模型从 provider 配置中自动读取。
- **identity_anchors**：直接转换为 `(subject='用户', predicate='是', obj='锚点内容')`。
- **relationships**：转换为 `(subject='用户', predicate='关系', obj='目标名称')`。

迁移时置信度固定为 0.5（中等偏低），便于后续验证或替换。来源标记为 `MetaTag.MIGRATION`。

### 2. 运行时提取
在后台任务（`bg_tasks.py`、`bg_tasks_delayed.py`）中，系统会定期检查对话群组，对“暂冷”状态（cold state）的群组进行情景提取，产生 `EvolutionRecord` 并存入演化链。此部分使用了 `ColdDetector` 来判定群组冷热程度。

### 3. Web UI 展示
通过 `evolution_api.py` 提供 REST 接口，前端 `evolution-chain.html` 和 `evolution-chain.js` 实现可视化查看和管理演化链。

## 与其他模块的关系

- **`sirius_pulse.memory.biography`**：传记模块可以引用演化链中的记录作为人物传记的支撑事实。
- **`sirius_pulse.memory.situation`**：情景提取器产生的结构化信息会注入演化链。
- **`sirius_pulse.core.bg_tasks`**：后台任务调度提取流程。
- **`sirius_pulse.core.engine_core`**：引擎核心通过 `EvolutionChain` 实例访问演化数据。

## 配置

演化链模块无需额外配置文件。其依赖的 LLM 模型和 API Key 从 `data/providers/provider_keys.json` 或环境变量中读取。

如使用迁移脚本，需确保：
- `SIRIUS_API_KEY`、`SIRIUS_BASE_URL`、`SIRIUS_MODEL` 环境变量已设置，或 provider_keys.json 存在。
- 数据库文件（`persona.db` 或 `memory.db`）存在于 `--work-path` 指定的目录。

## 使用示例

### 手动迁移旧数据
```bash
python scripts/migrate_to_evolution.py --work-path /path/to/data/persona_name
```

### 通过代码添加记录
```python
from sirius_pulse.memory.evolution.chain import EvolutionChain
from sirius_pulse.memory.evolution.models import EvolutionRecord, MetaTag, RecordStatus
import sqlite3

conn = sqlite3.connect("persona.db")
chain = EvolutionChain(conn=conn)

record = EvolutionRecord(
    subject="Alice",
    subject_user_id="user_123",
    predicate="喜欢",
    obj="编程",
    status=RecordStatus.ACTIVE,
    confidence=0.8,
    initial_confidence=0.8,
    source_type=MetaTag.LLM_EXTRACT,
    source_group_id="group_abc",
    source_message_ids=["msg_001"],
    extracted_by_model="gpt-4o-mini",
)
chain._persist_record(record)
chain.close()
```

## 注意事项

- 演化链中的记录是可变的（状态、置信度可更新），设计上期望通过多次验证提升置信度。
- 迁移脚本会标记所有记录为 `MIGRATION`，后续可通过 Web UI 或 API 手动调整状态。
- 建议定期检查 `DEPRECATED` 记录，清理无用数据。