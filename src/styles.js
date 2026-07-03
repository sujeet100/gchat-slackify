// @ts-check
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
  const { THEMES, MODES, themeVarsCSS: themeVars } = globalThis.SLACKIFY_THEMES;
  const SEL = C.SELECTORS, TAG = C.TAGS;

  // Scope a selector under the conversation pane ([role="main"]) using the centralized selector,
  // so even composite "in the message area" rules don't hard-code the role string.
  /** Prefix `s` with each conversation-pane selector. @param {string} s @returns {string[]} */
  const inMain = (s) => SEL.conversationPane.map((p) => `${p} ${s}`);

  /** Render a declarations object as `  prop: value !important;` lines. @param {Record<string,string>} o @returns {string} */
  const decls = (o) => Object.entries(o).map(([k, v]) => `  ${k}: ${v} !important;`).join('\n');

  // mk(feature|null, selectorsArray, extra, declsObj)
  //   extra is appended to each selector (e.g. ":hover", " *:not(img)", " " + TAG.x)
  //   the scope prefix is distributed across every selector in the (fallback) array.
  /**
   * Build one feature-gated CSS rule. The `html[data-sf-on][data-sf-feat-<feature>]` scope prefix is
   * distributed across every selector in the fallback array.
   * @param {string|null} feature feature id to gate on, or null for the always-on base scope
   * @param {string[]} sels selector(s) — a config fallback array
   * @param {string} extra appended to each selector (e.g. ":hover", "::before", " *")
   * @param {Record<string,string>} d declarations (each emitted with !important)
   * @returns {string}
   */
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
    // themeVarsCSS() is the shared renderer — user-defined CUSTOM themes emit the identical block at
    // runtime (apply.js), so the built-in and custom paths can never drift apart.
    for (const t of THEMES) parts.push(themeVars(t));
    // ---- mode variable blocks (content area accents) ----
    for (const [id, m] of Object.entries(MODES)) {
      parts.push(
        `html[data-sf-mode="${id}"]{` +
        `--sf-content-text:${m.contentText};--sf-msg-hover:${m.msgHover};` +
        `--sf-border:${m.border};--sf-date-bg:${m.datePillBg};--sf-date-text:${m.datePillText};` +
        `--sf-date-line:${m.dateLine};--sf-code-bg:${m.codeBg};--sf-code-border:${m.codeBorder};` +
        `--sf-search-drop-bg:${m.searchDropBg};--sf-search-drop-text:${m.searchDropText};` +
        `--sf-mention-pill-bg:${m.mentionPillBg};--sf-mention-pill-text:${m.mentionPillText};` +
        `--sf-code-text:${m.codeText};--sf-toolbar-bg:${m.toolbarBg};}`
      );
    }

    // Slack typeface stack (bundled Lato first; @font-face is injected by apply.js).
    parts.push(':root{--sf-font:"SlackifyLato","Lato",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}');

    // ===== TYPOGRAPHY (Slack font) =====
    // Set font-family on CONTAINERS only (not "*") so text inherits Lato while Material icon
    // fonts on icon elements keep their own family and don't turn into letters.
    parts.push(mk('typography', [TAG.rail], '', { 'font-family': 'var(--sf-font)' }));
    parts.push(mk('typography', SEL.conversationPane, '', { 'font-family': 'var(--sf-font)' }));
    parts.push(mk('typography', SEL.composeBox, '', { 'font-family': 'var(--sf-font)' }));
    parts.push(mk('typography', SEL.messageTopic, '', { 'line-height': '1.46' }));

    // ===== SIDEBAR =====
    // Targets the precisely JS-tagged rail ([data-slackify="rail"]) — NO :has() in CSS, so
    // there's no per-recalc cost and no over-match bleeding into the conversation pane.
    // Color the whole rail once, then make every descendant's background TRANSPARENT so the single
    // rail color shows through uniformly. Google paints opaque element backgrounds (especially in
    // dark mode) that would otherwise occlude it — leaving the theme visible only on hover.
    parts.push(mk('sidebar', [TAG.rail], '', { 'background-color': 'var(--sf-side-bg)' }));
    parts.push(mk('sidebar', [TAG.rail], ' *:not(img):not(image)', { 'background-color': 'transparent', color: 'var(--sf-side-text)', 'border-color': 'transparent' }));
    // Collapsed-sidebar hover flyout: when the rail is collapsed to an icon strip, hovering pops the
    // full nav out as a c-wiz panel that OVERFLOWS the narrow rail-root box (verified live: root 104px,
    // flyout c-wiz 320px). The root's --sf-side-bg only paints its own box, and the transparent rule
    // above blanks the panel's native surface → the message list bled through the flyout. Re-paint the
    // rail's c-wiz panel with the theme color so the flyout is backed. Specificity (c-wiz:not([hidden])
    // = 0,1,1) beats the transparent rule (*:not(img):not(image) = 0,0,2); harmless when docked (same
    // color as the root). Scoped to the rail, so the conversation pane is never touched.
    parts.push(mk('sidebar', [TAG.rail], ' c-wiz:not([hidden])', { 'background-color': 'var(--sf-side-bg)' }));
    parts.push(mk('sidebar', [TAG.rail], ' svg', { fill: 'var(--sf-side-text)' }));
    // Suppress hover — single flat color, no hover change (Slack's sidebar has no hover highlight).
    // Also suppresses Google's own hover rules on these elements.
    // Hover: kill GChat's grey fill on EVERY rail element (it sits on a [role="link"]/inner div the
    // old :is() list missed), then add Slack's subtle theme-tinted hover on the row itself.
    parts.push(mk('sidebar', [TAG.rail], ' *:hover', { 'background-color': 'transparent' }));
    parts.push(mk('sidebar', [TAG.rail], ' [role="listitem"]:hover', { 'background-color': 'var(--sf-side-hover-overlay)' }));
    // "New chat" FAB: the rail makes descendant backgrounds transparent, so on the dark rail the FAB
    // merges into the background. Give it a distinct surface + outline (mode-reactive) so it stands out.
    parts.push(mk('sidebar', SEL.newChat, '', { 'background-color': 'var(--sf-side-hover-overlay)', 'border': '1px solid var(--sf-side-text)' }));

    // ===== TOP BAR =====
    parts.push(mk('topbar', SEL.topBar, '', { 'background-color': 'var(--sf-top-bg)' }));
    parts.push(mk('topbar', SEL.topBar, ' *:not(img):not(image)', { color: 'var(--sf-top-text)' }));
    parts.push(mk('topbar', SEL.topBar, ' svg', { fill: 'var(--sf-top-text)' }));
    // Search: keep it ORIGINAL/native — we do NOT style the search box or its dropdown. We ONLY undo
    // the [role="banner"] white text/icon rules above (otherwise GChat's native dark search text +
    // dropdown rows would be whitened to white-on-white on their light native surface). The dropdown
    // is a descendant of [role="search"], so this restores its native ink too. Mode-aware native ink.
    // Anchor under [role="banner"] so this re-ink out-specifies the `header[role="banner"] *` white
    // rule above (both !important) — otherwise it loses the specificity tie and the typed search text
    // stays white-on-white in light mode (the input lives inside [role="search"] inside the banner).
    const searchInBanner = SEL.search.map((s) => `${SEL.topBar[0]} ${s}`);
    parts.push(mk('topbar', searchInBanner, ' *:not(img)', { color: 'var(--sf-search-drop-text)' }));
    parts.push(mk('topbar', searchInBanner, ' svg', { fill: 'var(--sf-search-drop-text)' }));
    // The search RESULTS dropdown renders in the banner but outside [role="search"], so the banner
    // white-text rule whitens its rows (white-on-white). Restore native ink on it (keeps it native).
    parts.push(mk('topbar', SEL.searchDropdown, '', { color: 'var(--sf-search-drop-text)' }));
    parts.push(mk('topbar', SEL.searchDropdown, ' *:not(img)', { color: 'var(--sf-search-drop-text)' }));
    parts.push(mk('topbar', SEL.searchDropdown, ' svg', { fill: 'var(--sf-search-drop-text)' }));
    // Chat logo: on our dark top bar, GChat's light-mode lockup (dark "Chat" wordmark) is unreadable.
    // Swap it for GChat's OWN dark-theme lockup (a light wordmark) so it stays visible. This points an
    // existing <img> at a sibling STATIC asset on Google's gstatic CDN (the same CDN the light lockup
    // already loads from) — a passive image, not fetch/XHR/beacon/code, and carries no user data.
    parts.push(mk('topbar', SEL.chatLogo, '', { content: 'url("https://ssl.gstatic.com/ui/v1/icons/mail/chatlogo/chat_2026_lockup_dark_2x.png")' }));
    // Status chip (Active/Busy pill): GChat gives it a light background that clashes on our dark top
    // bar. Give it the same translucent "dark-theme" treatment as the search box so it blends in —
    // its text is whitened by the [role="banner"] * rule above, and the colored presence dot (a
    // bg-colored <div>, not an svg) keeps its own color.
    parts.push(mk('topbar', [TAG.statusChip], '', { 'background-color': 'rgba(255,255,255,0.16)' }));

    // ===== ACTIVE CONVERSATION (after sidebar so it wins) =====
    parts.push(mk('activeconv', [TAG.active], '', { 'background-color': 'var(--sf-side-active-bg)', 'border-radius': '6px' }));
    parts.push(mk('activeconv', [TAG.active], ' *:not(img)', { color: 'var(--sf-side-active-text)' }));
    // keep the selected item's theme color on hover (Slack behaviour) — beats the rail *:hover reset
    parts.push(mk('activeconv', [`${TAG.active}:hover`], '', { 'background-color': 'var(--sf-side-active-bg)' }));

    // ===== UNREAD (scoped to the rail so message-area text is never re-weighted) =====
    parts.push(mk('unreadbold', SEL.unreadRow.map((s) => `${TAG.rail} ${s}`), '', { 'font-weight': '700' }));

    // ===== MESSAGES: flatten / density / full-width / hover =====
    // flatten: remove ALL background/padding/margin from tagged bubbles so messages appear flat.
    // The :hover rule prevents Google Chat's own hover CSS from reinstating a background.
    // Some message cards (e.g. broadcast/announcement bubbles) set their grey background with a
    // higher-specificity !important rule that a plain [data-slackify="bubble"] !important loses to.
    // Out-specify it: scope under [role="main"] and double the attribute (a valid specificity hack).
    const bubbleHi = SEL.conversationPane.map((p) => `${p} ${TAG.bubble}${TAG.bubble}`);
    parts.push(mk('flatten', bubbleHi, '', { 'background-color': 'transparent', 'border-radius': '0', 'padding': '0', 'margin-top': '0' }));
    parts.push(mk('flatten', bubbleHi, ':hover', { 'background-color': 'transparent', 'box-shadow': 'none' }));
    // Suppress Google's own per-element hover highlight within messages (creates a weird inner glow).
    // Scoped to [role="main"] so it doesn't affect the sidebar.
    parts.push(mk('flatten', SEL.mainRow, ':hover', { 'background-color': 'transparent', 'box-shadow': 'none' }));
    // padding-bottom gives the gap to the next message. Reactions are the last thing in a topic, so
    // a few px here stops messages-with-reactions from crowding the next one — still compact.
    parts.push(mk('density', SEL.messageTopic, '', { 'padding-top': '1px', 'padding-bottom': '5px', 'gap': '0' }));
    parts.push(mk('fullwidth', [TAG.stream], '', { 'max-width': 'none', 'margin-left': '0', 'margin-right': '0', width: 'auto', 'align-self': 'stretch' }));
    parts.push(mk('fullwidth', SEL.messageTopic, '', { 'padding-left': '16px', 'padding-right': '16px', 'align-self': 'flex-start', 'margin-left': '0', 'margin-right': '0', width: '100%', 'box-sizing': 'border-box' }));
    // Lift GChat's ~640px message-content cap (tagger marks capped containers) so text uses the full
    // width instead of leaving the right side empty.
    parts.push(mk('fullwidth', [TAG.msgWide], '', { 'max-width': 'none' }));
    // Left-align + widen the composer to match the full-width messages (it's centered by default).
    // tagger tags the composer's centering wrapper as [data-slackify="composer-wrap"].
    parts.push(mk('fullwidth', [TAG.composerWrap], '', { 'max-width': 'none', 'width': 'auto', 'flex': '1 1 auto', 'justify-content': 'flex-start' }));
    parts.push(mk('fullwidth', [TAG.composer], '', { 'max-width': 'none', 'width': 'auto', 'flex': '1 1 auto', 'margin-left': '16px', 'margin-right': '16px' }));
    // ===== READABLE LINE WIDTH (opt-in cap on very wide windows) =====
    // Full-width messages go edge-to-edge, which on a 27" display gives ~250-char lines. This caps
    // the topic and the composer at ~1000px, still left-aligned. 968px = 1000 minus the composer's
    // 16px side margins, so the composer's right edge lines up with the capped message text.
    parts.push(mk('readablewidth', SEL.messageTopic, '', { 'max-width': '1000px' }));
    parts.push(mk('readablewidth', [TAG.composer], '', { 'max-width': '968px' }));

    parts.push(mk('rowhover', SEL.messageTopic, ':hover', { 'background-color': 'var(--sf-msg-hover)' }));
    // Kill GChat's grey hover/active fill on the message containers (incl. when the reaction/action
    // toolbar appears) so only our subtle Slack-style row hover shows. Scoped to [role=main].
    parts.push(mk('rowhover', SEL.messageContainer, ':hover', { 'background-color': 'transparent' }));

    // ===== COMPOSER (flatten GChat's rounded pill into a Slack-style bordered box) =====
    // tagger.js tags the opaque card [data-slackify="composer"] (gets the box border) and GChat's
    // rounded input pill(s) [data-slackify="composer-pill"] (radius flattened + bg cleared) so the
    // composer reads as ONE clean bordered box rather than a rounded pill sitting inside a box.
    parts.push(mk('composer', [TAG.composer], '', { 'border-radius': '8px', 'border': '1px solid var(--sf-border)' }));
    parts.push(mk('composer', [TAG.composerPill], '', { 'border-radius': '8px', 'background-color': 'transparent' }));
    // GChat also paints the pill via a full-size ::before wash (Google blue at low opacity, verified
    // live) — clearing the element's own background leaves that pseudo tinting the box. Remove it.
    parts.push(mk('composer', [TAG.composerPill], '::before', { 'display': 'none' }));
    // Neutralize GChat's blue fills inside the box (the blue "+" button and the send button) so the
    // white card shows through — a clean Slack composer. Scope to the BUTTONS only (plus the input
    // pill, handled above) — NOT all descendants — so menus/popups rendered inside the composer keep
    // their own background and don't turn see-through.
    parts.push(mk('composer', [`${TAG.composer} button`, `${TAG.composer} [role="button"]`], '', { 'background-color': 'transparent' }));

    // ===== UNREAD FILTER SWITCH (make the ON state visible) =====
    // GChat's "Unread" toggle turns a very pale blue-grey when ON, which vanishes against the light
    // Home background. Fill the track (the switch's single child div) with the theme accent so "on"
    // is unmistakable. aria-label is localized → degrades gracefully on non-English UIs (same caveat
    // as the in-page meetings toggle).
    // Target ONLY the track (the switch's first child div) so the white thumb is never recolored,
    // and use a lighter tint of the brand so it reads as a soft "on" state, not a heavy dark blob.
    parts.push(mk('unreadswitch', SEL.unreadToggle, '[aria-checked="true"] > div:first-child', { 'background-color': 'color-mix(in srgb, var(--sf-side-active-bg) 78%, white)' }));

    // ===== DATE DIVIDERS (Slack pill on a divider line) =====
    parts.push(mk('datedividers', [TAG.dateWrap], '', { position: 'relative', 'text-align': 'center' }));
    parts.push(mk('datedividers', [TAG.dateWrap], '::before', { content: '""', position: 'absolute', left: '16px', right: '16px', top: '50%', 'border-top': '1px solid var(--sf-date-line)', 'z-index': '0' }));
    parts.push(mk('datedividers', [TAG.date], '', { position: 'relative', 'z-index': '1', display: 'inline-block', 'background-color': 'var(--sf-date-bg)', color: 'var(--sf-date-text)', border: '1px solid var(--sf-date-line)', 'border-radius': '12px', padding: '2px 12px', 'font-size': '12px', 'font-weight': '700' }));

    // ===== MENTION PILLS (Slack-style @mention chips) =====
    // [data-user-mention-type] is Google's own marker on inline @mentions (never avatars/names).
    // Give it a tinted rounded background + readable blue text, both mode-reactive (vars in MODES).
    parts.push(mk('mentionpills', SEL.userMention, '', { 'background-color': 'var(--sf-mention-pill-bg)', color: 'var(--sf-mention-pill-text)', 'border-radius': '4px', padding: '0 3px', 'font-weight': '600' }));
    // GChat's inner mention anchor has its own opaque white chip — neutralize it so only our outer
    // tinted pill shows (otherwise a white box appears behind the pill).
    parts.push(mk('mentionpills', SEL.userMention, ' *', { color: 'var(--sf-mention-pill-text)', 'background-color': 'transparent' }));

    // ===== REACTION PILLS =====
    // The chip itself is tagged by tagger.js (data-emoji sits on the inner <img>, so [data-emoji]
    // alone would round the emoji image, not the pill). Full capsule radius = Slack's reaction chip.
    parts.push(mk('pills', [TAG.reactionPill], '', { 'border-radius': '999px' }));
    // Message hover toolbar — a floating action bar like Slack's. Surface is a MODE var (rule 8):
    // a hard-coded white here left GChat's light dark-mode icons invisible in dark mode.
    parts.push(mk('pills', SEL.messageToolbar, '', { 'background-color': 'var(--sf-toolbar-bg)', 'border-radius': '6px', 'box-shadow': '0 1px 4px rgba(0,0,0,0.12)' }));

    // ===== SQUARE AVATARS (Slack uses ~3px radius instead of 50% circles) =====
    // tagger.js detects the circular wrapper div (border-radius >= 12px on img parent) and stamps
    // data-slackify="avatar-wrap". We must square the WRAPPER (overflow: hidden) not just the img,
    // otherwise the circular clip still applies.
    parts.push(mk('avatarshape', SEL.messageTopic, ' img', { 'border-radius': '3px' }));
    parts.push(mk('avatarshape', [TAG.avatarWrap], '', { 'border-radius': '3px', 'overflow': 'hidden' }));
    // (avatar size bump lives in msgalign, scoped to the message area via inMain)

    // ===== SENDER NAME PROMINENCE (Slack-style bold, slightly larger author name) =====
    // GChat's author name wrapper is span[data-name][data-is-message] (durable Google attrs); the
    // VISIBLE name is a child span that sets its own 12px via a hashed class, so size that child too.
    parts.push(mk('sendername', SEL.senderName, '', { 'font-weight': '700' }));
    parts.push(mk('sendername', SEL.senderName, ' span', { 'font-weight': '700', 'font-size': '15px' }));

    // ===== MESSAGE LAYOUT (top-align avatar with the sender name; enlarge it, Slack-style) =====
    // tagger.js tags the wide flex row (avatar | name+content) as [data-slackify="msgrow"] so we
    // can flip its cross-axis alignment to the top (GChat centers it). The message avatar is also
    // enlarged 32px → 36px (wrapper + img together) to match Slack's heavier message header.
    parts.push(mk('msgalign', [TAG.msgRow], '', { 'align-items': 'flex-start' }));
    // GChat gives the avatar column a top margin so the avatar lines up with the message body (below
    // the name). Zero it so the avatar pins to the very top, aligned with the sender name (Slack).
    parts.push(mk('msgalign', [TAG.msgRow], ' > div', { 'margin-top': '0' }));
    // Tighten the gap between the avatar column and the message content (GChat leaves ~16px; Slack
    // sits closer). Applies to the avatar column (the row's first child).
    parts.push(mk('msgalign', [TAG.msgRow], ' > div:first-child', { 'margin-right': '8px' }));
    parts.push(mk('msgalign', inMain(TAG.avatarWrap), '', { width: '36px', height: '36px', 'min-width': '36px' }));
    parts.push(mk('msgalign', inMain(`${TAG.avatarWrap} img`), '', { width: '36px', height: '36px' }));

    // ===== SLACK-STYLE OWN MESSAGES (left-align your messages + show your avatar) =====
    // GChat right-aligns your own messages via nested flex-end; tagger.js tags the per-message column
    // it right-aligns as [data-slackify="self-row"]. Flip that column to the left and pull the bubble
    // content back to the start, then drop your avatar (read into --sf-self-avatar) into the gutter via
    // an absolutely-positioned ::before — so NO node is injected into Wiz's message stream. The blue
    // bubble itself is removed by the separate 'flatten' feature (the bubble is also tagged 'bubble').
    const selfRow = inMain(TAG.selfRow);
    // Left-align the column AND set justify-start, so it works whether the tagged row is a flex column
    // (right-aligned via align-items) or a flex row (via justify-content). 44px = 36px avatar + 8 gap.
    // No padding-top: group-first keeps GChat's header (name+time) in normal flow (tight spacing); only
    // grouped follow-ups (data-sf-self-notime) reserve a line for their ::after name — see below.
    parts.push(mk('selfslack', selfRow, '', { 'align-items': 'flex-start', 'justify-content': 'flex-start', 'position': 'relative', 'padding-left': '44px', 'box-sizing': 'border-box' }));
    // Undo the nested right-push on descendants so the content sits at the left. The inner flex-end
    // levels are content-width no-ops today, but resetting them future-proofs deeper/altered trees.
    parts.push(mk('selfslack', selfRow, ' *', { 'justify-content': 'flex-start', 'align-self': 'flex-start' }));
    // …but that blanket reset wrecks the reaction chips, which are small CENTERED flexboxes
    // (emoji + count get pushed to the top-left corner and the chip stops stretching). Restore
    // native alignment inside the tagged reactions strip — these selectors carry one more
    // attribute than the `selfRow *` reset above, so they win the specificity race.
    const selfReactions = inMain(`${TAG.selfRow} ${TAG.reactions}`);
    parts.push(mk('selfslack', selfReactions, ' *', { 'align-self': 'auto' }));
    parts.push(mk('selfslack', selfReactions.flatMap((s) => [`${s} button`, `${s} [role="button"]`]), '', { 'justify-content': 'center' }));
    // The avatar tile in the gutter — squared (Slack style, matches 'avatarshape'); a neutral
    // placeholder shows until tagger.js sets --sf-self-avatar from the account button.
    parts.push(mk('selfslack', selfRow, '::before', {
      'content': '""', 'position': 'absolute', 'left': '0', 'top': '0',
      'width': '36px', 'height': '36px', 'border-radius': '3px',
      'background-image': 'var(--sf-self-avatar, none)', 'background-color': 'var(--sf-msg-hover)',
      'background-size': 'cover', 'background-position': 'center', 'background-repeat': 'no-repeat',
    }));
    // The bold sender-name header (Slack shows your full name on your own messages). tagger.js tags
    // the timestamp's header row "self-meta"; we leave it IN FLOW (its natural spot, above the body)
    // and just prefix the name via ::before, so "Name  time" sit on ONE line with GChat's own tight
    // header→body spacing (no extra reserved gap). --sf-self-name is set by tagger; falls back to "You".
    const selfMeta = inMain(TAG.selfMeta);
    parts.push(mk('selfslack', selfMeta, '', { 'align-items': 'baseline' }));
    parts.push(mk('selfslack', selfMeta, '::before', {
      'content': 'var(--sf-self-name, "You")', 'margin-right': '8px',
      'font-weight': '700', 'font-size': '15px', 'line-height': '18px',
      'color': 'var(--sf-content-text)', 'white-space': 'nowrap',
    }));
    // Grouped follow-up own-messages (tagger marks them data-sf-self-notime): no visible header, so
    // hide the repeated avatar and show just the body — the 44px left padding keeps it aligned under
    // the group, exactly like Slack's message grouping.
    const selfNoTime = inMain(`${TAG.selfRow}[data-sf-self-notime]`);
    parts.push(mk('selfslack', selfNoTime, '::before', { 'display': 'none' }));

    // ===== THREAD REPLIES (Slack-style "N replies" link chip) =====
    // tagger.js tags the clickable reply affordance [data-slackify="thread-chip"] and the count
    // span [data-slackify="reply-count"]. GChat shows no participant avatars in this affordance, so
    // we just turn it into a bordered chip and make the reply count a blue link (mode-reactive).
    // Slack's thread affordance has no permanent border — just a hover highlight; match that.
    parts.push(mk('threadreplies', [TAG.threadChip], '', {
      'display': 'inline-flex', 'align-items': 'center', 'gap': '6px',
      'padding': '2px 8px', 'border-radius': '12px', 'margin-top': '4px', 'cursor': 'pointer',
    }));
    parts.push(mk('threadreplies', [TAG.threadChip], ':hover', { 'background-color': 'var(--sf-msg-hover)', 'box-shadow': 'inset 0 0 0 1px var(--sf-border)' }));
    parts.push(mk('threadreplies', [TAG.replyCount], '', { 'color': 'var(--sf-mention-pill-text)', 'font-weight': '600' }));

    // ===== "#" PREFIX ON SPACE NAMES (Slack channel style) =====
    // tagger.js tags the sidebar space-name span [data-slackify="spacename"] and the open-space
    // header title [data-slackify="space-header"]. Prepend a "#" with a Slack-like gap (margin, not
    // just a space char) before the name.
    parts.push(mk('spacehash', [TAG.spaceName, TAG.spaceHeader], '::before', { content: '"#"', 'margin-right': '8px', opacity: '0.7' }));

    // ===== CODE / PRE STYLING (Slack-like inline code + code blocks) =====
    // GChat renders inline code as <code> and code blocks as <pre>; the monospace font lives on
    // THOSE elements (durable semantic tags), not on a div/span — so we target them directly
    // (SEL.codeInline / SEL.codeBlock). No tagger, self-heals on re-render, zero perf cost.
    // Slack convention: inline code = crimson text in a small grey chip; code BLOCK = normal text
    // color in a bordered grey box (NOT crimson). The text can sit in a child span → color
    // descendants too (the element's own color alone doesn't always reach the text).
    parts.push(mk('codestyle', SEL.codeInline, '', {
      'background-color': 'var(--sf-code-bg)',
      'border': '1px solid var(--sf-code-border)',
      'border-radius': '3px',
      'padding': '1px 4px',
      'font-size': '0.875em',
      'color': 'var(--sf-code-text)',   // Slack inline-code crimson (light) / orange (dark)
    }));
    parts.push(mk('codestyle', SEL.codeInline, ' *', { 'color': 'var(--sf-code-text)' }));
    parts.push(mk('codestyle', SEL.codeBlock, '', {
      'background-color': 'var(--sf-code-bg)',
      'border': '1px solid var(--sf-code-border)',
      'border-radius': '4px',
      'padding': '8px 12px',
      'font-size': '0.875em',
      'color': 'var(--sf-content-text)',   // code blocks keep the normal text color, not crimson
    }));
    parts.push(mk('codestyle', SEL.codeBlock, ' *', { 'color': 'var(--sf-content-text)' }));

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
