import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';
import { publicAddress, videoProxy } from '../server/video-proxy.mjs';
import { checkDuration } from '../server/video-import.mjs';

test('video imports reject private destinations and incomplete or unbounded audio', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '127.0.0.1', family: 4 }]);
  for (const url of ['file:///etc/passwd', 'http://user:pass@example.com', 'http://example.com:8001', 'http://localhost', 'https://example.com']) {
    await assert.rejects(publicAddress(new URL(url)), /videoInvalid/);
  }
  for (const address of ['0.0.0.0', '10.0.0.1', '100.100.100.200', '169.254.169.254', '172.16.0.1', '192.168.1.1', '224.0.0.1']) {
    t.mock.method(dns, 'lookup', async () => [{ address, family: 4 }]);
    await assert.rejects(publicAddress(new URL('https://example.com')), /videoInvalid/);
  }
  t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  assert.equal(await publicAddress(new URL('https://example.com')), '8.8.8.8');
  assert.throws(() => checkDuration(250, 120), /videoIncomplete/);
  assert.throws(() => checkDuration(250, 500), /videoIncomplete/);
  assert.throws(() => checkDuration(0, 120), /videoUnavailable/);
  assert.throws(() => checkDuration(1201), /videoTooLarge/);
  checkDuration(250, 249.7);
});

test('the downloader proxy blocks private HTTP and HTTPS destinations and closes on cancel', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '169.254.169.254', family: 4 }]);
  const controller = new AbortController();
  const proxy = await videoProxy(controller.signal);
  t.after(() => proxy.close());
  const address = new URL(proxy.url);
  const request = http.get({ hostname: '127.0.0.1', port: address.port, path: 'http://redirect.example/metadata' });
  const [response] = await once(request, 'response');
  response.resume();
  assert.equal(response.statusCode, 403);
  const socket = net.connect(Number(address.port), '127.0.0.1');
  await once(socket, 'connect');
  socket.write('CONNECT redirect.example:443 HTTP/1.1\r\nHost: redirect.example:443\r\n\r\n');
  const [reply] = await once(socket, 'data');
  assert.match(reply.toString(), /403 Forbidden/);
  socket.destroy();
  controller.abort();
  const afterCancel = net.connect(Number(address.port), '127.0.0.1');
  const [error] = await once(afterCancel, 'error');
  assert.equal(error.code, 'ECONNREFUSED');
});
