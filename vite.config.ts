import { defineConfig, loadEnv, type PreviewServer, type ViteDevServer } from 'vite';
import video from './api/video.mjs';

const proxy = { '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true, timeout: 0, proxyTimeout: 0 } };
const configure = (server: ViteDevServer | PreviewServer) => {
  server.middlewares.use('/api/video', video);
};
export default defineConfig(({ mode }) => {
  process.env.ENABLE_VIDEO_IMPORT = loadEnv(mode, process.cwd(), 'ENABLE_VIDEO_IMPORT').ENABLE_VIDEO_IMPORT ?? 'false';
  return {
    plugins: [{ name: 'video-api', configureServer: configure, configurePreviewServer: configure }],
    server: { proxy, watch: { ignored: ['**/.venv/**'] } }, preview: { proxy },
  };
});
