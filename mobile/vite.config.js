// Builds the iPhone app's web layer into mobile/dist (copied into the iOS project by Capacitor).
// Shared code is imported from ../src/renderer; React & co. resolve from the root node_modules,
// so there is a single React instance.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'firebase', 'lucide-react'],
    alias: {
      react: path.join(root, 'node_modules/react'),
      'react-dom': path.join(root, 'node_modules/react-dom'),
    },
  },
  server: { port: 5174, fs: { allow: [root] } },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, target: 'es2020' },
})
