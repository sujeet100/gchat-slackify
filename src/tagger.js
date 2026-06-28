/*
 * tagger.js — stamps stable [data-slackify="…"] attributes on elements that lack a durable
 * native hook, so styles.js can target our attributes (never expensive :has() in the CSS).
 *
 * PERFORMANCE CONTRACT (lightweight skin — must add no noticeable CPU/memory cost). See
 * docs/PERFORMANCE-REVIEW.md and CLAUDE.md:
 *   - The MutationObserver callback is O(1): set one dirty flag + schedule. No per-node work,
 *     no getComputedStyle, no querySelector inline.
 *   - All work runs in requestIdleCallback, throttled to one pass per idle slot, and is chunked
 *     against the idle deadline so it never blocks the main thread (even on conversation switch).
 *   - Message topics are scanned LAZILY: an IntersectionObserver only queues topics that are
 *     visible (± one viewport), so off-screen history Wiz bulk-loads is never scanned until seen.
 *   - getComputedStyle is the only forced recalc; it runs once per topic (WeakSet) and once per
 *     rail, always in a READ phase separated from the WRITE phase (no read/write interleaving).
 *   - Queries are scoped to the smallest known root (rail/pane), never document, where possible.
 *   - Everything is try/caught so the host app can never break.
 */
;(function () {
  const C = globalThis.SLACKIFY_CONFIG;
  if (!C) return;

  const TOPIC_SEL = 'c-wiz[data-topic-id]';
  const rgb = (bg) => {
    const m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const isGrey = (c) => !!c && Math.abs(c.r - c.g) < 6 && Math.abs(c.g - c.b) < 6 && c.r >= 232 && c.r <= 250;
  const isWhite = (c) => !!c && c.r > 250 && c.g > 250 && c.b > 250;
  const isDate = (t) => t === 'Today' || t === 'Yesterday' ||
    /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), /.test(t);

  // ---- rail: the full left column = highest sidebar-width ancestor of the DM list that does NOT
  //      contain the conversation pane. Cached (cheap re-check). ----
  function tagRail() {
    const mainEl = C.firstMatchEl('conversationPane');
    const ex = document.querySelector('[data-slackify="rail"]');
    if (ex && ex.isConnected && !(mainEl && ex.contains(mainEl))) return;
    if (ex) ex.removeAttribute('data-slackify');
    const anchor = C.firstMatchEl('dmList') || C.firstMatchEl('spacesList') || C.firstMatchEl('convRow');
    if (!anchor) return;
    const maxW = (window.innerWidth || 1280) * 0.5;
    let el = anchor, rail = null;
    while (el && el !== document.documentElement) {
      if (mainEl && el.contains(mainEl)) break;
      const w = el.getBoundingClientRect().width;
      if (w > 0 && w < maxW) rail = el;
      el = el.parentElement;
    }
    if (rail) rail.setAttribute('data-slackify', 'rail');
  }

  // ---- active conversation row; cached by group-id; queries scoped to the rail ----
  let lastActiveGroup;
  function tagActiveRow(pane, rail) {
    const g = pane && pane.getAttribute('data-group-id');
    const root = rail || document;
    if (g === lastActiveGroup && root.querySelector('[data-slackify="active"]')) return;
    lastActiveGroup = g;
    for (const el of root.querySelectorAll('[role="listitem"][data-slackify="active"]')) {
      if (el.getAttribute('data-group-id') !== g) el.removeAttribute('data-slackify');
    }
    if (!g) return;
    for (const el of root.querySelectorAll(`[role="listitem"][data-group-id="${CSS.escape(g)}"]`)) {
      el.setAttribute('data-slackify', 'active');
    }
  }

  // ---- open-space header title (for the "#" prefix when a SPACE is open) ----
  // The conversation header title sits in a button[aria-haspopup="menu"] near the top, right of the
  // rail (it's NOT inside [role="main"]). The title is the largest-font leaf text in it. Only spaces
  // get a "#". Cached by group-id so getComputedStyle runs only on a conversation switch.
  let lastHeaderGid;
  function tagSpaceHeader(pane) {
    const g = (pane && pane.getAttribute('data-group-id')) || '';
    if (g === lastHeaderGid) return;
    lastHeaderGid = g;
    const ex = document.querySelector('[data-slackify="space-header"]');
    if (ex) ex.removeAttribute('data-slackify');
    if (!g.startsWith('space/')) return;
    const rail = document.querySelector('[data-slackify="rail"]');
    const railRight = rail ? rail.getBoundingClientRect().right : 320;
    let best = null, bestSize = 18;
    for (const btn of document.querySelectorAll('button[aria-haspopup="menu"]')) {
      const r = btn.getBoundingClientRect();
      if (r.top > 130 || r.left < railRight || r.width === 0) continue;
      for (const el of btn.querySelectorAll('span')) {
        if (el.children.length) continue;
        const t = (el.textContent || '').trim();
        if (!t || t.length > 40) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
        if (fs > bestSize) { bestSize = fs; best = el; }
      }
    }
    if (best) best.setAttribute('data-slackify', 'space-header');
  }

  // ---- centered max-width message column; cached ----
  function tagStream(pane) {
    if (document.querySelector('[data-slackify="stream"]')) return;
    const topic = pane && pane.querySelector(TOPIC_SEL);
    if (!topic) return;
    const mainW = pane.getBoundingClientRect().width;
    let n = topic;
    while (n && n !== pane && n !== document.body) {
      const mw = getComputedStyle(n).maxWidth;
      if (mw && mw.endsWith('px') && parseFloat(mw) > 200 && parseFloat(mw) < mainW) {
        n.setAttribute('data-slackify', 'stream');
        return;
      }
      n = n.parentElement;
    }
  }

  // ---- out-of-topic date dividers (day boundaries between topics); once per conversation ----
  const datedGroups = new Set();
  function tagDate(el) {
    el.setAttribute('data-slackify', 'date');
    const p = el.parentElement;
    if (p && !p.hasAttribute('data-slackify')) p.setAttribute('data-slackify', 'datewrap');
  }
  function scanDates(pane) {
    const g = pane.getAttribute('data-group-id') || '';
    if (datedGroups.has(g)) return;
    datedGroups.add(g);
    const toTag = [];
    for (const el of pane.querySelectorAll('span, div')) {
      if (el.children.length || el.hasAttribute('data-slackify')) continue;
      const t = (el.textContent || '').trim();
      if (t && t.length <= 40 && isDate(t)) toTag.push(el);
    }
    for (const el of toTag) tagDate(el);
  }

  // ---- thread reply affordance: tag the clickable button + the "N replies" count span ----
  // Hook: [data-last-reply-time-msec] (Google-owned, locale-independent, on every thread row).
  // Cached per container (WeakSet); no getComputedStyle. CSS makes it a Slack-style link chip.
  const threadScanned = new WeakSet();
  function scanThreadReplies(pane) {
    if (!pane) return;
    const chips = [], counts = [];
    for (const cont of pane.querySelectorAll('[data-last-reply-time-msec]')) {
      if (threadScanned.has(cont)) continue;
      threadScanned.add(cont);
      for (const sp of cont.querySelectorAll('span')) {
        if (sp.children.length) continue;
        if (/^\s*\d+\s*repl(y|ies)\s*$/i.test(sp.textContent || '')) {
          counts.push(sp);
          chips.push(sp.closest('[role="button"]') || cont);
          break;
        }
      }
    }
    for (const el of chips) if (!el.hasAttribute('data-slackify')) el.setAttribute('data-slackify', 'thread-chip');
    for (const el of counts) if (!el.hasAttribute('data-slackify')) el.setAttribute('data-slackify', 'reply-count');
  }

  // ---- status chip: first button in the topbar with a visible (non-transparent) background ----
  // The "Active/Busy/DND" pill is the only button in [role="banner"] with its own background.
  // Tagged once; our topbar CSS would otherwise make its text white-on-white (unreadable).
  function tagStatusChip() {
    if (document.querySelector('[data-slackify="status-chip"]')) return;
    const topbar = document.querySelector('[role="banner"]');
    if (!topbar) return;
    for (const btn of topbar.querySelectorAll('[role="button"], button')) {
      if (btn.hasAttribute('data-slackify')) continue;
      const cs = getComputedStyle(btn);
      const bg = rgb(cs.backgroundColor);
      if (bg && bg.a > 0.3) { btn.setAttribute('data-slackify', 'status-chip'); return; }
    }
  }

  // ---- compose box: the rounded composer container (border-radius >= 16) wrapping [role=textbox].
  //      Tagged once (cheap re-check); getComputedStyle only runs while it's missing. ----
  function tagComposer() {
    const ex = document.querySelector('[data-slackify="composer"]');
    if (ex && ex.isConnected) return;
    if (ex) ex.removeAttribute('data-slackify');
    for (const p of document.querySelectorAll('[data-slackify="composer-pill"], [data-slackify="composer-wrap"]')) {
      if (!p.isConnected) p.removeAttribute('data-slackify');   // drop stale tags on conversation switch
    }
    const tb = document.querySelector('[role="main"] [role="textbox"]');
    if (!tb) return;
    // The composer's visible background lives on the first OPAQUE, wide-enough ancestor of the
    // textbox (the white box wrapping the input + toolbar) — the inner layers are transparent.
    // Box THAT to get a Slack-style bordered composer. Along the way, tag GChat's rounded input
    // PILL(s) (radius >= 16) so CSS can flatten them — otherwise GChat's rounded pill shows inside
    // our box (the released "pill-in-a-box" look) whenever Chat paints the pill background.
    let el = tb;
    for (let i = 0; i < 10 && el; i++) {
      const cs = getComputedStyle(el);
      const wide = el.getBoundingClientRect().width > 300;
      if (wide && (parseFloat(cs.borderTopLeftRadius) || 0) >= 16) el.setAttribute('data-slackify', 'composer-pill');
      const m = cs.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      const opaque = m && (m[4] === undefined || +m[4] > 0.5);
      if (opaque && wide) {
        el.setAttribute('data-slackify', 'composer');
        // tag the centering wrapper so the full-width feature can left-align + widen the box to
        // match the (full-width) messages instead of leaving it centered.
        if (el.parentElement) el.parentElement.setAttribute('data-slackify', 'composer-wrap');
        return;
      }
      el = el.parentElement;
    }
  }

  // The highest ancestor (up to `topic`) that GChat right-aligns — i.e. carries a flex-end
  // alignment. For YOUR OWN messages this is the per-message column; tagging it lets CSS flip the
  // whole message into the left column. Returns null for a normally-aligned (other-person) element.
  function highestRightAlignedAncestor(start, topic) {
    let found = null;
    for (let n = start, i = 0; n && n !== topic && i < 10; n = n.parentElement, i++) {
      const cs = getComputedStyle(n);
      if (cs.alignSelf === 'flex-end' || cs.alignItems === 'flex-end' || cs.justifyContent === 'flex-end') found = n;
    }
    return found;
  }

  // ---- per-topic scan (bubbles + codes + in-topic dates): once per topic, read then write ----
  const processedTopics = new WeakSet();
  // An element we tagged in each topic. If it later disconnects, Wiz RE-RENDERED the topic (e.g. a
  // just-sent message that was optimistically rendered, then replaced on server-confirm) and dropped
  // our tags — so we re-scan instead of trusting processedTopics. This is what makes a newly-sent
  // message settle into the Slack layout immediately, without needing a conversation switch.
  const topicAnchor = new WeakMap();
  function scanTopic(topic) {
    const anchor = topicAnchor.get(topic);
    if (processedTopics.has(topic) && anchor && anchor.isConnected) return;   // done & not re-rendered
    const nodes = topic.querySelectorAll('div, span');
    if (!nodes.length) { topicIO.observe(topic); return; }   // skeleton not filled yet → retry later
    processedTopics.add(topic);
    const bubbles = [], dates = [], wides = [], selfRows = [];
    for (const el of nodes) {                                 // READ phase
      if (el.hasAttribute('data-slackify')) continue;
      if (el.children.length === 0) {
        const t = (el.textContent || '').trim();
        if (t && t.length <= 40 && isDate(t)) { dates.push(el); continue; }
      }
      const cs = getComputedStyle(el);
      // GChat caps message content at ~640px (max-width: min(90%, 640px)); on a wide window that
      // wastes the right side. Mark capped containers so the full-width feature can lift the cap.
      const mwm = (cs.maxWidth || '').match(/(\d+(?:\.\d+)?)px/);
      if (mwm && cs.maxWidth !== 'none') { const px = +mwm[1]; if (px >= 360 && px <= 900) wides.push(el); }
      // (Code/pre styling targets the <code>/<pre> tags directly in CSS — no tagging needed here.)
      const r = parseFloat(cs.borderTopLeftRadius) || 0;
      if (r < 4) continue;
      if (!(el.textContent || '').trim()) continue;
      const bg = rgb(cs.backgroundColor);
      const grey = isGrey(bg);
      const colored = r >= 12 && bg && bg.a > 0.4 && !isWhite(bg) && !grey;   // a self (non-grey) bubble
      // catch grey (other-person) bubbles AND colored (self) bubbles; skip white/transparent
      if (grey || colored) bubbles.push(el);
      // YOUR OWN message: a colored, right-aligned DIV bubble (grey = the other person; a SPAN with a
      // rounded coloured bg is an icon chip — e.g. a Material symbol — not a message, so require DIV).
      // Tag the per-message column GChat right-aligns so CSS can flip it left + add the self avatar.
      if (colored && el.tagName === 'DIV') {
        const row = highestRightAlignedAncestor(el, topic);
        if (row) selfRows.push(row);
      }
    }
    // Detect circular avatar wrapper divs (border-radius ≥ 12 on img parent = clipping circle).
    // Tagging the wrapper lets CSS square it without :has() in the stylesheet. For each avatar, also
    // walk up to the wide FLEX row (avatar | name+content) and tag it "msgrow" so CSS can top-align
    // it (GChat centers the avatar against multi-line messages; Slack pins it to the top).
    const avatarWraps = [], msgRows = [];
    for (const img of topic.querySelectorAll('img')) {
      const p = img.parentElement;
      if (!p || p.hasAttribute('data-slackify')) continue;
      // Skip tiny avatars (e.g. the ~14px "seen by" read-receipt thumbnail): tagging its round clip
      // would let msgalign/avatarshape blow it up to a 36px square. Only real message avatars qualify.
      if (img.getBoundingClientRect().width < 24) continue;
      const r = parseFloat(getComputedStyle(p).borderTopLeftRadius) || 0;
      if (r >= 12) {
        avatarWraps.push(p);
        let row = p.parentElement;
        for (let i = 0; i < 6 && row && row !== topic; i++) {
          const cs = getComputedStyle(row);
          if (cs.display === 'flex' && row.getBoundingClientRect().width > 200) { msgRows.push(row); break; }
          row = row.parentElement;
        }
      }
    }
    for (const el of dates) tagDate(el);                      // WRITE phase
    for (const el of bubbles) el.setAttribute('data-slackify', 'bubble');
    // Keep only the OUTERMOST self-row per message: a colored sub-element (e.g. a reaction pill) can
    // resolve to a different, NESTED flex-end ancestor, which would otherwise draw a 2nd gutter avatar.
    for (const el of selfRows) {
      if (el.hasAttribute('data-slackify')) continue;
      if (selfRows.some((o) => o !== el && o.contains(el))) continue;
      el.setAttribute('data-slackify', 'self-row');
    }
    for (const el of wides) el.setAttribute('data-slackify-wide', '');   // separate attr (orthogonal to bubble)
    for (const el of avatarWraps) el.setAttribute('data-slackify', 'avatar-wrap');
    for (const el of msgRows) if (!el.hasAttribute('data-slackify')) el.setAttribute('data-slackify', 'msgrow');
    // Remember a stable element so a future pass can detect a Wiz re-render (see topicAnchor above).
    topicAnchor.set(topic, selfRows[0] || bubbles[0] || topic.firstElementChild);
  }

  // ---- avatar wrappers OUTSIDE the message stream (rail + Home feed) ----
  // The circular clip is a wrapper div (border-radius:50% + overflow:hidden) around the <img>, so
  // CSS can't square it without a hook. We tag the wrapper once per img (WeakSet-cached) — a pass
  // with no new avatars does zero getComputedStyle. READ all radii first, then WRITE all tags.
  const seenAvatars = new WeakSet();
  function scanAvatars(rail) {
    const imgs = [];
    if (rail) for (const img of rail.querySelectorAll('img')) imgs.push(img);
    for (const row of document.querySelectorAll('[role="listitem"][data-group-type]')) {  // Home feed
      for (const img of row.querySelectorAll('img')) imgs.push(img);
    }
    // conversation header avatar (incl. group clusters) — it lives in the header's menu button.
    for (const img of document.querySelectorAll('button[aria-haspopup="menu"] img')) imgs.push(img);
    const wraps = [];
    for (const img of imgs) {                                   // READ
      if (seenAvatars.has(img)) continue;
      seenAvatars.add(img);
      // Walk up and tag EVERY round clip: the single-avatar wrapper AND the outer circle of a
      // member cluster (which sits several levels above the <img>, so checking only the direct
      // parent — as before — missed it). overflow:hidden distinguishes a real avatar clip.
      let e = img.parentElement;
      for (let i = 0; i < 6 && e && e !== rail; i++) {
        if (!e.hasAttribute('data-slackify')) {
          const cs = getComputedStyle(e);
          if ((parseFloat(cs.borderTopLeftRadius) || 0) >= 8 && cs.overflow === 'hidden') wraps.push(e);
        }
        e = e.parentElement;
      }
    }
    for (const p of wraps) p.setAttribute('data-slackify', 'avatar-wrap');   // WRITE
  }

  // ---- space-name spans (for the opt-in "#" prefix) ----
  // The sidebar space name has only a hashed class; the durable signal is structural — it's the
  // first non-empty span[role="presentation"] in the space row. Cached per row (WeakSet), no
  // getComputedStyle. Tagged regardless of the feature toggle (cheap); CSS is feature-gated.
  const spaceNamed = new WeakSet();
  function scanSpaceNames(rail) {
    // Scope to the Spaces LIST only, so the "#" lands on real channels — not group-DMs (also
    // data-group-id^="space/" but in the DM list) or meeting rows (in the Meetings list).
    const list = C.firstMatchEl('spacesList') || rail;
    if (!list) return;
    const toTag = [];
    for (const row of list.querySelectorAll('[role="listitem"][data-group-id^="space/"]')) {
      if (spaceNamed.has(row)) continue;
      spaceNamed.add(row);
      for (const sp of row.querySelectorAll('span[role="presentation"]')) {
        if ((sp.textContent || '').trim()) { toTag.push(sp); break; }   // first with text = the name
      }
    }
    for (const el of toTag) el.setAttribute('data-slackify', 'spacename');
  }

  // ---- lazy topic discovery: observe topics, queue only the visible ones (± one viewport) ----
  const seenTopics = new WeakSet();
  const topicQueue = new Set();
  const topicIO = new IntersectionObserver((entries) => {
    let any = false;
    for (const e of entries) {
      if (e.isIntersecting) { topicQueue.add(e.target); topicIO.unobserve(e.target); any = true; }
    }
    if (any) schedule();
  }, { rootMargin: '600px 0px 600px 0px' });

  function discoverTopics(pane) {
    for (const t of pane.querySelectorAll(TOPIC_SEL)) {
      if (seenTopics.has(t)) continue;
      seenTopics.add(t);
      topicIO.observe(t);
    }
  }

  // Re-queue the most recent topics whenever the tree changed, so a re-rendered or just-sent message
  // (whose tags Wiz dropped on its server-confirm re-render) gets re-scanned. scanTopic early-returns
  // in O(1) when a topic is unchanged (anchor still connected), so this is cheap on quiet mutations.
  function requeueRecentTopics(pane) {
    const ts = pane.querySelectorAll(TOPIC_SEL);
    for (let i = Math.max(0, ts.length - 4); i < ts.length; i++) topicQueue.add(ts[i]);
  }

  // ---- self identity: read the signed-in user's own avatar URL + name ONCE into CSS vars ----
  // The "Slack-style own messages" feature paints them (avatar gutter + bold name header) via
  // pseudo-elements, so we never inject a node into Wiz's message stream. Cached (runs until found,
  // then never again); no getComputedStyle — just a querySelector + property writes. The image is
  // already loaded by Chat (the account button), so referencing it is a cache hit, not a fresh fetch.
  let selfAvatarSet = false;
  function ensureSelfAvatar() {
    if (selfAvatarSet) return;
    const img = C.firstMatchEl('selfAvatar');
    const src = img && (img.currentSrc || img.src);
    if (!src) return;
    document.documentElement.style.setProperty('--sf-self-avatar', `url("${src}")`);
    // Name from the account button's aria-label ("Google Account: Jane Doe \n(jane@x.com)"): drop the
    // localized "…:" prefix and the "(email)", collapse whitespace. JSON.stringify quotes it for CSS
    // content. If we can't derive a name, the CSS var stays unset and content falls back to "You".
    const label = (img.closest('[aria-label]') || {}).getAttribute ? img.closest('[aria-label]').getAttribute('aria-label') : '';
    const name = (label || '').replace(/^[^:]*:\s*/, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (name) document.documentElement.style.setProperty('--sf-self-name', JSON.stringify(name));
    selfAvatarSet = true;
  }

  // ---- the pass: cheap region work when the tree changed, then chunked visible-topic scans ----
  let dirty = true;
  function pass(deadline) {
    if (dirty) {
      dirty = false;
      try { tagRail(); } catch (e) {}
      try { ensureSelfAvatar(); } catch (e) {}
      try { tagStatusChip(); } catch (e) {}
      try { tagComposer(); } catch (e) {}
      const pane = C.firstMatchEl('conversationPane');
      const rail = document.querySelector('[data-slackify="rail"]');
      try { tagActiveRow(pane, rail); } catch (e) {}
      try { tagSpaceHeader(pane); } catch (e) {}
      try { scanAvatars(rail); } catch (e) {}
      try { scanSpaceNames(rail); } catch (e) {}
      try { if (pane) tagStream(pane); } catch (e) {}
      if (pane) { try { scanDates(pane); } catch (e) {} try { scanThreadReplies(pane); } catch (e) {} try { discoverTopics(pane); } catch (e) {} try { requeueRecentTopics(pane); } catch (e) {} }
    }
    const hasTime = () => !deadline || typeof deadline.timeRemaining !== 'function' || deadline.timeRemaining() > 3;
    for (const t of topicQueue) {
      if (!hasTime()) break;
      topicQueue.delete(t);
      try { scanTopic(t); } catch (e) {}
    }
    if (topicQueue.size) schedule();
  }

  const ric = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 250));
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    ric((deadline) => { scheduled = false; pass(deadline); }, { timeout: 1000 });
  }

  schedule();   // initial

  // observer is O(1): flag + schedule. All real work happens in the chunked idle pass.
  const mo = new MutationObserver(() => { dirty = true; schedule(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
