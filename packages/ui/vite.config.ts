import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  /** 静态资源根目录（仅媒体文件；TS 模块在 `src/assets/`）。 */
  publicDir: path.resolve(__dirname, 'src/static'),
  /** 与 Electron `file://` 打包加载一致（`extraResources` 下的静态 `index.html`）。 */
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      /** Renderer → DashScope is blocked by CORS; dev server forwards same-origin `/dashscope/*`. */
      '/dashscope': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dashscope/, ''),
      },
    },
  },
  build: {
    /** Electron 38+ Chromium；减小 legacy 转译体积。 */
    target: 'es2022',
    cssMinify: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        /** 稳定分包名，便于缓存与按需 chunk（如情绪图 lazy）边界清晰。 */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'vendor-chart'
          }
          if (id.includes('@lottiefiles') || id.includes('dotlottie')) {
            return 'vendor-lottie'
          }
          if (id.includes('localforage')) return 'vendor-storage'
        },
      },
    },
  },
})
