import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'unit',
    environment: 'node',
    include: ['src/**/*.node.test.{js,ts}'],
    exclude: ['**/node_modules/**'],
    globals: true,
    pool: 'forks',
    fileParallelism: false,
  },
})
