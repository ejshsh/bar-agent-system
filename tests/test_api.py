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


if __name__ == "__main__":
    unittest.main()
