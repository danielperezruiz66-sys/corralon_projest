@echo off
REM Registra el barrido de ventas vencidas en el Programador de tareas.
REM Ejecutar una vez, desde una consola de Windows (no hace falta ser admin).
setlocal

for %%I in ("%~dp0..") do set "PROYECTO=%%~fI"
set "SCRIPT=%PROYECTO%\scripts\cancelar_ventas_vencidas.bat"
set "TAREA=Corralon\CancelarVentasVencidas"

schtasks /Create /F /SC MINUTE /MO 10 /TN "%TAREA%" /TR "%SCRIPT%"

if errorlevel 1 (
    echo No se pudo registrar la tarea "%TAREA%".
    exit /b 1
)

echo Tarea "%TAREA%" registrada: se ejecuta cada 10 minutos.
schtasks /Query /TN "%TAREA%"
