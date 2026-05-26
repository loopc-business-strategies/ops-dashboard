import { defineConfig } from 'vitest/config'

export default defineConfig({
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
