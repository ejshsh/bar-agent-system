from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .db import (
    compare_supplier_price_quotes,
    create_inventory_adjustment,
    create_product,
    create_purchase_order,
    create_sales_record,
    create_supplier,
    create_supplier_price_quote,
    create_customer_storage,
    deactivate_customer_storage,
    deactivate_product,
    deactivate_supplier,
    initialize_database,
    load_dataset,
    pickup_customer_storage,
    update_customer_storage,
)
from .rules import build_dashboard


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

        dataset = load_dataset(self.db_path)

        if route == "/api/dashboard":
            dashboard = build_dashboard(dataset)
            dashboard["products"] = dataset["products"]
            dashboard["customer_storage"] = dataset["customer_storage"]
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
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_purchase_order", "message": str(error)})
            return self._json(201, result)
        if route == "/api/products":
            try:
                product = create_product(self.db_path, payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_product", "message": str(error)})
            return self._json(201, {"product": product})
        if route == "/api/suppliers":
            try:
                supplier = create_supplier(self.db_path, payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_supplier", "message": str(error)})
            return self._json(201, {"supplier": supplier})
        if route == "/api/supplier-price-quotes":
            try:
                quote = create_supplier_price_quote(self.db_path, payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_supplier_price_quote", "message": str(error)})
            return self._json(201, {"quote": quote})
        if route == "/api/customer-storage":
            try:
                customer_storage = create_customer_storage(self.db_path, payload)
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
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_sales_record", "message": str(error)})
            return self._json(201, result)
        if route == "/api/inventory-adjustments":
            try:
                result = create_inventory_adjustment(self.db_path, payload)
            except (KeyError, TypeError, ValueError) as error:
                return self._json(400, {"error": "invalid_inventory_adjustment", "message": str(error)})
            return self._json(201, result)

        return self._json(404, {"error": "not_found", "path": route})

    def _json(self, status: int, payload: dict[str, Any]) -> tuple[int, dict[str, str], str]:
        body = json.dumps(payload, ensure_ascii=False, indent=2)
        return status, {"Content-Type": "application/json; charset=utf-8"}, body


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
