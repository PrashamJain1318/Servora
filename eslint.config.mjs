import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.d.ts',
      'docs/**',
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Date: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off', // Delegated to TypeScript compiler (noUnusedLocals)
      'no-undef': 'off', // TypeScript handles undef checks
    },
  },
];
