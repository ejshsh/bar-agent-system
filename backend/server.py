from __future__ import annotations

import json
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .db import (
    approve_purchase,
    backup_database,
    batch_create_purchase_orders,
    batch_deactivate_customer_storage,
    compare_supplier_price_quotes,
    create_agent_report,
    create_inventory_adjustment,
    create_inventory_audit,
    create_product,
    create_purchase_approval,
    create_purchase_order,
    create_sales_record,
    create_supplier,
    create_supplier_price_quote,
    create_customer_storage,
    deactivate_customer_storage,
    deactivate_product,
    deactivate_supplier,
    delete_agent_report,
    delete_purchase_order,
    get_backup_info,
    get_agent_report,
    get_agent_reports,
    get_inventory_audits,
    get_monthly_budget,
    get_monthly_spent,
    get_operation_logs,
    get_pending_approvals,
    get_recent_sales_trend,
    get_todays_report,
    import_csv_data,
    initialize_database,
    insert_operation_log,
    load_dataset,
    pickup_customer_storage,
    reject_purchase,
    set_monthly_budget,
    update_customer_storage,
)
from .ai_agent import ask_deepseek
from .rules import agent_ask, build_chart_data, build_dashboard, compute_revenue_forecast, generate_monthly_report


DEFAULT_DB_PATH = Path("data/bar_agent.db")


