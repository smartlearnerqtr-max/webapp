from __future__ import annotations

import json
import time

from flask import Response, request, stream_with_context
from flask_jwt_extended import decode_token
from sqlalchemy import or_

from ....extensions import db
from ....models import RealtimeEvent, User
from ....utils.responses import error_response
from .. import api_v1


HEARTBEAT_INTERVAL_SECONDS = 15
POLL_INTERVAL_SECONDS = 2
MAX_EVENTS_PER_BATCH = 30


def _resolve_stream_user() -> tuple[dict[str, object] | None, object | None]:
    access_token = (request.args.get('access_token') or '').strip()
    if not access_token:
        return None, error_response('Can access_token de ket noi realtime', 'AUTH_TOKEN_REQUIRED', 401)

    try:
        decoded = decode_token(access_token)
        user_id = int(decoded.get('sub'))
        role = str(decoded.get('role') or '')
    except Exception:
        return None, error_response('Token realtime khong hop le', 'AUTH_INVALID_TOKEN', 401)

    user = User.query.get(user_id)
    if not user or user.status != 'active':
        return None, error_response('Khong tim thay nguoi dung hop le', 'USER_NOT_FOUND', 404)

    return {'id': user.id, 'role': role or user.role}, None


def _resolve_last_event_id(user_id: int, role: str) -> int:
    raw_last_event_id = (request.headers.get('Last-Event-ID') or request.args.get('last_event_id') or '').strip()
    if raw_last_event_id:
        try:
            return max(int(raw_last_event_id), 0)
        except ValueError:
            return 0

    latest_event = RealtimeEvent.query.filter(
        or_(
            RealtimeEvent.recipient_user_id == user_id,
            RealtimeEvent.recipient_role == role,
        )
    ).order_by(RealtimeEvent.id.desc()).first()
    return latest_event.id if latest_event else 0


@api_v1.get('/realtime/stream')
def stream_realtime_events():
    user, error = _resolve_stream_user()
    if error:
        return error

    user_id = int(user['id'])
    role = str(user['role'])
    last_event_id = _resolve_last_event_id(user_id, role)

    @stream_with_context
    def generate():
        nonlocal last_event_id
        last_heartbeat_at = time.monotonic()

        try:
            while True:
                db.session.expire_all()
                events = RealtimeEvent.query.filter(
                    RealtimeEvent.id > last_event_id,
                    or_(
                        RealtimeEvent.recipient_user_id == user_id,
                        RealtimeEvent.recipient_role == role,
                    ),
                ).order_by(RealtimeEvent.id.asc()).limit(MAX_EVENTS_PER_BATCH).all()

                if events:
                    for event in events:
                        last_event_id = event.id
                        yield f"id: {event.id}\nevent: realtime\ndata: {json.dumps(event.to_dict(), ensure_ascii=False)}\n\n"
                    last_heartbeat_at = time.monotonic()
                    continue

                if time.monotonic() - last_heartbeat_at >= HEARTBEAT_INTERVAL_SECONDS:
                    yield "event: heartbeat\ndata: {}\n\n"
                    last_heartbeat_at = time.monotonic()

                time.sleep(POLL_INTERVAL_SECONDS)
        except GeneratorExit:
            return
        except Exception:
            return

    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['X-Accel-Buffering'] = 'no'
    return response
