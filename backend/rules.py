from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any


def detect_replenishment(
    products: list[dict[str, Any]],
    sales_records: list[dict[str, Any]],
    supplier_lead_days: float = 3,
) -> list[dict[str, Any]]:
    sales_by_product = _sum_sales(sales_records)
    suggestions = []

    for product in products:
        current_stock = float(product["current_stock"])
        safety_stock = float(product["safety_stock"])
        total_sales = sales_by_product.get(int(product["id"]), 0.0)
        daily_sales = total_sales / 30 if total_sales else 0.0
        projected_need = daily_sales * (supplier_lead_days + 7)
        shortage = max(safety_stock - current_stock, projected_need - current_stock)

        if shortage > 0:
            suggested_quantity = max(math.ceil(shortage), math.ceil(safety_stock * 1.5))
            suggestions.append(
                {
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "current_stock": current_stock,
                    "safety_stock": safety_stock,
                    "suggested_quantity": suggested_quantity,
                    "risk_level": "high" if current_stock < safety_stock else "medium",
                    "reason": "当前库存低于安全库存或无法覆盖采购周期。",
                }
            )

    return suggestions


def build_dashboard(data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    products = data["products"]
    sales_records = data["sales_records"]
    storage_records = data["customer_storage"]
    purchase_orders = data["purchase_orders"]
    suppliers = data["suppliers"]

    sales_by_product = _sum_sales(sales_records)
    low_stock = [item for item in products if float(item["current_stock"]) < float(item["safety_stock"])]
    overstock = [
        item
        for item in products
        if float(item["current_stock"]) > max(float(item["safety_stock"]) * 3, sales_by_product.get(int(item["id"]), 0.0) * 3)
    ]
    expiring_storage = [item for item in storage_records if int(item["days_until_expiry"]) <= 15]
    price_anomalies = [
        item
        for item in purchase_orders
        if float(item["average_price"]) > 0 and float(item["unit_price"]) >= float(item["average_price"]) * 1.15
    ]
    replenishment = detect_replenishment(products, sales_records)
    top_supplier = max(suppliers, key=lambda item: float(item["price_stability_score"])) if suppliers else None

    agent_suggestions = []
    if replenishment:
        names = "、".join(item["product_name"] for item in replenishment[:3])
        agent_suggestions.append(
            {
                "type": "replenishment",
                "question_key": "replenishment",
                "title": f"建议优先补货 {len(replenishment)} 个 SKU",
                "summary": f"{names} 库存风险较高，建议先生成采购单草稿。",
                "action": "生成采购单草稿",
            }
        )
    if expiring_storage:
        agent_suggestions.append(
            {
                "type": "customer_recall",
                "question_key": "storage",
                "title": f"{len(expiring_storage)} 位客户存酒进入提醒窗口",
                "summary": "建议优先触达到期 15 天内且剩余酒量较多的客户。",
                "action": "生成客户召回名单",
            }
        )
    if top_supplier:
        agent_suggestions.append(
            {
                "type": "supplier",
                "question_key": "supplier",
                "title": f"{top_supplier['name']} 价格最稳定",
                "summary": f"价格稳定性 {top_supplier['price_stability_score']}%，平均交付 {top_supplier['average_delivery_days']} 天。",
                "action": "查看供应商对比",
            }
        )
    activity_suggestions = _build_activity_suggestions(overstock, expiring_storage, products)
    if activity_suggestions:
        agent_suggestions.append(
            {
                "type": "promotion",
                "question_key": "promotion",
                "title": f"{len(activity_suggestions)} 个活动方案可评估",
                "summary": "系统已根据积压库存、临期存酒、高毛利和新品场景生成活动建议。",
                "action": "生成活动建议",
            }
        )

    return {
        "metrics": {
            "low_stock_count": len(low_stock),
            "overstock_count": len(overstock),
            "expiring_storage_count": len(expiring_storage),
            "price_anomaly_count": len(price_anomalies),
            "agent_suggestion_count": len(agent_suggestions),
        },
        "today": _build_today_summary(sales_records, data.get("inventory_records", [])),
        "inventory_alerts": {
            "low_stock": low_stock,
            "overstock": overstock,
        },
        "replenishment": replenishment,
        "expiring_storage": expiring_storage,
        "price_anomalies": price_anomalies,
        "suppliers": suppliers,
        "agent_suggestions": agent_suggestions,
        "activity_suggestions": activity_suggestions,
    }


def _build_today_summary(
    sales_records: list[dict[str, Any]],
    inventory_records: list[dict[str, Any]],
) -> dict[str, Any]:
    today = datetime.now().strftime("%Y-%m-%d")
    today_sales = [s for s in sales_records if str(s.get("sale_date", "")) == today]
    today_inv = [r for r in inventory_records if str(r.get("occurred_at", "")) == today]

    sales_count = len(today_sales)
    sales_qty = sum(float(s.get("quantity", 0)) for s in today_sales)
    sales_revenue = sum(
        float(s.get("quantity", 0)) * float(s.get("unit_price", 0))
        for s in today_sales
    )
    inbound_qty = sum(
        float(r["quantity_change"]) for r in today_inv if r.get("record_type") == "inbound"
    )
    outbound_qty = sum(
        abs(float(r["quantity_change"])) for r in today_inv if r.get("record_type") == "outbound"
    )

    return {
        "date": today,
        "sales_count": sales_count,
        "sales_quantity": round(sales_qty, 1),
        "sales_revenue": round(sales_revenue, 2),
        "inbound_quantity": round(inbound_qty, 1),
        "outbound_quantity": round(outbound_qty, 1),
    }


def _sum_sales(sales_records: list[dict[str, Any]]) -> dict[int, float]:
    totals: dict[int, float] = {}
    for record in sales_records:
        product_id = int(record["product_id"])
        totals[product_id] = totals.get(product_id, 0.0) + float(record["quantity"])
    return totals


def _build_activity_suggestions(
    overstock: list[dict[str, Any]],
    expiring_storage: list[dict[str, Any]],
    products: list[dict[str, Any]],
) -> list[dict[str, str]]:
    target_overstock = overstock[0]["name"] if overstock else "低周转酒水"
    target_customer_count = len(expiring_storage)
    premium_product = _first_product_name(products, "威士忌", "高毛利酒水")

    return [
        {
            "activity_key": "clearance",
            "title": "低周转库存清理",
            "summary": f"建议围绕 {target_overstock} 做买赠或组合套餐，优先降低积压库存。",
        },
        {
            "activity_key": "recall",
            "title": "临期存酒客户召回",
            "summary": f"建议触达 {target_customer_count} 位临期存酒客户，搭配会员夜或包厢权益。",
        },
        {
            "activity_key": "bundle",
            "title": "高毛利搭售",
            "summary": f"建议以 {premium_product} 设计双人套餐，提升桌均消费并保持毛利。",
        },
        {
            "activity_key": "new",
            "title": "新品试饮主题夜",
            "summary": "建议用限时试饮和二次到店券收集新品销售数据。",
        },
    ]


def _first_product_name(products: list[dict[str, Any]], category: str, fallback: str) -> str:
    for product in products:
        if product.get("category") == category:
            return str(product["name"])
    return fallback


def _month_period(today: datetime | None = None) -> str:
    """Return 'YYYY-MM' period string."""
    if today is None:
        today = datetime.now()
    return today.strftime("%Y-%m")


def _month_start(today: datetime | None = None) -> str:
    if today is None:
        today = datetime.now()
    return today.replace(day=1).strftime("%Y-%m-%d")


def generate_monthly_report(data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Generate a comprehensive monthly operations report."""
    products = data["products"]
    sales_records = data["sales_records"]
    purchase_orders = data["purchase_orders"]
    inventory_records = data["inventory_records"]
    storage_records = data["customer_storage"]
    suppliers = data["suppliers"]
    supplier_quotes = data["supplier_price_quotes"]

    today = datetime.now()
    period = _month_period(today)
    month_start = _month_start(today)

    # Filter this month's records
    month_purchases = [
        p for p in purchase_orders
        if str(p.get("order_date", "")) >= month_start
    ]
    month_sales = [
        s for s in sales_records
        if str(s.get("sale_date", "")) >= month_start
    ]
    month_inventory = [
        r for r in inventory_records
        if str(r.get("occurred_at", "")) >= month_start
    ]

    # Purchase metrics
    total_purchase_amount = sum(
        float(p["unit_price"]) * float(p["quantity"]) for p in month_purchases
    )
    total_inbound_qty = sum(float(p["quantity"]) for p in month_purchases)
    purchase_order_count = len(month_purchases)

    # Sales / outbound metrics
    total_outbound_qty = sum(float(s["quantity"]) for s in month_sales)
    sales_order_count = len(month_sales)

    # Loss metrics
    loss_records = [
        r for r in month_inventory
        if r.get("record_type") == "loss" or ("loss" in str(r.get("reason", "")).lower())
    ]
    total_loss_qty = sum(abs(float(r["quantity_change"])) for r in loss_records)
    loss_count = len(loss_records)

    # Low stock & overstock
    low_stock_items = [
        p for p in products
        if float(p["current_stock"]) < float(p["safety_stock"])
    ]
    sales_by_product = _sum_sales(sales_records)
    overstock_items = [
        p for p in products
        if float(p["current_stock"]) > max(
            float(p["safety_stock"]) * 3,
            sales_by_product.get(int(p["id"]), 0.0) * 3,
        )
    ]

    # Price anomalies
    price_anomalies = [
        p for p in purchase_orders
        if float(p.get("average_price", 0)) > 0
        and float(p["unit_price"]) >= float(p["average_price"]) * 1.15
    ]

    # Expiring storage
    expiring_storage = [
        s for s in storage_records
        if int(s["days_until_expiry"]) <= 15
    ]

    # Top supplier recommendation
    top_supplier = max(suppliers, key=lambda s: float(s["price_stability_score"])) if suppliers else None

    # Replenishment suggestions
    replenishment = detect_replenishment(products, sales_records)

    # Compose report content in Chinese
    content_parts = []

    # --- Executive summary ---
    content_parts.append(f"## {period} 月度经营报告")
    content_parts.append(f"报告生成时间：{today.strftime('%Y-%m-%d %H:%M')}")
    content_parts.append("")

    # --- Purchase section ---
    content_parts.append("### 一、采购概况")
    content_parts.append(f"本月共发生 {purchase_order_count} 笔采购入库，采购总金额 ¥{total_purchase_amount:,.2f}，总入库数量 {total_inbound_qty:,.1f}。")
    if price_anomalies:
        anomaly_names = set()
        for pa in price_anomalies:
            p = next((x for x in products if x["id"] == pa["product_id"]), None)
            if p:
                anomaly_names.add(p["name"])
        content_parts.append(f"⚠️ 价格异常：{', '.join(sorted(anomaly_names))} 采购单价高于历史均价 15% 以上，建议关注。")
    content_parts.append("")

    # --- Sales section ---
    content_parts.append("### 二、销售出库")
    content_parts.append(f"本月共 {sales_order_count} 笔销售出库，总出库数量 {total_outbound_qty:,.1f}。")
    if low_stock_items:
        names = "、".join(p["name"] for p in low_stock_items[:5])
        content_parts.append(f"⚠️ 快缺货酒水（{len(low_stock_items)} 个）：{names}，建议本周安排补货。")
    content_parts.append("")

    # --- Loss section ---
    content_parts.append("### 三、损耗与盘点")
    if loss_records:
        loss_detail = []
        for r in loss_records:
            p = next((x for x in products if x["id"] == r["product_id"]), None)
            p_name = p["name"] if p else f"商品#{r['product_id']}"
            loss_detail.append(f"{p_name} {abs(float(r['quantity_change'])):,.1f}")
        content_parts.append(f"本月共记录 {loss_count} 笔损耗，损耗总量 {total_loss_qty:,.1f}。明细：{'；'.join(loss_detail)}。建议检查仓储环境并优化操作流程。")
    else:
        content_parts.append("本月无损耗记录，仓储管理情况良好。")
    content_parts.append("")

    # --- Inventory alert ---
    content_parts.append("### 四、库存预警")
    if overstock_items:
        names = "、".join(p["name"] for p in overstock_items[:3])
        content_parts.append(f"📦 库存积压（{len(overstock_items)} 个）：{names}，周转偏慢，建议做促销组合活动。")
    content_parts.append(f"快缺货 SKU：{len(low_stock_items)} 个 | 积压 SKU：{len(overstock_items)} 个 | 损耗笔数：{loss_count}")
    content_parts.append("")

    # --- Customer storage ---
    content_parts.append("### 五、客户存酒提醒")
    if expiring_storage:
        names = "、".join(f"{s['customer_name']}（{s['product_name']}，{s['days_until_expiry']} 天后到期）" for s in expiring_storage[:5])
        content_parts.append(f"共 {len(expiring_storage)} 位客户存酒即将到期：{names}，建议优先联系高价值客户安排到店消费。")
    else:
        content_parts.append("本月无临期存酒记录。")
    content_parts.append("")

    # --- Supplier suggestion ---
    content_parts.append("### 六、供应商建议")
    if top_supplier:
        content_parts.append(f"🏆 推荐优先采购：{top_supplier['name']}（价格稳定性 {top_supplier['price_stability_score']}%，平均交付 {top_supplier['average_delivery_days']} 天）。")
    cheapest_quote = None
    for q in supplier_quotes:
        s = next((x for x in suppliers if x["id"] == q["supplier_id"]), None)
        if s and (cheapest_quote is None or q["unit_price"] < cheapest_quote["unit_price"]):
            cheapest_quote = {"supplier_name": s["name"], "product_id": q["product_id"], "price": q["unit_price"]}
    if cheapest_quote:
        p = next((x for x in products if x["id"] == cheapest_quote["product_id"]), None)
        p_name = p["name"] if p else ""
        content_parts.append(f"💰 最低报价：{cheapest_quote['supplier_name']} — {p_name} ¥{cheapest_quote['price']:.2f}。")

    # --- Replenishment suggestions ---
    if replenishment:
        content_parts.append("")
        content_parts.append("### 七、补货建议")
        for r in replenishment[:5]:
            content_parts.append(f"- **{r['product_name']}**：当前库存 {r['current_stock']}，安全库存 {r['safety_stock']}，建议补货 {r['suggested_quantity']}。{r['reason']}")

    # --- AI Action Items ---
    content_parts.append("")
    content_parts.append("### 八、AI 行动建议")
    actions = []
    if low_stock_items:
        actions.append("1. 优先采购快缺货酒水，避免断货影响销售。")
    if overstock_items:
        actions.append("2. 针对积压库存设计组合套餐或限时折扣。")
    if expiring_storage:
        actions.append("3. 触达临期存酒客户，安排会员夜或包厢邀约。")
    if price_anomalies:
        actions.append("4. 复核价格异常采购单，与供应商重新议价。")
    if loss_records:
        actions.append("5. 检查损耗来源，优化仓储和操作流程。")
    if not actions:
        actions.append("本月经营状况良好，暂无紧急行动项。")
    content_parts.extend(actions)

    content = "\n".join(content_parts)

    metrics = {
        "period": period,
        "purchase_amount": round(total_purchase_amount, 2),
        "purchase_order_count": purchase_order_count,
        "inbound_quantity": round(total_inbound_qty, 1),
        "outbound_quantity": round(total_outbound_qty, 1),
        "loss_quantity": round(total_loss_qty, 1),
        "loss_count": loss_count,
        "low_stock_count": len(low_stock_items),
        "overstock_count": len(overstock_items),
        "expiring_storage_count": len(expiring_storage),
        "price_anomaly_count": len(price_anomalies),
        "total_products": len(products),
        "replenishment_suggestions": len(replenishment),
    }

    title = f"{period} 月度经营报告"

    return {
        "title": title,
        "period": period,
        "content": content,
        "metrics": metrics,
    }


def agent_ask(
    data: dict[str, list[dict[str, Any]]],
    question: str,
) -> dict[str, Any]:
    """Answer business questions using rule-based analysis."""
    products = data["products"]
    sales_records = data["sales_records"]
    purchase_orders = data["purchase_orders"]
    inventory_records = data["inventory_records"]
    storage_records = data["customer_storage"]
    suppliers = data["suppliers"]
    supplier_quotes = data["supplier_price_quotes"]

    sales_by_product = _sum_sales(sales_records)
    low_stock = [p for p in products if float(p["current_stock"]) < float(p["safety_stock"])]
    overstock = [
        p for p in products
        if float(p["current_stock"]) > max(
            float(p["safety_stock"]) * 3,
            sales_by_product.get(int(p["id"]), 0.0) * 3,
        )
    ]
    loss_records = [r for r in inventory_records if r.get("record_type") == "loss"]
    price_anomalies = [
        p for p in purchase_orders
        if float(p.get("average_price", 0)) > 0
        and float(p["unit_price"]) >= float(p["average_price"]) * 1.15
    ]
    expiring_storage = [s for s in storage_records if int(s["days_until_expiry"]) <= 15]
    replenishment = detect_replenishment(products, sales_records)
    month_start = _month_start()

    # Determine question category
    q = question.lower()

    if any(kw in q for kw in ["采购成本", "采购金额", "采购价格", "为什么上升", "为什么增加"]):
        month_purchases = [p for p in purchase_orders if str(p.get("order_date", "")) >= month_start]
        total_amount = sum(float(p["unit_price"]) * float(p["quantity"]) for p in month_purchases)
        avg_price = total_amount / sum(float(p["quantity"]) for p in month_purchases) if month_purchases else 0

        parts = [f"本月采购总金额 ¥{total_amount:,.2f}。"]
        if price_anomalies:
            names = set()
            for pa in price_anomalies:
                p = next((x for x in products if x["id"] == pa["product_id"]), None)
                if p:
                    names.add(p["name"])
            parts.append(f"发现 {len(price_anomalies)} 笔价格异常：{'、'.join(sorted(names))} 单价高于历史均价 15% 以上。")
        if low_stock:
            parts.append(f"另有 {len(low_stock)} 个 SKU 存在缺货风险，可能被迫接受较高采购价。")
        if not price_anomalies:
            parts.append("本月价格水平基本正常。")

        return {
            "question": question,
            "answer": "".join(parts),
            "category": "purchase_cost",
        }

    if any(kw in q for kw in ["损耗", "异常", "破损"]):
        if not loss_records:
            return {
                "question": question,
                "answer": "本月暂无损耗记录，仓储管理情况良好。建议继续保持日常盘点习惯。",
                "category": "loss",
            }
        detail = []
        for r in loss_records:
            p = next((x for x in products if x["id"] == r["product_id"]), None)
            p_name = p["name"] if p else f"商品#{r['product_id']}"
            detail.append(f"{p_name} 损耗 {abs(float(r['quantity_change'])):,.1f}（原因：{r.get('reason', '未知')}）")
        return {
            "question": question,
            "answer": f"本月共 {len(loss_records)} 笔损耗记录：{'；'.join(detail)}。建议重点检查对应商品的仓储环境和操作流程。",
            "category": "loss",
        }

    if any(kw in q for kw in ["活动", "促销", "建议做什么"]):
        suggestions = []
        if overstock:
            names = "、".join(p["name"] for p in overstock[:3])
            suggestions.append(f"① 库存清理：{names} 积压较多，建议设计组合套餐或限时折扣，14 天内消化 40%。")
        if expiring_storage:
            suggestions.append(f"② 客户召回：{len(expiring_storage)} 位客户存酒临期，适合安排会员夜或包厢权益触达。")
        premium = next((p for p in products if p.get("category") == "威士忌"), None)
        if premium:
            suggestions.append(f"③ 高毛利搭售：以 {premium['name']} 设计双人套餐，搭配小食和调酒券，提升桌均消费。")
        suggestions.append("④ 新品推广：设计限时试饮和二次到店券，积累新品销售数据。")
        return {
            "question": question,
            "answer": "本周推荐以下活动策略：\n" + "\n".join(suggestions),
            "category": "promotion",
        }

    if any(kw in q for kw in ["供应商", "优先采购", "采购哪家"]):
        sorted_suppliers = sorted(suppliers, key=lambda s: (
            float(s["price_stability_score"]),
            -float(s["average_delivery_days"])
        ), reverse=True)
        lines = []
        for i, s in enumerate(sorted_suppliers):
            badge = "🏆 优先采购" if i == 0 else ("✅ 备选" if i == 1 else "👁 观察")
            lines.append(f"- {badge} **{s['name']}**：稳定性 {s['price_stability_score']}%，交付 {s['average_delivery_days']} 天")
        return {
            "question": question,
            "answer": "供应商综合评分排序：\n" + "\n".join(lines),
            "category": "supplier",
        }

    if any(kw in q for kw in ["库存", "缺货", "积压"]):
        lines = []
        if low_stock:
            for p in low_stock[:5]:
                lines.append(f"- ⚠️ **{p['name']}**：当前 {p['current_stock']}，安全库存 {p['safety_stock']}，建议尽快补货")
        if overstock:
            for p in overstock[:3]:
                lines.append(f"- 📦 **{p['name']}**：当前 {p['current_stock']}，周转偏慢，建议活动消化")
        if not lines:
            return {
                "question": question,
                "answer": "当前库存状况总体健康，没有明显的缺货或积压问题。",
                "category": "inventory",
            }
        return {
            "question": question,
            "answer": "当前库存状态：\n" + "\n".join(lines),
            "category": "inventory",
        }

    # Default: comprehensive overview
    dashboard = build_dashboard(data)
    m = dashboard["metrics"]
    return {
        "question": question,
        "answer": (
            f"当前经营概览：\n"
            f"- 📊 快缺货酒水 {m['low_stock_count']} 个，库存积压 {m['overstock_count']} 个\n"
            f"- ⏰ 临期存酒客户 {m['expiring_storage_count']} 位\n"
            f"- 💰 价格异常 {m['price_anomaly_count']} 笔\n"
            f"- 🤖 AI 建议 {m['agent_suggestion_count']} 条\n"
            f"如需更具体的信息，请补充您的问题（如「本月采购成本为什么上升？」「哪些损耗异常？」）。"
        ),
        "category": "general",
    }


def build_chart_data(data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Aggregate data for frontend charts."""
    products = data["products"]
    sales_records = data["sales_records"]
    purchase_orders = data["purchase_orders"]

    # Monthly purchase trend
    monthly_purchases: dict[str, float] = {}
    for po in purchase_orders:
        month = str(po.get("order_date", ""))[:7]
        if month:
            amount = float(po.get("unit_price", 0)) * float(po.get("quantity", 0))
            monthly_purchases[month] = monthly_purchases.get(month, 0) + amount
    purchase_trend = [
        {"month": m, "amount": round(monthly_purchases[m], 2)}
        for m in sorted(monthly_purchases.keys())
    ]

    # Top products by sales
    sales_by_product: dict[int, float] = {}
    for sr in sales_records:
        pid = int(sr["product_id"])
        sales_by_product[pid] = sales_by_product.get(pid, 0) + float(sr["quantity"])
    top_products = sorted(
        [
            {
                "name": _product_name(products, pid),
                "quantity": round(qty, 1),
            }
            for pid, qty in sales_by_product.items()
        ],
        key=lambda x: x["quantity"],
        reverse=True,
    )[:10]

    # Category distribution
    cat_counts: dict[str, int] = {}
    for p in products:
        cat = str(p.get("category", "未分类"))
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    category_distribution = [
        {"category": c, "count": n} for c, n in sorted(cat_counts.items())
    ]

    # Stock status
    sales_30d: dict[int, float] = {}
    for sr in sales_records:
        pid = int(sr["product_id"])
        sales_30d[pid] = sales_30d.get(pid, 0) + float(sr["quantity"])

    low_count = 0
    over_count = 0
    normal_count = 0
    for p in products:
        stock = float(p["current_stock"])
        safety = float(p["safety_stock"])
        if stock < safety:
            low_count += 1
        elif stock > max(safety * 3, sales_30d.get(int(p["id"]), 0) * 3):
            over_count += 1
        else:
            normal_count += 1
    stock_status = {
        "low_stock": low_count,
        "normal": normal_count,
        "overstock": over_count,
    }

    # Profit analysis
    avg_purchase_price: dict[int, float] = {}
    for po in purchase_orders:
        pid = int(po["product_id"])
        qty = float(po.get("quantity", 0))
        price = float(po.get("unit_price", 0))
        if pid not in avg_purchase_price:
            avg_purchase_price[pid] = {"qty": 0, "cost": 0.0}
        avg_purchase_price[pid]["qty"] += qty
        avg_purchase_price[pid]["cost"] += qty * price
    avg_pp = {
        pid: d["cost"] / d["qty"] if d["qty"] > 0 else 0
        for pid, d in avg_purchase_price.items()
    }

    product_profit: dict[int, dict[str, float]] = {}
    monthly_profit: dict[str, dict[str, float]] = {}
    for sr in sales_records:
        pid = int(sr["product_id"])
        qty = float(sr["quantity"])
        price = float(sr.get("unit_price", 0))
        revenue = qty * price
        cost_unit = avg_pp.get(pid, 0)
        cost = qty * cost_unit
        profit = revenue - cost
        month = str(sr.get("sale_date", ""))[:7]

        if pid not in product_profit:
            product_profit[pid] = {"revenue": 0, "cost": 0, "profit": 0}
        product_profit[pid]["revenue"] += revenue
        product_profit[pid]["cost"] += cost
        product_profit[pid]["profit"] += profit

        if month:
            if month not in monthly_profit:
                monthly_profit[month] = {"revenue": 0, "cost": 0, "profit": 0}
            monthly_profit[month]["revenue"] += revenue
            monthly_profit[month]["cost"] += cost
            monthly_profit[month]["profit"] += profit

    product_margins = [
        {
            "name": _product_name(products, pid),
            "revenue": round(d["revenue"], 2),
            "cost": round(d["cost"], 2),
            "profit": round(d["profit"], 2),
            "margin": round(d["profit"] / d["revenue"] * 100, 1) if d["revenue"] > 0 else 0,
        }
        for pid, d in sorted(product_profit.items(), key=lambda x: x[1]["profit"], reverse=True)
    ]
    profit_trend = [
        {
            "month": m,
            "revenue": round(d["revenue"], 2),
            "cost": round(d["cost"], 2),
            "profit": round(d["profit"], 2),
        }
        for m, d in sorted(monthly_profit.items())
    ]
    total_revenue = sum(d["revenue"] for d in product_profit.values())
    total_cost = sum(d["cost"] for d in product_profit.values())
    total_profit = total_revenue - total_cost

    return {
        "purchase_trend": purchase_trend,
        "top_products": top_products,
        "category_distribution": category_distribution,
        "stock_status": stock_status,
        "profit_analysis": {
            "total_revenue": round(total_revenue, 2),
            "total_cost": round(total_cost, 2),
            "total_profit": round(total_profit, 2),
            "overall_margin": round(total_profit / total_revenue * 100, 1) if total_revenue > 0 else 0,
            "product_margins": product_margins,
            "profit_trend": profit_trend,
        },
    }


def _product_name(products: list[dict[str, Any]], product_id: int) -> str:
    for p in products:
        if int(p["id"]) == product_id:
            return str(p["name"])
    return f"商品#{product_id}"


def _linear_regression(data: list[float]) -> tuple[float, float]:
    n = len(data)
    if n < 2:
        return 0.0, (data[0] if data else 0.0)
    x_vals = list(range(n))
    mean_x = sum(x_vals) / n
    mean_y = sum(data) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_vals, data))
    den = sum((x - mean_x) ** 2 for x in x_vals)
    if den == 0:
        return 0.0, mean_y
    m = num / den
    b = mean_y - m * mean_x
    return m, b


