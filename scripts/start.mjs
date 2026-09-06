import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const children = [];
const python = '.venv/bin/python';
let running = false;
try { running = (await (await fetch('http://127.0.0.1:8001/api/health', { signal: AbortSignal.timeout(500) })).json()).service === 'echo-piano'; } catch {}
if (!running && existsSync(python)) children.push(spawn(python, ['server/http_server.py'], { stdio: 'inherit' }));
else if (!running) console.log('Song mode needs local models: run npm run setup:audio first. Instrument mode is still available.');
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(process.argv[2] === 'preview' ? ['preview'] : []), ...process.argv.slice(3)], { stdio: 'inherit' });
children.push(vite);
function stop() { for (const child of children) child.kill('SIGTERM'); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
vite.on('exit', code => { stop(); process.exitCode = code ?? 0; });
