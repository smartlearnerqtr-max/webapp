from __future__ import annotations

import argparse
import os
from pathlib import Path

from sqlalchemy import MetaData, create_engine, select, text

from app import models  # noqa: F401  # Register model metadata before create_all.
from app.config import _normalize_database_url
from app.extensions import db

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SOURCE_URL = f"sqlite:///{(BASE_DIR / 'instance' / 'dev.db').resolve().as_posix()}"
SKIP_TABLES = {"alembic_version"}


def _resolve_database_url(raw_url: str | None, fallback: str | None = None) -> str:
    candidate = (raw_url or fallback or "").strip()
    if not candidate:
        raise ValueError("Missing database URL.")
    return _normalize_database_url(candidate)


def _build_engine(url: str):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite:///") else {}
    return create_engine(url, future=True, connect_args=connect_args)


def _is_integer_primary_key(column) -> bool:
    try:
        return column.type.python_type is int
    except (AttributeError, NotImplementedError):
        return False


def _qualified_table_name(table) -> str:
    return f"{table.schema}.{table.name}" if table.schema else table.name


def _reset_postgres_sequences(connection, tables: list) -> None:
    for table in tables:
        primary_key_columns = list(table.primary_key.columns)
        if len(primary_key_columns) != 1:
            continue

        primary_key = primary_key_columns[0]
        if not _is_integer_primary_key(primary_key):
            continue

        max_value = connection.execute(select(primary_key).order_by(primary_key.desc()).limit(1)).scalar()
        table_name = _qualified_table_name(table)
        params = {"table_name": table_name, "column_name": primary_key.name}

        if max_value is None:
            connection.execute(
                text("SELECT setval(pg_get_serial_sequence(:table_name, :column_name), 1, false)"),
                params,
            )
            continue

        connection.execute(
            text("SELECT setval(pg_get_serial_sequence(:table_name, :column_name), :value, true)"),
            {**params, "value": int(max_value)},
        )


def _copy_table_rows(source_connection, target_connection, source_table, target_table) -> int:
    shared_columns = [column.name for column in target_table.columns if column.name in source_table.columns]
    if not shared_columns:
        return 0

    source_rows = source_connection.execute(
        select(*[source_table.c[column_name] for column_name in shared_columns])
    ).mappings().all()

    if not source_rows:
        return 0

    payload = [{column_name: row[column_name] for column_name in shared_columns} for row in source_rows]
    target_connection.execute(target_table.insert(), payload)
    return len(payload)


def sync_databases(source_url: str, target_url: str) -> list[tuple[str, int]]:
    if source_url == target_url:
        raise ValueError("Source database and target database must be different.")

    source_engine = _build_engine(source_url)
    target_engine = _build_engine(target_url)

    try:
        db.metadata.create_all(bind=target_engine)

        source_metadata = MetaData()
        source_metadata.reflect(bind=source_engine)

        target_metadata = MetaData()
        target_metadata.reflect(bind=target_engine)

        ordered_target_tables = [
            table
            for table in target_metadata.sorted_tables
            if table.name not in SKIP_TABLES and table.name in source_metadata.tables
        ]

        if not ordered_target_tables:
            raise RuntimeError("No shared tables found between source and target databases.")

        copied_counts: list[tuple[str, int]] = []

        with source_engine.connect() as source_connection, target_engine.begin() as target_connection:
            for table in reversed(ordered_target_tables):
                target_connection.execute(table.delete())

            for target_table in ordered_target_tables:
                source_table = source_metadata.tables[target_table.name]
                copied = _copy_table_rows(source_connection, target_connection, source_table, target_table)
                copied_counts.append((target_table.name, copied))

            if target_engine.dialect.name == "postgresql":
                _reset_postgres_sequences(target_connection, ordered_target_tables)

        return copied_counts
    finally:
        source_engine.dispose()
        target_engine.dispose()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Copy the current local SQLite data set into another database, such as Render Postgres."
    )
    parser.add_argument(
        "--source-url",
        default=os.getenv("SOURCE_DATABASE_URL") or DEFAULT_SOURCE_URL,
        help="Source database URL. Defaults to backend/instance/dev.db.",
    )
    parser.add_argument(
        "--target-url",
        default=os.getenv("TARGET_DATABASE_URL"),
        help="Target database URL. You can also provide TARGET_DATABASE_URL in the environment.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    source_url = _resolve_database_url(args.source_url, DEFAULT_SOURCE_URL)
    target_url = _resolve_database_url(args.target_url)

    print(f"Source DB: {source_url}")
    print(f"Target DB: {target_url}")
    copied_counts = sync_databases(source_url, target_url)

    total_rows = sum(row_count for _, row_count in copied_counts)
    print("Sync completed successfully.")
    for table_name, row_count in copied_counts:
        print(f"  - {table_name}: {row_count} row(s)")
    print(f"Total rows copied: {total_rows}")


if __name__ == "__main__":
    main()
