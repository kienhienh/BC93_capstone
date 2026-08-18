import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/services/**'],
              message: 'Features depend on feature-owned ports, not infrastructure or legacy services.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*Route.tsx', 'src/features/**/*Screen.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Feature screens do not own browser persistence.',
        },
        {
          name: 'sessionStorage',
          message: 'Feature screens do not own browser persistence.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Feature screens do not import transport clients.',
            },
            {
              name: '@tanstack/react-query',
              message: 'Feature screens consume their controller, not QueryClient APIs.',
            },
          ],
          patterns: [
            {
              group: ['**/infrastructure/**', '**/services/**'],
              message: 'Feature screens consume public feature behavior, not adapters.',
            },
            {
              regex: '^\\./(?!public$).+',
              message: 'Feature screens import only their feature public interface.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./features/[^/]+/(?!public$).+',
              message: 'Screens outside a feature import only that feature public interface.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/Home.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Migrated feature screens do not own browser persistence.',
        },
        {
          name: 'sessionStorage',
          message: 'Migrated feature screens do not own browser persistence.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Migrated feature screens do not import transport clients.',
            },
            {
              name: '@tanstack/react-query',
              message: 'Migrated feature screens consume public screen models, not QueryClient APIs.',
            },
          ],
          patterns: [
            {
              group: ['**/infrastructure/**', '**/services/**'],
              message: 'Migrated feature screens consume feature interfaces, not adapters or legacy services.',
            },
          ],
        },
      ],
    },
  },
])
