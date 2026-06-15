import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Docker Desktop on Windows/macOS does not forward filesystem events into
    // the container's bind mount, so Vite's default inotify watcher never fires
    // and HMR appears "dead". Polling fixes live-reload across the bind mount.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      // Target is the backend as seen from INSIDE the frontend container, so it
      // must be the docker-compose service name (backend), not localhost.
      '/api': {
        target: process.env.BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
