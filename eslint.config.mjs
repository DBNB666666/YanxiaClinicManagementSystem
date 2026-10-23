import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'release/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '.dev-data/**',
      '.tmp/**',
      'data/**',
      'scripts/*.cjs',
      '*.config.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      // 页面数据加载/订阅在 effect 中很常见；这里保留人工审查，不把它作为 lint 错误。
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off'
    },
    languageOptions: {
      globals: { ...globals.browser }
    }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'scripts/**/*.ts', '*.config.{ts,mjs}'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': 'off',
      'no-irregular-whitespace': 'off'
    }
  }
)
