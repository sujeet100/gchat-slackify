/*
 * controls.js — injects a self-owned "Hide meetings" switch into Google Chat's Home filter row,
 * right next to Chat's own "Unread" toggle. Clicking it flips prefs.features.hidemeetings in
 * chrome.storage.sync — exactly what the popup writes — so apply.js's existing storage listener
 * reacts and the generated CSS hides/shows meeting rows. No new permissions (storage only), no
 * network. The popup toggle keeps working unchanged; this is just a second, in-context entry point.
 *
 * PERFORMANCE / SAFETY CONTRACT (CLAUDE.md — "host app must never break", lightweight doctrine):
 *   - Self-owned node only. We NEVER mutate Google's internals — we insert ONE sibling cell after
 *     Chat's Unread cell, and remove only our own node.
 *   - The MutationObserver callback is O(1): set a dirty flag + schedule. All real work runs in
 *     requestIdleCallback, throttled to one pass per idle slot.
 *   - Steady-state cost is a single `isConnected` check: when our control is already in place the
 *     idle pass early-returns with NO query and NO layout/style read.
 *   - The anchor lookup (the only layout reads) runs ONLY when the control is missing — i.e. first
 *     paint and view navigation, never while the user sits on Home. On non-Home views there is no
 *     visible Unread switch, so it bails after a cheap query before any getComputedStyle.
 *   - Everything is try/caught. If the Unread anchor can't be found (other view, non-English UI,
 *     Google reshuffle) we simply don't inject — the host is untouched. Fail-safe by construction.
 */
