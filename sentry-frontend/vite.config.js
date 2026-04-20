import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@widgets': path.resolve(__dirname, '../r2-system/widgets'),
      '@graphics': path.resolve(__dirname, '../r2-system/widgets/micrographics'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
    }
  },
  server: {
    fs: {
      allow: [
        '.',
        path.resolve(__dirname, '../r2-system/widgets')
      ]
    }
  }
})
