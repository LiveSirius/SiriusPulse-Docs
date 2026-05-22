# 引擎架构

EmotionalGroupChatEngine 是 Sirius Pulse 的核心，负责从消息输入到回复输出的完整处理链路。

## 混合架构

引擎通过 **Mixin 模式** 组合三大子系统：

```python
class EmotionalGroupChatEngine(
    PipelineMixin,         # 5 阶段管线
    BackgroundTasksMixin,  # 6 个后台任务
    HelpersMixin           # 技能集成、工具方法
):
    pass
```

## 5 阶段管线

每条消息经过完整的 5 阶段处理：

```
消息到达
  │
  ▼
┌──────────────────────────────────────────────┐
│ 1. Perception（感知）                          │
│   ├── 身份解析（IdentityResolver）              │
│   ├── 用户登记（UserManager）                   │
│   ├── 写入 basic_memory                        │
│   └── 更新时间戳                                │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│ 2. Cognition（认知）                           │
│   ├── 情绪分析（emotion）                       │
│   ├── 意图识别（intent classification）         │
│   ├── 共情度计算（empathy）                     │
│   ├── 语义记忆检索（semantic_memory.search）     │
│   └── 日记检索（diary retrieval）               │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│ 3. Decision（决策）                            │
│   ├── 插件快速路径（PLUGIN_COMMAND 意图）        │
│   ├── 动态阈值计算（ThresholdEngine）            │
│   ├── 策略选择（StrategyEngine）                 │
│   ├── 冷却检测（cooldown check）                 │
│   └── 私聊兜底（private chat floor）            │
│                                                 │
│   策略类型：IMMEDIATE / DELAYED / SILENT / PLUGIN│
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│ 4. Execution（执行）                           │
│   ├── PLUGIN: 执行插件命令                      │
│   ├── IMMEDIATE/DELAYED: 入延迟队列             │
│   ├── 节奏缺口抑制（RhythmAnalyzer）             │
│   ├── 过热抑制（overheat suppression）          │
│   └── 短消息抑制（short message filter）        │
└───────────────┬──────────────────────────────┘
                │ 延迟队列释放后
                ▼
┌──────────────────────────────────────────────┐
│ 5. Background（后台更新）                       │
│   ├── 氛围更新（atmosphere update）              │
│   ├── 名称记录                                  │
│   └── 用户内容累积                              │
└──────────────────────────────────────────────┘
```

## 核心子系统

### 认知分析器（CognitionAnalyzer）

联合分析情绪和意图。输入最近 N 条历史消息 + 当前消息，输出 `IntentAnalysisV3` + `EmotionState`。

### 阈值引擎（ThresholdEngine）

动态计算回复阈值，考虑因素：

- 灵敏度设置（sensitivity）
- 群聊热度（heat）
- 消息速率（message_rate）
- 用户画像（user_profile）
- 人格回复频率偏置

### 策略引擎（ResponseStrategyEngine）

根据阈值和意图选择策略：
- **IMMEDIATE**: 直接回复
- **DELAYED**: 延迟回复（等待确认窗口）
- **SILENT**: 不回复
- **PLUGIN**: 执行插件命令

### 节奏分析器（RhythmAnalyzer）

监控群聊节奏，检测：
- **加速中**（accelerating）：活跃讨论
- **平稳**（steady）：正常节奏
- **减速中**（decelerating）：话题冷却
- **沉默**（silent）：无人发言

### 延迟响应队列（DelayedResponseQueue）

非立即回复进入延迟队列，在确认窗口后释放。支持队列合并（连续发送多条消息时合并为一条回复）。

## Brain 系统

Brain 是引擎的 LLM 调用层，支持：

- **任务路由**: 根据 task_name（response_generate, cognition_analyze, proactive_generate）选择合适的模型
- **Post-Hooks 链**: 回复生成后的后置处理，按优先级执行：

| 优先级 | Hook | 功能 |
|--------|------|------|
| 0 | `_hook_depth` | 对话深度追踪 |
| 20 | `_hook_stickers` | 表情包发送 |
| 30 | `_hook_dedup` | 回复去重 |
| 40 | `_hook_memory` | 记忆记录（basic + semantic） |
| 50 | `_hook_timestamp` | 回复时间戳 + 持久化 |

## 后台任务

引擎运行 6 个后台异步任务：

| 任务 | 间隔 | 功能 |
|------|------|------|
| 延迟响应轮询 | 1s | 释放到期延迟回复 |
| 主动行为评估 | 可变 | 评估是否需要主动发起对话 |
| 日记归档 | 可变 | 群聊沉寂后归档对话 |
| 记忆维护 | 可变 | 语义记忆整理和衰减 |
| 状态持久化 | 300s | 全量保存运行时状态 |
| 提醒检查 | 10s | 到期提醒分发（来自 reminder skill） |

## 记忆持久化

引擎在以下时机进行持久化：
- 每次回复后（单群状态）
- 定期全量保存（300 秒间隔）
- 引擎停止时

持久化内容包括：basic_memory、时间戳、emotion、delay_queue、token_usage、diary、proactive_state。

详见 [记忆系统](./memory-system)。
