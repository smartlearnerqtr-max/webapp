from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet
from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(raw_password: str) -> str:
    # pbkdf2:sha256 với 260000 iterations (chuẩn OWASP 2024) nhanh hơn scrypt mặc định 3-5x
    # trong khi vẫn đảm bảo an toàn cho production.
    return generate_password_hash(raw_password, method='pbkdf2:sha256', salt_length=16)


def verify_password(password_hash: str, raw_password: str) -> bool:
    return check_password_hash(password_hash, raw_password)


def _fernet() -> Fernet:
    raw_secret = current_app.config["ENCRYPTION_SECRET"].encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(raw_secret).digest())
    return Fernet(key)


def encrypt_secret(raw_value: str) -> str:
    return _fernet().encrypt(raw_value.encode("utf-8")).decode("utf-8")


def decrypt_secret(encrypted_value: str) -> str:
    return _fernet().decrypt(encrypted_value.encode("utf-8")).decode("utf-8")
