/*
 * eslint.config.js — flat config (ESLint 9).
 *
 * This is a vanilla-JS MV3 extension with NO build step: source files are plain scripts (IIFEs that
 * assign to globalThis.SLACKIFY_*), the test/validator run under Node (CommonJS), and the in-page
 * health check runs in the browser console. Each gets its own globals set below.
 *
 * The high-value rule here is `no-undef`: it catches the IIFE/global wiring mistakes this codebase
 * is prone to (a typo'd global, a helper used before it's defined, a stray browser API). Stylistic
 * nits are 'warn' (they don't fail CI); correctness issues are 'error'.
 */
const js = require('@eslint/js');

// Browser + WebExtension globals used across the content scripts / popup / health-check.
const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', console: 'readonly',
  globalThis: 'readonly', chrome: 'readonly',
  getComputedStyle: 'readonly', matchMedia: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly',
  requestIdleCallback: 'readonly', requestAnimationFrame: 'readonly',
  MutationObserver: 'readonly', IntersectionObserver: 'readonly',
  CSS: 'readonly', Node: 'readonly', Element: 'readonly', HTMLElement: 'readonly',
};

const node = {
  require: 'readonly', module: 'writable', exports: 'writable',
  process: 'readonly', __dirname: 'readonly', __filename: 'readonly',
  Buffer: 'readonly', console: 'readonly', globalThis: 'readonly',
};

// Shared rule tweaks: this codebase deliberately uses empty `catch (e) {}` (fail-safe doctrine —
// the host app must never break) and occasional unused fn args, so loosen those two.
const shared = {
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  eqeqeq: 'warn',
};

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'fonts/**', 'icons/**'] },

  // Content scripts + popup + in-page health check → browser/webext globals, plain scripts.
  {
    files: ['src/**/*.js', 'popup/**/*.js', 'tools/health-check.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: browser },
    rules: { ...js.configs.recommended.rules, ...shared },
  },

  // Node-side tooling: tests + the manifest validator (CommonJS).
  {
    files: ['test/**/*.js', 'tools/validate-manifest.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: node },
    rules: { ...js.configs.recommended.rules, ...shared },
  },
];
