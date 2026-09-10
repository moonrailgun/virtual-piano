"""Streaming song service. Uploaded audio lives in a temporary directory."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import resource
import select
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlparse
import wave

# ponytail: one inference job per process; add a queue when concurrent demand requires it.
job_lock = threading.Lock()
stopping = threading.Event()


class Handler(BaseHTTPRequestHandler):
    def log_request(self, code='-', size='-'):
        if self.path != '/_vercel/ping':
            super().log_request(code, size)

    def origin_allowed(self):
        origin = self.headers.get('Origin')
        if not origin:
            return True
        try:
            parsed = urlparse(origin)
            return parsed.scheme in ('http', 'https') and (parsed.netloc == self.headers.get('Host') or not os.environ.get('VERCEL') and parsed.hostname in ('localhost', '127.0.0.1', '::1'))
        except ValueError:
            return False

    def end_headers(self):
        origin = self.headers.get('Origin')
        if origin and self.origin_allowed():
            self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Vary', 'Origin')
        super().end_headers()

    def do_OPTIONS(self):
        if self.path not in ('/api/health', '/api/transcribe'):
            self.send_error(404)
            return
        if not self.origin_allowed():
            self.send_error(403)
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Song-Source')
        self.end_headers()

    def do_GET(self):
        if self.path not in ('/api/health', '/api/transcribe'):
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
        if not self.origin_allowed():
            self.send_error(403)
            return
        source = self.headers.get('X-Song-Source', 'vocals')
        if source not in ('vocals', 'accompaniment'):
            self.send_error(400, 'Expected vocals or accompaniment')
            return
        try:
            size = int(self.headers.get('Content-Length', 0))
        except ValueError:
            size = 0
        if not 44 < size <= 4_000_000:
            self.send_error(413, 'Audio chunks must be smaller than 4 MB')
            return
        if not job_lock.acquire(blocking=False):
            self.send_error(409, 'Another song is being processed')
            return
        process = None
        final_event = None
        try:
            with tempfile.TemporaryDirectory(prefix='echo-piano-') as directory:
                path = Path(directory) / 'audio.wav'
                self.connection.settimeout(60)
                with path.open('wb') as file:
                    remaining = size
                    while remaining:
                        chunk = self.rfile.read(min(remaining, 1024 * 1024))
                        if not chunk:
                            return
                        file.write(chunk)
                        remaining -= len(chunk)
                try:
                    with wave.open(str(path)) as audio:
                        if audio.getnchannels() not in (1, 2) or audio.getsampwidth() != 2 or audio.getframerate() != 44100 or not .1 <= audio.getnframes() / 44100 <= 7.001:
                            raise ValueError('Invalid audio chunk')
                        if len(audio.readframes(audio.getnframes())) != audio.getnframes() * audio.getnchannels() * 2:
                            raise ValueError('Incomplete audio chunk')
                except (wave.Error, EOFError, ValueError):
                    self.send_error(400, 'Expected up to 7 seconds of 44.1 kHz PCM16 WAV audio')
                    return
                self.send_response(200)
                self.send_header('Content-Type', 'application/x-ndjson; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Accel-Buffering', 'no')
                self.end_headers()
                with (Path(directory) / 'error.log').open('w+') as errors:
                    process = subprocess.Popen([sys.executable, '-u', str(Path(__file__).with_name('transcribe.py')), str(path), source], stdout=subprocess.PIPE, stderr=errors, start_new_session=True, bufsize=0)
                    deadline = time.monotonic() + 270
                    while not stopping.is_set():
                        if time.monotonic() >= deadline:
                            final_event = b'{"type":"error","code":"songTimeout"}\n'
                            break
                        ready, _, _ = select.select([process.stdout, self.connection], [], [], .5)
                        if self.connection in ready and not self.connection.recv(1, socket.MSG_PEEK):
                            break
                        if process.stdout in ready:
                            line = process.stdout.readline()
                            if not line:
                                break
                            event = json.loads(line)
                            if event['type'] in ('complete', 'error'):
                                final_event = line
                                break
                            self.wfile.write(line)
                            self.wfile.flush()
                        if not ready:
                            # A heartbeat also makes aborts observable during a long model call.
                            self.wfile.write(b'\n')
                            self.wfile.flush()
                    if not final_event and process.poll() is not None:
                        errors.seek(0)
                        print(f'Song process exited: status={process.returncode}, peak_rss_kb={resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss}\n{errors.read()[-4000:]}', file=sys.stderr, flush=True)
                        final_event = json.dumps(dict(type='error', code='songProcessExited', message='Song processing stopped. Please try again.'), ensure_ascii=False).encode() + b'\n'
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
        # The client starts the next chunk as soon as it receives completion.
        if final_event:
            try:
                self.wfile.write(final_event)
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass


if __name__ == '__main__':
    host, port = os.environ.get('HOST', '127.0.0.1'), int(os.environ.get('PORT', '8001'))
    print(f'Song transcription service: http://{host}:{port}', flush=True)
    server = ThreadingHTTPServer((host, port), Handler)
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
