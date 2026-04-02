from __future__ import annotations

from datetime import date

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import ParentDailyReport, ParentProfile, ParentStudentLink, StudentLessonProgress, StudentProfile, TeacherParentStudentLink, TeacherProfile, User
from ....services.logger import log_server_event
from ....services.realtime_service import publish_realtime_event
from ....services.relationship_service import (
    ensure_parent_student_link,
    ensure_teacher_parent_student_link,
    sync_legacy_teacher_parent_links,
    sync_legacy_teacher_student_links,
    teacher_has_student_access,
)
from ....utils.responses import error_response, success_response
from .. import api_v1


def _current_user() -> User | None:
    return User.query.get(get_jwt_identity())


def _require_teacher_user():
    if get_jwt().get('role') != 'teacher':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = _current_user()
    if not user or not user.teacher_profile:
        return None, error_response('Khong tim thay giao vien', 'TEACHER_NOT_FOUND', 404)
    return user, None


def _require_parent_user():
    if get_jwt().get('role') != 'parent':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = _current_user()
    if not user or not user.parent_profile:
        return None, error_response('Khong tim thay phu huynh', 'PARENT_NOT_FOUND', 404)
    return user, None


def _build_parent_payload(parent: ParentProfile) -> dict[str, object]:
    return {
        **parent.to_dict(),
        'email': parent.user.email if parent.user else None,
        'phone': parent.user.phone if parent.user else None,
    }


def _build_teacher_payload(teacher: TeacherProfile) -> dict[str, object]:
    return {
        **teacher.to_dict(),
        'email': teacher.user.email if teacher.user else None,
        'phone': teacher.user.phone if teacher.user else None,
    }


def _build_readiness_snapshot(progress: StudentLessonProgress | None) -> dict[str, object]:
    if not progress:
        return {
            'readiness_status': 'dang_phu_hop',
            'last_progress_percent': 0,
            'help_count': 0,
            'retry_count': 0,
            'completion_score': 0,
        }

    status = 'dang_phu_hop'
    if progress.status != 'completed' and progress.help_count >= 3:
        status = 'can_ho_tro_them'
    elif progress.completion_score >= 80 and progress.retry_count <= 1 and progress.help_count <= 1 and progress.progress_percent >= 100:
        status = 'san_sang_nang_do_kho'

    if progress.retry_count >= 3 or (progress.completion_score < 50 and progress.progress_percent >= 50):
        status = 'can_ho_tro_them'

    return {
        'readiness_status': status,
        'last_progress_percent': progress.progress_percent,
        'help_count': progress.help_count,
        'retry_count': progress.retry_count,
        'completion_score': progress.completion_score,
    }


def _build_progress_summary(student_id: int) -> dict[str, object]:
    progresses = StudentLessonProgress.query.filter_by(student_id=student_id).all()
    latest_progresses = sorted(progresses, key=lambda item: item.updated_at or item.created_at, reverse=True)
    last_item = latest_progresses[0] if latest_progresses else None
    readiness = _build_readiness_snapshot(last_item)
    return {
        'total_assignments': len(progresses),
        'completed_count': len([item for item in progresses if item.status == 'completed']),
        'in_progress_count': len([item for item in progresses if item.status == 'in_progress']),
        'last_assignment_title': last_item.assignment.lesson.title if last_item and last_item.assignment and last_item.assignment.lesson else None,
        'last_progress_percent': readiness['last_progress_percent'],
        'readiness_status': readiness['readiness_status'],
        'help_count': readiness['help_count'],
        'retry_count': readiness['retry_count'],
        'completion_score': readiness['completion_score'],
    }


def _build_report_payload(report: ParentDailyReport) -> dict[str, object]:
    return {
        **report.to_dict(),
        'parent': _build_parent_payload(report.parent) if report.parent else None,
        'student': report.student.to_dict() if report.student else None,
        'teacher': _build_teacher_payload(report.teacher) if report.teacher else None,
    }


