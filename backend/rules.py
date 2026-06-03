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
                "title": f"建议优先补货 {len(replenishment)} 个 SKU",
                "summary": f"{names} 库存风险较高，建议先生成采购单草稿。",
                "action": "生成采购单草稿",
            }
        )
    if expiring_storage:
        agent_suggestions.append(
            {
                "type": "customer_recall",
                "title": f"{len(expiring_storage)} 位客户存酒进入提醒窗口",
                "summary": "建议优先触达到期 15 天内且剩余酒量较多的客户。",
                "action": "生成客户召回名单",
            }
        )
    if top_supplier:
        agent_suggestions.append(
            {
                "type": "supplier",
                "title": f"{top_supplier['name']} 价格最稳定",
                "summary": f"价格稳定性 {top_supplier['price_stability_score']}%，平均交付 {top_supplier['average_delivery_days']} 天。",
                "action": "查看供应商对比",
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
    }


def _sum_sales(sales_records: list[dict[str, Any]]) -> dict[int, float]:
    totals: dict[int, float] = {}
    for record in sales_records:
        product_id = int(record["product_id"])
        totals[product_id] = totals.get(product_id, 0.0) + float(record["quantity"])
    return totals
