from __future__ import annotations

import json
import random
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher

from flask import Response, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ....models import User
from ....services.edge_tts_service import EdgeTTSServiceError, synthesize_vietnamese_mp3
from ....services.gemini_service import DEFAULT_MODEL, GeminiServiceError, generate_text, generate_text_with_prompts
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1

LESSON_ACTIVITY_TYPES = {
    'multiple_choice',
    'image_choice',
    'image_puzzle',
    'listen_choose',
    'matching',
    'drag_drop',
    'watch_answer',
    'step_by_step',
    'aac',
}


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


def _safe_text(value: object, fallback: str = '') -> str:
    return str(value or fallback).strip()


def _canonical_text(value: str) -> str:
    without_accents = ''.join(
        character for character in unicodedata.normalize('NFD', value.lower())
        if unicodedata.category(character) != 'Mn'
    )
    return re.sub(r'[^a-z0-9\s-]+', ' ', without_accents).strip()


def _first_pexels_key() -> str:
    keys = list(current_app.config.get('PEXELS_API_KEYS') or [])
    return keys[0] if keys else ''


def _fetch_json(url: str, *, headers: dict[str, str] | None = None, timeout: int = 8) -> dict[str, object] | None:
    request_obj = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(request_obj, timeout=timeout) as response:
            payload = response.read().decode('utf-8')
            parsed = json.loads(payload)
            return parsed if isinstance(parsed, dict) else None
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None


def _search_pexels_images(query: str, *, limit: int = 4) -> list[dict[str, str]]:
    api_key = _first_pexels_key()
    clean_query = query.strip()
    if not api_key or not clean_query:
        return []

    params = urllib.parse.urlencode({'query': clean_query, 'per_page': max(1, min(limit, 6)), 'locale': 'en-US'})
    payload = _fetch_json(f'https://api.pexels.com/v1/search?{params}', headers={'Authorization': api_key})
    photos = payload.get('photos') if payload else None
    if not isinstance(photos, list):
        return []

    results: list[dict[str, str]] = []
    for photo in photos:
        if not isinstance(photo, dict):
            continue
        src = photo.get('src')
        if not isinstance(src, dict):
            continue
        media_url = _safe_text(src.get('large') or src.get('medium') or src.get('original'))
        if not media_url:
            continue
        results.append(
            {
                'media_url': media_url,
                'media_kind': 'image',
                'source': 'pexels',
                'credit': _safe_text(photo.get('photographer')),
                'source_url': _safe_text(photo.get('url')),
            }
        )
    return results


def _search_youtube_videos(query: str, *, limit: int = 2) -> list[dict[str, str]]:
    api_key = _safe_text(current_app.config.get('YOUTUBE_API_KEY'))
    clean_query = query.strip()
    if not api_key or not clean_query:
        return []

    params = urllib.parse.urlencode(
        {
            'part': 'snippet',
            'type': 'video',
            'maxResults': max(1, min(limit, 5)),
            'q': clean_query,
            'safeSearch': 'strict',
            'videoEmbeddable': 'true',
            'key': api_key,
        }
    )
    payload = _fetch_json(f'https://www.googleapis.com/youtube/v3/search?{params}')
    items = payload.get('items') if payload else None
    if not isinstance(items, list):
        return []

    results: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        video_id = item.get('id', {}).get('videoId') if isinstance(item.get('id'), dict) else ''
        snippet = item.get('snippet') if isinstance(item.get('snippet'), dict) else {}
        if not video_id:
            continue
        results.append(
            {
                'media_url': f'https://www.youtube.com/watch?v={video_id}',
                'media_kind': 'video',
                'source': 'youtube',
                'title': _safe_text(snippet.get('title') if isinstance(snippet, dict) else ''),
                'source_url': f'https://www.youtube.com/watch?v={video_id}',
            }
        )
    return results


def _coerce_card_list(value: object, *, prefix: str) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    cards: list[dict[str, str]] = []
    for index, item in enumerate(value):
        if isinstance(item, str):
            label = item.strip()
            raw_card: dict[str, object] = {'label': label}
        elif isinstance(item, dict):
            raw_card = item
            label = _safe_text(raw_card.get('label'))
        else:
            continue

        if not label and not _safe_text(raw_card.get('media_url')):
            continue

        card_id = _safe_text(raw_card.get('id')) or f'{prefix}-{index + 1}'
        cards.append(
            {
                'id': re.sub(r'[^a-zA-Z0-9_-]+', '-', card_id).strip('-').lower() or f'{prefix}-{index + 1}',
                'label': label or f'Lua chon {index + 1}',
                'media_url': _safe_text(raw_card.get('media_url')),
                'media_kind': _safe_text(raw_card.get('media_kind')) or 'image',
            }
        )
    return cards


