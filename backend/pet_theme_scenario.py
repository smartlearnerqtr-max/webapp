from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from app import create_app
from app.models import Classroom, Lesson, LessonAssignment, ParentDailyReport, Subject, User

PASSWORD = '123456'
TEACHER_EMAIL = 'user001@gmail.com'

LESSON_BLUEPRINTS = [
    {
        'subject_code': 'VAN',
        'title': '\u0043\u0068\u1ee7 \u0111\u1ec1 th\u00fa c\u01b0ng: nghe v\u00e0 g\u1ecdi t\u00ean',
        'description': 'H\u1ecdc sinh nghe, quan s\u00e1t v\u00e0 g\u1ecdi t\u00ean \u0111\u00fang c\u00e1c th\u00fa c\u01b0ng quen thu\u1ed9c.',
        'primary_level': 'nhe',
        'estimated_minutes': 18,
        'activities': [
            {
                'title': 'Nghe ti\u1ebfng k\u00eau v\u00e0 ch\u1ecdn th\u00fa c\u01b0ng',
                'activity_type': 'listen_choose',
                'instruction_text': 'Nghe k\u1ef9 \u00e2m thanh r\u1ed3i ch\u1ecdn \u0111\u00fang th\u00fa c\u01b0ng.',
                'voice_answer_enabled': True,
                'config': {
                    'kind': 'listen_choose',
                    'audio_text': 'Con v\u1eadt n\u00e0o hay k\u00eau meo meo?',
                    'choices': ['M\u00e8o', 'C\u00e1', 'Th\u1ecf'],
                    'correct': 'M\u00e8o',
                },
            },
            {
                'title': 'Xem video v\u00e0 n\u00f3i t\u00ean th\u00fa c\u01b0ng',
                'activity_type': 'watch_answer',
                'instruction_text': 'Xem h\u00ecnh ho\u1eb7c video ng\u1eafn r\u1ed3i tr\u1ea3 l\u1eddi.',
                'voice_answer_enabled': False,
                'config': {
                    'kind': 'watch_answer',
                    'media_url': 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
                    'prompt': 'Em nh\u00ecn th\u1ea5y th\u00fa c\u01b0ng n\u00e0o trong \u0111o\u1ea1n minh h\u1ecda?',
                },
            },
            {
                'title': 'L\u00e0m theo t\u1eebng b\u01b0\u1edbc \u0111\u1ec3 ch\u00e0o th\u00fa c\u01b0ng',
                'activity_type': 'step_by_step',
                'instruction_text': 'L\u00e0m l\u1ea7n l\u01b0\u1ee3t t\u1eebng b\u01b0\u1edbc th\u1eadt ch\u1eadm r\u00e3i.',
                'voice_answer_enabled': False,
                'config': {
                    'kind': 'step_by_step',
                    'prompt': 'T\u1eadp ch\u00e0o m\u1ed9t ch\u00fa ch\u00f3 th\u00e2n thi\u1ec7n.',
                    'steps': [
                        'B\u01b0\u1edbc 1: \u0110\u1ee9ng y\u00ean v\u00e0 nh\u00ecn c\u00f4 h\u01b0\u1edbng d\u1eabn.',
                        'B\u01b0\u1edbc 2: Gi\u01a1 tay ch\u00e0o v\u00e0 n\u00f3i xin ch\u00e0o ch\u00f3 con.',
                        'B\u01b0\u1edbc 3: Ch\u1edd ng\u01b0\u1eddi l\u1edbn \u0111\u1ed3ng \u00fd r\u1ed3i m\u1edbi l\u1ea1i g\u1ea7n.',
                    ],
                },
            },
        ],
    },
    {
        'subject_code': 'TOAN',
        'title': '\u0043\u0068\u1ee7 \u0111\u1ec1 th\u00fa c\u01b0ng: \u0111\u1ebfm v\u00e0 ph\u00e2n lo\u1ea1i',
        'description': 'H\u1ecdc sinh \u0111\u1ebfm s\u1ed1 l\u01b0\u1ee3ng th\u00fa c\u01b0ng v\u00e0 ph\u00e2n lo\u1ea1i theo \u0111\u1eb7c \u0111i\u1ec3m quen thu\u1ed9c.',
        'primary_level': 'trung_binh',
        'estimated_minutes': 20,
        'activities': [
            {
                'title': 'Ch\u1ecdn \u0111\u00e1p \u00e1n s\u1ed1 l\u01b0\u1ee3ng th\u00fa c\u01b0ng',
                'activity_type': 'multiple_choice',
                'instruction_text': '\u0110\u1ebfm s\u1ed1 con v\u1eadt r\u1ed3i ch\u1ecdn \u0111\u00e1p \u00e1n \u0111\u00fang.',
                'voice_answer_enabled': True,
                'config': {
                    'kind': 'multiple_choice',
                    'prompt': 'C\u00f3 m\u1ea5y ch\u00fa m\u00e8o \u0111ang ng\u1ed3i tr\u00ean th\u1ea3m?',
                    'choices': ['1', '2', '3'],
                    'correct': '2',
                },
            },
            {
                'title': 'N\u1ed1i s\u1ed1 v\u1edbi nh\u00f3m th\u00fa c\u01b0ng',
                'activity_type': 'matching',
                'instruction_text': 'N\u1ed1i s\u1ed1 l\u01b0\u1ee3ng v\u1edbi nh\u00f3m th\u00fa c\u01b0ng ph\u00f9 h\u1ee3p.',
                'voice_answer_enabled': False,
                'config': {
                    'kind': 'matching',
                    'prompt': 'Gh\u00e9p s\u1ed1 l\u01b0\u1ee3ng v\u1edbi \u0111\u00fang nh\u00f3m th\u00fa c\u01b0ng.',
                    'pairs': [
                        {'left': '1 con c\u00e1', 'right': '1'},
                        {'left': '2 ch\u00fa ch\u00f3', 'right': '2'},
                        {'left': '3 ch\u00fa th\u1ecf', 'right': '3'},
                    ],
                },
            },
            {
                'title': 'K\u00e9o th\u1ea3 th\u00fa c\u01b0ng v\u00e0o nh\u00f3m \u0111\u00fang',
                'activity_type': 'drag_drop',
                'instruction_text': 'K\u00e9o t\u1eebng th\u00fa c\u01b0ng v\u00e0o nh\u00f3m ph\u00f9 h\u1ee3p.',
                'voice_answer_enabled': False,
                'config': {
                    'kind': 'drag_drop',
                    'prompt': 'Ph\u00e2n lo\u1ea1i th\u00fa c\u01b0ng theo n\u01a1i \u1edf.',
                    'items': ['M\u00e8o', 'C\u00e1 v\u00e0ng', 'Th\u1ecf'],
                    'targets': ['Trong nh\u00e0', 'Trong b\u1ec3', 'Trong chu\u1ed3ng'],
                },
            },
        ],
    },
    {
        'subject_code': 'KY_NANG_SONG',
        'title': '\u0043\u0068\u1ee7 \u0111\u1ec1 th\u00fa c\u01b0ng: ch\u0103m s\u00f3c an to\u00e0n',
        'description': 'H\u1ecdc sinh luy\u1ec7n giao ti\u1ebfp l\u1ecbch s\u1ef1 v\u00e0 bi\u1ebft c\u00e1ch ch\u0103m s\u00f3c th\u00fa c\u01b0ng an to\u00e0n.',
        'primary_level': 'trung_binh',
        'estimated_minutes': 22,
        'activities': [
            {
                'title': 'Ch\u1ecdn th\u1ebb giao ti\u1ebfp khi mu\u1ed1n vu\u1ed1t m\u00e8o',
                'activity_type': 'aac',
                'instruction_text': 'Ch\u1ecdn c\u00e2u em mu\u1ed1n n\u00f3i trong t\u00ecnh hu\u1ed1ng n\u00e0y.',
                'voice_answer_enabled': True,
                'config': {
                    'kind': 'aac',
                    'prompt': 'Em mu\u1ed1n xin ph\u00e9p tr\u01b0\u1edbc khi vu\u1ed1t m\u00e8o, em ch\u1ecdn th\u1ebb n\u00e0o?',
                    'cards': ['Cho con vu\u1ed1t m\u00e8o nh\u00e9', 'Con \u0111\u00e3 xong', 'Con mu\u1ed1n u\u1ed1ng n\u01b0\u1edbc'],
                },
            },
            {
                'title': '\u0110\u00f3ng vai h\u1ecfi xin ph\u00e9p tr\u01b0\u1edbc khi ch\u01a1i v\u1edbi ch\u00f3',
                'activity_type': 'career_simulation',
                'instruction_text': 'L\u00e0m theo t\u00ecnh hu\u1ed1ng \u0111\u00f3ng vai.',
                'voice_answer_enabled': False,
                'config': {
                    'kind': 'career_simulation',
                    'scenario': 'Em g\u1eb7p m\u1ed9t ch\u00fa ch\u00f3 c\u1ee7a b\u1ea1n v\u00e0 mu\u1ed1n ch\u01a1i c\u00f9ng. H\u00e3y h\u1ecfi xin ph\u00e9p ng\u01b0\u1eddi l\u1edbn tr\u01b0\u1edbc.',
                    'success_criteria': 'Bi\u1ebft ch\u00e0o h\u1ecfi, xin ph\u00e9p v\u00e0 ch\u1ea1m nh\u1eb9 sau khi \u0111\u01b0\u1ee3c \u0111\u1ed3ng \u00fd.',
                },
            },
            {
                'title': 'Trao \u0111\u1ed5i v\u1edbi AI v\u1ec1 c\u00e1ch ch\u0103m th\u00fa c\u01b0ng',
                'activity_type': 'ai_chat',
                'instruction_text': 'Trao \u0111\u1ed5i ng\u1eafn g\u1ecdn v\u1edbi tr\u1ee3 l\u00fd AI.',
                'voice_answer_enabled': True,
                'config': {
                    'kind': 'ai_chat',
                    'starter_prompt': 'H\u00e3y \u0111\u00f3ng vai b\u1ea1n h\u1ecdc v\u00e0 h\u1ecfi em 3 c\u00e2u ng\u1eafn v\u1ec1 c\u00e1ch ch\u0103m s\u00f3c th\u00fa c\u01b0ng an to\u00e0n.',
                    'goals': ['Bi\u1ebft xin ph\u00e9p', 'Bi\u1ebft cho \u0103n \u0111\u00fang gi\u1edd', 'Bi\u1ebft r\u1eeda tay sau khi ch\u01a1i v\u1edbi th\u00fa c\u01b0ng'],
                },
            },
        ],
    },
]

