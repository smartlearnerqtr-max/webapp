from flask import current_app

from ....utils.responses import success_response
from .. import api_v1


@api_v1.get("/health")
def health_check():
    return success_response({"service": "backend", "status": "ok", "app_name": current_app.config["API_TITLE"]}, "Backend Flask is running")
