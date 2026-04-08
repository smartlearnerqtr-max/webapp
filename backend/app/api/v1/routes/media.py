from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from flask import current_app, request, send_from_directory, url_for
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ....models import User
from ....utils.responses import error_response, success_response
from .. import api_v1

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.webm', '.ogg', '.mov'}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def _require_teacher_user():
    if get_jwt().get('role') != 'teacher':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response('Khong tim thay giao vien', 'TEACHER_NOT_FOUND', 404)
    return user, None


def _uploads_root() -> Path:
    root = Path(current_app.instance_path) / 'uploads'
    root.mkdir(parents=True, exist_ok=True)
    return root


@api_v1.post('/media/upload')
@jwt_required()
def upload_media():
    user, error = _require_teacher_user()
    if error:
        return error

    upload = request.files.get('file')
    if not upload or not upload.filename:
        return error_response('Chua chon file de tai len', 'FILE_REQUIRED', 422)

    if request.content_length and request.content_length > MAX_UPLOAD_BYTES:
        return error_response('File vuot qua gioi han 50MB', 'FILE_TOO_LARGE', 413)

    original_name = secure_filename(upload.filename)
    extension = Path(original_name).suffix.lower()

    if extension in ALLOWED_IMAGE_EXTENSIONS:
        media_kind = 'image'
    elif extension in ALLOWED_VIDEO_EXTENSIONS:
        media_kind = 'video'
    else:
        return error_response('Chi ho tro upload anh hoac video pho bien', 'FILE_TYPE_NOT_SUPPORTED', 422)

    teacher_folder = _uploads_root() / f'teacher_{user.teacher_profile.id}'
    teacher_folder.mkdir(parents=True, exist_ok=True)

    stored_name = f'{uuid4().hex}{extension}'
    upload.save(teacher_folder / stored_name)

    relative_path = f'teacher_{user.teacher_profile.id}/{stored_name}'
    file_url = url_for('api_v1.get_uploaded_media', filename=relative_path, _external=True)

    return success_response(
        {
            'url': file_url,
            'filename': stored_name,
            'original_name': original_name,
            'media_kind': media_kind,
        },
        'Tai file len thanh cong',
        201,
    )


@api_v1.get('/media/files/<path:filename>')
def get_uploaded_media(filename: str):
    uploads_root = _uploads_root()
    target = (uploads_root / filename).resolve()

    try:
        target.relative_to(uploads_root.resolve())
    except ValueError:
        return error_response('Duong dan file khong hop le', 'INVALID_FILE_PATH', 400)

    if not target.exists() or not target.is_file():
        return error_response('Khong tim thay file media', 'MEDIA_NOT_FOUND', 404)

    return send_from_directory(target.parent, target.name)