def _recommendation_for_status(status: str) -> str:
    if status == 'can_ho_tro_them':
        return 'Nen trao doi them voi giao vien de bo sung ho tro va on lai bai cho con.'
    if status == 'san_sang_nang_do_kho':
        return 'Con dang hoc tot. Gia dinh co the dong vien de con thu them bai nang hon.'
    return 'Con dang theo kip tien do hien tai. Gia dinh tiep tuc nhac con hoc deu moi ngay.'


def _user_ids_for_parent_links(links: list[TeacherParentStudentLink]) -> list[int]:
    return sorted({link.parent.user_id for link in links if link.parent and link.parent.user_id})


def _build_group_item(link: TeacherParentStudentLink) -> dict[str, object]:
    latest_report = ParentDailyReport.query.filter_by(
        teacher_id=link.teacher_id,
        parent_id=link.parent_id,
        student_id=link.student_id,
    ).order_by(ParentDailyReport.report_date.desc(), ParentDailyReport.created_at.desc()).first()
    active_classes = [
        class_link.classroom.to_dict()
        for class_link in link.student.classrooms
        if class_link.status == 'active' and class_link.classroom and class_link.classroom.status == 'active' and class_link.classroom.teacher_id == link.teacher_id
    ] if link.student else []
    return {
        'link_id': link.id,
        'status': link.status,
        'parent': _build_parent_payload(link.parent) if link.parent else None,
        'student': link.student.to_dict() if link.student else None,
        'classes': active_classes,
        'progress_summary': _build_progress_summary(link.student_id),
        'latest_report': _build_report_payload(latest_report) if latest_report else None,
    }


@api_v1.get('/parents')
@jwt_required()
def list_parents():
    user, error = _require_teacher_user()
    if error:
        return error

    if sync_legacy_teacher_parent_links(user.teacher_profile.id):
        db.session.commit()

    query = ParentProfile.query
    if request.args.get('q'):
        keyword = f"%{request.args['q'].strip()}%"
        query = query.join(User).filter(
            (ParentProfile.full_name.ilike(keyword)) |
            (User.email.ilike(keyword)) |
            (User.phone.ilike(keyword))
        )
    parents = query.order_by(ParentProfile.full_name.asc()).limit(100).all()

    payload = []
    for parent in parents:
        parent_data = _build_parent_payload(parent)
        linked_students = []
        teacher_links = TeacherParentStudentLink.query.filter_by(teacher_id=user.teacher_profile.id, parent_id=parent.id, status='active').all()
        for link in teacher_links:
            if not link.student:
                continue
            linked_students.append(link.student.to_dict())
        payload.append({
            **parent_data,
            'students': linked_students,
        })

    return success_response(payload)


@api_v1.post('/parents')
@jwt_required()
def create_parent():
    user, error = _require_teacher_user()
    if error:
        return error
    return error_response('Phu huynh can tu dang ky tai khoan', 'AUTH_FORBIDDEN', 403)


@api_v1.get('/teacher/parent-groups')
@jwt_required()
def list_teacher_parent_groups():
    user, error = _require_teacher_user()
    if error:
        return error

    if sync_legacy_teacher_parent_links(user.teacher_profile.id):
        db.session.commit()

    query = TeacherParentStudentLink.query.filter_by(teacher_id=user.teacher_profile.id, status='active')
    if request.args.get('student_id'):
        query = query.filter_by(student_id=int(request.args['student_id']))
    links = query.order_by(TeacherParentStudentLink.created_at.desc()).all()
    return success_response([_build_group_item(link) for link in links])


@api_v1.get('/students/<int:student_id>/parents')
@jwt_required()
def list_student_parents(student_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    student = StudentProfile.query.get(student_id)
    if not teacher_has_student_access(user.teacher_profile.id, student):
        return error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)

    sync_legacy_teacher_parent_links(user.teacher_profile.id)
    db.session.commit()

    payload = []
    links = TeacherParentStudentLink.query.filter_by(teacher_id=user.teacher_profile.id, student_id=student_id, status='active').all()
    for link in links:
        if not link.parent:
            continue
        payload.append({
            'link_id': link.id,
            'status': link.status,
            'parent': _build_parent_payload(link.parent),
        })
    return success_response(payload)


