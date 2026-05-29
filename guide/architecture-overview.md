# 系统架构全景

> **v1.2 多人格架构的真实执行路径与模块边界**
>
> 本文档用人类易读的方式，从"一条消息怎么被处理"到"整个系统怎么运转"，完整描述 Sirius Pulse 的架构。流程图使用 Mermaid 语法。

---

## 第一章：系统全景图

### 1.1 你在看什么

Sirius Pulse 是一个**支持多人格启用的异步角色扮演程序**。想象一个 QQ 群里同时有几个不同的 AI 角色在聊天——有的活泼、有的高冷、有的毒舌——每个人格独立运行、独立记忆、独立配置。

### 1.2 进程模型

```mermaid
flowchart TD
    subgraph MainProcess["主进程"]
        CLI["python main.py run"]
        PM["PersonaManager<br/>扫描/启停/端口分配"]
        WebUI["WebUIServer<br/>aiohttp REST + WebSocket + 认证"]
        NM["NapCatManager<br/>全局安装/多实例调度"]
    end

    CLI --> PM
    CLI --> WebUI
    CLI --> NM

    subgraph PersonaA["子进程 A（人格：月白）"]
        PWA["PersonaWorker<br/>--config data/personas/月白"]
        RTA["EngineRuntime"]
        EngineA["EmotionalGroupChatEngine"]
        BrainA["Brain（LLM 中枢）"]
        AdapterA["NapCatAdapter"]
        PWA --> RTA --> EngineA
        PWA --> AdapterA
        RTA --> AdapterA
        EngineA --> BrainA
    end

    subgraph PersonaB["子进程 B（人格：Sirius）"]
        PWB["PersonaWorker<br/>--config data/personas/Sirius"]
        RTB["EngineRuntime"]
        EngineB["EmotionalGroupChatEngine"]
        BrainB["Brain（LLM 中枢）"]
        AdapterB["NapCatAdapter"]
        PWB --> RTB --> EngineB
        PWB --> AdapterB
        RTB --> AdapterB
        EngineB --> BrainB
    end

    PM -->|"subprocess.Popen<br/>CREATE_NEW_CONSOLE"| PWA
    PM -->|"subprocess.Popen<br/>CREATE_NEW_CONSOLE"| PWB
    NM -->|"共享全局二进制<br/>独立配置/日志"| AdapterA
    NM -->|"共享全局二进制<br/>独立配置/日志"| AdapterB

    PM -->|"维护"| Registry["data/adapter_port_registry.json<br/>端口分配表"]
    BrainA -->|"共用"| Providers["data/providers/provider_keys.json<br/>全局 Provider 注册表"]
    BrainB -->|"共用"| Providers
```

### 1.3 关键设计决策

| 决策 | 说明 |
|------|------|
| **独立子进程** | 每个人格一个独立进程，崩溃不影响其他人格 |
| **数据隔离** | 每个人格有自己的目录 `data/personas/{name}/`，记忆、配置、日志完全隔离 |
| **Brain 统一调用** | 所有人格共用 `provider_keys.json`，但各自有独立的 Brain 实例，LLM 调用总是通过 Brain 完成，不再散落各处 |
| **chat 串行，raw 并行** | `chat()` 通道串行化保证消息顺序；`raw_call()` 通道不受限，可与 chat 并行 |
| **NapCat 多实例** | 每个人格独立的 QQ 实例，共享全局二进制，独立配置和日志 |
| **端口自动分配** | `PersonaManager` 从 3001 开始递增分配 WebSocket 端口 |
| **内存+持久化双写** | 每次记忆写入 `basic_memory`（内存窗口）后自动同步到 `basic_store`（持久化存储），确保重启后上下文不丢失 |

---

## 第二章：主进程启动流程

### 2.1 从命令行到运行

```bash
python main.py run
```

