# 插件开发 API

插件 API 的详细参考文档，请查看：

- [Plugins API 参考](../api/plugins-api) — 每个 API 的详细说明和使用示例

## 快速导入

```python
from sirius_pulse.plugins.api import (
    PluginBase,
    command,
    PluginResponse,
    PluginContext,
    EngineProxy,
    PluginDataStore,
    CommandAST,
    PluginCommandMeta,
    RenderMode,
    TriggerType,
    PatternType,
    PluginDefinition,
)
```

## 相关文档

- [插件编写指南](../extensions/plugin-authoring) — 完整教程与示例
- [插件系统总览](../extensions/plugin-overview) — 架构与生命周期
