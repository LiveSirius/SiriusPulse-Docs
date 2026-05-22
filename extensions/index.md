# 扩展开发

Sirius Pulse 通过 **技能 (Skills)** 和 **插件 (Plugins)** 两大扩展机制，让开发者可以为 AI 角色赋予自定义能力。

## 技能 vs 插件：如何选择？

| | 技能 (Skill) | 插件 (Plugin) |
|---|---|---|
| **调用方式** | AI 模型通过 `[SKILL_CALL: ...]` 标记自主调用 | 用户通过 `/` `#` `!` 等前缀显式命令触发 |
| **适用场景** | AI 在对话中主动使用工具（搜索、读文件、设置提醒） | 用户向 AI 发送指令（`/weather`、`/mute`） |
| **输出处理** | 结果注入到 model 上下文中，AI 用自然语言整合 | 可直出（direct）、可 LLM 人格化（llm）、可静默（silent） |
| **开发复杂度** | 简单：写一个 Python 函数 + 元数据字典 | 中等：继承 PluginBase + `@command` 装饰器 |
| **典型用例** | Bing 搜索、系统信息、文件读写 | 天气查询、群管理、自定义命令 |

## 快速导航

### 技能系统
- [总览](./skill-overview) — 技能系统架构、SKILL_CALL 机制、执行流程
- [编写自定义技能](./skill-authoring) — 从零创建技能，参数定义、返回值规范
- [内置技能参考](./skill-builtin) — 13 个内置技能的详细说明
- [被动技能开发](./skill-passive) — 后台任务、事件触发器、生命周期回调

### 插件系统
- [总览](./plugin-overview) — 插件系统架构、命令分发、渲染模式
- [编写自定义插件](./plugin-authoring) — PluginBase 继承、@command 装饰器
- [指令系统详解](./plugin-command) — Tokenizer、Lexer、Parser 完整解析链路
- [生命周期与上下文](./plugin-lifecycle) — PluginContext、EngineProxy、数据持久化
