from __future__ import annotations

import json
import threading
import base64
import re
import time
import wave
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from urllib import error, request

GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_TTS_TIMEOUT_SECONDS = 60
DEFAULT_MODEL = 'gemini-2.5-flash'
DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts'
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


@dataclass
class GeminiAudioResult:
    audio_bytes: bytes
    mime_type: str
    model_name: str
    raw_response: dict[str, Any]


def build_learning_prompt(message: str, context: dict[str, Any] | None = None) -> tuple[str, str]:
    context = context or {}
    target_role = context.get('target_role') or 'student'
    disability_level = context.get('disability_level') or 'trung_binh'
    lesson_title = context.get('lesson_title') or 'không rõ bài học'
    subject_name = context.get('subject_name') or 'không rõ môn học'
    activity_type = context.get('activity_type') or 'tương tác tự do'

    system_prompt = (
        'Bạn là trợ lý học tập cho webapp Bạn học thông minh. '
        'Hãy trả lời ngắn gọn, dễ hiểu, thân thiện, ưu tiên câu ngắn và từ ngữ đơn giản. '
        'Nếu người dùng là học sinh khuyết tật, hãy chia nhỏ hướng dẫn thành từng bước ngắn, '
        'không dùng câu quá dài và không đưa nhiều lựa chọn phức tạp cùng lúc.'
    )

    if activity_type == 'career_guidance_voice':
        system_prompt += (
            ' Riêng với hướng nghiệp bằng giọng nói: chỉ trả lời như đang nói chuyện, '
            'mỗi lần tối đa 2 câu rất ngắn, tổng độ dài ưu tiên dưới 24 từ. '
            'Câu đầu đưa ra 1 gợi ý rõ ràng. Câu sau chỉ hỏi tiếp 1 ý ngắn để hiểu sở thích của học sinh. '
            'Gợi ý nghề nghiệp an toàn, gần với sở thích và khả năng, không đưa kết luận tuyệt đối. '
            'Tuyệt đối chỉ dùng tiếng Việt tự nhiên, không chèn tiếng Anh, không viết song ngữ, '
            'không dùng ký hiệu đặc biệt và không dùng markdown. '
            'Nếu cần nhắc tên nghề, phải dùng tên tiếng Việt: nhà thiết kế thay cho designer, '
            'lập trình viên thay cho developer, người sáng tạo nội dung thay cho content creator.'
        )

    user_prompt = (
        f'Vai trò người nhận hỗ trợ: {target_role}.\n'
        f'Mức độ hỗ trợ chính: {disability_level}.\n'
        f'Môn học: {subject_name}.\n'
        f'Bài học: {lesson_title}.\n'
        f'Loại hoạt động: {activity_type}.\n'
        'Yêu cầu: nếu là giải thích bài học thì cần rõ ràng, có ví dụ ngắn; '
        'nếu là nhắc nhở học sinh thì giữ giọng động viên.\n\n'
        f'Tin nhắn người dùng: {message.strip()}'
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
    raise GeminiServiceError('Gemini không trả về nội dung text hợp lệ', 'GEMINI_EMPTY_RESPONSE', 502, response_payload)


def _extract_audio_inline_data(response_payload: dict[str, Any]) -> tuple[bytes, str]:
    candidates = response_payload.get('candidates') or []
    for candidate in candidates:
        content = candidate.get('content') or {}
        parts = content.get('parts') or []
        for part in parts:
            inline_data = part.get('inlineData') or {}
            encoded_audio = inline_data.get('data')
            mime_type = str(inline_data.get('mimeType') or '').strip()
            if encoded_audio and mime_type:
                try:
                    return base64.b64decode(encoded_audio), mime_type
                except (ValueError, TypeError) as exc:
                    raise GeminiServiceError(
                        'Không giải mã được audio từ Gemini',
                        'GEMINI_AUDIO_DECODE_ERROR',
                        502,
                        {'mime_type': mime_type},
                    ) from exc
    raise GeminiServiceError('Gemini không trả về audio hợp lệ', 'GEMINI_EMPTY_AUDIO', 502, response_payload)


def _pcm_rate_from_mime_type(mime_type: str) -> int:
    match = re.search(r'rate=(\d+)', mime_type, re.IGNORECASE)
    if not match:
        return 24000
    try:
        return max(8000, int(match.group(1)))
    except ValueError:
        return 24000


def pcm_to_wav_bytes(pcm_bytes: bytes, sample_rate: int, sample_width: int = 2, channels: int = 1) -> bytes:
    buffer = BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return buffer.getvalue()


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
    if exc.status_code >= 500 or exc.error_code == 'GEMINI_NETWORK_ERROR':
        return True
    return False


def _should_retry_same_model(exc: GeminiServiceError) -> bool:
    lowered_message = exc.message.lower()
    if 'high demand' in lowered_message or 'try again later' in lowered_message:
        return True
    if exc.error_code in {'GEMINI_RATE_LIMIT', 'GEMINI_NETWORK_ERROR'}:
        return True
    return exc.status_code in {408, 409, 425, 429, 500, 502, 503, 504}


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


def _request_payload_once(*, api_key: str, model_name: str, payload: dict[str, Any], timeout: int = DEFAULT_TIMEOUT_SECONDS) -> dict[str, Any]:
    if not api_key.strip():
        raise GeminiServiceError('Gemini API key không hợp lệ', 'GEMINI_KEY_INVALID', 422)

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
        message_text = 'Gemini trả về lỗi không xác định'
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
    except TimeoutError as exc:
        raise GeminiServiceError('Kết nối Gemini API bị quá thời gian chờ', 'GEMINI_NETWORK_ERROR', 504, {'reason': str(exc)}) from exc
    except error.URLError as exc:
        raise GeminiServiceError('Không thể kết nối Gemini API', 'GEMINI_NETWORK_ERROR', 502, {'reason': str(exc.reason)}) from exc

    return response_payload


def _generate_payload_once(*, api_key: str, model_name: str, payload: dict[str, Any], timeout: int = DEFAULT_TIMEOUT_SECONDS) -> GeminiResult:
    response_payload = _request_payload_once(
        api_key=api_key,
        model_name=model_name,
        payload=payload,
        timeout=timeout,
    )
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
    timeout: int = DEFAULT_TTS_TIMEOUT_SECONDS,
) -> GeminiResult:
    resolved_api_keys = _normalize_api_keys(api_key, api_keys)
    if not resolved_api_keys:
        raise GeminiServiceError('Gemini API key không hợp lệ', 'GEMINI_KEY_INVALID', 422)

    last_error: GeminiServiceError | None = None
    retry_delays = (0.75, 1.75)

    for attempt_index in range(len(retry_delays) + 1):
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
                if _should_rotate_to_next_key(exc) and len(resolved_api_keys) > 1:
                    continue
                break

        if attempt_index < len(retry_delays) and last_error is not None and _should_retry_same_model(last_error):
            time.sleep(retry_delays[attempt_index])
            continue
        break

    if last_error is not None:
        raise last_error

    raise GeminiServiceError('Không thể tạo phản hồi từ Gemini', 'GEMINI_API_ERROR', 502)


