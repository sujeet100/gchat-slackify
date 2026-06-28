/*
 * anonymize-for-screenshots.js — paste-in console helper for capturing PRIVACY-SAFE store
 * screenshots from REAL Google Chat (with the extension/skin active).
 *
 * What it does:
 *   • Replaces every visible name, channel/space name, DM, group-DM, meeting, @mention and avatar
 *     — including YOUR OWN account — with stable, fictional, NON-repeating stand-ins, and keeps
 *     them replaced as Chat re-renders. Nothing leaves the page.
 *   • Optionally injects a brand-new fictional DM ("Jordan Blake") as the FIRST conversation and
 *     frames the open conversation as that DM, so you can screenshot a clean, curated thread that
 *     was never based on any real conversation (INJECT_DEMO_DM, on by default).
 *
 * HOW TO USE
 *   1. Open chat.google.com in YOUR normal Chrome with the extension ON. Open ANY DM (a throwaway
 *      one is ideal). Avoid conversations with image/document attachments — pixels in an uploaded
 *      image cannot be text-scrubbed.
 *   2. Fill in the EDIT THESE block (your name/email/company + any extra terms to nuke).
 *   3. DevTools (⌥⌘I) → Console → paste this whole file → Enter.
 *   4. Wait ~1s for it to settle, read the ✅/⚠️ report, eyeball the sidebar + header + messages.
 *   5. Screenshot (⌘⇧4). Re-run after switching theme/mode. Stop with window.__sfStopScrub().
 */