def _build_lesson_question_fallback(
    *,
    subject_name: str,
    lesson_title: str,
    activity_slot: str,
    activity_title: str,
    activity_type: str,
    current_prompt: str,
    objective: str,
) -> dict[str, object]:
    normalized_context = _canonical_text(f'{subject_name} {lesson_title} {activity_title} {current_prompt}')
    effective_activity_type = activity_type

    is_math = 'toan' in normalized_context or 'math' in normalized_context
    prompt = current_prompt or f'Con hãy hoàn thành câu hỏi trong bài {lesson_title}.'
    base = {
        'teacher_note': 'AI trả về JSON chưa chuẩn nên hệ thống tạo bản nháp an toàn để cô/thầy có thể sửa tiếp.',
        'activity_type': effective_activity_type,
        'title': activity_title or f'Hoạt động {activity_slot}',
        'objective': objective or f'Luyện tập nội dung môn {subject_name} trong bài {lesson_title}.',
        'prompt': prompt,
        'example': f'Ví dụ: giáo viên đọc câu hỏi, học sinh làm từng bước rồi kiểm tra đáp án.',
        'text_choices': [],
        'correct_choice': '',
        'choice_cards': [],
        'matching_pairs': [],
        'drag_items': [],
        'drag_targets': [],
        'visual_style': '',
        'step_items': [],
        'media_url': '',
        'media_kind': '',
        'audio_text': '',
        'audio_url': '',
        'audio_lang': 'vi-VN',
        'answer_mode': 'none',
        'expected_answer': '',
        'accepted_answers': [],
        'aac_cards': [],
        'aac_image_cards': [],
        'puzzle_rows': 1,
        'puzzle_cols': 2,
        'math_left': None,
        'math_right': None,
        'math_operation': '',
        'math_group_label': '',
        'math_item_label': '',
        'shape_model': '',
        'shape_focus': '',
        'youtube_query': f'{lesson_title} {subject_name} bài học cho trẻ em',
        'pexels_query': f'{subject_name} education children',
        'media_sources': [],
    }

    is_math_step_lab = is_math and effective_activity_type == 'watch_answer' and (
        activity_slot.upper() == 'H1' or 'step' in normalized_context or 'tung buoc' in normalized_context
    )

    if is_math_step_lab:
        group_label, item_label = random.choice(
            [
                ('túi', 'viên kẹo'),
                ('khay', 'quả táo'),
                ('hộp', 'cây bút'),
                ('rổ', 'quả bóng'),
            ]
        )
        math_left = random.randint(2, 5)
        math_right = random.randint(2, 6)
        math_answer = math_left * math_right
        math_prompt = (
            f'Có {math_left} {group_label} {item_label}, mỗi {group_label} có {math_right} {item_label}. '
            f'Hỏi có tất cả bao nhiêu {item_label}?'
        )
        base.update(
            {
                'title': activity_title or 'Bài toán Step-by-step',
                'objective': objective or 'Học sinh đọc đề, chọn phép tính và điền kết quả theo từng bước.',
                'prompt': math_prompt,
                'example': f'Ví dụ đúng: {math_left} x {math_right} = {math_answer}, vậy có {math_answer} {item_label}.',
                'step_items': [
                    f'Đọc đề: {math_left} {group_label}, mỗi {group_label} có {math_right} {item_label}',
                    f'Chọn phép tính: {math_left} x {math_right}',
                    f'Điền kết quả: {math_answer}',
                ],
                'media_url': '/lesson-media/nhe/light-lab.html?activity=toan-step',
                'media_kind': '',
                'answer_mode': 'none',
                'expected_answer': str(math_answer),
                'accepted_answers': [str(math_answer), f'{math_left} x {math_right} = {math_answer}'],
                'math_left': math_left,
                'math_right': math_right,
                'math_operation': 'x',
                'math_group_label': group_label,
                'math_item_label': item_label,
            }
        )
    elif is_math and effective_activity_type == 'watch_answer':
        shape_model, shape_name, shape_counts = random.choice(
            [
                ('prism', 'lăng trụ tam giác', {'vertices': 6, 'edges': 9, 'faces': 5}),
                ('cube', 'hình hộp', {'vertices': 8, 'edges': 12, 'faces': 6}),
            ]
        )
        shape_focus, shape_focus_label = random.choice(
            [
                ('vertices', 'đỉnh'),
                ('edges', 'cạnh'),
                ('faces', 'mặt'),
            ]
        )
        shape_answer = shape_counts[shape_focus]
        shape_prompt = f'Xoay mô hình 3D {shape_name}, rồi chạm vào {shape_focus_label} để đếm số {shape_focus_label}.'
        base.update(
            {
                'title': activity_title or 'Tương tác 3D hình khối',
                'objective': objective or 'Học sinh xoay mô hình và nhận biết đỉnh, cạnh, mặt của hình khối.',
                'prompt': shape_prompt,
                'example': f'Ví dụ đúng: {shape_name} có {shape_answer} {shape_focus_label}.',
                'media_url': f'/lesson-media/nhe/shape-prism-3d.html?shape={shape_model}&focus={shape_focus}',
                'media_kind': '',
                'answer_mode': 'none',
                'expected_answer': str(shape_answer),
                'accepted_answers': [str(shape_answer), f'{shape_answer} {shape_focus_label}'],
                'shape_model': shape_model,
                'shape_focus': shape_focus,
            }
        )
    elif effective_activity_type == 'multiple_choice':
        choices = ['5 + 3 = 8', '5 + 3 = 6', '5 - 3 = 2'] if is_math else ['Đúng', 'Sai']
        base.update(
            {
                'prompt': current_prompt or ('Lan có 5 bút chì, thêm 3 bút chì. Phép tính nào đúng?' if is_math else prompt),
                'example': 'Đáp án đúng là 5 + 3 = 8.' if is_math else base['example'],
                'text_choices': choices,
                'correct_choice': choices[0],
                'answer_mode': 'none',
            }
        )
    elif effective_activity_type in {'image_choice', 'listen_choose'}:
        cards = [
            {'id': 'toan-hoc', 'label': 'Toán học', 'media_url': '/ichan/subjects/toan-hoc.png', 'media_kind': 'image'},
            {'id': 'ngu-van', 'label': 'Ngữ văn', 'media_url': '/ichan/subjects/ngu-van.png', 'media_kind': 'image'},
        ]
        base.update(
            {
                'prompt': current_prompt or 'Nhìn ảnh và chọn thẻ môn Toán.',
                'example': 'Ví dụ đúng: chọn thẻ Toán học.',
                'choice_cards': cards,
                'correct_choice': cards[0]['id'],
                'audio_text': prompt if effective_activity_type == 'listen_choose' else '',
                'pexels_query': 'math classroom numbers children',
            }
        )
    elif effective_activity_type == 'matching':
        base.update({'matching_pairs': [{'left': '5 + 3', 'right': '8'}, {'left': '4 + 2', 'right': '6'}] if is_math else [{'left': 'Ý 1', 'right': 'Đáp án 1'}, {'left': 'Ý 2', 'right': 'Đáp án 2'}]})
    elif effective_activity_type == 'drag_drop':
        base.update({'drag_items': ['Khối hộp', 'Lăng trụ tam giác'], 'drag_targets': ['Có 6 mặt', 'Có 5 mặt'], 'visual_style': 'shape_3d'} if is_math else {'drag_items': ['Mục 1', 'Mục 2'], 'drag_targets': ['Nhóm đúng', 'Nhóm còn lại']})
    elif effective_activity_type == 'step_by_step':
        base.update({'step_items': ['Đọc câu hỏi', 'Quan sát gợi ý', 'Chọn hoặc nói đáp án']})
    elif effective_activity_type == 'watch_answer':
        base.update({'answer_mode': 'text', 'expected_answer': 'Học sinh trả lời theo nội dung video', 'accepted_answers': ['Em đã hiểu']})
    elif effective_activity_type == 'aac':
        base.update({'aac_cards': ['Con chọn đáp án này', 'Con cần cô giúp', 'Con muốn làm lại']})

    return base


