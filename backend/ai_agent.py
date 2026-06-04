"""DeepSeek AI Agent for bar operations analysis."""

from __future__ import annotations

import json
import os
import urllib.request
from typing import Any

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"


def _get_api_key() -> str:
    key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not key:
        try:
            config_path = os.path.join(os.path.dirname(__file__), "..", ".env")
            if os.path.exists(config_path):
                with open(config_path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("DEEPSEEK_API_KEY="):
                            key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
        except OSError:
            pass
    return key


def _build_system_prompt(dataset: dict[str, list[dict[str, Any]]]) -> str:
    """Build a compact dataset summary for the AI context."""
    products = dataset.get("products", [])
    suppliers = dataset.get("suppliers", [])
    sales = dataset.get("sales_records", [])
    purchases = dataset.get("purchase_orders", [])
    storage = dataset.get("customer_storage", [])
    inventory = dataset.get("inventory_records", [])

    # Product summary
    product_lines = []
    for p in products:
        pid = p["id"]
        name = p["name"]
        stock = p.get("current_stock", 0)
        safety = p.get("safety_stock", 0)
        cat = p.get("category", "")
        status = "缺货" if float(stock) < float(safety) else f"库存{stock}"
        # Sales for this product
        prod_sales = sum(float(s.get("quantity", 0)) for s in sales if int(s.get("product_id", 0)) == int(pid))
        product_lines.append(
            f"  - {name}（{cat}）: {status}, 安全库存{safety}, 近30天销量{prod_sales:.0f}"
        )

    # Supplier summary
    supplier_lines = []
    for s in suppliers:
        supplier_lines.append(
            f"  - {s['name']}: 稳定分{s.get('price_stability_score', '—')}, 交付{s.get('average_delivery_days', '—')}天"
        )

    # Sales summary
    total_sales_qty = sum(float(s.get("quantity", 0)) for s in sales)
    sales_months = sorted(set(
        str(s.get("sale_date", ""))[:7] for s in sales if s.get("sale_date")
    ))

    # Purchase summary
    total_purchase = sum(
        float(p.get("quantity", 0)) * float(p.get("unit_price", 0))
        for p in purchases
    )

    # Storage summary
    expiring = [s for s in storage if int(s.get("days_until_expiry", 999)) <= 15]

    # Loss/inventory summary
    losses = [r for r in inventory if str(r.get("record_type", "")) == "loss"]

    return f"""你是一位资深酒吧经营分析师，帮助经营者分析酒水采购、库存、销售和客户存酒数据。

## 当前经营数据

### 酒水库存（{len(products)} 款）
{chr(10).join(product_lines)}

### 供应商（{len(suppliers)} 家）
{chr(10).join(supplier_lines)}

### 销售概况
- 总销量: {total_sales_qty:.0f}
- 销售月份: {', '.join(sales_months) if sales_months else '暂无'}

### 采购概况
- 采购总金额: ¥{total_purchase:,.0f}

### 客户存酒
- 总存酒客户: {len(storage)} 位
- 15天内临期: {len(expiring)} 位

### 损耗记录
- 损耗笔数: {len(losses)} 笔

## 回复要求
- 用中文回答，简洁专业
- 如果问题与经营数据无关，礼貌说明你的能力范围
- 回答中引用具体数据（酒水名称、数量、金额）
- 给出可操作的建议，不只说"需要关注"
- 如有数据不足，直接说明"""


def ask_deepseek(
    dataset: dict[str, list[dict[str, Any]]],
    question: str,
    conversation_history: list[str] | None = None,
    follow_up: bool = False,
) -> dict[str, Any]:
    """Send a question to DeepSeek API with bar dataset as context."""
    api_key = _get_api_key()
    if not api_key:
        return None  # caller should fall back to rules

    system_prompt = _build_system_prompt(dataset)

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history for multi-turn context
    if conversation_history:
        for entry in conversation_history[-8:]:
            messages.append({"role": "user" if entry.startswith("用户:") else "assistant", "content": entry.split(": ", 1)[-1] if ": " in entry else entry})

    if follow_up and conversation_history:
        messages.append({"role": "system", "content": "用户正在追问上一轮的问题，请结合之前的对话上下文回答。"})

    messages.append({"role": "user", "content": question})

    payload = json.dumps({
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1024,
    }).encode("utf-8")

    req = urllib.request.Request(
        DEEPSEEK_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"DeepSeek API error {e.code}: {error_body[:300]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"无法连接 DeepSeek API: {e.reason}")

    choice = body.get("choices", [{}])[0]
    answer = choice.get("message", {}).get("content", "")

    if not answer:
        raise RuntimeError("DeepSeek 返回了空回复")

    return {
        "question": question,
        "answer": answer,
        "category": "ai",
        "model": body.get("model", DEEPSEEK_MODEL),
        "usage": body.get("usage", {}),
    }
