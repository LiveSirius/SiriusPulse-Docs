# 平台适配模块 (platforms/)

## 模块概述

平台适配模块负责将 Sirius Pulse 引擎与外部聊天平台（如 QQ）对接。采用**适配器模式**，通过 `BaseAdapter` 抽象平台差异，当前实现了 NapCat OneBot v11 协议适配。

## 架构设计

```
EngineRuntime
    ├── EmotionalGroupChatEngine
    └── NapCatAdapter (BaseAdapter)
            ├── WebSocket 连接
            ├── OneBot v11 API
            ├── 事件解析
            └── 消息发送
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `runtime.py` | EngineRuntime：引擎运行时封装 |
| `onebot_v11/napcat/adapter.py` | NapCatAdapter：NapCat OneBot v11 适配器 |
| `onebot_v11/napcat/manager.py` | NapCatManager：NapCat 环境管理 |
| `onebot_v11/protocol.py` | OneBot v11 协议定义 |
| `adapters/base.py` | BaseAdapter：适配器基类 |
| `adapters/models.py` | 消息段模型（MessageGroup, TextSegment 等） |

## EngineRuntime

### 主要职责

1. **Provider 构建**：从配置/环境变量创建 LLM Provider
2. **引擎创建**：创建并管理 EmotionalGroupChatEngine 实例
3. **SKILL 运行时**：发现和挂载 SKILL 注册表
4. **Plugin 运行时**：加载和初始化 Plugin 系统
5. **状态管理**：加载/保存引擎状态

### 初始化流程

```python
class EngineRuntime:
    def __init__(self, work_path, plugin_config=None, global_data_path=None):
        self.work_path = Path(work_path)
        self.global_data_path = Path(global_data_path)
        self.plugin_config = dict(plugin_config or {})
        self._engine = None
        self.token_store = TokenUsageStore(...)
```

### Provider 构建优先级

```
1. 全局 ProviderRegistry（data/providers/provider_keys.json）
2. 人格级 ProviderRegistry（兼容旧版）
3. 插件配置中的 providers 字段
4. 环境变量（SIRIUS_PROVIDER_TYPE, SIRIUS_API_KEY 等）
```

### 引擎启动

```python
async def start(self):
    # 1. 构建 Provider
    provider = self._build_provider()
    
    # 2. 创建向量存储（ChromaDB）
    vector_store = DiaryVectorStore(work_path / "diary" / "vector_db")
    
    # 3. 创建 Embedding 客户端
    embedding_client = EmbeddingClient(base_url="http://127.0.0.1:18900")
    
    # 4. 创建引擎
    self._engine = create_emotional_engine(
        work_path=self.work_path,
        provider=provider,
        persona=persona,
        config=config,
        vector_store=vector_store,
        embedding_client=embedding_client,
    )
    
    # 5. 挂载 SKILL 运行时
    self._setup_skill_runtime(self._engine)
    
    # 6. 挂载 Plugin 运行时
    await self._setup_plugin_runtime(self._engine)
    
    # 7. 启动后台任务
    self._engine.start_background_tasks()
```

### SKILL 运行时挂载

```python
def _setup_skill_runtime(self, engine):
    registry = SkillRegistry()
    registry._load_builtin_skills(auto_install_deps=True)
    registry.load_from_directory(work_path / "skills", auto_install_deps=True)
    
    executor = SkillExecutor(work_path)
    engine.set_skill_runtime(
        skill_registry=registry,
        skill_executor=executor,
    )
```

### Plugin 运行时挂载

```python
async def _setup_plugin_runtime(self, engine):
    # 1. 扫描 plugins/ 目录
    loader = PluginLoader(plugins_dir)
    definitions = loader.load_all_definitions()
    
    # 2. 导入 Python 类并注册
    registry = PluginRegistry()
    for definition in definitions:
        plugin_class = loader.import_plugin_class(definition.source_path)
        registry.register(definition)
    
    # 3. 创建执行器和调度器
    executor = PluginExecutor(registry, ...)
    dispatcher = OutputDispatcher()
    
    # 4. 实例化所有 Plugin
    await executor.instantiate_all()
    
    # 5. 注入到引擎
    engine.set_plugin_runtime(
        plugin_registry=registry,
        plugin_executor=executor,
        plugin_dispatcher=dispatcher,
    )
```

## NapCatAdapter

### 主要职责

1. **WebSocket 连接**：正向 WebSocket 连接 NapCat
2. **API 调用**：OneBot v11 API 请求
3. **事件解析**：OneBot 事件 → ParsedEvent
4. **消息发送**：带限流的消息发送
5. **引擎集成**：事件总线监听、主动消息投递

### 连接管理

```python
class NapCatAdapter(BaseAdapter):
    _RECONNECT_BASE_DELAY = 1.0
    _RECONNECT_MAX_DELAY = 30.0
    _MAX_RECONNECT_ATTEMPTS = 5
    
    async def connect(self):
        self._running = True
        self._reconnect_task = asyncio.create_task(self._reconnect_loop())
    
    async def _reconnect_loop(self):
        # 指数退避重连
        delay = self._RECONNECT_BASE_DELAY
        while self._running:
            if await self._connect_once():
                delay = self._RECONNECT_BASE_DELAY
                self._listen_task = asyncio.create_task(self._listen_loop())
                await self._listen_task
            else:
                await asyncio.sleep(delay)
                delay = min(delay * 2, self._RECONNECT_MAX_DELAY)
