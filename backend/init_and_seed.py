from __future__ import annotations

import os
import time

from sqlalchemy.exc import OperationalError

from app import create_app
from app.extensions import db
from app.services.seed_service import seed_admin_user, seed_subjects

app = create_app()


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def run_init_and_seed() -> None:
    max_attempts = _int_env("DB_INIT_MAX_ATTEMPTS", 10)
    retry_delay = _int_env("DB_INIT_RETRY_DELAY_SECONDS", 3)

    for attempt in range(1, max_attempts + 1):
        try:
            with app.app_context():
                print(f"Preparing database (attempt {attempt}/{max_attempts})...")
                db.create_all()
                subjects_created = seed_subjects()
                admin = seed_admin_user()
                print("Database ready.")
                print(f"Subjects created: {subjects_created}")
                print(f"Admin ready: {admin.email}")
                return
        except OperationalError as error:
            if attempt == max_attempts:
                print("Database init failed after all retry attempts.")
                raise
            print(f"Database not ready yet: {error}")
            print(f"Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)


if __name__ == "__main__":
    run_init_and_seed()
