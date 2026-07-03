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
const { THEMES, MODES, buildCustomTheme, themeVarsCSS } = globalThis.SLACKIFY_THEMES;
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

// ---------- custom themes ----------
test('buildCustomTheme applies the three picked colors AS-IS to both modes', () => {
  const t = buildCustomTheme({ id: 'cst-1', label: 'My Brand', sidebar: '#F0E9F0', accent: '#611F69', topbar: '#3D1042' });
  assert.strictEqual(t.id, 'cst-1');
  // Predictable: the user's picks appear unchanged in BOTH light and dark (no mode-swap surprise).
  for (const mode of ['light', 'dark']) {
    assert.strictEqual(t.modes[mode].bg, '#F0E9F0', `${mode} sidebar = user pick`);
    assert.strictEqual(t.modes[mode].active, '#611F69', `${mode} active = user accent`);
    assert.strictEqual(t.modes[mode].topBg, '#3D1042', `${mode} top bar = user pick`);
    // every consumed key is populated (no undefined leaks into the CSS)
    for (const key of ['bg', 'active', 'text', 'activeText', 'topBg', 'topText', 'hoverOverlay', 'presence', 'mention']) {
      assert.ok(t.modes[mode][key], `${mode}.${key} must be set`);
    }
  }
});

test('buildCustomTheme keeps a DARK picked sidebar dark in light mode (no pale surprise)', () => {
  // Regression: a dark sidebar picked while Chat is in LIGHT mode must stay dark, not derive pale.
  const t = buildCustomTheme({ id: 'cst-2', label: 'Night', sidebar: '#1A1B1E', accent: '#3366FF', topbar: '#101012' });
  assert.strictEqual(t.isDark, true, 'dark sidebar → flagged as a dark theme');
  assert.strictEqual(t.modes.light.bg, '#1A1B1E', 'dark pick preserved in light mode');
  assert.strictEqual(t.modes.dark.bg, '#1A1B1E', 'dark pick preserved in dark mode');
  assert.strictEqual(t.modes.light.text, '#D1D2D3', 'pale readable ink on the dark sidebar');
});

test('themeVarsCSS renders a scoped var block per mode with no undefined', () => {
  const t = buildCustomTheme({ id: 'cst-9', label: 'X', sidebar: '#102030', accent: '#3399FF', topbar: '#0A1420' });
  const out = themeVarsCSS(t);
  assert.ok(out.includes('[data-sf-theme="cst-9"][data-sf-mode="light"]'), 'light block');
  assert.ok(out.includes('[data-sf-theme="cst-9"][data-sf-mode="dark"]'), 'dark block');
  assert.ok(out.includes('--sf-side-bg:') && out.includes('--sf-top-bg:'), 'sidebar + top vars emitted');
  assert.ok(!out.includes('undefined'), 'no undefined leaked');
});

test('newCustomTheme mints a CSS-safe, collision-free id', () => {
  const a = C.newCustomTheme([]);
  assert.match(a.id, /^cst-\d+$/, 'id is selector-safe');
  assert.ok(a.sidebar && a.accent && a.topbar, 'seeded with the three anchor colors');
  const b = C.newCustomTheme([a]);
  assert.notStrictEqual(b.id, a.id, 'id does not collide with existing');
});

test('DEFAULT_PREFS carries an empty customThemes list', () => {
  assert.ok(Array.isArray(C.DEFAULT_PREFS.customThemes), 'customThemes is an array');
  assert.strictEqual(C.DEFAULT_PREFS.customThemes.length, 0, 'empty by default');
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

test('selfslack timestamp/grouping is wired: self-meta tag, durable timestamp hook, generated rules', () => {
  // config: own-message timestamp header (self-meta) + the durable Google hook that tagger keys off
  assert.ok(C.TAGS.selfMeta && C.TAGS.selfMeta.includes('self-meta'), 'selfMeta tag missing');
  assert.ok(Array.isArray(C.SELECTORS.messageTimestamp) && C.SELECTORS.messageTimestamp.length >= 1, 'messageTimestamp selector missing');
  assert.match(C.SELECTORS.messageTimestamp[0], /data-absolute-timestamp/, 'messageTimestamp must hook the durable [data-absolute-timestamp] attr');
  // generated CSS: name sits on the time line (self-meta ::before = --sf-self-name), and grouped
  // follow-ups (data-sf-self-notime) hide the repeated avatar. Both gated behind selfslack.
  assert.ok(css.includes('[data-slackify="self-meta"]'), 'self-meta rule (name on the time line) not generated');
  assert.ok(css.includes('--sf-self-name'), 'self name variable not used in the header');
  assert.ok(css.includes('[data-sf-self-notime]'), 'grouped follow-up (notime) rule not generated');
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

test('collapsed-sidebar flyout is backed: the rail c-wiz panel gets the theme background', () => {
  // Regression: the hover flyout overflows the narrow rail-root box; without painting the rail's
  // c-wiz panel, the message list bleeds through it. This rule must out-specify the transparent
  // descendants rule (c-wiz:not([hidden]) beats *:not(img):not(image)).
  assert.match(css, /\[data-slackify="rail"\] c-wiz:not\(\[hidden\]\)\s*\{[^}]*--sf-side-bg/,
    'rail c-wiz panel must be painted with --sf-side-bg so the collapsed flyout is backed');
});

test('every feature is gated behind its data-sf-feat-<id> attribute', () => {
  // JS-only features (no CSS surface) gate themselves on the same html attribute at runtime
  // instead of via a stylesheet rule — shortcuts.js checks it per keystroke.
  const JS_ONLY = new Set(['shortcuts']);
  for (const f of C.FEATURES) {
    if (JS_ONLY.has(f.id)) continue;
    assert.ok(css.includes(`data-sf-feat-${f.id}`), `feature ${f.id} has no gated rule in the stylesheet`);
  }
});

test('every feature belongs to a declared popup group', () => {
  const groups = new Set(C.FEATURE_GROUPS.map((g) => g.id));
  for (const f of C.FEATURES) {
    assert.ok(groups.has(f.group), `feature ${f.id} has unknown group "${f.group}"`);
  }
});

test('no dead/undefined CSS variables leak in (e.g. the removed status-chip-text)', () => {
  assert.ok(!css.includes('undefined'), 'a missing value leaked into the CSS');
  assert.ok(!css.includes('status-chip-text'), 'dead --sf-status-chip-text variable is back');
});
