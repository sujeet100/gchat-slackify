# Security Policy

## Design posture

Slackify for Google Chat is built to be **provably low-risk**:

- **No data exfiltration.** The extension contains no `fetch`, `XMLHttpRequest`, `WebSocket`, or
  beacon code, and requests no host permissions. It has no code path that transmits page or user
  data anywhere — it is structurally incapable of sending your data off the device.
  - **The only outbound requests** are two `GET`s for Google-hosted **images**, referenced from
    CSS and constrained by Google Chat's own page CSP (so the extension cannot point them at an
    arbitrary host): the dark-mode Chat logo on `ssl.gstatic.com`, and — for the "Slack-style own
    messages" feature — your own avatar on `lh3.googleusercontent.com` (the same image Chat already
    loads in the account button). Neither carries any extension-originated data. This is verifiable
    with `chrome://net-export` or any proxy: the *only* extension-initiated requests are those image
    `GET`s, with zero `POST`s and zero third-party domains.
- **No remote code.** All code ships in the package; MV3 forbids remote execution, and we add
  no `eval`/`new Function`.
- **Minimal permissions.** Only `storage` (to save your settings). No `tabs`, `scripting`,
  `cookies`, `webRequest`, or `<all_urls>`.
- **Reads, never transmits.** A content script on Chat can see the page DOM (including
  messages). This one reads attributes/computed styles to apply CSS and writes back a single
  cosmetic attribute. There is no code path that stores or sends message content.
- **Open source.** Every line is auditable.

See [PRIVACY.md](PRIVACY.md) for the user-facing privacy statement.

## Supported versions

The latest published version receives fixes. Older versions are not maintained.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, open a
[GitHub security advisory](https://docs.github.com/en/code-security/security-advisories)
on the repository, or email the maintainer listed on the repo profile.

Include: affected version, a description, reproduction steps, and impact. We aim to
acknowledge within a few days. Responsible disclosure is appreciated — thank you.

## Scope

In scope: anything that could let the extension exfiltrate data, execute remote code, escalate
permissions, or break Google Chat's functionality. Out of scope: cosmetic glitches after a
Google UI change (file a normal issue with `tools/health-check.js` output).
