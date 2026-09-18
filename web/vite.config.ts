import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS=1 npm run dev  -> https on the LAN, so phones on the same Wi-Fi/hotspot get camera + mic + GPS
const https = process.env.HTTPS === '1'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
  server: {
    host: true,
    port: 5180,
    proxy: { '/api': { target: 'http://127.0.0.1:8300', changeOrigin: true, ws: true } },
  },
  preview: { port: 5180, host: true },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  build: { chunkSizeWarningLimit: 1500 },
})
