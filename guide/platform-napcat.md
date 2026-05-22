# NapCat / OneBot 接入

Sirius Pulse 通过 NapCat 适配器接入 QQ 平台，使用 OneBot v11 标准协议。

## NapCat 简介

NapCat 是基于 QQ NT 内核的无头客户端，提供 WebSocket 接口，兼容 OneBot v11 协议。

Sirius Pulse 内置了 NapCat 管理器，可以：
- 自动下载和安装 NapCat
- 多人格独立实例管理
- 通过 WebUI 可视化配置

## 接入流程

### 1. WebUI 配置

访问 `http://localhost:8080` → NapCat 页面：

1. 设置 **NapCat 路径**（如 `D:\napcat`）
2. 设置 **QQ 号** 和 **ws_token**
3. 点击 **安装/更新 NapCat**
4. 点击 **启动**
5. 扫码登录

### 2. 为格添加适配器

在 "适配器" 页面，为目标人格添加 NapCat 适配器：

```json
{
  "type": "napcat",
  "ws_url": "ws://127.0.0.1:3001",
  "qq": 123456789,
  "ws_token": "your-token",
  "group_whitelist": [],
  "private_whitelist": [],
  "peer_ai_ids": []
}
```

### 3. 白名单配置

| 字段 | 说明 |
|------|------|
| `group_whitelist` | 群聊白名单，为空表示不限制 |
| `private_whitelist` | 私聊白名单，为空表示不限制 |

不设置白名单时，所有群和私聊都会响应。

### 4. 多 AI 共存

`peer_ai_ids` 用于标识同一群中其他 AI 账号。引擎会识别它们的发言，避免互相回复形成循环。

系统会自动扫描其他人格的 QQ 号填入此字段。

## 多人格端口管理

每人格需要独立的 NapCat 实例和端口：

```
全局配置: napcat_base_port = 3001

小星 → QQ 111111 → ws://127.0.0.1:3001
小黑 → QQ 222222 → ws://127.0.0.1:3002
小白 → QQ 333333 → ws://127.0.0.1:3003
```

## 协议支持

基于 OneBot v11 WebSocket 协议：

### 接收事件

| 事件 | 说明 |
|------|------|
| `message.group` | 群聊消息 |
| `message.private` | 私聊消息 |
| `notice.group_increase` | 新成员入群 |

### 发送动作

| API | 说明 |
|-----|------|
| `send_group_msg` | 发送群消息 |
| `send_private_msg` | 发送私聊消息 |
| `send_group_forward_msg` | 发送合并转发消息 |
| `upload_group_file` | 上传群文件 |
| `get_group_member_info` | 获取群成员信息 |

## 手动启动

除了 WebUI，也可以通过命令行管理：

```bash
# 安装 NapCat
sirius-pulse napcat install --path D:\napcat

# 启动实例
sirius-pulse napcat start --qq 123456 --port 3001

# 查看状态
sirius-pulse napcat status
```

## 常见问题

### Q: 扫码后一直显示"等待登录"

- 检查 QQ 号是否正确
- 确保 NapCat 版本与 QQ NT 版本匹配
- 尝试重新安装 NapCat

### Q: WS 连接失败

- 检查 ws_url 端口是否正确
- 确保 NapCat 实例已启动
- 检查防火墙设置

### Q: 多个人格共用一个 QQ 号？

不支持。每个人格需要独立的 QQ 号（和独立的 NapCat 实例）。
