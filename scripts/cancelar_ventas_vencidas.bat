@echo off
REM Barrido de ventas pendientes vencidas.
REM Lo ejecuta el Programador de tareas de Windows cada 10 minutos.
setlocal

for %%I in ("%~dp0..") do set "PROYECTO=%%~fI"
set "PYTHON=%PROYECTO%\venv\Scripts\python.exe"
set "MANAGE=%PROYECTO%\backend\manage.py"
set "LOGS=%PROYECTO%\backend\logs"

if not exist "%LOGS%" mkdir "%LOGS%"

"%PYTHON%" "%MANAGE%" cancelar_ventas_vencidas >> "%LOGS%\cancelar_ventas_vencidas.log" 2>&1
