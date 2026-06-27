# Smoke test & breakage detection

The skin depends on Google Chat's durable hooks. Google can still change things. This is how to catch a break fast and fix it cheaply.

## 1. Selector health check (30 seconds)

1. Open a signed-in `chat.google.com` tab and **open any Space or DM** (so the message-stream selectors have content to match).
2. Open DevTools console, paste [`health-check.js`](health-check.js), Enter.
3. Every **critical** row should read `OK`. Any `BROKEN` row names the exact hook that changed.

Fix: update that one entry in [`../src/selectors.js`](../src/selectors.js) and the matching rule in [`../src/content.css`](../src/content.css). Bump the version, reload.

## 2. Visual diff (recommended, automatable)

Use the Chrome DevTools MCP (or Puppeteer) to screenshot the same views on a schedule and compare to a known-good baseline:

Views to capture:
- Home / conversation list
- An open Space (message stream + compose box)
- An open DM

Procedure with the DevTools MCP:
1. `navigate_page` → `https://chat.google.com/`
2. `take_screenshot` (baseline, store once)
3. On each run, screenshot again and diff against the baseline.
4. A large visual delta in the rail/top-bar/message area = the skin likely broke → run the health check to localize.

> Because the extension is cosmetic and self-contained, a "break" is always a visual one — so screenshot diffing is a complete early-warning system.

## 3. Manual checklist after any Google Chat update

- [ ] Left rail is aubergine with readable light text
- [ ] "New chat" button text is dark/readable
- [ ] Open conversation row is Slack-blue with white text
- [ ] Unread conversations are bold
- [ ] Top bar is aubergine; search is translucent
- [ ] Messages are flat (no grey bubbles) and dense
- [ ] Nothing in Chat is broken functionally (send, search, threads, reactions all work)