def compute_revenue_forecast(sales_trend: list[dict[str, Any]]) -> dict[str, Any]:
    if not sales_trend:
        return {
            "historical": [], "sma_forecast": [], "lr_forecast": [],
            "summary": {"sma_total": 0, "lr_total": 0, "sma_avg_daily": 0, "lr_avg_daily": 0},
        }

    revenues = [float(d["revenue"]) for d in sales_trend]
    last_date_str = sales_trend[-1]["date"]
    last_date = datetime.strptime(last_date_str, "%Y-%m-%d")

    sma_window = revenues[-7:] if len(revenues) >= 7 else revenues
    sma_value = sum(sma_window) / len(sma_window) if sma_window else 0

    m, b = _linear_regression(revenues)

    sma_forecast = []
    lr_forecast = []
    for k in range(1, 8):
        d = (last_date + timedelta(days=k)).strftime("%Y-%m-%d")
        sma_forecast.append({"date": d, "revenue": round(sma_value, 2)})
        lr_pred = max(0, m * (len(revenues) - 1 + k) + b)
        lr_forecast.append({"date": d, "revenue": round(lr_pred, 2)})

    return {
        "historical": [
            {"date": d["date"], "revenue": round(float(d["revenue"]), 2)}
            for d in sales_trend
        ],
        "sma_forecast": sma_forecast,
        "lr_forecast": lr_forecast,
        "summary": {
            "sma_total": round(sma_value * 7, 2),
            "lr_total": round(sum(f["revenue"] for f in lr_forecast), 2),
            "sma_avg_daily": round(sma_value, 2),
            "lr_avg_daily": round(sum(f["revenue"] for f in lr_forecast) / 7, 2),
        },
    }