PROGRESS_BY_EMAIL = {
    'student.t1.hoang-an@example.com': {'status': 'completed', 'progress_percent': 100, 'total_learning_seconds': 540, 'retry_count': 0, 'help_count': 0, 'reward_star_count': 5, 'completion_score': 96, 'complete': True},
    'student.t1.gia-han@example.com': {'status': 'in_progress', 'progress_percent': 82, 'total_learning_seconds': 420, 'retry_count': 1, 'help_count': 1, 'reward_star_count': 4, 'completion_score': 76, 'complete': False},
    'student.t1.minh-khang@example.com': {'status': 'in_progress', 'progress_percent': 74, 'total_learning_seconds': 460, 'retry_count': 1, 'help_count': 1, 'reward_star_count': 4, 'completion_score': 72, 'complete': False},
    'student.t1.khanh-linh@example.com': {'status': 'in_progress', 'progress_percent': 58, 'total_learning_seconds': 510, 'retry_count': 3, 'help_count': 4, 'reward_star_count': 2, 'completion_score': 45, 'complete': False},
    'student.t1.tuan-kiet@example.com': {'status': 'completed', 'progress_percent': 100, 'total_learning_seconds': 500, 'retry_count': 0, 'help_count': 0, 'reward_star_count': 5, 'completion_score': 92, 'complete': True},
}


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def api_json(response):
    payload = response.get_json()
    expect(payload is not None, f'Response is not valid JSON: {response.status_code} {response.get_data(as_text=True)}')
    return payload


