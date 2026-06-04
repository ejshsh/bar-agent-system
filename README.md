# 酒吧酒水采购、仓储与客户存酒管理 AI Agent 系统

这是一个面向酒吧经营场景的管理系统原型，覆盖酒水采购、仓储库存、客户存酒、供应商分析、智能补货和活动建议。当前仓库已包含技术方案文档和一个 Apple 风格的静态前端原型。

## 当前内容

- `index.html`：静态前端原型入口。
- `styles.css`：Apple 风格视觉系统、响应式布局和页面样式。
- `app.js`：导航选中、AI Agent 问答切换、活动建议切换。
- `backend/db.py`：SQLite 建表、种子数据和数据读取。
- `backend/rules.py`：缺货、积压、临期存酒、采购异常和 Agent 建议规则。
- `backend/server.py`：基于 Python 标准库的 JSON API 服务。
- `tests/`：后端规则和 API 单元测试。
- `docs/superpowers/specs/2026-06-04-bar-ai-agent-technical-design.md`：系统技术方案。
- `docs/superpowers/specs/2026-06-04-bar-frontend-apple-prototype-design.md`：前端原型设计说明。
- `docs/superpowers/plans/2026-06-04-bar-frontend-apple-prototype.md`：前端原型实现计划。

## 查看前端原型

前端会优先请求后端：

```text
http://127.0.0.1:8000/api/dashboard
```

如果后端未启动，页面会自动保留演示数据，并在顶部显示“演示数据”。

直接用浏览器打开：

```text
D:\doucments\酒吧项目\index.html
```

也可以在项目目录启动本地静态服务器：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:8765/index.html
```

## 已验证项

- `index.html` 已引用 `styles.css` 和 `app.js`。
- 页面包含首屏、库存预警、AI Agent、客户存酒、活动建议和供应商表现模块。
- `app.js` 通过 `node --check app.js` 语法检查。
- `app.js` 会请求 `/api/dashboard`，成功后渲染真实指标和建议，失败后回退演示数据。
- 前端静态检查通过 `node tests/check_frontend.js`。
- 后端单元测试通过 `python -m unittest discover -s tests -v`。
- CSS 未使用视口宽度字体、装饰渐变或负字距。
- 已保留移动端断点，避免主要模块在窄屏下横向拥挤。

## 启动后端 API

当前后端为了保证离线可运行，先使用 Python 标准库实现 JSON API，不依赖 FastAPI 或 Flask。后续可以在接口稳定后迁移到 FastAPI。

启动命令：

```powershell
python -m backend.server
```

如果后端已经在运行，修改代码后需要先停止旧 PowerShell 进程，再重新执行启动命令，否则浏览器仍会连到旧接口。

默认地址：

```text
http://127.0.0.1:8000
```

可用接口：

```text
GET /api/health
GET /api/dashboard
GET /api/products
GET /api/suppliers
GET /api/customer-storage
POST /api/products
POST /api/suppliers
POST /api/purchase-orders
POST /api/customer-storage
PUT /api/customer-storage/{id}
DELETE /api/customer-storage/{id}
DELETE /api/products/{id}
DELETE /api/suppliers/{id}
```

采购入库接口示例：

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"product_id":1,"supplier_id":1,"quantity":10,"unit_price":210,"order_date":"2026-06-04"}' `
  "http://127.0.0.1:8000/api/purchase-orders"
```

提交成功后，系统会写入采购单、生成 `inventory_records` 入库流水，并更新商品当前库存。前端点击“新增采购单”即可打开采购入库表单。

采购入库表单支持两种方式：

- 选择已有酒水商品和供应商。
- 临时新建酒水商品和供应商，再直接完成本次采购入库。
- 删除选中的酒水商品或供应商。删除采用软删除，历史采购和库存流水不会被破坏，删除后的条目不再出现在选择列表中。

客户存酒管理支持：

- 新增客户存酒。
- 编辑客户姓名、存酒名称、剩余酒量和到期天数。
- 删除客户存酒记录。删除采用软删除，历史数据不直接物理移除。

首次启动会自动创建 SQLite 数据库：

```text
data/bar_agent.db
```

运行测试：

```powershell
python -m unittest discover -s tests -v
node tests\check_frontend.js
```

## 浏览器 QA 说明

已尝试用 Codex 内置浏览器打开本地页面：

- `file://` 地址被浏览器安全策略阻止。
- `http://127.0.0.1:8765/index.html` 和 `http://localhost:8765/index.html` 被客户端策略拦截。

因此当前完成的是文件级验证和静态布局约束检查。下一步建议在用户本机浏览器中打开 `index.html` 做人工视觉确认，重点查看首屏比例、中文换行、深色区对比度和移动端布局。

## 建议下一步

1. 做浏览器视觉走查，确认 Apple 风格是否符合预期。
2. 将静态原型迁移为 React 或 Vue 组件化前端。
3. 建立 SQLite 数据库和基础 API。
4. 用规则引擎实现缺货、积压、临期存酒、采购异常和供应商稳定性分析。
5. 将 AI Agent 问答从静态文案升级为基于真实数据的分析结果。