```

### API 调用

```python
async def call_api(self, action, params):
    # 消息发送限流：每群/私聊每秒最多 1 条
    if self._is_send_action(action):
        channel = self._send_channel_key(action, params)
        async with self._api_send_lock:
            last = self._last_api_call_at.get(channel, 0.0)
            elapsed = time.monotonic() - last
            if elapsed < 1.0:
                await asyncio.sleep(1.0 - elapsed)
            resp = await self._call_api_inner(action, params)
            self._last_api_call_at[channel] = time.monotonic()
            return resp
    return await self._call_api_inner(action, params)
```

### 事件解析

```python
async def parse_event(self, event):
    # 1. 提取发送者信息
    nickname, card = self.extract_sender_names(event)
    
    # 2. 渲染消息（表情→文字、@→昵称、图片标签）
    if msg_type == "group":
        prompt = await self._render_group_prompt(event, self_id, gid)
    elif msg_type == "private":
        prompt = await self._render_private_prompt(event)
    
    # 3. 收集多模态输入（图片缓存）
    multimodal_inputs = []
    for seg in event.get("message", []):
        if seg.get("type") == "image":
            local_path = await self.cache_image(url)
            multimodal_inputs.append({"type": "image", "value": local_path})
    
    return ParsedEvent(
        group_id=gid,
        user_id=uid,
        content=prompt,
        multimodal_inputs=multimodal_inputs,
        ...
    )
```

### 消息发送

```python
async def send_group_message(self, group_id, message):
    segments = self._message_group_to_onebot(message)
    return await self.call_api("send_group_msg", {
        "group_id": int(group_id),
        "message": segments,
    })

# MessageGroup 转 OneBot 消息段
def _message_group_to_onebot(message):
    segments = []
    for seg in message:
        if isinstance(seg, TextSegment):
            segments.append({"type": "text", "data": {"text": seg.text}})
        elif isinstance(seg, AtSegment):
            segments.append({"type": "at", "data": {"qq": seg.user_id}})
        elif isinstance(seg, ImageSegment):
            segments.append({"type": "image", "data": {"file": seg.file_path}})
    return segments
```

### 引擎事件总线监听

```python
async def _event_bus_listener(self):
    """监听引擎事件总线，处理主动消息、延迟回复、提醒等。"""
    async for event in self._engine.event_bus.subscribe():
        if event.type == SessionEventType.PROACTIVE_MESSAGE:
            await self._handle_proactive_message(event)
        elif event.type == SessionEventType.DELAYED_RESPONSE_TRIGGERED:
            await self._handle_delayed_response(event)
        elif event.type == SessionEventType.REMINDER_DUE:
            await self._handle_reminder(event)
```

## NapCatManager

### 主要职责

1. **安装管理**：自动下载安装 NapCat
2. **配置生成**：生成 NapCat 配置文件
3. **实例管理**：启动/停止 NapCat 实例
4. **状态检测**：检查安装状态、运行状态、端口监听

### 实例隔离

每个人格拥有独立的 NapCat 实例目录：

```
napcat/instances/{persona_name}/
    ├── config/         # 独立配置
    ├── logs/           # 独立日志
    ├── data/           # 登录凭证持久化
    └── qqnt.json       # 从全局复制
```

### 自动安装

```python
async def install(self, version="latest"):
    # 1. 从 GitHub Release 获取下载链接
    tag, download_url = await self._fetch_release_info(version)
    
    # 2. 下载 ZIP
    zip_path = await self._download_file(download_url)
    
    # 3. 解压到 install_dir
    self._extract_zip(zip_path)
```

### 配置生成

```python
def configure(self, qq_number, ws_port=3001, ws_token="napcat_ws"):
    # 生成 napcat_{qq}.json（核心配置）
    # 生成 onebot11_{qq}.json（OneBot v11 协议配置）
```

## 消息段模型

```python
# BaseAdapter 接口
class BaseAdapter:
    async def send_group_message(self, group_id, message): ...
    async def send_private_message(self, user_id, message): ...

# 消息段类型
class TextSegment:   text: str
class AtSegment:     user_id: str
class ImageSegment:  file_path: str, url: str
class VoiceSegment:  file_path: str
class ReplySegment:  message_id: str
class FileSegment:   file_path: str, name: str

# 消息组
MessageGroup = list[TextSegment | AtSegment | ImageSegment | ...]
```

## 配置示例

### adapters.json

```json
{
  "adapters": [
    {
      "type": "napcat",
      "enabled": true,
      "ws_url": "ws://localhost:3001",
      "token": "napcat_ws",
      "qq_number": "123456789",
      "allowed_group_ids": ["987654321"],
      "peer_ai_ids": ["111222333"],
      "enable_group_chat": true,
      "enable_private_chat": true
    }
  ]
}
```
