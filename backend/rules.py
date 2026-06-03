from __future__ import annotations

import math
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