def _ensure_math_shape_draft(
    draft: dict[str, object],
    *,
    subject_name: str,
    lesson_title: str,
    activity_slot: str,
    activity_type: str,
) -> dict[str, object]:
    normalized_context = _canonical_text(f'{subject_name} {lesson_title} {_safe_text(draft.get("title"))} {_safe_text(draft.get("prompt"))}')
    if activity_slot.upper() != 'H2' or activity_type != 'watch_answer' or ('toan' not in normalized_context and 'math' not in normalized_context):
        return draft

    shape_data = {
        'prism': ('lăng trụ tam giác', {'vertices': 6, 'edges': 9, 'faces': 5}),
        'cube': ('hình hộp', {'vertices': 8, 'edges': 12, 'faces': 6}),
    }
    focus_labels = {'vertices': 'đỉnh', 'edges': 'cạnh', 'faces': 'mặt'}
    original_shape = _safe_text(draft.get('shape_model'))
    original_focus = _safe_text(draft.get('shape_focus'))
    shape_model = original_shape if original_shape in shape_data else random.choice(list(shape_data.keys()))
    shape_focus = original_focus if original_focus in focus_labels else random.choice(list(focus_labels.keys()))
    shape_name, counts = shape_data[shape_model]
    focus_label = focus_labels[shape_focus]
    answer = counts[shape_focus]
    generated_prompt = f'Xoay mô hình 3D {shape_name}, rồi chạm vào {focus_label} để đếm số {focus_label}.'
    should_refresh_prompt = original_shape not in shape_data or original_focus not in focus_labels or not _safe_text(draft.get('prompt'))
    final_prompt = generated_prompt if should_refresh_prompt else _safe_text(draft.get('prompt'))

    draft['shape_model'] = shape_model
    draft['shape_focus'] = shape_focus
    draft['media_url'] = '/lesson-media/nhe/shape-prism-3d.html?' + urllib.parse.urlencode(
        {
            'shape': shape_model,
            'focus': shape_focus,
            'title': _safe_text(draft.get('title')) or 'Tương tác 3D hình khối',
            'prompt': final_prompt,
        }
    )
    draft['media_kind'] = ''
    draft['answer_mode'] = _safe_text(draft.get('answer_mode')) or 'none'
    draft['expected_answer'] = _safe_text(draft.get('expected_answer')) or str(answer)
    draft['accepted_answers'] = draft.get('accepted_answers') if isinstance(draft.get('accepted_answers'), list) and draft.get('accepted_answers') else [str(answer), f'{answer} {focus_label}']
    if should_refresh_prompt:
        draft['prompt'] = final_prompt
    draft['example'] = _safe_text(draft.get('example')) or f'Ví dụ đúng: {shape_name} có {answer} {focus_label}.'
    return draft


