# Chrome Web Store listing kit

Everything you paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
to list **Slackify for Google Chat**. The CI release pipeline ([`RELEASING.md`](RELEASING.md)) can
*update* an item once it exists; the **first** listing is created by hand using the steps below.

> ⚠️ **Trademark note (read first).** The name uses "Slack" (a trademark of Salesforce). To reduce
> the chance of a CWS rejection or a takedown, the description below includes a **non-affiliation
> disclaimer** — keep it. Reviewers sometimes flag names that imply affiliation; if that happens,
> the fallback is to rename to something non-derivative (e.g. "Slack-style theme for Google Chat")
> and keep "Slack-style" only in the description.

---

## 0. Build the package

```bash
npm run package      # → slackify-for-google-chat.zip (manifest + src + popup + icons + fonts)
```

This is the same file set the CI release job ships. Upload this zip in step 2.

## 1. Developer account (one-time)

Register at the [dashboard](https://chrome.google.com/webstore/devconsole) and pay the one-time **$5**
registration fee. Set up the publisher contact email and verify it (required before publishing).

## 2. Create the item & upload

**+ New item → upload `slackify-for-google-chat.zip`.** This mints the **Extension ID** (needed later
for `CWS_EXTENSION_ID` in the CI pipeline). The icon, name, version and default locale come from the
manifest automatically.

## 3. Store listing tab

| Field | Value |
| --- | --- |
| **Name** | `Slackify for Google Chat` |
| **Summary** (≤132 chars) | `Google Chat, styled like Slack — 9 themes + build your own, Lato font, light/dark. 100% cosmetic; nothing leaves your browser.` |
| **Category** | **Communication** (alt: *Workflow & Planning*) |
| **Language** | English (United States) |

**Detailed description** (paste as-is):

```
Slackify for Google Chat restyles the Google Chat web app (chat.google.com) to look and feel
like Slack — without changing any of Chat's behavior.

WHAT YOU GET
• 9 Slack themes — Aubergine, Jade, Lagoon, Clementine, Banana, Barbra, Mood Indigo, Gray,
  and Tritanopia (high contrast)
• Custom themes — build your own: pick a sidebar, accent, and top-bar color with the built-in
  color picker; readable text and hover shades are derived for you. Save as many as you like.
• Light / dark message area that follows your Google Chat appearance setting automatically
• Slack's Lato font, flat messages (no grey bubbles), full-width left-aligned messages,
  compact density, row hover, highlighted open conversation, #-prefixed spaces, Slack-style
  date dividers, mention pills, and code styling
• Per-feature toggles in the popup — turn any piece on or off instantly, no reload

PRIVACY — THIS IS THE WHOLE POINT
• 100% cosmetic: it only injects CSS and tags page elements for styling.
• No network requests of any kind — it is technically incapable of sending data anywhere.
• The only permission is "storage", used solely to remember your settings.
• No analytics, no trackers, no remote code; it never reads or stores your message content.
• Fully open source — verify every line: https://github.com/sujeet100/gchat-slackify

WHAT IT DOESN'T DO
It doesn't touch threading, search, notifications, shortcuts, or huddles — only the visual
layer. A skin can deliver Slack's look, not its workflow; that's intentional and honest.

For people who moved from Slack to Google Chat and miss the feel.

Not affiliated with, endorsed by, or sponsored by Slack Technologies, LLC, Salesforce, or
Google LLC. "Slack" and "Google Chat" are trademarks of their respective owners.
```

### Graphics (all in `store-assets/`)

| Asset | Size | File |
| --- | --- | --- |
| Store icon | 128×128 | `icons/icon-128.png` (auto from manifest) |
| Screenshot 1 | 1280×800 | `store-assets/01-aubergine-light.png` |
| Screenshot 2 | 1280×800 | `store-assets/02-aubergine-dark.png` |
| Screenshot 3 | 1280×800 | `store-assets/03-jade-light.png` |
| Screenshot 4 | 1280×800 | `store-assets/04-jade-dark.png` |
| Screenshot 5 | 1280×800 | `store-assets/05-popup-1280x800.png` |
| Small promo tile | 440×280 | `store-assets/promo-small-440x280.png` |
| Marquee promo tile | 1400×560 | `store-assets/promo-marquee-1400x560.png` |

(At least 1 screenshot is required; the small promo tile is required to be featured. Marquee is optional.)

## 4. Privacy practices tab

| Field | Value |
| --- | --- |
| **Single purpose** | `Slackify for Google Chat has a single purpose: to cosmetically restyle the Google Chat web interface so it looks and feels like Slack. It applies a stylesheet and tags page elements for styling only — it does not alter Chat's functionality or process any data.` |
| **`storage` justification** | `Used only to save the user's own display preferences (selected theme, light/dark mode, enabled features) via chrome.storage.sync, so they persist and sync across the user's signed-in Chrome browsers. No message or personal data is stored.` |
| **Host / content-script access** (`chat.google.com`, `mail.google.com/chat`) | `The content scripts run only on the Google Chat web interface, which is required to apply the cosmetic stylesheet and tag DOM elements there. The extension runs nowhere else and reads page content only to compute styling.` |
| **Are you using remote code?** | **No** |
| **Privacy policy URL** | `https://github.com/sujeet100/gchat-slackify/blob/main/PRIVACY.md` |

**Data usage** — check **NO** data-collection categories (the only stored data is the user's own
settings, synced via their Google account, never sent to the developer). Then tick all three
certifications:

- ✅ I do not sell or transfer user data to third parties, outside the approved use cases.
- ✅ I do not use or transfer user data for purposes unrelated to my item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

## 5. Distribution

- **Visibility:** Public (use *Unlisted* first if you want to smoke-test the live listing).
- **Pricing:** Free. **Regions:** all.

## 6. Submit & review

Click **Submit for review**. First reviews typically take a few hours to a few business days. Common
snags for this extension: the trademark name (see note above) and the privacy-policy URL must be
reachable. After it's approved and you have the Extension ID, wire up the CI pipeline in
[`RELEASING.md`](RELEASING.md) so future versions publish from a `git tag`.
