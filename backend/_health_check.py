import threading
import time
import urllib.request

from werkzeug.serving import make_server

from run import app

server = make_server('127.0.0.1', 5000, app)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()

time.sleep(1)
with urllib.request.urlopen('http://127.0.0.1:5000/api/v1/health', timeout=5) as response:
    print(response.status)
    print(response.read().decode('utf-8'))

server.shutdown()
thread.join(timeout=5)
