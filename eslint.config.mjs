import js from '@eslint/js';
import nextConfig from 'eslint-config-next/core-web-vitals';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...nextConfig.map((config) =>
    config.settings?.react?.version === 'detect'
      ? {
          ...config,
          settings: { ...config.settings, react: { version: '19' } },
        }
      : config,
  ),
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