(() => {
  // ===== EDIT THESE =====
  const REAL_NAME  = 'Your Name';            // your Google account display name
  const REAL_EMAIL = 'you@example.com';      // your account email
  const COMPANY    = '';                     // your workspace/company name shown in the top bar
  const EXTRA_TERMS = [];                    // any other strings to nuke: ['alt@example.com', 'ClientCo']
  // Literal find→replace pairs applied to ALL visible text — your escape hatch for anything the
  // automatic anonymizer misses or that you want to control by hand. e.g. [['Plato', 'Prime']].
  const CUSTOM_REPLACE = [];

  const SCRUB_BODIES   = true;   // replace message bodies with the curated script below
  const INJECT_DEMO_DM = true;   // inject a NEW fictional "Jordan Blake" DM as the first conversation
  // ======================

  const SELF = 'Alex Rivera';
  const SELF_EMAIL = 'alex.rivera@example.com';
  const DEMO_PEER = 'Jordan Blake';            // the fictional person the open/dummy conversation is with
  const PEOPLE = ['Maya Chen', 'Diego Ramos', 'Priya Nair', 'Sam Okafor', 'Aisha Khan',
    'Leo Martins', 'Nina Park', 'Omar Haddad', 'Tara Singh', 'Ben Cole', 'Grace Liu', 'Ravi Menon',
    'Sofia Rossi', 'Kenji Tanaka', 'Zoe Adams', 'Marcus Webb', 'Lena Fischer', 'Arjun Mehta',
    'Chloe Dubois', 'Noah Kim', 'Ivy Zhang', 'Hassan Ali', 'Elena Petrova', 'Theo Walsh'];
  // Cutting-edge + believable channel names, INTERLEAVED (AI-forward names spread among classic
  // eng channels) so any visible slice of the sidebar shows a good mix. Assigned uniquely.
  const CHANNELS = ['agentic-ai', 'platform-eng', 'rag-pipeline', 'design-system', 'prompt-eng',
    'growth', 'vector-search', 'frontend-guild', 'model-evals', 'devex', 'llm-platform',
    'backend-guild', 'fine-tuning', 'observability', 'ai-safety', 'data-platform', 'copilot-dev',
    'sre', 'embeddings', 'api-gateway', 'multimodal', 'mobile', 'agent-runtime', 'security',
    'semantic-search', 'infra', 'model-serving', 'qa-automation', 'eval-harness', 'user-research',
    'knowledge-graph', 'docs', 'realtime-voice', 'release-train', 'inference-infra', 'hackathon',
    'red-team', 'watercooler', 'mlops', 'random'];
  const MEETINGS = ['Agentic AI Sync', 'LLM Eval Review', 'Sprint Planning', 'RAG Deep-Dive',
    'Product Roadmap', '1:1', 'Retro', 'All Hands', 'Model Launch Prep', 'Design Review'];
  // Curated, realistic 1:1 thread for the open/dummy conversation (top→bottom): two people
  // discovering the Slackify extension. Plain strings become text; { html } entries render markup
  // so the skin styles them — used here to showcase an @mention pill and a ```code``` block.
  // Edit freely; keep it benign + fictional.
  // A rich entry is { parts: [...] } where each part is a string (text) or { tag, attrs, text }
  // (an element). We build it with createElement — chat.google.com's Trusted-Types CSP forbids
  // innerHTML. Used to showcase a styled @mention pill and a ```code``` block.
  const DM_SCRIPT = [
    'have you seen this Slackify extension for Google Chat? a teammate just shared it',
    'no, what is it?',
    'so it is a tiny Chrome extension that restyles Google Chat to look and feel like Slack — a # in front of every space, DMs grouped together, bold sender names, the works. the wild part is it is 100% cosmetic: it just injects some CSS and tags a few DOM nodes, it never reads or changes your messages and nothing ever leaves the browser. the whole thing runs on a single "storage" permission.',
    'wait, that actually sounds really well thought out 👀',
    'yeah, and it follows your Chat dark/light theme automatically 🌙',
    { parts: ['barely any setup, no bundler even:', { tag: 'pre', text: 'git clone slackify-for-gchat\ncd slackify-for-gchat\n# chrome://extensions → Load unpacked' }] },
    { parts: ['nice. and the entire config is literally just ', { tag: 'code', text: '"permissions": ["storage"]' }, ' ? that is it?'] },
    'yep, that is the whole permission footprint. and it is open source 🙌',
    { parts: ['cc ', { tag: 'span', attrs: { 'data-user-mention-type': '1', 'data-sf-rich-mention': '1' }, text: '@Maya Chen' }, ' you have to see this'] },
    { parts: ['already shared it in the eng channel — people are into it', { tag: 'div', attrs: { 'data-slackify': 'thread-chip', 'data-sf-rich': '1' }, children: [{ tag: 'span', attrs: { 'data-slackify': 'reply-count' }, text: '6 replies' }] }] },
    'honestly this is the first "make X look like Y" extension i have tried that does not feel hacky — my own messages go left-aligned with my avatar just like Slack, code blocks and @mentions get the full Slack treatment, and there is zero lag scrolling. i think i am keeping this on permanently.',
    'haha told you 🎉 welcome to the club',
  ];

  const COLORS = ['#C0497A', '#3E8E7E', '#9A6A2E', '#5B6470', '#3B7DD8', '#8A5BD0', '#2E9E6B', '#D9682B'];
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const initials = (n) => n.split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

  // Stable, UNIQUE mapping: same real name → same fake; distinct reals → distinct fakes (assigned
  // in first-seen order) so no two spaces/people collide until the pool is exhausted.
  const nameMap = new Map();
  const poolIdx = new Map();
  const mapName = (real, pool) => {
    const key = (real || '').trim();
    if (!key) return pool[0];
    if (!nameMap.has(key)) {
      const i = poolIdx.get(pool) || 0;
      nameMap.set(key, pool[i % pool.length]);
      poolIdx.set(pool, i + 1);
    }
    return nameMap.get(key);
  };
  // group DM "Asha, Ben, +2" → "Maya Chen, Diego Ramos" (first two members mapped)
  const mapGroup = (label) => label.split(',').map((s) => s.replace(/\+\d+.*/, '').trim()).filter(Boolean)
    .slice(0, 2).map((s) => mapName(s, PEOPLE)).join(', ') || mapName(label, PEOPLE);
  const fakeMeetCode = (key) => {
    const a = 'bcdfghjklmnpqrstvwxyz';
    const seg = (k, n) => { let s = ''; let h = hash(k); for (let i = 0; i < n; i++) { s += a[h % a.length]; h = (h / a.length) | 0; } return s; };
    return `${seg(key + '1', 3)}-${seg(key + '2', 4)}-${seg(key + '3', 3)}`;
  };

  // ---- avatars: account box → hidden entirely; others → half photo-like, half initials tile ----
  function initialsAvatarURI(name) {
    const c = document.createElement('canvas'); c.width = c.height = 72;
    const x = c.getContext('2d');
    x.fillStyle = COLORS[hash(name) % COLORS.length]; x.fillRect(0, 0, 72, 72);
    x.fillStyle = '#fff'; x.font = '700 30px Lato, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(initials(name) || '?', 36, 40);
    return c.toDataURL('image/png');
  }
  function photoAvatarURI(name) {
    const c = document.createElement('canvas'); c.width = c.height = 72;
    const x = c.getContext('2d');
    const h = hash(name);
    const g = x.createLinearGradient(0, 0, 72, 72);
    g.addColorStop(0, COLORS[h % COLORS.length]); g.addColorStop(1, COLORS[(h >>> 3) % COLORS.length]);
    x.fillStyle = g; x.fillRect(0, 0, 72, 72);
    x.fillStyle = 'rgba(255,255,255,0.82)';
    x.beginPath(); x.arc(36, 30, 12, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(36, 64, 20, 16, 0, Math.PI, 0, true); x.fill();
    return c.toDataURL('image/png');
  }
  const fakeAvatarFor = (name) => (hash(name) % 2 === 0 ? photoAvatarURI(name) : initialsAvatarURI(name));
  const SELF_AVATAR_URI = initialsAvatarURI(SELF); // your own-message avatar (selfslack ::before)

  // Anti-flicker write: Wiz restores real text after we overwrite it. We count consecutive reverts
  // per node and, if Wiz keeps winning (e.g. live-updating meeting rows), HIDE the node so the real
  // value can't flash. The hide is RECOVERABLE — a periodic reset (below) un-hides and retries, so a
  // brief load-time render storm doesn't permanently hide a row that later settles.
  const flick = new WeakMap();
  const FLICK_MAX = 20;
  const setText = (el, t) => {
    if (!el || el.textContent === t) return;
    const rec = flick.get(el);
    const hits = rec && rec.want === t ? rec.hits + 1 : 0;
    if (hits >= FLICK_MAX) {
      if (el.getAttribute('data-sf-flicker') !== '1') { el.style.visibility = 'hidden'; el.setAttribute('data-sf-flicker', '1'); count.hidden++; }
      return;
    }
    el.textContent = t; flick.set(el, { want: t, hits });
  };
  // Stable apply: compute the fake ONCE (from the real text, before we change it), pin it on the
  // node, and only ever re-apply THAT fake. This is what stops names from churning every frame.
  const apply = (el, makeFake) => {
    if (el.dataset.sfFake === undefined) { const f = makeFake(); if (f == null) return; el.dataset.sfFake = f; }
    setText(el, el.dataset.sfFake);
  };
  // Build a rich body from node specs using DOM APIs (Trusted-Types-safe; no innerHTML). A spec is
  // a string (text node) or { tag, attrs, text, children } (children recurse).
  const mkNode = (spec) => {
    if (typeof spec === 'string') return document.createTextNode(spec);
    const e = document.createElement(spec.tag);
    if (spec.attrs) for (const k in spec.attrs) e.setAttribute(k, spec.attrs[k]);
    if (spec.children) spec.children.forEach((c) => e.appendChild(mkNode(c)));
    else if (spec.text != null) e.textContent = spec.text;
    return e;
  };
  const buildInto = (el, parts) => {
    while (el.firstChild) el.removeChild(el.firstChild);
    parts.forEach((p) => el.appendChild(mkNode(p)));
  };

  // Text that is UI chrome, NOT a person/space/meeting name — never harvest these as "real names".
  const STATUS_WORDS = new Set(['Away', 'Active', 'Offline', 'Busy', 'Do not disturb', 'Unread', 'Mentioned',
    'Starred', 'New', 'Draft', 'You', 'Suggested contact']);
  const isUiText = (t) => !t || STATUS_WORDS.has(t) || /,\s*$/.test(t) || /^\d/.test(t)
    || /^(Open in|Options|Dismiss|Press tab|Suggested|More|Show|View|Reply|Replies|Mark|Pinned)/i.test(t);

  let count = { spaces: 0, dms: 0, meetings: 0, senders: 0, mentions: 0, avatars: 0, account: 0, logos: 0, bodies: 0, swept: 0, hidden: 0 };
  const personPairs = new Map(); // real DISPLAY name -> fake, drives the global text find/replace

  function injectDemoDM() {
    if (!INJECT_DEMO_DM) return;
    const anchor = document.querySelector('[role="listitem"][data-group-id^="dm/"]');
    const list = anchor && anchor.parentElement;
    if (!list || list.querySelector('[data-sf-dummy]')) return;
    const dn0 = anchor.querySelector('[data-name]');
    const realName = ((dn0 && dn0.dataset.sfReal !== undefined ? dn0.dataset.sfReal : (dn0 && dn0.getAttribute('data-name'))) || '').trim();
    const clone = anchor.cloneNode(true);
    clone.setAttribute('data-sf-dummy', '1');
    clone.removeAttribute('data-group-id');
    clone.querySelectorAll('[data-name]').forEach((d) => d.setAttribute('data-name', DEMO_PEER));
    // relabel every text node that shows the real name (the visible label may NOT be a presentation span)
    const w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (realName && n.nodeValue.includes(realName)) n.nodeValue = n.nodeValue.split(realName).join(DEMO_PEER);
    }
    clone.querySelectorAll('img').forEach((img) => { img.src = fakeAvatarFor(DEMO_PEER); img.srcset = ''; img.style.background = 'transparent'; });
    clone.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, true); // don't navigate
    list.insertBefore(clone, list.firstChild);
    anchor.style.display = 'none'; // hide the real open-DM row so only "Jordan Blake" shows as selected
  }

  function scrub() {
    try {
      // The skin paints YOUR own-message name + avatar from these CSS vars (set by the extension's
      // tagger from your real account). Override them so own messages show the fictional self.
      document.documentElement.style.setProperty('--sf-self-name', JSON.stringify(SELF));
      document.documentElement.style.setProperty('--sf-self-avatar', `url("${SELF_AVATAR_URI}")`);

      // --- sidebar: every conversation row (DMs, group-DMs, spaces, meetings) ---
      // Harvest the VISIBLE displayed name (the longest non-UI text leaf — never presence/status),
      // because data-name is unreliable (on "Suggested contact" rows it's an email, not the name).
      // Replace that exact leaf AND register real→fake so the global sweep scrubs it everywhere.
      document.querySelectorAll('[role="listitem"]').forEach((row) => {
        if (row.hasAttribute('data-sf-dummy') || row.closest('[data-is-message]') || row.closest('[role="main"]')) return;
        const g = row.getAttribute('data-group-id') || '';
        const dn = row.querySelector('[data-name]');
        if (!g && !dn) return; // skip section headers (no group-id, no data-name)
        // the displayed name = longest childless, non-tooltip, non-UI text leaf in the row
        const nameLeaf = [...row.querySelectorAll('*')]
          .filter((n) => !n.children.length && !n.closest('[role="tooltip"]') && (n.textContent || '').trim().length > 1 && !isUiText(n.textContent.trim()))
          .sort((a, b) => b.textContent.trim().length - a.textContent.trim().length)[0];
        if (!nameLeaf) return;
        if (nameLeaf.dataset.sfReal === undefined) nameLeaf.dataset.sfReal = nameLeaf.textContent.trim();
        const real = nameLeaf.dataset.sfReal;
        if (!real || real.length < 2) return;
        const person = !!dn || g.startsWith('dm/');
        const isMeeting = !person && (/catch-?up|stand-?up|\bsync\b|review|retro|1:1|planning|huddle|meeting|\bcall\b|\[/i.test(real)
          || /[-–]\s*[A-Z][a-z]{2,}\.?\s*\d/.test(real)
          || !!row.querySelector('[data-tooltip*="calendar" i], [aria-label*="calendar" i], [aria-label*="meeting" i]'));
        let fake;
        if (real === REAL_NAME) fake = SELF;
        else if (real.includes(',')) fake = mapGroup(real);
        else if (person) fake = mapName(real, PEOPLE);
        else if (isMeeting) { const key = real.replace(/\s*[-–]\s*[A-Za-z]{3,}\.?\s*\d.*$/, '').trim(); fake = mapName(key || real, MEETINGS); }
        else fake = mapName(real, CHANNELS);
        apply(nameLeaf, () => fake);
        if (dn && (dn.getAttribute('data-name') || '').trim() === real) dn.setAttribute('data-name', fake); // only if it WAS the name
        if (real !== REAL_NAME && !personPairs.has(real)) personPairs.set(real, fake);
        count.dms++;
      });
      // --- messages: sender NAME (the span[translate="no"] leaf whose text === data-name) ---
      document.querySelectorAll('[data-is-message]').forEach((m) => {
        if (m.dataset.sfReal === undefined) m.dataset.sfReal = (m.getAttribute('data-name') || '').trim();
        const real = m.dataset.sfReal;
        if (!real) return;
        const fake = INJECT_DEMO_DM ? DEMO_PEER : mapName(real, PEOPLE); // open pane = the dummy 1:1
        m.setAttribute('data-name', fake);
        if (m.hasAttribute('data-hovercard-id')) m.setAttribute('data-hovercard-id', SELF_EMAIL);
        m.querySelectorAll('span[translate="no"]').forEach((leaf) => {
          if (!leaf.children.length && (leaf.textContent || '').trim() === real) { apply(leaf, () => fake); count.senders++; }
        });
      });
      // --- message BODIES → curated script (div[jsname="bgckF"] is the body container) ---
      // A clean two-person chat: YOUR own messages render as SELF (Alex Rivera) via the global
      // --sf-self-name/avatar set at the top of scrub; the OTHER side renders as DEMO_PEER (Jordan
      // Blake) via the sender-name loop above. We assign the script in document order; no per-message
      // speaker override (that "balance" hack fought the skin's message-grouping and read as one name).
      if (SCRUB_BODIES) {
        let mi = 0;
        document.querySelectorAll('div[jsname="bgckF"]').forEach((body) => {
          if (!(body.textContent || '').trim() && body.dataset.sfIdx === undefined) return;
          if (!INJECT_DEMO_DM && body.querySelector('[data-user-mention-type], code, pre, img, a[href]')) return;
          if (body.dataset.sfIdx === undefined) {
            const idx = mi % DM_SCRIPT.length;
            body.dataset.sfIdx = String(idx);
            const entry = DM_SCRIPT[idx];
            if (typeof entry === 'string') { body.dataset.sfRich = ''; body.dataset.sfFake = entry; setText(body, entry); }
            else { body.dataset.sfRich = '1'; buildInto(body, entry.parts); }
            count.bodies++;
          } else if (body.dataset.sfRich === '1') {
            if (!body.querySelector('pre, code, [data-sf-rich-mention], [data-slackify="thread-chip"]')) buildInto(body, DM_SCRIPT[parseInt(body.dataset.sfIdx, 10)].parts);
          } else {
            setText(body, body.dataset.sfFake);
          }
          mi++;
        });
      }
      // --- @mentions (skip our injected showcase mention so it keeps its fixed fake name) ---
      document.querySelectorAll('[data-user-mention-type]').forEach((el) => {
        if (el.hasAttribute('data-sf-rich-mention')) return;
        apply(el, () => { const t = (el.textContent || '').replace(/^@/, '').trim(); return t ? '@' + mapName(t, PEOPLE) : null; });
        count.mentions++;
      });
      // --- conversation header title ---
      document.querySelectorAll('button[aria-haspopup="menu"] span').forEach((el) => {
        if (el.children.length) return;
        const r = el.getBoundingClientRect();
        if (r.top < 130 && r.width > 0 && parseFloat(getComputedStyle(el).fontSize) >= 16) {
          const t = (el.textContent || '').trim();
          if (t && t.length < 40) apply(el, () => (INJECT_DEMO_DM ? DEMO_PEER : mapName(el.textContent, PEOPLE)));
        }
      });
      // --- meetings: Google Meet cards / links + codes ---
      document.querySelectorAll('a[href*="meet.google.com"], a[data-tooltip*="meet" i]').forEach((a) => {
        const code = (a.getAttribute('href') || '').match(/meet\.google\.com\/([a-z-]+)/i);
        const key = code ? code[1] : (a.textContent || 'meet');
        a.querySelectorAll('*').forEach((n) => {
          if (n.children.length) return;
          const t = (n.textContent || '').trim();
          if (/^[a-z]{3,4}-[a-z]{3,4}-[a-z]{3,4}$/i.test(t)) apply(n, () => fakeMeetCode(key));
          else if (t && t.length < 60) apply(n, () => mapName(key, MEETINGS));
        });
        count.meetings++;
      });
      // --- avatars + workspace logo ---
      document.querySelectorAll('img').forEach((img) => {
        const src = img.currentSrc || img.src || '';
        const banner = img.closest('[role="banner"], header');
        const isAccountPhoto = banner && /googleusercontent|lh3\.google/.test(src);
        if (banner && !isAccountPhoto) { // workspace/company logo (e.g. "Sahaj") in the top bar → hide
          if (img.dataset.sfHidden !== '1' && img.naturalWidth !== 0) { img.style.visibility = 'hidden'; img.dataset.sfHidden = '1'; count.logos++; }
          return;
        }
        if (isAccountPhoto) { // your account control (top-right) → remove the avatar pill
          // Find the small rounded account pill (width 90–220, rounded). NEVER fall back to a large
          // ancestor — that once swallowed the whole top bar (search included). If no pill is found,
          // hide just the avatar's account link/button, and bail out if that is suspiciously wide.
          let pill = null, p = img;
          for (let i = 0; i < 8 && p; i++) { const rr = p.getBoundingClientRect(); if (rr.width >= 90 && rr.width <= 220 && parseFloat(getComputedStyle(p).borderRadius) >= 14) { pill = p; break; } p = p.parentElement; }
          let box = pill || img.closest('a[aria-label], [role="button"]') || img;
          if (box.getBoundingClientRect().width > 320) box = img; // safety: never hide a wide bar
          if (box.dataset.sfHidden !== '1') { box.style.visibility = 'hidden'; box.dataset.sfHidden = '1'; count.account++; }
          return;
        }
        if (!/googleusercontent|lh3\.google/.test(src) && img.dataset.sfFakeName === undefined) return; // not a real photo, not ours
        if (img.dataset.sfFakeName === undefined) {
          const inSidebar = img.closest('[role="listitem"]');
          let name;
          if (inSidebar && inSidebar.hasAttribute('data-sf-dummy')) name = DEMO_PEER;
          else if (inSidebar) { const dn = inSidebar.querySelector('[data-name]'); const real = dn ? (dn.dataset.sfReal !== undefined ? dn.dataset.sfReal : (dn.getAttribute('data-name') || '')) : (inSidebar.textContent || '').slice(0, 24); name = real === REAL_NAME ? SELF : (real.includes(',') ? mapGroup(real) : mapName(real, PEOPLE)); }
          else name = INJECT_DEMO_DM ? DEMO_PEER : mapName((img.alt || img.getAttribute('aria-label') || 'user').trim(), PEOPLE); // conversation/header avatar
          img.dataset.sfFakeName = name;
        }
        const uri = fakeAvatarFor(img.dataset.sfFakeName);
        if (img.src !== uri) { img.src = uri; img.srcset = ''; img.style.background = 'transparent'; }
        count.avatars++;
      });
      injectDemoDM();
      // --- global find/replace over all visible text: every gathered real person name → its fake,
      //     plus your identifiers, plus bare Meet codes. Longest-first so substrings don't clobber. ---
      const firstName = REAL_NAME.split(/\s+/)[0] || '';
      const safety = [[REAL_EMAIL, SELF_EMAIL], [REAL_NAME, SELF], [firstName, SELF], [COMPANY, SELF],
        ...EXTRA_TERMS.map((t) => [t, (t || '').includes('@') ? SELF_EMAIL : SELF]), ...CUSTOM_REPLACE];
      const pairs = [...personPairs.entries(), ...safety]
        .map(([f, r]) => [(f || '').trim(), r]).filter(([f]) => f.length > 1)
        .sort((a, b) => b[0].length - a[0].length);
      const mustBeGone = [[REAL_EMAIL], [REAL_NAME], [firstName], [COMPANY], ...EXTRA_TERMS.map((t) => [t]), ...CUSTOM_REPLACE]
        .map(([f]) => (f || '').trim()).filter((f) => f.length > 1);
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const leftover = [];
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        let v = n.nodeValue;
        pairs.forEach(([f, r]) => { if (v.includes(f)) { v = v.split(f).join(r); count.swept++; } });
        v = v.replace(/\b[a-z]{3}-[a-z]{4}-[a-z]{3}\b/gi, (m) => (count.swept++, fakeMeetCode(m)));
        if (v !== n.nodeValue) n.nodeValue = v;
        mustBeGone.forEach((t) => { if (n.nodeValue.includes(t)) leftover.push(n.nodeValue.trim().slice(0, 50)); });
      }
      return leftover;
    } catch (e) { console.warn('[anonymize] error', e); return []; }
  }

  const leftover = scrub();
  // Re-scrub on Wiz re-renders (ignore our own writes via `applying`), plus a few delayed passes so
  // late-rendered sidebar rows converge fast without you having to wait. Stop with __sfStopScrub().
  let pending = false, applying = false;
  const runOnce = () => { applying = true; try { scrub(); } finally { requestAnimationFrame(() => { applying = false; }); } };
  const obs = new MutationObserver(() => {
    if (applying || pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; runOnce(); });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  [150, 400, 900, 1800, 3000].forEach((ms) => setTimeout(() => { try { scrub(); } catch (e) { /* noop */ } }, ms));
  // Recovery loop: un-hide any node hidden during a render storm and retry. Rows that have settled
  // (most of them) now show their fake; only genuinely still-fighting rows re-hide. This is why a
  // brief wait before screenshotting lets meeting/live rows resolve to their fake names.
  const resetTimer = setInterval(() => {
    document.querySelectorAll('[data-sf-flicker="1"]').forEach((el) => { el.style.visibility = ''; el.removeAttribute('data-sf-flicker'); flick.delete(el); });
    try { scrub(); } catch (e) { /* noop */ }
  }, 2500);
  window.__sfStopScrub = () => { obs.disconnect(); clearInterval(resetTimer); console.log('[anonymize] stopped'); };

  window.__sfReport = { count, leftover };
  console.log('%c[anonymize] running — wait ~1s, then screenshot. Re-run after switching theme.', 'color:#611F69;font-weight:bold');
  console.table(count);
  if (leftover.length) console.warn('⚠️ STILL CONTAINS A SCRUBBED TERM — do not screenshot until clear:', leftover);
  else console.log('✅ no occurrences of any scrubbed term detected in visible text.');
})();
