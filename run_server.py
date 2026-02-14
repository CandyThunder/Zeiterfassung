from __future__ import annotations

import threading
import time
import webbrowser

from app import run_server


if __name__ == "__main__":
    def open_browser() -> None:
        time.sleep(1)
        webbrowser.open("http://127.0.0.1:8000")

    threading.Thread(target=open_browser, daemon=True).start()
    run_server(host="127.0.0.1", port=8000)
