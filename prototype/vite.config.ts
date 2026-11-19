import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves from https://<user>.github.io/<repo>/; branch previews
// live one folder deeper, which the deploy workflow passes in PAGES_SUBDIR.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'traqspera-time-hour-rules'
const subdir = process.env.PAGES_SUBDIR ? `${process.env.PAGES_SUBDIR}/` : ''

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.NODE_ENV === 'production' ? `/${repo}/${subdir}` : '/',
  build: {
    outDir: 'dist',
  },
})
