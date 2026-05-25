import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages: https://<user>.github.io/kondate-agent/ の subpath 配信
  base: '/kondate-agent/',
  plugins: [react(), tailwindcss()],
})
