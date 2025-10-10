import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tsPlugin.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // turn off base JS rule (type-aware rule will handle it)
      'no-unused-vars': 'off',

      // use TypeScript-aware version. set to "warn" (change to "off" to silence completely)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          // ignore variables and args that start with underscore (common pattern)
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          // include caught errors (try/catch)
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  }
])
