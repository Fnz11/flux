/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  server: {
    port: 3000,
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/recharts')) {
            return 'recharts'
          }
        },
      },
    },
  },
  plugins: [
    !process.env.VITEST && tanstackStart({
      srcDirectory: 'src',
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts',
        routeFileIgnorePattern: '_components|_hooks|_utils|_constants|_stores|_types',
      },
    }),
    viteReact(),
    tailwindcss(),
  ].filter(Boolean),
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
} as any)
