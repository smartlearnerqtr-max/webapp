from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "backend" / "instance" / "dev.db"

TEXT_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".html",
    ".md",
    ".txt",
    ".json",
    ".yml",
    ".yaml",
}

SKIP_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".pytest_cache",
    "tmp",
    "test-results",
}

MOJIBAKE_MARKERS = (
    "\u00c3",
    "\u00c2",
    "\u00c4",
    "\u00c6",
    "\u00e1\u00ba",
    "\u00e1\u00bb",
    "\ufffd",
)


def configure_utf8_stdio() -> None:
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def has_mojibake(value: str) -> bool:
    return any(marker in value for marker in MOJIBAKE_MARKERS)


def looks_better(before: str, after: str) -> bool:
    if after == before:
        return False
    before_score = sum(before.count(marker) for marker in MOJIBAKE_MARKERS)
    after_score = sum(after.count(marker) for marker in MOJIBAKE_MARKERS)
    if after_score < before_score:
        return True
    vietnamese_chars = "ăâđêôơưĂÂĐÊÔƠƯ"
    return before_score > 0 and sum(after.count(ch) for ch in vietnamese_chars) > sum(before.count(ch) for ch in vietnamese_chars)


def repair_once(value: str) -> str:
    candidates: list[str] = []
    for source_encoding in ("latin-1", "cp1252"):
        try:
            candidates.append(value.encode(source_encoding).decode("utf-8"))
        except UnicodeError:
            pass
    for candidate in candidates:
        if looks_better(value, candidate):
            return candidate
    return value


def repair_text(value: str) -> str:
    current = value
    for _ in range(3):
        next_value = repair_once(current)
        if next_value == current:
            break
        current = next_value
    return current


def iter_text_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        files.append(path)
    return files


def patch_files(apply: bool) -> tuple[int, int]:
    scanned = 0
    changed = 0
    for path in iter_text_files():
        scanned += 1
        try:
            original = path.read_text(encoding="utf-8")
        except UnicodeError:
            continue
        if not has_mojibake(original):
            continue
        repaired = repair_text(original)
        if repaired == original:
            print(f"[file] still suspicious: {path.relative_to(ROOT)}")
            continue
        changed += 1
        print(f"[file] {'patch' if apply else 'would patch'}: {path.relative_to(ROOT)}")
        if apply:
            path.write_text(repaired, encoding="utf-8", newline="")
    return scanned, changed


def safe_update(cursor: sqlite3.Cursor, table: str, row_id: int, field: str, value: str) -> int:
    cursor.execute(f"SELECT id FROM {table} WHERE id = ?", (row_id,))
    if cursor.fetchone() is None:
        return 0
    cursor.execute(f"UPDATE {table} SET {field} = ? WHERE id = ?", (value, row_id))
    return cursor.rowcount


