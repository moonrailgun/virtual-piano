import { defineConfig } from 'vite';

const proxy = { '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true, timeout: 0, proxyTimeout: 0 } };
export default defineConfig({ server: { proxy, watch: { ignored: ['**/.venv/**'] } }, preview: { proxy } });
