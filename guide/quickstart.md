# 快速开始

5 分钟内启动你的第一个 AI 角色。

## 前提条件

- Python 3.12+
- 一个 LLM API Key（如 DeepSeek、SiliconFlow 等）

## 1. 安装

```bash
pip install sirius-pulse
```

## 2. 创建人格

```bash
sirius-pulse persona create my-bot
```

这会创建 `data/personas/my-bot/` 目录，包含默认配置文件。

## 3. 编辑人格定义

编辑 `data/personas/my-bot/persona.json`，填入角色的基本设定：

```json
{
  "name": "小星",
  "aliases": ["小星", "星酱"],
  "backstory": "小星是一个活泼开朗的AI助手，喜欢用轻松愉快的语气和大家聊天。她擅长倾听，总是能给出贴心的建议。",
  "personality_traits": {
    "core": "热情、幽默、善解人意",
    "emotional_style": "喜怒形于色，但会控制在一个友善的范围内",
    "speech_style": "口语化、喜欢用感叹词和emoji"
  }
}
```

## 4. 配置 Provider

编辑全局 Provider 配置 `data/providers/provider_keys.json`：

```json
{
  "deepseek": {
    "api_key": "sk-your-deepseek-key",
    "base_url": "https://api.deepseek.com"
  }
}
```

## 5. 配置模型编排

编辑 `data/personas/my-bot/orchestration.json`：

```json
{
  "chat_model": "deepseek-chat",
  "analysis_model": "deepseek-chat"
}
```

## 6. 启动

```bash
# 启动 WebUI 管理模式
sirius-pulse webui

# 或直接启动指定人格
sirius-pulse persona start my-bot
```

访问 `http://localhost:8080` 进入 WebUI 管理面板。

## 7. 配置 NapCat（接入 QQ）

在 WebUI 的 "NapCat" 页面：
1. 设置 NapCat 路径
2. 配置 QQ 号和 ws_token
3. 点击 "启动 NapCat"
4. 扫码登录

然后回到 "适配器" 页面，为你的 my-bot 人格添加 NapCat 适配器，填入对应的 ws_url。

## 下一步

- 阅读 [人格系统](./persona-system) 了解如何精细调校角色
- 阅读 [配置指南](./configuration) 了解完整的配置选项
- 阅读 [扩展开发](/extensions/) 学习编写自定义技能和插件
