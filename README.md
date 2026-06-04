# Bar Agent

> AI 辅助酒水采购、仓储库存与客户存酒管理系统

Bar Agent 是一个面向酒吧、餐饮门店和小型仓储场景的经营管理原型系统。系统围绕采购计划、库存周转、客户存酒、供应商评价和经营分析构建，结合规则引擎与 AI Agent，帮助门店快速识别缺货、积压、临期存酒和采购异常，并生成补货建议与经营报告。

该项目由 Codex 辅助完成需求拆解、系统设计、功能开发和调试验证，适合作为 AI + 供应链库存管理、仓储规划、采购计划优化方向的项目展示。

## 核心亮点

- **经营驾驶舱**：集中展示今日营收、库存健康、缺货预警、临期存酒、供应商表现和经营建议。
- **智能补货规则**：基于安全库存、当前库存、历史消耗和供应商交付周期，输出补货优先级与建议采购量。
- **供应商评价**：记录采购报价、交付周期和价格稳定性，支持供应商横向对比与推荐。
- **AI Agent 分析**：支持自然语言查询缺货商品、积压库存、采购建议、供应商稳定性和月度经营报告。
- **权限与审计**：区分管理员和店员权限，记录关键操作日志，危险操作前自动备份数据库。

## 功能模块

| 模块 | 能力 |
| --- | --- |
| 采购管理 | 采购入库、自定义酒水、自定义供应商、采购记录、价格异常识别 |
| 库存管理 | 库存出库、盘点调整、损耗记录、缺货预警、积压识别 |
| 客户存酒 | 存酒登记、编辑、删除、取酒核销、到期提醒、客户召回分析 |
| 供应商管理 | 供应商资料、报价记录、交付周期、价格稳定性、供应商评分 |
| AI Agent | 经营问答、补货建议、库存分析、供应商对比、月度报告 |
| 系统管理 | 角色权限、系统设置、操作日志、数据备份 |

## 技术架构

```text
Frontend
  HTML / CSS / JavaScript
  Apple-style dashboard / responsive UI / PWA manifest

Backend
  Python standard library HTTP server
  JSON API / role permission / operation audit

Database
  SQLite
  Products / Suppliers / Purchase Orders / Inventory Records
  Sales Records / Customer Storage / Reports / Settings

AI & Rules
  Rule Engine
  DeepSeek API optional integration
  Fallback analysis when API key is not configured
```

## 目录结构

```text
.
├─ index.html              # 前端入口
├─ styles.css              # 视觉样式
├─ app.js                  # 全局状态和初始化
├─ js/                     # 前端功能模块
├─ backend/
│  ├─ server.py            # JSON API 服务
│  ├─ db.py                # SQLite 建表与数据操作
│  ├─ rules.py             # 库存、采购、供应商分析规则
│  └─ ai_agent.py          # DeepSeek 调用与回退逻辑
├─ tests/                  # API 和规则测试
├─ start.bat               # 本地一键启动
└─ README.md
```

## 快速启动

Windows 下直接双击：

```text
start.bat
```

启动后访问：

```text
http://127.0.0.1:8765/index.html
```

默认账号：

```text
管理员：admin / admin123
店员：staff / staff123
```

后端 API 默认运行在：

```text
http://127.0.0.1:8000
```

健康检查：

```text
http://127.0.0.1:8000/api/health
```

## 手机局域网访问

电脑和手机连接同一个 Wi-Fi 后：

1. 电脑运行 `start.bat`。
2. 在电脑命令行执行 `ipconfig`，找到当前网络的 IPv4 地址。
3. 手机浏览器打开：

```text
http://电脑IPv4地址:8765/index.html
```

例如：

```text
http://192.168.1.23:8765/index.html
```

如果无法访问，需要允许 Windows 防火墙中的 Python 专用网络访问。

## DeepSeek 配置

项目支持 DeepSeek API，但不是必须配置。未配置密钥时，AI Agent 会自动回退到本地规则引擎。

```powershell
copy .env.example .env
```

在 `.env` 中填写：

```text
DEEPSEEK_API_KEY=你的密钥
```

`.env` 已被 `.gitignore` 忽略，不会上传到 GitHub。

## 测试验证

后端和规则测试：

```powershell
python -m unittest discover -s tests -v
```

前端静态检查：

```powershell
node tests\check_frontend.js
```

关键验证项：

- API 返回 JSON 数据并支持 dashboard 渲染
- 采购、库存、客户存酒、供应商、报告等核心接口可用
- 店员权限无法执行高危管理动作
- 删除类操作前自动创建数据库备份

## 数据与安全

- 默认使用 SQLite，本地首次启动会自动生成 `data/bar_agent.db`。
- 操作日志会记录操作人、角色、操作类型和对象。
- 管理员与店员密码以哈希形式保存在数据库中。
- `.env`、数据库、备份和缓存文件均已加入忽略规则。

## 适用场景

- 供应链库存管理项目展示
- 餐饮/酒吧门店经营原型
- AI Agent 辅助经营分析 Demo
- 采购计划、仓储管理和供应商评价课程项目
- 物流规划、库存优化、资源配置相关简历项目
