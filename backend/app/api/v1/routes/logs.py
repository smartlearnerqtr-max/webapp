from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, jwt_required

from ....models import ServerLog
from ....utils.responses import error_response, success_response
from .. import api_v1


@api_v1.get('/logs')
@jwt_required()
def list_logs():
    if get_jwt().get('role') != 'teacher':
        return error_response('Khong co quyen xem log', 'AUTH_FORBIDDEN', 403)
    query = ServerLog.query
    if request.args.get('level'):
        query = query.filter_by(level=request.args['level'])
    if request.args.get('module'):
        query = query.filter_by(module=request.args['module'])
    if request.args.get('request_id'):
        query = query.filter_by(request_id=request.args['request_id'])
    logs = query.order_by(ServerLog.created_at.desc()).limit(100).all()
    return success_response([log.to_dict() for log in logs])
