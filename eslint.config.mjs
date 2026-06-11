import js from '@eslint/js'
import globals from 'globals'
import babelParser from '@babel/eslint-parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

const vitestGlobals = globals.vitest ?? {}
const browserGlobals = {
  ...globals.browser,
  __APP_BUILD_META__: 'readonly',
}

const reactRules = {
  ...js.configs.recommended.rules,
  ...react.configs.flat.recommended.rules,
  'react/no-unescaped-entities': 'off',
  'react-hooks/rules-of-hooks': 'warn',
  'react-hooks/exhaustive-deps': 'warn',
  'react/react-in-jsx-scope': 'off',
  'react/prop-types': 'off',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
}

/** ESLint flat config: JS/React (separate from npm run lint guardrails). */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'frontend/dist/**',
      '**/.cache/**',
      '**/coverage/**',
      'frontend/e2e/**',
      'frontend/playwright.config.js',
      'scripts/**',
      'backend/tests/**',
      'backend/scripts/**',
    ],
  },
  {
    files: ['frontend/src/**/*.{js,jsx}'],
    ignores: [
      'frontend/src/**/*.test.{js,jsx}',
      'frontend/src/**/*.node.test.{js,ts}',
      'frontend/src/**/__tests__/**',
      'frontend/src/**/*.contract.test.js',
    ],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { presets: ['@babel/preset-react'] },
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactRules,
    },
  },
  {
    files: [
      'frontend/src/**/*.test.{js,jsx}',
      'frontend/src/**/__tests__/**/*.{js,jsx}',
      'frontend/src/**/*.contract.test.js',
      'frontend/src/**/*.node.test.{js,ts}',
    ],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { presets: ['@babel/preset-react'] },
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...browserGlobals, ...vitestGlobals },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactRules,
    },
  },
]
