/*
 * styles.js — compiles the whole stylesheet from config.js + themes.js.
 *
 * Why generate CSS in JS instead of a static .css file?
 *   - Selectors live in ONE place (config.js) with fallback chains; here we just reference them.
 *   - A fallback list like "A, B" must have its scope prefix distributed across BOTH selectors
 *     (`html[..] A, html[..] B`) — easy to get wrong by hand, trivial to generate.
 *   - Theme/mode values become CSS custom properties; switching is just flipping an html attribute,
 *     so we inject this sheet ONCE and never rebuild it on preference changes.
 *
 * Gating: every rule is scoped under html[data-sf-on] and (for features) html[data-sf-feat-<id>].
 * apply.js toggles those attributes from the user's saved preferences.
 */
;(function () {
  const C = globalThis.SLACKIFY_CONFIG;
  const { THEMES, MODES } = globalThis.SLACKIFY_THEMES;
  const SEL = C.SELECTORS, TAG = C.TAGS;

  const decls = (o) => Object.entries(o).map(([k, v]) => `  ${k}: ${v} !important;`).join('\n');

  // mk(feature|null, selectorsArray, extra, declsObj)
  //   extra is appended to each selector (e.g. ":hover", " *:not(img)", " " + TAG.x)
  //   the scope prefix is distributed across every selector in the (fallback) array.
  function mk(feature, sels, extra, d) {
    const prefix = feature ? `html[data-sf-on][data-sf-feat-${feature}]` : 'html[data-sf-on]';
    const full = sels.map((s) => `${prefix} ${s}${extra || ''}`).join(',\n');
    return `${full} {\n${decls(d)}\n}\n`;
  }

  function buildCSS() {
    const parts = [];

    // ---- theme variable blocks (sidebar/top-bar), MODE-REACTIVE ----
    // Each theme emits a block per appearance mode: html[data-sf-theme="x"][data-sf-mode="light|dark"].
    // apply.js sets both attributes, so the sidebar recolors when Chat's light/dark mode changes —
    // replicating how one Slack theme renders very differently in light vs dark (see themes.js).
    for (const t of THEMES) {
      for (const mode of ['light', 'dark']) {
        const m = t.modes[mode];
        parts.push(
          `html[data-sf-theme="${t.id}"][data-sf-mode="${mode}"]{` +
          `--sf-side-bg:${m.bg};--sf-side-active-bg:${m.active};` +
          `--sf-side-active-text:${m.activeText};--sf-side-text:${m.text};` +
          `--sf-top-bg:${m.bg};--sf-top-text:${m.text};` +
          `--sf-presence:${m.presence};--sf-mention:${m.mention};` +
          `--sf-side-hover-overlay:${m.hoverOverlay};}`
        );
      }
    }
    // ---- mode variable blocks (content area accents) ----
    for (const [id, m] of Object.entries(MODES)) {
      parts.push(
        `html[data-sf-mode="${id}"]{` +
        `--sf-content-text:${m.contentText};--sf-msg-hover:${m.msgHover};` +
        `--sf-border:${m.border};--sf-date-bg:${m.datePillBg};--sf-date-text:${m.datePillText};` +
        `--sf-date-line:${m.dateLine};--sf-code-bg:${m.codeBg};--sf-code-border:${m.codeBorder};` +
        `--sf-search-drop-bg:${m.searchDropBg};--sf-search-drop-text:${m.searchDropText};` +
        `--sf-mention-pill-bg:${m.mentionPillBg};--sf-mention-pill-text:${m.mentionPillText};` +
        `--sf-code-text:${m.codeText};--sf-status-chip-text:${m.statusChipText};--sf-self-bg:${m.selfBg};}`
      );
    }

    // Slack typeface stack (bundled Lato first; @font-face is injected by apply.js).
    parts.push(':root{--sf-font:"SlackifyLato","Lato",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}');

    // ===== TYPOGRAPHY (Slack font) =====
    // Set font-family on CONTAINERS only (not "*") so text inherits Lato while Material icon
    // fonts on icon elements keep their own family and don't turn into letters.
    parts.push(mk('typography', [TAG.rail], '', { 'font-family': 'var(--sf-font)' }));
    parts.push(mk('typography', ['[role="main"]'], '', { 'font-family': 'var(--sf-font)' }));
    parts.push(mk('typography', ['[role="textbox"]'], '', { 'font-family': 'var(--sf-font)' }));
    parts.push(mk('typography', SEL.messageTopic, '', { 'line-height': '1.46' }));

    // ===== SIDEBAR =====
    // Targets the precisely JS-tagged rail ([data-slackify="rail"]) — NO :has() in CSS, so
    // there's no per-recalc cost and no over-match bleeding into the conversation pane.
    // Color the whole rail once, then make every descendant's background TRANSPARENT so the single
    // rail color shows through uniformly. Google paints opaque element backgrounds (especially in
    // dark mode) that would otherwise occlude it — leaving the theme visible only on hover.
    parts.push(mk('sidebar', [TAG.rail], '', { 'background-color': 'var(--sf-side-bg)' }));
    parts.push(mk('sidebar', [TAG.rail], ' *:not(img):not(image)', { 'background-color': 'transparent', color: 'var(--sf-side-text)', 'border-color': 'transparent' }));
    parts.push(mk('sidebar', [TAG.rail], ' svg', { fill: 'var(--sf-side-text)' }));
    // Suppress hover — single flat color, no hover change (Slack's sidebar has no hover highlight).
    // Also suppresses Google's own hover rules on these elements.
    // Hover: kill GChat's grey fill on EVERY rail element (it sits on a [role="link"]/inner div the
    // old :is() list missed), then add Slack's subtle theme-tinted hover on the row itself.
    parts.push(mk('sidebar', [TAG.rail], ' *:hover', { 'background-color': 'transparent' }));
    parts.push(mk('sidebar', [TAG.rail], ' [role="listitem"]:hover', { 'background-color': 'var(--sf-side-hover-overlay)' }));

    // ===== TOP BAR =====
    parts.push(mk('topbar', SEL.topBar, '', { 'background-color': 'var(--sf-top-bg)' }));
    parts.push(mk('topbar', SEL.topBar, ' *:not(img):not(image)', { color: 'var(--sf-top-text)' }));
    parts.push(mk('topbar', SEL.topBar, ' svg', { fill: 'var(--sf-top-text)' }));
    parts.push(mk('topbar', SEL.search, '', { 'background-color': 'rgba(127,127,127,0.18)', 'border-radius': '6px' }));
    parts.push(mk('topbar', SEL.search, ' *:not(img)', { color: 'var(--sf-top-text)' }));
    // Search input placeholder — color doesn't inherit automatically in Chrome.
    parts.push(mk('topbar', ['[role="search"] input', '[role="search"] [contenteditable]'], '::placeholder', { color: 'rgba(255,255,255,0.65)', opacity: '1' }));
    // Search dropdown: use mode-aware background/text so light mode = white, dark mode = dark.
    parts.push(mk('topbar', ['[role="search"] [role="listbox"]'], '', { 'background-color': 'var(--sf-search-drop-bg)', color: 'var(--sf-search-drop-text)', 'border-radius': '4px', 'box-shadow': '0 2px 8px rgba(0,0,0,0.2)' }));
    parts.push(mk('topbar', ['[role="search"] [role="option"]', '[role="search"] li', '[role="search"] [role="listbox"]'], ' *:not(img)', { color: 'var(--sf-search-drop-text)' }));
    // Status chip (Active/Busy pill) has its own white/light background — needs dark text.
    parts.push(mk('topbar', [TAG.statusChip], '', { color: 'var(--sf-status-chip-text)' }));
    parts.push(mk('topbar', [TAG.statusChip], ' *:not(img):not(svg)', { color: 'var(--sf-status-chip-text)' }));

    // ===== ACTIVE CONVERSATION (after sidebar so it wins) =====
    parts.push(mk('activeconv', [TAG.active], '', { 'background-color': 'var(--sf-side-active-bg)', 'border-radius': '6px' }));
    parts.push(mk('activeconv', [TAG.active], ' *:not(img)', { color: 'var(--sf-side-active-text)' }));
    // keep the selected item's theme color on hover (Slack behaviour) — beats the rail *:hover reset
    parts.push(mk('activeconv', [`${TAG.active}:hover`], '', { 'background-color': 'var(--sf-side-active-bg)' }));

    // ===== UNREAD (scoped to the rail so message-area text is never re-weighted) =====
    parts.push(mk('unreadbold', [`${TAG.rail} [data-is-unread="true"]`], '', { 'font-weight': '700' }));

    // ===== MESSAGES: flatten / density / full-width / hover =====
    // flatten: remove ALL background/padding/margin from tagged bubbles so messages appear flat.
    // The :hover rule prevents Google Chat's own hover CSS from reinstating a background.
    parts.push(mk('flatten', [TAG.bubble], '', { 'background-color': 'transparent', 'border-radius': '0', 'padding': '0', 'margin-top': '0' }));
    parts.push(mk('flatten', [TAG.bubble], ':hover', { 'background-color': 'transparent', 'box-shadow': 'none' }));
    // Suppress Google's own per-element hover highlight within messages (creates a weird inner glow).
    // Scoped to [role="main"] so it doesn't affect the sidebar.
    parts.push(mk('flatten', ['[role="main"] [role="listitem"]', '[role="main"] [role="row"]'], ':hover', { 'background-color': 'transparent', 'box-shadow': 'none' }));
    // padding-bottom gives the gap to the next message. Reactions are the last thing in a topic, so
    // a few px here stops messages-with-reactions from crowding the next one — still compact.
    parts.push(mk('density', SEL.messageTopic, '', { 'padding-top': '1px', 'padding-bottom': '5px', 'gap': '0' }));
    parts.push(mk('fullwidth', [TAG.stream], '', { 'max-width': 'none', 'margin-left': '0', 'margin-right': '0', width: 'auto', 'align-self': 'stretch' }));
    parts.push(mk('fullwidth', SEL.messageTopic, '', { 'padding-left': '16px', 'padding-right': '16px', 'align-self': 'flex-start', 'margin-left': '0', 'margin-right': '0', width: '100%', 'box-sizing': 'border-box' }));
    parts.push(mk('rowhover', SEL.messageTopic, ':hover', { 'background-color': 'var(--sf-msg-hover)' }));
    // Kill GChat's grey hover/active fill on the message containers (incl. when the reaction/action
    // toolbar appears) so only our subtle Slack-style row hover shows. Scoped to [role=main].
    parts.push(mk('rowhover', ['[role="main"] [data-message-id]', '[role="main"] [data-is-tombstone-message-view]'], ':hover', { 'background-color': 'transparent' }));

    // ===== SELF MESSAGES (left-align your own + subtle highlight, instead of GChat's right-align) =====
    // tagger.js tags the right-aligning container [data-slackify="self-align"] and the topic
    // [data-slackify="self"]. Flip the aligner to flex-start; give the topic a faint highlight band.
    parts.push(mk('selfmessages', ['[data-slackify="self-align"]'], '', { 'align-items': 'flex-start', 'justify-content': 'flex-start', 'align-self': 'flex-start' }));
    parts.push(mk('selfmessages', ['[data-slackify="self"]'], '', { 'background-color': 'var(--sf-self-bg)', 'border-radius': '4px' }));

    // ===== COMPOSER (flatten the rounded pill into a Slack-style bordered box) =====
    // tagger.js tags the rounded composer container [data-slackify="composer"].
    parts.push(mk('composer', ['[data-slackify="composer"]'], '', { 'border-radius': '8px', 'border': '1px solid var(--sf-border)', 'background-color': 'transparent' }));

    // ===== DATE DIVIDERS (Slack pill on a divider line) =====
    parts.push(mk('datedividers', ['[data-slackify="datewrap"]'], '', { position: 'relative', 'text-align': 'center' }));
    parts.push(mk('datedividers', ['[data-slackify="datewrap"]'], '::before', { content: '""', position: 'absolute', left: '16px', right: '16px', top: '50%', 'border-top': '1px solid var(--sf-date-line)', 'z-index': '0' }));
    parts.push(mk('datedividers', [TAG.date], '', { position: 'relative', 'z-index': '1', display: 'inline-block', 'background-color': 'var(--sf-date-bg)', color: 'var(--sf-date-text)', border: '1px solid var(--sf-date-line)', 'border-radius': '12px', padding: '2px 12px', 'font-size': '12px', 'font-weight': '700' }));

    // ===== MENTION PILLS (Slack-style @mention chips) =====
    // [data-user-mention-type] is Google's own marker on inline @mentions (never avatars/names).
    // Give it a tinted rounded background + readable blue text, both mode-reactive (vars in MODES).
    parts.push(mk('mentionpills', SEL.userMention, '', { 'background-color': 'var(--sf-mention-pill-bg)', color: 'var(--sf-mention-pill-text)', 'border-radius': '4px', padding: '0 3px', 'font-weight': '600' }));
    // GChat's inner mention anchor has its own opaque white chip — neutralize it so only our outer
    // tinted pill shows (otherwise a white box appears behind the pill).
    parts.push(mk('mentionpills', SEL.userMention, ' *', { color: 'var(--sf-mention-pill-text)', 'background-color': 'transparent' }));

    // ===== REACTION PILLS =====
    parts.push(mk('pills', SEL.reaction, '', { 'border-radius': '12px' }));
    // Message hover toolbar — set white background so the reaction shortcuts match Slack's style.
    parts.push(mk('pills', ['[role="main"] [role="toolbar"]'], '', { 'background-color': '#ffffff', 'border-radius': '6px', 'box-shadow': '0 1px 4px rgba(0,0,0,0.12)' }));

    // ===== SQUARE AVATARS (Slack uses ~3px radius instead of 50% circles) =====
    // tagger.js detects the circular wrapper div (border-radius >= 12px on img parent) and stamps
    // data-slackify="avatar-wrap". We must square the WRAPPER (overflow: hidden) not just the img,
    // otherwise the circular clip still applies.
    parts.push(mk('avatarshape', SEL.messageTopic, ' img', { 'border-radius': '3px' }));
    parts.push(mk('avatarshape', [TAG.avatarWrap], '', { 'border-radius': '3px', 'overflow': 'hidden' }));

    // ===== CODE BLOCK STYLING (Slack-like monospace formatting) =====
    // tagger.js detects monospace elements and stamps [data-slackify="code"].
    // No performance overhead: detection re-uses getComputedStyle calls already made per-topic.
    parts.push(mk('codestyle', [TAG.codeEl], '', {
      'background-color': 'var(--sf-code-bg)',
      'border': '1px solid var(--sf-code-border)',
      'border-radius': '3px',
      'padding': '1px 4px',
      'font-size': '0.875em',
      'color': 'var(--sf-code-text)',   // Slack-style: crimson in light mode, orange in dark mode
    }));
    // GChat puts the code TEXT in a child of the tagged <code>/<pre>, with its own color — so color
    // descendants too (the wrapper color alone doesn't reach the text).
    parts.push(mk('codestyle', [TAG.codeEl], ' *', { 'color': 'var(--sf-code-text)' }));

    // ===== MEETINGS in the Home feed (opt-in declutter) =====
    // SEL.meetingRow keys off data-group-type="10", which exists ONLY on Home-feed rows — so these
    // rules declutter the Home feed without touching the sidebar "Meetings" section (meetings stay
    // findable there). Pure attribute selector: no :has() in the sheet, no tagger, self-heals on
    // Wiz re-renders. Default-OFF features (config.js), so nothing is hidden without consent.
    parts.push(mk('hidemeetings', SEL.meetingRow, '', { display: 'none' }));
    // Dim = de-emphasize in place. If both toggles are on, hidemeetings (display:none) wins outright.
    parts.push(mk('dimmeetings', SEL.meetingRow, '', { opacity: '0.45', filter: 'grayscale(0.6)' }));
    parts.push(mk('dimmeetings', SEL.meetingRow, ':hover', { opacity: '1', filter: 'none' }));

    return parts.join('\n');
  }

  globalThis.SLACKIFY_STYLES = { buildCSS };
})();
