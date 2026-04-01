from __future__ import annotations

import json
import logging
import traceback
from typing import Any

from flask import g, has_request_context, request

from ..extensions import db
from ..models.log import ServerLog

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("webapp-backend")


def log_server_event(*, level: str, module: str, message: str, error_code: str | None = None, action_name: str | None = None, metadata: dict[str, Any] | None = None, stack_trace: str | None = None, user_id: int | None = None) -> None:
    logger.log(getattr(logging, level.upper(), logging.INFO), "%s | %s | request_id=%s", module, message, getattr(g, "request_id", None))
    try:
        db.session.add(ServerLog(
            level=level.lower(),
            module=module,
            action_name=action_name,
            endpoint=request.path if has_request_context() else None,
            method=request.method if has_request_context() else None,
            request_id=getattr(g, "request_id", None),
            user_id=user_id,
            error_code=error_code,
            message=message,
            stack_trace=stack_trace,
            metadata_json=json.dumps(metadata, ensure_ascii=True) if metadata else None,
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Failed to write server log")


def log_exception(module: str, message: str, error_code: str = "INTERNAL_SERVER_ERROR") -> None:
    log_server_event(level="error", module=module, message=message, error_code=error_code, stack_trace=traceback.format_exc())
