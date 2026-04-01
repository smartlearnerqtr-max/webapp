from __future__ import annotations

from app import create_app
from app.extensions import db
from app.models import UserAISetting
from app.services.gemini_service import GeminiResult
from app.services.seed_service import seed_demo_parent, seed_demo_student, seed_demo_teacher, seed_subjects
from app.utils.security import encrypt_secret
import app.api.v1.routes.ai_settings as ai_routes


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    app = create_app('testing')

    with app.app_context():
        db.create_all()
        seed_subjects()
        teacher = seed_demo_teacher()
        seed_demo_student()
        seed_demo_parent()

        setting = UserAISetting.query.filter_by(user_id=teacher.id, provider='gemini').first()
        if not setting:
            setting = UserAISetting(
                user_id=teacher.id,
                provider='gemini',
                model_name='gemini-2.5-flash',
                api_key_encrypted=encrypt_secret('fake-key'),
                api_key_masked='fake****key',
                status='active',
            )
            db.session.add(setting)
            db.session.commit()

        def fake_generate_text(**kwargs):
            return GeminiResult(
                text='Gemini mock response',
                model_name=kwargs['model_name'],
                prompt_feedback=None,
                usage_metadata={'promptTokenCount': 12},
                raw_response={'mocked': True},
            )

        ai_routes.generate_text = fake_generate_text

        client = app.test_client()

        teacher_login = client.post('/api/v1/auth/login', json={'identity': 'teacher@example.com', 'password': '123456'})
        expect(teacher_login.status_code == 200, 'Teacher login failed')
        teacher_token = teacher_login.get_json()['data']['access_token']
        teacher_headers = {'Authorization': f'Bearer {teacher_token}'}

        subjects_resp = client.get('/api/v1/subjects')
        expect(subjects_resp.status_code == 200, 'Fetch subjects failed')
        subject_id = subjects_resp.get_json()['data'][0]['id']

        students_resp = client.get('/api/v1/students', headers=teacher_headers)
        expect(students_resp.status_code == 200, 'Fetch students failed')
        students = students_resp.get_json()['data']
        demo_student = next(item for item in students if item.get('user_id'))
        student_id = demo_student['id']

        create_class_resp = client.post('/api/v1/classes', headers=teacher_headers, json={'name': 'Render smoke class', 'grade_label': '6'})
        expect(create_class_resp.status_code == 201, 'Create class failed')
        class_id = create_class_resp.get_json()['data']['id']

        add_student_resp = client.post(f'/api/v1/classes/{class_id}/students', headers=teacher_headers, json={'student_ids': [student_id]})
        expect(add_student_resp.status_code == 201, 'Add student to class failed')

        add_subject_resp = client.post(f'/api/v1/classes/{class_id}/subjects', headers=teacher_headers, json={'subject_id': subject_id})
        expect(add_subject_resp.status_code == 201, 'Add subject to class failed')

        lesson_resp = client.post('/api/v1/lessons', headers=teacher_headers, json={
            'title': 'Bai hoc truoc deploy',
            'subject_id': subject_id,
            'primary_level': 'trung_binh',
            'description': 'Smoke test lesson',
            'estimated_minutes': 10,
            'difficulty_stage': 1,
            'is_published': True,
        })
        expect(lesson_resp.status_code == 201, 'Create lesson failed')
        lesson_id = lesson_resp.get_json()['data']['id']

        activity_resp = client.post(f'/api/v1/lessons/{lesson_id}/activities', headers=teacher_headers, json={
            'title': 'Chon dap an bang giong noi',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Hay doc dap an dung',
            'voice_answer_enabled': True,
            'sort_order': 1,
            'config_json': '{"choices": ["A", "B"], "correct": "A"}',
        })
        expect(activity_resp.status_code == 201, 'Create activity failed')

        assignment_resp = client.post('/api/v1/assignments', headers=teacher_headers, json={
            'lesson_id': lesson_id,
            'class_id': class_id,
            'subject_id': subject_id,
            'target_type': 'class',
            'required_completion_percent': 80,
        })
        expect(assignment_resp.status_code == 201, 'Create assignment failed')
        assignment_id = assignment_resp.get_json()['data']['id']

        progress_resp = client.get(f'/api/v1/assignments/{assignment_id}/progress', headers=teacher_headers)
        expect(progress_resp.status_code == 200, 'Teacher progress dashboard failed')

        ai_test_resp = client.post('/api/v1/ai/settings/test', headers=teacher_headers)
        expect(ai_test_resp.status_code == 200, 'AI settings test failed')

        ai_chat_resp = client.post('/api/v1/ai/chat', headers=teacher_headers, json={'message': 'Xin chao', 'context': {'subject_name': 'Toan', 'lesson_title': 'Bai hoc truoc deploy'}})
        expect(ai_chat_resp.status_code == 200, 'AI chat failed')

        parent_login = client.post('/api/v1/auth/login', json={'identity': 'parent@example.com', 'password': '123456'})
        expect(parent_login.status_code == 200, 'Parent login failed')
        parent_token = parent_login.get_json()['data']['access_token']
        parent_headers = {'Authorization': f'Bearer {parent_token}'}
        parent_children_resp = client.get('/api/v1/parent/my-children', headers=parent_headers)
        expect(parent_children_resp.status_code == 200, 'Parent dashboard failed')

        student_login = client.post('/api/v1/auth/login', json={'identity': 'student@example.com', 'password': '123456'})
        expect(student_login.status_code == 200, 'Student login failed')
        student_token = student_login.get_json()['data']['access_token']
        student_headers = {'Authorization': f'Bearer {student_token}'}

        my_assignments_resp = client.get('/api/v1/my/assignments', headers=student_headers)
        expect(my_assignments_resp.status_code == 200, 'Student assignments failed')

        start_resp = client.post(f'/api/v1/my/assignments/{assignment_id}/start', headers=student_headers)
        expect(start_resp.status_code == 200, 'Student start assignment failed')

        update_resp = client.post(f'/api/v1/my/assignments/{assignment_id}/progress', headers=student_headers, json={
            'progress_percent': 100,
            'total_learning_seconds': 180,
            'retry_count': 1,
            'help_count': 0,
            'reward_star_count': 3,
            'completion_score': 90,
            'status': 'in_progress',
        })
        expect(update_resp.status_code == 200, 'Student progress update failed')

        complete_resp = client.post(f'/api/v1/my/assignments/{assignment_id}/complete', headers=student_headers)
        expect(complete_resp.status_code == 200, 'Student complete assignment failed')

        final_progress_resp = client.get(f'/api/v1/assignments/{assignment_id}/progress', headers=teacher_headers)
        expect(final_progress_resp.status_code == 200, 'Teacher final progress failed')

        print('Smoke test passed: auth, classes, subjects, lessons, activities, assignments, progress, parent dashboard, AI settings, AI chat')


if __name__ == '__main__':
    main()
