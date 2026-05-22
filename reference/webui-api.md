# WebUI API

Sirius Pulse 内置的 WebUI 提供了 REST API 用于管理和监控。

## 基础信息

- **默认端口**: `8080`
- **绑定地址**: `127.0.0.1`
- **协议**: HTTP + JSON

## 人格管理

### 获取所有人格

```
GET /api/personas
```

响应：
```json
{
  "personas": [
    {
      "name": "小星",
      "status": "running",
      "port": 3001,
      "pid": 12345
    }
  ]
}
```

### 创建人格

```
POST /api/personas/create
Content-Type: application/json

{
  "name": "新人格"
}
```

### 启动人格

```
POST /api/personas/{name}/start
```

### 停止人格

```
POST /api/personas/{name}/stop
```

### 删除人格

```
DELETE /api/personas/{name}
```

### 获取人格配置

```
GET /api/personas/{name}/config
```

### 更新人格配置

```
PUT /api/personas/{name}/config
Content-Type: application/json

{ ... }
```

## 记忆管理

### 获取群聊记忆

```
GET /api/memory/{persona_name}/groups/{group_id}
```

响应包含：
- `entries`: 基础记忆条目列表
- `heat`: 群聊热度
- `diary_entries`: 相关日记

### 获取用户记忆

```
GET /api/memory/{persona_name}/users/{user_id}
```

### 获取人物传记

```
GET /api/biography/{persona_name}
```

## Plugin 管理

### 获取插件列表

```
GET /api/plugins/{persona_name}
```

### 更新插件配置

```
PUT /api/plugins/{persona_name}/{plugin_name}/config
Content-Type: application/json

{
  "enabled": true,
  "permissions": {
    "group_blacklist": []
  }
}
```

## Skill 管理

### 获取技能列表

```
GET /api/skills/{persona_name}
```

### 获取技能数据

```
GET /api/skills/{persona_name}/{skill_name}/data
```

### 更新技能数据

```
PUT /api/skills/{persona_name}/{skill_name}/data
Content-Type: application/json

{ ... }
```

## NapCat 管理

### 获取 NapCat 状态

```
GET /api/napcat/status
```

### 安装 NapCat

```
POST /api/napcat/install
Content-Type: application/json

{
  "path": "D:\\napcat",
  "qq": 123456789
}
```

### 启动 NapCat 实例

```
POST /api/napcat/start
Content-Type: application/json

{
  "qq": 123456789,
  "port": 3001
}
```

### 停止 NapCat 实例

```
POST /api/napcat/stop
Content-Type: application/json

{
  "qq": 123456789
}
```

## Provider 管理

### 获取 Provider 配置

```
GET /api/providers
```

### 更新 Provider 配置

```
PUT /api/providers
Content-Type: application/json

{
  "deepseek": {
    "api_key": "sk-xxx",
    "base_url": "https://api.deepseek.com"
  }
}
```

## Token 统计

### 获取 Token 用量

```
GET /api/token/{persona_name}/usage?since=2026-01-01
```

### 获取分析报告

```
GET /api/token/{persona_name}/report
```

## 全局配置

### 获取全局配置

```
GET /api/config/global
```

### 更新全局配置

```
PUT /api/config/global
Content-Type: application/json

{ ... }
```

## WebSocket 事件

```
ws://localhost:8080/ws/events?persona={name}
```

实时推送引擎事件：
- `message_received`: 新消息到达
- `reply_sent`: AI 发送了回复
- `emotion_changed`: 情绪变化
- `token_usage`: Token 用量更新
- `skill_executed`: 技能执行完成
- `plugin_executed`: 插件执行完成
