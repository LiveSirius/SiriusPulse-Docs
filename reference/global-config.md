# 全局配置

全局配置文件 `data/global_config.json` 控制 Sirius Pulse 的系统级别参数。

## 完整字段

```json
{
  "webui_port": 8080,
  "webui_host": "127.0.0.1",
  "napcat_base_port": 3001,
  "embedding_model": "BAAI/bge-small-zh-v1.5",
  "embedding_port": 5555,
  "embedding_device": "cpu",
  "plugins_dir": "plugins",
  "skills_dir": "skills",
  "log_level": "INFO",
  "log_format": "console",
  "data_dir": "data"
}
```

## 字段说明

### webui

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `webui_port` | int | `8080` | WebUI 管理面板 HTTP 端口 |
| `webui_host` | str | `127.0.0.1` | WebUI 绑定地址 |

### NapCat

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `napcat_base_port` | int | `3001` | NapCat 多实例起始端口。每人格在 base_port 基础上递增 1 |

### Embedding

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `embedding_model` | str | `BAAI/bge-small-zh-v1.5` | Hugging Face 嵌入模型名 |
| `embedding_port` | int | `5555` | Embedding 微服务端口 |
| `embedding_device` | str | `cpu` | 推理设备：`cpu` / `cuda` |

### 路径

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `plugins_dir` | str | `plugins` | 插件目录，相对于项目根目录 |
| `skills_dir` | str | `skills` | 技能目录，相对于项目根目录 |
| `data_dir` | str | `data` | 数据目录，存储配置和运行时数据 |

### 日志

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `log_level` | str | `INFO` | 日志级别：`DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `log_format` | str | `console` | 日志格式：`console` / `file` |

## 自动创建

首次运行 `sirius-pulse` 时，系统会自动创建 `global_config.json` 及其默认值，无需手动创建。
