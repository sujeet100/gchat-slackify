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
 *
 * Shortcuts (Cmd on macOS, Ctrl elsewhere):
 *   - Cmd/Ctrl+K        → focus the search box (Slack's quick switcher muscle memory)
 *   - Cmd/Ctrl+Shift+K  → start a new chat (clicks Chat's own "New chat" button)
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
      if (e.code !== 'KeyK' || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (!enabled()) return;
      if (e.shiftKey) {
        // New chat: Chat's own FAB ([data-is-fab], Google-owned + locale-independent). The tagged
        // rail scope (SEL.newChat) is preferred; fall back to the bare attribute before the rail
        // tagger has run.
        const fab = C.firstMatchEl('newChat') || document.querySelector('[data-is-fab]');
        if (!fab) return;                       // fail safe: leave the keystroke alone
        e.preventDefault();
        e.stopPropagation();
        /** @type {HTMLElement} */ (fab).click();
      } else {
        const input = C.firstMatchEl('searchInput');
        if (!input) return;                     // fail safe
        e.preventDefault();
        e.stopPropagation();
        /** @type {HTMLElement} */ (input).focus();
        /** @type {HTMLElement} */ (input).click();   // some builds open the suggestion list on click
      }
    } catch (err) {}
  }, true);   // capture phase: run before Chat's handlers so the combo isn't swallowed elsewhere
})();
