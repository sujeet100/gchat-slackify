// @ts-check
/*
 * config.js — the SINGLE source of truth for selectors, features, and defaults.
 *
 * Durability rule (see docs/EXTENSION-BEST-PRACTICES.md): never target hashed CSS classes
 * (.EAOoq, .pGxpHc — Google recomputes them every build). Target only durable hooks:
 * ARIA role, aria-label, semantic data-*, and :has() relationships. For elements with no
 * durable hook, tagger.js stamps our own [data-slackify="…"] which we then target.
 *
 * Every selector is an array: [primary, ...fallbacks]. The first that matches wins (JS),
 * and CSS uses the whole list (comma-joined) so a fallback keeps the skin alive if Google
 * changes the primary. Add fallbacks here — one place — when something breaks.
 */
;(function () {
  const SELECTORS = {
    // regions
    // NOTE: aria-label TEXT is localized, so the English labels below break on non-English
    // Chat UIs. Each chain therefore ends with a locale-INDEPENDENT fallback built on
    // data-group-id (never translated). See docs/EXTENSION-BEST-PRACTICES.md (i18n).
    sidebarRail:      ['c-wiz:has([aria-label="List of Direct Messages"])',
                       'div:has(> [role="list"][aria-label="List of Direct Messages"])',
                       'c-wiz:has([role="listitem"][data-group-id])'],
    dmList:           ['[role="list"][aria-label="List of Direct Messages"]',
                       '[role="list"]:has([role="listitem"][data-group-id^="dm/"])'],
    spacesList:       ['[role="list"][aria-label="List of spaces."]',
                       '[role="list"]:has([role="listitem"][data-group-id^="space/"])'],
    topBar:           ['header[role="banner"]', '[role="banner"]'],
    search:           ['[role="search"]', 'form[role="search"]'],
    conversationPane: ['[role="main"]'],
    composeBox:       ['[role="textbox"]'],
    // sidebar rows & state
    convRow:          ['[role="listitem"][data-group-id]'],
    // Anchor for the in-page "Hide meetings" control (controls.js): Chat's own Home filter switch.
    // We inject our switch right after this one's cell. aria-label is localized; controls.js iterates
    // matches to pick the VISIBLE one (Chat keeps hidden duplicate headers) and fails safe (no
    // injection) if none is found — so a non-English label simply means the in-page toggle is absent,
    // never a broken host. The popup toggle still works regardless.
    unreadToggle:     ['button[role="switch"][aria-label="Unread"]', 'button[role="switch"][aria-label*="unread" i]'],
    spaceRow:         ['[role="listitem"][data-group-id^="space/"]'],
    dmRow:            ['[role="listitem"][data-group-id^="dm/"]'],
    unreadRow:        ['[data-is-unread="true"]'],
    starredRow:       ['[role="listitem"][data-starred="true"]'],
    // Home-feed meeting rows. The unified Home/activity feed stamps every row with a Google-owned,
    // locale-independent data-group-type (2=app/bot DM, 4=space, 6=DM, 10=meeting conversation —
    // verified live: 16/16 meetings == type 10, zero false positives). The SIDEBAR rows carry no
    // data-group-type at all, so this matches meetings ONLY in the Home feed and never disturbs the
    // sidebar "Meetings" section. Pure attribute selector → safe in CSS (no :has(), no tagger).
    meetingRow:       ['[role="listitem"][data-group-type="10"]'],
    // message stream
    messageTopic:     ['c-wiz[data-topic-id]', '[data-topic-id]'],
    reaction:         ['[data-emoji]'],
    // Inline @mention. data-user-mention-type is Google-owned + locale-independent and sits ONLY
    // on real inline mentions (verified live: 5/5 mentions; never on avatars or author-name spans,
    // which carry data-member-id but NOT this). Types seen: 6 (user), 3 (group/@all) — both chip.
    userMention:      ['[data-user-mention-type]'],
    // Inline code (<code>) and code blocks (<pre>) in the message stream. These are DURABLE
    // SEMANTIC tags: GChat puts the monospace font directly on them (the inner spans are NOT
    // monospace — verified live), so we target the tags themselves — no tagger / hashed-class
    // needed, self-heals on re-render, zero perf cost. Scoped to [role="main"] so only message
    // content is styled.
    codeInline:       ['[role="main"] code'],
    codeBlock:        ['[role="main"] pre'],
    // Thread reply affordance ("N replies · Last reply …"). data-last-reply-time-msec is Google-owned
    // and locale-independent, present on every thread-with-replies row → a durable hook. tagger.js
    // tags the clickable button + the count span so CSS can render a Slack-style link chip.
    threadReply:      ['[role="main"] [data-last-reply-time-msec]'],
    // A message timestamp ("1:39 AM"). data-absolute-timestamp + data-format are Google-owned and
    // locale-independent → durable. tagger.js tags the timestamp's header row on YOUR OWN messages as
    // "self-meta"; the "Slack-style own messages" feature then lifts your synthetic name onto that
    // line (otherwise GChat's time drops to a line of its own under the name).
    messageTimestamp: ['[role="main"] [data-absolute-timestamp]'],
    // top-search input + its autocomplete dropdown. The dropdown renders inside [role="banner"] but
    // OUTSIDE [role="search"] (verified live), so it's scoped to the banner — otherwise our search
    // re-ink rule misses it and the banner white-text rule leaves white-on-white result rows.
    searchInput:        ['[role="search"] input', '[role="search"] [contenteditable]'],
    searchDropdown:     ['[role="banner"] [role="listbox"]'],
    // GChat's "New chat" FAB. data-is-fab is Google-owned + locale-independent → durable. Our rail
    // makes descendant backgrounds transparent, which hides the FAB on the dark rail; we re-surface it.
    newChat:            ['[data-slackify="rail"] [data-is-fab]'],
    // Chat logo lockup <img> in the top bar (durable: src always contains "chatlogo", locale-indep).
    chatLogo:           ['[role="banner"] img[src*="chatlogo"]'],
    // The signed-in user's own avatar (the account button, top-right of the banner). tagger.js reads
    // its src ONCE into the --sf-self-avatar CSS var so the "Slack-style own messages" feature can
    // paint it in the gutter via a ::before (no node injected into Wiz's message stream). The
    // aria-label primary is precise but localized; the googleusercontent src is the locale-indep
    // fallback (the chat logo is gstatic, the workspace logo is google.com/…/logo.gif — neither match).
    selfAvatar:         ['[role="banner"] [aria-label^="Google Account"] img',
                         '[role="banner"] img[src*="googleusercontent.com"]'],
    // message-area containers — used to suppress GChat's own grey hover/active fills
    mainRow:          ['[role="main"] [role="listitem"]', '[role="main"] [role="row"]'],
    messageContainer: ['[role="main"] [data-message-id]', '[role="main"] [data-is-tombstone-message-view]'],
    messageToolbar:   ['[role="main"] [role="toolbar"]'],
    // author-name wrapper: span[data-name][data-is-message] (durable Google attrs). The VISIBLE name
    // is a child span (it sets its own size via a hashed class — styles.js sizes the child too).
    senderName:       ['[role="main"] span[data-name][data-is-message]'],
    // interactive elements within the rail (used for hover theming)
    railInteractive:  ['button', '[role="button"]', '[role="listitem"]', '[jsaction]'],
  };

  // Our own tags (set by tagger.js) — always stable because WE own them.
  // NB: CSS targets these tags, never :has() container selectors. :has() over Chat's huge,
  // constantly-mutating DOM is expensive (jank) AND a broad :has() fallback over-matches
  // (painting the conversation pane). The rail is resolved in JS and tagged "rail" instead.
  const TAGS = {
    rail:        '[data-slackify="rail"]',
    bubble:      '[data-slackify="bubble"]',
    lightbtn:    '[data-slackify="lightbtn"]',
    active:      '[role="listitem"][data-slackify="active"]',
    stream:      '[data-slackify="stream"]',
    date:        '[data-slackify="date"]',
    dateWrap:    '[data-slackify="datewrap"]',
    statusChip:  '[data-slackify="status-chip"]',
    avatarWrap:  '[data-slackify="avatar-wrap"]',
    composer:    '[data-slackify="composer"]',
    composerWrap:'[data-slackify="composer-wrap"]',
    composerPill:'[data-slackify="composer-pill"]',
    msgRow:      '[data-slackify="msgrow"]',
    msgWide:     '[data-slackify-wide]',
    spaceName:   '[data-slackify="spacename"]',
    spaceHeader: '[data-slackify="space-header"]',
    threadChip:  '[data-slackify="thread-chip"]',
    replyCount:  '[data-slackify="reply-count"]',
    // The per-message column GChat right-aligns for YOUR own messages (highest flex-end ancestor of
    // a colored self-bubble). tagger.js tags it so the "Slack-style own messages" feature can flip
    // it to the left column and drop your avatar into the gutter.
    selfRow:     '[data-slackify="self-row"]',
    // The timestamp's header row on YOUR OWN messages — tagger tags it so selfslack can place the
    // synthetic name on the same line as GChat's time (instead of the time dropping to its own row).
    selfMeta:    '[data-slackify="self-meta"]',
  };

  // Independently toggleable features. attr = html[data-sf-feat-<id>].
  const FEATURES = [
    { id: 'typography',   label: 'Slack font (Lato)',       default: true,  desc: 'Use Slack’s Lato typeface and line spacing' },
    { id: 'sidebar',      label: 'Themed sidebar',          default: true,  desc: 'Color the left rail with the Slack theme' },
    { id: 'topbar',       label: 'Themed top bar',          default: true,  desc: 'Match the top bar to the theme' },
    { id: 'flatten',      label: 'Flat messages',           default: true,  desc: 'Remove Google’s grey chat bubbles' },
    { id: 'fullwidth',    label: 'Full-width messages',     default: true,  desc: 'Left-align messages like Slack (remove the centered column)' },
    { id: 'density',      label: 'Compact density',         default: true,  desc: 'Tighter spacing between messages' },
    { id: 'rowhover',     label: 'Row hover highlight',     default: true,  desc: 'Slack-style hover on rows and messages' },
    { id: 'activeconv',   label: 'Highlight open chat',     default: true,  desc: 'Accent the currently open conversation' },
    { id: 'unreadbold',   label: 'Bold unread',             default: true,  desc: 'Embolden unread conversations' },
    { id: 'spacehash',    label: '“#” on space names',       default: true,  desc: 'Prefix space/channel names with a “#” in the sidebar, like Slack channels' },
    { id: 'datedividers', label: 'Date dividers',           default: true,  desc: 'Slack-style date separators with a divider line' },
    { id: 'pills',        label: 'Reaction pills',          default: true,  desc: 'Rounded reaction chips' },
    { id: 'avatarshape',  label: 'Square avatars',          default: true,  desc: 'Show profile pictures as rounded squares (Slack style) instead of circles' },
    { id: 'sendername',   label: 'Prominent sender names',   default: true,  desc: 'Show message sender names bold and slightly larger, like Slack' },
    { id: 'msgalign',     label: 'Slack message layout',     default: true,  desc: 'Top-align the avatar with the sender name and enlarge it, like Slack' },
    { id: 'threadreplies',label: 'Slack-style thread replies',default: true,  desc: 'Show the “N replies” thread affordance as a Slack-style link chip' },
    { id: 'codestyle',    label: 'Code block styling',      default: true,  desc: 'Style inline code and code blocks like Slack (subtle grey background, border)' },
    { id: 'mentionpills', label: 'Mention pills',           default: true,  desc: 'Show @mentions as Slack-style rounded chips with a tinted background' },
    { id: 'composer',     label: 'Slack-style compose box', default: true,  desc: 'Flatten the message composer into a bordered box instead of a rounded pill' },
    { id: 'selfslack',    label: 'Slack-style own messages', default: true, desc: 'Show your own messages left-aligned in the main column with your avatar, like Slack (instead of right-aligned bubbles). Pairs with “Flat messages” to drop the blue bubble.' },
    { id: 'unreadswitch', label: 'Visible “Unread” switch',  default: true,  desc: 'Give the Home “Unread” filter a clear themed color when it is ON (GChat’s default ON state is nearly invisible)' },
    { id: 'hidemeetings', label: 'Hide meetings from Home', default: false, desc: 'Remove meeting/calendar conversations from the Home feed. They stay in the sidebar “Meetings” section.' },
    { id: 'dimmeetings',  label: 'Dim meetings in Home',    default: false, desc: 'Grey out meeting conversations in the Home feed instead of hiding them (ignored when “Hide meetings from Home” is on).' },
  ];

  /** @type {SfPrefs} */
  const DEFAULT_PREFS = {
    enabled: true,
    theme: 'aubergine',     // see themes.js
    mode: 'light',          // 'light' | 'dark'
    features: Object.fromEntries(FEATURES.map((f) => [f.id, f.default])),
    // User-defined color themes (see themes.js buildCustomTheme). Empty by default; the popup
    // appends `{ id, label, sidebar, accent, topbar }` entries and apply.js injects their CSS.
    customThemes: [],
  };

  // Starter colors for a brand-new custom theme — a pale Slack-aubergine-ish light palette so the
  // first paint is already coherent and readable (the user then tweaks the three swatches).
  const CUSTOM_THEME_DEFAULTS = { sidebar: '#F0E9F0', accent: '#611F69', topbar: '#3D1042' };

  // Build a fresh custom-theme definition with a collision-free id. Ids are OURS (never user text),
  // so they're always CSS-selector-safe (`cst-<n>`) — the label is display-only. Kept here so the
  // popup and any future importer create identically-shaped entries.
  /**
   * @param {SfCustomThemeDef[]} [existing] current custom themes (to pick a non-colliding id/label)
   * @returns {SfCustomThemeDef}
   */
  const newCustomTheme = (existing) => {
    existing = existing || [];
    const used = new Set(existing.map((t) => t.id));
    let n = existing.length + 1, id;
    do { id = `cst-${n++}`; } while (used.has(id));
    return { id, label: `Custom ${existing.length + 1}`, ...CUSTOM_THEME_DEFAULTS };
  };

  // ---- helpers ----
  const sel = (key) => (SELECTORS[key] || []).join(', ');
  const firstMatchEl = (key, root = document) => {
    for (const s of SELECTORS[key] || []) { try { const el = root.querySelector(s); if (el) return el; } catch (e) {} }
    return null;
  };
  const allMatchEls = (key, root = document) => {
    for (const s of SELECTORS[key] || []) { try { const els = root.querySelectorAll(s); if (els.length) return Array.from(els); } catch (e) {} }
    return [];
  };

  globalThis.SLACKIFY_CONFIG = { SELECTORS, TAGS, FEATURES, DEFAULT_PREFS, CUSTOM_THEME_DEFAULTS, newCustomTheme, sel, firstMatchEl, allMatchEls };
})();
