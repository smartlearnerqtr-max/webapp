from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher

from flask import current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ....models import User
from ....services.gemini_service import DEFAULT_MODEL, GeminiServiceError, generate_text, generate_text_with_prompts
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


def _normalize_answer_text(value: str) -> str:
    lowered = (value or '').strip().lower()
    without_accents = ''.join(
        character for character in unicodedata.normalize('NFD', lowered)
        if unicodedata.category(character) != 'Mn'
    )
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', without_accents)
    return re.sub(r'\s+', ' ', cleaned).strip()


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _extract_json_object(raw_text: str) -> dict[str, object]:
    content = raw_text.strip()
    fenced_match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', content, re.IGNORECASE | re.DOTALL)
    if fenced_match:
        content = fenced_match.group(1)
    else:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise ValueError('Gemini JSON response must be an object')
    return parsed


def _rule_grade_answer(normalized_transcript: str, normalized_accepted_answers: list[str]) -> tuple[str, bool, str | None]:
    if not normalized_transcript:
        return 'incorrect', False, None

    accepted_set = [answer for answer in normalized_accepted_answers if answer]
    if normalized_transcript in accepted_set:
        return 'correct', True, normalized_transcript

    transcript_tokens = set(normalized_transcript.split())
    for answer in accepted_set:
        if not answer:
            continue
        answer_tokens = set(answer.split())
        if answer_tokens and answer_tokens.issubset(transcript_tokens) and 'khong' not in transcript_tokens:
            return 'correct', True, answer

    best_ratio = 0.0
    best_answer: str | None = None
    for answer in accepted_set:
        ratio = SequenceMatcher(None, normalized_transcript, answer).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_answer = answer

    if best_ratio >= 0.72 and best_answer:
        return 'close', False, best_answer

    return 'incorrect', False, best_answer


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


@api_v1.post('/ai/grade-answer')
@jwt_required()
def grade_ai_answer():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    transcript = str(payload.get('transcript') or '').strip()
    expected_answer = str(payload.get('expected_answer') or '').strip()
    accepted_answers = _string_list(payload.get('accepted_answers'))
    question = str(payload.get('question') or '').strip()
    lesson_title = str(payload.get('lesson_title') or '').strip()
    activity_type = str(payload.get('activity_type') or 'watch_answer').strip() or 'watch_answer'
    media_url = str(payload.get('media_url') or '').strip()

    if not transcript:
        return error_response('Noi dung nhan dien giong noi dang trong', 'VALIDATION_ERROR', 422)
    if not expected_answer:
        return error_response('Thieu dap an mau de cham', 'VALIDATION_ERROR', 422)

    all_expected_answers = [expected_answer, *accepted_answers]
    normalized_transcript = _normalize_answer_text(transcript)
    normalized_expected_answers = []
    for answer in all_expected_answers:
        normalized = _normalize_answer_text(answer)
        if normalized and normalized not in normalized_expected_answers:
            normalized_expected_answers.append(normalized)

    rule_grade, rule_is_correct, rule_match = _rule_grade_answer(normalized_transcript, normalized_expected_answers)
    fallback_feedback = (
        'Cau tra loi cua em trung voi dap an mong doi.'
        if rule_is_correct
        else 'AI chua tu tin day la dap an dung. Em thu noi lai ngan gon hon nhe.'
    )

    api_keys = _configured_api_keys()
    model_name = _configured_model_name()

    if not api_keys:
        return success_response(
            {
                'transcript': transcript,
                'normalized_transcript': normalized_transcript,
                'is_correct': rule_is_correct,
                'grade': rule_grade,
                'feedback': fallback_feedback,
                'matched_answer': rule_match or _normalize_answer_text(expected_answer),
                'source': 'fallback',
                'model_name': None,
            },
            'Da cham cau tra loi bang quy tac du phong',
        )

    system_prompt = (
        'You grade short spoken answers from students. '
        'Return JSON only. Do not use markdown. '
        'Use this schema exactly: '
        '{"is_correct": boolean, "grade": "correct" | "close" | "incorrect", '
        '"feedback": string, "matched_answer": string}. '
        'Treat minor filler words as acceptable when meaning still matches the expected answer.'
    )
    user_prompt = (
        f'Question: {question or "Khong co cau hoi bo sung"}\n'
        f'Lesson title: {lesson_title or "Khong ro bai hoc"}\n'
        f'Activity type: {activity_type}\n'
        f'Media URL: {media_url or "Khong co"}\n'
        f'Student transcript: {transcript}\n'
        f'Expected answer: {expected_answer}\n'
        f'Accepted answers: {json.dumps(all_expected_answers, ensure_ascii=False)}\n'
        'Grade the answer by meaning. '
        'If the transcript clearly identifies the same animal/object as the expected answer, mark it correct. '
        'Keep feedback short, friendly, and easy for a child to understand.'
    )

    try:
        result = generate_text_with_prompts(
            api_keys=api_keys,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
            max_output_tokens=256,
        )
        parsed = _extract_json_object(result.text)
        grade = str(parsed.get('grade') or '').strip().lower()
        if grade not in {'correct', 'close', 'incorrect'}:
            grade = rule_grade
        matched_answer = str(parsed.get('matched_answer') or '').strip() or expected_answer
        feedback = str(parsed.get('feedback') or '').strip() or fallback_feedback
        gemini_is_correct = bool(parsed.get('is_correct'))
        is_correct = gemini_is_correct or rule_is_correct
        if is_correct and grade == 'incorrect':
            grade = 'correct'
        if rule_is_correct and not feedback:
            feedback = 'Cau tra loi cua em dung roi.'

        log_server_event(
            level='info',
            module='ai_grade_answer',
            message='Cham cau tra loi bang Gemini thanh cong',
            action_name='ai_grade_answer_success',
            user_id=user.id,
            metadata={
                'activity_type': activity_type,
                'model_name': result.model_name,
                'rule_grade': rule_grade,
                'gemini_grade': grade,
            },
        )
        return success_response(
            {
                'transcript': transcript,
                'normalized_transcript': normalized_transcript,
                'is_correct': is_correct,
                'grade': grade,
                'feedback': feedback,
                'matched_answer': matched_answer,
                'source': 'gemini',
                'model_name': result.model_name,
            },
            'Da cham cau tra loi bang AI',
        )
    except (GeminiServiceError, ValueError, json.JSONDecodeError) as exc:
        error_message = exc.message if isinstance(exc, GeminiServiceError) else str(exc)
        log_server_event(
            level='warning',
            module='ai_grade_answer',
            message='Cham cau tra loi bang Gemini that bai, chuyen sang quy tac du phong',
            error_code=exc.error_code if isinstance(exc, GeminiServiceError) else 'AI_GRADE_PARSE_ERROR',
            action_name='ai_grade_answer_fallback',
            user_id=user.id,
            metadata={
                'activity_type': activity_type,
                'model_name': model_name,
                'rule_grade': rule_grade,
                'error': error_message,
            },
        )
        return success_response(
            {
                'transcript': transcript,
                'normalized_transcript': normalized_transcript,
                'is_correct': rule_is_correct,
                'grade': rule_grade,
                'feedback': fallback_feedback,
                'matched_answer': rule_match or expected_answer,
                'source': 'fallback',
                'model_name': model_name,
            },
            'Da cham cau tra loi bang quy tac du phong',
        )


@api_v1.delete('/ai/settings')
@jwt_required()
def delete_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Khong tim thay nguoi dung', 'USER_NOT_FOUND', 404)
    return error_response('API key duoc quan ly tai server .env, khong cho phep xoa tu giao dien', 'AI_SETTINGS_READ_ONLY', 405)
