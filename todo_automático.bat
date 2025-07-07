@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ====================================================
echo 🚀 SIFIDE v1.0 — DEFYCONT ASESORES — SETUP COMPLETO
echo ====================================================

REM Verifica si el ícono existe
if not exist "mi_icono.ico" (
    echo ❌ No se encontró el archivo mi_icono.ico en esta carpeta.
    echo 📄 Coloca tu icono .ico aquí y vuelve a ejecutar.
    pause
    exit /b 1
)

REM Crea electron-main.js
echo 🔷 Creando electron-main.js …
(
echo const { app, BrowserWindow } = require('electron');
echo const path = require('path');
echo.
echo function createWindow () {
echo.  const win = new BrowserWindow({
echo.    width: 1024,
echo.    height: 768,
echo.    icon: path.join(__dirname, 'mi_icono.ico'),
echo.    webPreferences: {
echo.      contextIsolation: true
echo.    }
echo.  });
echo.
echo.  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
echo }
echo.
echo app.whenReady().then(() => {
echo.  createWindow();
echo.  app.on('activate', () => {
echo.    if (BrowserWindow.getAllWindows().length === 0) createWindow();
echo.  });
echo });
echo.
echo app.on('window-all-closed', () => {
echo.  if (process.platform !== 'darwin') app.quit();
echo });
) > electron-main.js

echo 🔷 Creando package.json …
(
echo {
echo   "name": "sifide-v1.0",
echo   "version": "1.0.0",
echo   "description": "SIFIDE v1.0 — DEFYCONT ASESORES",
echo   "main": "electron-main.js",
echo   "scripts": {
echo     "dev": "vite",
echo     "build": "vite build",
echo     "preview": "vite preview",
echo     "electron": "electron .",
echo     "dist": "electron-builder"
echo   },
echo   "build": {
echo     "appId": "com.defycont.sifide",
echo     "win": {
echo       "icon": "mi_icono.ico",
echo       "target": "nsis"
echo     }
echo   },
echo   "devDependencies": {
echo     "electron": "^30.0.0",
echo     "electron-builder": "^24.0.0"
echo   },
echo   "dependencies": {}
echo }
) > package.json

echo 🔷 Instalando dependencias …
call npm install

if errorlevel 1 (
    echo ❌ Error al instalar dependencias.
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
