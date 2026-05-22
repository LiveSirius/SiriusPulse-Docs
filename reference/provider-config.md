# Provider 配置

Provider 配置文件 `data/providers/provider_keys.json` 管理 LLM 提供的凭证和端点。

## 文件格式

```json
{
  "deepseek": {
    "api_key": "sk-your-deepseek-api-key",
    "base_url": "https://api.deepseek.com"
  },
  "siliconflow": {
    "api_key": "sk-your-siliconflow-api-key",
    "base_url": "https://api.siliconflow.cn/v1"
  }
}
```

键名用于在 `orchestration.json` 中引用（通过 `模型名` 匹配）。

## 支持的 Provider

| Provider | 键名 | base_url | 说明 |
|----------|------|----------|------|
| DeepSeek | `deepseek` | `https://api.deepseek.com` | DeepSeek 官方 API |
| SiliconFlow | `siliconflow` | `https://api.siliconflow.cn/v1` | 硅基流动，支持多种开源模型 |
| 阿里云百炼 | `aliyun_bailian` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 阿里通义千问 |
| 火山引擎 | `volcengine_ark` | `https://ark.cn-beijing.volces.com/api/v3` | 字节豆包系列 |
| 智谱 BigModel | `bigmodel` | `https://open.bigmodel.cn/api/paas/v4` | 智谱 GLM 系列 |
| OpenAI 兼容 | `openai_compatible` | 自定义 | 任何 OpenAI API 兼容服务 |

## 完整配置格式

```json
{
  "deepseek": {
    "api_key": "sk-xxx",
    "base_url": "https://api.deepseek.com",
    "api_version": null,
    "organization": null,
    "default_model": "deepseek-chat"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | str | ✅ | API 密钥 |
| `base_url` | str | ✅ | API 端点地址 |
| `api_version` | str | ❌ | API 版本（Azure 等需要） |
| `organization` | str | ❌ | 组织 ID（OpenAI） |
| `default_model` | str | ❌ | 默认模型 |

## 模型名匹配

`orchestration.json` 中的模型名会与 Provider 名称及其支持的模型进行匹配：

```
chat_model: "deepseek-chat"
  → 匹配到 Provider "deepseek" 的 "deepseek-chat" 模型 ✓

chat_model: "Qwen/Qwen2.5-7B-Instruct"
  → 匹配到 Provider "siliconflow" 的 Qwen 模型 ✓
```

## 环境变量（回退）

如果 `provider_keys.json` 未配置，系统会尝试从环境变量读取：

```bash
export DEEPSEEK_API_KEY="sk-xxx"
export SILICONFLOW_API_KEY="sk-xxx"
export OPENAI_API_KEY="sk-xxx"
```

## WebUI 配置

也可以通过 WebUI → Provider 页面进行可视化配置，无需手动编辑 JSON。
