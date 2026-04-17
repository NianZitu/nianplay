@echo off
setlocal

set GH_TOKEN=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
set GH_OWNER=NianZitu
set GH_REPO=nianplay

:: Lê versão atual do package.json
for /f "tokens=2 delims=:, " %%v in ('findstr /r "\"version\"" package.json') do (
    set VERSION=%%~v
    goto :found
)
:found

echo.
echo ========================================
echo   NianPlay Release ^| v%VERSION%
echo ========================================
echo.

:: Build
echo [1/4] Fazendo build...
call npm run build
if errorlevel 1 (
    echo ERRO no build. Abortando.
    pause & exit /b 1
)

:: Commit e push do codigo
echo.
echo [2/4] Subindo codigo para o GitHub...
git add -A
git commit -m "Release v%VERSION%"
git push origin main

:: Criar release no GitHub
echo.
echo [3/4] Criando release v%VERSION% no GitHub...
set BODY={"tag_name":"v%VERSION%","name":"NianPlay v%VERSION%","body":"Nova versao do NianPlay.","draft":false,"prerelease":false}

for /f "delims=" %%i in ('curl -s -X POST -H "Authorization: token %GH_TOKEN%" -H "Content-Type: application/json" https://api.github.com/repos/%GH_OWNER%/%GH_REPO%/releases -d "%BODY%" ^| python3 -c "import json,sys; d=json.load(sys.stdin); print(d[\"id\"])"') do set RELEASE_ID=%%i

if "%RELEASE_ID%"=="" (
    echo ERRO ao criar release. Verifique o token.
    pause & exit /b 1
)
echo Release ID: %RELEASE_ID%

:: Upload do instalador
echo.
echo [4/4] Fazendo upload do instalador...
set INSTALLER=dist-electron\NianPlay Setup %VERSION%.exe
set ASSET_NAME=NianPlay-Setup-%VERSION%.exe

curl -s -X POST ^
  -H "Authorization: token %GH_TOKEN%" ^
  -H "Content-Type: application/octet-stream" ^
  --data-binary @"%INSTALLER%" ^
  "https://uploads.github.com/repos/%GH_OWNER%/%GH_REPO%/releases/%RELEASE_ID%/assets?name=%ASSET_NAME%" ^
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('Upload OK:', d.get('browser_download_url','ERRO'))"

echo.
echo ========================================
echo   Concluido! Release v%VERSION% publicada.
echo   https://github.com/%GH_OWNER%/%GH_REPO%/releases
echo ========================================
echo.
pause
