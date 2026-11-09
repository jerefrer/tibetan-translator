import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { createRequire } from 'module'

// scripts/lib is CommonJS, which Vite's bundled config cannot import directly
const { pruneDist } = createRequire(import.meta.url)('./scripts/lib/prune-dist.js')

// Tauri embeds all of dist/ in the app, so drop what the app never loads
const pruneUnusedPublicFiles = {
  name: 'prune-unused-public-files',
  apply: 'build',
  closeBundle() {
    const removed = pruneDist(path.resolve(__dirname, 'dist'))
    if (removed.length) console.log(`Pruned from dist/: ${removed.join(', ')}`)
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    pruneUnusedPublicFiles
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        popup: path.resolve(__dirname, 'popup.html')
      }
    }
  },
  server: {
    port: 8080
  },
  // Required for sql.js WASM support
  optimizeDeps: {
    exclude: ['sql.js']
  }
})
