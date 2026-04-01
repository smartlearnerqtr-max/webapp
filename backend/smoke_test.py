from __future__ import annotations

import app.api.v1.routes.ai_settings as ai_routes
from app import create_app
from app.extensions import db
from app.models import UserAISetting
from app.services.gemini_service import GeminiResult
from app.services.seed_service import seed_admin_user, seed_subjects
from app.utils.security import encrypt_secret


PASSWORD = '123456'


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    app = create_app('testing')

    with app.app_context():
        db.create_all()
        seed_subjects()
        seed_admin_user(email='admin@example.com', password=PASSWORD)

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

        admin_login = client.post('/api/v1/auth/login', json={'identity': 'admin@example.com', 'password': PASSWORD})
        expect(admin_login.status_code == 200, 'Admin login failed')
        admin_token = admin_login.get_json()['data']['access_token']
        admin_headers = {'Authorization': f'Bearer {admin_token}'}

        teacher1_create = client.post('/api/v1/admin/teachers', headers=admin_headers, json={
            'full_name': 'Giao vien 1',
            'email': 'teacher1@example.com',
            'password': PASSWORD,
            'school_name': 'Truong 1',
        })
        teacher2_create = client.post('/api/v1/admin/teachers', headers=admin_headers, json={
            'full_name': 'Giao vien 2',
            'email': 'teacher2@example.com',
            'password': PASSWORD,
            'school_name': 'Truong 2',
        })
        expect(teacher1_create.status_code == 201 and teacher2_create.status_code == 201, 'Admin create teacher failed')
        teacher1_payload = teacher1_create.get_json()['data']
        teacher2_payload = teacher2_create.get_json()['data']

        student_register = client.post('/api/v1/auth/register', json={
            'role': 'student',
            'full_name': 'Hoc sinh dung chung',
            'email': 'shared-student@example.com',
            'password': PASSWORD,
            'disability_level': 'trung_binh',
        })
        expect(student_register.status_code == 201, 'Student register failed')
        student_payload = student_register.get_json()['data']
        student_id = student_payload['profile']['id']
        student_headers = {'Authorization': f"Bearer {student_payload['access_token']}"}

        parent_register = client.post('/api/v1/auth/register', json={
            'role': 'parent',
            'full_name': 'Phu huynh dung chung',
            'email': 'shared-parent@example.com',
            'password': PASSWORD,
            'relationship_label': 'Me',
        })
        expect(parent_register.status_code == 201, 'Parent register failed')
        parent_payload = parent_register.get_json()['data']
        parent_id = parent_payload['profile']['id']
        parent_headers = {'Authorization': f"Bearer {parent_payload['access_token']}"}

        teacher1_login = client.post('/api/v1/auth/login', json={'identity': 'teacher1@example.com', 'password': PASSWORD})
        teacher2_login = client.post('/api/v1/auth/login', json={'identity': 'teacher2@example.com', 'password': PASSWORD})
        expect(teacher1_login.status_code == 200 and teacher2_login.status_code == 200, 'Teacher login failed')
        teacher1_token = teacher1_login.get_json()['data']['access_token']
        teacher2_token = teacher2_login.get_json()['data']['access_token']
        teacher1_headers = {'Authorization': f'Bearer {teacher1_token}'}
        teacher2_headers = {'Authorization': f'Bearer {teacher2_token}'}

        setting = UserAISetting.query.filter_by(user_id=teacher1_payload['user']['id'], provider='gemini').first()
        if not setting:
            setting = UserAISetting(
                user_id=teacher1_payload['user']['id'],
                provider='gemini',
                model_name='gemini-2.5-flash',
                api_key_encrypted=encrypt_secret('fake-key'),
                api_key_masked='fake****key',
                status='active',
            )
            db.session.add(setting)
            db.session.commit()

        subjects_resp = client.get('/api/v1/subjects')
        expect(subjects_resp.status_code == 200, 'Fetch subjects failed')
        subject_id = subjects_resp.get_json()['data'][0]['id']

        class1_resp = client.post('/api/v1/classes', headers=teacher1_headers, json={'name': 'Lop giao vien 1', 'grade_label': '6'})
        class2_resp = client.post('/api/v1/classes', headers=teacher2_headers, json={'name': 'Lop giao vien 2', 'grade_label': '6'})
        expect(class1_resp.status_code == 201 and class2_resp.status_code == 201, 'Create class failed')
        class1_payload = class1_resp.get_json()['data']
        class2_payload = class2_resp.get_json()['data']

        join1_resp = client.post('/api/v1/my/classes/join', headers=student_headers, json={
            'class_id': class1_payload['id'],
            'class_password': class1_payload['join_credential']['class_password'],
        })
        join2_resp = client.post('/api/v1/my/classes/join', headers=student_headers, json={
            'class_id': class2_payload['id'],
            'class_password': class2_payload['join_credential']['class_password'],
        })
        expect(join1_resp.status_code == 201 and join2_resp.status_code == 201, 'Shared student join multi teacher classes failed')

        teacher1_students = client.get('/api/v1/students', headers=teacher1_headers)
        teacher2_students = client.get('/api/v1/students', headers=teacher2_headers)
        expect(any(item['id'] == student_id for item in teacher1_students.get_json()['data']), 'Teacher 1 cannot see shared student')
        expect(any(item['id'] == student_id for item in teacher2_students.get_json()['data']), 'Teacher 2 cannot see shared student')

        student_teacher_view_teacher = client.get(f'/api/v1/students/{student_id}/teachers', headers=teacher1_headers)
        expect(student_teacher_view_teacher.status_code == 200, 'Teacher cannot inspect student teacher links')
        expect(len(student_teacher_view_teacher.get_json()['data']) == 2, 'Teacher teacher-link view mismatch')

        teacher_shared_students = client.get('/api/v1/teacher/shared-students', headers=teacher1_headers)
        expect(teacher_shared_students.status_code == 200, 'Teacher shared-students endpoint failed')
        shared_students_payload = teacher_shared_students.get_json()['data']
        expect(any(item['student']['id'] == student_id for item in shared_students_payload), 'Teacher shared-students payload missing shared student')

        student_teacher_view_student = client.get('/api/v1/my/teachers', headers=student_headers)
        expect(student_teacher_view_student.status_code == 200, 'Student cannot inspect own teacher links')
        expect(len(student_teacher_view_student.get_json()['data']) == 2, 'Student teacher-link view mismatch')

        link1_resp = client.post(f'/api/v1/students/{student_id}/parents/link', headers=teacher1_headers, json={'parent_id': parent_id})
        link2_resp = client.post(f'/api/v1/students/{student_id}/parents/link', headers=teacher2_headers, json={'parent_id': parent_id})
        expect(link1_resp.status_code == 201 and link2_resp.status_code == 201, 'Teachers could not both link same parent/student')

        group1_resp = client.get('/api/v1/teacher/parent-groups', headers=teacher1_headers)
        group2_resp = client.get('/api/v1/teacher/parent-groups', headers=teacher2_headers)
        expect(any(item['student']['id'] == student_id for item in group1_resp.get_json()['data']), 'Teacher 1 parent group missing shared student')
        expect(any(item['student']['id'] == student_id for item in group2_resp.get_json()['data']), 'Teacher 2 parent group missing shared student')

        admin_relationships = client.get('/api/v1/admin/relationships/overview', headers=admin_headers)
        expect(admin_relationships.status_code == 200, 'Admin relationships overview failed')
        expect(admin_relationships.get_json()['data']['summary']['shared_student_count'] >= 1, 'Admin overview missing shared student')

        lesson_resp = client.post('/api/v1/lessons', headers=teacher1_headers, json={
            'title': 'Bai hoc giao vien 1',
            'subject_id': subject_id,
            'primary_level': 'trung_binh',
            'description': 'Smoke test lesson',
            'estimated_minutes': 10,
            'difficulty_stage': 1,
            'is_published': True,
        })
        expect(lesson_resp.status_code == 201, 'Create lesson failed')
        lesson_id = lesson_resp.get_json()['data']['id']

        activity_resp = client.post(f'/api/v1/lessons/{lesson_id}/activities', headers=teacher1_headers, json={
            'title': 'Chon dap an bang giong noi',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Hay doc dap an dung',
            'voice_answer_enabled': True,
            'sort_order': 1,
            'config_json': '{"choices": ["A", "B"], "correct": "A"}',
        })
        expect(activity_resp.status_code == 201, 'Create activity failed')

        add_subject_resp = client.post(f'/api/v1/classes/{class1_payload["id"]}/subjects', headers=teacher1_headers, json={'subject_id': subject_id})
        expect(add_subject_resp.status_code == 201, 'Add subject to class failed')

        assignment_resp = client.post('/api/v1/assignments', headers=teacher1_headers, json={
            'lesson_id': lesson_id,
            'class_id': class1_payload['id'],
            'subject_id': subject_id,
            'target_type': 'class',
            'required_completion_percent': 80,
        })
        expect(assignment_resp.status_code == 201, 'Create assignment failed')
        assignment_id = assignment_resp.get_json()['data']['id']

        my_assignments_resp = client.get('/api/v1/my/assignments', headers=student_headers)
        expect(my_assignments_resp.status_code == 200, 'Student assignments failed')
        expect(any(item['assignment_id'] == assignment_id for item in my_assignments_resp.get_json()['data']), 'Shared student missing assignment from teacher 1')

        start_resp = client.post(f'/api/v1/my/assignments/{assignment_id}/start', headers=student_headers)
        update_resp = client.post(f'/api/v1/my/assignments/{assignment_id}/progress', headers=student_headers, json={
            'progress_percent': 85,
            'total_learning_seconds': 180,
            'retry_count': 1,
            'help_count': 0,
            'reward_star_count': 3,
            'completion_score': 88,
            'status': 'in_progress',
        })
        expect(start_resp.status_code == 200 and update_resp.status_code == 200, 'Student progress flow failed')

        report1_resp = client.post('/api/v1/teacher/reports/send', headers=teacher1_headers, json={'student_id': student_id, 'note': 'Bao cao tu giao vien 1'})
        report2_resp = client.post('/api/v1/teacher/reports/send', headers=teacher2_headers, json={'student_id': student_id, 'note': 'Bao cao tu giao vien 2'})
        expect(report1_resp.status_code == 201 and report2_resp.status_code == 201, 'Teacher send parent report failed')

        parent_children_resp = client.get('/api/v1/parent/my-children', headers=parent_headers)
        expect(parent_children_resp.status_code == 200, 'Parent dashboard failed')
        parent_children = parent_children_resp.get_json()['data']
        expect(len(parent_children) == 1, 'Parent dashboard child count mismatch')
        teacher_ids = {teacher['id'] for teacher in parent_children[0]['teachers']}
        expect(teacher1_payload['profile']['id'] in teacher_ids and teacher2_payload['profile']['id'] in teacher_ids, 'Parent dashboard missing one of the teachers')

        parent_reports_resp = client.get('/api/v1/parent/reports', headers=parent_headers)
        expect(parent_reports_resp.status_code == 200, 'Parent reports failed')
        report_teacher_ids = {item['teacher_id'] for item in parent_reports_resp.get_json()['data']}
        expect(teacher1_payload['profile']['id'] in report_teacher_ids and teacher2_payload['profile']['id'] in report_teacher_ids, 'Parent did not receive reports from both teachers')

        ai_test_resp = client.post('/api/v1/ai/settings/test', headers=teacher1_headers)
        ai_chat_resp = client.post('/api/v1/ai/chat', headers=teacher1_headers, json={'message': 'Xin chao', 'context': {'subject_name': 'Toan', 'lesson_title': 'Bai hoc giao vien 1'}})
        expect(ai_test_resp.status_code == 200 and ai_chat_resp.status_code == 200, 'AI flow failed')

        print('Smoke test passed: UI-facing relationship endpoints, one student can study with multiple teachers, one parent can follow the same child across multiple teachers, and reports stay separated by teacher')


if __name__ == '__main__':
    main()
