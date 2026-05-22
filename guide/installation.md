# 安装

## 环境要求

| 组件 | 要求 |
|------|------|
| Python | >= 3.12 |
| 操作系统 | Windows / Linux / macOS |
| 包管理器 | pip / uv（推荐） |

## 安装方式

### 方式一：pip 安装（推荐）

```bash
pip install sirius-pulse
```

### 方式二：源码安装

```bash
git clone https://github.com/Sparrived/SiriusChat.git
cd SiriusChat
pip install -e .
```

## 可选依赖

| 依赖组 | 用途 | 安装命令 |
|--------|------|----------|
| `provider` | Provider 运行依赖（httpx, tenacity） | `pip install sirius-pulse[provider]` |
| `quality` | Token 统计（tiktoken） | `pip install sirius-pulse[quality]` |
| `dev` | 开发工具（black, isort, mypy, pylint 等） | `pip install sirius-pulse[dev]` |
| `test` | 测试框架（pytest 系列） | `pip install sirius-pulse[test]` |

### 一键安装开发环境

```bash
pip install -e ".[dev,test,provider,quality]"
```

## 服务组件

### Embedding 服务

语义记忆搜索依赖 Embedding 服务。首次启动时会自动从 Hugging Face 下载模型（~1.5GB）。

```bash
# 默认启动
sirius-pulse run

# 手动指定模型
sirius-pulse run --embedding-model BAAI/bge-small-zh-v1.5
```

### NapCat（QQ 平台）

自动在 NapCat 管理器中安装。详细配置见 [NapCat 接入指南](./platform-napcat)。

## 目录结构

安装并运行后，会自动生成以下目录：

```
data/
├── global_config.json       # 全局配置
├── providers/
│   └── provider_keys.json   # LLM 凭证
├── adapter_port_registry.json
└── personas/
    └── {name}/              # 人格数据
        ├── persona.json
        ├── orchestration.json
        ├── adapters.json
        ├── experience.json
        ├── engine_state/    # 运行时状态
        ├── memory/          # 语义记忆
        ├── diary/           # 日记记忆
        ├── skill_data/      # 技能数据
        └── logs/            # 日志
```

## 验证安装

```bash
# 启动 WebUI
sirius-pulse webui

# 检查版本
python -c "import sirius_pulse; print(sirius_pulse.__version__)"
```

## 常见问题

### Q: 启动报错 "no provider available"

确保 `data/providers/provider_keys.json` 中配置了至少一个 Provider 的 API Key。

### Q: Embedding 服务启动失败

检查磁盘空间（需要 ~2GB），或使用 `BAAI/bge-small-zh-v1.5` 轻量模型。

### Q: pip 安装慢

使用国内镜像源：

```bash
pip install sirius-pulse -i https://pypi.tuna.tsinghua.edu.cn/simple
```
