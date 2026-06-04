import json
import tempfile
import unittest
from pathlib import Path

from backend.db import initialize_database
from backend.server import create_app


class ApiTest(unittest.TestCase):
    def test_dashboard_endpoint_returns_metrics(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, headers, body = app.handle_get("/api/dashboard")
            payload = json.loads(body)

        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertIn("metrics", payload)
        self.assertIn("activity_suggestions", payload)
        self.assertGreaterEqual(payload["metrics"]["low_stock_count"], 1)
        self.assertTrue(payload["agent_suggestions"])
        self.assertTrue(payload["activity_suggestions"])

    def test_unknown_endpoint_returns_404_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, headers, body = app.handle_get("/api/missing")
            payload = json.loads(body)

        self.assertEqual(status, 404)
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertEqual(payload["error"], "not_found")

    def test_create_purchase_order_increases_stock_and_records_inventory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, headers, body = app.handle_post(
                "/api/purchase-orders",
                json.dumps(
                    {
                        "product_id": 1,
                        "supplier_id": 1,
                        "quantity": 10,
                        "unit_price": 210,
                        "order_date": "2026-06-04",
                    }
                ),
            )
            payload = json.loads(body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(status, 201)
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertEqual(payload["purchase_order"]["quantity"], 10)
        self.assertEqual(payload["inventory_record"]["quantity_change"], 10)
        product = next(item for item in dashboard["products"] if item["id"] == 1)
        self.assertEqual(product["current_stock"], 13)

    def test_create_custom_product_and_supplier_then_purchase_inbound(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            product_status, _, product_body = app.handle_post(
                "/api/products",
                json.dumps(
                    {
                        "name": "自定义龙舌兰",
                        "category": "龙舌兰",
                        "safety_stock": 6,
                        "current_stock": 0,
                        "unit": "瓶",
                    }
                ),
            )
            supplier_status, _, supplier_body = app.handle_post(
                "/api/suppliers",
                json.dumps(
                    {
                        "name": "自定义供应商",
                        "price_stability_score": 80,
                        "average_delivery_days": 3,
                    }
                ),
            )
            product = json.loads(product_body)["product"]
            supplier = json.loads(supplier_body)["supplier"]

            purchase_status, _, purchase_body = app.handle_post(
                "/api/purchase-orders",
                json.dumps(
                    {
                        "product_id": product["id"],
                        "supplier_id": supplier["id"],
                        "quantity": 5,
                        "unit_price": 188,
                        "order_date": "2026-06-04",
                    }
                ),
            )
            purchase = json.loads(purchase_body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(product_status, 201)
        self.assertEqual(supplier_status, 201)
        self.assertEqual(purchase_status, 201)
        self.assertEqual(purchase["inventory_record"]["quantity_after"], 5)
        self.assertTrue(any(item["name"] == "自定义龙舌兰" for item in dashboard["products"]))
        self.assertTrue(any(item["name"] == "自定义供应商" for item in dashboard["suppliers"]))

    def test_delete_product_and_supplier_hides_them_from_dashboard(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            product = json.loads(
                app.handle_post(
                    "/api/products",
                    json.dumps(
                        {
                            "name": "待删除酒水",
                            "category": "测试",
                            "safety_stock": 1,
                            "current_stock": 0,
                            "unit": "瓶",
                        }
                    ),
                )[2]
            )["product"]
            supplier = json.loads(
                app.handle_post(
                    "/api/suppliers",
                    json.dumps(
                        {
                            "name": "待删除供应商",
                            "price_stability_score": 80,
                            "average_delivery_days": 3,
                        }
                    ),
                )[2]
            )["supplier"]

            product_status, _, product_body = app.handle_delete(f"/api/products/{product['id']}")
            supplier_status, _, supplier_body = app.handle_delete(f"/api/suppliers/{supplier['id']}")
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(product_status, 200)
        self.assertEqual(supplier_status, 200)
        self.assertTrue(json.loads(product_body)["deleted"])
        self.assertTrue(json.loads(supplier_body)["deleted"])
        self.assertFalse(any(item["name"] == "待删除酒水" for item in dashboard["products"]))
        self.assertFalse(any(item["name"] == "待删除供应商" for item in dashboard["suppliers"]))


if __name__ == "__main__":
    unittest.main()
