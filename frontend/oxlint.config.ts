import solid from 'eslint-plugin-solid/configs/v2-strict';
import { defineConfig } from 'oxlint';

export default defineConfig({
  options: {
    // Enables tsgolint-backed rules.
    typeAware: true,
    typeCheck: true,

    // Fail lint if any enabled rule reports a warning.
    denyWarnings: true,
  },

  // Important: specifying this replaces Oxlint's default plugin list.
  plugins: [
    'eslint',
    'typescript',
    'unicorn',
    'oxc',
    'import',
    'jsx-a11y',
    'vitest',
  ],

  jsPlugins: ['eslint-plugin-solid'],

  env: {
    browser: true,
  },

  categories: {
    // High-signal buckets.
    correctness: 'error',
    suspicious: 'error',
    perf: 'error',

    // Enable strong rules individually below instead of accepting
    // every opinionated rule in these categories.
    pedantic: 'off',
    style: 'off',
    restriction: 'off',

    // Don't let experimental rules silently enter CI.
    nursery: 'off',
  },

  ignorePatterns: [
    'dist/**',
    'coverage/**',
    '.output/**',
    '.vinxi/**',
    'node_modules/**',
    '.generated/**',
  ],

  rules: {
    /*
     * Solid
     *
     * Keep Solid's own severities; the preset catches framework footguns
     * without turning every recommendation into a build blocker.
     */
    ...solid.rules,

    /*
     * General JS
     */

    'eslint/eqeqeq': ['error', 'always'],

    'eslint/no-console': 'error',
    'eslint/no-debugger': 'error',

    'eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    /*
     * TypeScript — syntax / module hygiene
     */

    'typescript/no-explicit-any': [
      'error',
      {
        fixToUnknown: false,
        ignoreRestArgs: false,
      },
    ],

    'typescript/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
        disallowTypeAnnotations: true,
      },
    ],

    'typescript/no-import-type-side-effects': 'error',

    /*
     * TypeScript — promises
     *
     * `void save()` remains a permitted way to explicitly say
     * "this promise is intentionally not awaited".
     */
    'typescript/no-floating-promises': [
      'error',
      {
        ignoreVoid: true,
        ignoreIIFE: false,
        checkThenables: true,
      },
    ],

    'typescript/no-misused-promises': 'error',

    /*
     * TypeScript — prevent `any` leaking through typed code.
     *
     * Solid/router/template APIs currently expose enough `any` that these are
     * mostly noise here. `strict` TypeScript remains the real safety gate.
     */
    'typescript/no-unsafe-argument': 'off',
    'typescript/no-unsafe-assignment': 'off',
    'typescript/no-unsafe-call': 'off',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/no-unsafe-return': 'off',
    'typescript/no-unsafe-type-assertion': 'off',

    /*
     * TypeScript — control-flow/type correctness.
     */
    'typescript/switch-exhaustiveness-check': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',

    /*
     * Imports
     *
     * Let oxfmt own ordering. Oxlint owns semantic import problems.
     */
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'import/no-self-import': 'error',
    'import/no-unassigned-import': ['error', { allow: ['**/*.css'] }],

    /*
     * Vitest
     *
     * These aren't all in the global categories because several useful
     * Vitest policies are categorized as style.
     */
    'vitest/no-focused-tests': 'error',
    'vitest/no-identical-title': 'error',
    'vitest/no-standalone-expect': 'error',
    'vitest/valid-expect': [
      'error',
      {
        alwaysAwait: true,
      },
    ],

    // I prefer explicit:
    //
    //   import { describe, expect, it, vi } from "vitest";
    //
    // rather than Vitest globals.
    'vitest/prefer-importing-vitest-globals': 'error',
  },

  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'server.ts'],

      env: {
        node: true,
      },

      rules: {
        // Logging is often useful while debugging tests.
        'eslint/no-console': 'off',
        'typescript/unbound-method': 'off',
      },
    },

    {
      files: ['*.config.ts', 'vitest-setup.ts'],

      env: {
        node: true,
      },
    },
  ],
});
