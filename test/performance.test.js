/*
 * performance.test.js — guards the lightweight/performance contract so we never regress it.
 * Dependency-free: run with `npm test` (Node's built-in test runner).
 *
 * Two kinds of checks:
 *   1. Behavioral: the generated stylesheet must contain NO :has() (the #1 perf/flicker rule)
 *      and stay small + well-formed.
 *   2. Source guardrails on tagger.js: idle scheduling, throttling, caching, and a
 *      collect-only MutationObserver (the observer must never compute inline).
 * See CLAUDE.md "Performance & lightweight doctrine".
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
require(path.join(root, 'src/config.js'));
require(path.join(root, 'src/themes.js'));
require(path.join(root, 'src/styles.js'));

const CONFIG = globalThis.SLACKIFY_CONFIG;
const THEMES = globalThis.SLACKIFY_THEMES;
const css = globalThis.SLACKIFY_STYLES.buildCSS();

const taggerSrc = fs.readFileSync(path.join(root, 'src/tagger.js'), 'utf8');
const controlsSrc = fs.readFileSync(path.join(root, 'src/controls.js'), 'utf8');

// ---------- behavioral: generated CSS ----------
test('generated CSS contains NO :has() (no per-recalc cost, no over-match flicker)', () => {
  assert.strictEqual((css.match(/:has\(/g) || []).length, 0,
    'A :has() selector leaked into the stylesheet. Resolve the container in JS and tag it instead.');
});

test('generated CSS is well-formed and small', () => {
  assert.ok(!css.includes('undefined'), 'CSS contains "undefined" — a missing value leaked in.');
  assert.strictEqual(css.split('{').length, css.split('}').length, 'Unbalanced CSS braces.');
  assert.ok(css.length < 30000, `Stylesheet unexpectedly large (${css.length} bytes).`);
});

test('every theme and both modes produce a variable block', () => {
  for (const t of THEMES.THEMES) {
    assert.ok(css.includes(`data-sf-theme="${t.id}"`), `missing theme block: ${t.id}`);
  }
  assert.ok(css.includes('data-sf-mode="light"') && css.includes('data-sf-mode="dark"'));
});

// ---------- robustness: config selectors ----------
test('every selector is a non-empty fallback array', () => {
  for (const [k, v] of Object.entries(CONFIG.SELECTORS)) {
    assert.ok(Array.isArray(v) && v.length >= 1, `selector ${k} must be a non-empty array`);
  }
});

test('rail selector chain has a locale-independent fallback (data-group-id)', () => {
  assert.ok(CONFIG.SELECTORS.sidebarRail.some((s) => s.includes('data-group-id')),
    'rail must have a non-aria-label fallback so it survives non-English Chat UIs.');
});

// ---------- source guardrails: tagger performance contract ----------
test('tagger schedules work in idle time (requestIdleCallback)', () => {
  assert.match(taggerSrc, /requestIdleCallback/);
});

test('tagger throttles passes (no pass-per-mutation)', () => {
  assert.match(taggerSrc, /if \(scheduled\) return/);
});

test('tagger caches expensive scans (WeakSet) incl. processed topics', () => {
  const weakSets = (taggerSrc.match(/new WeakSet\(\)/g) || []).length;
  assert.ok(weakSets >= 2, `expected >=2 WeakSet caches, found ${weakSets}`);
  assert.match(taggerSrc, /processedTopics/);
});

test('MutationObserver callback is O(1) — flag + schedule, no inline DOM work', () => {
  const start = taggerSrc.indexOf('new MutationObserver');
  const end = taggerSrc.indexOf('.observe(', start);
  assert.ok(start !== -1 && end !== -1, 'could not locate the MutationObserver setup');
  const region = taggerSrc.slice(start, end);
  assert.ok(!/getComputedStyle/.test(region), 'observer callback must not call getComputedStyle');
  assert.ok(!/getBoundingClientRect/.test(region), 'observer callback must not force layout');
  assert.ok(!/querySelector/.test(region), 'observer callback must not query the DOM inline');
  assert.ok(/dirty\s*=\s*true/.test(region), 'observer should just set the dirty flag');
  assert.ok(/schedule\(/.test(region), 'observer should schedule a throttled idle pass');
});

test('message topics are scanned LAZILY via IntersectionObserver (visible-only)', () => {
  assert.match(taggerSrc, /new IntersectionObserver/);
  assert.match(taggerSrc, /rootMargin/);
});

test('per-topic scan is cached so re-renders cost nothing', () => {
  assert.match(taggerSrc, /processedTopics\.has\(/);
  assert.match(taggerSrc, /processedTopics\.add\(/);
});

test('per-topic scan splits reads from writes (no interleaved recalc)', () => {
  // the read loop pushes into arrays; writes happen after — assert buffers exist before the loop
  assert.match(taggerSrc, /const bubbles = \[\], dates = \[\], wides = \[\]/);
});

// ---------- source guardrails: controls.js (in-page meetings toggle) ----------
test('controls injects only a self-owned node (never mutates Google internals)', () => {
  // it inserts our [data-slackify="meetings-toggle"] cell and removes only its own node
  assert.match(controlsSrc, /data-slackify/);
  assert.match(controlsSrc, /insertAdjacentElement/);
});

test('controls schedules work in idle time and throttles (no pass-per-mutation)', () => {
  assert.match(controlsSrc, /requestIdleCallback/);
  assert.match(controlsSrc, /if \(scheduled\) return/);
});

test('controls MutationObserver callback is O(1) — flag + schedule, no inline DOM work', () => {
  const start = controlsSrc.indexOf('new MutationObserver');
  const end = controlsSrc.indexOf('.observe(', start);
  assert.ok(start !== -1 && end !== -1, 'could not locate the MutationObserver setup');
  const region = controlsSrc.slice(start, end);
  assert.ok(!/getComputedStyle/.test(region), 'observer callback must not call getComputedStyle');
  assert.ok(!/getBoundingClientRect/.test(region), 'observer callback must not force layout');
  assert.ok(!/querySelector/.test(region), 'observer callback must not query the DOM inline');
  assert.ok(/dirty\s*=\s*true/.test(region), 'observer should just set the dirty flag');
  assert.ok(/schedule\(/.test(region), 'observer should schedule a throttled idle pass');
});

test('controls is fail-safe: bails when the Unread anchor is absent', () => {
  // findAnchorCell returns null off-Home; sync() must return without inserting
  assert.match(controlsSrc, /if \(!cell\) return/);
});

test('controls writes prefs to chrome.storage (drives apply.js, no new mechanism)', () => {
  assert.match(controlsSrc, /chrome\.storage\.sync\.set/);
  assert.match(controlsSrc, /chrome\.storage\.onChanged/);
});
