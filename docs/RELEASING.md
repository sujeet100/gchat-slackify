# Releasing

Releases are driven entirely from a git tag. Pushing a `v*` tag triggers
[`.github/workflows/release.yml`](../.github/workflows/release.yml), which runs two jobs:

- **`release`** (always): runs the full CI gate (`npm run ci` — syntax, lint, type-check, contract
  validator, tests), verifies the tag matches `manifest.json`'s `version`, builds a clean,
  store-ready zip (only the files the extension ships), and attaches it to a **GitHub Release**.
- **`publish-chrome`** (opt-in + approval-gated): uploads that **same** zip to the **Chrome Web Store
  as a draft** (you click *Publish* yourself). It runs only when you've enabled it (below).

## Cutting a release

```bash
# 1. Bump BOTH versions to the same value (the validator + release workflow enforce this):
#    - manifest.json  "version"
#    - package.json   "version"
# 2. Add a CHANGELOG.md entry for the version.
# 3. Commit, then tag + push:
git commit -am "v0.17.0"
git tag v0.17.0
git push && git push --tags
```

The `release` job builds the artifacts. If publishing is enabled, the `publish-chrome` job then waits
for your **approval** (see below), uploads a CWS draft, and you click **Publish** in the dashboard.
Visibility (public / unlisted / private-to-org) is a one-time setting in that dashboard.

## One-time Chrome Web Store setup

You only do this once.

1. **Developer account** — register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time $5 fee).
2. **Create the item manually, once** — upload the current zip in the dashboard so it gets an
   **Extension ID** (CI can only *update* an existing item, not create it). Fill in the store listing
   (description, screenshots, privacy fields — see `PRIVACY.md` / `SECURITY.md`).
3. **API credentials** — create a Google Cloud project, enable the **Chrome Web Store API**, set up an
   OAuth consent screen, create an **OAuth client (Desktop app)** → Client ID + Secret. Then mint a
   **refresh token** (scope `https://www.googleapis.com/auth/chromewebstore`). Canonical walkthrough:
   `chrome-webstore-upload`'s ["How to generate Google API keys"](https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md).

### Wire it into GitHub (secure, gated)

Because this repo is public, the publish job is locked down so the secrets can't be reached by forks,
PRs, or an un-approved run:

1. **Create an Environment** named **`chrome-web-store`** (Settings → Environments → New).
   - Add a **Required reviewer** (you). Now the `publish-chrome` job pauses for a one-click approval
     before it runs — and the secrets are only injected *after* you approve.
2. **Add the four secrets as ENVIRONMENT secrets** on that Environment (not repo-wide), so they exist
   only for the gated job:

   | Secret | Value |
   | --- | --- |
   | `CWS_EXTENSION_ID` | the item's Extension ID |
   | `CWS_CLIENT_ID` | OAuth client ID |
   | `CWS_CLIENT_SECRET` | OAuth client secret |
   | `CWS_REFRESH_TOKEN` | OAuth refresh token |

3. **Enable the job** — add a repo **variable** (Settings → Secrets and variables → Actions →
   *Variables*): `PUBLISH_TO_CWS` = `true`. Until this is set, the `publish-chrome` job is skipped
   entirely (no approval prompt, no failure) and tags produce only the GitHub Release.

## Why this is safe on a public repo

- **Secrets are never in the repo or logs** — they're encrypted, and GitHub masks them in output.
- **Forks / PRs can't reach them** — the publish job runs only on `push: tags` (collaborators only),
  never on `pull_request`; CI (which *does* run on PRs) uses no secrets.
- **Approval gate** — the `chrome-web-store` Environment's required reviewer means even a pushed tag
  can't auto-run the secret-using job; it waits for you.
- **Pinned uploader** — `chrome-webstore-upload-cli@4.0.1` is pinned to an exact version so a floating
  major can't pull a compromised release into the job that holds the secrets. Bump it deliberately.
- **Blast radius** — the refresh token is scoped to `chromewebstore` only; it can't touch other Google
  data. Still treat it as sensitive (it can publish your extension), and rotate it if exposed.

## Notes

- **Draft, not auto-publish (by design):** the workflow uses the CLI's `upload` subcommand, which
  uploads without submitting. You publish from the dashboard. (Omitting that subcommand would upload
  *and* publish — we intentionally don't.)
- **The upload tool is CI-only:** `chrome-webstore-upload-cli` is run on demand via `npx`; it is
  **not** a dependency of the extension, which ships zero runtime dependencies.
