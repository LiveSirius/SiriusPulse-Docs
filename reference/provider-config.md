# Provider 配置

在 **WebUI → Provider** 页面配置 LLM API 凭证，无需手动编辑 `provider_keys.json`。

---

## 页面操作

1. 选择 Provider 类型
2. 填入 API Key
3. 填入 API 地址（默认值已自动填充）
4. 保存

支持同时配置多个 Provider，系统按健康检查自动路由。

---

## 支持的 Provider

| Provider | 键名 | 默认 API 地址 |
|----------|------|-------------|
| DeepSeek | `deepseek` | `https://api.deepseek.com` |
| SiliconFlow | `siliconflow` | `https://api.siliconflow.cn/v1` |
| 阿里云百炼 | `aliyun_bailian` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 火山方舟 | `volcengine_ark` | `https://ark.cn-beijing.volces.com/api/v3` |
| 智谱 BigModel | `bigmodel` | `https://open.bigmodel.cn/api/paas/v4` |
| OpenAI 兼容 | `openai_compatible` | 自定义 |

---

## 模型名匹配

在模型编排页面选择的模型名会与已配置的 Provider 自动匹配：

```
选择 "deepseek-chat" → 自动路由到 DeepSeek Provider ✓
选择 "Qwen/Qwen2.5-7B-Instruct" → 自动路由到 SiliconFlow ✓
```

---

## 环境变量（回退）

如果 Provider 页面未配置，系统也会尝试从环境变量读取：

```
DEEPSEEK_API_KEY=sk-xxx
SILICONFLOW_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx
```

---

## 共享机制

所有人格共用同一份 Provider 配置。每个人格通过模型编排独立选择使用哪个模型，但凭证集中管理。
