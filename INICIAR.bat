@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 24 LTS e tente novamente.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Abra http://localhost:5173 no navegador.
echo Mantenha esta janela aberta enquanto usa o aplicativo.
call npm.cmd run dev
pause
