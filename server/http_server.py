"""Loopback-only streaming adapter. Uploaded audio lives in a temporary directory."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import select
import signal
import socket
import subprocess
import sys
import tempfile
import threading
from urllib.parse import urlparse

# ponytail: one inference job per machine; add a queue only for multi-user hosting.
job_lock = threading.Lock()
stopping = threading.Event()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/api/health':
            self.send_error(404)
            return
        body = b'{"service":"echo-piano","songMode":true}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/api/transcribe':
            self.send_error(404)
            return
        origin = self.headers.get('Origin')
        if origin and urlparse(origin).hostname not in ('localhost', '127.0.0.1', '::1'):
            self.send_error(403)
            return
        try:
            size = int(self.headers.get('Content-Length', 0))
        except ValueError:
            size = 0
        if not 0 < size <= 100 * 1024 * 1024:
            self.send_error(413, 'Choose an audio file smaller than 100 MB')
            return
        if not job_lock.acquire(blocking=False):
            self.send_error(409, 'Another song is being processed')
            return
        process = None
        try:
            with tempfile.TemporaryDirectory(prefix='echo-piano-') as directory:
                path = Path(directory) / 'audio'
                self.connection.settimeout(60)
                with path.open('wb') as file:
                    remaining = size
                    while remaining:
                        chunk = self.rfile.read(min(remaining, 1024 * 1024))
                        if not chunk:
                            return
                        file.write(chunk)
                        remaining -= len(chunk)
                self.send_response(200)
                self.send_header('Content-Type', 'application/x-ndjson; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Accel-Buffering', 'no')
                self.end_headers()
                with (Path(directory) / 'error.log').open('w+') as errors:
                    process = subprocess.Popen([sys.executable, '-u', str(Path(__file__).with_name('transcribe.py')), str(path)], stdout=subprocess.PIPE, stderr=errors, start_new_session=True, bufsize=0)
                    completed = False
                    while not stopping.is_set():
                        ready, _, _ = select.select([process.stdout, self.connection], [], [], .5)
                        if self.connection in ready and not self.connection.recv(1, socket.MSG_PEEK):
                            break
                        if process.stdout in ready:
                            line = process.stdout.readline()
                            if not line:
                                break
                            event = json.loads(line)
                            completed |= event['type'] in ('complete', 'error')
                            self.wfile.write(line)
                            self.wfile.flush()
                        if not ready:
                            # A heartbeat also makes aborts observable during a long model call.
                            self.wfile.write(b'\n')
                            self.wfile.flush()
                    if not completed and process.poll() is not None:
                        errors.seek(0)
                        print(errors.read()[-4000:], file=sys.stderr)
                        self.wfile.write(json.dumps(dict(type='error', message='本地转谱进程退出，请查看运行终端。'), ensure_ascii=False).encode() + b'\n')
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        finally:
            if process and process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
            job_lock.release()


if __name__ == '__main__':
    print('Song transcription service: http://127.0.0.1:8001', flush=True)
    server = ThreadingHTTPServer(('127.0.0.1', 8001), Handler)
    server.daemon_threads = False
    def stop(*_):
        stopping.set()
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stopping.set()
        server.server_close()
