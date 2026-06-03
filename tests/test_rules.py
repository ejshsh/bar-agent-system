import unittest

from backend.rules import build_dashboard, detect_replenishment


class RulesTest(unittest.TestCase):
    def test_detect_replenishment_flags_low_stock_products(self):
        products = [
            {"id": 1, "name": "百龄坛 12 年", "safety_stock": 8, "current_stock": 3},
            {"id": 2, "name": "科罗娜", "safety_stock": 24, "current_stock": 28},
        ]
        sales = [
            {"product_id": 1, "quantity": 35},
            {"product_id": 2, "quantity": 12},
        ]

        suggestions = detect_replenishment(products, sales, supplier_lead_days=3)

        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["product_name"], "百龄坛 12 年")
        self.assertEqual(suggestions[0]["risk_level"], "high")
        self.assertGreaterEqual(suggestions[0]["suggested_quantity"], 10)

    def test_build_dashboard_returns_core_metrics_and_agent_suggestions(self):
        data = {
            "products": [
                {"id": 1, "name": "百龄坛 12 年", "safety_stock": 8, "current_stock": 3},
                {"id": 2, "name": "荔枝味预调酒", "safety_stock": 12, "current_stock": 96},
            ],
            "sales_records": [
                {"product_id": 1, "quantity": 35},
                {"product_id": 2, "quantity": 8},
            ],
            "customer_storage": [
                {"customer_name": "陈先生", "product_name": "皇家礼炮", "remaining_quantity": 420, "days_until_expiry": 7},
                {"customer_name": "林女士", "product_name": "香槟套餐", "remaining_quantity": 1, "days_until_expiry": 13},
            ],
            "purchase_orders": [
                {"product_id": 1, "unit_price": 220, "average_price": 180},
            ],
            "suppliers": [
                {"name": "港岛酒业", "price_stability_score": 94, "average_delivery_days": 2.1},
            ],
        }

        dashboard = build_dashboard(data)

        self.assertEqual(dashboard["metrics"]["low_stock_count"], 1)
        self.assertEqual(dashboard["metrics"]["overstock_count"], 1)
        self.assertEqual(dashboard["metrics"]["expiring_storage_count"], 2)
        self.assertEqual(dashboard["metrics"]["price_anomaly_count"], 1)
        self.assertTrue(dashboard["agent_suggestions"])


if __name__ == "__main__":
    unittest.main()
