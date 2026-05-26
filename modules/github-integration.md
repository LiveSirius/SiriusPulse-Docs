# GitHub 集成模块 (github/)

## 模块概述

GitHub 集成模块提供 GitHub 事件监控和 Webhook 处理功能，允许 AI 关注 GitHub 仓库的动态。

## 核心文件

| 文件 | 职责 |
|------|------|
| `client.py` | GitHub API 客户端 |
| `events.py` | GitHub 事件定义 |
| `event_bridge.py` | 事件桥接器 |
| `webhook.py` | Webhook 处理 |

## 功能特性

1. **仓库监控**：定期检查仓库的最新提交、Issue、PR
2. **Webhook 接收**：接收 GitHub Webhook 推送的事件
3. **事件转换**：将 GitHub 事件转换为引擎可消费的格式
4. **通知发送**：将 GitHub 动态发送到指定群组

## 内置技能

`github_monitor` 技能使用此模块实现 GitHub 仓库监控功能。
