# 快速开始

5 分钟内启动你的第一个 AI 角色。**全程 WebUI 操作，不需要手动编辑任何文件。**

## 前提条件

- Python 3.12+
- 一个 LLM API Key（如 DeepSeek、SiliconFlow 等）

## 1. 安装

```bash
pip install sirius-pulse
```

## 2. 启动 WebUI

```bash
sirius-pulse webui
```

打开浏览器访问 `http://localhost:8080`，所有后续配置都在可视化面板中完成。

## 3. 配置 Provider（WebUI）

进入 **Provider** 页面，填入你的 API Key：

- 选择 Provider 类型（DeepSeek、SiliconFlow 等）
- 填入 API Key 和 API 地址
- 保存

支持的 Provider：DeepSeek / SiliconFlow / 阿里云百炼 / 火山方舟 / 智谱 GLM / OpenAI 兼容

## 4. 创建人格（WebUI）

进入 **Dashboard** → 点击"创建人格"：

- 填入角色名称（如"小星"）
- 系统自动生成默认配置目录

进入 **人格管理** 页面，选择刚创建的人格：

- 填写角色设定：名字、别名、背景故事
- 填写性格特质：核心性格、说话风格、回应习惯
- 选择交流风格：健谈 / 正常 / 选择性回复

## 5. 模型编排（WebUI）

进入 **模型编排** 页面，选择模型：

| 通用模型 | 作用 |
|---------|------|
| 分析模型 | 认知分析、记忆提取 |
| 对话模型 | 回复生成、主动发言、被动技能、通知 |
| 记忆维护模型 | 日记生成/合并、传记蒸馏/更新 |
| 插件模型 | 插件生成/分析/渲染 |

每项任务还可以独立覆盖模型、调整温度和最大 Token。

## 6. 接入 QQ（WebUI）

进入 **NapCat** 页面：

1. 设置 NapCat 安装路径
2. 填入 QQ 号和 ws_token
3. 点击"安装/更新 NapCat"
4. 点击"启动" → 扫码登录

进入 **适配器** 页面，为目标人格添加 NapCat 适配器，填入 ws_url。可以设置群聊/私聊白名单。

## 7. 启动人格

回到 **Dashboard**，点击人格的"启动"按钮。

也可以命令行操作：

```bash
# 启动所有已配置人格 + WebUI
sirius-pulse run

# 前台启动单个人格（调试用）
sirius-pulse persona start my-bot
```

## 下一步

- 阅读 [人格系统](./persona-system) 了解如何精细调校角色
- 阅读 [引擎架构](./engine-architecture) 理解后台如何工作
- 阅读 [扩展开发](/extensions/) 学习编写自定义技能和插件
