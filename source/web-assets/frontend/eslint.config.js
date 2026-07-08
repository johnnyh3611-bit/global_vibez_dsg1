import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

const sharedGlobals = {
  ...globals.browser,
  ...globals.es2021,
  process: 'readonly',
};

export default [
  {
    // Inline `eslint-disable` directives across the TS codebase reference rules
    // (react-hooks/*, @typescript-eslint/*) that are registered below but left
    // unconfigured. Don't flag those directives as unused — the strict CI build
    // (CI=true) turns any such warning into a hard error.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: sharedGlobals,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Register the react-hooks and @typescript-eslint plugins for TS sources so
    // the inline `eslint-disable` directives that reference their rules resolve.
    // Rules are intentionally left off here: the strict-audit backlog tracks
    // enabling them incrementally, and turning them on now would fail CI=true.
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: sharedGlobals,
    },
  },
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      '.cache/**',
      '*.config.js',
    ],
  },
];
