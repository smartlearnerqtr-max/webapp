from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete

from ..extensions import db
from ..models import RealtimeEvent


REALTIME_EVENT_RETENTION_HOURS = 24


def publish_realtime_event(
    event_type: str,
    message: str,
    *,
    title: str | None = None,
    recipient_user_ids: list[int] | None = None,
    recipient_roles: list[str] | None = None,
    payload: dict[str, object] | None = None,
) -> list[RealtimeEvent]:
    payload_json = json.dumps(payload, ensure_ascii=False) if payload is not None else None
    user_targets = sorted({int(item) for item in (recipient_user_ids or []) if item})
    role_targets = sorted({str(item).strip() for item in (recipient_roles or []) if str(item).strip()})

    created_events: list[RealtimeEvent] = []
    if not user_targets and not role_targets:
        created_events.append(
            RealtimeEvent(
                event_type=event_type,
                title=title,
                message=message,
                payload_json=payload_json,
            )
        )

    for user_id in user_targets:
        created_events.append(
            RealtimeEvent(
                recipient_user_id=user_id,
                event_type=event_type,
                title=title,
                message=message,
                payload_json=payload_json,
            )
        )

    for role in role_targets:
        created_events.append(
            RealtimeEvent(
                recipient_role=role,
                event_type=event_type,
                title=title,
                message=message,
                payload_json=payload_json,
            )
        )

    if created_events:
        db.session.add_all(created_events)

    _prune_realtime_events()
    return created_events


def _prune_realtime_events() -> None:
    cutoff = datetime.now(UTC) - timedelta(hours=REALTIME_EVENT_RETENTION_HOURS)
    db.session.execute(
        delete(RealtimeEvent).where(RealtimeEvent.created_at < cutoff).execution_options(synchronize_session=False)
    )