;(function () {
  const C = globalThis.SLACKIFY_CONFIG;
  if (!C) return;

  const TAG = 'meetings-toggle';
  const FEAT = 'hidemeetings';

  // ---- preferences mirror (kept in sync with chrome.storage.sync) ----
  let prefs = { enabled: C.DEFAULT_PREFS.enabled, features: Object.assign({}, C.DEFAULT_PREFS.features) };
  function readPrefs(cb) {
    try {
      chrome.storage.sync.get('prefs', (res) => {
        const d = C.DEFAULT_PREFS;
        const saved = (res && res.prefs) || {};
        prefs = {
          enabled: saved.enabled !== undefined ? saved.enabled : d.enabled,
          features: Object.assign({}, d.features, saved.features || {}),
        };
        if (cb) cb();
      });
    } catch (e) { if (cb) cb(); }   // not an extension context → keep defaults
  }
  // Read-modify-write so we never clobber other prefs (theme, other features) written elsewhere.
  function writeFeat(on) {
    prefs.features[FEAT] = on;
    try {
      chrome.storage.sync.get('prefs', (res) => {
        const p = Object.assign({}, (res && res.prefs) || {});
        p.features = Object.assign({}, p.features || {}, { [FEAT]: on });
        try { chrome.storage.sync.set({ prefs: p }); } catch (e) {}
      });
    } catch (e) {}
  }

  // ---- self-owned styles (injected once) ----
  const STYLE_ID = 'slackify-controls-style';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    // Neutral palette that reads on both light & dark headers: label inherits the header's text
    // color; the track is a theme-agnostic translucent grey; the "on" accent is Google blue.
    st.textContent =
      `[data-slackify="${TAG}"]{display:inline-flex;align-items:center;gap:7px;margin:0 10px;font:inherit;color:inherit;white-space:nowrap;-webkit-user-select:none;user-select:none;}` +
      `[data-slackify="${TAG}"] .sf-mt-label{font-size:13px;opacity:.92;}` +
      `[data-slackify="${TAG}"] .sf-mt-sw{position:relative;width:34px;height:18px;border-radius:9px;border:none;padding:0;margin:0;cursor:pointer;background:rgba(128,128,128,.45);transition:background .15s ease;flex:0 0 auto;}` +
      `[data-slackify="${TAG}"] .sf-mt-sw:focus-visible{outline:2px solid #1a73e8;outline-offset:2px;}` +
      `[data-slackify="${TAG}"] .sf-mt-sw[aria-checked="true"]{background:#1a73e8;}` +
      `[data-slackify="${TAG}"] .sf-mt-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.3);}` +
      `[data-slackify="${TAG}"] .sf-mt-sw[aria-checked="true"] .sf-mt-knob{transform:translateX(16px);}`;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---- build the control once; the same node is re-inserted across re-renders ----
  let el = null, swBtn = null;
  function build() {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-slackify', TAG);
    const label = document.createElement('span');
    label.className = 'sf-mt-label';
    label.textContent = 'Hide meetings';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sf-mt-sw';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-label', 'Hide meetings from Home');
    btn.setAttribute('aria-checked', 'false');
    const knob = document.createElement('span');
    knob.className = 'sf-mt-knob';
    btn.appendChild(knob);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const on = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(on));
      writeFeat(on);
    });
    wrap.appendChild(label);
    wrap.appendChild(btn);
    el = wrap;
    swBtn = btn;
  }
  function reflect() {
    if (swBtn) swBtn.setAttribute('aria-checked', String(!!(prefs.features && prefs.features[FEAT])));
  }

  // The left sidebar ALSO has per-section unread-filter switches ("Direct messages", "Spaces"),
  // whose aria-labels also match /unread/. We must anchor to the HOME HEADER's Unread filter only,
  // so we exclude anything inside the sidebar. Bonus: this naturally limits the control to the Home
  // view (no Home filter row elsewhere → no injection), which is exactly where hiding meetings applies.
  function sidebarRoot() {
    const dm = C.firstMatchEl('dmList') || C.firstMatchEl('convRow');
    if (!dm) return null;
    const main = document.querySelector('[role="main"]');
    const maxW = (window.innerWidth || 1280) * 0.5;
    let el = dm, root = null;
    while (el && el !== document.documentElement) {
      if (main && el.contains(main)) break;
      const w = el.getBoundingClientRect().width;
      if (w > 0 && w < maxW) root = el;
      el = el.parentElement;
    }
    return root;
  }
  // ---- locate the VISIBLE Unread switch in the Home header (Chat keeps hidden duplicate headers) ----
  function findUnreadSwitch() {
    const sidebar = sidebarRoot();
    for (const s of (C.SELECTORS.unreadToggle || [])) {
      try {
        for (const node of document.querySelectorAll(s)) {
          if (node.offsetParent === null || node.getBoundingClientRect().width <= 0) continue;
          if (sidebar && sidebar.contains(node)) continue;   // skip sidebar section toggles
          return node;
        }
      } catch (e) {}
    }
    return null;
  }
  function findAnchorCell() {
    const sw = findUnreadSwitch();
    if (!sw) return null;                                    // not on Home → bail before any getComputedStyle
    let row = null, n = sw;
    for (let i = 0; i < 6 && n.parentElement; i++) {
      const p = n.parentElement;
      const cs = getComputedStyle(p);
      if (cs.display.indexOf('flex') !== -1 && p.children.length >= 2 && p.getBoundingClientRect().width > 150) { row = p; break; }
      n = p;
    }
    if (!row) return null;
    return Array.prototype.find.call(row.children, (c) => c.contains(sw)) || null;
  }

  // ---- inject/remove decision; cheap early-return once the control is in place ----
  function sync() {
    const present = el && el.isConnected;
    if (!prefs.enabled) { if (present) el.remove(); return; }   // skin disabled → no control
    if (present) return;                                        // already in place → zero further work
    const cell = findAnchorCell();                              // only reached when our control is missing
    if (!cell) return;                                          // header gone / other view → fail-safe
    injectStyle();
    if (!el) build();
    reflect();
    cell.insertAdjacentElement('afterend', el);
  }

  // ---- scheduling: O(1) observer → dirty flag → throttled idle pass ----
  const ric = window.requestIdleCallback || ((fn) => setTimeout(() => fn(), 250));
  let scheduled = false, dirty = true;
  function pass() { scheduled = false; if (!dirty) return; dirty = false; try { sync(); } catch (e) {} }
  function schedule() { if (scheduled) return; scheduled = true; ric(pass, { timeout: 1000 }); }

  readPrefs(() => { dirty = true; schedule(); });
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.prefs) readPrefs(() => { reflect(); dirty = true; schedule(); });
    });
  } catch (e) {}

  // observer is O(1): flag + schedule. All DOM work happens in the throttled idle pass above.
  const mo = new MutationObserver(() => { dirty = true; schedule(); });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
})();
