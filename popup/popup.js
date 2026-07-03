// @ts-check
/*
 * popup.js — the settings UI. Reads/writes preferences to chrome.storage.sync under "prefs".
 * The content script (apply.js) listens for storage changes and re-applies instantly.
 */
(() => {
  const C = globalThis.SLACKIFY_CONFIG;
  const { THEMES, buildCustomTheme } = globalThis.SLACKIFY_THEMES;
  const DEFAULTS = C.DEFAULT_PREFS;

  // Sentinel value for the "+ New custom theme…" dropdown entry (never a real theme id).
  const NEW_SENTINEL = '__sf_new__';
  // The three anchor colors a custom theme exposes (see themes.js buildCustomTheme).
  const COLOR_KEYS = [['sidebar', 'Sidebar'], ['accent', 'Accent'], ['topbar', 'Top bar']];

  const $ = (id) => document.getElementById(id);

  // ---- hex <-> HSV (for the in-popup 2D picker; no native <input type=color> — see popup.html) ----
  /** @param {string} hex `#RRGGBB` @returns {[number,number,number]} h(0-360) s,v(0-1) */
  function hexToHsv(hex) {
    const h6 = hex.replace('#', '');
    const r = parseInt(h6.slice(0, 2), 16) / 255, g = parseInt(h6.slice(2, 4), 16) / 255, b = parseInt(h6.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }
  /** @param {number} h 0-360 @param {number} s 0-1 @param {number} v 0-1 @returns {string} `#RRGGBB` */
  function hsvToHex(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
  }

  function mergeDefaults(saved) {
    saved = saved || {};
    return {
      enabled: saved.enabled !== undefined ? saved.enabled : DEFAULTS.enabled,
      theme: saved.theme || DEFAULTS.theme,
      mode: saved.mode || DEFAULTS.mode,
      features: Object.assign({}, DEFAULTS.features, saved.features || {}),
      customThemes: Array.isArray(saved.customThemes) ? saved.customThemes : [],
    };
  }

  let prefs = mergeDefaults();

  function save() {
    try { chrome.storage.sync.set({ prefs }); } catch (e) {}
  }

  // Rate-limited save for CONTINUOUS controls (color sliders / hex / name typing). chrome.storage.sync
  // caps writes at ~120/minute; a dragged slider fires `input` dozens of times per second and would
  // blow that quota in ~2s, after which writes silently fail and BOTH the page and further edits stop
  // updating. So coalesce: write immediately on the first change, then at most once per WRITE_MIN_MS
  // (leading + trailing). flushWrite() forces the final value out on release/blur so nothing is lost
  // even if the popup closes. The popup's own preview updates every frame regardless (no storage).
  const WRITE_MIN_MS = 600;   // ≤ ~100 writes/min worst case — safely under the sync quota
  let writeTimer = null, lastWriteAt = 0;
  function scheduleWrite() {
    const now = Date.now();
    const wait = Math.max(0, WRITE_MIN_MS - (now - lastWriteAt));
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    if (wait === 0) { lastWriteAt = now; save(); }
    else writeTimer = setTimeout(() => { writeTimer = null; lastWriteAt = Date.now(); save(); }, wait);
  }
  function flushWrite() {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    lastWriteAt = Date.now();
    save();
  }

  /** The custom-theme def matching the currently-selected theme, or null for a built-in. */
  const activeCustomDef = () => (prefs.customThemes || []).find((t) => t.id === prefs.theme) || null;

  function buildThemeOptions() {
    const sel = /** @type {HTMLSelectElement} */ ($('sf-theme'));
    sel.innerHTML = '';
    const built = document.createElement('optgroup');
    built.label = 'Built-in';
    for (const t of THEMES) {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.label;   // every theme is mode-reactive (light + dark), so no ·light tag
      built.appendChild(o);
    }
    sel.appendChild(built);

    const customs = prefs.customThemes || [];
    if (customs.length) {
      const group = document.createElement('optgroup');
      group.label = 'Custom';
      for (const t of customs) {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.label || 'Custom';
        group.appendChild(o);
      }
      sel.appendChild(group);
    }

    const add = document.createElement('option');
    add.value = NEW_SENTINEL;
    add.textContent = '+ New custom theme…';
    sel.appendChild(add);
  }

  /** One toggle row for a feature. @param {SfFeature} f @returns {HTMLElement} */
  function featureRow(f) {
    const row = document.createElement('div');
    row.className = 'sf-feat';
    const text = document.createElement('div');
    text.className = 'sf-feat-text';
    const name = document.createElement('span');
    name.className = 'sf-feat-name'; name.textContent = f.label;
    const desc = document.createElement('span');
    desc.className = 'sf-feat-desc'; desc.textContent = f.desc;
    text.appendChild(name); text.appendChild(desc);

    const sw = document.createElement('label');
    sw.className = 'sf-switch';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.dataset.feat = f.id;
    const slider = document.createElement('span');
    slider.className = 'sf-slider';
    sw.appendChild(input); sw.appendChild(slider);

    input.addEventListener('change', () => {
      prefs.features[f.id] = input.checked;
      save();
    });

    row.appendChild(text); row.appendChild(sw);
    return row;
  }

  // Render features grouped into titled sections (config.js FEATURE_GROUPS drives order + labels).
  // A safety net renders any feature with an unknown/missing group at the end, so a config typo
  // can never silently drop a toggle from the UI.
  function buildFeatureRows() {
    const wrap = $('sf-features');
    wrap.innerHTML = '';
    const groups = C.FEATURE_GROUPS || [];
    const known = new Set(groups.map((g) => g.id));
    const grouped = groups.map((g) => ({ g, feats: C.FEATURES.filter((f) => f.group === g.id) }))
      .concat([{ g: null, feats: C.FEATURES.filter((f) => !known.has(f.group)) }]);
    for (const { g, feats } of grouped) {
      if (!feats.length) continue;
      const title = document.createElement('div');
      title.className = 'sf-group-title';
      title.textContent = g ? g.label : 'Other';
      wrap.appendChild(title);
      for (const f of feats) wrap.appendChild(featureRow(f));
    }
  }

  // ---- in-popup color picker: one control per anchor color ----
  /** @type {Record<string, {set:(hex:string)=>void}>} */
  const colorControls = {};

  // Drive a draggable area with pointer events (works inside the MV3 popup; no OS dialog). onMove gets
  // the cursor position as fractions (fx, fy) in [0,1]; onEnd fires on release (to flush the write).
  function draggable(el, onMove, onEnd) {
    const at = (e) => {
      const r = el.getBoundingClientRect();
      const fx = Math.min(Math.max(0, e.clientX - r.left), r.width) / r.width;
      const fy = Math.min(Math.max(0, e.clientY - r.top), r.height) / r.height;
      onMove(fx, fy);
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      at(e); e.preventDefault();
      const move = (ev) => at(ev);
      const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); onEnd(); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
  }

  function buildColorControls() {
    const host = $('sf-ct-colors');
    host.innerHTML = '';
    for (const [key, labelText] of COLOR_KEYS) {
      const wrap = document.createElement('div');
      wrap.className = 'sf-cp';

      const head = document.createElement('div');
      head.className = 'sf-row';
      const label = document.createElement('span');
      label.className = 'sf-label'; label.textContent = labelText;
      const right = document.createElement('div');
      right.className = 'sf-cp-right';
      const hex = document.createElement('input');
      hex.type = 'text'; hex.className = 'sf-cp-hex'; hex.maxLength = 7; hex.spellcheck = false;
      const swatch = document.createElement('button');
      swatch.type = 'button'; swatch.className = 'sf-cp-swatch';
      swatch.setAttribute('aria-label', labelText + ' color — toggle picker');
      right.appendChild(hex); right.appendChild(swatch);
      head.appendChild(label); head.appendChild(right);

      // 2D picker: a saturation/value square + a hue strip, each with a draggable handle.
      const pop = document.createElement('div');
      pop.className = 'sf-cp-pop'; pop.hidden = true;
      const sv = document.createElement('div'); sv.className = 'sf-cp-sv';
      const svDot = document.createElement('div'); svDot.className = 'sf-cp-sv-dot'; sv.appendChild(svDot);
      const hue = document.createElement('div'); hue.className = 'sf-cp-hue';
      const hueDot = document.createElement('div'); hueDot.className = 'sf-cp-hue-dot'; hue.appendChild(hueDot);
      pop.appendChild(sv); pop.appendChild(hue);

      wrap.appendChild(head); wrap.appendChild(pop);
      host.appendChild(wrap);

      // internal HSV state (s,v in 0..1); the SV square = white→hue (x) and full→black (y).
      let h = 0, s = 0, v = 0;
      const applyVisual = () => {
        sv.style.background =
          `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${h}, 100%, 50%)`;
        svDot.style.left = (s * 100) + '%';
        svDot.style.top = ((1 - v) * 100) + '%';
        hueDot.style.left = ((h / 360) * 100) + '%';
        const c = hsvToHex(h, s, v);
        swatch.style.background = c;
        return c;
      };
      // commit updates the def + popup preview instantly and schedules a (rate-limited) storage write,
      // which is what pushes the change to the page. Never call save() per move — it exhausts the sync
      // write quota and freezes further live updates (see scheduleWrite).
      const commit = () => {
        const def = activeCustomDef();
        if (!def) return;
        def[key] = hsvToHex(h, s, v);
        updatePreview(def);
        scheduleWrite();
      };
      draggable(sv, (fx, fy) => { s = fx; v = 1 - fy; hex.value = applyVisual(); commit(); }, flushWrite);
      draggable(hue, (fx) => { h = fx * 360; hex.value = applyVisual(); commit(); }, flushWrite);
      // hex field → color (only when it's a valid 6-digit hex); don't overwrite the field while typing.
      hex.addEventListener('input', () => {
        let val = hex.value.trim();
        if (val && val[0] !== '#') val = '#' + val;
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
          [h, s, v] = hexToHsv(val);
          applyVisual(); commit();
        }
      });
      hex.addEventListener('change', flushWrite);
      swatch.addEventListener('click', () => { pop.hidden = !pop.hidden; if (!pop.hidden) applyVisual(); });

      // set() populates the control WITHOUT emitting a change (used when loading a theme)
      colorControls[key] = {
        set: (c) => { [h, s, v] = hexToHsv(c); hex.value = applyVisual(); },
      };
    }
  }

  // ---- custom-theme editor ----
  // Paint the mini preview from the DERIVED palette so the user sees exactly what the page will show.
  function updatePreview(def) {
    try {
      const t = buildCustomTheme(def);
      const m = t.isDark ? t.modes.dark : t.modes.light;
      $('sf-preview-top').style.background = m.topBg;
      const side = $('sf-preview-side');
      side.style.background = m.bg;
      const act = $('sf-preview-active');
      act.style.background = m.active; act.style.color = m.activeText;
      $('sf-preview-text').style.color = m.text;
    } catch (e) {}
  }

  function populateEditor(def) {
    /** @type {HTMLInputElement} */ ($('sf-ct-name')).value = def.label || '';
    for (const [key] of COLOR_KEYS) colorControls[key].set(def[key]);
    updatePreview(def);
  }

  function render() {
    /** @type {HTMLInputElement} */ ($('sf-enabled')).checked = prefs.enabled;
    /** @type {HTMLSelectElement} */ ($('sf-theme')).value = prefs.theme;
    const def = activeCustomDef();
    $('sf-custom-editor').hidden = !def;
    if (def) populateEditor(def);
    document.querySelectorAll('#sf-features input[data-feat]').forEach((i) => {
      const input = /** @type {HTMLInputElement} */ (i);
      input.checked = !!prefs.features[input.dataset.feat];
      input.disabled = !prefs.enabled;
    });
    document.querySelectorAll('.sf-section, .sf-foot').forEach((el) => {
      el.classList.toggle('sf-disabled', !prefs.enabled);
    });
  }

  /** Rebuild the theme dropdown (after add/delete) then re-render. */
  function refresh() { buildThemeOptions(); render(); }

  function wire() {
    $('sf-enabled').addEventListener('change', (e) => { prefs.enabled = /** @type {HTMLInputElement} */ (e.target).checked; save(); render(); });

    $('sf-theme').addEventListener('change', (e) => {
      const v = /** @type {HTMLSelectElement} */ (e.target).value;
      if (v === NEW_SENTINEL) {
        const def = C.newCustomTheme(prefs.customThemes);
        prefs.customThemes = (prefs.customThemes || []).concat(def);
        prefs.theme = def.id;
        save();
        refresh();
        const nameEl = /** @type {HTMLInputElement} */ ($('sf-ct-name'));
        nameEl.focus(); nameEl.select();
        return;
      }
      prefs.theme = v;
      save();
      render();
    });

    // Rename: update the def + its dropdown option in place (no rebuild → keeps text-field focus).
    $('sf-ct-name').addEventListener('input', (e) => {
      const def = activeCustomDef();
      if (!def) return;
      def.label = /** @type {HTMLInputElement} */ (e.target).value;
      scheduleWrite();
      const opt = $('sf-theme').querySelector(`option[value="${def.id}"]`);
      if (opt) opt.textContent = def.label || 'Custom';
    });
    $('sf-ct-name').addEventListener('change', flushWrite);   // blur → persist promptly

    $('sf-ct-delete').addEventListener('click', () => {
      const def = activeCustomDef();
      if (!def) return;
      prefs.customThemes = (prefs.customThemes || []).filter((t) => t.id !== def.id);
      prefs.theme = DEFAULTS.theme;
      save();
      refresh();
    });

    $('sf-reset').addEventListener('click', () => { prefs = mergeDefaults(); save(); refresh(); });
  }

  buildThemeOptions();
  buildColorControls();
  buildFeatureRows();
  wire();

  try {
    chrome.storage.sync.get('prefs', (res) => { prefs = mergeDefaults(res && res.prefs); refresh(); });
  } catch (e) { render(); }
})();
