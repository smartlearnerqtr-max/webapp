from __future__ import annotations

from datetime import UTC, datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ....extensions import db
from ....models import User, UserAISetting
from ....services.gemini_service import DEFAULT_MODEL, GeminiServiceError, generate_text
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from ....utils.security import decrypt_secret, encrypt_secret
from .. import api_v1


def _mask_key(raw_key: str) -> str:
    return '*' * len(raw_key) if len(raw_key) <= 8 else f"{raw_key[:4]}{'*' * (len(raw_key) - 8)}{raw_key[-4:]}"


def _current_user() -> User | None:
    return User.query.get(get_jwt_identity())


def _get_setting_for_user(user_id: int) -> UserAISetting | None:
    return UserAISetting.query.filter_by(user_id=user_id, provider='gemini').first()


def _persist_setting_status(setting: UserAISetting, *, status: str, error_message: str | None = None, validated: bool = False) -> None:
    setting.status = status
    setting.last_error_message = error_message
    if validated:
        setting.last_validated_at = datetime.now(UTC).isoformat()
    db.session.commit()


@api_v1.get('/ai/settings')
@jwt_required()
def get_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    setting = _get_setting_for_user(user.id)
    return success_response(setting.to_dict() if setting else None)


@api_v1.put('/ai/settings')
@jwt_required()
def save_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    payload = request.get_json(silent=True) or {}
    api_key = (payload.get('api_key') or '').strip()
    model_name = (payload.get('model_name') or DEFAULT_MODEL).strip()
    if not api_key:
        return error_response('API key khong duoc de trong', 'VALIDATION_ERROR', 422)
    setting = _get_setting_for_user(user.id)
    if not setting:
        setting = UserAISetting(user_id=user.id, provider='gemini', api_key_encrypted=encrypt_secret(api_key), api_key_masked=_mask_key(api_key))
        db.session.add(setting)
    setting.model_name = model_name
    setting.api_key_encrypted = encrypt_secret(api_key)
    setting.api_key_masked = _mask_key(api_key)
    setting.status = 'active'
    setting.last_error_message = None
    db.session.commit()
    log_server_event(level='info', module='ai_settings', message='Luu Gemini API settings', action_name='save_ai_settings', user_id=user.id, metadata={'provider': setting.provider, 'model_name': setting.model_name})
    return success_response(setting.to_dict(), 'Luu cai dat AI thanh cong')


@api_v1.post('/ai/settings/test')
@jwt_required()
def test_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    setting = _get_setting_for_user(user.id)
    if not setting:
        return error_response('Chua cau hinh Gemini API key', 'GEMINI_KEY_MISSING', 404)

    try:
        result = generate_text(
            api_key=decrypt_secret(setting.api_key_encrypted),
            model_name=setting.model_name,
            message='Hay tra loi chinh xac mot tu: OK',
            context={'target_role': user.role},
        )
    except GeminiServiceError as exc:
        _persist_setting_status(setting, status='invalid', error_message=exc.message, validated=True)
        log_server_event(level='error', module='ai_settings', message='Test Gemini settings that bai', error_code=exc.error_code, action_name='test_ai_settings_failed', user_id=user.id, metadata={'status': exc.status_code, 'details': exc.details, 'model_name': setting.model_name})
        return error_response(exc.message, exc.error_code, exc.status_code, exc.details)

    _persist_setting_status(setting, status='active', error_message=None, validated=True)
    log_server_event(level='info', module='ai_settings', message='Test Gemini settings thanh cong', action_name='test_ai_settings', user_id=user.id, metadata={'status': setting.status, 'model_name': setting.model_name})
    return success_response({'status': setting.status, 'provider': setting.provider, 'model_name': setting.model_name, 'last_validated_at': setting.last_validated_at, 'sample_response': result.text}, 'Da kiem tra cau hinh Gemini')


@api_v1.post('/ai/chat')
@jwt_required()
def chat_with_ai():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    setting = _get_setting_for_user(user.id)
    if not setting:
        return error_response('Chua cau hinh Gemini API key', 'GEMINI_KEY_MISSING', 404)

    payload = request.get_json(silent=True) or {}
    message = (payload.get('message') or '').strip()
    if not message:
        return error_response('Noi dung cau hoi khong duoc de trong', 'VALIDATION_ERROR', 422)

    context = payload.get('context') or {}
    context.setdefault('target_role', user.role)

    try:
        result = generate_text(
            api_key=decrypt_secret(setting.api_key_encrypted),
            model_name=setting.model_name,
            message=message,
            context=context,
        )
    except GeminiServiceError as exc:
        setting.status = 'invalid' if exc.error_code == 'GEMINI_AUTH_ERROR' else setting.status
        setting.last_error_message = exc.message
        db.session.commit()
        log_server_event(level='error', module='ai_chat', message='Goi Gemini that bai', error_code=exc.error_code, action_name='ai_chat_failed', user_id=user.id, metadata={'status': exc.status_code, 'details': exc.details, 'model_name': setting.model_name})
        return error_response(exc.message, exc.error_code, exc.status_code, exc.details)

    setting.status = 'active'
    setting.last_error_message = None
    db.session.commit()
    log_server_event(level='info', module='ai_chat', message='Goi Gemini thanh cong', action_name='ai_chat_success', user_id=user.id, metadata={'model_name': setting.model_name})
    return success_response({'text': result.text, 'model_name': result.model_name, 'usage_metadata': result.usage_metadata, 'prompt_feedback': result.prompt_feedback}, 'Lay phan hoi AI thanh cong')


@api_v1.delete('/ai/settings')
@jwt_required()
def delete_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    setting = _get_setting_for_user(user.id)
    if not setting:
        return success_response(None, 'Khong co cau hinh de xoa')
    db.session.delete(setting)
    db.session.commit()
    return success_response(None, 'Da xoa cau hinh AI')
