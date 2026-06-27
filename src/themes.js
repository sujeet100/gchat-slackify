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
  const rgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mixB = (h, t) => hex(rgb(h).map((v) => v * (1 - t)));        // toward black
  const mixW = (h, t) => hex(rgb(h).map((v) => v + (255 - v) * t));  // toward white
  const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ink = (h) => (lum(h) > 140 ? '#1D1C1D' : '#FFFFFF');         // readable text on bg h
  const overlay = (bg) => (lum(bg) < 140 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');

  const PRESENCE = '#2BAC76', MENTION = '#CD2553';

  // Normalize a palette: fill activeText/presence/mention/hoverOverlay if omitted.
  const pal = (bg, active, text, activeText, presence, mention) => ({
    bg, active, text,
    activeText: activeText || ink(active),
    presence: presence || PRESENCE,
    mention: mention || MENTION,
    hoverOverlay: overlay(bg),
  });

  // Explicit (sampled) theme with both modes hand-specified.
  const ex = (id, label, isDark, light, dark) => ({ id, label, isDark, modes: { light, dark } });

  // Theme derived from a single sampled identity (swatch) color, matching the real Slack client:
  //   light: PALE tint sidebar (Slack's light "channel list"), dark text, the saturated identity
  //          reserved for the active item so the selected conversation pops.
  //   dark:  very dark tint of the hue, brighter accent for the active item.
  const ident = (id, label, identity, o) => {
    o = o || {};
    const isLight = lum(identity) > 140;
    const light = pal(
      mixW(identity, 0.90),                                  // pale tinted sidebar
      isLight ? mixB(identity, 0.20) : identity,             // active = vivid identity (dark hue) / darkened (pale hue)
      '#1D1C1D',                                             // dark text on the pale sidebar
      null, o.presence, o.mention
    );
    const dark = pal(o.darkBg || mixB(identity, 0.80), mixW(identity, 0.18), '#D1D2D3', null, o.presence, o.mention);
    return { id, label, isDark: !isLight, modes: { light, dark } };
  };

  const THEMES = [
    // ---- sampled from the live Slack client (light + dark), 2026-06-27 ----
    // light = pale tint sidebar + dark text + vivid active (sampled Slack light channel list);
    // dark  = very dark tint of the hue + brighter active.
    ex('aubergine', 'Aubergine', true,
      pal('#F0E9F0', '#611F69', '#1D1C1D', '#FFFFFF'),
      pal('#241229', '#7D3986', '#D1D2D3')),
    ex('jade', 'Jade', true,
      pal('#E8F4F0', '#178F65', '#1D1C1D', '#FFFFFF'),
      pal('#0D241E', '#106F4D', '#D1D2D3')),
    // ---- identity sampled from Slack's picker swatches; per-mode shades derived ----
    ident('lagoon', 'Lagoon', '#006EA2'),
    ident('clementine', 'Clementine', '#DB4E03'),
    ident('banana', 'Banana', '#FFD737'),
    ident('barbra', 'Barbra', '#FF81AB'),
    ident('mood-indigo', 'Mood Indigo', '#132785'),
    // ---- neutral + vision-assistive (sampled) ----
    ex('gray', 'Gray', false,
      pal('#F8F8FA', '#363636', '#1D1C1D', '#FFFFFF'),
      pal('#17191C', '#414549', '#D1D2D3', '#FFFFFF')),
    ex('tritanopia', 'Tritanopia (high contrast)', true,
      pal('#FFFFFF', '#0F1012', '#000000', '#FFFFFF', '#00B5C8', '#D93F0B'),
      pal('#0F1012', '#2C2D31', '#FFFFFF', '#FFFFFF', '#00B5C8', '#D93F0B')),
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
      statusChipText: '#1D1C1D',   // dark text on the (light) status pill in light mode
      selfBg: 'rgba(29,28,29,0.04)',   // subtle highlight band for your own messages (light)
    },
    dark: {
      contentText: '#D1D2D3', msgHover: 'rgba(255,255,255,0.06)',
      border: '#383A40', datePillBg: '#26282C', datePillText: '#ABABAD', dateLine: '#3A3D42',
      codeBg: 'rgba(255,255,255,0.09)', codeBorder: 'rgba(255,255,255,0.17)',
      searchDropBg: '#1D1C1D', searchDropText: '#D1D2D3',
      mentionPillBg: 'rgba(120,170,255,0.16)', mentionPillText: '#A8C7FA',
      codeText: '#E8912D',   // Slack inline-code orange (dark)
      statusChipText: '#E3E3E3',   // light text on the (dark) status pill in dark mode
      selfBg: 'rgba(255,255,255,0.04)',   // subtle highlight band for your own messages (dark)
    },
  };

  globalThis.SLACKIFY_THEMES = { THEMES, MODES };
})();