class BarApi:
    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)

    def handle_get(self, path: str) -> tuple[int, dict[str, str], str]:
        parsed = urlparse(path)
        route = parsed.path
        initialize_database(self.db_path)

        if route == "/api/health":
            return self._json(200, {"status": "ok", "service": "bar-agent-api"})

        if route == "/docs" or route == "/docs/":
            return self._serve_docs()

        dataset = load_dataset(self.db_path)

        if route == "/api/dashboard":
            dashboard = build_dashboard(dataset)
            dashboard["products"] = dataset["products"]
            dashboard["customer_storage"] = dataset["customer_storage"]
            now = datetime.now()
            budget_row = get_monthly_budget(self.db_path, now.year, now.month)
            spent = get_monthly_spent(self.db_path, now.year, now.month)
            budget_amount = budget_row["amount"] if budget_row else 0
            remaining = max(budget_amount - spent, 0) if budget_amount > 0 else 0
            percent_used = round((spent / budget_amount) * 100, 1) if budget_amount > 0 else 0
            alert = None
            if budget_amount > 0 and percent_used >= 95:
                alert = "critical"
            elif budget_amount > 0 and percent_used >= 80:
                alert = "warning"
            dashboard["budget"] = {
                "budget": budget_amount,
                "spent": round(spent, 2),
                "remaining": round(remaining, 2),
                "percent_used": percent_used,
                "alert": alert,
            }
            return self._json(200, dashboard)
        if route == "/api/products":
            return self._json(200, {"items": dataset["products"]})
        if route == "/api/suppliers":
            return self._json(200, {"items": dataset["suppliers"]})
        if route == "/api/customer-storage":
            return self._json(200, {"items": dataset["customer_storage"]})
        if route == "/api/supplier-price-quotes":
            query = dict(pair.split("=", 1) for pair in parsed.query.split("&") if "=" in pair)
            try:
                comparison = compare_supplier_price_quotes(self.db_path, int(query["product_id"]))
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_supplier_price_quote_query", "message": str(error)})
            return self._json(200, comparison)

        if route == "/api/sales-records":
            return self._json(200, {"items": dataset["sales_records"]})
        if route == "/api/purchase-orders":
            return self._json(200, {"items": dataset["purchase_orders"]})
        if route == "/api/inventory-records":
            return self._json(200, {"items": dataset["inventory_records"]})

        if route == "/api/chart-data":
            chart_data = build_chart_data(dataset)
            return self._json(200, chart_data)

        if route == "/api/revenue-forecast":
            trend = get_recent_sales_trend(self.db_path, 14)
            forecast = compute_revenue_forecast(trend)
            return self._json(200, forecast)

        if route == "/api/budget":
            query = dict(pair.split("=", 1) for pair in parsed.query.split("&") if "=" in pair)
            try:
                b_year = int(query.get("year", datetime.now().year))
                b_month = int(query.get("month", datetime.now().month))
            except (ValueError, TypeError):
                return self._json(400, {"error": "year and month must be integers"})
            budget_row = get_monthly_budget(self.db_path, b_year, b_month)
            spent = get_monthly_spent(self.db_path, b_year, b_month)
            budget_amount = budget_row["amount"] if budget_row else 0
            remaining = max(budget_amount - spent, 0) if budget_amount > 0 else 0
            percent_used = round((spent / budget_amount) * 100, 1) if budget_amount > 0 else 0
            alert = None
            if budget_amount > 0 and percent_used >= 95:
                alert = "critical"
            elif budget_amount > 0 and percent_used >= 80:
                alert = "warning"
            return self._json(200, {
                "budget": budget_amount,
                "spent": round(spent, 2),
                "remaining": round(remaining, 2),
                "percent_used": percent_used,
                "alert": alert,
            })

        if route == "/api/backup/info":
            return self._json(200, get_backup_info(self.db_path))

        if route == "/api/agent-reports":
            reports = get_agent_reports(self.db_path)
            return self._json(200, {"items": reports})

        if route == "/api/operation-logs":
            return self._json(200, {"items": get_operation_logs(self.db_path)})

        if route == "/api/recent-sales-trend":
            return self._json(200, {"items": get_recent_sales_trend(self.db_path)})

        if route == "/api/todays-report":
            report = get_todays_report(self.db_path)
            if report is None:
                return self._json(404, {"error": "no_report_today"})
            return self._json(200, report)

        if route == "/api/setup-check":
            ds = load_dataset(self.db_path)
            product_count = len(ds["products"])
            supplier_count = len(ds["suppliers"])
            return self._json(200, {
                "needs_setup": product_count <= 4 and supplier_count <= 3,
                "product_count": product_count,
                "supplier_count": supplier_count,
            })

        if route == "/api/pending-approvals":
            approvals = get_pending_approvals(self.db_path)
            return self._json(200, {"items": approvals})

        if route == "/api/inventory-audits":
            audits = get_inventory_audits(self.db_path)
            return self._json(200, {"items": audits})

        segments = [segment for segment in route.split("/") if segment]
        if len(segments) == 3 and segments[:2] == ["api", "agent-reports"]:
            try:
                report = get_agent_report(self.db_path, int(segments[2]))
            except ValueError:
                return self._json(400, {"error": "invalid_report_id"})
            if report is None:
                return self._json(404, {"error": "report_not_found"})
            return self._json(200, report)

        return self._json(404, {"error": "not_found", "path": route})

    def handle_delete(self, path: str) -> tuple[int, dict[str, str], str]:
        route = urlparse(path).path
        initialize_database(self.db_path)
        segments = [segment for segment in route.split("/") if segment]

        if len(segments) == 3 and segments[:2] == ["api", "products"]:
            deleted = deactivate_product(self.db_path, int(segments[2]))
            return self._json(200 if deleted else 404, {"deleted": deleted})

        if len(segments) == 3 and segments[:2] == ["api", "suppliers"]:
            deleted = deactivate_supplier(self.db_path, int(segments[2]))
            return self._json(200 if deleted else 404, {"deleted": deleted})

        if len(segments) == 3 and segments[:2] == ["api", "customer-storage"]:
            deleted = deactivate_customer_storage(self.db_path, int(segments[2]))
            return self._json(200 if deleted else 404, {"deleted": deleted})

        if len(segments) == 3 and segments[:2] == ["api", "agent-reports"]:
            deleted = delete_agent_report(self.db_path, int(segments[2]))
            return self._json(200 if deleted else 404, {"deleted": deleted})

        if len(segments) == 3 and segments[:2] == ["api", "purchase-orders"]:
            deleted = delete_purchase_order(self.db_path, int(segments[2]))
            return self._json(200 if deleted else 404, {"deleted": deleted})

        return self._json(404, {"error": "not_found", "path": route})

    def handle_put(self, path: str, body: str) -> tuple[int, dict[str, str], str]:
        route = urlparse(path).path
        initialize_database(self.db_path)
        segments = [segment for segment in route.split("/") if segment]

        try:
            payload = json.loads(body or "{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "invalid_json"})

        if len(segments) == 3 and segments[:2] == ["api", "customer-storage"]:
            try:
                customer_storage = update_customer_storage(self.db_path, int(segments[2]), payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_customer_storage", "message": str(error)})
            return self._json(200, {"customer_storage": customer_storage})

        if route == "/api/budget":
            try:
                b_year = int(payload["year"])
                b_month = int(payload["month"])
                amount = float(payload["amount"])
            except (KeyError, TypeError, ValueError):
                return self._json(400, {"error": "year, month, and amount required"})
            if amount < 0:
                return self._json(400, {"error": "amount must be non-negative"})
            result = set_monthly_budget(self.db_path, b_year, b_month, amount)
            insert_operation_log(self.db_path, "set_budget", "budgets", None,
                f"设置预算 {b_year}-{b_month:02d} = ¥{amount}")
            return self._json(200, {"budget": result})

        return self._json(404, {"error": "not_found", "path": route})

    def handle_post(self, path: str, body: str) -> tuple[int, dict[str, str], str]:
        route = urlparse(path).path
        initialize_database(self.db_path)
        segments = [segment for segment in route.split("/") if segment]

        try:
            payload = json.loads(body or "{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "invalid_json"})

        if route == "/api/purchase-orders":
            try:
                result = create_purchase_order(self.db_path, payload)
                insert_operation_log(self.db_path, "create", "purchase_orders", result["purchase_order"]["id"], f"采购入库 商品{payload.get('product_id')} x{payload.get('quantity')}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_purchase_order", "message": str(error)})
            return self._json(201, result)
        if route == "/api/products":
            try:
                product = create_product(self.db_path, payload)
                insert_operation_log(self.db_path, "create", "products", product["id"], f"新建商品 {payload.get('name')}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_product", "message": str(error)})
            return self._json(201, {"product": product})
        if route == "/api/suppliers":
            try:
                supplier = create_supplier(self.db_path, payload)
                insert_operation_log(self.db_path, "create", "suppliers", supplier["id"], f"新建供应商 {payload.get('name')}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_supplier", "message": str(error)})
            return self._json(201, {"supplier": supplier})
        if route == "/api/supplier-price-quotes":
            try:
                quote = create_supplier_price_quote(self.db_path, payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_supplier_price_quote", "message": str(error)})
            return self._json(201, {"quote": quote})
        if route == "/api/backup":
            result = backup_database(self.db_path)
            return self._json(200, result)
        if route == "/api/customer-storage/batch-delete":
            try:
                ids = [int(i) for i in payload.get("ids", [])]
                if not ids:
                    raise ValueError("ids is empty")
                count = batch_deactivate_customer_storage(self.db_path, ids)
            except (TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_batch_delete", "message": str(error)})
            return self._json(200, {"deleted_count": count})
        if route == "/api/customer-storage":
            try:
                customer_storage = create_customer_storage(self.db_path, payload)
                insert_operation_log(self.db_path, "create", "customer_storage", customer_storage["id"], f"新增客户存酒 {payload.get('customer_name')} - {payload.get('product_name')}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_customer_storage", "message": str(error)})
            return self._json(201, {"customer_storage": customer_storage})
        if len(segments) == 4 and segments[:2] == ["api", "customer-storage"] and segments[3] == "pickup":
            try:
                result = pickup_customer_storage(self.db_path, int(segments[2]), payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_storage_pickup", "message": str(error)})
            return self._json(201, result)
        if route == "/api/sales-records":
            try:
                result = create_sales_record(self.db_path, payload)
                insert_operation_log(self.db_path, "create", "sales_records", result["sales_record"]["id"], f"销售出库 商品{payload.get('product_id')} x{payload.get('quantity')}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_sales_record", "message": str(error)})
            return self._json(201, result)
        if route == "/api/inventory-adjustments":
            try:
                result = create_inventory_adjustment(self.db_path, payload)
                insert_operation_log(self.db_path, "adjust", "inventory_records", result["inventory_record"]["id"], f"库存调整 商品{payload.get('product_id')} ({payload.get('adjustment_type')})")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_inventory_adjustment", "message": str(error)})
            return self._json(201, result)
        if route == "/api/agent-reports":
            # Generate preview only - does NOT save to database
            try:
                dataset = load_dataset(self.db_path)
                report_data = generate_monthly_report(dataset)
                report_data["created_at"] = str(payload.get("created_at", datetime.now().isoformat()[:10]))
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_agent_report", "message": str(error)})
            return self._json(200, report_data)
        if route == "/api/agent-reports/save":
            # Explicitly save a report to database
            try:
                report = create_agent_report(self.db_path, payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_agent_report", "message": str(error)})
            return self._json(201, report)
        if route == "/api/agent-ask":
            try:
                dataset = load_dataset(self.db_path)
                question = str(payload.get("question", "")).strip()
                conversation_history = payload.get("conversation_history", [])
                follow_up = payload.get("follow_up", False)
                if not question:
                    raise ValueError("question is required")
                # Try DeepSeek AI first, fall back to rules
                try:
                    answer = ask_deepseek(dataset, question, conversation_history, follow_up)
                    if answer is not None:
                        return self._json(200, answer)
                except RuntimeError as ai_error:
                    answer = agent_ask(dataset, question)
                    answer["ai_note"] = f"AI 暂不可用（{ai_error}），以下为规则分析结果。"
                    return self._json(200, answer)
                answer = agent_ask(dataset, question)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_agent_ask", "message": str(error)})
            return self._json(200, answer)
        if route == "/api/purchase-orders/batch":
            try:
                items = payload.get("items", [])
                if not items:
                    raise ValueError("items is required")
                result = batch_create_purchase_orders(self.db_path, items)
                insert_operation_log(self.db_path, "batch_purchase", "purchase_orders", None, f"批量生成 {result['created']} 笔采购单")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_batch_purchase", "message": str(error)})
            return self._json(201, result)

        if route == "/api/customer-contact":
            try:
                storage_id = int(payload.get("storage_id", 0))
                action = str(payload.get("action", "notify"))
                if storage_id <= 0:
                    raise ValueError("storage_id is required")
                insert_operation_log(self.db_path, action, "customer_storage", storage_id, f"客户存酒{storage_id} {'发送通知' if action == 'notify' else '客户召回'}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_customer_contact", "message": str(error)})
            return self._json(200, {"contacted": True, "storage_id": storage_id, "action": action})

        if route == "/api/purchase-approvals":
            try:
                approval = create_purchase_approval(self.db_path, payload)
                insert_operation_log(self.db_path, "submit_approval", "purchase_approvals", approval["id"], f"待审批采购 商品{payload.get('product_id')} ¥{approval['total_amount']}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_approval", "message": str(error)})
            return self._json(201, approval)

        if route == "/api/inventory-audits":
            try:
                audit = create_inventory_audit(self.db_path, payload)
                insert_operation_log(self.db_path, "audit", "inventory_audits", audit["id"], f"盘点 商品{payload.get('product_id')} 差异{audit['discrepancy']}")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_audit", "message": str(error)})
            return self._json(201, audit)

        if len(segments) == 4 and segments[:2] == ["api", "purchase-approvals"]:
            try:
                approval_id = int(segments[2])
                action = segments[3]
            except (ValueError, IndexError):
                return self._json(400, {"error": "invalid_approval_path"})
            if action == "approve":
                result = approve_purchase(self.db_path, approval_id)
                if result is None:
                    return self._json(404, {"error": "approval_not_found_or_already_processed"})
                insert_operation_log(self.db_path, "approve", "purchase_approvals", approval_id, f"审批通过 ¥{result['approval']['total_amount']}")
                return self._json(200, result)
            if action == "reject":
                ok = reject_purchase(self.db_path, approval_id)
                if not ok:
                    return self._json(404, {"error": "approval_not_found_or_already_processed"})
                insert_operation_log(self.db_path, "reject", "purchase_approvals", approval_id, "审批驳回")
                return self._json(200, {"rejected": True})
            return self._json(400, {"error": "unknown_approval_action"})

        if route == "/api/import":
            try:
                import_type = str(payload.get("type", "")).strip()
                rows = payload.get("rows", [])
                if not import_type or not rows:
                    raise ValueError("type and rows are required")
                result = import_csv_data(self.db_path, import_type, rows)
                insert_operation_log(self.db_path, "import", import_type, None, f"批量导入 {import_type} 共 {result['imported']} 条")
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_import", "message": str(error)})
            return self._json(200, result)

        return self._json(404, {"error": "not_found", "path": route})

    def _json(self, status: int, payload: dict[str, Any]) -> tuple[int, dict[str, str], str]:
        body = json.dumps(payload, ensure_ascii=False, indent=2)
        return status, {"Content-Type": "application/json; charset=utf-8"}, body

    def _serve_docs(self) -> tuple[int, dict[str, str], str]:
        docs_html = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bar Agent API Docs</title>