def auth_headers(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


def request_json(client, method: str, path: str, expected_status: int | tuple[int, ...], **kwargs):
    response = client.open(path, method=method, **kwargs)
    expected_codes = (expected_status,) if isinstance(expected_status, int) else expected_status
    expect(response.status_code in expected_codes, f'{method} {path} failed: {response.status_code} {response.get_data(as_text=True)}')
    return api_json(response)


def login(client, identity: str, password: str) -> dict[str, object]:
    return request_json(client, 'POST', '/api/v1/auth/login', 200, json={'identity': identity, 'password': password})['data']


def ensure_class_subjects(client, token: str, class_id: int, subject_ids: list[int]) -> None:
    headers = auth_headers(token)
    for subject_id in subject_ids:
        response = client.post(f'/api/v1/classes/{class_id}/subjects', headers=headers, json={'subject_id': subject_id})
        expect(response.status_code in {201, 409}, f'Could not attach subject {subject_id} to class {class_id}: {response.status_code} {response.get_data(as_text=True)}')


def upsert_lesson(client, token: str, teacher_profile_id: int, subject_map: dict[str, int], blueprint: dict[str, object]) -> dict[str, object]:
    existing = Lesson.query.filter_by(created_by_teacher_id=teacher_profile_id, title=str(blueprint['title'])).first()
    payload = {
        'title': blueprint['title'],
        'subject_id': subject_map[str(blueprint['subject_code'])],
        'primary_level': blueprint['primary_level'],
        'description': blueprint['description'],
        'estimated_minutes': blueprint['estimated_minutes'],
        'difficulty_stage': 1,
        'is_published': True,
    }
    headers = auth_headers(token)
    if existing:
        lesson_id = int(existing.id)
        request_json(client, 'PUT', f'/api/v1/lessons/{lesson_id}', 200, headers=headers, json=payload)
    else:
        lesson_id = int(request_json(client, 'POST', '/api/v1/lessons', 201, headers=headers, json=payload)['data']['id'])

    lesson = Lesson.query.get(lesson_id)
    expect(lesson is not None, f'Lesson {lesson_id} was not found after upsert')
    existing_activities = {activity.title: activity for activity in lesson.activities}
    ordered_ids: list[int] = []

    for index, activity in enumerate(blueprint['activities'], start=1):
        activity_payload = {
            'title': activity['title'],
            'activity_type': activity['activity_type'],
            'instruction_text': activity['instruction_text'],
            'voice_answer_enabled': activity['voice_answer_enabled'],
            'is_required': True,
            'sort_order': index,
            'difficulty_stage': 1,
            'config_json': json.dumps(activity['config'], ensure_ascii=False),
        }
        existing_activity = existing_activities.get(str(activity['title']))
        if existing_activity:
            activity_id = int(existing_activity.id)
            request_json(client, 'PUT', f'/api/v1/activities/{activity_id}', 200, headers=headers, json=activity_payload)
        else:
            activity_id = int(request_json(client, 'POST', f'/api/v1/lessons/{lesson_id}/activities', 201, headers=headers, json=activity_payload)['data']['id'])
        ordered_ids.append(activity_id)

    request_json(client, 'POST', f'/api/v1/lessons/{lesson_id}/activities/reorder', 200, headers=headers, json={'activity_orders': [{'activity_id': activity_id, 'sort_order': index} for index, activity_id in enumerate(ordered_ids, start=1)]})
    return {'id': lesson_id, 'title': str(blueprint['title']), 'subject_id': int(payload['subject_id']), 'activity_count': len(ordered_ids)}


def upsert_assignment(client, token: str, lesson_id: int, class_id: int, subject_id: int, due_at: str) -> int:
    existing = LessonAssignment.query.filter_by(lesson_id=lesson_id, class_id=class_id).order_by(LessonAssignment.id.desc()).first()
    headers = auth_headers(token)
    payload = {'lesson_id': lesson_id, 'class_id': class_id, 'subject_id': subject_id, 'target_type': 'class', 'required_completion_percent': 85, 'due_at': due_at, 'status': 'active'}
    if existing:
        assignment_id = int(existing.id)
        request_json(client, 'PUT', f'/api/v1/assignments/{assignment_id}', 200, headers=headers, json=payload)
        return assignment_id
    return int(request_json(client, 'POST', '/api/v1/assignments', 201, headers=headers, json=payload)['data']['id'])


def simulate_assignment_progress(client, assignment_id: int, assignment_offset: int) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for email, profile in PROGRESS_BY_EMAIL.items():
        login_payload = login(client, email, PASSWORD)
        token = str(login_payload['access_token'])
        headers = auth_headers(token)
        request_json(client, 'GET', '/api/v1/my/assignments', 200, headers=headers)
        request_json(client, 'POST', f'/api/v1/my/assignments/{assignment_id}/start', 200, headers=headers)
        progress_payload = {
            'progress_percent': int(profile['progress_percent']),
            'total_learning_seconds': int(profile['total_learning_seconds']) + assignment_offset * 35,
            'retry_count': int(profile['retry_count']),
            'help_count': int(profile['help_count']),
            'reward_star_count': int(profile['reward_star_count']),
            'completion_score': int(profile['completion_score']),
            'status': str(profile['status']),
        }
        request_json(client, 'POST', f'/api/v1/my/assignments/{assignment_id}/progress', 200, headers=headers, json=progress_payload)
        if bool(profile['complete']):
            request_json(client, 'POST', f'/api/v1/my/assignments/{assignment_id}/complete', 200, headers=headers)
        detail = request_json(client, 'GET', f'/api/v1/my/assignments/{assignment_id}', 200, headers=headers)['data']
        results.append({
            'email': email,
            'student_name': str(login_payload['profile']['full_name']),
            'progress_percent': int(detail['progress_percent']),
            'completion_score': int(detail['completion_score']),
            'status': str(detail['status']),
            'readiness_status': str(detail['readiness_status']),
        })
    return results


def print_safe(value: object) -> None:
    if isinstance(value, str):
        print(value.encode('unicode_escape').decode('ascii'))
    else:
        print(value)


def main() -> None:
    app = create_app('development')
    with app.app_context():
        client = app.test_client()
        teacher_account = User.query.filter_by(email=TEACHER_EMAIL, role='teacher').first()
        expect(teacher_account is not None and teacher_account.teacher_profile is not None, f'Teacher {TEACHER_EMAIL} was not found')
        teacher_profile = teacher_account.teacher_profile
        classroom = Classroom.query.filter_by(teacher_id=teacher_profile.id, status='active').order_by(Classroom.id.asc()).first()
        expect(classroom is not None, f'No active classroom found for {TEACHER_EMAIL}')

        teacher_login = login(client, TEACHER_EMAIL, PASSWORD)
        teacher_token = str(teacher_login['access_token'])

        subject_map = {subject.code: int(subject.id) for subject in Subject.query.order_by(Subject.id.asc()).all()}
        expect({'TOAN', 'VAN', 'KY_NANG_SONG'}.issubset(subject_map), 'Required subjects are missing from the database')
        ensure_class_subjects(client, teacher_token, int(classroom.id), [subject_map['TOAN'], subject_map['VAN'], subject_map['KY_NANG_SONG']])

        lesson_outputs: list[dict[str, object]] = []
        assignment_outputs: list[dict[str, object]] = []
        for offset, blueprint in enumerate(LESSON_BLUEPRINTS, start=1):
            lesson_info = upsert_lesson(client, teacher_token, int(teacher_profile.id), subject_map, blueprint)
            due_at = (datetime.now(UTC) + timedelta(days=7 + offset)).date().isoformat()
            assignment_id = upsert_assignment(client, teacher_token, int(lesson_info['id']), int(classroom.id), int(lesson_info['subject_id']), due_at)
            lesson_outputs.append(lesson_info)
            assignment_outputs.append({'assignment_id': assignment_id, 'lesson_title': lesson_info['title'], 'due_at': due_at})

        latest_results: list[dict[str, object]] = []
        for offset, assignment in enumerate(assignment_outputs, start=1):
            latest_results = simulate_assignment_progress(client, int(assignment['assignment_id']), offset)

        report_payload = request_json(
            client,
            'POST',
            '/api/v1/teacher/reports/send',
            201,
            headers=auth_headers(teacher_token),
            json={
                'title': f'B\u00e1o c\u00e1o ch\u1ee7 \u0111\u1ec1 th\u00fa c\u01b0ng {datetime.now().date().isoformat()}',
                'note': '\u0110\u00e3 m\u00f4 ph\u1ecfng cho h\u1ecdc sinh l\u00e0m b\u00e0i ch\u1ee7 \u0111\u1ec1 th\u00fa c\u01b0ng \u0111\u1ec3 theo d\u00f5i readiness v\u00e0 g\u1ee3i \u00fd n\u00e2ng \u0111\u1ed9 kh\u00f3.',
            },
        )['data']

        latest_assignment = assignment_outputs[-1]
        progress_summary = request_json(client, 'GET', f"/api/v1/assignments/{latest_assignment['assignment_id']}/progress", 200, headers=auth_headers(teacher_token))['data']['summary']
        teacher_reports = ParentDailyReport.query.filter_by(teacher_id=int(teacher_profile.id)).count()

        print('PET_THEME_SCENARIO_COMPLETED')
        print_safe(f'Teacher account: {TEACHER_EMAIL} / {PASSWORD}')
        print_safe(f'Class used: {classroom.name} (class_id={classroom.id})')
        print('Lessons and assignments:')
        for lesson, assignment in zip(lesson_outputs, assignment_outputs):
            print_safe(f"- {lesson['title']} | lesson_id={lesson['id']} | activities={lesson['activity_count']} | assignment_id={assignment['assignment_id']} | due_at={assignment['due_at']}")
        print('Latest assignment readiness snapshot:')
        for item in latest_results:
            print_safe(f"- {item['student_name']} | {item['email']} | status={item['status']} | progress={item['progress_percent']} | score={item['completion_score']} | readiness={item['readiness_status']}")
        print('Summary:')
        print(progress_summary)
        print_safe(f'Parent reports updated in this call: {len(report_payload)}')
        print_safe(f'Total teacher reports currently stored: {teacher_reports}')
        print_safe('Student login to see ready-up case: student.t1.hoang-an@example.com / 123456')
        print_safe('Student login to see need-support case: student.t1.khanh-linh@example.com / 123456')


if __name__ == '__main__':
    main()
