// @ts-check
/*
 * apply.js — orchestrator. Injects the generated stylesheet (+ bundled Lato @font-face) once,
 * reflects the user's saved prefs onto <html data-sf-*>, and AUTO-detects light/dark from Google
 * Chat's own appearance (no manual toggle). Runs at document_start for minimal FOUC.
 */
;(function () {
  const C = globalThis.SLACKIFY_CONFIG;
  const STYLES = globalThis.SLACKIFY_STYLES;
  const T = globalThis.SLACKIFY_THEMES;
  if (!C || !STYLES) return;

  const STYLE_ID = 'slackify-styles';
  const CUSTOM_STYLE_ID = 'slackify-custom-themes';

  // Bundled Lato (Slack's typeface). Loaded from the extension's own resources via
  // chrome.runtime.getURL — no network fetch, CSP-safe (declared in web_accessible_resources).
  function fontFaceCSS() {
    try {
      const u = (f) => chrome.runtime.getURL('fonts/' + f);
      return [400, 700, 900].map((w) =>
        `@font-face{font-family:'SlackifyLato';font-style:normal;font-weight:${w};font-display:swap;` +
        `src:url('${u('lato-' + w + '.woff2')}') format('woff2');}`
      ).join('\n');
    } catch (e) { return ''; }   // not an extension context (e.g. manual injection) → skip
  }

  function injectStylesheet() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = fontFaceCSS() + '\n' + STYLES.buildCSS();
    (document.head || document.documentElement).appendChild(style);
  }

  // ----- custom themes: render each user-defined theme's CSS-var block into our own <style> -----
  // The built-in themes are baked into the main sheet; custom themes are user DATA, so we generate
  // their identical var blocks (same renderer, themeVarsCSS) at runtime and refresh on every prefs
  // change. Each block is scoped to html[data-sf-theme="cst-N"], so it only takes effect when that
  // theme is selected — inert otherwise, zero cost. Per rule #6, a malformed color can never break
  // the host: buildCustomTheme is wrapped, so a bad entry is skipped, not thrown.
  function injectCustomThemes(customThemes) {
    if (!T || !T.buildCustomTheme) return;
    let el = document.getElementById(CUSTOM_STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = CUSTOM_STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    const css = (customThemes || []).map((def) => {
      try { return T.themeVarsCSS(T.buildCustomTheme(def)); } catch (e) { return ''; }
    }).join('\n');
    if (el.textContent !== css) el.textContent = css;
  }

  // ----- preferences: enabled / theme / features (light-dark MODE is auto, see below) -----
  function applyPrefs(prefs) {
    const html = document.documentElement;
    if (!html) return;
    if (prefs.enabled) html.setAttribute('data-sf-on', ''); else html.removeAttribute('data-sf-on');
    // Refresh custom-theme blocks BEFORE selecting one, so the block exists when the attr is set.
    injectCustomThemes(prefs.customThemes);
    // Fall back to the default theme if the saved id is unknown (e.g. a custom theme was deleted).
    const known = new Set((globalThis.SLACKIFY_THEMES ? globalThis.SLACKIFY_THEMES.THEMES : []).map((t) => t.id)
      .concat((prefs.customThemes || []).map((t) => t.id)));
    const theme = known.has(prefs.theme) ? prefs.theme : C.DEFAULT_PREFS.theme;
    html.setAttribute('data-sf-theme', theme);
    for (const f of C.FEATURES) {
      const on = prefs.features && prefs.features[f.id] !== undefined ? prefs.features[f.id] : f.default;
      if (on) html.setAttribute(`data-sf-feat-${f.id}`, ''); else html.removeAttribute(`data-sf-feat-${f.id}`);
    }
  }

  function mergeDefaults(saved) {
    const d = C.DEFAULT_PREFS;
    saved = saved || {};
    return {
      enabled: saved.enabled !== undefined ? saved.enabled : d.enabled,
      theme: saved.theme || d.theme,
      features: Object.assign({}, d.features, saved.features || {}),
      customThemes: Array.isArray(saved.customThemes) ? saved.customThemes : [],
    };
  }

  // ----- auto light/dark: follow Google Chat's appearance by sampling its background luminance -----
  function detectMode() {
    // 1) Google Chat's OWN appearance flag — authoritative and view-independent. Chat stamps
    //    <body data-theme="light|dark"> from Settings → Theme. Prefer it: sampling a background
    //    fails on the Home view ([role=main] is transparent there) and would fall through to the
    //    OS preference, mis-detecting a LIGHT Chat as dark on a dark-OS machine (which then makes
    //    every theme use its dark palette in light mode — dark sidebar, invisible status text, etc.).
    try {
      const t = document.body && document.body.getAttribute('data-theme');
      if (t === 'dark' || t === 'light') return t;
    } catch (e) {}
    // 2) fall back to sampling the conversation background luminance
    try {
      const el = document.querySelector('[role="main"]') || document.body;
      if (el) {
        const m = getComputedStyle(el).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (m && (m[4] === undefined || +m[4] > 0.1)) {
          const lum = 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3];
          return lum < 128 ? 'dark' : 'light';
        }
      }
    } catch (e) {}
    // 3) last resort: OS preference
    try { if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'; } catch (e) {}
    return 'light';
  }
  function applyMode() {
    const mode = detectMode();
    if (document.documentElement.getAttribute('data-sf-mode') !== mode) {
      document.documentElement.setAttribute('data-sf-mode', mode);
    }
  }

  // ----- boot -----
  injectStylesheet();
  applyPrefs(C.DEFAULT_PREFS);   // instant defaults so there's no flash before storage resolves
  applyMode();

  try { chrome.storage.sync.get('prefs', (res) => applyPrefs(mergeDefaults(res && res.prefs))); } catch (e) {}
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.prefs) applyPrefs(mergeDefaults(changes.prefs.newValue));
    });
  } catch (e) {}

  // re-detect light/dark on Chat theme changes — event-driven, no polling
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMode); } catch (e) {}
  const themeObs = new MutationObserver(() => applyMode());
  try { themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-darkmode'] }); } catch (e) {}
  function observeBody() { try { if (document.body) themeObs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] }); } catch (e) {} }
  observeBody();
  // the background is the page default until Chat's own theme CSS applies — settle once after load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { observeBody(); applyMode(); }, { once: true });
  }
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 600)))(applyMode);
})();