<style>
  :root { --primary: #0066cc; --ink: #1d1d1f; --ink-muted: #6e6e73; --bg: #f5f5f7; --card: #fff; --border: #e0e0e0; --radius: 10px; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; padding: 40px 20px; }
  .container { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 700; margin-bottom: 8px; }
  .subtitle { color: var(--ink-muted); margin-bottom: 32px; font-size: 15px; }
  .endpoint { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; overflow: hidden; }
  .endpoint-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; cursor: pointer; }
  .endpoint-header:hover { background: #fafafa; }
  .method { border-radius: 5px; color: #fff; font-size: 12px; font-weight: 700; min-width: 56px; padding: 4px 10px; text-align: center; text-transform: uppercase; }
  .method.get { background: #34c759; }
  .method.post { background: #0066cc; }
  .method.put { background: #ff9500; }
  .method.delete { background: #ff3b30; }
  .method.options { background: #8e8e93; }
  .endpoint-path { font-family: "SF Mono", monospace; font-size: 15px; font-weight: 600; }
  .endpoint-desc { color: var(--ink-muted); font-size: 13px; margin-left: auto; }
  .endpoint-body { border-top: 1px solid var(--border); display: none; padding: 16px 20px; }
  .endpoint-body.open { display: block; }
  .section-title { color: var(--ink-muted); font-size: 12px; font-weight: 600; letter-spacing: 0.5px; margin: 20px 0 8px; text-transform: uppercase; }
  .code-block { background: #1d1d1f; border-radius: 6px; color: #e0e0e0; font-family: "SF Mono", monospace; font-size: 12px; line-height: 1.5; margin-top: 8px; overflow-x: auto; padding: 14px 16px; white-space: pre; }
  .param-table { border-collapse: collapse; font-size: 13px; margin-top: 8px; width: 100%; }
  .param-table th { background: var(--bg); border-bottom: 1px solid var(--border); padding: 8px 10px; text-align: left; }
  .param-table td { border-bottom: 1px solid #f0f0f0; padding: 8px 10px; }
  .toc { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 32px; padding: 16px 20px; }
  .toc a { color: var(--primary); font-size: 14px; text-decoration: none; }
  .toc a:hover { text-decoration: underline; }
  .home-link { display: inline-block; margin-bottom: 24px; color: var(--primary); font-size: 14px; text-decoration: none; }
</style>
</head>
<body>
<div class="container">
<a class="home-link" href="/">← 返回驾驶舱</a>
<h1>Bar Agent API</h1>
<p class="subtitle">酒吧酒水 AI Agent 经营驾驶舱 — 全部 API 端点文档</p>

<div class="toc">
  <a href="#dashboard">Dashboard</a> · <a href="#products">Products</a> · <a href="#suppliers">Suppliers</a> · <a href="#inventory">Inventory</a> · <a href="#sales">Sales</a> · <a href="#purchase">Purchase</a> · <a href="#storage">Storage</a> · <a href="#reports">Reports</a> · <a href="#agent">Agent</a> · <a href="#backup">Backup</a> · <a href="#approvals">Approvals</a> · <a href="#audits">Audits</a> · <a href="#import">Import</a> · <a href="#logs">Logs</a>
</div>

<div class="section-title" id="dashboard">Dashboard &amp; Data</div>

""" + self._doc_endpoint("GET", "/api/health", "Health check — 检查服务是否正常运行", None, None, '{"status":"ok","service":"bar-agent-api"}') + """
""" + self._doc_endpoint("GET", "/api/dashboard", "Dashboard 首页 — 返回所有模块聚合数据：指标、商品、库存预警、补货建议、供应商、活动建议", None, None, '{"metrics":{"low_stock_count":3,...},"products":[...],"replenishment":[...],...}') + """
""" + self._doc_endpoint("GET", "/api/chart-data", "图表数据 — 返回采购趋势、销量排行、品类分布、库存状态、利润分析", None, None, '{"purchase_trend":[...],"top_products":[...],"category_distribution":[...],...}') + """
""" + self._doc_endpoint("GET", "/api/recent-sales-trend", "近 7 天销售趋势 — 用于首页迷你趋势图", None, None, '{"items":[{"date":"2026-06-01","revenue":4200},...]}') + """
""" + self._doc_endpoint("GET", "/api/todays-report", "今日报告 — 返回今日已生成的经营报告", None, None, '{"period":"2026-06-04","metrics":{...}} or 404') + """
""" + self._doc_endpoint("GET", "/api/setup-check", "初始化检查 — 判断是否需要引导用户添加基础数据", None, None, '{"needs_setup":true,"product_count":4,"supplier_count":3}') + """

<div class="section-title" id="products">Products 商品管理</div>

""" + self._doc_endpoint("GET", "/api/products", "商品列表 — 返回所有未删除的商品", None, None, '{"items":[{"id":1,"name":"百龄坛12年","category":"威士忌","current_stock":3,"safety_stock":10,"unit":"瓶"},...]}') + """
""" + self._doc_endpoint("POST", "/api/products", "新建商品", [["name","string","商品名称","百龄坛12年"],["category","string","分类","威士忌"],["safety_stock","number","安全库存","10"],["current_stock","number","当前库存","0"],["unit","string","单位","瓶"]], '{"product":{"id":1,"name":"百龄坛12年",...}}') + """
""" + self._doc_endpoint("DELETE", "/api/products/{id}", "删除商品 — 软删除，设置 active=0", None, None, '{"deleted":true}') + """

<div class="section-title" id="suppliers">Suppliers 供应商管理</div>

""" + self._doc_endpoint("GET", "/api/suppliers", "供应商列表 — 返回所有未删除的供应商", None, None, '{"items":[{"id":1,"name":"港岛酒业","price_stability_score":94,"average_delivery_days":2.1},...]}') + """
""" + self._doc_endpoint("POST", "/api/suppliers", "新建供应商", [["name","string","供应商名称","港岛酒业"],["price_stability_score","number","价格稳定性 (0-100)","80"],["average_delivery_days","number","平均交付天数","3"]], '{"supplier":{"id":1,...}}') + """
""" + self._doc_endpoint("DELETE", "/api/suppliers/{id}", "删除供应商 — 软删除", None, None, '{"deleted":true}') + """

<div class="section-title" id="inventory">Inventory 库存管理</div>

""" + self._doc_endpoint("GET", "/api/inventory-records", "库存流水 — 所有库存变动记录", None, None, '{"items":[{"id":1,"product_id":1,"record_type":"purchase","quantity_change":12,...},...]}') + """
""" + self._doc_endpoint("POST", "/api/inventory-adjustments", "库存盘点/损耗 — 支持 count（盘点）和 loss（损耗）两种类型", [["product_id","number","商品 ID","1"],["adjustment_type","string","count 或 loss","count"],["actual_quantity","number","实际盘点数量 (count)","15"],["quantity","number","损耗数量 (loss)","2"],["reason","string","原因","月度盘点"],["occurred_at","string","日期","2026-06-04"]], '{"inventory_record":{"quantity_change":2,...}}') + """

<div class="section-title" id="sales">Sales 销售管理</div>

""" + self._doc_endpoint("GET", "/api/sales-records", "销售记录列表 — 所有出库记录", None, None, '{"items":[{"id":1,"product_id":1,"quantity":2,"unit_price":488,"sale_date":"2026-06-04"},...]}') + """
""" + self._doc_endpoint("POST", "/api/sales-records", "销售出库 — 扣减库存并记录", [["product_id","number","商品 ID","1"],["quantity","number","出库数量","2"],["unit_price","number","销售单价","488"],["sale_date","string","出库日期","2026-06-04"]], '{"sales_record":{...},"inventory_record":{"quantity_after":10}}') + """

<div class="section-title" id="purchase">Purchase 采购管理</div>

""" + self._doc_endpoint("GET", "/api/purchase-orders", "采购记录列表 — 所有采购订单", None, None, '{"items":[{"id":1,"product_id":1,"supplier_id":1,"quantity":12,"unit_price":198,"order_date":"2026-06-04"},...]}') + """
""" + self._doc_endpoint("POST", "/api/purchase-orders", "单笔采购入库 — 增加库存并记录", [["product_id","number","商品 ID","1"],["supplier_id","number","供应商 ID","1"],["quantity","number","入库数量","12"],["unit_price","number","采购单价","198"],["order_date","string","采购日期","2026-06-04"]], '{"purchase_order":{...},"inventory_record":{"quantity_after":15}}') + """
""" + self._doc_endpoint("POST", "/api/purchase-orders/batch", "批量采购 — 一键生成多笔采购单", [["items","array","采购项数组","[{\"product_id\":1,\"supplier_id\":1,\"quantity\":12,\"unit_price\":198,\"order_date\":\"2026-06-04\"}]"]], '{"created":3,"orders":[...]}') + """
""" + self._doc_endpoint("DELETE", "/api/purchase-orders/{id}", "删除采购单", None, None, '{"deleted":true}') + """

<div class="section-title" id="storage">Storage 客户存酒</div>

""" + self._doc_endpoint("GET", "/api/customer-storage", "客户存酒列表 — 所有有效存酒记录", None, None, '{"items":[{"id":1,"customer_name":"陈先生","product_name":"皇家礼炮","remaining_quantity":420,"days_until_expiry":7},...]}') + """
""" + self._doc_endpoint("POST", "/api/customer-storage", "新增客户存酒", [["customer_name","string","客户姓名","王先生"],["phone","string","手机号码","13800138000"],["product_name","string","存酒名称","皇家礼炮"],["remaining_quantity","number","剩余酒量","1"],["days_until_expiry","number","距到期天数","30"]], '{"customer_storage":{"id":1,...}}') + """
""" + self._doc_endpoint("PUT", "/api/customer-storage/{id}", "编辑客户存酒", [["customer_name","string","客户姓名",""],["phone","string","手机号码",""],["product_name","string","存酒名称",""],["remaining_quantity","number","剩余酒量",""],["days_until_expiry","number","距到期天数",""]], '{"customer_storage":{...}}') + """
""" + self._doc_endpoint("DELETE", "/api/customer-storage/{id}", "删除客户存酒 — 软删除", None, None, '{"deleted":true}') + """
""" + self._doc_endpoint("POST", "/api/customer-storage/{id}/pickup", "客户取酒核销 — 扣减剩余酒量", [["quantity","number","取酒量","0.5"],["picked_up_at","string","取酒日期","2026-06-04"]], '{"customer_storage":{"remaining_quantity":0.5,...}}') + """
""" + self._doc_endpoint("POST", "/api/customer-storage/batch-delete", "批量删除客户存酒", [["ids","number[]","存酒 ID 数组","[1,2,3]"]], '{"deleted_count":3}') + """
""" + self._doc_endpoint("POST", "/api/customer-contact", "客户联系记录 — notify（通知）或 recall（召回）", [["storage_id","number","存酒 ID","1"],["action","string","notify 或 recall","notify"]], '{"contacted":true}') + """

<div class="section-title" id="reports">Reports 经营报告</div>

""" + self._doc_endpoint("GET", "/api/agent-reports", "报告列表 — 所有已保存的报告", None, None, '{"items":[{"id":1,"title":"月度经营报告","period":"2026-06",...},...]}') + """
""" + self._doc_endpoint("GET", "/api/agent-reports/{id}", "单份报告详情", None, None, '{"id":1,"title":"...","content":"...","metrics":{...}}') + """
""" + self._doc_endpoint("POST", "/api/agent-reports", "预览报告 — AI 生成报告预览，不保存数据库", [["created_at","string","报告日期","2026-06-04"]], '{"title":"...","content":"...","metrics":{...}}') + """
""" + self._doc_endpoint("POST", "/api/agent-reports/save", "保存报告 — 将报告写入数据库", [["title","string","报告标题",""],["period","string","周期","2026-06"],["content","string","报告正文",""],["metrics","object","指标数据","{}"]], '{"id":1,...}') + """
""" + self._doc_endpoint("DELETE", "/api/agent-reports/{id}", "删除报告", None, None, '{"deleted":true}') + """

<div class="section-title" id="agent">Agent AI 助手</div>

""" + self._doc_endpoint("POST", "/api/agent-ask", "AI Agent 问答 — 调用 DeepSeek API 进行自然语言分析，fallback 至规则引擎", [["question","string","经营问题","本月采购成本为什么上升？"],["follow_up","boolean","是否为追问","false"],["conversation_history","string[]","对话历史","[]"]], '{"answer":"分析结果...","model":"deepseek-chat"}') + """

<div class="section-title" id="backup">Backup 数据备份</div>

""" + self._doc_endpoint("GET", "/api/backup/info", "备份文件列表 — 返回备份目录中所有备份文件信息", None, None, '{"total_count":3,"backups":[...]}') + """
""" + self._doc_endpoint("POST", "/api/backup", "创建备份 — 复制数据库文件到备份目录", None, None, '{"filename":"bar_agent_20260604_120000.db","size_kb":256}') + """

<div class="section-title" id="approvals">Approvals 采购审批</div>

""" + self._doc_endpoint("GET", "/api/pending-approvals", "待审批列表 — 所有 pending 状态的采购审批", None, None, '{"items":[...]}') + """
""" + self._doc_endpoint("POST", "/api/purchase-approvals", "提交审批 — 创建新的采购审批单", [["product_id","number","商品 ID","1"],["supplier_id","number","供应商 ID","1"],["quantity","number","数量","12"],["unit_price","number","单价","198"]], '{"id":1,...}') + """
""" + self._doc_endpoint("POST", "/api/purchase-approvals/{id}/approve", "审批通过 — 自动创建采购单", None, None, '{"approval":{...},"purchase_order":{...}}') + """
""" + self._doc_endpoint("POST", "/api/purchase-approvals/{id}/reject", "审批驳回", None, None, '{"rejected":true}') + """

<div class="section-title" id="audits">Audits 库存盘点</div>

""" + self._doc_endpoint("GET", "/api/inventory-audits", "盘点历史 — 所有盘点记录", None, None, '{"items":[...]}') + """
""" + self._doc_endpoint("POST", "/api/inventory-audits", "提交盘点 — 对比系统库存与实际库存", [["product_id","number","商品 ID","1"],["actual_stock","number","实际盘点数量","15"],["note","string","备注",""],["audited_at","string","盘点日期","2026-06-04"]], '{"system_stock":12,"actual_stock":15,"discrepancy":3}') + """

<div class="section-title" id="import">Import 数据导入</div>

""" + self._doc_endpoint("POST", "/api/import", "批量导入 — 支持 products/suppliers/customer-storage 类型", [["type","string","导入类型","products"],["rows","object[]","数据行数组","[{\"name\":\"...\",\"category\":\"...\",...}]"]], '{"imported":5,"errors":[],"total":5}') + """

<div class="section-title" id="logs">Logs 操作日志</div>

""" + self._doc_endpoint("GET", "/api/operation-logs", "操作日志列表 — 所有增删改操作记录", None, None, '{"items":[{"id":1,"action":"create","target_type":"products","details":"...","created_at":"..."},...]}') + """

</div>
<script>
document.querySelectorAll('.endpoint-header').forEach(h => {
  h.addEventListener('click', () => h.nextElementSibling.classList.toggle('open'));
});
</script>
</body>
</html>"""
        return 200, {"Content-Type": "text/html; charset=utf-8"}, docs_html

    def _doc_endpoint(self, method: str, path: str, desc: str, params=None, example_req=None, example_resp: str = "") -> str:
        params_html = ""
        if params:
            rows = "".join(
                f"<tr><td><code>{p[0]}</code></td><td>{p[1]}</td><td>{'<em>必填</em>' if len(p) > 3 else '可选'}</td><td>{p[-1] if len(p) > 3 else '—'}</td></tr>"
                for p in params
            )
            params_html = f"""<table class="param-table"><tr><th>参数</th><th>类型</th><th>必填</th><th>示例</th></tr>{rows}</table>"""

        method_lower = method.lower()
        resp_html = f'<div class="code-block">{example_resp}</div>' if example_resp else ""

        return f"""<div class="endpoint">
  <div class="endpoint-header">
    <span class="method {method_lower}">{method}</span>
    <span class="endpoint-path">{path}</span>
    <span class="endpoint-desc">{desc}</span>
  </div>
  <div class="endpoint-body">
    {params_html}
    {resp_html}
  </div>
</div>
"""


def create_app(db_path: str | Path = DEFAULT_DB_PATH) -> BarApi:
    return BarApi(db_path)


def make_handler(app: BarApi) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            status, headers, body = app.handle_get(self.path)
            encoded = body.encode("utf-8")
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(encoded)

        def do_POST(self) -> None:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            status, headers, response_body = app.handle_post(self.path, body)
            encoded = response_body.encode("utf-8")
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(encoded)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_DELETE(self) -> None:
            status, headers, response_body = app.handle_delete(self.path)
            encoded = response_body.encode("utf-8")
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(encoded)

        def do_PUT(self) -> None:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            status, headers, response_body = app.handle_put(self.path, body)
            encoded = response_body.encode("utf-8")
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, format: str, *args: Any) -> None:
            return

    return Handler


def run(host: str = "127.0.0.1", port: int = 8000, db_path: str | Path = DEFAULT_DB_PATH) -> None:
    app = create_app(db_path)
    server = ThreadingHTTPServer((host, port), make_handler(app))
    print(f"Bar Agent API listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
