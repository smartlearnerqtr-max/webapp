from __future__ import annotations

from sqlalchemy import or_
from flask_jwt_extended import create_access_token, create_refresh_token

from ..extensions import db
from ..models import ParentProfile, StudentProfile, TeacherProfile, User
from ..utils.security import hash_password, verify_password

VALID_SELF_REGISTER_ROLES = {'student', 'parent'}
VALID_STUDENT_LEVELS = {'nang', 'trung_binh', 'nhe'}


def normalize_identity(email: str | None = None, phone: str | None = None) -> tuple[str | None, str | None]:
    normalized_email = (email or '').strip().lower() or None
    normalized_phone = (phone or '').strip() or None
    return normalized_email, normalized_phone


def find_existing_user(email: str | None = None, phone: str | None = None) -> User | None:
    normalized_email, normalized_phone = normalize_identity(email, phone)
    filters = []
    if normalized_email:
        filters.append(User.email == normalized_email)
    if normalized_phone:
        filters.append(User.phone == normalized_phone)
    if not filters:
        return None
    return User.query.filter(or_(*filters)).first()


def find_user_for_login(identity: str) -> User | None:
    identity = identity.strip().lower()
    return User.query.filter((User.email == identity) | (User.phone == identity)).first()


def build_user_payload(user: User) -> dict[str, object]:
    profile = None
    if user.role == 'teacher' and user.teacher_profile:
        profile = user.teacher_profile.to_dict()
    elif user.role == 'parent' and user.parent_profile:
        profile = user.parent_profile.to_dict()
    elif user.role == 'student' and user.student_profile:
        profile = user.student_profile.to_dict()
    return {'user': user.to_dict(), 'profile': profile}


def build_auth_payload(user: User) -> dict[str, object]:
    claims = {'role': user.role}
    payload = build_user_payload(user)
    payload['access_token'] = create_access_token(identity=str(user.id), additional_claims=claims)
    payload['refresh_token'] = create_refresh_token(identity=str(user.id), additional_claims=claims)
    return payload


def login_user(identity: str, password: str) -> dict[str, object] | None:
    user = find_user_for_login(identity)
    if not user or not verify_password(user.password_hash, password):
        return None
    return build_auth_payload(user)


def register_self_service_user(payload: dict[str, object]) -> tuple[dict[str, object] | None, str | None, str | None]:
    role = (payload.get('role') or '').strip()
    full_name = (payload.get('full_name') or '').strip()
    password = (payload.get('password') or '').strip()
    email, phone = normalize_identity(payload.get('email'), payload.get('phone'))
    disability_level = (payload.get('disability_level') or 'trung_binh').strip()

    if role not in VALID_SELF_REGISTER_ROLES:
        return None, 'Chi cho phep dang ky vai tro hoc sinh hoac phu huynh', 'VALIDATION_ERROR'
    if not full_name or not password or (not email and not phone):
        return None, 'Can full_name, password va it nhat mot trong email hoac phone', 'VALIDATION_ERROR'
    if role == 'student' and disability_level not in VALID_STUDENT_LEVELS:
        return None, 'Muc do khuyet tat khong hop le', 'VALIDATION_ERROR'
    if find_existing_user(email, phone):
        return None, 'Email hoac so dien thoai da ton tai', 'USER_EXISTS'

    user = User(
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role=role,
        status='active',
    )
    db.session.add(user)
    db.session.flush()

    if role == 'student':
        db.session.add(
            StudentProfile(
                user_id=user.id,
                full_name=full_name,
                disability_level=disability_level,
                support_note=payload.get('support_note'),
                preferred_input=payload.get('preferred_input') or 'touch',
                preferred_read_speed=payload.get('preferred_read_speed'),
                preferred_font_size=payload.get('preferred_font_size'),
                preferred_bg_color=payload.get('preferred_bg_color'),
                created_by_teacher_id=None,
            )
        )
    else:
        db.session.add(
            ParentProfile(
                user_id=user.id,
                full_name=full_name,
                relationship_label=(payload.get('relationship_label') or '').strip() or None,
            )
        )

    db.session.commit()
    return build_auth_payload(user), None, None


def create_teacher_user(payload: dict[str, object]) -> tuple[dict[str, object] | None, str | None, str | None]:
    full_name = (payload.get('full_name') or '').strip()
    password = (payload.get('password') or '').strip()
    school_name = (payload.get('school_name') or '').strip() or None
    email, phone = normalize_identity(payload.get('email'), payload.get('phone'))

    if not full_name or not password or (not email and not phone):
        return None, 'Can full_name, password va it nhat mot trong email hoac phone', 'VALIDATION_ERROR'
    if find_existing_user(email, phone):
        return None, 'Email hoac so dien thoai da ton tai', 'USER_EXISTS'

    user = User(
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role='teacher',
        status='active',
    )
    db.session.add(user)
    db.session.flush()
    db.session.add(
        TeacherProfile(
            user_id=user.id,
            full_name=full_name,
            school_name=school_name,
        )
    )
    db.session.commit()
    return build_user_payload(user), None, None
