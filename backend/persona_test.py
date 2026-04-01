from __future__ import annotations

import app.api.v1.routes.ai_settings as ai_routes
from app import create_app
from app.extensions import db
from app.models import Subject, UserAISetting
from app.services.gemini_service import GeminiResult
from app.services.seed_service import seed_admin_user, seed_subjects
from app.utils.security import encrypt_secret

PASSWORD = '123456'
STUDENT_LEVELS = ['nhe', 'trung_binh', 'nang', 'nhe', 'trung_binh', 'nang', 'nhe', 'trung_binh', 'nang', 'nhe']
TEACHER_STUDENT_COUNTS = [4, 3, 3]


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def api_json(response):
    payload = response.get_json()
    expect(payload is not None, 'Response is not valid JSON')
    return payload


def auth_headers(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


def login(client, email: str, password: str) -> tuple[str, dict]:
    response = client.post('/api/v1/auth/login', json={'identity': email, 'password': password})
    expect(response.status_code == 200, f'Login failed for {email}')
    payload = api_json(response)['data']
    return payload['access_token'], payload['user']


def create_teacher_by_admin(client, admin_token: str, index: int) -> dict[str, object]:
    response = client.post('/api/v1/admin/teachers', headers=auth_headers(admin_token), json={
        'full_name': f'Giao vien {index}',
        'email': f'teacher{index}@example.com',
        'password': PASSWORD,
        'school_name': f'Truong {index}',
    })
    expect(response.status_code == 201, f'Admin could not create teacher {index}')
    data = api_json(response)['data']
    return {
        'email': f'teacher{index}@example.com',
        'password': PASSWORD,
        'user_id': data['user']['id'],
        'profile_id': data['profile']['id'],
        'full_name': data['profile']['full_name'],
    }


def register_student(client, index: int, disability_level: str, prefix: str = 'student') -> dict[str, object]:
    email = f'{prefix}{index}@example.com'
    response = client.post('/api/v1/auth/register', json={
        'role': 'student',
        'full_name': f'Hoc sinh {index:02d}',
        'email': email,
        'password': PASSWORD,
        'disability_level': disability_level,
    })
    expect(response.status_code == 201, f'Could not register student {index}')
    data = api_json(response)['data']
    return {
        'email': email,
        'password': PASSWORD,
        'profile_id': data['profile']['id'],
        'full_name': data['profile']['full_name'],
        'disability_level': disability_level,
        'access_token': data['access_token'],
    }


def register_parent(client, index: int, prefix: str = 'parent') -> dict[str, object]:
    email = f'{prefix}{index}@example.com'
    response = client.post('/api/v1/auth/register', json={
        'role': 'parent',
        'full_name': f'Phu huynh {index:02d}',
        'email': email,
        'password': PASSWORD,
        'relationship_label': 'Phu huynh',
    })
    expect(response.status_code == 201, f'Could not register parent {index}')
    data = api_json(response)['data']
    return {
        'email': email,
        'password': PASSWORD,
        'profile_id': data['profile']['id'],
        'access_token': data['access_token'],
    }


def ensure_ai_setting(teacher_user_id: int) -> None:
    setting = UserAISetting.query.filter_by(user_id=teacher_user_id, provider='gemini').first()
    if setting:
        return
    db.session.add(
        UserAISetting(
            user_id=teacher_user_id,
            provider='gemini',
            model_name='gemini-2.5-flash',
            api_key_encrypted=encrypt_secret('fake-key'),
            api_key_masked='fake****key',
            status='active',
        )
    )
    db.session.commit()


def create_teacher_bundle(client, teacher: dict[str, object], student_accounts: list[dict[str, object]], subject_id: int) -> dict[str, object]:
    teacher_token, _teacher_user = login(client, str(teacher['email']), str(teacher['password']))
    headers = auth_headers(teacher_token)

    class_response = client.post('/api/v1/classes', headers=headers, json={'name': f"Lop cua {teacher['full_name']}", 'grade_label': '6'})
    expect(class_response.status_code == 201, f"Teacher {teacher['email']} could not create class")
    class_data = api_json(class_response)['data']
    class_id = class_data['id']
    class_password = class_data['join_credential']['class_password']

    for student in student_accounts:
        join_response = client.post('/api/v1/my/classes/join', headers=auth_headers(str(student['access_token'])), json={
            'class_id': class_id,
            'class_password': class_password,
        })
        expect(join_response.status_code == 201, f"Student {student['email']} could not join class {class_id}")

    students_response = client.get('/api/v1/students', headers=headers)
    expect(students_response.status_code == 200, f"List students failed for {teacher['email']}")
    own_student_ids = {item['id'] for item in api_json(students_response)['data']}
    expect(own_student_ids == {student['profile_id'] for student in student_accounts}, f"Teacher {teacher['email']} cannot see expected students after self-join")

    add_subject_response = client.post(f'/api/v1/classes/{class_id}/subjects', headers=headers, json={'subject_id': subject_id})
    expect(add_subject_response.status_code == 201, f"Teacher {teacher['email']} could not add subject to class")

    lesson_response = client.post('/api/v1/lessons', headers=headers, json={
        'title': f"Bai hoc cua {teacher['full_name']}",
        'subject_id': subject_id,
        'primary_level': 'trung_binh',
        'description': f"Lesson for {teacher['full_name']}",
        'estimated_minutes': 20,
        'difficulty_stage': 1,
        'is_published': True,
    })
    expect(lesson_response.status_code == 201, f"Teacher {teacher['email']} could not create lesson")
    lesson_id = api_json(lesson_response)['data']['id']

    activity_response = client.post(f'/api/v1/lessons/{lesson_id}/activities', headers=headers, json={
        'title': 'Chon dap an bang giong noi',
        'activity_type': 'multiple_choice',
        'instruction_text': 'Hay doc dap an dung',
        'voice_answer_enabled': True,
        'sort_order': 1,
        'config_json': '{"choices": ["A", "B"], "correct": "A"}',
    })
    expect(activity_response.status_code == 201, f"Teacher {teacher['email']} could not create lesson activity")

    assignment_response = client.post('/api/v1/assignments', headers=headers, json={
        'lesson_id': lesson_id,
        'class_id': class_id,
        'subject_id': subject_id,
        'target_type': 'class',
        'required_completion_percent': 80,
    })
    expect(assignment_response.status_code == 201, f"Teacher {teacher['email']} could not create assignment")
    assignment_id = api_json(assignment_response)['data']['id']

    return {
        'token': teacher_token,
        'class_id': class_id,
        'class_password': class_password,
        'lesson_id': lesson_id,
        'assignment_id': assignment_id,
        'teacher_profile_id': teacher['profile_id'],
    }


def simulate_student_progress(client, student: dict[str, object], assignment_id: int) -> str:
    token, _user = login(client, str(student['email']), str(student['password']))
    headers = auth_headers(token)

    my_assignments_response = client.get('/api/v1/my/assignments', headers=headers)
    expect(my_assignments_response.status_code == 200, f"{student['email']} could not fetch assignments")
    assignments = api_json(my_assignments_response)['data']
    expect(any(item['assignment_id'] == assignment_id for item in assignments), f"{student['email']} did not receive assignment {assignment_id}")

    start_response = client.post(f'/api/v1/my/assignments/{assignment_id}/start', headers=headers)
    expect(start_response.status_code == 200, f"{student['email']} could not start assignment")

    disability_level = str(student['disability_level'])
    if disability_level == 'nhe':
        progress_response = client.post(f'/api/v1/my/assignments/{assignment_id}/progress', headers=headers, json={
            'progress_percent': 100,
            'total_learning_seconds': 180,
            'retry_count': 0,
            'help_count': 0,
            'reward_star_count': 3,
            'completion_score': 95,
            'status': 'completed',
        })
        expect(progress_response.status_code == 200, f"{student['email']} could not update progress")
        complete_response = client.post(f'/api/v1/my/assignments/{assignment_id}/complete', headers=headers)
        expect(complete_response.status_code == 200, f"{student['email']} could not complete assignment")
        return 'san_sang_nang_do_kho'

    if disability_level == 'trung_binh':
        progress_response = client.post(f'/api/v1/my/assignments/{assignment_id}/progress', headers=headers, json={
            'progress_percent': 75,
            'total_learning_seconds': 240,
            'retry_count': 1,
            'help_count': 1,
            'reward_star_count': 2,
            'completion_score': 72,
            'status': 'in_progress',
        })
        expect(progress_response.status_code == 200, f"{student['email']} could not update progress")
        return 'dang_phu_hop'

    progress_response = client.post(f'/api/v1/my/assignments/{assignment_id}/progress', headers=headers, json={
        'progress_percent': 60,
        'total_learning_seconds': 360,
        'retry_count': 3,
        'help_count': 4,
        'reward_star_count': 1,
        'completion_score': 40,
        'status': 'in_progress',
    })
    expect(progress_response.status_code == 200, f"{student['email']} could not update progress")
    return 'can_ho_tro_them'


def link_parent_accounts(client, teacher_token: str, students: list[dict[str, object]], parents: list[dict[str, object]]) -> None:
    headers = auth_headers(teacher_token)
    for student, parent in zip(students, parents):
        response = client.post(f"/api/v1/students/{student['profile_id']}/parents/link", headers=headers, json={'parent_id': parent['profile_id']})
        expect(response.status_code == 201, f"Could not link parent for {student['email']}")


def send_teacher_reports(client, teacher_token: str) -> None:
    response = client.post('/api/v1/teacher/reports/send', headers=auth_headers(teacher_token), json={'note': 'Bao cao tu dong cuoi ngay.'})
    expect(response.status_code == 201, 'Teacher could not send daily reports')
    expect(len(api_json(response)['data']) >= 1, 'Teacher daily reports payload empty')


def verify_parent_dashboards(client, parents: list[dict[str, object]]) -> None:
    for parent in parents:
        token, user_payload = login(client, str(parent['email']), str(parent['password']))
        expect(user_payload['role'] == 'parent', f"{parent['email']} is not a parent account")
        dashboard_response = client.get('/api/v1/parent/my-children', headers=auth_headers(token))
        expect(dashboard_response.status_code == 200, f"{parent['email']} could not fetch dashboard")
        children = api_json(dashboard_response)['data']
        expect(len(children) >= 1, f"{parent['email']} dashboard is empty")
        reports_response = client.get('/api/v1/parent/reports', headers=auth_headers(token))
        expect(reports_response.status_code == 200, f"{parent['email']} could not fetch reports")
        expect(len(api_json(reports_response)['data']) >= 1, f"{parent['email']} has no delivered report")


def verify_email_only_parent_creation(client) -> None:
    first_response = client.post('/api/v1/auth/register', json={
        'role': 'parent',
        'full_name': 'Phu huynh email only 1',
        'email': 'email-only-1@example.com',
        'password': PASSWORD,
    })
    expect(first_response.status_code == 201, 'Could not create first email-only parent')

    second_response = client.post('/api/v1/auth/register', json={
        'role': 'parent',
        'full_name': 'Phu huynh email only 2',
        'email': 'email-only-2@example.com',
        'password': PASSWORD,
    })
    expect(second_response.status_code == 201, 'Could not create second email-only parent')


def probe_access_control(client, teacher_a: dict[str, object], teacher_b_token: str, foreign_student_id: int) -> None:
    headers = auth_headers(teacher_b_token)

    class_response = client.get(f"/api/v1/classes/{teacher_a['class_id']}", headers=headers)
    expect(class_response.status_code == 404, 'Teacher should not access another teacher class')

    progress_response = client.get(f"/api/v1/assignments/{teacher_a['assignment_id']}/progress", headers=headers)
    expect(progress_response.status_code == 404, 'Teacher should not access another teacher assignment progress')

    probe_class_response = client.post('/api/v1/classes', headers=headers, json={'name': 'Probe cross teacher class', 'grade_label': '7'})
    expect(probe_class_response.status_code == 201, 'Could not create probe class')
    probe_class_id = api_json(probe_class_response)['data']['id']

    cross_add_response = client.post(f'/api/v1/classes/{probe_class_id}/students', headers=headers, json={'student_ids': [foreign_student_id]})
    expect(cross_add_response.status_code == 422, "Teacher should not add another teacher's student without a relationship")

    student_detail_response = client.get(f'/api/v1/students/{foreign_student_id}', headers=headers)
    expect(student_detail_response.status_code == 404, "Teacher should not read another teacher's student profile by direct id")


def verify_shared_student_multi_teacher(client, bundles: list[dict[str, object]], teachers: list[dict[str, object]]) -> None:
    shared_student = register_student(client, 99, 'trung_binh', prefix='shared-student-')
    shared_parent = register_parent(client, 99, prefix='shared-parent-')

    join_one = client.post('/api/v1/my/classes/join', headers=auth_headers(shared_student['access_token']), json={
        'class_id': bundles[0]['class_id'],
        'class_password': bundles[0]['class_password'],
    })
    join_two = client.post('/api/v1/my/classes/join', headers=auth_headers(shared_student['access_token']), json={
        'class_id': bundles[1]['class_id'],
        'class_password': bundles[1]['class_password'],
    })
    expect(join_one.status_code == 201 and join_two.status_code == 201, 'Shared student could not join two teacher classes')

    students_one = client.get('/api/v1/students', headers=auth_headers(str(bundles[0]['token'])))
    students_two = client.get('/api/v1/students', headers=auth_headers(str(bundles[1]['token'])))
    expect(any(item['id'] == shared_student['profile_id'] for item in api_json(students_one)['data']), 'Teacher 1 missing shared student')
    expect(any(item['id'] == shared_student['profile_id'] for item in api_json(students_two)['data']), 'Teacher 2 missing shared student')

    link_one = client.post(f"/api/v1/students/{shared_student['profile_id']}/parents/link", headers=auth_headers(str(bundles[0]['token'])), json={'parent_id': shared_parent['profile_id']})
    link_two = client.post(f"/api/v1/students/{shared_student['profile_id']}/parents/link", headers=auth_headers(str(bundles[1]['token'])), json={'parent_id': shared_parent['profile_id']})
    expect(link_one.status_code == 201 and link_two.status_code == 201, 'Shared parent could not be linked by both teachers')

    report_one = client.post('/api/v1/teacher/reports/send', headers=auth_headers(str(bundles[0]['token'])), json={'student_id': shared_student['profile_id'], 'note': 'Bao cao giao vien 1'})
    report_two = client.post('/api/v1/teacher/reports/send', headers=auth_headers(str(bundles[1]['token'])), json={'student_id': shared_student['profile_id'], 'note': 'Bao cao giao vien 2'})
    expect(report_one.status_code == 201 and report_two.status_code == 201, 'Shared student reports failed')

    parent_dashboard = client.get('/api/v1/parent/my-children', headers=auth_headers(shared_parent['access_token']))
    expect(parent_dashboard.status_code == 200, 'Shared parent dashboard failed')
    children = api_json(parent_dashboard)['data']
    expect(len(children) == 1, 'Shared parent should only have one child')
    teacher_ids = {item['id'] for item in children[0]['teachers']}
    expect(int(teachers[0]['profile_id']) in teacher_ids and int(teachers[1]['profile_id']) in teacher_ids, 'Shared parent does not see both teachers')

    parent_reports = client.get('/api/v1/parent/reports', headers=auth_headers(shared_parent['access_token']))
    expect(parent_reports.status_code == 200, 'Shared parent reports failed')
    report_teacher_ids = {item['teacher_id'] for item in api_json(parent_reports)['data']}
    expect(int(teachers[0]['profile_id']) in report_teacher_ids and int(teachers[1]['profile_id']) in report_teacher_ids, 'Shared parent missing reports from one teacher')


def main() -> None:
    app = create_app('testing')

    with app.app_context():
        db.create_all()
        seed_subjects()
        seed_admin_user(email='admin@example.com', password=PASSWORD)

        def fake_generate_text(**kwargs):
            return GeminiResult(
                text=f"Gemini mock response for {kwargs['model_name']}",
                model_name=kwargs['model_name'],
                prompt_feedback=None,
                usage_metadata={'promptTokenCount': 16},
                raw_response={'mocked': True},
            )

        ai_routes.generate_text = fake_generate_text
        client = app.test_client()

        admin_token, _admin_user = login(client, 'admin@example.com', PASSWORD)

        teachers = [create_teacher_by_admin(client, admin_token, index) for index in range(1, 4)]

        student_groups: list[list[dict[str, object]]] = []
        parent_groups: list[list[dict[str, object]]] = []
        cursor = 0
        for count in TEACHER_STUDENT_COUNTS:
            student_group: list[dict[str, object]] = []
            parent_group: list[dict[str, object]] = []
            for _ in range(count):
                cursor += 1
                student_group.append(register_student(client, cursor, STUDENT_LEVELS[cursor - 1]))
                parent_group.append(register_parent(client, cursor))
            student_groups.append(student_group)
            parent_groups.append(parent_group)

        ensure_ai_setting(int(teachers[0]['user_id']))

        subject = Subject.query.order_by(Subject.id.asc()).first()
        expect(subject is not None, 'No subject found after seeding')
        subject_id = int(subject.id)

        bundles: list[dict[str, object]] = []
        all_parents: list[dict[str, object]] = []
        for teacher, students, parents in zip(teachers, student_groups, parent_groups):
            bundle = create_teacher_bundle(client, teacher, students, subject_id)
            bundles.append(bundle)
            link_parent_accounts(client, str(bundle['token']), students, parents)
            all_parents.extend(parents)

        readiness_counts = {
            'san_sang_nang_do_kho': 0,
            'dang_phu_hop': 0,
            'can_ho_tro_them': 0,
        }
        for bundle, students in zip(bundles, student_groups):
            for student in students:
                readiness = simulate_student_progress(client, student, int(bundle['assignment_id']))
                readiness_counts[readiness] += 1

        for bundle in bundles:
            send_teacher_reports(client, str(bundle['token']))

        verify_shared_student_multi_teacher(client, bundles, teachers)

        teacher_one_headers = auth_headers(str(bundles[0]['token']))
        ai_test_response = client.post('/api/v1/ai/settings/test', headers=teacher_one_headers)
        expect(ai_test_response.status_code == 200, 'AI settings test failed')
        ai_chat_response = client.post('/api/v1/ai/chat', headers=teacher_one_headers, json={'message': 'Huong dan ngan gon', 'context': {'subject_name': 'Toan', 'lesson_title': 'Bai hoc persona'}})
        expect(ai_chat_response.status_code == 200, 'AI chat failed')

        final_progress_response = client.get(f"/api/v1/assignments/{bundles[0]['assignment_id']}/progress", headers=teacher_one_headers)
        expect(final_progress_response.status_code == 200, 'Teacher progress dashboard failed')
        summary = api_json(final_progress_response)['data']['summary']
        expect(summary['student_count'] == len(student_groups[0]), 'Teacher progress student count mismatch')

        teacher_group_response = client.get('/api/v1/teacher/parent-groups', headers=teacher_one_headers)
        expect(teacher_group_response.status_code == 200, 'Teacher parent group endpoint failed')
        expect(len(api_json(teacher_group_response)['data']) >= len(student_groups[0]), 'Teacher parent group size mismatch')

        teacher_shared_response = client.get('/api/v1/teacher/shared-students', headers=teacher_one_headers)
        expect(teacher_shared_response.status_code == 200, 'Teacher shared students endpoint failed')
        expect(any(item['peer_teachers'] for item in api_json(teacher_shared_response)['data']), 'Teacher shared students should expose at least one peer teacher')

        teacher_reports_response = client.get('/api/v1/teacher/reports', headers=teacher_one_headers)
        expect(teacher_reports_response.status_code == 200, 'Teacher reports endpoint failed')
        expect(len(api_json(teacher_reports_response)['data']) >= len(student_groups[0]), 'Teacher report history too short')

        verify_parent_dashboards(client, all_parents)
        verify_email_only_parent_creation(client)
        probe_access_control(client, bundles[0], str(bundles[1]['token']), int(student_groups[0][0]['profile_id']))

        print('Persona test passed')
        print(f"- Teachers simulated: {len(teachers)}")
        print(f"- Students simulated: {sum(len(group) for group in student_groups)} + 1 shared student")
        print(f"- Parents simulated: {len(all_parents)} + 1 shared parent")
        print(f"- Readiness summary: {readiness_counts}")
        print('- Multi-teacher student links, parent linkage, daily reports, and access control: passed')


if __name__ == '__main__':
    main()
