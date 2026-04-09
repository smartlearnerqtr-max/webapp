from __future__ import annotations

from flask import current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ....models import User
from ....services.gemini_service import DEFAULT_MODEL, GeminiServiceError, generate_text
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1


def _mask_key(raw_key: str) -> str:
    return '*' * len(raw_key) if len(raw_key) <= 8 else f"{raw_key[:4]}{'*' * (len(raw_key) - 8)}{raw_key[-4:]}"


def _current_user() -> User | None:
    return User.query.get(get_jwt_identity())


def _configured_model_name() -> str:
    return (current_app.config.get('GEMINI_MODEL_NAME') or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _configured_api_keys() -> list[str]:
    return list(current_app.config.get('GEMINI_API_KEYS') or [])


def _build_ai_settings_payload() -> dict[str, object]:
    api_keys = _configured_api_keys()
    key_count = len(api_keys)

    if not api_keys:
        api_key_masked = 'Chua cau hinh trong .env'
    elif key_count == 1:
        api_key_masked = _mask_key(api_keys[0])
    else:
        api_key_masked = f'{key_count} API key dang duoc quan ly trong .env'

    return {
        'provider': 'gemini',
        'model_name': _configured_model_name(),
        'api_key_masked': api_key_masked,
        'status': 'configured' if key_count else 'missing',
        'last_validated_at': None,
        'last_error_message': None,
        'configured_source': 'server_env',
        'key_count': key_count,
        'rotation_enabled': key_count > 1,
    }


@api_v1.get('/ai/settings')
@jwt_required()
def get_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    return success_response(_build_ai_settings_payload())


@api_v1.put('/ai/settings')
@jwt_required()
def save_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    return error_response('API key duoc quan ly tai server .env, khong cho phep sua tu giao dien', 'AI_SETTINGS_READ_ONLY', 405)


@api_v1.post('/ai/settings/test')
@jwt_required()
def test_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)

    api_keys = _configured_api_keys()
    if not api_keys:
        return error_response('Chua cau hinh Gemini API key trong .env', 'GEMINI_KEY_MISSING', 404)

    model_name = _configured_model_name()

    try:
        result = generate_text(
            api_keys=api_keys,
            model_name=model_name,
            message='Hay tra loi chinh xac mot tu: OK',
            context={'target_role': user.role},
        )
    except GeminiServiceError as exc:
        log_server_event(
            level='error',
            module='ai_settings',
            message='Test Gemini settings that bai',
            error_code=exc.error_code,
            action_name='test_ai_settings_failed',
            user_id=user.id,
            metadata={'status': exc.status_code, 'details': exc.details, 'model_name': model_name, 'key_count': len(api_keys)},
        )
        return error_response(exc.message, exc.error_code, exc.status_code, exc.details)

    log_server_event(
        level='info',
        module='ai_settings',
        message='Test Gemini settings thanh cong',
        action_name='test_ai_settings',
        user_id=user.id,
        metadata={'model_name': result.model_name, 'key_count': len(api_keys), 'rotation_enabled': len(api_keys) > 1},
    )
    return success_response(
        {
            'status': 'configured',
            'provider': 'gemini',
            'model_name': result.model_name,
            'last_validated_at': None,
            'sample_response': result.text,
            'key_count': len(api_keys),
            'rotation_enabled': len(api_keys) > 1,
        },
        'Da kiem tra cau hinh Gemini',
    )


@api_v1.post('/ai/chat')
@jwt_required()
def chat_with_ai():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)

    api_keys = _configured_api_keys()
    if not api_keys:
        return error_response('Chua cau hinh Gemini API key trong .env', 'GEMINI_KEY_MISSING', 404)

    payload = request.get_json(silent=True) or {}
    message = (payload.get('message') or '').strip()
    if not message:
        return error_response('Noi dung cau hoi khong duoc de trong', 'VALIDATION_ERROR', 422)

    context = payload.get('context') or {}
    context.setdefault('target_role', user.role)
    model_name = _configured_model_name()

    try:
        result = generate_text(
            api_keys=api_keys,
            model_name=model_name,
            message=message,
            context=context,
        )
    except GeminiServiceError as exc:
        log_server_event(
            level='error',
            module='ai_chat',
            message='Goi Gemini that bai',
            error_code=exc.error_code,
            action_name='ai_chat_failed',
            user_id=user.id,
            metadata={'status': exc.status_code, 'details': exc.details, 'model_name': model_name, 'key_count': len(api_keys)},
        )
        return error_response(exc.message, exc.error_code, exc.status_code, exc.details)

    log_server_event(
        level='info',
        module='ai_chat',
        message='Goi Gemini thanh cong',
        action_name='ai_chat_success',
        user_id=user.id,
        metadata={'model_name': result.model_name, 'key_count': len(api_keys), 'rotation_enabled': len(api_keys) > 1},
    )
    return success_response(
        {
            'text': result.text,
            'model_name': result.model_name,
            'usage_metadata': result.usage_metadata,
            'prompt_feedback': result.prompt_feedback,
        },
        'Lay phan hoi AI thanh cong',
    )


@api_v1.delete('/ai/settings')
@jwt_required()
def delete_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    return error_response('API key duoc quan ly tai server .env, khong cho phep xoa tu giao dien', 'AI_SETTINGS_READ_ONLY', 405)
