from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    safety_stock REAL NOT NULL,
    current_stock REAL NOT NULL,
    unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price_stability_score REAL NOT NULL,
    average_delivery_days REAL NOT NULL
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
    unit_price REAL NOT NULL,
    average_price REAL NOT NULL,
    order_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_storage (
    id INTEGER PRIMARY KEY,
    customer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    remaining_quantity REAL NOT NULL,
    days_until_expiry INTEGER NOT NULL
);
"""


SEED_ROWS = {
    "products": [
        (1, "百龄坛 12 年", "威士忌", 8, 3, "瓶"),
        (2, "荔枝味预调酒", "预调酒", 12, 96, "瓶"),
        (3, "精酿小麦啤", "啤酒", 30, 18, "瓶"),
        (4, "金汤力基酒", "调酒基酒", 6, 5, "瓶"),
    ],
    "suppliers": [
        (1, "港岛酒业", 94, 2.1),
        (2, "夜色供应链", 86, 3.4),
        (3, "城市精酿", 79, 4.2),
    ],
    "sales_records": [
        (1, 1, 35, "2026-06-01"),
        (2, 2, 8, "2026-06-01"),
        (3, 3, 44, "2026-06-01"),
        (4, 4, 16, "2026-06-01"),
    ],
    "purchase_orders": [
        (1, 1, 1, 220, 180, "2026-06-01"),
        (2, 2, 2, 18, 17, "2026-06-01"),
        (3, 3, 3, 13, 11, "2026-06-01"),
    ],
    "customer_storage": [
        (1, "陈先生", "皇家礼炮", 420, 7),
        (2, "林女士", "香槟套餐", 1, 13),
        (3, "周先生", "麦卡伦 12 年", 260, 28),
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
            if _table_is_empty(connection, "products"):
                _seed_database(connection)


def load_dataset(db_path: str | Path) -> dict[str, list[dict[str, Any]]]:
    with closing(connect(db_path)) as connection:
        return {
            "products": _fetch_all(connection, "SELECT * FROM products ORDER BY id"),
            "suppliers": _fetch_all(connection, "SELECT * FROM suppliers ORDER BY id"),
            "sales_records": _fetch_all(connection, "SELECT * FROM sales_records ORDER BY id"),
            "purchase_orders": _fetch_all(connection, "SELECT * FROM purchase_orders ORDER BY id"),
            "customer_storage": _fetch_all(connection, "SELECT * FROM customer_storage ORDER BY id"),
        }


def _table_is_empty(connection: sqlite3.Connection, table: str) -> bool:
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()
    return row["count"] == 0


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
        "INSERT INTO sales_records (id, product_id, quantity, sale_date) VALUES (?, ?, ?, ?)",
        SEED_ROWS["sales_records"],
    )
    connection.executemany(
        "INSERT INTO purchase_orders (id, product_id, supplier_id, unit_price, average_price, order_date) VALUES (?, ?, ?, ?, ?, ?)",
        SEED_ROWS["purchase_orders"],
    )
    connection.executemany(
        "INSERT INTO customer_storage (id, customer_name, product_name, remaining_quantity, days_until_expiry) VALUES (?, ?, ?, ?, ?)",
        SEED_ROWS["customer_storage"],
    )


def _fetch_all(connection: sqlite3.Connection, query: str) -> list[dict[str, Any]]:
    return [dict(row) for row in connection.execute(query).fetchall()]
