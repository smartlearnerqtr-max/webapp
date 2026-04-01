from __future__ import annotations

from flask import request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from ....models import User
from ....services.auth_service import build_user_payload, login_user
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1


@api_v1.post("/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    identity = (payload.get("identity") or "").strip()
    password = payload.get("password") or ""
    if not identity or not password:
        return error_response("Vui long nhap identity va password", "VALIDATION_ERROR", 422)
    login_payload = login_user(identity, password)
    if not login_payload:
        log_server_event(level="warning", module="auth", message="Dang nhap that bai", error_code="AUTH_INVALID_CREDENTIALS", action_name="login_failed")
        return error_response("Thong tin dang nhap khong dung", "AUTH_INVALID_CREDENTIALS", 401)
    log_server_event(level="info", module="auth", message="Dang nhap thanh cong", action_name="login_success", user_id=login_payload["user"]["id"])
    return success_response(login_payload, "Dang nhap thanh cong")


@api_v1.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh_access_token():
    user = User.query.get(get_jwt_identity())
    if not user:
        return error_response("Khong tim thay nguoi dung", "USER_NOT_FOUND", 404)
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return success_response({"access_token": token}, "Lam moi token thanh cong")


@api_v1.post("/auth/logout")
@jwt_required()
def logout():
    return success_response(None, "Dang xuat thanh cong")


@api_v1.get("/auth/me")
@jwt_required()
def current_user():
    user = User.query.get(get_jwt_identity())
    if not user:
        return error_response("Khong tim thay nguoi dung", "USER_NOT_FOUND", 404)
    return success_response(build_user_payload(user), "Lay thong tin thanh cong")
