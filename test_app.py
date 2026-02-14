import json
import threading
import time
import unittest
from urllib import request

from app import run_server


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.thread = threading.Thread(target=run_server, kwargs={"host": "127.0.0.1", "port": 8123}, daemon=True)
        cls.thread.start()
        time.sleep(1)

    def api(self, path, method="GET", payload=None):
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = request.Request(f"http://127.0.0.1:8123{path}", method=method, data=data, headers=headers)
        with request.urlopen(req) as res:
            body = res.read()
            return res.status, json.loads(body.decode("utf-8")) if body else None

    def test_worker_and_entry_crud(self):
        status, worker = self.api("/api/workers", "POST", {"vorname": "Max", "nachname": "Muster", "position": "Lager"})
        self.assertEqual(status, 201)

        status, workers = self.api("/api/workers")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(workers), 1)

        status, entry = self.api("/api/entries", "POST", {
            "worker_id": worker["id"],
            "datum": "2026-01-15",
            "status": "anwesend",
            "startzeit": "08:00",
            "endzeit": "16:30",
            "pause_minuten": 30,
            "notiz": "Normaler Dienst"
        })
        self.assertEqual(status, 201)

        status, entries = self.api("/api/entries?zeitraum=monat&referenz=2026-01")
        self.assertEqual(status, 200)
        self.assertTrue(any(e["id"] == entry["id"] for e in entries))


if __name__ == "__main__":
    unittest.main()
