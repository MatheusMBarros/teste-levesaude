// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['node_modules/', '.serverless/', '.esbuild/', 'coverage/', 'dist/'],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
      // docs/regras/typescript.md exige `ReadonlyArray<T>`; o padrão do stylistic ('array') o proibiria.
      '@typescript-eslint/array-type': ['error', { default: 'array', readonly: 'generic' }],
      // Métodos de controller sem corpo ainda declaram `_request`: o decorator exige a assinatura (ADR-007).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Arquivos de configuração em JS ficam fora do tsconfig: sem regras type-aware.
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
