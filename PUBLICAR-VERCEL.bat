@echo off
setlocal
cd /d "%~dp0"
echo Publicando o Aura na sua conta Vercel...
echo Se solicitado, conclua o login no navegador.
call npx.cmd --yes vercel@latest login
if errorlevel 1 (
  echo Nao foi possivel entrar na Vercel.
  pause
  exit /b 1
)
call npx.cmd --yes vercel@latest --prod
pause
