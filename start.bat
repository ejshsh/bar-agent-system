@echo off
chcp 65001 >nul
echo ====================================
echo    Bar Agent 经营驾驶舱
echo ====================================
echo.
echo 正在启动后端服务...
start "Bar Agent Backend" /MIN cmd /c "cd /d %~dp0 && python -m backend.server"
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
