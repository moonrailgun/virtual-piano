import { defineConfig, type PreviewServer, type ViteDevServer } from 'vite';
import video from './api/video.mjs';

const proxy = { '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true, timeout: 0, proxyTimeout: 0 } };
const configure = (server: ViteDevServer | PreviewServer) => {
  server.middlewares.use('/api/video', video);
};
export default defineConfig({
  plugins: [{ name: 'video-api', configureServer: configure, configurePreviewServer: configure }],
  server: { proxy, watch: { ignored: ['**/.venv/**'] } }, preview: { proxy },
});
