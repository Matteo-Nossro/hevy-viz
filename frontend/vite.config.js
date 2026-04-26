import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // En dev : proxy /api vers le nginx du compose (qui lui-même proxifie vers PostgREST)
      // Démarrer le compose d'abord : docker compose up -d
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
