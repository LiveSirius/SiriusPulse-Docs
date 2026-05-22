# 内置技能参考

Sirius Pulse 内置 13 个技能，覆盖搜索、文件操作、系统信息、提醒等常见场景。

## 信息获取

### bing_search — 必应网页搜索

```python
SKILL_META = {
    "name": "bing_search",
    "description": "使用必应搜索引擎检索指定关键词的网页摘要，返回前3条结果",
    "parameters": {
        "query": "搜索关键词（必填）",
        "count": "结果数量（1-5，默认3）"
    },
    "dependencies": ["requests", "beautifulsoup4"],
}
```

通过 HTTP 抓取 `bing.com` 搜索页面，解析标题、链接和摘要。无需 API Key。

**调用示例**：
```
[SKILL_CALL: bing_search | {"query": "Python 3.13 新特性", "count": 3}]
```

### url_content_reader — 网页内容提取

```python
SKILL_META = {
    "name": "url_content_reader",
    "description": "读取网页链接并提取标题、描述、正文摘要",
    "parameters": {
        "url": "网页 URL（必填）",
        "max_chars": "最大提取字符数（300-12000，默认3000）",
        "timeout": "请求超时秒数（3-60，默认12）"
    },
    "dependencies": ["requests", "beautifulsoup4"],
}
```

自动根据 Content-Type 选择合适的解析方式（HTML 解析 / 纯文本模式）。结果自动保存历史到 data_store。

**调用示例**：
```
[SKILL_CALL: url_content_reader | {"url": "https://example.com/article", "max_chars": 5000}]
```

### system_info — 系统信息查询

```python
SKILL_META = {
    "name": "system_info",
    "description": "获取主机的系统信息",
    "parameters": {
        "categories": "信息类别列表（cpu/memory/disk/os，默认全部）"
    },
    "dependencies": ["psutil"],
}
```

获取 CPU、内存、磁盘、操作系统等系统信息。`psutil` 为可选依赖，未安装时提供基础信息。

**调用示例**：
```
[SKILL_CALL: system_info | {"categories": ["cpu", "memory"]}]
```

## 文件操作

所有文件操作受路径沙箱保护，限定在 `data/personaworkspace/` 目录下。

### file_read — 读取文件

```python
SKILL_META = {
    "name": "file_read",
    "description": "读取 data/personaworkspace 目录下的文本文件内容",
    "parameters": {
        "path": "文件相对路径（必填）"
    }
}
```

支持 UTF-8 文本文件和图片（通过 multimodal_blocks 返回）。自动拒绝二进制文件。文件大小限制 1MB。

**调用示例**：
```
[SKILL_CALL: file_read | {"path": "notes/todo.txt"}]
```

### file_write — 写入文件

```python
SKILL_META = {
    "name": "file_write",
    "description": "在 data/personaworkspace 目录下创建或修改文本文件",
    "parameters": {
        "path": "文件相对路径（必填）",
        "content": "文件内容（必填）",
        "mode": "写入模式：write（覆盖）或 append（追加），默认 write"
    }
}
```

单次写入上限 1MB，覆盖模式检查现有文件不超过 10MB。

**调用示例**：
```
[SKILL_CALL: file_write | {"path": "notes/ideas.txt", "content": "今天想到一个好主意...", "mode": "append"}]
```

### file_list — 列出文件

```python
SKILL_META = {
    "name": "file_list",
    "description": "列出或搜索 data/personaworkspace 目录下的文件和目录",
    "parameters": {
        "path": "目录相对路径（可选，默认根目录）",
        "recursive": "是否递归（可选，默认 false）",
        "pattern": "文件名过滤模式（可选，如 *.txt）"
    }
}
```

支持递归遍历和 glob 模式过滤。最多返回 200 条结果。自动跳过二进制/多媒体文件。

**调用示例**：
```
[SKILL_CALL: file_list | {"path": "docs", "recursive": true, "pattern": "*.md"}]
```

## 提醒与监控

### reminder — 定时提醒

混合技能，同时支持主动调用和后台任务。

**主动调用**：
```python
run(action="create", content="喝水提醒", mode="interval", minutes_after=30)
run(action="list")    # 列出所有提醒
run(action="cancel", reminder_id="xxx")  # 取消提醒
```

支持的模式：
- `once`: 一次性提醒（`minutes_after` 分钟之后）
- `interval`: 间隔重复
- `daily`: 每天固定时间
- `weekly`: 每周固定星期几

**后台任务**：`reminder_check` 每 10 秒检查到期提醒，通过 LLM 生成人格化通知后分发。

### github_monitor — GitHub 项目监控

纯被动技能，无需 AI 主动调用。通过后台轮询或 Webhook 双模式监控 GitHub 仓库事件。

- **Poll 模式**：定期拉取 GitHub Events API
- **Webhook 模式**：GitHub 主动推送事件到本地 HTTP 服务

检测到 Issue/PR/Release/Comment/Push 事件后，自动截图并生成通知。

**配置**：通过 WebUI 的 `skill_data/github_monitor.json` 管理监控列表。

## 学习与交互

### learn_term — 学习新术语

```python
SKILL_META = {
    "name": "learn_term",
    "description": "记录专有名词、黑话、梗或模型不了解的新概念",
    "silent": True,
    "parameters": {
        "term": "术语名称（必填）",
        "definition": "术语定义（必填）"
    }
}
```

执行后不显示（silent），实际持久化由引擎处理，写入术语表。后续对话中自动引用。

### desktop_screenshot — 桌面截图

```python
SKILL_META = {
    "name": "desktop_screenshot",
    "description": "捕获当前主机桌面截图",
    "developer_only": True,
    "dependencies": ["Pillow"],
    "parameters": {
        "all_screens": "是否捕获所有屏幕（默认 true）",
        "focus": "可选焦点窗口标题"
    }
}
```

仅 developer 可调用。返回截图图片供模型内部分析。

## 适配器绑定技能（NapCat）

以下技能需要 NapCat 平台支持，通过 `bridge` 注入与 QQ 交互：

### send_image — 发送图片

```python
SKILL_META = {
    "name": "send_image",
    "silent": True,
    "adapter_types": ["napcat"],
    "parameters": {
        "image_path": "图片路径（本地或远程URL）"
    }
}
```

支持本地文件和远程 URL（自动缓存）。异步函数。

### upload_file — 上传文件

```python
SKILL_META = {
    "name": "upload_file",
    "adapter_types": ["napcat"],
    "parameters": {
        "file_path": "文件本地路径（必填）",
        "file_name": "可选显示名称"
    }
}
```

### send_workspace_file — 发送工作区文件

```python
SKILL_META = {
    "name": "send_workspace_file",
    "adapter_types": ["napcat"],
    "parameters": {
        "file_name": "文件名（必填，相对于 data/personaworkspace）",
        "display_name": "可选显示名称"
    }
}
```

## 技能数据目录

所有技能的数据存储在人格的 `skill_data/` 目录：

```
data/personas/{name}/skill_data/
├── bing_search.json        # 如有持久化数据
├── reminder.json           # 提醒列表
├── github_monitor.json     # GitHub 监控配置
├── learn_term.json         # 术语表
├── url_content_reader.json # 页面历史
└── .telemetry.jsonl       # 技能执行遥测
```