def _subject_prompt_variants(subject_name: str, lesson_title: str, activity_slot: str) -> list[tuple[str, str, str]]:
    normalized_subject = _canonical_text(subject_name)
    slot = activity_slot.upper()
    if 'ngu van' in normalized_subject or 'van' in normalized_subject:
        return [
            ('Nghe đoạn truyện rồi chọn nhân vật đã kiên trì đến cuối câu chuyện.', 'Đáp án mẫu: nhân vật không bỏ cuộc dù gặp khó.', 'Kiên trì, không bỏ cuộc.'),
            ('Sắp xếp lại ba ý chính của câu chuyện theo đúng thứ tự.', 'Đáp án mẫu: mở đầu, diễn biến, bài học.', 'Mở đầu - diễn biến - bài học.'),
            ('Kể lại một bài học em rút ra sau khi xem hoạt động.', 'Đáp án mẫu: cố gắng thì sẽ tiến bộ.', 'Cố gắng, kiên trì.'),
        ]
    if 'tieng anh' in normalized_subject or 'english' in normalized_subject:
        return [
            ('Listen and choose the picture for the word: hospital.', 'Correct example: choose Hospital.', 'Hospital.'),
            ('Listen and repeat one short sentence about the picture.', 'Example: This is a festival.', 'This is a festival.'),
            ('Choose the card that matches the word you hear.', 'Correct example: choose Traffic when hearing traffic.', 'Traffic.'),
        ]
    if 'khoa hoc' in normalized_subject or 'khtn' in normalized_subject:
        return [
            ('Quan sát thí nghiệm ảo rồi chọn vật bị nam châm hút.', 'Đáp án mẫu: đinh sắt hoặc ghim giấy bị hút.', 'Đinh sắt, ghim giấy.'),
            ('Chạm vào bộ phận cơ thể được nêu trong yêu cầu.', 'Đáp án mẫu: chọn đúng mắt, tai hoặc mũi.', 'Chọn đúng bộ phận.'),
            ('Dự đoán hiện tượng trước khi bấm kiểm tra.', 'Đáp án mẫu: vật bằng sắt bị hút.', 'Vật bằng sắt bị hút.'),
        ]
    if 'lich su' in normalized_subject or 'dia li' in normalized_subject or 'lsdl' in normalized_subject:
        return [
            ('Quan sát bản đồ rồi chọn đúng vị trí được hỏi.', 'Đáp án mẫu: chọn đúng châu lục hoặc địa điểm.', 'Chọn đúng vị trí.'),
            ('Sắp xếp mốc thời gian theo thứ tự từ sớm đến muộn.', 'Đáp án mẫu: mốc nhỏ hơn đứng trước.', 'Đúng thứ tự thời gian.'),
            ('Theo dõi tuyến đường rồi nói điểm bắt đầu và điểm kết thúc.', 'Đáp án mẫu: nêu đúng hai địa điểm.', 'Nêu đúng điểm đầu và điểm cuối.'),
        ]
    if 'cong nghe' in normalized_subject:
        return [
            ('Sắp xếp các bước làm việc theo đúng quy trình.', 'Đáp án mẫu: chuẩn bị, thực hiện, kiểm tra.', 'Đúng thứ tự quy trình.'),
            ('Phân loại hình ảnh vào đúng nhóm đồ dùng hoặc vật nuôi.', 'Đáp án mẫu: đặt từng thẻ vào nhóm phù hợp.', 'Phân loại đúng nhóm.'),
            ('Chọn bước còn thiếu trong quy trình em vừa xem.', 'Đáp án mẫu: chọn bước ở giữa nếu quy trình còn thiếu.', 'Chọn đúng bước thiếu.'),
        ]
    if 'giao duc cong dan' in normalized_subject or 'gdcd' in normalized_subject:
        return [
            ('Xem tình huống rồi chọn cách ứng xử an toàn và lịch sự.', 'Đáp án mẫu: nhờ người lớn hỗ trợ khi cần.', 'Ứng xử an toàn.'),
            ('Chọn hành động nên làm khi thấy bạn gặp khó khăn.', 'Đáp án mẫu: hỏi thăm và báo cô giáo.', 'Giúp bạn đúng cách.'),
            ('Nói một việc em sẽ làm để giữ lớp sạch đẹp.', 'Đáp án mẫu: bỏ rác đúng nơi quy định.', 'Bỏ rác đúng nơi.'),
        ]
    if 'tin hoc' in normalized_subject:
        return [
            ('Chọn thao tác an toàn khi dùng máy tính hoặc Internet.', 'Đáp án mẫu: không chia sẻ mật khẩu.', 'Không chia sẻ mật khẩu.'),
            ('Làm theo một bước thao tác trên màn hình rồi bấm kiểm tra.', 'Đáp án mẫu: chọn đúng biểu tượng được yêu cầu.', 'Chọn đúng thao tác.'),
            ('Sắp xếp các bước mở và lưu bài thực hành.', 'Đáp án mẫu: mở file, làm bài, lưu lại.', 'Mở - làm - lưu.'),
        ]
    if 'giao duc the chat' in normalized_subject or 'gdtc' in normalized_subject:
        return [
            ('Quan sát động tác rồi chọn tư thế đúng.', 'Đáp án mẫu: lưng thẳng, mắt nhìn trước.', 'Tư thế đúng.'),
            ('Làm theo động tác khởi động được minh họa.', 'Đáp án mẫu: xoay cổ tay nhẹ nhàng.', 'Làm đúng động tác.'),
            ('Chọn hình thể hiện cách chạy an toàn.', 'Đáp án mẫu: chạy đúng hướng và giữ khoảng cách.', 'Chạy an toàn.'),
        ]
    if 'am nhac' in normalized_subject:
        return [
            ('Nghe tiết tấu rồi gõ lại theo nhịp mẫu.', 'Đáp án mẫu: gõ đều theo nhịp.', 'Gõ đúng nhịp.'),
            ('Chọn nhạc cụ tạo ra âm thanh em vừa nghe.', 'Đáp án mẫu: chọn đúng trống hoặc đàn.', 'Chọn đúng nhạc cụ.'),
            ('Nghe một đoạn ngắn rồi chọn cảm xúc phù hợp.', 'Đáp án mẫu: vui, nhẹ nhàng hoặc rộn ràng.', 'Chọn đúng cảm xúc.'),
        ]
    if 'mi thuat' in normalized_subject or 'my thuat' in normalized_subject:
        return [
            ('Chọn màu phù hợp rồi tô vào vùng còn trống.', 'Đáp án mẫu: tô gọn trong hình.', 'Tô đúng vùng.'),
            ('Trang trí thẻ bằng họa tiết theo mẫu.', 'Đáp án mẫu: chọn họa tiết và đặt đúng vị trí.', 'Trang trí đúng mẫu.'),
            ('Quan sát sản phẩm rồi chọn màu chủ đạo.', 'Đáp án mẫu: chọn màu xuất hiện nhiều nhất.', 'Chọn đúng màu.'),
        ]
    if 'dia phuong' in normalized_subject:
        return [
            ('Quan sát hình ảnh địa phương rồi chọn tên địa danh phù hợp.', 'Đáp án mẫu: chọn đúng địa danh trong ảnh.', 'Chọn đúng địa danh.'),
            ('Xem video ngắn rồi nói một đặc điểm của địa phương.', 'Đáp án mẫu: có đặc sản hoặc cảnh đẹp.', 'Nêu một đặc điểm.'),
            ('Ghép hình ảnh với thông tin địa phương tương ứng.', 'Đáp án mẫu: ghép đúng ảnh và tên.', 'Ghép đúng thông tin.'),
        ]
    return [
        (f'Hoàn thành nhiệm vụ mới trong bài {lesson_title} theo hướng dẫn trên màn hình.', 'Đáp án mẫu: làm đúng yêu cầu của hoạt động.', 'Hoàn thành đúng yêu cầu.'),
        (f'Quan sát hoạt động rồi chọn hoặc nói đáp án phù hợp cho bài {lesson_title}.', 'Đáp án mẫu: chọn đáp án phù hợp nhất.', 'Đáp án phù hợp.'),
        (f'Làm lại một nhiệm vụ khác của bài {lesson_title} và kiểm tra kết quả.', 'Đáp án mẫu: thực hiện đủ các bước.', 'Thực hiện đủ bước.'),
    ] if slot == 'H1' else [
        (f'Tương tác với hoạt động trong bài {lesson_title}, sau đó trả lời câu hỏi mới.', 'Đáp án mẫu: trả lời theo nội dung vừa quan sát.', 'Trả lời đúng nội dung.'),
        (f'Quan sát mô phỏng của bài {lesson_title} rồi chọn kết quả đúng.', 'Đáp án mẫu: chọn đúng kết quả sau khi quan sát.', 'Chọn đúng kết quả.'),
        (f'Thử một lượt tương tác mới rồi nêu điều em nhận thấy.', 'Đáp án mẫu: nêu một ý đúng với hoạt động.', 'Nêu một ý đúng.'),
    ]


