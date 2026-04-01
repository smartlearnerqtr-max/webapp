from __future__ import annotations

from flask import g, jsonify


def success_response(data: object = None, message: str = "OK", status_code: int = 200):
    return jsonify({
        "success": True,
        "message": message,
        "data": data,
        "request_id": getattr(g, "request_id", None),
    }), status_code


def error_response(message: str, error_code: str, status_code: int = 400, details: object = None):
    payload = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "request_id": getattr(g, "request_id", None),
    }
    if details is not None:
        payload["details"] = details
    return jsonify(payload), status_code