```mermaid
flowchart TD
    A["python main.py run"] --> B["加载 data/global_config.json"]
    B --> C["创建 PersonaManager<br/>扫描 data/personas/ 目录"]
    C --> D["NapCatManager 全局安装检查<br/>自动安装缺失的 NapCat 二进制"]
    D --> E["为每个 enabled 人格<br/>分配 NapCat 端口与实例目录"]
    E --> F["为每个人格启动 NapCat 实例<br/>CREATE_NEW_CONSOLE"]
    F --> G["为每个人格启动 PersonaWorker 子进程<br/>python -m sirius_pulse.persona_worker --config {pdir}"]
    G --> H["启动 WebUIServer<br/>aiohttp REST API"]
    H --> I["主进程阻塞等待<br/>SIGTERM/SIGINT 优雅退出"]
    I --> J["停止所有子进程<br/>停止 NapCat 实例<br/>停止 WebUI"]
```

### 2.2 主进程三大组件

**PersonaManager（人格管家）**
- `create_persona(name)` — 创建新人格目录和默认配置
- `start_persona(name)` — 启动单个人格（含 NapCat 自动管理）
- `run_all()` — 批量启动所有 enabled 人格
- `get_logs(name)` — 读取子进程日志
- `get_status(name)` — 读取子进程心跳状态

**WebUIServer（管理面板）**
- 提供 REST API：人格列表、状态、配置、日志、监控
- 提供 WebSocket 事件推送：实时接收引擎事件
- 提供 JWT 认证：admin/viewer 角色权限控制
- 提供静态页面：Dashboard + 配置面板 + 监控页面
- 不直接操作 NapCat 进程，只通过 API 与 PersonaManager 交互

**NapCatManager（QQ 管理器）**
- 管理 NapCat 全局二进制（安装、更新）
- 为每个人格创建独立实例目录
- 启动/停止 NapCat 进程

---

## 第三章：人格子进程启动流程

### 3.1 子进程内部发生了什么

```mermaid
flowchart TD
    A["PersonaWorker.run()"] --> B["加载配置<br/>adapters.json / experience.json /<br/>orchestration.json / persona.json"]
    B --> C["创建 EngineRuntime<br/>work_path=人格目录<br/>global_data_path=data/"]
    C --> D["启动 EngineRuntime<br/>懒加载 EmotionalGroupChatEngine<br/>创建 Brain（LLM 中枢）"]
    D --> E["为每个 enabled adapter<br/>创建 NapCatAdapter"]
    E --> F["adapter.start()<br/>启动 WebSocket 连接"]
    F --> G["启动心跳循环<br/>每 10 秒写入 worker_status.json"]
    G --> H["阻塞等待关闭信号"]
    H --> I["清理：停止 adapter、停止 runtime"]
```

### 3.2 子进程内的关键协作

- 所有 bridge 共享同一个 `EngineRuntime` 和同一个 Brain 实例
- 每个 bridge 有自己的 `allowed_group_ids` 配置
- engine 的 `_pending_reminders` 是共享的（所有 bridge 都能投递提醒）
- Brain 是单例的，`chat()` 串行执行，`raw_call()` 可与 chat 并行

---

## 第四章：消息处理完整流程

### 4.1 一条消息的一生

假设群里有人发了一条消息："今天工作好累"，看看它怎么被处理。