def _ensure_distinct_draft(
    draft: dict[str, object],
    *,
    subject_name: str,
    lesson_title: str,
    activity_slot: str,
    activity_type: str,
    current_prompt: str,
) -> dict[str, object]:
    normalized_subject = _canonical_text(subject_name)
    if 'toan' in normalized_subject or 'math' in normalized_subject:
        return draft

    old_prompt = _safe_text(current_prompt)
    new_prompt = _safe_text(draft.get('prompt'))
    similarity = SequenceMatcher(None, _canonical_text(old_prompt), _canonical_text(new_prompt)).ratio() if old_prompt and new_prompt else 0
    if new_prompt and similarity < 0.88:
        return draft

    prompt, example, expected_answer = random.choice(_subject_prompt_variants(subject_name, lesson_title, activity_slot))
    draft['prompt'] = prompt
    draft['example'] = example
    draft['expected_answer'] = _safe_text(draft.get('expected_answer')) or expected_answer
    draft['accepted_answers'] = draft.get('accepted_answers') if isinstance(draft.get('accepted_answers'), list) and draft.get('accepted_answers') else [expected_answer]

    if activity_type == 'multiple_choice':
        draft['text_choices'] = [expected_answer, 'Chưa phù hợp', 'Cần làm lại']
        draft['correct_choice'] = expected_answer
    elif activity_type in {'image_choice', 'listen_choose'}:
        cards = _coerce_card_list(draft.get('choice_cards'), prefix='choice')
        if cards:
            draft['correct_choice'] = cards[0]['id']
    elif activity_type == 'matching' and not draft.get('matching_pairs'):
        draft['matching_pairs'] = [{'left': 'Ý chính', 'right': expected_answer}, {'left': 'Gợi ý', 'right': 'Làm theo hướng dẫn'}]
    elif activity_type == 'drag_drop' and not draft.get('drag_items'):
        draft['drag_items'] = ['Thẻ đúng', 'Thẻ cần sửa']
        draft['drag_targets'] = ['Nhóm phù hợp', 'Nhóm còn lại']
    elif activity_type == 'step_by_step' and not draft.get('step_items'):
        draft['step_items'] = ['Đọc yêu cầu mới', 'Quan sát gợi ý', 'Chọn hoặc nói đáp án']
    elif activity_type == 'aac' and not draft.get('aac_cards'):
        draft['aac_cards'] = ['Con chọn đáp án này', 'Con muốn làm lại', 'Con cần cô giúp']

    return draft


