from flask import Blueprint

api_v1 = Blueprint('api_v1', __name__)

from .routes import admins, ai_settings, assignments, auth, classes, health, lessons, logs, media, messages, parents, realtime, students, subjects  # noqa: E402,F401