```mermaid
flowchart TD
    A["QQ 群消息<br/>'今天工作好累'"] --> B["NapCatAdapter<br/>OneBot v11 事件"]
    B --> C["NapCatAdapter.on_message()<br/>解析事件 → 提取内容/发送者/群号"]
    C --> D["EngineRuntime.process_message()"]
    D --> E["EmotionalGroupChatEngine.process_message()"]

    subgraph Perception["① 感知层（零 LLM 成本）"]
        E --> P1["IdentityResolver.resolve()<br/>'今天工作好累' 是谁发的？"]
        P1 --> P2["UserManager.register()<br/>更新/创建用户档案"]
        P2 --> P3["BasicMemoryManager.add_entry()<br/>加入群聊窗口<br/>并持久化到 basic_store"]
        P3 --> P4["RhythmAnalyzer.analyze()<br/>计算群聊热度"]
        P4 --> P5["emit PERCEPTION_COMPLETED"]
    end

    subgraph Cognition["② 认知层（统一 CognitionAnalyzer）"]
        P5 --> C1["联合规则引擎<br/>零成本热路径（~90% 命中率）"]
        C1 --> C2["单次 LLM fallback<br/>通过 Brain.raw_call()"]
        P5 --> C3["记忆检索<br/>BasicMemory + DiaryManager"]
        C2 --> C4["emit COGNITION_COMPLETED"]
        C3 --> C4
    end

    subgraph Decision["③ 决策层（纯规则，零 LLM 成本）"]
        C4 --> D1["RhythmAnalyzer<br/>heat_level / pace / topic_stability"]
        D1 --> D2["ThresholdEngine<br/>threshold = base × activity × engagement × time"]
        D2 --> D3["ResponseStrategyEngine<br/>IMMEDIATE / DELAYED / SILENT / PROACTIVE"]
        D3 --> D4["更新 AssistantEmotionState"]
        D4 --> D5["emit DECISION_COMPLETED"]
    end

    subgraph Execution["④ 执行层"]
        D5 --> X1{"策略？"}
        X1 --"IMMEDIATE"--> X2["立即生成回复"]
        X1 --"DELAYED"--> X3["入 DelayedResponseQueue<br/>等待话题间隙"]
        X1 --"SILENT"--> X4["仅更新内部状态<br/>不生成回复"]
        X1 --"PROACTIVE"--> X5["由 ProactiveTrigger 外部触发<br/>生成自然开场白"]
        X2 --> X6["PromptFactory.assemble_chat()<br/>组装 prompt"]
        X6 --> X7["StyleAdapter 输出长度/语气指令"]
        X7 --> X8["ModelRouter 选择模型"]
        X8 --> X9["Brain.chat()<br/>→ 获取串行锁<br/>→ 构建 gen_request<br/>→ _call_with_retry(rebuild_fn)<br/>→ Provider.generate_async()"]
        X9 --> X10["解析 SKILL_CALL"]
        X10 --> X11["Token 追踪记录"]
        X11 --> X12["emit EXECUTION_COMPLETED"]
    end

    X12 --> U["_background_update()<br/>更新群体氛围 + 群规范学习 + 反馈结算 + 情感孤岛检测"]
```

> **新增持久化说明**：在 `BasicMemoryManager.add_entry()` 步骤中，消息不仅被加入内存窗口（最近 30 条），还会通过 `engine.basic_store.append()` 持久化到磁盘。这意味着即使引擎重启，基本记忆仍然可以恢复，对话上下文不会丢失。此持久化同样适用于 AI 回复记录和 SKILL 执行结果。

### 4.2 认知层内部细节

```mermaid
flowchart TD
    A["消息内容 + 上下文"] --> B{"规则引擎置信度<br/>≥ 0.9 ?"}
    B --"是（~90%）"--> C["零 LLM 成本返回"]
    B --"否（~10%）"--> D["Brain.raw_call() →<br/>单次 LLM 请求（轻量模型）<br/>自动 transport 重试"]

    subgraph RuleEngine["联合规则引擎"]
        A --> E1["情感词典匹配<br/>valence / arousal / intensity"]
        A --> E2["意图模式匹配<br/>social_intent / subtype"]
        A --> E3["12维指向性信号<br/>mention / reference / name_match / ..."]
        A --> E4["讽刺检测<br/>5 类启发式规则"]
        A --> E5["资格感判断<br/>persona 与话题重叠度"]
        E1 --> C
        E2 --> C
        E3 --> C
        E4 --> C
        E5 --> C
    end

    subgraph LLMFallback["单次 LLM fallback"]
        D --> F1["轻量模型请求联合 JSON"]
        F1 --> F2["返回完整分析结果"]
    end

    C --> G["上下文融合<br/>情感轨迹 + 群体氛围 + 助手情绪"]
    F2 --> G
    G --> H["返回三元组<br/>EmotionState + IntentAnalysisV3 + EmpathyStrategy"]
```

