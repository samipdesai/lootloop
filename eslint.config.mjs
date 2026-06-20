// Root ESLint flat config — covers the shared TS packages (packages/*).
// apps/web and apps/mobile have their own configs (Next flat config / @react-native).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'apps/**'],
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
);
