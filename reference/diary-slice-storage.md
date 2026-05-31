# Diary 切片存储（Diary Slice Storage）

## 概述

Diary Slice Storage 是 SiriusPulse 系统中用于持久化日记切片的存储层，包含两个互补的存储实现：

- **DiarySliceStore**：基于 JSON 文件的本地持久化，用于切片元数据及内容的保存与加载。
- **DiarySliceVectorStore**：基于 ChromaDB 的向量存储，用于切片向量的高效存储与语义检索。

该存储层替代了早期版本中仅在内存中管理切片的方式，实现了切片数据的持久化与跨会话复用。

## 架构

存储层位于 `memory/diary/` 模块下，与切片模型（`slice_models.py`）、切片检索器（`slice_retriever.py`）紧密协作。整体架构如下：

```
┌─────────────────────┐
│   DiarySliceStore   │◄── 文件存储 (JSON)
│   (文件系统)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  DiarySliceVectorStore │◄── 向量存储 (ChromaDB)
│   (持久化 embedding)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ DiarySliceRetriever │
│  三路融合检索器      │
└─────────────────────┘
```

- 创建切片时，先通过 `DiarySliceStore.append()` 追加到文件，再通过 `DiarySliceVectorStore.add()` 存入 ChromaDB。
- 启动时，`EngineCore` 从 `DiarySliceStore.load_all()` 加载所有历史切片，并添加到 `DiarySliceRetriever` 的索引中。

## DiarySliceStore（文件存储）

### 类定义

```python
class DiarySliceStore:
    def __init__(self, work_path: Path) -> None
    def save(self, group_id: str, slices: list[DiarySlice]) -> None
    def append(self, group_id: str, slices: list[DiarySlice]) -> None
    def load(self, group_id: str) -> list[DiarySlice]
    def load_all(self) -> list[DiarySlice]
    def delete(self, group_id: str) -> None
    def count(self, group_id: str) -> int
```

### 存储布局

文件存储在 `{work_path}/diary/slices/{group_id}.json`。每个文件结构如下：

```json
{
  "group_id": "group_xxx",
  "slices": [
    {
      "slice_id": "...",
      "group_id": "...",
      "content": "...",
      "summary": "...",
      "keywords": ["..."],
      "entities": ["..."],
      "triple_subjects": ["..."],
      "embedding": [0.1, 0.2, ...],
      "created_at": "..."
    }
  ]
}
```

### 接口说明

- **save**: 覆盖写入指定群组的所有切片（原子写入，使用 `atomic_write_json`）。
- **append**: 追加切片到已有数据（先加载，再合并，再保存）。
- **load**: 加载单个群组的切片列表，返回 `DiarySlice` 对象列表。文件缺失或损坏时返回空列表。
- **load_all**: 遍历 `slices/` 目录下所有 JSON 文件，合并返回全部切片。
- **delete**: 删除指定群组的切片文件。
- **count**: 返回指定群组的切片数量。

### 安全性

- 使用 `atomic_write_json` 保证写入原子性，避免部分写入。
- 读取时捕获 `OSError` 和 `json.JSONDecodeError`，异常时返回空列表。
- 文件名做安全化处理（`_safe_name`），过滤非法字符，截断长度。

## DiarySliceVectorStore（向量存储）

### 类定义

```python
class DiarySliceVectorStore:
    def __init__(self, persist_dir: str, model_name: str = "")
    # 判断是否可用
    @property
    def available(self) -> bool
    # 添加切片
    def add(self, slice: DiarySlice) -> None
    # 搜索
    def search(self, query_embedding: list[float], group_id: str, top_k: int = 10) -> list[tuple[str, float]]
```

### 存储细节

