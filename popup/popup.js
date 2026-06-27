/*
 * popup.js — the settings UI. Reads/writes preferences to chrome.storage.sync under "prefs".
 * The content script (apply.js) listens for storage changes and re-applies instantly.
 */
(() => {
  const C = globalThis.SLACKIFY_CONFIG;
  const { THEMES } = globalThis.SLACKIFY_THEMES;
  const DEFAULTS = C.DEFAULT_PREFS;

  const $ = (id) => document.getElementById(id);

  function mergeDefaults(saved) {
    saved = saved || {};
    return {
      enabled: saved.enabled !== undefined ? saved.enabled : DEFAULTS.enabled,
      theme: saved.theme || DEFAULTS.theme,
      mode: saved.mode || DEFAULTS.mode,
      features: Object.assign({}, DEFAULTS.features, saved.features || {}),
    };
  }

  let prefs = mergeDefaults();

  function save() {
    try { chrome.storage.sync.set({ prefs }); } catch (e) {}
  }

  function buildThemeOptions() {
    const sel = $('sf-theme');
    sel.innerHTML = '';
    for (const t of THEMES) {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.label;   // every theme is now mode-reactive (light + dark), so no ·light tag
      sel.appendChild(o);
    }
  }

  function buildFeatureRows() {
    const wrap = $('sf-features');
    wrap.innerHTML = '';
    for (const f of C.FEATURES) {
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
      wrap.appendChild(row);
    }
  }

  function render() {
    $('sf-enabled').checked = prefs.enabled;
    $('sf-theme').value = prefs.theme;
    document.querySelectorAll('#sf-features input[data-feat]').forEach((i) => {
      i.checked = !!prefs.features[i.dataset.feat];
      i.disabled = !prefs.enabled;
    });
    document.querySelectorAll('.sf-section, .sf-foot').forEach((el) => {
      el.classList.toggle('sf-disabled', !prefs.enabled);
    });
  }

  function wire() {
    $('sf-enabled').addEventListener('change', (e) => { prefs.enabled = e.target.checked; save(); render(); });
    $('sf-theme').addEventListener('change', (e) => { prefs.theme = e.target.value; save(); });
    $('sf-reset').addEventListener('click', () => { prefs = mergeDefaults(); save(); render(); });
  }

  buildThemeOptions();
  buildFeatureRows();
  wire();

  try {
    chrome.storage.sync.get('prefs', (res) => { prefs = mergeDefaults(res && res.prefs); render(); });
  } catch (e) { render(); }
})();