def _enrich_lesson_draft_media(draft: dict[str, object], *, subject_name: str, lesson_title: str) -> dict[str, object]:
    activity_type = _safe_text(draft.get('activity_type'))
    base_query = ' '.join(
        item
        for item in [
            _safe_text(draft.get('pexels_query')),
            _safe_text(draft.get('media_query')),
            _safe_text(draft.get('prompt')),
            lesson_title,
            subject_name,
        ]
        if item
    )
    youtube_query = _safe_text(draft.get('youtube_query')) or f'{lesson_title} {subject_name} bài học cho trẻ em'

    media_sources: list[dict[str, str]] = []
    pexels_results = _search_pexels_images(base_query, limit=4)
    youtube_results = _search_youtube_videos(youtube_query, limit=2)
    media_sources.extend(youtube_results)
    media_sources.extend(pexels_results)

    if activity_type == 'watch_answer' and not _safe_text(draft.get('media_url')) and youtube_results:
        draft['media_url'] = youtube_results[0]['media_url']
        draft['media_kind'] = 'video'
    elif activity_type in {'image_choice', 'listen_choose', 'image_puzzle'} and not _safe_text(draft.get('media_url')) and pexels_results:
        draft['media_url'] = pexels_results[0]['media_url']
        draft['media_kind'] = 'image'

    if activity_type in {'image_choice', 'listen_choose'}:
        cards = _coerce_card_list(draft.get('choice_cards'), prefix='choice')
        for card in cards:
            if card.get('media_url'):
                continue
            query = f"{card.get('label', '')} {subject_name} child education".strip()
            result = _search_pexels_images(query, limit=1)
            if result:
                card['media_url'] = result[0]['media_url']
                card['media_kind'] = 'image'
                media_sources.append(result[0])
        draft['choice_cards'] = cards

    if activity_type == 'aac':
        cards = _coerce_card_list(draft.get('aac_image_cards'), prefix='aac')
        for card in cards:
            if card.get('media_url'):
                continue
            query = f"{card.get('label', '')} child communication icon".strip()
            result = _search_pexels_images(query, limit=1)
            if result:
                card['media_url'] = result[0]['media_url']
                card['media_kind'] = 'image'
                media_sources.append(result[0])
        draft['aac_image_cards'] = cards

    draft['media_sources'] = media_sources[:8]
    return draft


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
        api_key_masked = 'Chưa cấu hình trong .env'
    elif key_count == 1:
        api_key_masked = _mask_key(api_keys[0])
    else:
        api_key_masked = f'{key_count} API key đang được quản lý trong .env'

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
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)
    return success_response(_build_ai_settings_payload())


@api_v1.put('/ai/settings')
@jwt_required()
def save_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)
    return error_response('API key được quản lý tại server .env, không cho phép sửa từ giao diện', 'AI_SETTINGS_READ_ONLY', 405)


@api_v1.post('/ai/settings/test')
@jwt_required()
def test_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)

    api_keys = _configured_api_keys()
    if not api_keys:
        return error_response('Chưa cấu hình Gemini API key trong .env', 'GEMINI_KEY_MISSING', 404)

    model_name = _configured_model_name()

    try:
        result = generate_text(
            api_keys=api_keys,
            model_name=model_name,
            message='Hãy trả lời chính xác một từ: OK',
            context={'target_role': user.role},
        )
    except GeminiServiceError as exc:
        log_server_event(
            level='error',
            module='ai_settings',
            message='Test Gemini settings thất bại',
            error_code=exc.error_code,
            action_name='test_ai_settings_failed',
            user_id=user.id,
            metadata={'status': exc.status_code, 'details': exc.details, 'model_name': model_name, 'key_count': len(api_keys)},
        )
        return error_response(exc.message, exc.error_code, exc.status_code, exc.details)

    log_server_event(
        level='info',
        module='ai_settings',
        message='Test Gemini settings thành công',
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
        'Đã kiểm tra cấu hình Gemini',
    )


@api_v1.post('/ai/chat')
@jwt_required()
def chat_with_ai():
    user = _current_user()
    if not user:
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)

    api_keys = _configured_api_keys()
    if not api_keys:
        return error_response('Chưa cấu hình Gemini API key trong .env', 'GEMINI_KEY_MISSING', 404)

    payload = request.get_json(silent=True) or {}
    message = (payload.get('message') or '').strip()
    if not message:
        return error_response('Nội dung câu hỏi không được để trống', 'VALIDATION_ERROR', 422)

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
            message='Gọi Gemini thất bại',
            error_code=exc.error_code,
            action_name='ai_chat_failed',
            user_id=user.id,
            metadata={'status': exc.status_code, 'details': exc.details, 'model_name': model_name, 'key_count': len(api_keys)},
        )
        return error_response(exc.message, exc.error_code, exc.status_code, exc.details)

    log_server_event(
        level='info',
        module='ai_chat',
        message='Gọi Gemini thành công',
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
        'Lấy phản hồi AI thành công',
    )


