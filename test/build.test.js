/*
 * build.test.js — BEHAVIORAL tests for the pure build layer (config + themes + generated CSS).
 *
 * These complement performance.test.js (which guards the tagger's *structure* via source grep) by
 * asserting actual OUTPUT: theme palettes resolve to the sampled hex, the stylesheet is generated
 * from config (not hand-written), every feature is gated, and no dead/undefined values leak in.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.join(__dirname, '..');
require(path.join(root, 'src/config.js'));
require(path.join(root, 'src/themes.js'));
require(path.join(root, 'src/styles.js'));

const C = globalThis.SLACKIFY_CONFIG;
const { THEMES, MODES } = globalThis.SLACKIFY_THEMES;
const css = globalThis.SLACKIFY_STYLES.buildCSS();

// ---------- themes ----------
test('THEMES exposes the expected set with both modes', () => {
  const ids = THEMES.map((t) => t.id);
  assert.deepStrictEqual(ids, [
    'aubergine', 'jade', 'lagoon', 'clementine', 'banana', 'barbra', 'mood-indigo', 'gray', 'tritanopia',
  ]);
  for (const t of THEMES) {
    assert.ok(t.modes.light && t.modes.dark, `${t.id} must define light + dark`);
    for (const mode of ['light', 'dark']) {
      const m = t.modes[mode];
      for (const key of ['bg', 'active', 'text', 'activeText', 'topBg', 'topText', 'hoverOverlay']) {
        assert.ok(m[key], `${t.id}.${mode}.${key} must be set`);
      }
    }
  }
});

test('sampled aubergine palette resolves to its verified hex (no drift)', () => {
  const a = THEMES.find((t) => t.id === 'aubergine');
  assert.strictEqual(a.modes.light.bg, '#F0E9F0');
  assert.strictEqual(a.modes.light.active, '#611F69');
  assert.strictEqual(a.modes.light.activeText, '#FFFFFF');
  assert.strictEqual(a.modes.dark.bg, '#241229');
  assert.strictEqual(a.modes.dark.active, '#7D3986');
});

test('derived theme computes a pale light sidebar + dark sidebar from the identity hex', () => {
  const lagoon = THEMES.find((t) => t.id === 'lagoon');
  // light mode = identity lightened toward white → pale; dark mode = identity darkened → very dark.
  assert.ok(lagoon.modes.light.bg > '#C', `light bg should be pale, got ${lagoon.modes.light.bg}`);
  assert.match(lagoon.modes.dark.bg, /^#0|^#1|^#2/, `dark bg should be very dark, got ${lagoon.modes.dark.bg}`);
});

// ---------- config ----------
test('every feature has a default and is reflected in DEFAULT_PREFS', () => {
  for (const f of C.FEATURES) {
    assert.ok(typeof f.id === 'string' && f.label && f.desc, `feature ${f.id} needs id/label/desc`);
    assert.strictEqual(C.DEFAULT_PREFS.features[f.id], f.default, `${f.id} default must flow into DEFAULT_PREFS`);
  }
});

test('selfslack feature + selfRow tag + selfAvatar selector are wired', () => {
  assert.ok(C.FEATURES.some((f) => f.id === 'selfslack'), 'selfslack feature missing');
  assert.ok(C.TAGS.selfRow.includes('self-row'), 'selfRow tag missing');
  assert.ok(Array.isArray(C.SELECTORS.selfAvatar) && C.SELECTORS.selfAvatar.length >= 2, 'selfAvatar needs a fallback chain');
});

// ---------- generated CSS ----------
test('CSS is generated from config: a block per theme×mode, and a mode block per MODE', () => {
  for (const t of THEMES) {
    assert.ok(css.includes(`[data-sf-theme="${t.id}"][data-sf-mode="light"]`), `missing ${t.id} light block`);
    assert.ok(css.includes(`[data-sf-theme="${t.id}"][data-sf-mode="dark"]`), `missing ${t.id} dark block`);
  }
  for (const id of Object.keys(MODES)) {
    assert.ok(css.includes(`[data-sf-mode="${id}"]{`), `missing ${id} mode block`);
  }
});

test('every feature is gated behind its data-sf-feat-<id> attribute', () => {
  for (const f of C.FEATURES) {
    assert.ok(css.includes(`data-sf-feat-${f.id}`), `feature ${f.id} has no gated rule in the stylesheet`);
  }
});

test('no dead/undefined CSS variables leak in (e.g. the removed status-chip-text)', () => {
  assert.ok(!css.includes('undefined'), 'a missing value leaked into the CSS');
  assert.ok(!css.includes('status-chip-text'), 'dead --sf-status-chip-text variable is back');
});
