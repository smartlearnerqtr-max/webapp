from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from typing import Any
from urllib import error, request

GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_MODEL = 'gemini-2.5-flash'
_gemini_key_round_robin_index = 0
_gemini_key_round_robin_lock = threading.Lock()


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
        'Hay tra loi ngan gon, de hieu, than thien, uu tien cau ngan va tu ngữ don gian. '
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


def _normalize_api_keys(api_key: str | None, api_keys: list[str] | tuple[str, ...] | None) -> list[str]:
    normalized_keys: list[str] = []

    if api_key and api_key.strip():
        normalized_keys.append(api_key.strip())

    for candidate in api_keys or []:
        normalized_candidate = candidate.strip()
        if normalized_candidate:
            normalized_keys.append(normalized_candidate)

    deduped_keys: list[str] = []
    seen: set[str] = set()
    for candidate in normalized_keys:
        if candidate in seen:
            continue
        seen.add(candidate)
        deduped_keys.append(candidate)
    return deduped_keys


def _get_rotated_key_entries(api_keys: list[str]) -> list[tuple[int, str]]:
    if not api_keys:
        return []

    with _gemini_key_round_robin_lock:
        start_index = _gemini_key_round_robin_index % len(api_keys)

    indexed_keys = list(enumerate(api_keys))
    return indexed_keys[start_index:] + indexed_keys[:start_index]


def _mark_next_round_robin_start(success_index: int, total_keys: int) -> None:
    global _gemini_key_round_robin_index

    if total_keys <= 0:
        return

    with _gemini_key_round_robin_lock:
        _gemini_key_round_robin_index = (success_index + 1) % total_keys


def _should_rotate_to_next_key(exc: GeminiServiceError) -> bool:
    if exc.error_code in {'GEMINI_RATE_LIMIT', 'GEMINI_AUTH_ERROR'}:
        return True
    return False


def _build_payload(*, system_prompt: str, user_prompt: str, temperature: float = 0.4, max_output_tokens: int = 512) -> dict[str, Any]:
    return {
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
            'temperature': temperature,
            'maxOutputTokens': max_output_tokens,
        },
    }


def _generate_payload_once(*, api_key: str, model_name: str, payload: dict[str, Any], timeout: int = DEFAULT_TIMEOUT_SECONDS) -> GeminiResult:
    if not api_key.strip():
        raise GeminiServiceError('Gemini API key khong hop le', 'GEMINI_KEY_INVALID', 422)

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
        normalized_message = message_text.lower()
        if exc.code in {401, 403}:
            error_code = 'GEMINI_AUTH_ERROR'
        elif exc.code == 429 or 'quota' in normalized_message or 'rate limit' in normalized_message or 'resource has been exhausted' in normalized_message:
            error_code = 'GEMINI_RATE_LIMIT'
        else:
            error_code = 'GEMINI_API_ERROR'
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


def _generate_payload(
    *,
    api_key: str | None = None,
    api_keys: list[str] | tuple[str, ...] | None = None,
    model_name: str,
    payload: dict[str, Any],
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> GeminiResult:
    resolved_api_keys = _normalize_api_keys(api_key, api_keys)
    if not resolved_api_keys:
        raise GeminiServiceError('Gemini API key khong hop le', 'GEMINI_KEY_INVALID', 422)

    last_error: GeminiServiceError | None = None
    rotated_key_entries = _get_rotated_key_entries(resolved_api_keys)

    for key_index, resolved_api_key in rotated_key_entries:
        try:
            result = _generate_payload_once(
                api_key=resolved_api_key,
                model_name=model_name,
                payload=payload,
                timeout=timeout,
            )
            _mark_next_round_robin_start(key_index, len(resolved_api_keys))
            return result
        except GeminiServiceError as exc:
            last_error = exc
            if len(resolved_api_keys) == 1 or not _should_rotate_to_next_key(exc):
                raise
            continue

    if last_error is not None:
        raise last_error

    raise GeminiServiceError('Khong the tao phan hoi tu Gemini', 'GEMINI_API_ERROR', 502)


def generate_text(
    *,
    api_key: str | None = None,
    api_keys: list[str] | tuple[str, ...] | None = None,
    model_name: str,
    message: str,
    context: dict[str, Any] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> GeminiResult:
    if not message.strip():
        raise GeminiServiceError('Noi dung gui Gemini khong duoc de trong', 'VALIDATION_ERROR', 422)

    system_prompt, user_prompt = build_learning_prompt(message, context)
    payload = _build_payload(system_prompt=system_prompt, user_prompt=user_prompt)
    return _generate_payload(
        api_key=api_key,
        api_keys=api_keys,
        model_name=model_name,
        payload=payload,
        timeout=timeout,
    )


def generate_text_with_prompts(
    *,
    api_key: str | None = None,
    api_keys: list[str] | tuple[str, ...] | None = None,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    temperature: float = 0.2,
    max_output_tokens: int = 512,
) -> GeminiResult:
    if not system_prompt.strip() or not user_prompt.strip():
        raise GeminiServiceError('Prompt gui Gemini khong hop le', 'VALIDATION_ERROR', 422)

    payload = _build_payload(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    return _generate_payload(
        api_key=api_key,
        api_keys=api_keys,
        model_name=model_name,
        payload=payload,
        timeout=timeout,
    )
