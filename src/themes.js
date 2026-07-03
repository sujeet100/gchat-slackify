// @ts-check
/*
 * themes.js — Slack color themes, MODE-REACTIVE like the real Slack client.
 *
 * The big idea (see the 8 reference screenshots / docs/SLACK-THEMES.md): a single Slack theme
 * renders very differently by appearance mode. In LIGHT mode the sidebar shows the saturated
 * brand color; in DARK mode it collapses to a very dark tint of the same hue, with the color
 * surviving mainly in the active-item / accents. Google Chat has ONE sidebar surface (no separate
 * workspace rail), so each theme defines an explicit palette PER MODE and styles.js emits the CSS
 * variables under html[data-sf-theme="…"][data-sf-mode="…"]. apply.js already auto-detects the
 * mode from Chat's own appearance, so switching Chat light↔dark recolors the whole skin correctly.
 *
 * Color provenance (rule #8 — never guess hex):
 *   - aubergine / jade / gray / tritanopia: SAMPLED from the live Slack client screenshots
 *     (sidebar bg + active item, both modes) — see docs/SLACK-THEMES.md "sampled 2026-06-27".
 *   - lagoon / clementine / banana / barbra / mood-indigo: identity hex SAMPLED from Slack's
 *     own theme-picker swatches; the per-mode shades are then DERIVED deterministically from that
 *     identity (mix toward white/black), not hand-guessed.
 *
 * Each theme palette = { bg, active, activeText, text, presence, mention, hoverOverlay }.
 * topbar reuses bg/text (cohesive with the rail). Light/dark MODES below = message-area accents.
 */