### 4.3 延迟回复的触发

```mermaid
sequenceDiagram
    participant User as 用户
    participant QQ as QQ 群
    participant Adapter as NapCatAdapter
    participant Engine as EmotionalEngine
    participant Brain as Brain
    participant LLM as Provider

    User->>QQ: "今天工作好累"
    QQ->>Adapter: OneBot v11 消息事件
    Adapter->>Engine: process_message()
    Engine->>Engine: 感知层 + 认知层 + 决策层
    Engine-->>Engine: 策略 = DELAYED
    Engine->>Engine: 加入 DelayedResponseQueue
    Engine-->>Adapter: 返回（无立即回复）

    Note over Adapter,Engine: 3 秒后，后台投递循环

    Adapter->>Engine: tick_delayed_queue()
    Engine->>Engine: 话题间隙就绪度 = 0.8 > threshold
    Engine->>Engine: 触发延迟回复生成
    Engine->>Engine: PromptFactory.assemble_chat() 组装 prompt
    Engine->>Brain: Brain.chat(request)
    Note over Brain: 获取串行锁 → 构建 gen_request
    Brain->>LLM: _call_with_retry() → provider.generate_async()
    Note over Brain,LLM: 失败时自动重试 3 次<br/>重试前刷新上下文
    LLM-->>Brain: "辛苦啦！周末好好休息~"
    Brain-->>Engine: ChatResult
    Engine->>Engine: Token 追踪
    Engine-->>Adapter: 返回回复文本
    Adapter->>QQ: 发送群消息
    QQ->>User: "辛苦啦！周末好好休息~"
```

### 4.4 四种响应策略的触发条件

| 策略 | 触发场景 | 行为 |
|------|---------|------|
| **IMMEDIATE** | 被 @、紧急求助、高 relevance | 立即生成并发送回复 |
| **DELAYED** | 一般性对话、话题间隙不够 | 加入队列，等自然间隙再回 |
| **SILENT** | 无关话题、低 relevance、冷却中 | 不回复，只后台学习 |
| **PROACTIVE** | 群聊沉默过久、记忆触发、情感触发 | 主动发起新话题 |

---

## 第五章：后台任务系统

### 5.1 引擎后台任务

引擎内置 6 个后台任务，另有被动 SKILL 注册的任务（如 reminder）并行运行：

```mermaid
flowchart LR
    subgraph BG["内置后台任务（并行运行）"]
        T1["任务1<br/>延迟队列 ticker<br/>智能休眠（3-30s）"]
        T2["任务2<br/>主动触发 checker<br/>每 60 秒"]
        T3["任务3<br/>日记生成 promoter<br/>每 180 秒"]
        T4["任务4<br/>日记 consolidator<br/>每 600 秒"]
        T5["任务5<br/>开发者私聊 checker<br/>每 60 秒"]
        T6["任务6<br/>表情包新鲜度更新<br/>每 3600 秒"]
    end

    subgraph PassiveSK["被动 SKILL 任务"]
        T7["reminder checker<br/>每 15 秒<br/>通过 create_background_tasks() 注册"]
    end

    T1 -->|"检测话题间隙<br/>触发延迟回复"| Engine["EmotionalGroupChatEngine"]
    T2 -->|"检查沉默群聊<br/>生成主动发言"| Engine
    T3 -->|"冷群检测<br/>LLM 生成日记"| Engine
    T4 -->|"合并相似日记"| Engine
    T5 -->|"检查开发者私聊"| Engine
    T6 -->|"衰减 novelty_score<br/>模拟喜新厌旧"| Engine
    T7 -->|"扫描到期提醒<br/>支持 once/interval/daily/weekly"| Engine
```

### 5.2 提醒系统完整链路

提醒是一个**双模式 SKILL**：主动模式由模型调用 `run()` 创建/管理提醒，被动模式通过 `create_background_tasks(ctx)` 注册周期性检查任务。

