import json
import tempfile
import unittest
from datetime import datetime
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

    def test_create_supplier_price_quote_records_offer(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, _, body = app.handle_post(
                "/api/supplier-price-quotes",
                json.dumps(
                    {
                        "product_id": 1,
                        "supplier_id": 2,
                        "unit_price": 198,
                        "delivery_days": 3,
                        "quoted_at": "2026-06-04",
                    }
                ),
            )
            payload = json.loads(body)

        self.assertEqual(status, 201)
        self.assertEqual(payload["quote"]["product_id"], 1)
        self.assertEqual(payload["quote"]["supplier_id"], 2)
        self.assertEqual(payload["quote"]["unit_price"], 198)
        self.assertEqual(payload["quote"]["delivery_days"], 3)

    def test_supplier_quote_comparison_marks_lowest_price_and_fastest_delivery(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            app.handle_post(
                "/api/supplier-price-quotes",
                json.dumps(
                    {
                        "product_id": 1,
                        "supplier_id": 1,
                        "unit_price": 220,
                        "delivery_days": 2,
                        "quoted_at": "2026-06-04",
                    }
                ),
            )
            app.handle_post(
                "/api/supplier-price-quotes",
                json.dumps(
                    {
                        "product_id": 1,
                        "supplier_id": 2,
                        "unit_price": 198,
                        "delivery_days": 4,
                        "quoted_at": "2026-06-04",
                    }
                ),
            )

            status, _, body = app.handle_get("/api/supplier-price-quotes?product_id=1")
            payload = json.loads(body)

        self.assertEqual(status, 200)
        self.assertEqual(len(payload["items"]), 2)
        lowest = next(item for item in payload["items"] if item["is_lowest_price"])
        fastest = next(item for item in payload["items"] if item["is_fastest_delivery"])
        self.assertEqual(lowest["supplier_id"], 2)
        self.assertEqual(fastest["supplier_id"], 1)
        self.assertEqual(payload["recommendation"]["supplier_id"], 2)

    def test_create_update_and_delete_customer_storage(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            create_status, _, create_body = app.handle_post(
                "/api/customer-storage",
                json.dumps(
                    {
                        "customer_name": "王先生",
                        "product_name": "自带香槟",
                        "remaining_quantity": 1,
                        "days_until_expiry": 20,
                    }
                ),
            )
            created = json.loads(create_body)["customer_storage"]

            update_status, _, update_body = app.handle_put(
                f"/api/customer-storage/{created['id']}",
                json.dumps(
                    {
                        "customer_name": "王先生VIP",
                        "product_name": "自带香槟",
                        "remaining_quantity": 0.5,
                        "days_until_expiry": 9,
                    }
                ),
            )
            updated = json.loads(update_body)["customer_storage"]

            delete_status, _, delete_body = app.handle_delete(f"/api/customer-storage/{created['id']}")
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(create_status, 201)
        self.assertEqual(update_status, 200)
        self.assertEqual(delete_status, 200)
        self.assertEqual(updated["customer_name"], "王先生VIP")
        self.assertEqual(updated["remaining_quantity"], 0.5)
        self.assertTrue(json.loads(delete_body)["deleted"])
        self.assertFalse(any(item["customer_name"] == "王先生VIP" for item in dashboard["customer_storage"]))

    def test_pickup_customer_storage_reduces_remaining_quantity(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            created = json.loads(
                app.handle_post(
                    "/api/customer-storage",
                    json.dumps(
                        {
                            "customer_name": "赵先生",
                            "product_name": "黑牌威士忌",
                            "remaining_quantity": 5,
                            "days_until_expiry": 18,
                        }
                    ),
                )[2]
            )["customer_storage"]

            status, _, body = app.handle_post(
                f"/api/customer-storage/{created['id']}/pickup",
                json.dumps({"quantity": 2, "picked_up_at": "2026-06-04"}),
            )
            payload = json.loads(body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(status, 201)
        self.assertEqual(payload["pickup_record"]["quantity"], 2)
        self.assertEqual(payload["customer_storage"]["remaining_quantity"], 3)
        stored = next(item for item in dashboard["customer_storage"] if item["id"] == created["id"])
        self.assertEqual(stored["remaining_quantity"], 3)

    def test_pickup_customer_storage_rejects_excess_quantity(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            created = json.loads(
                app.handle_post(
                    "/api/customer-storage",
                    json.dumps(
                        {
                            "customer_name": "钱女士",
                            "product_name": "香槟",
                            "remaining_quantity": 1,
                            "days_until_expiry": 12,
                        }
                    ),
                )[2]
            )["customer_storage"]

            status, _, body = app.handle_post(
                f"/api/customer-storage/{created['id']}/pickup",
                json.dumps({"quantity": 2, "picked_up_at": "2026-06-04"}),
            )
            payload = json.loads(body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "invalid_storage_pickup")
        stored = next(item for item in dashboard["customer_storage"] if item["id"] == created["id"])
        self.assertEqual(stored["remaining_quantity"], 1)

    def test_create_sales_record_decreases_stock_and_records_inventory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, _, body = app.handle_post(
                "/api/sales-records",
                json.dumps(
                    {
                        "product_id": 2,
                        "quantity": 6,
                        "sale_date": "2026-06-04",
                    }
                ),
            )
            payload = json.loads(body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(status, 201)
        self.assertEqual(payload["sales_record"]["quantity"], 6)
        self.assertEqual(payload["inventory_record"]["quantity_change"], -6)
        product = next(item for item in dashboard["products"] if item["id"] == 2)
        self.assertEqual(product["current_stock"], 90)

    def test_create_sales_record_rejects_insufficient_stock(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, _, body = app.handle_post(
                "/api/sales-records",
                json.dumps(
                    {
                        "product_id": 1,
                        "quantity": 999,
                        "sale_date": "2026-06-04",
                    }
                ),
            )
            payload = json.loads(body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "invalid_sales_record")
        product = next(item for item in dashboard["products"] if item["id"] == 1)
        self.assertEqual(product["current_stock"], 3)

    def test_create_inventory_count_adjusts_stock_and_records_difference(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, _, body = app.handle_post(
                "/api/inventory-adjustments",
                json.dumps(
                    {
                        "product_id": 1,
                        "adjustment_type": "count",
                        "actual_quantity": 6,
                        "reason": "月初盘点",
                        "occurred_at": "2026-06-04",
                    }
                ),
            )
            payload = json.loads(body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(status, 201)
        self.assertEqual(payload["inventory_record"]["record_type"], "adjustment")
        self.assertEqual(payload["inventory_record"]["quantity_change"], 3)
        self.assertEqual(payload["inventory_record"]["quantity_after"], 6)
        product = next(item for item in dashboard["products"] if item["id"] == 1)
        self.assertEqual(product["current_stock"], 6)

    def test_create_inventory_loss_decreases_stock_and_rejects_excess_loss(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            success_status, _, success_body = app.handle_post(
                "/api/inventory-adjustments",
                json.dumps(
                    {
                        "product_id": 1,
                        "adjustment_type": "loss",
                        "quantity": 2,
                        "reason": "破损",
                        "occurred_at": "2026-06-04",
                    }
                ),
            )
            success_payload = json.loads(success_body)

            fail_status, _, fail_body = app.handle_post(
                "/api/inventory-adjustments",
                json.dumps(
                    {
                        "product_id": 1,
                        "adjustment_type": "loss",
                        "quantity": 5,
                        "reason": "过期",
                        "occurred_at": "2026-06-04",
                    }
                ),
            )
            fail_payload = json.loads(fail_body)
            dashboard = json.loads(app.handle_get("/api/dashboard")[2])

        self.assertEqual(success_status, 201)
        self.assertEqual(success_payload["inventory_record"]["record_type"], "loss")
        self.assertEqual(success_payload["inventory_record"]["quantity_change"], -2)
        self.assertEqual(success_payload["inventory_record"]["quantity_after"], 1)
        self.assertEqual(fail_status, 400)
        self.assertEqual(fail_payload["error"], "invalid_inventory_adjustment")
        product = next(item for item in dashboard["products"] if item["id"] == 1)
        self.assertEqual(product["current_stock"], 1)

    def test_agent_report_preview_does_not_save_history(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, _, body = app.handle_post(
                "/api/agent-reports",
                json.dumps({"created_at": datetime.now().isoformat()}),
            )
            payload = json.loads(body)
            history = json.loads(app.handle_get("/api/agent-reports")[2])

        self.assertEqual(status, 200)
        self.assertIn("title", payload)
        self.assertIn("period", payload)
        self.assertIn("content", payload)
        self.assertIn("metrics", payload)
        self.assertEqual(history["items"], [])

    def test_save_list_detail_today_and_delete_agent_report(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)
            today = datetime.now().isoformat()

            save_status, _, save_body = app.handle_post(
                "/api/agent-reports/save",
                json.dumps(
                    {
                        "title": "测试经营报告",
                        "period": today[:7],
                        "content": "## 测试经营报告\n- 采购正常",
                        "metrics": {"purchase_amount": 1000, "low_stock_count": 2},
                        "created_at": today,
                    }
                ),
            )
            saved = json.loads(save_body)
            list_payload = json.loads(app.handle_get("/api/agent-reports")[2])
            detail_status, _, detail_body = app.handle_get(f"/api/agent-reports/{saved['id']}")
            today_status, _, today_body = app.handle_get("/api/todays-report")
            delete_status, _, delete_body = app.handle_delete(f"/api/agent-reports/{saved['id']}")
            after_delete = json.loads(app.handle_get(f"/api/agent-reports/{saved['id']}")[2])

        self.assertEqual(save_status, 201)
        self.assertEqual(saved["metrics"]["purchase_amount"], 1000)
        self.assertEqual(len(list_payload["items"]), 1)
        self.assertEqual(detail_status, 200)
        self.assertEqual(json.loads(detail_body)["title"], "测试经营报告")
        self.assertEqual(today_status, 200)
        self.assertEqual(json.loads(today_body)["id"], saved["id"])
        self.assertEqual(delete_status, 200)
        self.assertTrue(json.loads(delete_body)["deleted"])
        self.assertEqual(after_delete["error"], "report_not_found")

    def test_agent_ask_falls_back_to_rules_without_api_key_and_rejects_empty_question(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "bar.db"
            initialize_database(db_path)
            app = create_app(db_path)

            status, _, body = app.handle_post(
                "/api/agent-ask",
                json.dumps({"question": "本周哪些酒水快缺货？"}),
            )
            payload = json.loads(body)
            empty_status, _, empty_body = app.handle_post(
                "/api/agent-ask",
                json.dumps({"question": ""}),
            )

        self.assertEqual(status, 200)
        self.assertIn("answer", payload)
        self.assertIn("补货", payload["answer"])
        self.assertEqual(empty_status, 400)
        self.assertEqual(json.loads(empty_body)["error"], "invalid_agent_ask")


if __name__ == "__main__":
    unittest.main()
