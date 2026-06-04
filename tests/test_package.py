import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from tools import package_portable


class PortablePackageTest(unittest.TestCase):
    def test_build_package_contains_runtime_files_and_excludes_private_data(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            dist = Path(tmpdir) / "dist"
            package_dir = dist / "BarAgent-Portable"
            zip_path = dist / "BarAgent-Portable.zip"

            with patch.object(package_portable, "DIST_DIR", dist), \
                 patch.object(package_portable, "PACKAGE_DIR", package_dir), \
                 patch.object(package_portable, "ZIP_PATH", zip_path):
                result = package_portable.build_package()

            self.assertEqual(result, zip_path)
            self.assertTrue((package_dir / "启动系统.bat").exists())
            self.assertTrue((package_dir / "老板打开说明.md").exists())
            self.assertTrue((package_dir / "backend" / "server.py").exists())
            self.assertTrue((package_dir / "js" / "utils.js").exists())
            self.assertTrue((package_dir / "data").is_dir())
            self.assertFalse((package_dir / ".env").exists())
            self.assertFalse((package_dir / "DESIGN-apple.md").exists())
            self.assertFalse((package_dir / ".git").exists())
            self.assertFalse((package_dir / "tests").exists())

            with zipfile.ZipFile(zip_path) as archive:
                names = set(archive.namelist())

            self.assertIn("BarAgent-Portable/启动系统.bat", names)
            self.assertIn("BarAgent-Portable/backend/server.py", names)
            self.assertIn("BarAgent-Portable/data/.keep", names)
            self.assertNotIn("BarAgent-Portable/.env", names)
            self.assertFalse(any("__pycache__" in name for name in names))
            self.assertFalse(any(name.startswith("BarAgent-Portable/data/") and name.endswith(".db") for name in names))


if __name__ == "__main__":
    unittest.main()
