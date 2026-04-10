from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

from sqlalchemy.exc import OperationalError

from app import create_app
from app.extensions import db
from app.services.seed_service import seed_admin_user, seed_subjects, seed_visual_support_demo_bundle

app = create_app()
BASE_DIR = Path(__file__).resolve().parent


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _maybe_seed_persona_data() -> None:
    if not _bool_env("SEED_PERSONA_DATA", False):
        return

    command = [sys.executable, "local_persona_seed.py"]
    if _bool_env("SEED_PERSONA_RESET_NON_ADMIN", True):
        command.append("--reset-non-admin")

    print("SEED_PERSONA_DATA is enabled. Running persona seed...")
    subprocess.run(command, check=True, cwd=BASE_DIR)
    print("Persona seed completed.")


def _maybe_seed_visual_support_demo() -> None:
    if not _bool_env("SEED_VISUAL_SUPPORT_DEMO", False):
        return

    print("SEED_VISUAL_SUPPORT_DEMO is enabled. Seeding visual support demo bundle...")
    with app.app_context():
        payload = seed_visual_support_demo_bundle()
    print("Visual support demo completed.")
    print(f"Teacher demo: {payload['teacher_email']} / {payload['teacher_password']}")
    print(f"Student demo: {payload['student_email']} / {payload['student_password']}")
    print(f"Class: {payload['class_name']} / join password: {payload['class_password']}")


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

            _maybe_seed_persona_data()
            _maybe_seed_visual_support_demo()
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