@api_v1.post('/ai/lesson-question-draft')
@jwt_required()
def create_lesson_question_draft():
    user = _current_user()
    if not user:
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)
    if user.role not in {'teacher', 'admin'}:
        return error_response('Chỉ giáo viên mới được tạo câu hỏi bằng AI', 'FORBIDDEN', 403)

    api_keys = _configured_api_keys()
    if not api_keys:
        return error_response('Chưa cấu hình Gemini API key trong .env', 'GEMINI_KEY_MISSING', 404)

    payload = request.get_json(silent=True) or {}
    subject_name = _safe_text(payload.get('subject_name')) or 'Môn học'
    lesson_title = _safe_text(payload.get('lesson_title')) or 'Bài học'
    difficulty_level = _safe_text(payload.get('difficulty_level')) or 'nhe'
    activity_slot = _safe_text(payload.get('activity_slot')) or 'H1'
    activity_title = _safe_text(payload.get('activity_title')) or f'Hoạt động {activity_slot}'
    activity_type = _safe_text(payload.get('activity_type')) or 'multiple_choice'
    current_prompt = _safe_text(payload.get('current_prompt'))
    objective = _safe_text(payload.get('objective'))

    if activity_type not in LESSON_ACTIVITY_TYPES:
        return error_response('Loại câu hỏi không hợp lệ', 'VALIDATION_ERROR', 422)

    media_capability = {
        'youtube': bool(_safe_text(current_app.config.get('YOUTUBE_API_KEY'))),
        'pexels': bool(_first_pexels_key()),
    }
    system_prompt = (
        'You are an assistant for Vietnamese special-education teachers. '
        'Create one structured lesson activity draft for a teacher lesson builder. '
        'Return one valid JSON object only. Do not use markdown. Do not add commentary outside JSON. '
        'Escape line breaks inside string values as \\n. Never output unescaped control characters. '
        'Use Vietnamese for teacher-facing text. Keep the activity gentle, concrete, and suitable for children needing light support. '
        'Use these keys exactly: teacher_note, activity_type, title, objective, prompt, example, text_choices, correct_choice, '
        'choice_cards, matching_pairs, drag_items, drag_targets, visual_style, step_items, media_url, media_kind, '
        'audio_text, audio_url, audio_lang, answer_mode, expected_answer, accepted_answers, aac_cards, aac_image_cards, '
        'puzzle_rows, puzzle_cols, math_left, math_right, math_operation, math_group_label, math_item_label, shape_model, shape_focus, youtube_query, pexels_query. '
        'The requested activity_type is locked by the existing lesson template; return the same activity_type and never redesign the activity form. '
        'Only change content inside that form: prompt, numbers, choices, answers, hints, and required media fields. '
        'choice_cards and aac_image_cards are arrays of objects with id, label, media_url, media_kind. '
        'matching_pairs is an array of objects with left and right. '
        'media_kind must be "image", "video", or "". answer_mode must be "text", "voice_ai_grade", or "none". '
        'Only fill fields useful for the requested activity_type; keep unused arrays empty. '
        'For multiple_choice, correct_choice must exactly match one text_choices item. '
        'For image_choice and listen_choose, correct_choice must match one choice_cards id. '
        'For watch_answer, prefer answer_mode "text" or "none" and provide a child-friendly expected_answer when needed. '
        'For the Toan H1 step-by-step lab, keep media_url as the existing local lab and return new math_left, math_right, math_operation, math_group_label, and math_item_label values so the same form changes its numbers. '
        'For the Toan H2 3D shape lab, keep the local 3D model form and return shape_model ("prism" or "cube") plus shape_focus ("vertices", "edges", or "faces") so each draft has a different shape task. '
        'If direct media URLs are uncertain, leave media_url empty and provide useful youtube_query/pexels_query keywords.'
    )
    user_prompt = (
        f'Subject: {subject_name}\n'
        f'Lesson title: {lesson_title}\n'
        f'Difficulty level: {difficulty_level}\n'
        f'Activity slot: {activity_slot}\n'
        f'Current activity title: {activity_title}\n'
        f'Requested activity type: {activity_type}\n'
        f'Current objective: {objective or "Chưa có"}\n'
        f'Current prompt: {current_prompt or "Chưa có"}\n'
        f'Media API available: {json.dumps(media_capability, ensure_ascii=False)}\n'
        'Keep the requested activity type exactly; do not switch to video, image choice, AAC, matching, or another form unless it is already requested. '
        'Make the draft match the chosen subject, not another subject. '
        'Use 2-4 answer options. Avoid long reading passages. '
        'Give one concrete example so the teacher can review before adding it to Preview.'
    )

    model_name = _configured_model_name()
    try:
        result = generate_text_with_prompts(
            api_keys=api_keys,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2,
            max_output_tokens=4096,
            response_mime_type='application/json',
        )
        draft = _extract_json_object(result.text)
    except GeminiServiceError as exc:
        log_server_event(
            level='warning',
            module='ai_lesson_question',
            message='Gemini tạm thời không tạo được câu hỏi, dùng bản nháp dự phòng',
            error_code=exc.error_code,
            action_name='ai_lesson_question_gemini_fallback',
            user_id=user.id,
            metadata={'activity_type': activity_type, 'model_name': model_name, 'error': exc.message},
        )
        draft = _build_lesson_question_fallback(
            subject_name=subject_name,
            lesson_title=lesson_title,
            activity_slot=activity_slot,
            activity_title=activity_title,
            activity_type=activity_type,
            current_prompt=current_prompt,
            objective=objective,
        )
        draft['teacher_note'] = (
            'Gemini đang quá tải nên hệ thống tạo bản nháp dự phòng trước. '
            'Cô/thầy có thể sửa nhanh nội dung này hoặc bấm tạo lại sau.'
        )
        result = None
    except (ValueError, json.JSONDecodeError) as exc:
        log_server_event(
            level='warning',
            module='ai_lesson_question',
            message='Gemini trả JSON chưa hợp lệ, dùng bản nháp dự phòng',
            error_code='AI_LESSON_DRAFT_PARSE_ERROR',
            action_name='ai_lesson_question_parse_fallback',
            user_id=user.id,
            metadata={'activity_type': activity_type, 'model_name': model_name, 'error': str(exc)},
        )
        draft = _build_lesson_question_fallback(
            subject_name=subject_name,
            lesson_title=lesson_title,
            activity_slot=activity_slot,
            activity_title=activity_title,
            activity_type=activity_type,
            current_prompt=current_prompt,
            objective=objective,
        )
        result = None

    resolved_type = _safe_text(draft.get('activity_type')) or activity_type
    if resolved_type not in LESSON_ACTIVITY_TYPES:
        resolved_type = activity_type
    draft['activity_type'] = resolved_type
    draft['title'] = _safe_text(draft.get('title')) or activity_title
    draft['objective'] = _safe_text(draft.get('objective')) or objective
    draft['prompt'] = _safe_text(draft.get('prompt')) or current_prompt
    draft['audio_lang'] = _safe_text(draft.get('audio_lang')) or 'vi-VN'
    draft = _ensure_math_shape_draft(
        draft,
        subject_name=subject_name,
        lesson_title=lesson_title,
        activity_slot=activity_slot,
        activity_type=resolved_type,
    )
    draft = _ensure_distinct_draft(
        draft,
        subject_name=subject_name,
        lesson_title=lesson_title,
        activity_slot=activity_slot,
        activity_type=resolved_type,
        current_prompt=current_prompt,
    )
    draft = _enrich_lesson_draft_media(draft, subject_name=subject_name, lesson_title=lesson_title)

    log_server_event(
        level='info',
        module='ai_lesson_question',
        message='Tạo câu hỏi bài học bằng AI thành công',
        action_name='ai_lesson_question_success',
        user_id=user.id,
        metadata={
            'activity_type': resolved_type,
            'activity_slot': activity_slot,
            'subject_name': subject_name,
            'model_name': result.model_name if result else model_name,
            'youtube_enabled': media_capability['youtube'],
            'pexels_enabled': media_capability['pexels'],
        },
    )
    return success_response(
        {
            'suggestion': draft,
            'model_name': result.model_name if result else model_name,
            'usage_metadata': result.usage_metadata if result else None,
            'media_capability': media_capability,
        },
        'Đã tạo gợi ý câu hỏi bằng AI',
    )


