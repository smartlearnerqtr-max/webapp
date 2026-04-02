from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR / 'app' / '.env')


def _sqlite_database_url(path_value: str) -> str:
    candidate = Path(path_value)
    if not candidate.is_absolute():
        candidate = BASE_DIR / candidate
    return f"sqlite:///{candidate.resolve().as_posix()}"


def _normalize_database_url(raw_url: str | None) -> str:
    if not raw_url:
        return _sqlite_database_url('instance/dev.db')
    if raw_url.startswith('postgres://'):
        return raw_url.replace('postgres://', 'postgresql+psycopg://', 1)
    if raw_url.startswith('postgresql://') and '+psycopg' not in raw_url:
        return raw_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    if raw_url.startswith('sqlite:///') and raw_url != 'sqlite:///:memory:':
        return _sqlite_database_url(raw_url.removeprefix('sqlite:///'))
    return raw_url


def _parse_cors_origins(raw_value: str | None) -> list[str]:
    if not raw_value:
        return ['http://localhost:5173']
    return [item.strip() for item in raw_value.split(',') if item.strip()]


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'change-me-to-a-very-long-secret-string')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'change-me-to-a-very-long-jwt-secret')
    ENCRYPTION_SECRET = os.getenv('ENCRYPTION_SECRET', 'change-me-to-a-very-long-encryption-secret')
    SQLALCHEMY_DATABASE_URI = _normalize_database_url(os.getenv('DATABASE_URL'))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    CORS_ORIGINS = _parse_cors_origins(os.getenv('CORS_ORIGINS', 'http://localhost:5173'))
    API_TITLE = 'Ban hoc thong minh API'


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite+pysqlite:///:memory:'


class ProductionConfig(Config):
    DEBUG = False


CONFIG_MAP = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
}


def get_config(name: str | None = None) -> type[Config]:
    env_name = name or os.getenv('FLASK_ENV', 'development')
    return CONFIG_MAP.get(env_name, DevelopmentConfig)
