@echo off
chcp 65001 >nul
echo ====================================
echo    Bar Agent 经营驾驶舱
echo ====================================
echo.

set "PYTHON_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  set "PYTHON_CMD=C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
)

if not exist "%PYTHON_CMD%" (
  where %PYTHON_CMD% >nul 2>nul
  if errorlevel 1 (
    echo 未找到 Python，请先安装 Python 3，或使用 Codex 自带 Python 启动。
    echo.
    pause
    exit /b 1
  )
)

echo 正在启动后端服务...
start "Bar Agent Backend" /MIN cmd /c "cd /d %~dp0 && ""%PYTHON_CMD%"" -m backend.server --host 0.0.0.0"
echo 等待后端启动...
timeout /t 3 /nobreak >nul
echo 正在启动前端静态服务...
start "Bar Agent Frontend" /MIN cmd /c "cd /d %~dp0 && ""%PYTHON_CMD%"" -m http.server 8765 --bind 0.0.0.0"
timeout /t 1 /nobreak >nul
echo 正在打开前端页面...
start "" "http://127.0.0.1:8765/index.html"
echo.
echo 后端: http://127.0.0.1:8000
echo 前端: http://127.0.0.1:8765/index.html
echo 手机访问: 请查看本机 IPv4 地址，然后打开 http://电脑IP:8765/index.html
echo.
echo 按任意键退出...
pause >nul