@api_v1.post('/ai/speech')
@jwt_required()
def synthesize_ai_speech():
    user = _current_user()
    if not user:
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    text = str(payload.get('text') or '').strip()
    if not text:
        return error_response('Nội dung cần đọc không được để trống', 'VALIDATION_ERROR', 422)

    try:
        audio_bytes = synthesize_vietnamese_mp3(
            text=text,
            voice_name=str(current_app.config.get('EDGE_TTS_VOICE_NAME') or 'vi-VN-HoaiMyNeural'),
            rate=str(current_app.config.get('EDGE_TTS_RATE') or '-12%'),
            pitch=str(current_app.config.get('EDGE_TTS_PITCH') or '+0Hz'),
        )
    except EdgeTTSServiceError as exc:
        log_server_event(
            level='error',
            module='ai_speech',
            message='Tạo audio hướng dẫn bằng Edge TTS thất bại',
            error_code='EDGE_TTS_FAILED',
            action_name='ai_speech_failed',
            user_id=user.id,
            metadata={'status': exc.status_code},
        )
        return error_response(exc.message, 'EDGE_TTS_FAILED', exc.status_code)

    log_server_event(
        level='info',
        module='ai_speech',
        message='Tạo audio hướng dẫn bằng Edge TTS thành công',
        action_name='ai_speech_success',
        user_id=user.id,
        metadata={'voice_name': current_app.config.get('EDGE_TTS_VOICE_NAME'), 'text_length': len(text)},
    )
    return Response(
        audio_bytes,
        mimetype='audio/mpeg',
        headers={
            'Cache-Control': 'no-store',
            'Content-Disposition': 'inline; filename="career-voice.mp3"',
        },
    )


@api_v1.post('/ai/grade-answer')
@jwt_required()
def grade_ai_answer():
    user = _current_user()
    if not user:
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    transcript = str(payload.get('transcript') or '').strip()
    expected_answer = str(payload.get('expected_answer') or '').strip()
    accepted_answers = _string_list(payload.get('accepted_answers'))
    question = str(payload.get('question') or '').strip()
    lesson_title = str(payload.get('lesson_title') or '').strip()
    activity_type = str(payload.get('activity_type') or 'watch_answer').strip() or 'watch_answer'
    media_url = str(payload.get('media_url') or '').strip()

    if not transcript:
        return error_response('Nội dung nhận diện giọng nói đang trống', 'VALIDATION_ERROR', 422)
    if not expected_answer:
        return error_response('Thiếu đáp án mẫu để chấm', 'VALIDATION_ERROR', 422)

    all_expected_answers = [expected_answer, *accepted_answers]
    normalized_transcript = _normalize_answer_text(transcript)
    normalized_expected_answers = []
    for answer in all_expected_answers:
        normalized = _normalize_answer_text(answer)
        if normalized and normalized not in normalized_expected_answers:
            normalized_expected_answers.append(normalized)

    rule_grade, rule_is_correct, rule_match = _rule_grade_answer(normalized_transcript, normalized_expected_answers)
    fallback_feedback = (
        'Câu trả lời của em trùng với đáp án mong đợi.'
        if rule_is_correct
        else 'AI chưa tự tin đây là đáp án đúng. Em thử nói lại ngắn gọn hơn nhé.'
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
            'Đã chấm câu trả lời bằng quy tắc dự phòng',
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
        f'Question: {question or "Không có câu hỏi bổ sung"}\n'
        f'Lesson title: {lesson_title or "Không rõ bài học"}\n'
        f'Activity type: {activity_type}\n'
        f'Media URL: {media_url or "Không có"}\n'
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
            feedback = 'Câu trả lời của em đúng rồi.'

        log_server_event(
            level='info',
            module='ai_grade_answer',
            message='Chấm câu trả lời bằng Gemini thành công',
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
            'Đã chấm câu trả lời bằng AI',
        )
    except (GeminiServiceError, ValueError, json.JSONDecodeError) as exc:
        error_message = exc.message if isinstance(exc, GeminiServiceError) else str(exc)
        log_server_event(
            level='warning',
            module='ai_grade_answer',
            message='Chấm câu trả lời bằng Gemini thất bại, chuyển sang quy tắc dự phòng',
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
            'Đã chấm câu trả lời bằng quy tắc dự phòng',
        )


@api_v1.delete('/ai/settings')
@jwt_required()
def delete_ai_settings():
    user = _current_user()
    if not user:
        return error_response('Không tìm thấy người dùng', 'USER_NOT_FOUND', 404)
    return error_response('API key được quản lý tại server .env, không cho phép xóa từ giao diện', 'AI_SETTINGS_READ_ONLY', 405)
