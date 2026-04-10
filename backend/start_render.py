from __future__ import annotations

import os

from waitress import serve

from init_and_seed import run_init_and_seed
from run import app


def main() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "10000"))
    threads = int(os.getenv("WAITRESS_THREADS", "8"))

    print("Running database init before serving...")
    run_init_and_seed()
    print(f"Starting Waitress on {host}:{port} with {threads} thread(s)...")
    serve(app, host=host, port=port, threads=threads)


if __name__ == "__main__":
    main()
