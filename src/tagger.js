// @ts-check
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

  // ---- conversation header title (Lato/weight for ALL conversations; "#" prefix for spaces) ----
  // The header title sits in a button[aria-haspopup="menu"] near the top, right of the rail (it's
  // NOT inside [role="main"], so the pane typography rule never reaches it). The title is the
  // largest-font leaf text in it. Tagged "convo-title" for every conversation; space titles also
  // get data-sf-space (the spacehash hook). Cached by group-id so getComputedStyle runs only on a
  // conversation switch.
  let lastHeaderGid;
  function tagSpaceHeader(pane) {
    const g = (pane && pane.getAttribute('data-group-id')) || '';
    if (g === lastHeaderGid) return;
    lastHeaderGid = g;
    const ex = document.querySelector('[data-slackify="convo-title"]');
    if (ex) { ex.removeAttribute('data-slackify'); ex.removeAttribute('data-sf-space'); }
    if (!g) return;
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
    if (best) {
      best.setAttribute('data-slackify', 'convo-title');
      if (g.startsWith('space/')) best.setAttribute('data-sf-space', '');
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

  // ---- stream dividers: day headings + the unread ("new messages") divider ----
  // Both are [role="heading"] rows (durable, semantic). A DATE divider carries a timestamp span
  // with data-format="3" (Google-owned, locale-independent) — tag it "date" (pill) and the heading
  // "datewrap" (full-width row, so the divider line actually spans the stream — the old text-based
  // scan tagged the pill's 90px parent, leaving the line invisible). The UNREAD divider instead
  // holds a wide wavy-line <svg> — tag the heading "unread-line" and its text chip "unread-label".
  // Runs every dirty pass (WeakSet-cached per heading, no getComputedStyle), so dividers inside
  // lazily-loaded history are caught — the old once-per-conversation cache missed them.
  const seenDividerHeads = new WeakSet();
  function scanDividers(pane) {
    if (!pane) return;
    const dates = [], unreads = [];
    for (const head of C.allMatchEls('dividerHeading', pane)) {   // READ (no style reads)
      if (seenDividerHeads.has(head)) continue;
      seenDividerHeads.add(head);
      const ts = head.querySelector(C.sel('dateHeading'));
      if (ts) { dates.push([head, ts]); continue; }
      const svg = head.querySelector('svg');
      // require a WIDE svg wrapper so an icon in some other heading can't false-positive
      if (svg && svg.parentElement && svg.parentElement.clientWidth > 200) unreads.push(head);
    }
    for (const [head, ts] of dates) {                             // WRITE
      if (!ts.hasAttribute('data-slackify')) ts.setAttribute('data-slackify', 'date');
      if (!head.hasAttribute('data-slackify')) head.setAttribute('data-slackify', 'datewrap');
    }
    for (const head of unreads) {
      if (head.hasAttribute('data-slackify')) continue;
      head.setAttribute('data-slackify', 'unread-line');
      for (const c of head.children) {
        if (!c.querySelector('svg') && (c.textContent || '').trim()) {
          c.setAttribute('data-slackify', 'unread-label');
          break;
        }
      }
    }
  }

  // ---- thread reply affordance: tag the clickable button + the "N replies" count span ----
  // Hook: [data-last-reply-time-msec] (Google-owned, locale-independent, on every thread row).
  // Cached per container (WeakSet); no getComputedStyle. CSS makes it a Slack-style link chip.
  const threadScanned = new WeakSet();
  function scanThreadReplies(pane) {
    if (!pane) return;
    const chips = [], counts = [], curls = [];
    for (const cont of pane.querySelectorAll('[data-last-reply-time-msec]')) {
      if (threadScanned.has(cont)) continue;
      threadScanned.add(cont);
      for (const sp of cont.querySelectorAll('span')) {
        if (sp.children.length) continue;
        // "N replies" AND "N unread" — both get the reply-count tag so they share ONE link blue
        // (untagged, "unread" kept Google's slightly different blue — visibly inconsistent).
        if (/^\s*\d+\s*(repl(y|ies)|unread)\s*$/i.test(sp.textContent || '')) {
          counts.push(sp);
          chips.push(sp.closest('[role="button"]') || cont);
        }
      }
      // The curved "elbow" connector beside the reply row (Slack has no connector). Signature:
      // an EMPTY, small element whose bottom-left corner is rounded and bordered. Fail-safe: if
      // nothing matches this exact shape, nothing is tagged/hidden. One-time cost per container
      // (WeakSet above) and only on thread rows, so the style reads here stay bounded.
      for (const d of cont.querySelectorAll('div, span')) {
        if (d.children.length || (d.textContent || '').trim() || d.hasAttribute('data-slackify')) continue;
        const r = d.getBoundingClientRect();
        if (r.width === 0 || r.width > 48 || r.height > 48) continue;
        const cs = getComputedStyle(d);
        if ((parseFloat(cs.borderBottomLeftRadius) || 0) >= 6 &&
            (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0) > 0) {
          curls.push(d);
        }
      }
    }
    for (const el of chips) if (!el.hasAttribute('data-slackify')) el.setAttribute('data-slackify', 'thread-chip');
    for (const el of counts) if (!el.hasAttribute('data-slackify')) el.setAttribute('data-slackify', 'reply-count');
    for (const el of curls) el.setAttribute('data-slackify', 'thread-curl');
  }

  // ---- reaction pills: tag each reaction count chip + the strip that holds them ----
  // data-emoji sits on the emoji <img>; the visible pill is its [role="button"]/<button> ancestor
  // (verified live) — no durable hook of its own, and CSS can't select an ancestor without :has().
  // The digit test keeps the count-less "Add reaction" button out. Runs on every dirty pass (like
  // scanThreadReplies); no getComputedStyle. Only NULL-pill emojis (inline body emojis) are
  // WeakSet-cached — chips dedupe via their own data-slackify attribute instead, so a Wiz
  // re-render that builds a NEW chip around a REUSED emoji <img> still gets re-tagged.
  const nonPillEmojis = new WeakSet();
  function scanReactionPills(pane) {
    if (!pane) return;
    const pills = [], strips = [];
    for (const em of pane.querySelectorAll('[data-emoji]')) {      // READ (text only)
      if (nonPillEmojis.has(em)) continue;
      const pill = em.closest('button, [role="button"]');
      if (!pill) { nonPillEmojis.add(em); continue; }              // inline body emoji — never a chip
      if (pill.hasAttribute('data-slackify')) continue;
      if (!/\d/.test(pill.textContent || '')) continue;            // "Add reaction" (count may appear later — don't cache)
      pills.push(pill);
      // the strip = the flex row of all chips, two levels up (pill sits in a per-chip wrapper div)
      const strip = pill.parentElement && pill.parentElement.parentElement;
      if (strip && !strip.hasAttribute('data-slackify')) strips.push(strip);
    }
    for (const el of pills) el.setAttribute('data-slackify', 'reaction-pill');   // WRITE
    for (const el of strips) el.setAttribute('data-slackify', 'reactions');
    // Within each newly-tagged strip, tag the "Add reaction" wrapper (a child holding a button but
    // no count digits) so CSS can reshape GChat's grey radius-50% blob and order it after the
    // pills. Hidden duplicate wrappers get tagged too — harmless, they never render.
    for (const s of strips) {
      for (const c of s.children) {
        if (c.hasAttribute('data-slackify')) continue;
        if (/\d/.test(c.textContent || '')) continue;
        if (c.matches('button, [role="button"]') || c.querySelector('button, [role="button"]')) {
          c.setAttribute('data-slackify', 'reaction-add');
        }
      }
    }
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
        // The pill's visible surface can also be a SIBLING overlay of the textbox (an opaque
        // rounded layer spanning the box — verified live), which the ancestor walk above never
        // visits. Sweep the card's subtree ONCE (only when the composer was just [re]tagged) for
        // wide/short/rounded/opaque layers and flatten them too; cheap rect filters run first so
        // getComputedStyle only touches a handful of candidates.
        const compW = el.getBoundingClientRect().width;
        for (const d of el.querySelectorAll('div:not([data-slackify])')) {
          const r = d.getBoundingClientRect();
          if (r.width < compW * 0.6 || r.height > 120 || r.height < 20) continue;
          const dcs = getComputedStyle(d);
          if ((parseFloat(dcs.borderTopLeftRadius) || 0) < 16) continue;
          const dm = dcs.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
          if (dm && (dm[4] === undefined || +dm[4] > 0.5)) d.setAttribute('data-slackify', 'composer-pill');
        }
        return;
      }
      el = el.parentElement;
    }
  }

  // The highest ancestor (up to `topic`) that GChat right-aligns — i.e. carries a flex-end
  // alignment. For YOUR OWN messages this is the per-message column; tagging it lets CSS flip the
  // whole message into the left column. Returns null for a normally-aligned (other-person) element.
  /** @param {Element} start @param {Element} topic scan boundary @returns {Element|null} */
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
  /** Scan one message topic once (cached): tag bubbles, dates, wides, self-rows, avatars. @param {Element} topic */
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
    // For each tagged self-row, tag the timestamp's "metadata unit" (the time + a11y commas, NEVER the
    // body) "self-meta" so selfslack can place the synthetic name on the time's line. Durable hook:
    // [data-absolute-timestamp]. We climb only while the ancestor still contains JUST the time text —
    // so it can't accidentally grab the message row. Pure text reads, no getComputedStyle.
    for (const el of topic.querySelectorAll('[data-slackify="self-row"]')) {
      const t = el.querySelector('[data-absolute-timestamp]');
      // Group-first messages show the time; grouped follow-ups have the timestamp element too but it's
      // HIDDEN (revealed on hover) → no visible header. Detect "actually shown" via layout, and mark
      // grouped rows so selfslack can hide the repeated avatar and show just the indented body (Slack).
      const shown = !!t && t.getBoundingClientRect().width > 0; // display:none (grouped) → 0 width
      if (!shown) { el.setAttribute('data-sf-self-notime', ''); continue; }
      el.removeAttribute('data-sf-self-notime');
      const key = (t.textContent || '').replace(/[\s,]/g, '');
      if (!key) continue;
      let mr = t, hops = 0;
      while (mr.parentElement && mr.parentElement !== el && hops < 5
        && (mr.parentElement.textContent || '').replace(/[\s,]/g, '') === key) { mr = mr.parentElement; hops += 1; }
      if (!mr.hasAttribute('data-slackify')) mr.setAttribute('data-slackify', 'self-meta');
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

  // ---- self identity: read the signed-in user's own avatar URL + name into CSS vars ----
  // The "Slack-style own messages" feature paints them (avatar gutter + bold name header) via
  // pseudo-elements, so we never inject a node into Wiz's message stream. No getComputedStyle — just
  // querySelectors + property writes. Name and avatar latch INDEPENDENTLY (once each var is set it's
  // never rewritten): the two sources can settle on different passes, and in Gmail the avatar may
  // never resolve while the name always does — so a single flag would wrongly block the name too.
  let selfNameSet = false, selfAvatarSet = false;

  // Account slot (/u/N/ in the path) — the avatar differs per signed-in account, so the cache is keyed
  // by it and a multi-account user never gets the wrong face. Standalone Chat, the embedded Chat frame,
  // and Gmail all carry the same /u/N/ for a given account. Defaults to '0'.
  const accountSlot = () => { const m = (window.location.pathname || '').match(/\/u\/(\d+)\//); return m ? m[1] : '0'; };

  // Persist a resolved avatar URL to the extension's LOCAL storage so a context that CANNOT read it can
  // reuse it — specifically the cross-origin chat.google.com iframe Gmail embeds, which the browser
  // walls off from Gmail's account button but which shares this extension storage. Local only; nothing
  // leaves the browser. Fire-and-forget, deduped so we write at most once per distinct URL per frame.
  let cachedAvatarWritten = '';
  function cacheSelfAvatar(url) {
    if (!url || url === cachedAvatarWritten) return;
    cachedAvatarWritten = url;
    try {
      chrome.storage.local.get('sfSelfAvatar', (res) => {
        const map = (res && res.sfSelfAvatar) || {};
        const slot = accountSlot();
        if (map[slot] === url) return;
        map[slot] = url;
        try { chrome.storage.local.set({ sfSelfAvatar: map }); } catch (e) {}
      });
    } catch (e) {}
  }

  // Reuse an avatar cached by a context that COULD read it (standalone chat.google.com, where the
  // account button is present). This is how the walled-off Gmail-embedded Chat frame gets your picture.
  // One-shot storage read; a write that lands LATER (you open standalone Chat afterwards) is picked up
  // by the storage.onChanged listener at the bottom of this file, so no reload is needed.
  let pulledCachedAvatar = false;
  function pullCachedAvatar() {
    if (pulledCachedAvatar) return;
    pulledCachedAvatar = true;
    try {
      chrome.storage.local.get('sfSelfAvatar', (res) => {
        if (selfAvatarSet) return;
        const url = ((res && res.sfSelfAvatar) || {})[accountSlot()];
        if (url) { document.documentElement.style.setProperty('--sf-self-avatar', `url("${url}")`); selfAvatarSet = true; }
      });
    } catch (e) {}
  }

  function ensureSelfAvatar() {
    if (selfNameSet && selfAvatarSet) return;
    const de = document.documentElement.style;
    // 1) Standalone Chat: the account button in the top banner is the authoritative avatar + name.
    // The image is already loaded by Chat (the account button), so referencing it is a cache hit. We
    // also stash the URL (cacheSelfAvatar) so the Gmail-embedded frame — which can't read it — reuses it.
    if (!selfAvatarSet) {
      const img = /** @type {HTMLImageElement | null} */ (C.firstMatchEl('selfAvatar'));
      const src = img && (img.currentSrc || img.src);
      if (src) {
        de.setProperty('--sf-self-avatar', `url("${src}")`);
        selfAvatarSet = true;
        cacheSelfAvatar(src);
        // Name from the account button's aria-label ("Google Account: Jane Doe \n(jane@x.com)"): drop
        // the localized "…:" prefix and the "(email)", collapse whitespace.
        if (!selfNameSet) {
          const labelEl = img.closest('[aria-label]');
          const label = labelEl ? labelEl.getAttribute('aria-label') : '';
          const name = (label || '').replace(/^[^:]*:\s*/, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
          if (name) { de.setProperty('--sf-self-name', JSON.stringify(name)); selfNameSet = true; }
        }
      }
    }
    // 2) Gmail-embedded Chat is a cross-origin chat.google.com iframe: it has no account button, and
    // Gmail's (in the top frame) is browser-blocked. Derive identity from one of YOUR OWN messages —
    // data-name gives the display name directly (always resolves whenever selfslack has work), and the
    // self hovercard-id / user-id find a matching avatar <img> in-frame IF one is rendered (roster /
    // header cluster / hovercard). Any hit is also cached for other frames.
    if (!selfNameSet || !selfAvatarSet) {
      const selfEl = C.firstMatchEl('selfMessageAuthor');
      if (selfEl) {
        if (!selfNameSet) {
          const name = (selfEl.getAttribute('data-name') || '').trim();
          if (name) { de.setProperty('--sf-self-name', JSON.stringify(name)); selfNameSet = true; }
        }
        if (!selfAvatarSet) {
          const email = selfEl.getAttribute('data-hovercard-id');
          const id = (selfEl.getAttribute('data-member-id') || '').split('/').pop();   // "user/human/<id>"
          const cands = [];
          if (email) cands.push(`[data-hovercard-id="${CSS.escape(email)}"] img[src*="googleusercontent"]`);
          if (id) cands.push(`[data-user-id="${CSS.escape(id)}"] img[src*="googleusercontent"]`,
                             `[data-member-id*="${CSS.escape(id)}"] img[src*="googleusercontent"]`);
          for (const s of cands) {
            let im = null; try { im = /** @type {HTMLImageElement|null} */ (document.querySelector(s)); } catch (e) {}
            const src = im && (im.currentSrc || im.src);
            if (src) { de.setProperty('--sf-self-avatar', `url("${src}")`); selfAvatarSet = true; cacheSelfAvatar(src); break; }
          }
        }
      }
    }
    // 3) Still no in-frame source (the common Gmail-embedded case): reuse the avatar cached by
    // standalone chat.google.com via the extension's shared local storage.
    if (!selfAvatarSet) pullCachedAvatar();
  }

  // ---- the pass: cheap region work when the tree changed, then chunked visible-topic scans ----
  let dirty = true;
  /** One throttled idle pass: cheap region work (when dirty) + chunked visible-topic scans. @param {IdleDeadline} [deadline] */
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
      if (pane) { try { scanDividers(pane); } catch (e) {} try { scanDates(pane); } catch (e) {} try { scanThreadReplies(pane); } catch (e) {} try { scanReactionPills(pane); } catch (e) {} try { discoverTopics(pane); } catch (e) {} try { requeueRecentTopics(pane); } catch (e) {} }
    }
    const hasTime = () => !deadline || typeof deadline.timeRemaining !== 'function' || deadline.timeRemaining() > 3;
    for (const t of topicQueue) {
      if (!hasTime()) break;
      topicQueue.delete(t);
      try { scanTopic(t); } catch (e) {}
    }
    if (topicQueue.size) schedule();
  }

  const ric = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 8 }), 250));
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    ric((deadline) => { scheduled = false; pass(deadline); }, { timeout: 1000 });
  }

  schedule();   // initial

  // If the self avatar is cached LATER (e.g. you open standalone chat.google.com after this Gmail tab
  // was already up), paint it live — no reload. Only acts when we haven't already resolved one, and
  // only for our own account slot. Uses chrome.storage, no DOM/layout work.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.sfSelfAvatar || selfAvatarSet) return;
      const url = (changes.sfSelfAvatar.newValue || {})[accountSlot()];
      if (url) { document.documentElement.style.setProperty('--sf-self-avatar', `url("${url}")`); selfAvatarSet = true; }
    });
  } catch (e) {}

  // observer is O(1): flag + schedule. All real work happens in the chunked idle pass.
  const mo = new MutationObserver(() => { dirty = true; schedule(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
