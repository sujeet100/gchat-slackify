# Privacy Policy — Slackify for Google Chat

_Last updated: 2026-06-27_

**Slackify for Google Chat does not collect, store, transmit, or share any data. Full stop.**

## What the extension accesses

To restyle the page, the extension runs a content script on `https://chat.google.com/*` and `https://mail.google.com/chat/*`. Like any content script, it can technically read the page's DOM (which includes message content rendered on screen). It uses this access **only** to:

- read element attributes and computed styles in order to apply CSS, and
- write a single cosmetic attribute (`data-slackify`) back onto certain elements.

It also uses `chrome.storage.sync` to save **your own settings** (which theme, light/dark, and
which features are on). This stores only your preferences — never any message content — and, if
you're signed into Chrome, syncs those preferences across your devices via your Google account.
Nothing is sent to us or any third party.

## What the extension does NOT do

- ❌ It requests only the `storage` permission — no `tabs`, `cookies`, `webRequest`, `scripting`, or `<all_urls>`.
- ❌ It makes **no network requests** — no `fetch`, `XMLHttpRequest`, `WebSocket`, or beacons. It is technically incapable of sending your data anywhere.
- ❌ It stores **only your settings** — never message content, contacts, or any conversation data.
- ❌ It does **not** include analytics, telemetry, trackers, or third-party code.
- ❌ It does **not** load or execute any remote code.
- ❌ It does **not** read, log, or process your message content for any purpose.

## Data collection

None. There is no server, no account, no database, and no data flow out of your browser.

## Permissions justification (Chrome Web Store)

- **`storage`**: stores your settings (theme, light/dark, feature toggles) so they persist and
  sync across your signed-in Chrome browsers. No personal or message data is stored.
- **Host access to `chat.google.com` / `mail.google.com/chat`** (content-script match): required
  so the cosmetic stylesheet and DOM-tagging script can run on the Google Chat interface. This is
  the minimum scope needed and the extension runs nowhere else.

## Open source

The complete source is published so anyone can verify these claims line by line.

## Contact

Open an issue on the project repository for any privacy question.
