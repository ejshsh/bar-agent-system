from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .db import create_purchase_order, initialize_database, load_dataset
from .rules import build_dashboard


DEFAULT_DB_PATH = Path("data/bar_agent.db")


class BarApi:
    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)

    def handle_get(self, path: str) -> tuple[int, dict[str, str], str]:
        route = urlparse(path).path
        initialize_database(self.db_path)

        if route == "/api/health":
            return self._json(200, {"status": "ok", "service": "bar-agent-api"})

        dataset = load_dataset(self.db_path)

        if route == "/api/dashboard":
            dashboard = build_dashboard(dataset)
            dashboard["products"] = dataset["products"]
            return self._json(200, dashboard)
        if route == "/api/products":
            return self._json(200, {"items": dataset["products"]})
        if route == "/api/suppliers":
            return self._json(200, {"items": dataset["suppliers"]})
        if route == "/api/customer-storage":
            return self._json(200, {"items": dataset["customer_storage"]})

        return self._json(404, {"error": "not_found", "path": route})

    def handle_post(self, path: str, body: str) -> tuple[int, dict[str, str], str]:
        route = urlparse(path).path
        initialize_database(self.db_path)

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
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
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
