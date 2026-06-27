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
    const tb = document.querySelector('[role="main"] [role="textbox"]');
    if (!tb) return;
    let el = tb;
    for (let i = 0; i < 6 && el; i++) {
      const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      if (r >= 16) { el.setAttribute('data-slackify', 'composer'); return; }
      el = el.parentElement;
    }
  }

  // ---- per-topic scan (bubbles + codes + in-topic dates): once per topic, read then write ----
  const processedTopics = new WeakSet();
  function scanTopic(topic) {
    if (processedTopics.has(topic)) return;
    const nodes = topic.querySelectorAll('div, span');
    if (!nodes.length) { topicIO.observe(topic); return; }   // skeleton not filled yet → retry later
    processedTopics.add(topic);
    const bubbles = [], codes = [], dates = [], selfAligns = [];
    let selfWide = false;   // confirms a real self message (a block-level right-aligner, not a sub-bit)
    const topicW = topic.getBoundingClientRect().width;
    for (const el of nodes) {                                 // READ phase
      if (el.hasAttribute('data-slackify')) continue;
      if (el.children.length === 0) {
        const t = (el.textContent || '').trim();
        if (t && t.length <= 40 && isDate(t)) { dates.push(el); continue; }
      }
      const cs = getComputedStyle(el);
      // GChat right-aligns the current user's OWN messages via a COMBINATION of nested flex tricks:
      // column align-items:flex-end, row justify-content:flex-end, and align-self:flex-end. Collect
      // every right-aligner so we can flip them all to the left. Only treat the topic as "self" when
      // a WIDE block-level aligner confirms it (avoids false positives from small end-aligned bits).
      const flex = cs.display.indexOf('flex') !== -1;
      const blockAlign = (flex && cs.flexDirection === 'column' && cs.alignItems === 'flex-end')
                      || (flex && cs.flexDirection !== 'column' && cs.justifyContent === 'flex-end');
      if (blockAlign || cs.alignSelf === 'flex-end') {
        selfAligns.push(el);
        if (blockAlign && topicW && el.getBoundingClientRect().width > topicW * 0.5) selfWide = true;
      }
      // Monospace = code block/inline code — tag for codestyle feature, skip bubble detection.
      if (/mono/i.test(cs.fontFamily || '')) {
        if ((el.textContent || '').trim()) codes.push(el);
        continue;
      }
      const r = parseFloat(cs.borderTopLeftRadius) || 0;
      if (r < 4) continue;
      if (!(el.textContent || '').trim()) continue;
      const bg = rgb(cs.backgroundColor);
      // catch grey (other-person) bubbles AND colored (self) bubbles; skip white/transparent
      if (isGrey(bg) || (r >= 12 && bg && bg.a > 0.4 && !isWhite(bg))) bubbles.push(el);
    }
    // Detect circular avatar wrapper divs (border-radius ≥ 12 on img parent = clipping circle).
    // Tagging the wrapper lets CSS square it without :has() in the stylesheet.
    const avatarWraps = [];
    for (const img of topic.querySelectorAll('img')) {
      const p = img.parentElement;
      if (!p || p.hasAttribute('data-slackify')) continue;
      const r = parseFloat(getComputedStyle(p).borderTopLeftRadius) || 0;
      if (r >= 12) avatarWraps.push(p);
    }
    for (const el of dates) tagDate(el);                      // WRITE phase
    for (const el of bubbles) el.setAttribute('data-slackify', 'bubble');
    for (const el of codes) el.setAttribute('data-slackify', 'code');
    for (const el of avatarWraps) el.setAttribute('data-slackify', 'avatar-wrap');
    // self message: tag every right-aligner (so CSS flips them all left) + the topic (highlight)
    if (selfWide) { for (const el of selfAligns) el.setAttribute('data-slackify', 'self-align'); topic.setAttribute('data-slackify', 'self'); }
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
    const wraps = [];
    for (const img of imgs) {                                   // READ
      if (seenAvatars.has(img)) continue;
      seenAvatars.add(img);
      const p = img.parentElement;
      if (!p || p.hasAttribute('data-slackify')) continue;
      const r = parseFloat(getComputedStyle(p).borderTopLeftRadius) || 0;
      if (r >= 8) wraps.push(p);
    }
    for (const p of wraps) p.setAttribute('data-slackify', 'avatar-wrap');   // WRITE
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

  // ---- the pass: cheap region work when the tree changed, then chunked visible-topic scans ----
  let dirty = true;
  function pass(deadline) {
    if (dirty) {
      dirty = false;
      try { tagRail(); } catch (e) {}
      try { tagStatusChip(); } catch (e) {}
      try { tagComposer(); } catch (e) {}
      const pane = C.firstMatchEl('conversationPane');
      const rail = document.querySelector('[data-slackify="rail"]');
      try { tagActiveRow(pane, rail); } catch (e) {}
      try { scanAvatars(rail); } catch (e) {}
      try { if (pane) tagStream(pane); } catch (e) {}
      if (pane) { try { scanDates(pane); } catch (e) {} try { discoverTopics(pane); } catch (e) {} }
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
