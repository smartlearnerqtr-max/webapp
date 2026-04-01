from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib import error, request

GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_MODEL = 'gemini-2.5-flash'


class GeminiServiceError(Exception):
    def __init__(self, message: str, error_code: str, status_code: int = 400, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}


@dataclass
class GeminiResult:
    text: str
    model_name: str
    prompt_feedback: dict[str, Any] | None
    usage_metadata: dict[str, Any] | None
    raw_response: dict[str, Any]


def build_learning_prompt(message: str, context: dict[str, Any] | None = None) -> tuple[str, str]:
    context = context or {}
    target_role = context.get('target_role') or 'student'
    disability_level = context.get('disability_level') or 'trung_binh'
    lesson_title = context.get('lesson_title') or 'khong ro bai hoc'
    subject_name = context.get('subject_name') or 'khong ro mon hoc'
    activity_type = context.get('activity_type') or 'tuong tac tu do'

    system_prompt = (
        'Ban la tro ly hoc tap cho webapp Ban hoc thong minh. '
        'Hay tra loi ngan gon, de hieu, than thien, uu tien cau ngan va tu ng? don gian. '
        'Neu nguoi dung la hoc sinh khuyet tat, hay chia nho huong dan thanh tung buoc ngan, '
        'khong dung cau qua dai va khong dua nhieu lua chon phuc tap cung luc.'
    )

    user_prompt = (
        f'Vai tro nguoi nhan ho tro: {target_role}.\n'
        f'Muc do ho tro chinh: {disability_level}.\n'
        f'Mon hoc: {subject_name}.\n'
        f'Bai hoc: {lesson_title}.\n'
        f'Loai hoat dong: {activity_type}.\n'
        'Yeu cau: neu la giai thich bai hoc thi can ro rang, co vi du ngan; '
        'neu la nhac nho hoc sinh thi giu giong dong vien.\n\n'
        f'Tin nhan nguoi dung: {message.strip()}'
    )
    return system_prompt, user_prompt


def _extract_text(response_payload: dict[str, Any]) -> str:
    candidates = response_payload.get('candidates') or []
    for candidate in candidates:
        content = candidate.get('content') or {}
        parts = content.get('parts') or []
        text_parts = [part.get('text', '').strip() for part in parts if part.get('text')]
        combined = '\n'.join(part for part in text_parts if part)
        if combined:
            return combined
    raise GeminiServiceError('Gemini khong tra ve noi dung text hop le', 'GEMINI_EMPTY_RESPONSE', 502, response_payload)


def generate_text(*, api_key: str, model_name: str, message: str, context: dict[str, Any] | None = None, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> GeminiResult:
    if not api_key.strip():
        raise GeminiServiceError('Gemini API key khong hop le', 'GEMINI_KEY_INVALID', 422)
    if not message.strip():
        raise GeminiServiceError('Noi dung gui Gemini khong duoc de trong', 'VALIDATION_ERROR', 422)

    system_prompt, user_prompt = build_learning_prompt(message, context)
    payload = {
        'system_instruction': {
            'parts': [{'text': system_prompt}],
        },
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': user_prompt}],
            }
        ],
        'generationConfig': {
            'temperature': 0.4,
            'maxOutputTokens': 512,
        },
    }

    req = request.Request(
        url=f'{GEMINI_API_BASE_URL}/models/{model_name}:generateContent',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': api_key,
        },
        method='POST',
    )

    try:
        with request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode('utf-8')
            response_payload = json.loads(body)
    except error.HTTPError as exc:
        raw_body = exc.read().decode('utf-8', errors='ignore') if hasattr(exc, 'read') else ''
        details: dict[str, Any] = {'status': exc.code, 'body': raw_body[:1000]}
        message_text = 'Gemini tra ve loi khong xac dinh'
        try:
            parsed = json.loads(raw_body) if raw_body else {}
            api_error = parsed.get('error') or {}
            if api_error.get('message'):
                message_text = str(api_error['message'])
                details['api_error'] = api_error
        except json.JSONDecodeError:
            pass
        error_code = 'GEMINI_AUTH_ERROR' if exc.code in {401, 403} else 'GEMINI_API_ERROR'
        raise GeminiServiceError(message_text, error_code, exc.code, details) from exc
    except error.URLError as exc:
        raise GeminiServiceError('Khong the ket noi Gemini API', 'GEMINI_NETWORK_ERROR', 502, {'reason': str(exc.reason)}) from exc

    text = _extract_text(response_payload)
    return GeminiResult(
        text=text,
        model_name=model_name,
        prompt_feedback=response_payload.get('promptFeedback'),
        usage_metadata=response_payload.get('usageMetadata'),
        raw_response=response_payload,
    )
