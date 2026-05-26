# 提供者系统模块 (providers/)

## 模块概述

提供者系统负责管理 LLM（大语言模型）服务的接入，支持多个提供商平台，提供统一的异步生成接口和自动路由机制。

## 架构设计

```
AutoRoutingProvider（自动路由）
    ├── ProviderRegistry（凭证管理）
    └── 具体 Provider 实例
            ├── OpenAICompatibleProvider
            ├── AliyunBailianProvider
            ├── DeepSeekProvider
            ├── SiliconFlowProvider
            ├── VolcengineArkProvider
            ├── BigModelProvider
            └── YTeaProvider
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `routing.py` | AutoRoutingProvider, ProviderRegistry |
| `base.py` | LLMProvider, AsyncLLMProvider 基类 |
| `openai_compatible.py` | OpenAI 兼容 Provider |
| `aliyun_bailian.py` | 阿里云百炼 Provider |
| `deepseek.py` | DeepSeek Provider |
| `siliconflow.py` | SiliconFlow Provider |
| `volcengine_ark.py` | 火山引擎方舟 Provider |
| `bigmodel.py` | 智谱 BigModel Provider |
| `ytea.py` | YTea Provider |
| `mock.py` | Mock Provider（测试用） |
| `response_utils.py` | 响应处理工具 |

## 支持的提供商平台

| 平台 | 类型标识 | 默认 Base URL |
|------|----------|---------------|
| OpenAI 兼容 | `openai-compatible` | `https://api.openai.com` |
| 阿里云百炼 | `aliyun-bailian` | `https://dashscope.aliyuncs.com/compatible-mode` |
| DeepSeek | `deepseek` | `https://api.deepseek.com` |
| SiliconFlow | `siliconflow` | `https://api.siliconflow.cn` |
| 火山引擎方舟 | `volcengine-ark` | `https://ark.cn-beijing.volces.com/api/v3` |
| 智谱 BigModel | `bigmodel` | `https://open.bigmodel.cn/api/paas/v4` |
| YTea | `ytea` | `https://api.ytea.top` |

## ProviderConfig

```python
@dataclass
class ProviderConfig:
    provider_type: str       # 提供商类型
    api_key: str             # API 密钥
    base_url: str            # 基础 URL
    healthcheck_model: str   # 健康检查模型
    enabled: bool = True     # 是否启用
    models: list[str] = []   # 支持的模型列表
```

## ProviderRegistry

### 凭证管理

```python
registry = ProviderRegistry(work_path)

# 加载配置
providers = registry.load()

# 保存配置
registry.save(providers)

# 添加/更新提供商
registry.upsert(
    provider_type="openai-compatible",
    api_key="sk-xxx",
    base_url="https://api.openai.com",
    healthcheck_model="gpt-4o-mini",
    models=["gpt-4o", "gpt-4o-mini"],
)

# 删除提供商
registry.remove("openai-compatible")
```

### 配置文件位置

```
data/providers/provider_keys.json
```

```json
{
  "providers": {
    "openai-compatible": {
      "type": "openai-compatible",
      "api_key": "sk-xxx",
      "base_url": "https://api.openai.com",
      "healthcheck_model": "gpt-4o-mini",
      "enabled": true,
      "models": ["gpt-4o", "gpt-4o-mini"]
    }
  }
}
```

## AutoRoutingProvider

### 自动路由机制

```python
class AutoRoutingProvider(AsyncLLMProvider):
    def __init__(self, providers: dict[str, ProviderConfig]):
        self._providers = {k: v for k, v in providers.items() if v.enabled}
    
    def _pick_provider(self, model: str) -> tuple[ProviderConfig, str]:
        """根据模型名称选择合适的提供商。"""
        for provider in self._providers.values():
            # 1. 检查 models 列表
            if provider.models and model in provider.models:
                return provider, "models"
            # 2. 检查 healthcheck_model
            if provider.healthcheck_model == model:
                return provider, "healthcheck_model"
        raise RuntimeError(f"无法为模型 '{model}' 找到合适的提供商")
```

### 生成请求

```python
provider = AutoRoutingProvider(providers)

result = await provider.generate_async(
    GenerationRequest(
        model="gpt-4o",
        system_prompt="你是一个助手",
        messages=[{"role": "user", "content": "你好"}],
        temperature=0.7,
        max_tokens=1024,
        purpose="chat",
    )
)
```

## GenerationRequest

```python
@dataclass
class GenerationRequest:
    model: str
    messages: list[dict[str, str]]
    system_prompt: str = ""
    temperature: float = 0.7
    max_tokens: int = 1024
    purpose: str = ""              # 用途标识（用于日志和统计）
    response_format: dict | None = None
    tools: list[dict] | None = None
```

## 健康检查

```python
from sirius_pulse.providers.routing import probe_provider_availability

await probe_provider_availability(
    provider=provider,
    model_name="gpt-4o-mini",
)
# 发送 "ping" 请求，验证连通性
```

## Provider 注册流程

```python
from sirius_pulse.providers.routing import register_provider_with_validation

await register_provider_with_validation(
    work_path=Path("./data"),
    provider_type="openai-compatible",
    api_key="sk-xxx",
    healthcheck_model="gpt-4o-mini",
    base_url="https://api.openai.com",
)
```

流程：
1. 验证平台是否支持
2. 验证 API Key 格式
3. 发送健康检查请求
4. 保存到 provider_keys.json

## 环境变量支持

```python
# 快速测试模式
os.environ["SIRIUS_PROVIDER_TYPE"] = "openai-compatible"
os.environ["SIRIUS_API_KEY"] = "sk-xxx"
os.environ["SIRIUS_BASE_URL"] = "https://api.openai.com"
os.environ["SIRIUS_MODEL"] = "gpt-4o-mini"
```

## 多提供商配置

支持同时配置多个提供商，按模型自动路由：

```json
{
  "providers": {
    "openai-compatible": {
      "type": "openai-compatible",
      "api_key": "sk-xxx",
      "models": ["gpt-4o", "gpt-4o-mini"]
    },
    "deepseek": {
      "type": "deepseek",
      "api_key": "sk-xxx",
      "models": ["deepseek-chat", "deepseek-coder"]
    },
    "siliconflow": {
      "type": "siliconflow",
      "api_key": "sk-xxx",
      "models": ["Qwen/Qwen2-7B-Instruct"]
    }
  }
}
```

## WebUI 管理

通过 WebUI 的「Provider 配置」页面可以：

1. 添加/删除提供商
2. 配置 API Key
3. 设置支持的模型
4. 执行健康检查
5. 启用/禁用提供商
