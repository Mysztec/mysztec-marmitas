import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', 'supabase/functions'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Sem esta regra o ESLint nao enxerga componentes usados dentro do JSX
      // e acusa importes validos como nao utilizados.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Os componentes shadcn/ui sao codigo de terceiros, versionados como estao.
    files: ['src/components/ui/**/*.jsx'],
    rules: { 'no-unused-vars': 'off', 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
