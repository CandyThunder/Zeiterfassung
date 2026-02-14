# Zeiterfassung (Desktop-fähige Web-App)

Moderne Anwendung zur Verwaltung von:
- Mitarbeitern
- Arbeitszeiten (Anwesend, Krank, Urlaub, Frei)

## Funktionen

- **Mitarbeiterverwaltung**: Anlegen, Bearbeiten, Löschen, Anzeigen
- **Zeiterfassung**: Anlegen, Bearbeiten, Löschen, Anzeigen
- **Filter & Zeitansicht**:
  - Nach Mitarbeiter filtern
  - Auswertung nach Kalenderwoche, Monat oder Jahr
- **Lokale Speicherung** in **SQLite** (`data/zeiterfassung.db`)
- **Komplette Oberfläche auf Deutsch**

## Entwicklung starten

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Dann im Browser öffnen: `http://127.0.0.1:8000`

## Windows EXE (Doppelklick)

1. Auf Windows `build_windows_exe.bat` per Doppelklick starten.
2. Die fertige Datei liegt in `dist\Zeiterfassung.exe`.
3. `Zeiterfassung.exe` per Doppelklick starten.

Die EXE startet lokal den Server und öffnet automatisch den Browser.
Daten werden lokal in einem `data`-Ordner neben der EXE gespeichert.

## Projektstruktur

- `app.py`: Python-Backend (Standardbibliothek) + SQL-API + DB-Initialisierung
- `run_server.py`: EXE-Startpunkt (lokaler Server + Browserstart)
- `static/index.html`: UI
- `static/styles.css`: modernes Styling
- `static/app.js`: Frontend-Logik (CRUD + Filter + Auswertung)
- `build_windows_exe.bat`: Build-Skript für portable Windows-EXE
