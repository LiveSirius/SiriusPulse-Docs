# Sirius Pulse CLI 命令行工具

## 概述

Sirius Pulse CLI 是 Sirius Chat 项目的命令行接口，用于管理人格（Persona）实例、运行 WebUI 服务及执行日常操作。它基于 `sirius_pulse.cli` 模块实现，提供直观的子命令体系，支持异步任务与进程管理。

## 安装

CLI 随项目一起安装，确保已安装 Sirius Pulse：

```bash
pip install sirius-pulse
```

或从源码安装：

```bash
git clone <repo>
cd sirius-pulse
pip install -e .
```

## 快速开始

启动所有已启用的人格及 WebUI 服务：

```bash
python -m sirius_pulse.cli run
```

仅启动 WebUI（管理模式，不运行人格）：

```bash
python -m sirius_pulse.cli webui
```

列出所有人格：

```bash
python -m sirius_pulse.cli persona list
```

创建人格：

```bash
python -m sirius_pulse.cli persona create <name>
```

## 命令参考

### `run`

启动所有已启用的人格实例和 WebUI 服务。NapCat（QQ 适配器）由人格子进程自动管理。

用法：

```bash
python -m sirius_pulse.cli run
```

启动流程：
1. 加载全局配置（`data/global_config.json`）
2. 启动 WebUI（监听 `host:port`，默认 `0.0.0.0:8080`）
3. 等待 Embedding 服务就绪（默认 `http://127.0.0.1:18900`，超时 60 秒）
4. 启动所有启用人格

按 `Ctrl+C` 停止所有服务。

### `webui`

仅启动 WebUI 服务，不启动任何人格实例。适用于需要单独管理人格或调试 WebUI 的场景。

用法：

```bash
python -m sirius_pulse.cli webui
```

### `persona`

人格管理子命令，包含以下操作：

#### `persona list`

列出所有人格及其详细信息，包括：
- 人格名（name）
- 角色名（persona_name）
- 运行状态（running/stopped）
- 进程 ID（pid）
- 端口（port）
- 适配器数量（adapters_count）

用法：

```bash
python -m sirius_pulse.cli persona list
```

#### `persona create <name>`

创建新的人格。会在 `data/personas/<name>/` 目录下生成初始配置文件。

用法：

```bash
python -m sirius_pulse.cli persona create my_bot
```

创建后提示编辑 `adapters.json` 配置连接，然后运行 `run` 命令。

#### `persona remove <name>`

删除指定人格及其所有数据。

用法：

```bash
python -m sirius_pulse.cli persona remove my_bot
```

#### `persona migrate <source> <name>`

从旧目录迁移人格数据。`<source>` 是旧人格文件夹的路径。

用法：

```bash
python -m sirius_pulse.cli persona migrate /path/to/old_persona my_bot
```

#### `persona start <name>`

在前台启动单个人格实例（包含 NapCat 自动管理）。用于调试或单独运行某个人格。

用法：

```bash
python -m sirius_pulse.cli persona start my_bot
```

启动时会自动检查 NapCat 安装状态，未安装则尝试自动下载并安装。

#### `persona stop <name>`

停止指定的人格实例。

用法：

```bash
python -m sirius_pulse.cli persona stop my_bot
```

#### `persona status <name>`

查看指定人格的运行状态（运行中 / 已停止）、端口和适配器信息。

用法：

```bash
python -m sirius_pulse.cli persona status my_bot
```

## 全局配置

CLI 使用 `data/global_config.json` 文件进行全局设置，默认内容如下：

```json
{
  "webui_host": "0.0.0.0",
  "webui_port": 8080,
  "napcat_install_dir": "./napcat",
  "log_level": "INFO",
  "embedding_url": "http://127.0.0.1:18900"
}
```

- `webui_host` / `webui_port`：WebUI 监听地址和端口。
- `napcat_install_dir`：NapCat 安装目录。
- `log_level`：日志级别（DEBUG, INFO, WARNING, ERROR）。
- `embedding_url`：Embedding 服务的 URL。

配置文件会在首次运行 CLI 时自动创建。

## 兼容性包装

为了向后兼容，`main.py` 仍保留作为入口点，实际委托给 `sirius_pulse.cli`。以下命令等价：

```bash
python main.py run
# 等价于
python -m sirius_pulse.cli run
```

## 环境变量

- `SIRIUS_LOG_LEVEL`：覆盖配置文件中的日志级别。
- `SIRIUS_DATA_DIR`：自定义数据目录（默认 `./data`）。

## 错误处理

- 当 Embedding 服务在 60 秒内未就绪时，`run` 命令会报错退出。
- 如果创建重复人格，会提示“人格已存在”并返回退出码 1。
- 删除不存在的人格也会返回退出码 1。

## 常见问题

### Q: 启动时提示“Embedding 服务不可用”

请确保 Embedding 服务已独立运行：

```bash
python -m sirius_pulse.embedding.server
```

或检查 `embedding_url` 配置是否正确。

### Q: NapCat 自动安装失败

请在 `napcat_install_dir` 目录中手动安装 NapCat，或检查网络连接。