```mermaid
sequenceDiagram
    participant User as 用户
    participant AI as AI 回复
    participant Skill as reminder SKILL (active)
    participant Store as SkillDataStore
    participant Passive as reminder 被动任务
    participant Engine as EmotionalEngine
    participant Adapter as NapCatAdapter
    participant QQ as QQ 群

    User->>AI: "提醒我明天下午 3 点开会"
    AI->>AI: 生成回复含 [SKILL_CALL: reminder]
    AI->>Skill: 执行 reminder.run()
    Skill->>Store: 存入 skill_data/reminder.json
    Note over Engine: 引擎自动注入 group_id 和 adapter_type

    Note over Passive: 被动任务 checker（每 15 秒）
    Passive->>Passive: _check_and_fire_reminders(ctx)
    Passive->>Passive: 扫描 reminder.json
    Passive->>Passive: 发现到期提醒
    Passive->>Passive: _execute_skill_chain()（若有预执行链）
    Passive->>Passive: _generate_reminder_message(ctx)
    Passive->>Passive: LLM 生成人格化提醒
    Passive->>Passive: 放入 _pending_reminders[group_id]

    Note over Adapter: 事件总线监听
    Adapter->>Engine: pop_reminders(gid, adapter_type)
    Engine-->>Adapter: 返回提醒消息
    Adapter->>QQ: _send_group_text_raw()
    QQ->>User: "月白提醒：下午 3 点的会议别忘了哦~"
```

---

## 第六章：数据流与存储

### 6.1 全局共享数据

| 路径 | 说明 | 谁读写 |
|------|------|--------|
| `data/global_config.json` | WebUI 参数、NapCat 管理、日志级别 | 主进程读写 |
| `data/providers/provider_keys.json` | Provider 凭证（所有人格共用） | 主进程/子进程读 |
| `data/adapter_port_registry.json` | NapCat 端口分配表 | PersonaManager 维护 |

### 6.2 人格隔离数据

```mermaid
flowchart TD
    subgraph PersonaDir["data/personas/{name}/"]
        Config["配置层"]
        State["运行状态"]
        Memory["记忆层"]
        SkillData["SKILL 数据"]
        Logs["日志"]
    end

    subgraph Config
        C1["persona.json<br/>人格定义"]
        C2["orchestration.json<br/>模型编排"]
        C3["adapters.json<br/>平台适配器"]
        C4["experience.json<br/>体验参数"]
    end

    subgraph State
        S1["engine_state/persona.json<br/>运行时人格状态"]
        S2["engine_state/worker_status.json<br/>子进程心跳"]
        S3["engine_state/enabled<br/>启停标志"]
    end

    subgraph Memory
        M1["memory/basic/<group_id>.jsonl<br/>基础记忆（30条内存窗口）"]
        M2["memory/diary/<group_id>.jsonl<br/>日记记忆"]
        M3["memory/diary/index/<group_id>.json<br/>日记索引"]
        M4["memory/glossary/terms.json<br/>名词解释（人格级隔离）"]
        M5["memory/semantic/<br/>群语义画像"]
        M6["memory/basic_store/<group_id>.jsonl<br/>持久化基础记忆（所有条目）"]
    end

    subgraph SkillData
        SD1["skill_data/reminder.json<br/>提醒数据"]
        SD2["skill_data/*.json<br/>其他 SKILL 数据"]
        SD3["skill_data/stickers/<br/>表情包 RAG 库"]
    end

    subgraph Logs
        L1["logs/worker.log<br/>子进程主日志"]
        L2["logs/archive/<br/>归档日志"]
    end
```

> **记忆持久化机制**：`basic_memory`（内存窗口）保留最近 30 条消息，用于对话上下文；每次调用 `add_entry` 后，引擎会自动调用 `basic_store.append()` 将相同条目写入 `memory/basic_store/` 下的独立 JSONL 文件。这样即使引擎重启，也可以通过 `basic_store` 恢复完整的对话历史。此机制适用于用户消息、AI 回复、SKILL 执行结果等所有需要写入记忆的文本。

### 6.3 NapCat 多实例数据

```mermaid
flowchart T
```