from __future__ import annotations

import uuid
from pathlib import Path

from flask import Flask, g, request
from sqlalchemy.exc import OperationalError

from .api.v1 import api_v1
from .config import get_config
from .extensions import cors, db, jwt, migrate
from .services.logger import log_exception
from .services.seed_service import seed_demo_parent, seed_demo_student, seed_demo_teacher, seed_subjects
from .utils.responses import error_response


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(get_config(config_name))
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    _init_extensions(app)
    _register_request_hooks(app)
    _register_blueprints(app)
    _register_error_handlers(app)
    _register_shell_context(app)
    _register_cli_commands(app)

    return app


def _init_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})


def _register_request_hooks(app: Flask) -> None:
    @app.before_request
    def attach_request_id() -> None:
        g.request_id = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:16]}"

    @app.after_request
    def append_request_id(response):
        response.headers["X-Request-Id"] = getattr(g, "request_id", "")
        return response


    

def _register_blueprints(app: Flask) -> None:
    app.register_blueprint(api_v1, url_prefix="/api/v1")


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(404)
    def handle_404(_error):
        return error_response("Khong tim thay tai nguyen", "NOT_FOUND", 404)

    @app.errorhandler(Exception)
    def handle_exception(error: Exception):
        log_exception("unhandled_exception", str(error))
        return error_response("Co loi he thong xay ra", "INTERNAL_SERVER_ERROR", 500)


def _register_shell_context(app: Flask) -> None:
    from . import models

    @app.shell_context_processor
    def shell_context() -> dict[str, object]:
        return {"db": db, "models": models}


def _register_cli_commands(app: Flask) -> None:
    @app.cli.command("init-db")
    def init_db_command() -> None:
        try:
            db.create_all()
            print("Database tables created")
        except OperationalError:
            print("Database tables already exist or need manual migration")

    @app.cli.command("seed-base")
    def seed_base_command() -> None:
        db.create_all()
        subjects_created = seed_subjects()
        teacher = seed_demo_teacher()
        student = seed_demo_student()
        parent = seed_demo_parent()
        print(f"Seeded subjects: {subjects_created}")
        print(f"Demo teacher: {teacher.email} / 123456")
        print(f"Demo student: {student.email} / 123456")
        print(f"Demo parent: {parent.email} / 123456")