;(function () {
  // ---- deterministic color helpers (so derived shades are computed, never guessed) ----
  /** Parse a `#RRGGBB` string into `[r, g, b]` (each 0–255). @param {string} h @returns {number[]} */
  const toRgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  /** Serialize `[r, g, b]` channels to an uppercase `#RRGGBB` string (clamped). @param {number[]} channels @returns {string} */
  const toHex = (channels) => '#' + channels.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  /** Mix a hex color toward black. @param {string} hex @param {number} amount 0–1 @returns {string} */
  const darken = (hex, amount) => toHex(toRgb(hex).map((v) => v * (1 - amount)));
  /** Mix a hex color toward white. @param {string} hex @param {number} amount 0–1 @returns {string} */
  const lighten = (hex, amount) => toHex(toRgb(hex).map((v) => v + (255 - v) * amount));
  /** Perceived luminance (0–255) of a hex color. @param {string} hex @returns {number} */
  const luminance = (hex) => { const [r, g, b] = toRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  /** A readable ink color (near-black or white) for text on background `hex`. @param {string} hex @returns {string} */
  const readableInk = (hex) => (luminance(hex) > 140 ? '#1D1C1D' : '#FFFFFF');
  /** Build an `rgba(...)` string from a hex color + alpha. @param {string} hex @param {number} alpha @returns {string} */
  const rgba = (hex, alpha) => { const [r, g, b] = toRgb(hex); return `rgba(${r}, ${g}, ${b}, ${alpha})`; };
  // Hover overlay: Slack's LIGHT themes wash a hovered (non-active) row in a PALE TINT OF THE
  // BRAND color — never grey; DARK themes use a subtle white wash. So derive it from the brand.
  /** @param {string} bg sidebar background @param {string} active brand/active color @returns {string} */
  const hoverWash = (bg, active) => (luminance(bg) < 140 ? 'rgba(255,255,255,0.08)' : rgba(active, 0.12));
  // Inactive sidebar text: Slack's LIGHT themes TINT the channel-list text with the brand hue
  // (aubergine shows clearly PURPLE text, not black). We keep the brand hue but pull it to a
  // readable luminance on the pale sidebar: a very dark brand (deep purple/indigo) is lightened a
  // touch so the hue is visible; a lighter mid-tone brand (green/orange) is darkened a touch for
  // contrast. Light-hued brands (banana/barbra) fall back to near-black so text stays readable.
  /** @param {string} active the theme's active/brand color @returns {string} */
  const brandText = (active) => {
    if (luminance(active) > 140) return '#1D1C1D';
    return luminance(active) < 70 ? lighten(active, 0.12) : darken(active, 0.15);
  };

  const PRESENCE = '#2BAC76', MENTION = '#CD2553';

  // Normalize a palette: fill activeText/presence/mention/hoverOverlay if omitted, and derive the
  // TOP-BAR colors. In Slack's LIGHT themes the top nav is the DARK, saturated brand (darker than
  // the pale channel list) with white text — so light-mode topBg = a deep brand shade. In DARK
  // mode the top nav matches the dark rail. (topBg/topText decouple the bar from the sidebar.)
  /**
   * @param {string} bg sidebar background
   * @param {string} active active-item / brand color
   * @param {string} text inactive sidebar text color
   * @param {string} [activeText] text on the active item (defaults to readable ink on `active`)
   * @param {string} [presence] presence-dot color (defaults to the shared green)
   * @param {string} [mention] mention color (defaults to the shared red)
   * @returns {SfThemeMode}
   */
  const palette = (bg, active, text, activeText, presence, mention) => {
    const lightMode = luminance(bg) > 140;
    const topBg = lightMode ? darken(active, 0.35) : bg;   // deep saturated brand (light) / dark rail (dark)
    return {
      bg, active, text,
      activeText: activeText || readableInk(active),
      presence: presence || PRESENCE,
      mention: mention || MENTION,
      hoverOverlay: hoverWash(bg, active),
      topBg,
      topText: lightMode ? readableInk(topBg) : text,       // white on the dark light-mode bar; rail text in dark
    };
  };

  // Explicit (sampled) theme with both modes hand-specified.
  /** @param {string} id @param {string} label @param {boolean} isDark @param {SfThemeMode} light @param {SfThemeMode} dark @returns {SfTheme} */
  const explicitTheme = (id, label, isDark, light, dark) => ({ id, label, isDark, modes: { light, dark } });

  // Theme derived from a single sampled identity (swatch) color, matching the real Slack client:
  //   light: PALE tint sidebar (Slack's light "channel list"), dark text, the saturated identity
  //          reserved for the active item so the selected conversation pops.
  //   dark:  very dark tint of the hue, brighter accent for the active item.
  /**
   * @param {string} id @param {string} label @param {string} identity sampled swatch color
   * @param {{ darkBg?: string, presence?: string, mention?: string }} [opts]
   * @returns {SfTheme}
   */
  const derivedTheme = (id, label, identity, opts) => {
    opts = opts || {};
    const isLight = luminance(identity) > 140;
    const light = palette(
      lighten(identity, 0.90),                                 // pale tinted sidebar
      isLight ? darken(identity, 0.20) : identity,             // active = vivid identity (dark hue) / darkened (pale hue)
      brandText(identity),                                     // brand-tinted text in light mode (Slack look)
      null, opts.presence, opts.mention
    );
    const dark = palette(opts.darkBg || darken(identity, 0.80), lighten(identity, 0.18), '#D1D2D3', null, opts.presence, opts.mention);
    return { id, label, isDark: !isLight, modes: { light, dark } };
  };

  const THEMES = [
    // ---- sampled from the live Slack client (light + dark), 2026-06-27 ----
    // light = pale tint sidebar + dark text + vivid active (sampled Slack light channel list);
    // dark  = very dark tint of the hue + brighter active.
    explicitTheme('aubergine', 'Aubergine', true,
      palette('#F0E9F0', '#611F69', brandText('#611F69'), '#FFFFFF'),
      palette('#241229', '#7D3986', '#D1D2D3')),
    explicitTheme('jade', 'Jade', true,
      palette('#E8F4F0', '#178F65', brandText('#178F65'), '#FFFFFF'),
      palette('#0D241E', '#106F4D', '#D1D2D3')),
    // ---- identity sampled from Slack's picker swatches; per-mode shades derived ----
    derivedTheme('lagoon', 'Lagoon', '#006EA2'),
    derivedTheme('clementine', 'Clementine', '#DB4E03'),
    derivedTheme('banana', 'Banana', '#FFD737'),
    derivedTheme('barbra', 'Barbra', '#FF81AB'),
    derivedTheme('mood-indigo', 'Mood Indigo', '#132785'),
    // ---- neutral + vision-assistive (sampled) ----
    explicitTheme('gray', 'Gray', false,
      palette('#F8F8FA', '#363636', '#1D1C1D', '#FFFFFF'),
      palette('#17191C', '#414549', '#D1D2D3', '#FFFFFF')),
    explicitTheme('tritanopia', 'Tritanopia (high contrast)', true,
      palette('#FFFFFF', '#0F1012', '#000000', '#FFFFFF', '#00B5C8', '#D93F0B'),
      palette('#0F1012', '#2C2D31', '#FFFFFF', '#FFFFFF', '#00B5C8', '#D93F0B')),
  ];

  // Light/dark MODE = message-area accents (independent of the sidebar theme).
  // Auto-synced to Google Chat's appearance by apply.js; CSS vars below flip with the mode.
  const MODES = {
    light: {
      contentText: '#1D1C1D', msgHover: '#F6F6F6',
      border: '#E0E0E0', datePillBg: '#FFFFFF', datePillText: '#616061', dateLine: '#E0E0E0',
      codeBg: 'rgba(29,28,29,0.04)', codeBorder: 'rgba(29,28,29,0.13)',
      searchDropBg: '#FFFFFF', searchDropText: '#1D1C1D',
      mentionPillBg: '#E8F2FC', mentionPillText: '#1264A3',
      codeText: '#E01E5A',   // Slack inline-code crimson (light)
      toolbarBg: '#FFFFFF',  // hover-toolbar surface (matches Slack's floating action bar)
    },
    dark: {
      contentText: '#D1D2D3', msgHover: 'rgba(255,255,255,0.06)',
      border: '#383A40', datePillBg: '#26282C', datePillText: '#ABABAD', dateLine: '#3A3D42',
      codeBg: 'rgba(255,255,255,0.09)', codeBorder: 'rgba(255,255,255,0.17)',
      searchDropBg: '#1D1C1D', searchDropText: '#D1D2D3',
      mentionPillBg: 'rgba(120,170,255,0.16)', mentionPillText: '#A8C7FA',
      codeText: '#E8912D',   // Slack inline-code orange (dark)
      toolbarBg: '#26282C',  // dark elevated surface — GChat's dark icons stay visible on it
    },
  };

  // ---- custom themes (user-defined, "a few controls": sidebar + accent + top bar) ----
  // A custom theme is DATA the user creates in the popup (see config.js DEFAULT_PREFS.customThemes).
  // It can't be baked into the stylesheet at inject-time like the built-ins, so apply.js renders its
  // CSS-var block at runtime via themeVarsCSS() below. We ask the user for THREE anchor colors and
  // DERIVE only the readability-sensitive bits (text ink, active-item text, hover wash) with the same
  // math as the built-ins — honoring rule #8 ("never guess hex"; contrast is computed, not typed).
  //
  // Predictability over cleverness: the user's three colors are applied AS-IS to BOTH appearance
  // modes. We deliberately do NOT re-derive a different palette per mode — a user who picks a dark
  // sidebar wants that dark sidebar whether Google Chat is in light or dark mode, not a pale surprise
  // (that "mode-swap" behavior was confusing: picked colors appeared ignored in the current mode).
  // The message area still flips light/dark via MODES independently, so content stays readable.
  /**
   * @param {SfCustomThemeDef} def user-defined `{ id, label, sidebar, accent, topbar }`
   * @returns {SfTheme}
   */
  const buildCustomTheme = (def) => {
    const { sidebar, accent, topbar } = def;
    const sidebarIsLight = luminance(sidebar) > 140;
    // Slack tints light-sidebar text with the brand hue; a dark sidebar needs a pale readable ink.
    const m = palette(sidebar, accent, sidebarIsLight ? brandText(accent) : '#D1D2D3');
    m.topBg = topbar;
    m.topText = readableInk(topbar);
    return { id: def.id, label: def.label, isDark: !sidebarIsLight, modes: { light: m, dark: m } };
  };

  // Render a theme's sidebar/top-bar CSS-var block for BOTH appearance modes. The SINGLE source of
  // truth for the theme variable syntax — styles.js uses it for the built-ins (baked in), apply.js
  // uses it for custom themes (injected at runtime). Keep the two in sync by construction.
  /** @param {SfTheme} t @returns {string} */
  const themeVarsCSS = (t) => ['light', 'dark'].map((mode) => {
    const m = t.modes[mode];
    return `html[data-sf-theme="${t.id}"][data-sf-mode="${mode}"]{` +
      `--sf-side-bg:${m.bg};--sf-side-active-bg:${m.active};` +
      `--sf-side-active-text:${m.activeText};--sf-side-text:${m.text};` +
      `--sf-top-bg:${m.topBg};--sf-top-text:${m.topText};` +
      `--sf-presence:${m.presence};--sf-mention:${m.mention};` +
      `--sf-side-hover-overlay:${m.hoverOverlay};}`;
  }).join('\n');

  globalThis.SLACKIFY_THEMES = { THEMES, MODES, buildCustomTheme, themeVarsCSS };
})();
