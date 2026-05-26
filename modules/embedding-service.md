# Embedding 微服务模块 (embedding/)

## 模块概述

Embedding 微服务是 Sirius Pulse 的向量化服务，基于 aiohttp 提供 HTTP API，支持请求合并批量推理。所有人格共享同一个 Embedding 服务实例。

## 架构设计

```
EmbeddingClient（同步客户端）
    └── HTTP POST /embed

EmbeddingServer（aiohttp 服务）
    ├── _BatchProcessor（批量推理）
    │   ├── 请求队列
    │   ├── 时间窗口合并
    │   └── SentenceTransformer.encode()
    └── HTTP API
        ├── POST /embed
        └── GET /health
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `server.py` | Embedding 微服务端 |
| `client.py` | Embedding 同步客户端 |
| `__main__.py` | CLI 入口 |

## 启动方式

```bash
# 默认启动
python -m sirius_pulse.embedding.server

# 指定参数
python -m sirius_pulse.embedding.server \
    --port 18900 \
    --model BAAI/bge-small-zh \
    --max-batch-size 32 \
    --max-wait-ms 50
```

## API 接口

### POST /embed

接收文本列表，返回 embedding 向量。

**请求**：
```json
{
  "texts": ["你好世界", "今天天气怎么样"]
}
```

**响应**：
```json
{
  "embeddings": [
    [0.1, 0.2, ...],
    [0.3, 0.4, ...]
  ]
}
```

### GET /health

健康检查。

**响应**：
```json
{
  "status": "ok",
  "model": "BAAI/bge-small-zh"
}
```

## 批量推理

### _BatchProcessor

核心批量推理处理器：

```python
@dataclass
class _BatchProcessor:
    model_name: str = "BAAI/bge-small-zh"
    max_batch_size: int = 32
    max_wait_ms: int = 50
    
    async def encode(self, texts: list[str]) -> list[list[float]]:
        """将请求入队，等待批量处理后返回结果。"""
        future = asyncio.get_running_loop().create_future()
        await self._queue.put(_PendingRequest(texts=texts, future=future))
        return await future
```

### 批量合并策略

```
请求 1 (3 条文本) ─┐
请求 2 (5 条文本) ─┤──→ 合并为 8 条文本 ──→ 一次 encode ──→ 按请求切分结果
请求 3 (2 条文本) ─┘
```

1. 至少等一个请求
2. 在 `max_wait_ms` 窗口内收集更多请求
3. 合并所有文本
4. 一次 `SentenceTransformer.encode()` 完成推理
5. 按请求切分结果并分发

### 大 batch 分片

当合并文本数超过 `MAX_ENCODE_BATCH`（64）时自动分片：

```python
def _encode_sync(self, texts):
    if len(texts) <= MAX_ENCODE_BATCH:
        return self._model.encode(texts, convert_to_tensor=False)
    
    all_results = []
    for i in range(0, len(texts), MAX_ENCODE_BATCH):
        chunk = texts[i : i + MAX_ENCODE_BATCH]
        vecs = self._model.encode(chunk, convert_to_tensor=False)
        all_results.extend(v.tolist() for v in vecs)
    return all_results
```

## EmbeddingClient

同步客户端，用于引擎内部调用：

```python
from sirius_pulse.embedding.client import EmbeddingClient

client = EmbeddingClient(base_url="http://127.0.0.1:18900")

# 健康检查
if client.check_health():
    print("Embedding 服务可用")

# 获取向量
embeddings = client.encode(["你好", "世界"])
# → [[0.1, 0.2, ...], [0.3, 0.4, ...]]
```

## 默认模型

默认使用 `BAAI/bge-small-zh` 模型：

- 中文优化的轻量级 embedding 模型
- 向量维度：512
- 支持离线加载（自动检测本地缓存）

### 模型加载

```python
def _load_model(self):
    from sentence_transformers import SentenceTransformer
    
    # 检测本地缓存
    local = _model_available_locally(self.model_name)
    if local:
        os.environ["HF_HUB_OFFLINE"] = "1"
    
    self._model = SentenceTransformer(
        self.model_name,
        local_files_only=local,
    )
```

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | 18900 | 监听端口 |
| `--model` | BAAI/bge-small-zh | 模型名称 |
| `--max-batch-size` | 32 | 最大批量大小 |
| `--max-wait-ms` | 50 | 批量合并等待窗口（毫秒） |

## 环境变量

```bash
SIRIUS_EMBEDDING_URL=http://127.0.0.1:18900
```

## 依赖

```
sentence-transformers
aiohttp
```

## 使用场景

1. **日记向量化**：日记生成后自动向量化存储到 ChromaDB
2. **语义检索**：根据查询检索相似日记条目
3. **话题增强**：增强话题相关性评分
