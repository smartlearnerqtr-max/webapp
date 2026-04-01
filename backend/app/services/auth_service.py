from __future__ import annotations

from flask_jwt_extended import create_access_token, create_refresh_token

from ..models import User
from ..utils.security import verify_password


def find_user_for_login(identity: str) -> User | None:
    identity = identity.strip().lower()
    return User.query.filter((User.email == identity) | (User.phone == identity)).first()


def build_user_payload(user: User) -> dict[str, object]:
    profile = None
    if user.role == "teacher" and user.teacher_profile:
        profile = user.teacher_profile.to_dict()
    elif user.role == "parent" and user.parent_profile:
        profile = user.parent_profile.to_dict()
    elif user.role == "student" and user.student_profile:
        profile = user.student_profile.to_dict()
    return {"user": user.to_dict(), "profile": profile}


def login_user(identity: str, password: str) -> dict[str, object] | None:
    user = find_user_for_login(identity)
    if not user or not verify_password(user.password_hash, password):
        return None
    claims = {"role": user.role}
    payload = build_user_payload(user)
    payload["access_token"] = create_access_token(identity=str(user.id), additional_claims=claims)
    payload["refresh_token"] = create_refresh_token(identity=str(user.id), additional_claims=claims)
    return payload
