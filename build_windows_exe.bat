@echo off
setlocal

if not exist .venv (
  py -m venv .venv
)

call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install pyinstaller==6.10.0

pyinstaller --noconfirm --onefile --name Zeiterfassung --add-data "static;static" run_server.py

echo.
echo Fertig. Die Datei liegt unter dist\Zeiterfassung.exe
pause
