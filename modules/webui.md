# WebUI 模块 (webui/)

## 模块概述

WebUI 模块提供基于 aiohttp 的 REST API 和静态页面，用于管理人格、查看状态、配置系统等。支持多人格管理、插件管理、技能管理等功能。

## 核心文件

| 文件 | 职责 |
|------|------|
| `server.py` | 主服务器入口 |
| `server_core.py` | 核心 API 路由 |
| `server_utils.py` | 工具函数 |
| `persona_api.py` | 人格管理 API |
| `memory_api.py` | 记忆管理 API |
| `napcat_api.py` | NapCat 管理 API |
| `server_plugin_api.py` | 插件管理 API |
| `server_skill_api.py` | 技能管理 API |
| `biography_api.py` | 传记管理 API |
| `static/` | 静态页面资源 |

## 启动方式

```bash
# 默认启动 WebUI
python main.py

# 指定端口
python main.py --port 8080
```

## API 端点

### 人格管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/personas` | 获取所有人格列表 |
| `POST` | `/api/personas` | 创建新人格 |
| `GET` | `/api/personas/{name}` | 获取人格详情 |
| `DELETE` | `/api/personas/{name}` | 删除人格 |
| `POST` | `/api/personas/{name}/start` | 启动人格 |
| `POST` | `/api/personas/{name}/stop` | 停止人格 |
| `PUT` | `/api/personas/{name}/persona` | 更新人格定义 |
| `PUT` | `/api/personas/{name}/orchestration` | 更新模型编排 |
| `PUT` | `/api/personas/{name}/experience` | 更新体验参数 |

### Provider 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/providers` | 获取 Provider 列表 |
| `POST` | `/api/providers` | 添加 Provider |
| `DELETE` | `/api/providers/{type}` | 删除 Provider |
| `POST` | `/api/providers/{type}/test` | 测试 Provider 连通性 |

### 记忆管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/memory/{name}/diary` | 获取日记列表 |
| `GET` | `/api/memory/{name}/semantic` | 获取语义记忆 |
| `GET` | `/api/memory/{name}/users` | 获取用户画像 |
| `DELETE` | `/api/memory/{name}/diary` | 清空日记 |

### 插件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/plugins/{persona}` | 获取插件列表 |
| `POST` | `/api/plugins/{persona}/reload` | 重载插件 |
| `PUT` | `/api/plugins/{persona}/{name}/config` | 更新插件配置 |
| `POST` | `/api/plugins/{persona}/{name}/toggle` | 启用/禁用插件 |

### 技能管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/skills/{persona}` | 获取技能列表 |
| `POST` | `/api/skills/{persona}/reload` | 重载技能 |
| `GET` | `/api/skills/{persona}/telemetry` | 获取技能遥测 |

### NapCat 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/napcat/status` | 获取 NapCat 状态 |
| `POST` | `/api/napcat/install` | 安装 NapCat |
| `POST` | `/api/napcat/{persona}/start` | 启动 NapCat 实例 |
| `POST` | `/api/napcat/{persona}/stop` | 停止 NapCat 实例 |

### Token 统计

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/token/{name}/usage` | 获取 Token 使用统计 |
| `GET` | `/api/token/{name}/analytics` | 获取 Token 分析 |

## 静态页面

| 页面 | 文件 | 说明 |
|------|------|------|
| 仪表盘 | `dashboard.html` | 主控制台 |
| 人格配置 | `persona.html` | 人格编辑 |
| 创建人格 | `create-persona.html` | 新建人格向导 |
| 模型编排 | `orchestration.html` | 模型配置 |
| 体验参数 | `experience.html` | 行为参数调节 |
| 适配器 | `adapters.html` | 平台适配器配置 |
| Provider | `providers.html` | Provider 管理 |
| 记忆可视化 | `memory-viz.html` | 记忆图谱 |
| 日记 | `diary.html` | 日记查看 |
| 认知事件 | `cognition.html` | 认知事件时间线 |
| 传记 | `biography.html` | 用户传记管理 |
| 名词解释 | `glossary.html` | 术语管理 |
| 用户 | `users.html` | 用户管理 |
| 插件 | `plugins.html` | 插件管理 |
| 技能 | `skills.html` | 技能管理 |
| Token 追踪 | `token-tracker.html` | Token 使用统计 |
| NapCat | `napcat.html` | NapCat 管理 |
| 全局设置 | `global-settings.html` | 全局配置 |

## 前端架构

### 核心模块

| 文件 | 说明 |
|------|------|
| `core.js` | 核心工具函数 |
| `config.js` | 配置管理 |
| `analytics.js` | 数据分析 |
| `platform.js` | 平台交互 |

### 页面结构

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <nav><!-- 侧边栏导航 --></nav>
    <main><!-- 页面内容 --></main>
    <script src="/static/core.js"></script>
    <script src="/static/pages/xxx.html"></script>
</body>
</html>
```

## 启动流程

```python
# main.py
from sirius_pulse.webui.server import create_app

app = create_app(data_path="./data")
web.run_app(app, port=8080)
```

## 配置

### 命令行参数

```bash
python main.py --port 8080 --host 0.0.0.0 --log-level INFO
```

### 环境变量

```bash
SIRIUS_WEBUI_PORT=8080
SIRIUS_WEBUI_HOST=0.0.0.0
```
