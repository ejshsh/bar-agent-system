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
start "Bar Agent Backend" /MIN cmd /c "cd /d %~dp0 && ""%PYTHON_CMD%"" -m backend.server"
echo 等待后端启动...
timeout /t 3 /nobreak >nul
echo 正在打开前端页面...
start "" "%~dp0index.html"
echo.
echo 后端: http://127.0.0.1:8000
echo 前端已打开，请在浏览器中查看
echo.
echo 按任意键退出...
pause >nul