@api_v1.post('/students/<int:student_id>/parents/link')
@jwt_required()
def link_parent_to_student(student_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    student = StudentProfile.query.get(student_id)
    if not teacher_has_student_access(user.teacher_profile.id, student):
        return error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    parent_id = payload.get('parent_id')
    if not parent_id:
        return error_response('Can parent_id cua tai khoan phu huynh da dang ky', 'VALIDATION_ERROR', 422)

    parent_profile = ParentProfile.query.get(int(parent_id))
    if not parent_profile:
        return error_response('Khong tim thay phu huynh', 'PARENT_NOT_FOUND', 404)

    ensure_parent_student_link(parent_profile.id, student.id)
    link, _created = ensure_teacher_parent_student_link(user.teacher_profile.id, parent_profile.id, student.id, source='teacher_linked_parent')

    publish_realtime_event(
        'parent_group_updated',
        f'Phu huynh {parent_profile.full_name} vua duoc lien ket voi hoc sinh {student.full_name}.',
        title='Cap nhat phu huynh',
        recipient_user_ids=[uid for uid in [user.id, parent_profile.user_id] if uid],
        payload={'student_id': student.id, 'student_name': student.full_name, 'parent_id': parent_profile.id, 'parent_name': parent_profile.full_name, 'link_id': link.id},
    )

    db.session.commit()
    log_server_event(level='info', module='parents', message='Lien ket phu huynh voi hoc sinh', action_name='link_parent_student', user_id=user.id, metadata={'student_id': student.id, 'parent_id': parent_profile.id})
    return success_response({
        'link_id': link.id,
        'student': student.to_dict(),
        'parent': _build_parent_payload(parent_profile),
    }, 'Lien ket phu huynh thanh cong', 201)


@api_v1.get('/teacher/reports')
@jwt_required()
def list_teacher_reports():
    user, error = _require_teacher_user()
    if error:
        return error

    query = ParentDailyReport.query.filter_by(teacher_id=user.teacher_profile.id)
    if request.args.get('student_id'):
        query = query.filter_by(student_id=int(request.args['student_id']))
    reports = query.order_by(ParentDailyReport.report_date.desc(), ParentDailyReport.created_at.desc()).all()
    return success_response([_build_report_payload(report) for report in reports])


@api_v1.post('/teacher/reports/send')
@jwt_required()
def send_daily_reports():
    user, error = _require_teacher_user()
    if error:
        return error

    sync_legacy_teacher_parent_links(user.teacher_profile.id)
    db.session.flush()

    payload = request.get_json(silent=True) or {}
    student_id = payload.get('student_id')
    report_date = str(payload.get('report_date') or date.today().isoformat())
    title = (payload.get('title') or f'Bao cao hoc tap ngay {report_date}').strip()
    teacher_note = (payload.get('note') or '').strip() or None

    query = TeacherParentStudentLink.query.filter_by(teacher_id=user.teacher_profile.id, status='active')
    if student_id:
        query = query.filter_by(student_id=int(student_id))
    links = query.all()
    if not links:
        return error_response('Chua co phu huynh nao duoc lien ket de gui bao cao', 'PARENT_GROUP_EMPTY', 422)

    reports: list[ParentDailyReport] = []
    for link in links:
        if not link.parent or not link.student:
            continue
        summary = _build_progress_summary(link.student_id)
        student_name = link.student.full_name
        summary_text = (
            f'{student_name} co {summary["completed_count"]}/{summary["total_assignments"]} bai da hoan thanh, '
            f'{summary["in_progress_count"]} bai dang hoc, tien do gan nhat {summary["last_progress_percent"]}%.'
        )
        report = ParentDailyReport.query.filter_by(
            teacher_id=user.teacher_profile.id,
            parent_id=link.parent_id,
            student_id=link.student_id,
            report_date=report_date,
        ).first()
        if not report:
            report = ParentDailyReport(
                teacher_id=user.teacher_profile.id,
                parent_id=link.parent_id,
                student_id=link.student_id,
                report_date=report_date,
                title=title,
                teacher_note=teacher_note,
                summary_text=summary_text,
                recommendation=_recommendation_for_status(str(summary['readiness_status'])),
                total_assignments=int(summary['total_assignments']),
                completed_count=int(summary['completed_count']),
                in_progress_count=int(summary['in_progress_count']),
                last_assignment_title=summary['last_assignment_title'],
                last_progress_percent=int(summary['last_progress_percent']),
                readiness_status=str(summary['readiness_status']),
                help_count=int(summary['help_count']),
                retry_count=int(summary['retry_count']),
                completion_score=int(summary['completion_score']),
            )
            db.session.add(report)
        else:
            report.title = title
            report.teacher_note = teacher_note
            report.summary_text = summary_text
            report.recommendation = _recommendation_for_status(str(summary['readiness_status']))
            report.total_assignments = int(summary['total_assignments'])
            report.completed_count = int(summary['completed_count'])
            report.in_progress_count = int(summary['in_progress_count'])
            report.last_assignment_title = summary['last_assignment_title']
            report.last_progress_percent = int(summary['last_progress_percent'])
            report.readiness_status = str(summary['readiness_status'])
            report.help_count = int(summary['help_count'])
            report.retry_count = int(summary['retry_count'])
            report.completion_score = int(summary['completion_score'])
        reports.append(report)

    parent_user_ids = _user_ids_for_parent_links(links)
    publish_realtime_event(
        'parent_report_sent',
        f'Da gui {len(reports)} bao cao hoc tap moi.',
        title='Bao cao hoc tap',
        recipient_user_ids=[user.id, *parent_user_ids],
        payload={'report_count': len(reports), 'student_id': student_id, 'source': 'daily_report'},
    )

    db.session.commit()
    log_server_event(
        level='info',
        module='parents',
        message='Gui bao cao hoc tap cho phu huynh',
        action_name='send_parent_reports',
        user_id=user.id,
        metadata={'report_count': len(reports), 'student_id': student_id},
    )
    return success_response([_build_report_payload(report) for report in reports], 'Gui bao cao cho phu huynh thanh cong', 201)


@api_v1.get('/parent/my-children')
@jwt_required()
def get_my_children():
    user, error = _require_parent_user()
    if error:
        return error

    children = []
    for link in user.parent_profile.student_links:
        if link.status != 'active' or not link.student:
            continue
        active_classrooms = [class_link.classroom for class_link in link.student.classrooms if class_link.status == 'active' and class_link.classroom]
        active_classes = [classroom.to_dict() for classroom in active_classrooms if classroom.status == 'active']
        teacher_map = {}
        for classroom in active_classrooms:
            if classroom.teacher:
                teacher_map[classroom.teacher.id] = _build_teacher_payload(classroom.teacher)
        teacher_group_links = TeacherParentStudentLink.query.filter_by(parent_id=link.parent_id, student_id=link.student_id, status='active').all()
        for teacher_group in teacher_group_links:
            if teacher_group.teacher:
                teacher_map[teacher_group.teacher.id] = _build_teacher_payload(teacher_group.teacher)
        children.append({
            'student': link.student.to_dict(),
            'classes': active_classes,
            'teachers': list(teacher_map.values()),
            'progress_summary': _build_progress_summary(link.student.id),
        })

    return success_response(children)


@api_v1.get('/parent/teachers/<int:teacher_id>')
@jwt_required()
def get_teacher_for_parent(teacher_id: int):
    user, error = _require_parent_user()
    if error:
        return error

    teacher = TeacherProfile.query.get(teacher_id)
    if not teacher:
        return error_response('Khong tim thay giao vien', 'TEACHER_NOT_FOUND', 404)
    return success_response(_build_teacher_payload(teacher))


@api_v1.get('/parent/reports')
@jwt_required()
def get_parent_reports():
    user, error = _require_parent_user()
    if error:
        return error

    reports = ParentDailyReport.query.filter_by(parent_id=user.parent_profile.id).order_by(ParentDailyReport.report_date.desc(), ParentDailyReport.created_at.desc()).all()
    return success_response([_build_report_payload(report) for report in reports])
