from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    safety_stock REAL NOT NULL,
    current_stock REAL NOT NULL,
    unit TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price_stability_score REAL NOT NULL,
    average_delivery_days REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sales_records (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    sale_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL,
    average_price REAL NOT NULL,
    order_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_records (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    record_type TEXT NOT NULL,
    quantity_change REAL NOT NULL,
    quantity_after REAL NOT NULL,
    related_order_id INTEGER,
    reason TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_storage (
    id INTEGER PRIMARY KEY,
    customer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    remaining_quantity REAL NOT NULL,
    days_until_expiry INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS storage_pickup_records (
    id INTEGER PRIMARY KEY,
    storage_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    remaining_after REAL NOT NULL,
    picked_up_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_price_quotes (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    delivery_days REAL NOT NULL,
    quoted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_reports (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    period TEXT NOT NULL,
    content TEXT NOT NULL,
    metrics TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    details TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT 'system',
    user_role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_approvals (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    approved_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_audits (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    system_stock REAL NOT NULL,
    actual_stock REAL NOT NULL,
    discrepancy REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    audited_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL
);
"""


SEED_ROWS = {
    "products": [
        (1, "百龄坛 12 年", "威士忌", 8, 3, "瓶"),
        (2, "荔枝味预调酒", "预调酒", 12, 96, "瓶"),
        (3, "精酿小麦啤", "啤酒", 30, 18, "瓶"),
        (4, "金汤力基酒", "调酒基酒", 6, 5, "瓶"),
        (5, "麦卡伦 12 年", "威士忌", 5, 7, "瓶"),
        (6, "科罗娜", "啤酒", 24, 35, "瓶"),
        (7, "百威", "啤酒", 36, 52, "瓶"),
        (8, "绝对伏特加", "调酒基酒", 4, 2, "瓶"),
        (9, "龙舌兰", "调酒基酒", 5, 8, "瓶"),
        (10, "红酒套装", "葡萄酒", 6, 4, "套"),
        (11, "香槟", "葡萄酒", 4, 3, "瓶"),
        (12, "莫吉托预调", "预调酒", 8, 22, "瓶"),
        (13, "野格", "利口酒", 6, 10, "瓶"),
        (14, "君度", "调酒基酒", 4, 5, "瓶"),
        (15, "白州 12 年", "威士忌", 3, 1, "瓶"),
    ],
    "suppliers": [
        (1, "港岛酒业", 94, 2.1),
        (2, "夜色供应链", 86, 3.4),
        (3, "城市精酿", 79, 4.2),
        (4, "进口酒水直销", 91, 5.0),
        (5, "本地酒仓", 88, 1.5),
    ],
    "sales_records": [
        (1, 1, 35, "2026-06-01", 280),
        (2, 2, 8, "2026-06-01", 35),
        (3, 3, 44, "2026-06-01", 22),
        (4, 4, 16, "2026-06-01", 45),
        (5, 5, 5, "2026-06-01", 420),
        (6, 6, 28, "2026-06-01", 28),
        (7, 7, 35, "2026-06-01", 18),
        (8, 8, 4, "2026-06-01", 55),
        (9, 9, 6, "2026-06-01", 48),
        (10, 10, 2, "2026-06-01", 320),
        (11, 11, 2, "2026-06-01", 480),
        (12, 12, 15, "2026-06-01", 32),
        (13, 13, 8, "2026-06-01", 38),
        (14, 14, 3, "2026-06-01", 52),
        (15, 1, 8, "2026-06-02", 285),
        (16, 3, 32, "2026-06-02", 23),
        (17, 5, 3, "2026-06-02", 430),
        (18, 6, 22, "2026-06-02", 28),
        (19, 7, 30, "2026-06-02", 18),
        (20, 8, 3, "2026-06-02", 56),
        (21, 2, 10, "2026-06-03", 36),
        (22, 4, 12, "2026-06-03", 46),
        (23, 9, 4, "2026-06-03", 48),
        (24, 12, 12, "2026-06-03", 33),
        (25, 13, 6, "2026-06-03", 39),
        (26, 1, 10, "2026-06-04", 290),
        (27, 3, 25, "2026-06-04", 24),
        (28, 5, 2, "2026-06-04", 425),
        (29, 6, 18, "2026-06-04", 29),
        (30, 7, 28, "2026-06-04", 19),
    ],
    "purchase_orders": [
        (1, 1, 1, 0, 220, 180, "2026-06-01"),
        (2, 2, 2, 0, 18, 11, "2026-06-01"),
        (3, 3, 3, 0, 13, 24, "2026-06-01"),
        (4, 5, 1, 0, 320, 280, "2026-06-01"),
        (5, 6, 5, 0, 130, 120, "2026-06-01"),
        (6, 7, 3, 0, 14, 12, "2026-06-01"),
        (7, 8, 4, 0, 85, 80, "2026-06-02"),
        (8, 9, 1, 0, 180, 170, "2026-06-02"),
        (9, 10, 4, 0, 150, 140, "2026-06-02"),
        (10, 11, 1, 0, 450, 420, "2026-06-02"),
        (11, 1, 1, 0, 275, 180, "2026-06-03"),
        (12, 2, 2, 0, 148, 120, "2026-06-03"),
    ],
    "customer_storage": [
        (1, "陈先生", "皇家礼炮", 420, 7, "13800138001"),
        (2, "林女士", "香槟套餐", 1, 13, "13800138002"),
        (3, "周先生", "麦卡伦 12 年", 260, 28, "13800138003"),
        (4, "王总", "百龄坛 12 年", 500, 5, "13900139001"),
        (5, "李小姐", "红酒套装", 2, 20, "13900139002"),
        (6, "张先生", "绝对伏特加", 350, 10, "13900139003"),
    ],
}


def connect(db_path: str | Path) -> sqlite3.Connection:
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(db_path: str | Path) -> None:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as connection:
        with connection:
            connection.executescript(SCHEMA)
            _ensure_purchase_order_quantity(connection)
            _ensure_column(connection, "products", "is_active", "INTEGER NOT NULL DEFAULT 1")
            _ensure_column(connection, "suppliers", "is_active", "INTEGER NOT NULL DEFAULT 1")
            _ensure_column(connection, "customer_storage", "is_active", "INTEGER NOT NULL DEFAULT 1")
            _ensure_column(connection, "customer_storage", "phone", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(connection, "sales_records", "unit_price", "REAL NOT NULL DEFAULT 0")
            _ensure_column(connection, "operation_logs", "user_name", "TEXT NOT NULL DEFAULT 'system'")
            _ensure_column(connection, "operation_logs", "user_role", "TEXT NOT NULL DEFAULT 'admin'")
            _ensure_budgets_index(connection)
            if _table_is_empty(connection, "products"):
                _seed_database(connection)


def load_dataset(db_path: str | Path) -> dict[str, list[dict[str, Any]]]:
    with closing(connect(db_path)) as connection:
        return {
            "products": _fetch_all(connection, "SELECT * FROM products WHERE is_active = 1 ORDER BY id"),
            "suppliers": _fetch_all(connection, "SELECT * FROM suppliers WHERE is_active = 1 ORDER BY id"),
            "sales_records": _fetch_all(connection, "SELECT * FROM sales_records ORDER BY id"),
            "purchase_orders": _fetch_all(connection, "SELECT * FROM purchase_orders ORDER BY id"),
            "inventory_records": _fetch_all(connection, "SELECT * FROM inventory_records ORDER BY id"),
            "customer_storage": _fetch_all(connection, "SELECT * FROM customer_storage WHERE is_active = 1 ORDER BY id"),
            "storage_pickup_records": _fetch_all(connection, "SELECT * FROM storage_pickup_records ORDER BY id"),
            "supplier_price_quotes": _fetch_all(connection, "SELECT * FROM supplier_price_quotes ORDER BY id"),
            "purchase_approvals": _fetch_all(connection, "SELECT * FROM purchase_approvals ORDER BY id"),
            "inventory_audits": _fetch_all(connection, "SELECT * FROM inventory_audits ORDER BY id"),
        }


def create_product(db_path: str | Path, payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload["name"]).strip()
    category = str(payload.get("category", "未分类")).strip() or "未分类"
    safety_stock = float(payload.get("safety_stock", 0))
    current_stock = float(payload.get("current_stock", 0))
    unit = str(payload.get("unit", "瓶")).strip() or "瓶"

    if not name:
        raise ValueError("name is required")
    if safety_stock < 0:
        raise ValueError("safety_stock must not be negative")
    if current_stock < 0:
        raise ValueError("current_stock must not be negative")

    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                """
                INSERT INTO products (name, category, safety_stock, current_stock, unit)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, category, safety_stock, current_stock, unit),
            )
            product = connection.execute(
                "SELECT * FROM products WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()

    return dict(product)


def create_supplier(db_path: str | Path, payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload["name"]).strip()
    price_stability_score = float(payload.get("price_stability_score", 80))
    average_delivery_days = float(payload.get("average_delivery_days", 3))

    if not name:
        raise ValueError("name is required")
    if not 0 <= price_stability_score <= 100:
        raise ValueError("price_stability_score must be between 0 and 100")
    if average_delivery_days < 0:
        raise ValueError("average_delivery_days must not be negative")

    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                """
                INSERT INTO suppliers (name, price_stability_score, average_delivery_days)
                VALUES (?, ?, ?)
                """,
                (name, price_stability_score, average_delivery_days),
            )
            supplier = connection.execute(
                "SELECT * FROM suppliers WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()

    return dict(supplier)


def create_supplier_price_quote(db_path: str | Path, payload: dict[str, Any]) -> dict[str, Any]:
    product_id = int(payload["product_id"])
    supplier_id = int(payload["supplier_id"])
    unit_price = float(payload["unit_price"])
    delivery_days = float(payload["delivery_days"])
    quoted_at = str(payload["quoted_at"]).strip()

    if unit_price <= 0:
        raise ValueError("unit_price must be greater than 0")
    if delivery_days < 0:
        raise ValueError("delivery_days must not be negative")
    if not quoted_at:
        raise ValueError("quoted_at is required")

    with closing(connect(db_path)) as connection:
        with connection:
            product = connection.execute(
                "SELECT * FROM products WHERE id = ? AND is_active = 1",
                (product_id,),
            ).fetchone()
            supplier = connection.execute(
                "SELECT * FROM suppliers WHERE id = ? AND is_active = 1",
                (supplier_id,),
            ).fetchone()
            if product is None:
                raise ValueError("product_id does not exist")
            if supplier is None:
                raise ValueError("supplier_id does not exist")

            cursor = connection.execute(
                """
                INSERT INTO supplier_price_quotes (product_id, supplier_id, unit_price, delivery_days, quoted_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (product_id, supplier_id, unit_price, delivery_days, quoted_at),
            )
            quote = connection.execute(
                "SELECT * FROM supplier_price_quotes WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()

    return dict(quote)


def compare_supplier_price_quotes(db_path: str | Path, product_id: int) -> dict[str, Any]:
    with closing(connect(db_path)) as connection:
        rows = _fetch_all(
            connection,
            """
            SELECT
                supplier_price_quotes.*,
                suppliers.name AS supplier_name,
                suppliers.price_stability_score AS price_stability_score
            FROM supplier_price_quotes
            JOIN suppliers ON suppliers.id = supplier_price_quotes.supplier_id
            WHERE supplier_price_quotes.product_id = ? AND suppliers.is_active = 1
            ORDER BY supplier_price_quotes.unit_price ASC, supplier_price_quotes.delivery_days ASC, supplier_price_quotes.id ASC
            """,
            (product_id,),
        )

    if not rows:
        return {"items": [], "recommendation": None}

    lowest_price = min(float(item["unit_price"]) for item in rows)
    fastest_delivery = min(float(item["delivery_days"]) for item in rows)
    scored_rows = []
    for item in rows:
        is_lowest_price = float(item["unit_price"]) == lowest_price
        is_fastest_delivery = float(item["delivery_days"]) == fastest_delivery
        score = (
            (100 if is_lowest_price else 0)
            + (30 if is_fastest_delivery else 0)
            + float(item["price_stability_score"]) * 0.2
        )
        scored_rows.append(
            {
                **item,
                "is_lowest_price": is_lowest_price,
                "is_fastest_delivery": is_fastest_delivery,
                "comparison_score": round(score, 2),
            }
        )

    recommendation = max(scored_rows, key=lambda item: (item["comparison_score"], -float(item["unit_price"])))
    return {"items": scored_rows, "recommendation": recommendation}


def create_purchase_order(db_path: str | Path, payload: dict[str, Any], check_budget: bool = True) -> dict[str, dict[str, Any]]:
    product_id = int(payload["product_id"])
    supplier_id = int(payload["supplier_id"])
    quantity = float(payload["quantity"])
    unit_price = float(payload["unit_price"])
    order_date = str(payload["order_date"])

    if quantity <= 0:
        raise ValueError("quantity must be greater than 0")
    if unit_price <= 0:
        raise ValueError("unit_price must be greater than 0")

    with closing(connect(db_path)) as connection:
        with connection:
            product = connection.execute("SELECT * FROM products WHERE id = ? AND is_active = 1", (product_id,)).fetchone()
            supplier = connection.execute("SELECT * FROM suppliers WHERE id = ? AND is_active = 1", (supplier_id,)).fetchone()
            if product is None:
                raise ValueError("product_id does not exist")
            if supplier is None:
                raise ValueError("supplier_id does not exist")

            average_price = _average_purchase_price(connection, product_id) or unit_price
            cursor = connection.execute(
                """
                INSERT INTO purchase_orders (product_id, supplier_id, quantity, unit_price, average_price, order_date)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (product_id, supplier_id, quantity, unit_price, average_price, order_date),
            )
            order_id = int(cursor.lastrowid)
            quantity_after = float(product["current_stock"]) + quantity
            connection.execute(
                "UPDATE products SET current_stock = ? WHERE id = ?",
                (quantity_after, product_id),
            )
            record_cursor = connection.execute(
                """
                INSERT INTO inventory_records
                    (product_id, record_type, quantity_change, quantity_after, related_order_id, reason, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (product_id, "inbound", quantity, quantity_after, order_id, "purchase_inbound", order_date),
            )

            purchase_order = connection.execute(
                "SELECT * FROM purchase_orders WHERE id = ?",
                (order_id,),
            ).fetchone()
            inventory_record = connection.execute(
                "SELECT * FROM inventory_records WHERE id = ?",
                (int(record_cursor.lastrowid),),
            ).fetchone()

    result: dict[str, Any] = {
        "purchase_order": dict(purchase_order),
        "inventory_record": dict(inventory_record),
    }

    if check_budget:
        try:
            order_year, order_month = int(order_date[:4]), int(order_date[5:7])
            budget = get_monthly_budget(db_path, order_year, order_month)
            if budget is not None:
                spent_before = get_monthly_spent(db_path, order_year, order_month)
                order_total = round(quantity * unit_price, 2)
                new_total = spent_before + order_total
                if new_total > budget["amount"]:
                    result["budget_warning"] = {
                        "budget_amount": budget["amount"],
                        "spent_before": round(spent_before, 2),
                        "order_total": order_total,
                        "overspend": round(new_total - budget["amount"], 2),
                        "percent_used": round((new_total / budget["amount"]) * 100, 1),
                    }
        except (ValueError, IndexError):
            pass

    return result


def create_sales_record(db_path: str | Path, payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    product_id = int(payload["product_id"])
    quantity = float(payload["quantity"])
    sale_date = str(payload["sale_date"])
    unit_price = float(payload.get("unit_price", 0))

    if quantity <= 0:
        raise ValueError("quantity must be greater than 0")
    if unit_price < 0:
        raise ValueError("unit_price must not be negative")

    with closing(connect(db_path)) as connection:
        with connection:
            product = connection.execute(
                "SELECT * FROM products WHERE id = ? AND is_active = 1",
                (product_id,),
            ).fetchone()
            if product is None:
                raise ValueError("product_id does not exist")

            current_stock = float(product["current_stock"])
            if quantity > current_stock:
                raise ValueError("insufficient stock")

            cursor = connection.execute(
                "INSERT INTO sales_records (product_id, quantity, sale_date, unit_price) VALUES (?, ?, ?, ?)",
                (product_id, quantity, sale_date, unit_price),
            )
            sales_id = int(cursor.lastrowid)
            quantity_after = current_stock - quantity
            connection.execute(
                "UPDATE products SET current_stock = ? WHERE id = ?",
                (quantity_after, product_id),
            )
            record_cursor = connection.execute(
                """
                INSERT INTO inventory_records
                    (product_id, record_type, quantity_change, quantity_after, related_order_id, reason, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (product_id, "outbound", -quantity, quantity_after, sales_id, "sales_outbound", sale_date),
            )
            sales_record = connection.execute(
                "SELECT * FROM sales_records WHERE id = ?",
                (sales_id,),
            ).fetchone()
            inventory_record = connection.execute(
                "SELECT * FROM inventory_records WHERE id = ?",
                (int(record_cursor.lastrowid),),
            ).fetchone()

    return {
        "sales_record": dict(sales_record),
        "inventory_record": dict(inventory_record),
    }


def create_inventory_adjustment(db_path: str | Path, payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    product_id = int(payload["product_id"])
    adjustment_type = str(payload["adjustment_type"]).strip()
    reason = str(payload["reason"]).strip()
    occurred_at = str(payload["occurred_at"]).strip()

    if adjustment_type not in {"count", "loss"}:
        raise ValueError("adjustment_type must be count or loss")
    if not reason:
        raise ValueError("reason is required")
    if not occurred_at:
        raise ValueError("occurred_at is required")

    with closing(connect(db_path)) as connection:
        with connection:
            product = connection.execute(
                "SELECT * FROM products WHERE id = ? AND is_active = 1",
                (product_id,),
            ).fetchone()
            if product is None:
                raise ValueError("product_id does not exist")

            current_stock = float(product["current_stock"])
            if adjustment_type == "count":
                actual_quantity = float(payload["actual_quantity"])
                if actual_quantity < 0:
                    raise ValueError("actual_quantity must not be negative")
                quantity_after = actual_quantity
                quantity_change = quantity_after - current_stock
                record_type = "adjustment"
                record_reason = f"inventory_count: {reason}"
            else:
                quantity = float(payload["quantity"])
                if quantity <= 0:
                    raise ValueError("quantity must be greater than 0")
                if quantity > current_stock:
                    raise ValueError("loss quantity exceeds current stock")
                quantity_after = current_stock - quantity
                quantity_change = -quantity
                record_type = "loss"
                record_reason = f"inventory_loss: {reason}"

            connection.execute(
                "UPDATE products SET current_stock = ? WHERE id = ?",
                (quantity_after, product_id),
            )
            record_cursor = connection.execute(
                """
                INSERT INTO inventory_records
                    (product_id, record_type, quantity_change, quantity_after, related_order_id, reason, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (product_id, record_type, quantity_change, quantity_after, None, record_reason, occurred_at),
            )
            updated_product = connection.execute(
                "SELECT * FROM products WHERE id = ?",
                (product_id,),
            ).fetchone()
            inventory_record = connection.execute(
                "SELECT * FROM inventory_records WHERE id = ?",
                (int(record_cursor.lastrowid),),
            ).fetchone()

    return {
        "product": dict(updated_product),
        "inventory_record": dict(inventory_record),
    }


def create_customer_storage(db_path: str | Path, payload: dict[str, Any]) -> dict[str, Any]:
    values = _customer_storage_values(payload)
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                """
                INSERT INTO customer_storage (customer_name, product_name, remaining_quantity, days_until_expiry, phone)
                VALUES (?, ?, ?, ?, ?)
                """,
                values,
            )
            row = connection.execute(
                "SELECT * FROM customer_storage WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()
    return dict(row)


def update_customer_storage(db_path: str | Path, storage_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    values = _customer_storage_values(payload)
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                """
                UPDATE customer_storage
                SET customer_name = ?, product_name = ?, remaining_quantity = ?, days_until_expiry = ?, phone = ?
                WHERE id = ? AND is_active = 1
                """,
                (*values, storage_id),
            )
            if cursor.rowcount == 0:
                raise ValueError("customer_storage id does not exist")
            row = connection.execute(
                "SELECT * FROM customer_storage WHERE id = ?",
                (storage_id,),
            ).fetchone()
    return dict(row)


def pickup_customer_storage(db_path: str | Path, storage_id: int, payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    quantity = float(payload["quantity"])
    picked_up_at = str(payload["picked_up_at"])

    if quantity <= 0:
        raise ValueError("quantity must be greater than 0")
    if not picked_up_at.strip():
        raise ValueError("picked_up_at is required")

    with closing(connect(db_path)) as connection:
        with connection:
            storage = connection.execute(
                "SELECT * FROM customer_storage WHERE id = ? AND is_active = 1",
                (storage_id,),
            ).fetchone()
            if storage is None:
                raise ValueError("customer_storage id does not exist")

            remaining_quantity = float(storage["remaining_quantity"])
            if quantity > remaining_quantity:
                raise ValueError("pickup quantity exceeds remaining quantity")

            remaining_after = remaining_quantity - quantity
            is_active = 1 if remaining_after > 0 else 0
            connection.execute(
                "UPDATE customer_storage SET remaining_quantity = ?, is_active = ? WHERE id = ?",
                (remaining_after, is_active, storage_id),
            )
            cursor = connection.execute(
                """
                INSERT INTO storage_pickup_records (storage_id, quantity, remaining_after, picked_up_at)
                VALUES (?, ?, ?, ?)
                """,
                (storage_id, quantity, remaining_after, picked_up_at),
            )
            updated_storage = connection.execute(
                "SELECT * FROM customer_storage WHERE id = ?",
                (storage_id,),
            ).fetchone()
            pickup_record = connection.execute(
                "SELECT * FROM storage_pickup_records WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()

    return {
        "customer_storage": dict(updated_storage),
        "pickup_record": dict(pickup_record),
    }


def deactivate_product(db_path: str | Path, product_id: int) -> bool:
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                "UPDATE products SET is_active = 0 WHERE id = ? AND is_active = 1",
                (product_id,),
            )
    return cursor.rowcount > 0


def deactivate_supplier(db_path: str | Path, supplier_id: int) -> bool:
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                "UPDATE suppliers SET is_active = 0 WHERE id = ? AND is_active = 1",
                (supplier_id,),
            )
    return cursor.rowcount > 0


def deactivate_customer_storage(db_path: str | Path, storage_id: int) -> bool:
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                "UPDATE customer_storage SET is_active = 0 WHERE id = ? AND is_active = 1",
                (storage_id,),
            )
    return cursor.rowcount > 0


def _customer_storage_values(payload: dict[str, Any]) -> tuple[str, str, float, int, str]:
    customer_name = str(payload["customer_name"]).strip()
    product_name = str(payload["product_name"]).strip()
    remaining_quantity = float(payload["remaining_quantity"])
    days_until_expiry = int(payload["days_until_expiry"])
    phone = str(payload.get("phone", "")).strip()

    if not customer_name:
        raise ValueError("customer_name is required")
    if not product_name:
        raise ValueError("product_name is required")
    if remaining_quantity < 0:
        raise ValueError("remaining_quantity must not be negative")
    if days_until_expiry < 0:
        raise ValueError("days_until_expiry must not be negative")

    return customer_name, product_name, remaining_quantity, days_until_expiry, phone


def create_agent_report(db_path: str | Path, payload: dict[str, Any]) -> dict[str, Any]:
    title = str(payload["title"]).strip()
    period = str(payload["period"]).strip()
    content = str(payload["content"]).strip()
    metrics = json.dumps(payload["metrics"], ensure_ascii=False)
    created_at = str(payload["created_at"]).strip()

    if not title:
        raise ValueError("title is required")
    if not period:
        raise ValueError("period is required")
    if not content:
        raise ValueError("content is required")

    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                """
                INSERT INTO agent_reports (title, period, content, metrics, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (title, period, content, metrics, created_at),
            )
            report = connection.execute(
                "SELECT * FROM agent_reports WHERE id = ?",
                (int(cursor.lastrowid),),
            ).fetchone()

    row = dict(report)
    row["metrics"] = json.loads(row["metrics"])
    return row


def get_agent_reports(db_path: str | Path) -> list[dict[str, Any]]:
    with closing(connect(db_path)) as connection:
        rows = connection.execute(
            "SELECT * FROM agent_reports ORDER BY id DESC"
        ).fetchall()

    results = []
    for row in rows:
        item = dict(row)
        item["metrics"] = json.loads(item["metrics"])
        results.append(item)
    return results


def get_agent_report(db_path: str | Path, report_id: int) -> dict[str, Any] | None:
    with closing(connect(db_path)) as connection:
        row = connection.execute(
            "SELECT * FROM agent_reports WHERE id = ?", (report_id,)
        ).fetchone()

    if row is None:
        return None
    item = dict(row)
    item["metrics"] = json.loads(item["metrics"])
    return item


def delete_agent_report(db_path: str | Path, report_id: int) -> bool:
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                "DELETE FROM agent_reports WHERE id = ?", (report_id,)
            )
    return cursor.rowcount > 0


def backup_database(db_path: str | Path) -> dict[str, Any]:
    """Create a timestamped copy of the database file."""
    src = Path(db_path)
    backup_dir = src.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = backup_dir / f"bar_agent_backup_{timestamp}.db"
    import shutil
    shutil.copy2(src, dst)
    size_kb = round(dst.stat().st_size / 1024, 1)
    return {
        "path": str(dst),
        "filename": dst.name,
        "size_kb": size_kb,
        "created_at": timestamp,
    }


def get_backup_info(db_path: str | Path) -> dict[str, Any]:
    """Get info about existing backups."""
    backup_dir = Path(db_path).parent / "backups"
    if not backup_dir.exists():
        return {"backups": [], "total_count": 0}
    backups = sorted(backup_dir.glob("bar_agent_backup_*.db"), reverse=True)
    info = []
    for b in backups:
        size_kb = round(b.stat().st_size / 1024, 1)
        name = b.name
        ts = name.replace("bar_agent_backup_", "").replace(".db", "")
        info.append({"filename": name, "size_kb": size_kb, "created_at": ts})
    return {"backups": info, "total_count": len(info)}


def batch_deactivate_customer_storage(db_path: str | Path, ids: list[int]) -> int:
    with closing(connect(db_path)) as connection:
        with connection:
            placeholders = ",".join("?" for _ in ids)
            cursor = connection.execute(
                f"UPDATE customer_storage SET is_active = 0 WHERE id IN ({placeholders}) AND is_active = 1",
                ids,
            )
    return cursor.rowcount


def import_csv_data(db_path: str | Path, import_type: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Import rows into the specified table from parsed CSV data."""
    type_map = {
        "products": {
            "sql": "INSERT INTO products (name, category, safety_stock, current_stock, unit) VALUES (?, ?, ?, ?, ?)",
            "fields": ["name", "category", "safety_stock", "current_stock", "unit"],
            "defaults": {"category": "未分类", "safety_stock": 0, "current_stock": 0, "unit": "瓶"},
        },
        "suppliers": {
            "sql": "INSERT INTO suppliers (name, price_stability_score, average_delivery_days) VALUES (?, ?, ?)",
            "fields": ["name", "price_stability_score", "average_delivery_days"],
            "defaults": {"price_stability_score": 80, "average_delivery_days": 3},
        },
        "customer-storage": {
            "sql": "INSERT INTO customer_storage (customer_name, phone, product_name, remaining_quantity, days_until_expiry) VALUES (?, ?, ?, ?, ?)",
            "fields": ["customer_name", "phone", "product_name", "remaining_quantity", "days_until_expiry"],
            "defaults": {"phone": "", "remaining_quantity": 1, "days_until_expiry": 30},
        },
    }
    cfg = type_map.get(import_type)
    if not cfg:
        raise ValueError(f"Unsupported import type: {import_type}")

    inserted = 0
    errors = []
    with closing(connect(db_path)) as connection:
        with connection:
            for i, row in enumerate(rows):
                try:
                    values = []
                    for f in cfg["fields"]:
                        val = row.get(f, cfg["defaults"].get(f))
                        if val is None or (isinstance(val, str) and not val.strip()):
                            val = cfg["defaults"].get(f, "")
                        if isinstance(val, str):
                            val = val.strip()
                        values.append(val)
                    connection.execute(cfg["sql"], values)
                    inserted += 1
                except Exception as exc:
                    errors.append({"row": i + 1, "error": str(exc)})
    return {"imported": inserted, "errors": errors, "total": len(rows)}


def delete_purchase_order(db_path: str | Path, order_id: int) -> bool:
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                "DELETE FROM purchase_orders WHERE id = ?", (order_id,)
            )
    return cursor.rowcount > 0


def _table_is_empty(connection: sqlite3.Connection, table: str) -> bool:
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()
    return row["count"] == 0


def _ensure_purchase_order_quantity(connection: sqlite3.Connection) -> None:
    _ensure_column(connection, "purchase_orders", "quantity", "REAL NOT NULL DEFAULT 0")


def _ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _ensure_budgets_index(connection: sqlite3.Connection) -> None:
    try:
        connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(year, month)")
    except sqlite3.OperationalError:
        pass


def _seed_database(connection: sqlite3.Connection) -> None:
    connection.executemany(
        "INSERT INTO products (id, name, category, safety_stock, current_stock, unit) VALUES (?, ?, ?, ?, ?, ?)",
        SEED_ROWS["products"],
    )
    connection.executemany(
        "INSERT INTO suppliers (id, name, price_stability_score, average_delivery_days) VALUES (?, ?, ?, ?)",
        SEED_ROWS["suppliers"],
    )
    connection.executemany(
        "INSERT INTO sales_records (id, product_id, quantity, sale_date, unit_price) VALUES (?, ?, ?, ?, ?)",
        SEED_ROWS["sales_records"],
    )
    connection.executemany(
        "INSERT INTO purchase_orders (id, product_id, supplier_id, quantity, unit_price, average_price, order_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        SEED_ROWS["purchase_orders"],
    )
    connection.executemany(
        "INSERT INTO customer_storage (id, customer_name, product_name, remaining_quantity, days_until_expiry, phone) VALUES (?, ?, ?, ?, ?, ?)",
        SEED_ROWS["customer_storage"],
    )


def _fetch_all(connection: sqlite3.Connection, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    return [dict(row) for row in connection.execute(query, params).fetchall()]


def _average_purchase_price(connection: sqlite3.Connection, product_id: int) -> float | None:
    row = connection.execute(
        "SELECT AVG(unit_price) AS average_price FROM purchase_orders WHERE product_id = ?",
        (product_id,),
    ).fetchone()
    if row is None or row["average_price"] is None:
        return None
    return float(row["average_price"])


def insert_operation_log(
    db_path: str | Path,
    action: str,
    target_type: str,
    target_id: int | None,
    details: str,
    user_name: str = "system",
    user_role: str = "admin",
) -> None:
    with closing(connect(db_path)) as connection:
        with connection:
            connection.execute(
                """
                INSERT INTO operation_logs
                    (action, target_type, target_id, details, user_name, user_role, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (action, target_type, target_id, details, user_name, user_role, datetime.now().isoformat()),
            )


def get_operation_logs(db_path: str | Path, limit: int = 50) -> list[dict[str, Any]]:
    with closing(connect(db_path)) as connection:
        return _fetch_all(connection, "SELECT * FROM operation_logs ORDER BY id DESC LIMIT ?", (limit,))


def batch_create_purchase_orders(db_path: str | Path, items: list[dict[str, Any]]) -> dict[str, Any]:
    """Create multiple purchase orders from replenishment suggestions."""
    results = []
    errors = []
    with closing(connect(db_path)) as connection:
        for i, item in enumerate(items):
            try:
                product_id = int(item["product_id"])
                supplier_id = int(item.get("supplier_id", 1))
                quantity = float(item.get("quantity", item.get("suggested_quantity", 1)))
                unit_price = float(item.get("unit_price", 0))
                order_date = str(item.get("order_date", datetime.now().strftime("%Y-%m-%d")))

                if quantity <= 0 or unit_price <= 0:
                    errors.append({"row": i + 1, "error": "quantity and unit_price required"})
                    continue

                with connection:
                    avg_price = _average_purchase_price(connection, product_id) or unit_price
                    cursor = connection.execute(
                        "INSERT INTO purchase_orders (product_id, supplier_id, quantity, unit_price, average_price, order_date) VALUES (?, ?, ?, ?, ?, ?)",
                        (product_id, supplier_id, quantity, unit_price, avg_price, order_date),
                    )
                    order_id = int(cursor.lastrowid)
                    product = connection.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
                    quantity_after = float(product["current_stock"]) + quantity
                    connection.execute("UPDATE products SET current_stock = ? WHERE id = ?", (quantity_after, product_id))
                    connection.execute(
                        "INSERT INTO inventory_records (product_id, record_type, quantity_change, quantity_after, related_order_id, reason, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (product_id, "inbound", quantity, quantity_after, order_id, "batch_replenishment", order_date),
                    )
                    results.append({"product_id": product_id, "order_id": order_id, "quantity": quantity})
            except Exception as exc:
                errors.append({"row": i + 1, "error": str(exc)})
    return {"created": len(results), "errors": errors, "results": results}


def get_recent_sales_trend(db_path: str | Path, days: int = 7) -> list[dict[str, Any]]:
    """Get daily sales totals for the last N days."""
    start_date = (datetime.now() - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    with closing(connect(db_path)) as connection:
        rows = _fetch_all(
            connection,
            "SELECT sale_date, SUM(quantity) as qty, SUM(quantity * unit_price) as revenue FROM sales_records WHERE sale_date >= ? GROUP BY sale_date ORDER BY sale_date",
            (start_date,),
        )
    result = []
    for i in range(days):
        d = (datetime.now() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        found = next((r for r in rows if r["sale_date"] == d), None)
        result.append({
            "date": d,
            "quantity": round(float(found["qty"]), 1) if found else 0,
            "revenue": round(float(found["revenue"]), 2) if found else 0,
        })
    return result


def get_monthly_budget(db_path: str | Path, year: int, month: int) -> dict[str, Any] | None:
    with closing(connect(db_path)) as connection:
        row = connection.execute(
            "SELECT * FROM budgets WHERE year = ? AND month = ?",
            (year, month),
        ).fetchone()
    return dict(row) if row else None


def set_monthly_budget(db_path: str | Path, year: int, month: int, amount: float) -> dict[str, Any]:
    now = datetime.now().isoformat()
    with closing(connect(db_path)) as connection:
        with connection:
            connection.execute(
                "INSERT OR REPLACE INTO budgets (id, year, month, amount, created_at) VALUES ("
                "(SELECT id FROM budgets WHERE year = ? AND month = ?), ?, ?, ?, ?)",
                (year, month, year, month, amount, now),
            )
    return {"year": year, "month": month, "amount": amount}


def get_monthly_spent(db_path: str | Path, year: int, month: int) -> float:
    month_start = f"{year:04d}-{month:02d}-01"
    if month == 12:
        month_end = f"{year + 1:04d}-01-01"
    else:
        month_end = f"{year:04d}-{month + 1:02d}-01"
    with closing(connect(db_path)) as connection:
        row = connection.execute(
            "SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM purchase_orders "
            "WHERE order_date >= ? AND order_date < ?",
            (month_start, month_end),
        ).fetchone()
    return float(row["total"])


def create_purchase_approval(db_path: str | Path, payload: dict[str, Any]) -> dict[str, Any]:
    product_id = int(payload["product_id"])
    supplier_id = int(payload["supplier_id"])
    quantity = float(payload["quantity"])
    unit_price = float(payload["unit_price"])
    total_amount = round(quantity * unit_price, 2)
    reason = str(payload.get("reason", ""))
    created_at = str(payload.get("created_at", datetime.now().strftime("%Y-%m-%d")))

    if total_amount <= 0:
        raise ValueError("total_amount must be greater than 0")

    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute(
                "INSERT INTO purchase_approvals (product_id, supplier_id, quantity, unit_price, total_amount, status, reason, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
                (product_id, supplier_id, quantity, unit_price, total_amount, reason, created_at),
            )
            row = connection.execute("SELECT * FROM purchase_approvals WHERE id = ?", (int(cursor.lastrowid),)).fetchone()
    return dict(row)


def get_pending_approvals(db_path: str | Path) -> list[dict[str, Any]]:
    with closing(connect(db_path)) as connection:
        return _fetch_all(connection, "SELECT * FROM purchase_approvals WHERE status = 'pending' ORDER BY id DESC")


def approve_purchase(db_path: str | Path, approval_id: int) -> dict[str, Any] | None:
    with closing(connect(db_path)) as connection:
        with connection:
            approval = connection.execute("SELECT * FROM purchase_approvals WHERE id = ? AND status = 'pending'", (approval_id,)).fetchone()
            if not approval:
                return None
            # Create the actual purchase order
            result = create_purchase_order(db_path, {
                "product_id": approval["product_id"],
                "supplier_id": approval["supplier_id"],
                "quantity": approval["quantity"],
                "unit_price": approval["unit_price"],
                "order_date": datetime.now().strftime("%Y-%m-%d"),
            })
            connection.execute("UPDATE purchase_approvals SET status = 'approved', approved_at = ? WHERE id = ?", (datetime.now().isoformat(), approval_id))
            return {"approval": dict(approval), "purchase_order": result["purchase_order"]}


def reject_purchase(db_path: str | Path, approval_id: int) -> bool:
    with closing(connect(db_path)) as connection:
        with connection:
            cursor = connection.execute("UPDATE purchase_approvals SET status = 'rejected' WHERE id = ? AND status = 'pending'", (approval_id,))
    return cursor.rowcount > 0


def create_inventory_audit(db_path: str | Path, payload: dict[str, Any]) -> dict[str, Any]:
    product_id = int(payload["product_id"])
    actual_stock = float(payload["actual_stock"])
    note = str(payload.get("note", ""))
    audited_at = str(payload.get("audited_at", datetime.now().strftime("%Y-%m-%d")))

    with closing(connect(db_path)) as connection:
        with connection:
            product = connection.execute("SELECT * FROM products WHERE id = ? AND is_active = 1", (product_id,)).fetchone()
            if not product:
                raise ValueError("product_id does not exist")
            system_stock = float(product["current_stock"])
            discrepancy = actual_stock - system_stock
            cursor = connection.execute(
                "INSERT INTO inventory_audits (product_id, system_stock, actual_stock, discrepancy, note, audited_at) VALUES (?, ?, ?, ?, ?, ?)",
                (product_id, system_stock, actual_stock, round(discrepancy, 1), note, audited_at),
            )
            row = connection.execute("SELECT * FROM inventory_audits WHERE id = ?", (int(cursor.lastrowid),)).fetchone()
    return dict(row)


def get_inventory_audits(db_path: str | Path) -> list[dict[str, Any]]:
    with closing(connect(db_path)) as connection:
        return _fetch_all(connection, "SELECT * FROM inventory_audits ORDER BY id DESC LIMIT 50")


def get_todays_report(db_path: str | Path) -> dict[str, Any] | None:
    """Get the latest report for today if it exists."""
    today = datetime.now().strftime("%Y-%m-%d")
    with closing(connect(db_path)) as connection:
        row = connection.execute(
            "SELECT * FROM agent_reports WHERE date(created_at) = ? ORDER BY id DESC LIMIT 1",
            (today,),
        ).fetchone()
    if row is None:
        return None
    item = dict(row)
    item["metrics"] = json.loads(item["metrics"])
    return item
