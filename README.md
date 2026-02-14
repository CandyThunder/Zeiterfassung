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
- **Soll-Stunden je Mitarbeiter** (Wochenziel) inkl. Vergleich in der Auswertung
- **Keine Buchung in der Zukunft** (Frontend + Backend-Validierung)
- **Wöchentliche Ansicht korrigiert** (ISO-Kalenderwoche)

## Muss Python installiert sein?

**Für Endnutzer: nein.**

Sobald `Zeiterfassung.exe` gebaut wurde, kann die App auf einem Windows-PC per Doppelklick gestartet werden, ohne Python-Installation.

**Für das Erzeugen der EXE lokal:** ja (oder alternativ GitHub Actions nutzen, siehe unten).

## EXE ohne lokale Python-Installation bauen (empfohlen)

Dieses Repository enthält einen GitHub-Workflow:
- `.github/workflows/build-windows-exe.yml`

So geht's:
1. Repository auf GitHub pushen.
2. In GitHub unter **Actions → Build Windows EXE** den Workflow starten.
3. Nach erfolgreichem Lauf das Artifact **`Zeiterfassung-windows-exe`** herunterladen.
4. Enthaltene `Zeiterfassung.exe` per Doppelklick ausführen.

Damit musst du lokal kein Python/PyInstaller installieren.

## Entwicklung lokal starten

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python app.py
```

Dann im Browser öffnen: `http://127.0.0.1:8000`

## Windows EXE lokal bauen (falls gewünscht)

1. Auf Windows `build_windows_exe.bat` per Doppelklick starten.
2. Das Skript installiert automatisch ein **kompatibles PyInstaller** (`>=6.15,<7`) für die lokal installierte Python-Version.
3. Bei Erfolg liegt die fertige Datei in `dist\Zeiterfassung.exe`.

Das Build-Skript bricht bei Fehlern mit klaren Meldungen ab und meldet nur Erfolg, wenn `dist\Zeiterfassung.exe` wirklich existiert.

## Projektstruktur

- `app.py`: Python-Backend (Standardbibliothek) + SQL-API + DB-Initialisierung
- `run_server.py`: EXE-Startpunkt (lokaler Server + Browserstart)
- `static/index.html`: UI
- `static/styles.css`: modernes Styling
- `static/app.js`: Frontend-Logik (CRUD + Filter + Auswertung)
- `build_windows_exe.bat`: Build-Skript für portable Windows-EXE (lokal)
- `.github/workflows/build-windows-exe.yml`: CI-Build für Windows-EXE ohne lokale Python-Installation
