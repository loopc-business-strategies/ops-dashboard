import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) {
              return 'vendor-react'
            }
            if (id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
              return 'vendor-pdf'
            }
            if (id.includes('/exceljs/')) {
              return 'vendor-excel'
            }
            if (id.includes('/axios/')) {
              return 'vendor-http'
            }
            return 'vendor-misc'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL || 'http://localhost:5000', changeOrigin: true },
    },
  },
})
