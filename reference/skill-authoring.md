# 技能开发 API

技能 API 的详细参考文档，请查看：

- [Skills API 参考](./skills-api) — 每个 API 的详细说明和使用示例

## 快速导入

```python
from sirius_pulse.skills.api import (
    SkillResult,
    SkillEngineContext,
    SkillInvocationContext,
    SkillChainContext,
    BackgroundTaskSpec,
    TriggerSpec,
    SkillPassiveType,
    SkillParameter,
    SkillDataStore,
    strip_skill_calls,
    ensure_developer_access,
)
```

## 相关文档

- [技能编写指南](../extensions/skill-authoring) — 完整教程与示例
- [被动技能开发](../extensions/skill-passive) — 后台/事件驱动技能
- [内置技能参考](../extensions/skill-builtin) — 学习现有技能写法
