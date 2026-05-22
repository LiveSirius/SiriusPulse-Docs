# 全局配置

在 **WebUI → 全局设置** 页面配置系统级参数。无需直接编辑文件。

---

## 系统参数

| 字段 | 默认值 | 说明 |
|------|--------|------|
| WebUI 端口 | `8080` | 管理面板 HTTP 端口 |
| WebUI 地址 | `127.0.0.1` | 监听地址 |
| NapCat 起始端口 | `3001` | 多人格时每人格递增 1 |
| Embedding 模型 | `BAAI/bge-small-zh-v1.5` | Hugging Face 模型名 |
| Embedding 端口 | `5555` | 微服务端口 |
| Embedding 设备 | `cpu` | cpu / cuda |
| 插件目录 | `plugins` | 相对项目根 |
| 技能目录 | `skills` | 相对项目根 |
| 日志级别 | `INFO` | DEBUG / INFO / WARNING / ERROR |
| 日志格式 | `console` | console / file |

---

## 自动创建

首次运行 `sirius-pulse webui` 时系统会自动生成默认配置文件，无需手动创建。
