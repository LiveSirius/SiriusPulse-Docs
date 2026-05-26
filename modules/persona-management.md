# 人格管理模块 (persona_*)

## 模块概述

人格管理模块负责多人格的生命周期管理，包括人格目录扫描、子进程调度、配置管理和状态监控。采用**主进程-子进程架构**，每个人格运行在独立的控制台窗口中。

## 架构设计

```
主进程 (python main.py run)
    ├── PersonaManager          # 人格生命周期管理
    │       ├── 扫描 personas/ 目录
    │       ├── 创建/删除人格
    │       ├── 启动/停止子进程
    │       └── 端口分配管理
    │
    └── 子进程 (PersonaWorker)
            ├── 加载人格配置
            ├── 创建 EngineRuntime
            ├── 启动 NapCatAdapter
            └── 心跳循环
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `persona_manager.py` | 主进程人格管理器 |
| `persona_worker.py` | 子进程入口 |
| `persona_config.py` | 人格级配置模型 |
| `platforms/runtime.py` | EngineRuntime 运行时封装 |

## PersonaManager

### 主要职责

1. **目录扫描**：扫描 `personas/` 目录，返回所有人格元信息
2. **人格创建**：创建人格目录及默认配置
3. **人格删除**：停止进程、删除目录、释放端口
4. **进程管理**：启动/停止人格子进程
5. **端口分配**：从 3001 开始递增分配 WebSocket 端口

### 端口管理

```python
# 端口分配表存储位置
data/adapter_port_registry.json

# 分配逻辑
base_port = global_config.get("napcat_base_port", 3001)
port = base_port
while port in used or not is_port_free(port):
    port += 1
```

### 人格创建流程

```
create_persona(name)
    ├── 创建 personas/{name}/ 目录
    ├── 生成 persona.json（PersonaProfile）
    ├── 分配端口 → 生成 adapters.json
    ├── 生成 experience.json（体验参数）
    ├── 生成 orchestration.json（模型编排）
    └── 创建 stickers/ 目录
```

### 进程管理

```python
# 启动人格
manager.start_persona("akane")
# → subprocess.Popen([python, -m, sirius_pulse.persona_worker, --config, ...])

# 停止人格
manager.stop_persona("akane")
# → taskkill /PID {pid} /T /F (Windows)
# → os.kill(pid, signal.SIGTERM) (Linux)
```

## PersonaWorker

### 生命周期

```
run()
    ├── 1. 加载配置（adapters.json, experience.json）
    ├── 2. 自动发现同项目其他 AI 的 QQ 号
    ├── 3. 创建 EngineRuntime
    ├── 4. 启动引擎（runtime.start()）
    ├── 5. 创建并启动各平台 Adapter
    ├── 6. 启动心跳循环
    ├── 7. 阻塞等待关闭信号
    └── 8. 清理资源
```

### Adapter 启动

```python
async def _start_adapter(adapter_cfg, plugin_config):
    # 1. 检查 NapCat WS 是否可达
    ok = await self._ensure_napcat_running(adapter_cfg)
    
    # 2. 创建 NapCatAdapter
    adapter = NapCatAdapter(
        ws_url=adapter_cfg.ws_url,
        token=adapter_cfg.token,
        work_path=self.persona_dir,
        config={...},
    )
    
    # 3. 连接并启动事件处理
    await adapter.connect()
    await adapter.start_handling(self._runtime.engine)
    
    # 4. 注册到 SKILL 系统
    self._runtime.add_skill_bridge("napcat", adapter)
```

### NapCat 自动管理

如果 NapCat WS 不可达，自动：

1. 查找全局 NapCat 安装目录
2. 下载安装 NapCat（如果未安装）
3. 配置 NapCat 实例
4. 启动 NapCat 实例
5. 等待 WS 就绪（最多 180 秒）

### 心跳机制

```python
async def _heartbeat_loop(self):
    while self._running:
        self._write_status({
            "status": "running",
            "pid": os.getpid(),
            "heartbeat_at": now_iso(),
        })
        self._check_enabled_flag()
        await asyncio.sleep(10)
```

状态文件位置：`engine_state/worker_status.json`

## PersonaConfigPaths

### 配置文件路径约定

```python
class PersonaConfigPaths:
    @property
    def persona(self) -> Path:        # persona.json
    def orchestration(self) -> Path:  # orchestration.json
    def adapters(self) -> Path:       # adapters.json
    def experience(self) -> Path:     # experience.json
    def engine_state(self) -> Path:   # engine_state/
    def image_cache(self) -> Path:    # image_cache/
```

## NapCatAdapterConfig

### 配置字段

```python
@dataclass
class NapCatAdapterConfig:
    type: str = "napcat"
    enabled: bool = True
    ws_url: str = "ws://localhost:3001"
    token: str = "napcat_ws"
    qq_number: str = ""
    allowed_group_ids: list[str] = []
    allowed_private_user_ids: list[str] = []
    peer_ai_ids: list[str] = []       # 同项目其他 AI 的 QQ 号
    enable_group_chat: bool = True
    enable_private_chat: bool = True
    root: str = ""
```

## PersonaExperienceConfig

### 体验参数

```python
@dataclass
class PersonaExperienceConfig:
    # 参与决策
    reply_mode: str = "auto"           # auto|always|never
    engagement_sensitivity: float = 0.5
    expressiveness: float = 0.5        # 0.0~1.0 单旋钮活泼度
    
    # 主动行为
    proactive_enabled: bool = True
    proactive_interval_seconds: float = 300.0
    
    # 延迟回复
    delay_reply_enabled: bool = True
    pending_message_threshold: float = 4.0
    
    # 回复频率限制
    min_reply_interval_seconds: float = 0.0
    reply_frequency_max_replies: int = 8
    
    # 技能系统
    enable_skills: bool = True
    max_skill_rounds: int = 3
    
    # 记忆深度
    memory_depth: str = "deep"         # shallow|moderate|deep
```

## 人格迁移

支持从旧版单人格目录迁移到新的多人格结构：

```python
manager.migrate_persona(source_dir="./old_data", name="akane")
```

迁移内容：
- persona.json / orchestration.json
- engine_state/（记忆、情绪、状态等）
- image_cache/
- qq_bridge_config.json → adapters.json
- memory/, diary/, token/, skill_data/ 等子目录

## 数据目录结构

```
data/
    ├── personas/
    │   ├── akane/
    │   │   ├── persona.json
    │   │   ├── orchestration.json
    │   │   ├── adapters.json
    │   │   ├── experience.json
    │   │   ├── engine_state/
    │   │   │   ├── worker_status.json
    │   │   │   └── ...
    │   │   ├── memory/
    │   │   ├── diary/
    │   │   ├── image_cache/
    │   │   ├── stickers/
    │   │   ├── skill_data/
    │   │   └── logs/
    │   └── yuki/
    │       └── ...
    └── adapter_port_registry.json
```
