# WebUI 模块 (webui/)

## 模块概述

WebUI 模块提供基于 aiohttp 的 REST API、WebSocket 事件推送和静态页面，用于管理人格、查看状态、配置系统等。支持多人格管理、插件管理、技能管理、JWT 认证、实时监控等功能。

## 核心文件

| 文件 | 职责 |
|------|------|
| `server.py` | 主服务器入口 |
| `server_core.py` | 核心 API 路由 |
| `server_utils.py` | 工具函数（`_json_response`、`_get_name`、`handle_api_errors`） |
| `auth.py` | JWT 认证管理器（HMAC-SHA256 签名，admin/viewer 角色） |
| `middleware.py` | 认证中间件（白名单放行 + RBAC 权限控制） |
| `monitoring_api.py` | 监控 API（全局概览、单人格指标、健康检查） |
| `ws_server.py` | WebSocket 事件推送服务（桥接 SessionEventBus 到前端） |
| `persona_api.py` | 人格管理 API |
| `memory_api.py` | 记忆管理 API |
| `napcat_api.py` | NapCat 管理 API |
| `server_plugin_api.py` | 插件管理 API |
| `server_skill_api.py` | 技能管理 API |
| `biography_api.py` | 传记管理 API |
| `static/` | 静态页面资源 |

## 认证系统

WebUI 支持 JWT 认证，基于 HMAC-SHA256 签名，纯标准库实现（无第三方依赖）。

### 认证流程

1. 首次启动时自动生成管理员密码，打印到控制台并保存哈希到 `data/auth_secret.json`
2. 用户通过 `/api/auth/login` 登录获取 JWT 令牌
3. 后续请求通过 `Authorization: Bearer <token>` 头或 `?token=<token>` 参数携带令牌
4. 认证中间件验证令牌签名和过期时间

### 角色权限

| 角色 | 权限 |
|------|------|
| `admin` | 完全访问（读+写） |
| `viewer` | 只读访问（GET 请求） |

### 白名单路径（免认证）

- `/static/` — 静态资源
- `/ws/` — WebSocket 连接
- `/api/auth/login` — 登录接口
- `/api/auth/status` — 认证状态
- `/`、`/index.html` — 首页

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

### 认证管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录获取 JWT 令牌 |
| `GET` | `/api/auth/status` | 获取认证状态 |

### 监控 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/monitoring/overview` | 全局概览（所有人格状态、运行数、PID、运行时长） |
| `GET` | `/api/monitoring/{name}/metrics` | 单人格详细指标（Token 使用、记忆统计、认知事件数） |
| `GET` | `/api/monitoring/{name}/health` | 健康检查（进程状态、配置文件、记忆系统） |

### WebSocket 事件订阅

| 协议 | 路径 | 说明 |
|------|------|------|
| `WS` | `/ws/events` | 全局事件订阅（接收所有人格事件） |
| `WS` | `/ws/events/{name}` | 按人格事件订阅 |

WebSocket 消息格式：
```json
{
  "persona": "人格名称",
  "timestamp": 1234567890.123,
  "type": "事件类型",
  "data": { ... }
}
```

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
| 监控概览 | `pages/monitoring.html` | 系统监控概览 |
| 监控详情 | `pages/monitoring-detail.html` | 单人格监控详情 |

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
