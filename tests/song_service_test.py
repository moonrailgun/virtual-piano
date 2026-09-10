"""Run with python3 tests/song_service_test.py; no model dependencies needed."""
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
import os
import io
import sys
import threading
from unittest.mock import patch
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import http_server

os.environ['VERCEL'] = '1'
server = ThreadingHTTPServer(('127.0.0.1', 0), http_server.Handler)
thread = threading.Thread(target=server.serve_forever)
thread.start()


def request(method, path, origin, body=None, **headers):
    connection = HTTPConnection('127.0.0.1', server.server_port, timeout=2)
    try:
        connection.request(method, path, body=body, headers={'Host': 'piano.example.com', 'Origin': origin, **headers})
        response = connection.getresponse()
        response.read()
        return response.status, dict(response.getheaders())
    finally:
        connection.close()


try:
    status, headers = request('OPTIONS', '/api/transcribe', 'https://piano.example.com', **{'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
    assert status == 204, status
    assert headers['Access-Control-Allow-Origin'] == 'https://piano.example.com'
    assert 'POST' in headers['Access-Control-Allow-Methods']
    assert 'Content-Type' in headers['Access-Control-Allow-Headers']
    assert 'X-Song-Source' in headers['Access-Control-Allow-Headers']
    status, headers = request('GET', '/api/health', 'https://piano.example.com')
    assert status == 200 and headers['Access-Control-Allow-Origin'] == 'https://piano.example.com'
    for origin in ('https://piano.example.com.evil.test', 'http://localhost:5173', 'null', 'http://['):
        status, headers = request('POST', '/api/transcribe', origin)
        assert status == 403 and 'Access-Control-Allow-Origin' not in headers, (status, headers)
    status, headers = request('POST', '/api/transcribe', 'https://piano.example.com', **{'Content-Length': '4000001'})
    assert status == 413 and headers['Access-Control-Allow-Origin'] == 'https://piano.example.com'
    http_server.job_lock.acquire()
    try:
        status, headers = request('POST', '/api/transcribe', 'https://piano.example.com', **{'Content-Length': '45'})
        assert status == 409 and headers['Access-Control-Allow-Origin'] == 'https://piano.example.com'
    finally:
        http_server.job_lock.release()
    assert request('GET', '/api/transcribe', 'https://piano.example.com')[0] == 200
    assert request('POST', '/api/transcribe', 'https://piano.example.com', **{'X-Song-Source': 'invalid'})[0] == 400
    assert request('POST', '/api/transcribe', 'https://piano.example.com', **{'Content-Length': '0'})[0] == 413
    for sample_rate, truncate in ((22050, False), (44100, True)):
        audio = io.BytesIO()
        with wave.open(audio, 'wb') as wav:
            wav.setparams((2, 2, sample_rate, 0, 'NONE', 'not compressed'))
            wav.writeframes(b'\0' * sample_rate * 4)
        body = audio.getvalue()[:-4] if truncate else audio.getvalue()
        assert request('POST', '/api/transcribe', 'https://piano.example.com', body)[0] == 400
        assert http_server.job_lock.acquire(timeout=2)
        http_server.job_lock.release()
    # A completed chunk must release its process and lock before the next upload.
    popen = http_server.subprocess.Popen
    sources = []
    def finished_process(args, **kwargs):
        sources.append(args[-1])
        return popen([sys.executable, '-u', '-c', 'import time; print(\'{"type":"complete","notes":[]}\', flush=True); time.sleep(30)'], **kwargs)
    with patch.object(http_server.subprocess, 'Popen', finished_process):
        for source in ('vocals', 'accompaniment'):
            connection = HTTPConnection('127.0.0.1', server.server_port, timeout=5)
            try:
                connection.request('POST', '/api/transcribe', audio.getvalue(), {'X-Song-Source': source})
                response = connection.getresponse()
                assert response.status == 200
                assert b'"complete"' in response.readline()
                assert not http_server.job_lock.locked(), 'Completion must mean the next chunk can start'
            finally:
                connection.close()
    assert sources == ['vocals', 'accompaniment']
    os.environ.pop('VERCEL')
    assert request('OPTIONS', '/api/transcribe', 'http://localhost:5173')[0] == 204
    print('Song service: routing, origin isolation, size, invalid/truncated audio and busy errors passed')
finally:
    server.shutdown()
    server.server_close()
    thread.join()
