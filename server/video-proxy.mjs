import http from 'node:http';
import net from 'node:net';
import dns from 'node:dns/promises';
import { once } from 'node:events';

const blocked = new net.BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) blocked.addSubnet(address, prefix);

export async function publicAddress(url) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('videoInvalid');
  // Connect to the checked IPv4 address, so redirects and DNS rebinding cannot reach local services.
  const addresses = await dns.lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(({ address }) => blocked.check(address))) throw new Error('videoInvalid');
  return addresses[0].address;
}

export async function videoProxy(signal) {
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url);
      if (url.protocol !== 'http:') throw new Error('videoInvalid');
      const address = await publicAddress(url);
      const headers = { ...req.headers, host: url.host };
      delete headers['proxy-authorization'];
      delete headers['proxy-connection'];
      const upstream = http.request({ hostname: address, port: 80, path: url.pathname + url.search, method: req.method, headers, signal }, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      });
      upstream.on('error', () => res.destroy());
      req.pipe(upstream);
    } catch { res.writeHead(403).end(); }
  });
  server.on('connect', async (req, socket, head) => {
    try {
      const url = new URL(`https://${req.url}`);
      const address = await publicAddress(url);
      if (signal.aborted) throw signal.reason;
      const upstream = net.connect({ host: address, port: 443 });
      sockets.add(upstream);
      upstream.on('close', () => sockets.delete(upstream));
      upstream.on('error', () => socket.destroy());
      socket.on('close', () => upstream.destroy());
      upstream.on('connect', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
    } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const close = () => { server.close(); for (const socket of sockets) socket.destroy(); };
  signal.addEventListener('abort', close, { once: true });
  return { url: `http://127.0.0.1:${server.address().port}`, close() { signal.removeEventListener('abort', close); close(); } };
}
