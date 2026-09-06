import { cp, mkdir, readdir } from 'node:fs/promises';

await mkdir('public/wasm', { recursive: true });
await cp('node_modules/@spotify/basic-pitch/model', 'public/model', { recursive: true });
await cp('node_modules/@spotify/basic-pitch/LICENSE', 'public/model/LICENSE.txt');
for (const file of await readdir('node_modules/@tensorflow/tfjs-backend-wasm/dist')) {
  if (file.endsWith('.wasm')) await cp(`node_modules/@tensorflow/tfjs-backend-wasm/dist/${file}`, `public/wasm/${file}`);
}
