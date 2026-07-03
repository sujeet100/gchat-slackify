// @ts-check
/*
 * shortcuts.js — opt-in Slack-style keyboard shortcuts (feature id: 'shortcuts', default OFF).
 *
 * This is the ONE deliberate exception to "purely cosmetic": it ADDS shortcuts, never overrides
 * Chat's own. Design constraints (same doctrine as the rest of the extension):
 *   - Gated at KEYSTROKE time on html[data-sf-on][data-sf-feat-shortcuts], so the popup toggle
 *     takes effect instantly and the default-OFF state costs one attribute check per Cmd/Ctrl+K.
 *   - Only ever calls focus()/click() on elements Chat already renders (resolved via the
 *     centralized selectors in config.js) — no DOM mutation, no synthetic navigation.
 *   - Fails safe: if a selector stops matching, the key is NOT consumed (no preventDefault), so
 *     the browser/Chat behavior is untouched.
 *   - Never a combo Chat already binds. Cmd/Ctrl+Shift+K was here briefly and REMOVED: Chat binds
 *     it natively for "New chat" (also `q`), and our capture-phase handler would shadow Google's.
 *     Check Chat's own list (Shift+? / Ctrl+.) before ever adding a combo.
 *
 * Shortcuts (Cmd on macOS, Ctrl elsewhere):
 *   - Cmd/Ctrl+K → focus the search box (Slack's quick switcher muscle memory; Chat's own
 *     search shortcut is `/`, so this is purely additive)
 */
;(function () {
  const C = globalThis.SLACKIFY_CONFIG;
  if (!C) return;

  const enabled = () => {
    const html = document.documentElement;
    return html.hasAttribute('data-sf-on') && html.hasAttribute('data-sf-feat-shortcuts');
  };

  window.addEventListener('keydown', (e) => {
    try {
      if (e.code !== 'KeyK' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (!enabled()) return;
      const input = C.firstMatchEl('searchInput');
      if (!input) return;                       // fail safe: leave the keystroke alone
      e.preventDefault();
      e.stopPropagation();
      /** @type {HTMLElement} */ (input).focus();
      /** @type {HTMLElement} */ (input).click();   // some builds open the suggestion list on click
    } catch (err) {}
  }, true);   // capture phase: run before Chat's handlers so the combo isn't swallowed elsewhere
})();
