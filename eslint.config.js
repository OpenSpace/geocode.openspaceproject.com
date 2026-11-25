import { tsLint } from '@openspace/shared-configs/eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'eslint.config.js']
  },
  {
    files: ['src/**/*.ts'],
    extends: [tsLint]
  }
);
