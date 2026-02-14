from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
STATIC_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR)) / "static"
DATA_DIR = APP_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "zeiterfassung.db"

VALID_STATUS = {"anwesend", "krank", "urlaub", "frei"}


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS workers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vorname TEXT NOT NULL,
                nachname TEXT NOT NULL,
                position TEXT,
                erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS work_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_id INTEGER NOT NULL,
                datum TEXT NOT NULL,
                startzeit TEXT,
                endzeit TEXT,
                pause_minuten INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                notiz TEXT,
                erstellt_am TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(worker_id) REFERENCES workers(id) ON DELETE CASCADE,
                CHECK(status IN ('anwesend','krank','urlaub','frei'))
            );
            """
        )


def parse_date(value: str) -> str:
    datetime.strptime(value, "%Y-%m-%d")
    return value


def parse_time(value: str | None) -> str | None:
    if not value:
        return None
    datetime.strptime(value, "%H:%M")
    return value


def rows_to_dict(rows: list[sqlite3.Row]) -> list[dict]:
    return [{k: row[k] for k in row.keys()} for row in rows]


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, format: str, *args) -> None:
        return

    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/workers":
            return self.list_workers()
        if parsed.path == "/api/entries":
            return self.list_entries(parsed.query)
        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/workers":
            return self.create_worker()
        if parsed.path == "/api/entries":
            return self.create_entry()
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/workers/"):
            return self.update_worker(parsed.path)
        if parsed.path.startswith("/api/entries/"):
            return self.update_entry(parsed.path)
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/workers/"):
            return self.delete_worker(parsed.path)
        if parsed.path.startswith("/api/entries/"):
            return self.delete_entry(parsed.path)
        self.send_error(HTTPStatus.NOT_FOUND)

    def list_workers(self) -> None:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT id, vorname, nachname, position, erstellt_am FROM workers ORDER BY nachname, vorname"
            ).fetchall()
        self.send_json(rows_to_dict(rows))

    def create_worker(self) -> None:
        data = self.read_json_body()
        vorname = (data.get("vorname") or "").strip()
        nachname = (data.get("nachname") or "").strip()
        position = (data.get("position") or "").strip() or None
        if not vorname or not nachname:
            return self.send_json({"error": "Vorname und Nachname sind erforderlich."}, 400)

        with get_connection() as conn:
            worker_id = conn.execute(
                "INSERT INTO workers(vorname, nachname, position) VALUES (?, ?, ?)",
                (vorname, nachname, position),
            ).lastrowid
            row = conn.execute(
                "SELECT id, vorname, nachname, position, erstellt_am FROM workers WHERE id = ?",
                (worker_id,),
            ).fetchone()
        self.send_json({k: row[k] for k in row.keys()}, 201)

    def update_worker(self, path: str) -> None:
        worker_id = int(path.split("/")[-1])
        data = self.read_json_body()
        vorname = (data.get("vorname") or "").strip()
        nachname = (data.get("nachname") or "").strip()
        position = (data.get("position") or "").strip() or None
        if not vorname or not nachname:
            return self.send_json({"error": "Vorname und Nachname sind erforderlich."}, 400)

        with get_connection() as conn:
            cursor = conn.execute(
                "UPDATE workers SET vorname = ?, nachname = ?, position = ? WHERE id = ?",
                (vorname, nachname, position, worker_id),
            )
            if cursor.rowcount == 0:
                return self.send_json({"error": "Mitarbeiter wurde nicht gefunden."}, 404)
            row = conn.execute(
                "SELECT id, vorname, nachname, position, erstellt_am FROM workers WHERE id = ?",
                (worker_id,),
            ).fetchone()
        self.send_json({k: row[k] for k in row.keys()})

    def delete_worker(self, path: str) -> None:
        worker_id = int(path.split("/")[-1])
        with get_connection() as conn:
            cursor = conn.execute("DELETE FROM workers WHERE id = ?", (worker_id,))
            if cursor.rowcount == 0:
                return self.send_json({"error": "Mitarbeiter wurde nicht gefunden."}, 404)
        self.send_response(204)
        self.end_headers()

    def list_entries(self, query: str) -> None:
        params = parse_qs(query)
        worker_id = params.get("worker_id", [None])[0]
        zeitraum = params.get("zeitraum", ["monat"])[0]
        referenz = params.get("referenz", [None])[0]

        sql = (
            "SELECT e.id, e.worker_id, w.vorname, w.nachname, e.datum, e.startzeit, e.endzeit, "
            "e.pause_minuten, e.status, e.notiz, e.erstellt_am "
            "FROM work_entries e JOIN workers w ON w.id = e.worker_id"
        )
        conditions, args = [], []

        if worker_id:
            conditions.append("e.worker_id = ?")
            args.append(int(worker_id))

        if referenz:
            try:
                if zeitraum == "woche":
                    year, week = referenz.split("-W")
                    conditions.append("strftime('%Y', e.datum) = ? AND strftime('%W', e.datum) = ?")
                    args.extend([year, f"{max(int(week)-1,0):02d}"])
                elif zeitraum == "jahr":
                    int(referenz)
                    conditions.append("strftime('%Y', e.datum) = ?")
                    args.append(referenz)
                else:
                    datetime.strptime(referenz, "%Y-%m")
                    conditions.append("strftime('%Y-%m', e.datum) = ?")
                    args.append(referenz)
            except ValueError:
                return self.send_json({"error": "Ungültige Zeitraumsangabe."}, 400)

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY e.datum DESC, w.nachname, w.vorname"

        with get_connection() as conn:
            rows = conn.execute(sql, args).fetchall()
        self.send_json(rows_to_dict(rows))

    def _validate_entry(self, data: dict):
        try:
            worker_id = int(data.get("worker_id"))
            datum = parse_date(data.get("datum", ""))
            startzeit = parse_time(data.get("startzeit"))
            endzeit = parse_time(data.get("endzeit"))
            pause = int(data.get("pause_minuten") or 0)
            status = (data.get("status") or "").strip().lower()
            notiz = (data.get("notiz") or "").strip() or None
        except (TypeError, ValueError):
            return None, {"error": "Eingaben konnten nicht verarbeitet werden."}

        if status not in VALID_STATUS:
            return None, {"error": "Ungültiger Status."}
        if pause < 0:
            return None, {"error": "Pause darf nicht negativ sein."}
        return {
            "worker_id": worker_id,
            "datum": datum,
            "startzeit": startzeit,
            "endzeit": endzeit,
            "pause": pause,
            "status": status,
            "notiz": notiz,
        }, None

    def create_entry(self) -> None:
        data, error = self._validate_entry(self.read_json_body())
        if error:
            return self.send_json(error, 400)

        with get_connection() as conn:
            if not conn.execute("SELECT id FROM workers WHERE id = ?", (data["worker_id"],)).fetchone():
                return self.send_json({"error": "Mitarbeiter wurde nicht gefunden."}, 404)
            entry_id = conn.execute(
                """
                INSERT INTO work_entries(worker_id, datum, startzeit, endzeit, pause_minuten, status, notiz)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (data["worker_id"], data["datum"], data["startzeit"], data["endzeit"], data["pause"], data["status"], data["notiz"]),
            ).lastrowid
            row = conn.execute(
                "SELECT id, worker_id, datum, startzeit, endzeit, pause_minuten, status, notiz, erstellt_am FROM work_entries WHERE id = ?",
                (entry_id,),
            ).fetchone()
        self.send_json({k: row[k] for k in row.keys()}, 201)

    def update_entry(self, path: str) -> None:
        entry_id = int(path.split("/")[-1])
        data, error = self._validate_entry(self.read_json_body())
        if error:
            return self.send_json(error, 400)

        with get_connection() as conn:
            if not conn.execute("SELECT id FROM workers WHERE id = ?", (data["worker_id"],)).fetchone():
                return self.send_json({"error": "Mitarbeiter wurde nicht gefunden."}, 404)
            cursor = conn.execute(
                """
                UPDATE work_entries
                SET worker_id = ?, datum = ?, startzeit = ?, endzeit = ?, pause_minuten = ?, status = ?, notiz = ?
                WHERE id = ?
                """,
                (data["worker_id"], data["datum"], data["startzeit"], data["endzeit"], data["pause"], data["status"], data["notiz"], entry_id),
            )
            if cursor.rowcount == 0:
                return self.send_json({"error": "Eintrag wurde nicht gefunden."}, 404)
            row = conn.execute(
                "SELECT id, worker_id, datum, startzeit, endzeit, pause_minuten, status, notiz, erstellt_am FROM work_entries WHERE id = ?",
                (entry_id,),
            ).fetchone()
        self.send_json({k: row[k] for k in row.keys()})

    def delete_entry(self, path: str) -> None:
        entry_id = int(path.split("/")[-1])
        with get_connection() as conn:
            cursor = conn.execute("DELETE FROM work_entries WHERE id = ?", (entry_id,))
            if cursor.rowcount == 0:
                return self.send_json({"error": "Eintrag wurde nicht gefunden."}, 404)
        self.send_response(204)
        self.end_headers()


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    init_db()
    server = ThreadingHTTPServer((host, port), AppHandler)
    server.serve_forever()


if __name__ == "__main__":
    run_server(host="0.0.0.0", port=8000)
