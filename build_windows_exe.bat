@echo off
setlocal enabledelayedexpansion

REM ----------------------------------------------------------------------------
REM Build Zeiterfassung.exe on Windows using the currently selected Python (py).
REM ----------------------------------------------------------------------------

where py >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] Python-Launcher "py" wurde nicht gefunden.
  echo Bitte Python 3 installieren und erneut ausfuehren.
  exit /b 1
)

for /f "delims=" %%v in ('py -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do set PYVER=%%v

echo [INFO] Verwende Python !PYVER!

if not exist .venv (
  echo [INFO] Erstelle virtuelle Umgebung ...
  py -m venv .venv
  if errorlevel 1 (
    echo [FEHLER] Virtuelle Umgebung konnte nicht erstellt werden.
    exit /b 1
  )
)

call .venv\Scripts\activate
if errorlevel 1 (
  echo [FEHLER] Aktivierung der virtuellen Umgebung fehlgeschlagen.
  exit /b 1
)

echo [INFO] Aktualisiere pip ...
python -m pip install --upgrade pip
if errorlevel 1 (
  echo [FEHLER] pip-Update fehlgeschlagen.
  exit /b 1
)

echo [INFO] Installiere kompatibles PyInstaller ...
python -m pip install "pyinstaller>=6.15,<7"
if errorlevel 1 (
  echo [FEHLER] PyInstaller konnte nicht installiert werden.
  echo Hinweis: Pruefe Internetverbindung, Proxy oder Python-Version.
  exit /b 1
)

echo [INFO] Erstelle EXE ...
python -m PyInstaller --noconfirm --onefile --name Zeiterfassung --add-data "static;static" run_server.py
if errorlevel 1 (
  echo [FEHLER] EXE-Build fehlgeschlagen.
  exit /b 1
)

if not exist dist\Zeiterfassung.exe (
  echo [FEHLER] Build meldete Erfolg, aber dist\Zeiterfassung.exe wurde nicht gefunden.
  exit /b 1
)

echo.
echo [OK] Fertig. Datei: dist\Zeiterfassung.exe
exit /b 0