- 基于 ChromaDB 实现，持久化目录由构造函数 `persist_dir` 指定（通常为 `work_path/chroma_slices`）。
- 集合（Collection）名称固定为 `"diary_slices"`。
- 向量维度由 `model_name` 对应的 embedding 模型决定。
- 每个切片存储为 ChromaDB 的一条记录，包含：
  - `id`：切片 ID（`slice_id`）
  - `embedding`：向量
  - `metadata`：包括 `group_id` 等元数据

### 接口说明

- **available**: 检查 ChromaDB 是否可用（加载失败或未安装时返回 False）。
- **add**: 将切片向量添加到 ChromaDB。要求切片已有 `embedding` 且向量存储可用。
- **search**: 根据查询向量在指定群组内进行语义搜索，返回 `(slice_id, score)` 列表，按相似度降序排列。Score 为 cosine similarity（由 ChromaDB 内部计算）。

### 依赖

需要安装 `chromadb` 包。如果未安装或初始化失败，`available` 返回 False，所有操作静默跳过。

## 与切片检索器的集成

`DiarySliceRetriever`（三路召回检索器）在代码变更后，将语义检索从内存计算改为委托给 `DiarySliceVectorStore`：

- **添加切片**时，不仅加入内存列表，还通过 `vector_store.add(slice)` 存入向量库。
- **语义检索**时，直接调用 `vector_store.search()` 获取相似切片分数，不再使用余弦相似度手动计算。

这样既保持了检索速度，又实现了向量持久化。

## 存储布局总结

```
{work_path}/
├── diary/
│   ├── entries/        # DiaryFileStore（日记条目存储）
│   ├── slices/         # DiarySliceStore（切片 JSON 文件）
│   │   └── group_id1.json
│   │   └── group_id2.json
│   └── ...
└── chroma_slices/      # DiarySliceVectorStore（ChromaDB 持久目录）
    └── chroma.sqlite3, index 等
```

## 使用示例

### 初始化存储

```python
from pathlib import Path
from sirius_pulse.memory.diary.slice_store import DiarySliceStore
from sirius_pulse.memory.diary.slice_vector_store import DiarySliceVectorStore

work_path = Path("/path/to/work")
slice_store = DiarySliceStore(work_path)
vector_store = DiarySliceVectorStore(persist_dir=str(work_path / "chroma_slices"))
```

### 保存切片

```python
from sirius_pulse.memory.diary.slice_models import DiarySlice

# 假设已有 slice 对象列表
slices: list[DiarySlice] = [...]
# 追加到文件
slice_store.append("group_123", slices)
# 添加向量（需要切片已有 embedding）
for s in slices:
    if s.embedding:
        vector_store.add(s)
```

### 加载历史切片

```python
# 加载所有群组切片
all_slices = slice_store.load_all()
for s in all_slices:
    vector_store.add(s)  # 同时恢复向量
```

### 检索示例

```python
# 在检索器内部会使用 vector_store
retriever = DiarySliceRetriever(
    embedding_client=embedding_client,
    vector_store=vector_store
)
# 添加切片
retriever.add(slice_obj)
# 检索
results = retriever.retrieve(
    query="今天心情如何？",
    query_entities=["小明"],
    group_id="group_123"
)
```

## 注意事项

1. **性能考虑**：`load_all()` 会扫描所有切片文件并反序列化，如果切片数量较大，可能影响启动速度。建议后续优化为延迟加载或分批。
2. **数据一致性**：文件存储与向量存储是独立写入的，若写入过程中发生异常，可能出现文件已更新但向量未更新的情况。当前设计未保证强一致性。
3. **ChromaDB 依赖**：若环境中未安装 chromadb，向量存储降级为不可用，语义检索会退化（返回空字典），不会崩溃。
4. **文件编码**：JSON 文件使用 UTF-8 编码，确保中文等字符正确存储。
5. **迁移**：旧版本未使用文件存储，切片仅在内存中。升级后首次启动将从向量库（如果存在）或文件（如果存在）加载，但旧内存中的数据会丢失。建议先停止服务，确认文件存储已就绪再升级。