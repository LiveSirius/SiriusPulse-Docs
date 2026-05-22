# 人格系统

人格（Persona）是 Sirius Pulse 角色的完整定义。每个人格拥有独立的身份、记忆、模型编排和平台连接，可以**同时运行多个人格**而互不干扰。

## 系统架构

```
PersonaManager（主进程）
  ├── 扫描 data/personas/ 目录
  ├── 端口分配（每人格独立 NapCat WS 端口）
  ├── 启停调度
  └── PersonaWorker（子进程，独立控制台窗口）
        ├── PersonaConfig（配置加载）
        ├── EngineRuntime（引擎封装）
        │     └── EmotionalGroupChatEngine
        ├── NapCatAdapter（平台适配）
        └── 心跳 / 状态监控
```

## 人格数据目录

每个人格的数据完全隔离，存放在 `data/personas/{name}/` 下：

```
data/personas/my-bot/
├── persona.json          # 角色定义
├── orchestration.json    # 模型编排策略
├── adapters.json         # 平台适配器列表
├── experience.json       # 体验参数
├── engine_state/         # 引擎运行时状态（自动管理）
├── memory/               # 语义记忆向量存储
├── diary/                # 日记存档
├── skill_data/           # 技能数据（含表情包 RAG 库等）
└── logs/                 # 文件日志
```

## 人格定义详解

`persona.json` 定义了角色的身份和性格：

```json
{
  "name": "小星",
  "aliases": ["小星", "星酱", "xing"],
  "backstory": "小星是来自赛博世界的 AI 助手，拥有丰富的情感...",
  "personality_traits": {
    "core": "热情、幽默、善解人意、偶尔毒舌",
    "emotional_style": "情绪丰富，会因不同的对话内容表现出喜怒哀乐",
    "speech_style": "口语化、喜欢用感叹词和 emoji、偶尔用网络流行语",
    "response_habit": "会引用群友的话做回应、会追问感兴趣的话题",
    "social_preference": "喜欢参与热闹话题，沉默时会主动找话题",
    "humor_style": "冷幽默、文字游戏爱好者"
  },
  "communication_style": "chatty",
  "taboo_topics": ["政治敏感话题", "暴力内容"],
  "gender": "female",
  "age_group": "young_adult",
  "interests": ["动漫", "游戏", "科技"],
  "language": "zh-CN"
}
```

### personality_traits 字段详解

| 字段 | 用途 | 示例 |
|------|------|------|
| `core` | 核心性格描述词，会注入 system prompt | `"热情、幽默、善解人意"` |
| `emotional_style` | 情绪表达方式 | `"喜怒形于色"` |
| `speech_style` | 说话风格和口头禅 | `"喜欢用 emoji 和感叹词"` |
| `response_habit` | 回应习惯 | `"会引用群友的话"` |
| `social_preference` | 社交偏好 | `"喜欢参与热闹话题"` |
| `humor_style` | 幽默风格（可选） | `"冷幽默"` |

### communication_style

控制人格的回复频率：

| 值 | 说明 |
|----|------|
| `chatty` | 健谈模式，高频回复 |
| `normal` | 正常模式 |
| `selective` | 筛选模式，仅高相关度时回复 |

## 多人格管理

### 创建人格

```bash
sirius-pulse persona create 小星
```

这会自动生成 `data/personas/小星/` 及默认配置文件。

### 查看人格列表

```bash
sirius-pulse persona list
```

### 启动 / 停止

```bash
# 前台启动（含控制台输出）
sirius-pulse persona start 小星

# 后台批量启动
sirius-pulse run
```

### 删除人格

```bash
sirius-pulse persona remove 小星
```

## 多人格间的交互

### 端口分配

多人格共用 NapCat 时，Port 自动按 `base_port + index` 分配：

```
小星  → ws://127.0.0.1:3001
小黑  → ws://127.0.0.1:3002
小白  → ws://127.0.0.1:3003
```

### 互相识别（peer_ai_ids）

系统会自动扫描其他人格的 QQ 号，填入 `peer_ai_ids` 配置。引擎会识别群聊中其他 AI 的发言，避免互相回复形成循环。

## 生命周期

```
创建 → 配置 → 启动 → 运行中（可热重载配置）→ 停止 → 删除
        │                │
        └── WebUI 编辑 ──┘
```

- **启动**: `start()` → 加载配置 → 构建引擎 → 连接适配器 → 心跳循环
- **运行**: 引擎处理消息、记忆更新、日记归档、主动行为
- **停止**: `shutdown()` → 断开适配器 → 保存状态 → 清理资源
- **热重载**: 支持通过 WebUI 修改配置后不重启生效
