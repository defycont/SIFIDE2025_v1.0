@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ====================================================
echo 🚀 SIFIDE v1.0 — DEFYCONT ASESORES — SETUP COMPLETO
echo ====================================================

if not exist "mi_icono.ico" (
    echo ❌ No se encontró el archivo mi_icono.ico en esta carpeta.
    echo 📄 Coloca tu icono .ico aquí y vuelve a ejecutar.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo ❌ No se encontró package.json. Asegúrate de estar en la carpeta del proyecto.
    pause
    exit /b 1
)

echo 🔷 Creando electron-main.js …
(
echo const ^{ app, BrowserWindow } = require('electron');
echo const path = require('path');
echo.
echo function createWindow () ^{
echo.  const win = new BrowserWindow(^{
echo.    width: 1024,
echo.    height: 768,
echo.    icon: path.join(__dirname, 'mi_icono.ico'),
echo.    webPreferences: ^{
echo.      contextIsolation: true
echo.    ^}
echo.  ^});
echo.
echo.  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
echo ^}
echo.
echo app.whenReady().then(() => ^{
echo.  createWindow();
echo.  app.on('activate', () => ^{
echo.    if (BrowserWindow.getAllWindows().length == 0) createWindow();
echo.  ^});
echo ^});
echo.
echo app.on('window-all-closed', () => ^{
echo.  if (process.platform != 'darwin') app.quit();
echo ^});
) > electron-main.js

echo 🔷 Instalando dependencias …
call npm install

if errorlevel 1 (
    echo ❌ Error al instalar dependencias.
    pause
    exit /b 1
)

findstr /C:"\"build\":" package.json >nul
if errorlevel 1 (
    echo ❌ No se encontró el script "build" en package.json.
    echo Revisa tu package.json para asegurarte de que tenga: "build": "vite build"
    pause
    exit /b 1
)

echo 🔷 Construyendo React …
call npm run build

if errorlevel 1 (
    echo ❌ Error al construir React.
    pause
    exit /b 1
)

echo 🔷 Lanzando Electron …
call npm run electron

if errorlevel 1 (
    echo ❌ Error al ejecutar Electron.
    pause
    exit /b 1
)

echo ====================================================
echo 🖥️ Electron finalizado.
echo ====================================================

set /p buildexe="💼 ¿Quieres empaquetar como .exe? (S para sí): "
if /i "%buildexe%"=="S" (
    echo 🔷 Empaquetando como .exe …
    call npm run dist

    if errorlevel 1 (
        echo ❌ Error al empaquetar.
        pause
        exit /b 1
    )

    echo 🎁 Empaquetado completo. El instalador está en la carpeta dist/
)

echo ====================================================
echo ✅ Todo listo. Disfruta tu app.
echo ====================================================
pause
exit /b 0
