import os

from app import create_app
from app.extensions import db

app = create_app()


def init_db() -> None:
    with app.app_context():
        db.create_all()


def main() -> None:
    init_db()
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5000'))
    debug = os.getenv('FLASK_DEBUG') == '1' or bool(app.config.get('DEBUG', False))
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    main()
