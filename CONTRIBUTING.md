# Contributing to Slackify for Google Chat

Thanks for helping! This project has one guiding principle: **stay durable, cosmetic, and
private.** Please read [`CLAUDE.md`](CLAUDE.md) and
[`docs/EXTENSION-BEST-PRACTICES.md`](docs/EXTENSION-BEST-PRACTICES.md) before opening a PR.

## Ground rules

1. **No hashed-class selectors.** Use `role` / `aria-label` / semantic `data-*` / `:has()` /
   our `data-slackify` tags only. If an element has no durable hook, tag it in `src/tagger.js`.
2. **All selectors go in `src/config.js`** as `[primary, ...fallbacks]`, ending with a
   locale-independent fallback.
3. **No new permissions, no network, no remote code.** PRs that add any of these will be
   declined. The extension must remain provably incapable of sending your data anywhere.
4. **Don't break Chat.** Cosmetic only. Wrap DOM work in `try/catch`; keep the
   MutationObserver cheap.
5. **Themes need verified hex** (`docs/SLACK-THEMES.md`). Don't copy unverified numbers from
   blogs; sample live from a Slack client and note the date.

## Dev setup

1. Clone the repo.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.
3. Open [chat.google.com](https://chat.google.com); reload after changes (the puzzle-piece →
   refresh icon on the extension card, then reload the Chat tab).

## Before you submit

- [ ] Ran `tools/health-check.js` on an open conversation — all critical selectors `OK`.
- [ ] Walked the `tools/SMOKE-TEST.md` checklist; nothing in Chat is functionally broken.
- [ ] Tested at least one dark and one light theme.
- [ ] New feature? Added it to `FEATURES` in `config.js`, gated its CSS in `styles.js`, and it
      shows up in the popup.
- [ ] Bumped `version` in `manifest.json` and added a `CHANGELOG.md` entry.
- [ ] No `fetch`/`XHR`/`eval`/new permissions introduced.

## Adding a theme

1. Find verified colors (`docs/SLACK-THEMES.md`), or sample a live Slack client.
2. Add a `t(...)` row in `src/themes.js`.
3. Reload and verify contrast on both a busy conversation and the sidebar.

## Reporting bugs

Use the issue templates. For a broken skin after a Google update, please paste the
`tools/health-check.js` output — it pinpoints the selector that changed.

## Code style

Plain ES2020+ JavaScript, no build step required. Keep modules small and commented in the
existing voice. If you introduce TypeScript, it must compile to committed plain JS (MV3 ships
JS) — see the best-practices doc.
