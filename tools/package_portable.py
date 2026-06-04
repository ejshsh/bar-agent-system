from __future__ import annotations

import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "dist"
PACKAGE_DIR = DIST_DIR / "BarAgent-Portable"
ZIP_PATH = DIST_DIR / "BarAgent-Portable.zip"

FILES = [
    ".env.example",
    ".gitignore",
    "app.js",
    "index.html",
    "manifest.json",
    "README.md",
    "start.bat",
    "styles.css",
    "sw.js",
]

DIRS = [
    "backend",
    "js",
]

EXCLUDED_PARTS = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    "data",
    "dist",
    "tests",
    "tools",
}

EXCLUDED_NAMES = {
    ".env",
    "DESIGN-apple.md",
}


PORTABLE_START = r"""@echo off
chcp 65001 >nul
title Bar Agent 启动器
echo ====================================
echo    Bar Agent 酒吧经营系统
echo ====================================
echo.

set "PYTHON_CMD="
where python >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=python"

if not defined PYTHON_CMD (
  where py >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=py -3"
)

if not defined PYTHON_CMD (
  echo 未找到 Python 3。
  echo 请先安装 Python 3.10 或更高版本，并勾选 Add Python to PATH。
  echo 下载地址：https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)

echo 正在启动后端服务...
start "Bar Agent Backend" /MIN cmd /k "cd /d %~dp0 && %PYTHON_CMD% -m backend.server --host 0.0.0.0"
timeout /t 3 /nobreak >nul

echo 正在启动前端页面服务...
start "Bar Agent Frontend" /MIN cmd /k "cd /d %~dp0 && %PYTHON_CMD% -m http.server 8765 --bind 0.0.0.0"
timeout /t 1 /nobreak >nul

echo 正在打开浏览器...
start "" "http://127.0.0.1:8765/index.html"
echo.
echo 电脑访问：http://127.0.0.1:8765/index.html
echo 手机访问：同一 Wi-Fi 下打开 http://电脑IPv4地址:8765/index.html
echo.
echo 默认管理员：admin / admin123
echo 默认店员：staff / staff123
echo.
echo 不要关闭弹出的 Backend 和 Frontend 窗口。
pause
"""


PORTABLE_README = """# Bar Agent 运行包

## 打开方式

1. 解压整个文件夹。
2. 双击 `启动系统.bat`。
3. 浏览器会打开 `http://127.0.0.1:8765/index.html`。

默认账号：

- 管理员：admin / admin123
- 店员：staff / staff123

## 手机访问

手机和电脑连接同一个 Wi-Fi 后，在手机浏览器打开：

`http://电脑IPv4地址:8765/index.html`

电脑 IPv4 地址可以在命令行执行 `ipconfig` 查看。

## 注意

- 电脑需要安装 Python 3.10 或更高版本。
- 第一次启动时，Windows 防火墙可能询问是否允许 Python 访问网络，请允许“专用网络”。
- 数据库会自动生成在 `data/bar_agent.db`，不要随意删除。
"""


def should_skip(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if any(part in EXCLUDED_PARTS for part in relative.parts):
        return True
    return path.name in EXCLUDED_NAMES


def copy_tree(src: Path, dst: Path) -> None:
    for item in src.rglob("*"):
        if should_skip(item):
            continue
        target = dst / item.relative_to(src)
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def build_package() -> Path:
    if PACKAGE_DIR.exists():
        shutil.rmtree(PACKAGE_DIR)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    PACKAGE_DIR.mkdir(parents=True, exist_ok=True)
    (PACKAGE_DIR / "data").mkdir(exist_ok=True)
    (PACKAGE_DIR / "data" / ".keep").write_text("", encoding="utf-8")

    for file_name in FILES:
        shutil.copy2(ROOT / file_name, PACKAGE_DIR / file_name)

    for dir_name in DIRS:
        copy_tree(ROOT / dir_name, PACKAGE_DIR / dir_name)

    (PACKAGE_DIR / "启动系统.bat").write_text(PORTABLE_START, encoding="utf-8")
    (PACKAGE_DIR / "老板打开说明.md").write_text(PORTABLE_README, encoding="utf-8")

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in PACKAGE_DIR.rglob("*"):
            if path.is_file():
                archive.write(path, path.relative_to(DIST_DIR))

    return ZIP_PATH


if __name__ == "__main__":
    package = build_package()
    print(package)
