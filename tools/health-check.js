// @ts-check
/*
 * health-check.js — breakage radar.
 *
 * Run this on an open, signed-in chat.google.com tab to verify every durable selector
 * still resolves. If Google ships a UI change that breaks the skin, this tells you
 * exactly which hook died — so the fix is targeted, not a hunt.
 *
 * Two ways to run it:
 *   1. DevTools console: paste this whole file, press Enter.
 *   2. Chrome DevTools MCP: evaluate_script with this function body.
 *
 * Expected: every CRITICAL selector resolves to >= 1 element while a conversation is open.
 * (Open a Space/DM first so the message-stream selectors have something to match.)
 */
(() => {
  // Keep in sync with src/selectors.js
  const CRITICAL = {
    topBar: 'header[role="banner"]',
    search: '[role="search"]',
    sidebarRail: 'c-wiz:has([aria-label="List of Direct Messages"])',
    dmList: '[role="list"][aria-label="List of Direct Messages"]',
    spacesList: '[role="list"][aria-label="List of spaces."]',
    convRow: '[role="listitem"][data-group-id]',
    conversationPane: '[role="main"]',
    messageTopic: 'c-wiz[data-topic-id]',
    composeBox: '[role="textbox"]',
  };
  // These only exist when relevant content is present; absence is informational, not failure.
  const OPTIONAL = {
    unreadRow: '[data-is-unread="true"]',
    starredRow: '[role="listitem"][data-starred="true"]',
    reaction: '[data-emoji]',
    meetingRow: '[role="listitem"][data-group-type="10"]', // Home feed only; absent on other views
    unreadToggle: 'button[role="switch"][aria-label*="unread" i]', // anchor for the in-page meetings toggle (Home only)
    userMention: '[data-user-mention-type]', // inline @mentions; present only in conversations with mentions
    codeInline: '[role="main"] code', // inline code <code>; present only in conversations with code
    codeBlock: '[role="main"] pre', // code blocks <pre>; present only in conversations with code blocks
    threadReply: '[role="main"] [data-last-reply-time-msec]', // thread reply rows; present only in spaces with threads
    selfAvatar: '[role="banner"] img[src*="googleusercontent.com"]', // the signed-in user's own avatar (account button) — source for the Slack-style self-message avatar/name
    messageTimestamp: '[role="main"] [data-absolute-timestamp]', // per-message time; tagged "self-meta" on own messages to host the synthetic name on the time's line
    bannerMenu: '[role="banner"] [role="menu"]', // Help/Support popup; only exists while the menu is OPEN — re-inked so it isn't white-on-white
    dateHeading: '[role="main"] [data-absolute-timestamp][data-format="3"]', // day-divider pill inside its [role="heading"] row; present only in conversations spanning days
    dividerHeading: '[role="main"] [role="heading"][aria-level="2"]', // day/unread divider rows (datewrap / unread-line hosts)
  };

  const count = (sel) => { try { return document.querySelectorAll(sel).length; } catch (e) { return 'INVALID:' + e.message; } };

  const results = [];
  let failures = 0;
  for (const [name, sel] of Object.entries(CRITICAL)) {
    const n = count(sel);
    const ok = typeof n === 'number' && n > 0;
    if (!ok) failures++;
    results.push({ tier: 'critical', name, selector: sel, matches: n, status: ok ? 'OK' : 'BROKEN' });
  }
  for (const [name, sel] of Object.entries(OPTIONAL)) {
    const n = count(sel);
    results.push({ tier: 'optional', name, selector: sel, matches: n, status: (typeof n === 'number' && n > 0) ? 'OK' : 'absent' });
  }

  console.table(results);
  const verdict = failures === 0 ? '✅ all critical selectors resolve' : `❌ ${failures} critical selector(s) BROKEN — fix src/selectors.js + src/content.css`;
  console.log(verdict);
  return { failures, verdict, results };
})();
