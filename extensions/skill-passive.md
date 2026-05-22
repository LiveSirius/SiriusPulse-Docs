# 被动技能开发

被动技能（Passive Skill）无需 AI 主动调用，在引擎启动后自动运行。适用于后台监控、定时任务、事件响应等场景。

## 三种被动模式

| 模式 | 说明 | 场景 |
|------|------|------|
| **后台任务** | 定时循环执行 | 定时检查、数据同步 |
| **事件触发器** | 响应引擎事件 | 新成员入群、对话开始 |
| **生命周期回调** | 加载/卸载时执行 | 资源初始化、清理 |

一个技能可以同时拥有多种模式。

## 后台任务

### 基本结构

```python
SKILL_META = {
    "name": "my_monitor",
    "description": "一个定期检查的后台技能",
    "version": "1.0",
    "parameters": {},  # 被动技能通常没有参数
}

# 不需要 run 函数

def create_background_tasks(context):
    """
    返回 BackgroundTaskSpec 列表。
    context 实现了 SkillEngineContext 协议，可以访问引擎能力。
    """
    from sirius_pulse.skills import BackgroundTaskSpec

    async def check_loop(context):
        """后台循环逻辑"""
        while True:
            try:
                # 执行检查逻辑
                result = await do_something(context)

                if result:
                    # 通过引擎发送通知
                    for group_id in context.get_active_groups():
                        await context.queue_pending_message(
                            group_id=group_id,
                            text=f"监测到变化: {result}",
                        )
            except Exception:
                pass

            await asyncio.sleep(60)  # 每分钟检查一次

    return [
        BackgroundTaskSpec(
            name="my_monitor_check",
            interval_seconds=60,
            task_func=lambda running_check: check_loop(context),
        )
    ]
```

### 异步循环提示

`task_func` 接收一个 `running_check` callable，调用它返回 `False` 时表示引擎正在关闭，应该退出循环：

```python
async def loop(context):
    while running_check():  # 引擎关闭时返回 False
        await do_work(context)
        await asyncio.sleep(30)
```

## 事件触发器

响应引擎内部事件：

```python
def create_triggers(context):
    """
    返回 TriggerSpec 列表。
    """
    from sirius_pulse.skills import TriggerSpec

    async def on_new_member(event_data, context):
        """新成员入群事件"""
        group_id = event_data.get("group_id")
        user_id = event_data.get("user_id")

        # 生成欢迎消息
        welcome = await context.generate_text(
            system_prompt=f"有新成员加入群 {group_id}，请生成一段热情的欢迎词",
            messages=[{"role": "user", "content": f"欢迎新成员"}],
            group_id=group_id,
        )

        await context.queue_pending_message(
            group_id=group_id,
            text=welcome,
        )

    return [
        TriggerSpec(
            name="welcome_new_member",
            event_type="group_member_joined",
            trigger_func=on_new_member,
        )
    ]
```

### 可用事件类型

| 事件类型 | 说明 |
|----------|------|
| `engine_started` | 引擎启动完成 |
| `engine_stopped` | 引擎即将关闭 |
| `group_member_joined` | 新成员加入群聊 |
| `custom_event` | 自定义事件 |

## 生命周期回调

### on_load

引擎启动时执行，适合资源初始化：

```python
def create_on_load(context):
    """返回一个 async callable"""
    async def init():
        # 初始化资源（数据库连接、API 客户端等）
        config = context.get_config_value("my_monitor_config", {})
        await setup_resources(config)
        context.log_inner_thought("my_monitor 初始化完成")

    return init
```

### on_unload

引擎关闭时执行，适合资源清理：

```python
def create_on_unload(context):
    """返回一个 async callable"""
    async def cleanup():
        # 清理资源
        await teardown_resources()
        context.persist_group_state("final")

    return cleanup
```

## SkillEngineContext API

被动技能通过 `context` 参数访问引擎的完整能力：

### 消息发送

```python
# 发送消息到群聊
await context.queue_pending_message(
    group_id="123456",
    text="提醒：您设置的时间到了！",
)

# 记录内心活动（日志）
context.log_inner_thought("正在执行每日数据同步...")
```

### LLM 调用

```python
# 调用 LLM 生成人格化文本
response = await context.generate_text(
    system_prompt="你是一个友善的助手",
    messages=[{"role": "user", "content": "请生成通知"}],
    group_id="123456",
)

# 记录自己的回复
context.record_reply_timestamp("123456")
```

### 事件发射

```python
# 发射自定义事件（其他被动技能可以监听）
await context.emit_event("daily_report_ready", {
    "report": report_data,
    "timestamp": datetime.now().isoformat(),
})
```

### 记忆与持久化

```python
# 添加记忆条目
context.add_memory_entry(
    group_id="123456",
    user_id="assistant",
    role="assistant",
    content="系统提醒已发送",
    speaker_name="小星",
)

# 持久化群状态
context.persist_group_state("123456")

# 技能数据存储
store = context.get_data_store("my_monitor")
store.set("last_run", datetime.now().isoformat())
```

### 群聊信息

```python
# 获取所有活跃群
groups = context.get_active_groups()

# 获取当前适配器类型
adapter = context.get_current_adapter_type()

# 获取人格信息
persona = context.get_persona()

# 获取配置值
enabled = context.get_config_value("feature_enabled", False)
```

## 完整示例：每日总结技能

```python
SKILL_META = {
    "name": "daily_summary",
    "description": "每天固定时间生成群聊活动总结并发送",
    "version": "1.0",
    "parameters": {},
}

import asyncio
from datetime import datetime
from sirius_pulse.skills import BackgroundTaskSpec

def create_background_tasks(context):
    last_summary_date = {"value": None}

    async def summary_loop():
        while True:
            try:
                now = datetime.now()
                today = now.date()

                # 每天 22:00 执行
                if now.hour == 22 and last_summary_date["value"] != today:
                    last_summary_date["value"] = today

                    for group_id in context.get_active_groups():
                        # 生成今日总结
                        summary = await context.generate_text(
                            system_prompt="请总结今天该群的活跃话题和有趣对话",
                            messages=[{
                                "role": "user",
                                "content": "请生成今日群聊总结"
                            }],
                            group_id=group_id,
                        )

                        await context.queue_pending_message(
                            group_id=group_id,
                            text=f"📊 今日群聊总结：\n\n{summary}",
                        )

            except Exception:
                pass

            await asyncio.sleep(60)  # 每分钟检查一次

    return [
        BackgroundTaskSpec(
            name="daily_summary_check",
            interval_seconds=60,
            task_func=lambda running_check: summary_loop(),
        )
    ]

def create_on_load(context):
    async def init():
        context.log_inner_thought("每日总结技能已启动，将在每天 22:00 生成总结")

    return init
```

## 注意事项

1. **异常处理**：后台循环中必须包裹 try-except，异常不会中断引擎
2. **频率控制**：避免过于频繁的 LLM 调用，控制成本
3. **优雅退出**：利用 `running_check()` 响应引擎关闭
4. **数据持久化**：使用 `context.get_data_store()` 而非直接文件操作
5. **分发限制**：避免同一个通知向所有群发送，应检查是否适合该群