def generate_text(
    *,
    api_key: str | None = None,
    api_keys: list[str] | tuple[str, ...] | None = None,
    model_name: str,
    message: str,
    context: dict[str, Any] | None = None,
    timeout: int = DEFAULT_TTS_TIMEOUT_SECONDS,
) -> GeminiResult:
    if not message.strip():
        raise GeminiServiceError('Nội dung gửi Gemini không được để trống', 'VALIDATION_ERROR', 422)

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
        raise GeminiServiceError('Prompt gửi Gemini không hợp lệ', 'VALIDATION_ERROR', 422)

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


def generate_speech_wav(
    *,
    api_key: str | None = None,
    api_keys: list[str] | tuple[str, ...] | None = None,
    model_name: str = DEFAULT_TTS_MODEL,
    text: str,
    voice_name: str = 'Kore',
    timeout: int = DEFAULT_TTS_TIMEOUT_SECONDS,
) -> GeminiAudioResult:
    clean_text = text.strip()
    if not clean_text:
        raise GeminiServiceError('Nội dung đọc không được để trống', 'VALIDATION_ERROR', 422)

    clean_voice_name = voice_name.strip() or 'Kore'
    payload = {
        'contents': [
            {
                'parts': [
                    {
                        'text': (
                            'Đọc bằng tiếng Việt thật chậm, rõ ràng và thân thiện cho học sinh nhỏ: '
                            f'{clean_text}'
                        ),
                    }
                ],
            }
        ],
        'model': model_name,
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {
                'voiceConfig': {
                    'prebuiltVoiceConfig': {
                        'voiceName': clean_voice_name,
                    },
                },
            },
        },
    }

    resolved_api_keys = _normalize_api_keys(api_key, api_keys)
    if not resolved_api_keys:
        raise GeminiServiceError('Gemini API key không hợp lệ', 'GEMINI_KEY_INVALID', 422)

    last_error: GeminiServiceError | None = None
    key_entries = list(enumerate(resolved_api_keys))

    for key_index, resolved_api_key in key_entries:
        try:
            raw_response = _request_payload_once(
                api_key=resolved_api_key,
                model_name=model_name,
                payload=payload,
                timeout=timeout,
            )
            pcm_bytes, mime_type = _extract_audio_inline_data(raw_response)
            sample_rate = _pcm_rate_from_mime_type(mime_type)
            wav_bytes = pcm_to_wav_bytes(pcm_bytes, sample_rate=sample_rate)
            _mark_next_round_robin_start(key_index, len(resolved_api_keys))
            return GeminiAudioResult(
                audio_bytes=wav_bytes,
                mime_type='audio/wav',
                model_name=model_name,
                raw_response=raw_response,
            )
        except GeminiServiceError as exc:
            last_error = exc
            if len(resolved_api_keys) == 1:
                raise
            if exc.error_code in {'GEMINI_EMPTY_AUDIO', 'GEMINI_NETWORK_ERROR'}:
                continue
            if not _should_rotate_to_next_key(exc):
                raise
            continue

    if last_error is not None:
        raise last_error

    raise GeminiServiceError('Không thể tạo audio từ Gemini', 'GEMINI_API_ERROR', 502)
