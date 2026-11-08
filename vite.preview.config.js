import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// local League preview with mock data: npx vite --config vite.preview.config.js
export default defineConfig({
  plugins: [react(), { name: 'mock-cloud', enforce: 'pre', resolveId(src, imp) { if (src === './cloud.js' && imp && !imp.includes('preview')) return path.resolve('src/preview/mock.js') } }],
  server: { port: 5192, open: false },
})
