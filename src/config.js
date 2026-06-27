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
    // interactive elements within the rail (used for hover theming)
    railInteractive:  ['button', '[role="button"]', '[role="listitem"]', '[jsaction]'],
  };

  // Our own tags (set by tagger.js) — always stable because WE own them.
  // NB: CSS targets these tags, never :has() container selectors. :has() over Chat's huge,
  // constantly-mutating DOM is expensive (jank) AND a broad :has() fallback over-matches
  // (painting the conversation pane). The rail is resolved in JS and tagged "rail" instead.
  const TAGS = {
    rail:       '[data-slackify="rail"]',
    bubble:     '[data-slackify="bubble"]',
    lightbtn:   '[data-slackify="lightbtn"]',
    active:     '[role="listitem"][data-slackify="active"]',
    stream:     '[data-slackify="stream"]',
    date:       '[data-slackify="date"]',
    statusChip:  '[data-slackify="status-chip"]',
    codeEl:      '[data-slackify="code"]',
    avatarWrap:  '[data-slackify="avatar-wrap"]',
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
    { id: 'datedividers', label: 'Date dividers',           default: true,  desc: 'Slack-style date separators with a divider line' },
    { id: 'pills',        label: 'Reaction pills',          default: true,  desc: 'Rounded reaction chips' },
    { id: 'avatarshape',  label: 'Square avatars',          default: true,  desc: 'Show profile pictures as rounded squares (Slack style) instead of circles' },
    { id: 'codestyle',    label: 'Code block styling',      default: true,  desc: 'Style inline code and code blocks like Slack (subtle grey background, border)' },
    { id: 'mentionpills', label: 'Mention pills',           default: true,  desc: 'Show @mentions as Slack-style rounded chips with a tinted background' },
    { id: 'selfmessages', label: 'Left-align your messages', default: true, desc: 'Show your own messages left-aligned (like Slack) with a subtle highlight, instead of right-aligned' },
    { id: 'composer',     label: 'Slack-style compose box', default: true,  desc: 'Flatten the message composer into a bordered box instead of a rounded pill' },
    { id: 'hidemeetings', label: 'Hide meetings from Home', default: false, desc: 'Remove meeting/calendar conversations from the Home feed. They stay in the sidebar “Meetings” section.' },
    { id: 'dimmeetings',  label: 'Dim meetings in Home',    default: false, desc: 'Grey out meeting conversations in the Home feed instead of hiding them (ignored when “Hide meetings from Home” is on).' },
  ];

  const DEFAULT_PREFS = {
    enabled: true,
    theme: 'aubergine',     // see themes.js
    mode: 'light',          // 'light' | 'dark'
    features: Object.fromEntries(FEATURES.map((f) => [f.id, f.default])),
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

  globalThis.SLACKIFY_CONFIG = { SELECTORS, TAGS, FEATURES, DEFAULT_PREFS, sel, firstMatchEl, allMatchEls };
})();