def patch_known_db_rows(apply: bool) -> int:
    if not DB_PATH.exists():
        print(f"[db] missing: {DB_PATH}")
        return 0

    # These rows were created during local AI/manual tests while PowerShell was
    # using a non-UTF-8 codepage. Strings are unicode-escaped to keep this file
    # safe even when edited from a broken terminal.
    lesson_titles = {
        70: "AI Test To\u00e1n nh\u1eb9 01 - \u0110\u1ebfm qu\u1ea3 t\u00e1o",
        71: "AI Test To\u00e1n nh\u1eb9 02 - H\u00ecnh kh\u1ed1i c\u01a1 b\u1ea3n",
    }
    lesson_descriptions = {
        70: "B\u00e0i test t\u1ea1o b\u1eb1ng AI: \u0111\u1ebfm t\u00e1o v\u00e0 l\u00e0m b\u00e0i to\u00e1n t\u1eebng b\u01b0\u1edbc.",
        71: "B\u00e0i test t\u1ea1o b\u1eb1ng AI: t\u01b0\u01a1ng t\u00e1c 3D h\u00ecnh kh\u1ed1i v\u00e0 gh\u00e9p t\u00ean h\u00ecnh.",
    }
    activity_titles = {
        139: "Nh\u00ecn \u1ea3nh \u0111\u1ebfm qu\u1ea3 t\u00e1o",
        140: "B\u00e0i to\u00e1n Step-by-step v\u1edbi qu\u1ea3 t\u00e1o",
        141: "T\u01b0\u01a1ng t\u00e1c 3D h\u00ecnh kh\u1ed1i",
        142: "N\u1ed1i h\u00ecnh kh\u1ed1i v\u1edbi t\u00ean",
    }
    activity_instructions = {
        139: "H\u1ecdc sinh quan s\u00e1t \u1ea3nh qu\u1ea3 t\u00e1o v\u00e0 ch\u1ecdn s\u1ed1 l\u01b0\u1ee3ng \u0111\u00fang.",
        140: "H\u1ecdc sinh \u0111\u1ecdc \u0111\u1ec1, ch\u1ecdn ph\u00e9p c\u1ed9ng v\u00e0 \u0111i\u1ec1n k\u1ebft qu\u1ea3.",
        141: "H\u1ecdc sinh xoay m\u00f4 h\u00ecnh 3D v\u00e0 nh\u1eadn bi\u1ebft \u0111\u1ec9nh, c\u1ea1nh, m\u1eb7t.",
        142: "H\u1ecdc sinh n\u1ed1i h\u00ecnh kh\u1ed1i v\u1edbi t\u00ean g\u1ecdi ph\u00f9 h\u1ee3p.",
    }

    changed = 0
    with sqlite3.connect(DB_PATH) as connection:
        cursor = connection.cursor()
        for row_id, title in lesson_titles.items():
            print(f"[db] {'patch' if apply else 'would patch'} lesson {row_id}: {title}")
            if apply:
                changed += safe_update(cursor, "lessons", row_id, "title", title)
        for row_id, description in lesson_descriptions.items():
            print(f"[db] {'patch' if apply else 'would patch'} lesson description {row_id}")
            if apply:
                changed += safe_update(cursor, "lessons", row_id, "description", description)
        for row_id, title in activity_titles.items():
            print(f"[db] {'patch' if apply else 'would patch'} activity {row_id}: {title}")
            if apply:
                changed += safe_update(cursor, "lesson_activities", row_id, "title", title)
        for row_id, instruction in activity_instructions.items():
            if apply:
                changed += safe_update(cursor, "lesson_activities", row_id, "instruction_text", instruction)
        if apply:
            connection.commit()
    return changed


def print_shell_help() -> None:
    print("")
    print("Before running scripts with Vietnamese text in PowerShell, use:")
    print("  chcp 65001")
    print("  $env:PYTHONUTF8='1'")
    print("  $env:PYTHONIOENCODING='utf-8'")
    print("")
    print("Safer rule for automation: avoid Vietnamese literals in inline PowerShell;")
    print("use UTF-8 files or unicode escapes instead.")


def main() -> int:
    configure_utf8_stdio()
    parser = argparse.ArgumentParser(description="UTF-8/mojibake patch for this workspace.")
    parser.add_argument("--apply", action="store_true", help="write fixes; default is dry-run")
    parser.add_argument("--files", action="store_true", help="scan and repair text files")
    parser.add_argument("--db", action="store_true", help="patch known local DB rows")
    parser.add_argument("--all", action="store_true", help="run file and DB patchers")
    args = parser.parse_args()

    run_files = args.all or args.files
    run_db = args.all or args.db
    if not run_files and not run_db:
        run_files = True
        run_db = True

    if run_files:
        scanned, changed = patch_files(args.apply)
        print(f"[files] scanned={scanned} changed={changed} mode={'apply' if args.apply else 'dry-run'}")
    if run_db:
        changed = patch_known_db_rows(args.apply)
        print(f"[db] changed={changed} mode={'apply' if args.apply else 'dry-run'}")

    print_shell_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
