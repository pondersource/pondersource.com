# pondersource.com
The https://pondersource.com/ website

Current storage implementation, tests, source revisions and remaining blockers: [worker handoff](docs/storage-worker-handoff-2026-11-25.md).

## Local development

This is a static site, with dependencies checked in. No build or application
secrets are needed. Serve the repository root (rather than opening the HTML as a
file) so browser storage and JavaScript modules work:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

## App launcher

The **App store** contains apps with links to the Ponder Source forks and
upstream source. Each app uses its Ponder Source deployment at
`https://APP_NAME.pondersource.com`. Todonna uses GitLab Pages; the other apps
use GitHub Pages. Todonna source is now mirrored in
[our GitHub fork](https://github.com/pondersource/todonna), retaining its GitLab
upstream and existing hosting. Installing adds a shortcut to **My apps**; launching opens the
app's website. Removing a shortcut
also removes it from Recently used, without deleting any data in the app itself.
The catalog and its source links live in `index.html`.

## Public app pages and search discovery

`/apps/` is a public directory, with a static page at `/apps/APP_ID/` for each
catalog app. These pages include direct app links and work without JavaScript
or an account. The homepage links to the directory even when the store tab is
closed. The launcher itself continues to manage installations and storage.

After editing the catalog or the editorial text in `scripts/build-app-pages.py`,
regenerate the committed pages and sitemap:

```sh
python3 scripts/build-app-pages.py
python3 scripts/build-app-pages.py --check
```

CI checks for stale output before deployment. `robots.txt` advertises
`https://pondersource.com/sitemap.xml`; submit that URL in Search Console too.
The homepage canonical points to `/`, including when served at `/index.html`.
GitHub Pages has no server-side redirect configuration, so this uses a canonical
instead of a JavaScript redirect that could interfere with storage login callbacks.
App pages have their own canonical URLs. The sitemap covers this website; the
hosted apps on subdomains are separate sites. Use a Search Console Domain
property to measure the whole domain including those subdomains.

## Launcher storage

Without a connected account, installed apps and launch history are stored in the
browser's Origin Private File System (OPFS), with localStorage as a fallback when
OPFS is unavailable. This storage belongs to this site's origin and browser
profile. Clearing site data removes it; it is not an offline copy of the apps.
Secure contexts (HTTPS, or localhost during development) are needed for OPFS.
Storage errors are shown instead of claiming an installation was saved.

Connecting an account loads that account's library. **Copy this device's apps to
this account** explicitly adds local installations without removing account apps.
Signing out restores the device's separate library. Installations made while
connected stay with that account; they aren't copied into the device library.

The remote library uses the vendored remoteStorage.js library, the `launcher:rw`
scope, and `/launcher/installed-apps`. The versioned document records each app's
installation status, modification time, and last launch. Removal records are
retained so merging another device's older state cannot reinstall a removed app.
Changes to different apps are merged; changes to the same app use the most recent
timestamp (removal wins ties), so device clocks should be reasonably accurate.
The library caches connected data and queues writes for synchronization. The UI
does not claim a queued write has already reached the provider.

The previous `/launcher/recent-apps` document is left intact. The new Recently used
view tracks launches of installed apps in the versioned library. Storage-first
`#remotestorage=user%40provider` addresses are still accepted and carried to
launched apps. Google Drive and Dropbox addresses are not passed as remoteStorage
discovery addresses.

### Google Drive and Dropbox

Both backends are included in remoteStorage.js and use the same library document.
To enable their connection buttons, register OAuth applications with the provider
and populate the **public** client identifiers in
`assets/js/launcher-config.mjs`:

```js
export const storageApiKeys = {
  googledrive: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  dropbox: 'YOUR_DROPBOX_APP_KEY'
};
```

These are public application identifiers, not user tokens or client secrets.
Register the exact redirect URI emitted by remoteStorage.js: at the site's root
this is the origin without a trailing slash, e.g. `https://pondersource.com`
(locally, `http://127.0.0.1:8000`). Provider settings must permit that origin and
the permissions requested by the bundled backend. Each user then authorizes
their own account through the provider. Unconfigured buttons stay hidden.

The published build supports remoteStorage, Google Drive, Dropbox, and Solid pods.
CI builds the Solid bundle from the pinned PR commit and publishes it after the
launcher browser tests pass. The checked-in bundle remains usable for local
remoteStorage development. Download the CI artifact to test the Solid build locally.

## Tests

Storage and merge tests have no dependencies beyond Node.js:

```sh
node --test tests/launcher-storage.test.mjs
```

Browser tests need Playwright and Chromium. For example, install the test tools
outside the checkout:

```sh
npm install --prefix /tmp/pondersource-browser-tests --no-package-lock playwright
```

Keep the static server running, then run:

```sh
NODE_PATH=/tmp/pondersource-browser-tests/node_modules \
CHROMIUM_PATH=/usr/bin/chromium \
node --test tests/launcher-browser.test.cjs
```

Set `CHROMIUM_PATH` to your Chromium executable, or omit it to use Playwright's
installed browser. Set `LAUNCHER_TEST_URL` if using a different local server URL.
The browser suite checks real OPFS, browser-storage fallback, persistence, launch
history, removal, concurrent tabs, corruption, mobile layout, and keyboard tabs.
It exercises the actual vendored remoteStorage.js against a simulated provider
for authorization, account isolation, sync, and a fresh device. Google Drive and
Dropbox tests check OAuth initiation with public test identifiers. Live provider
authorization requires registered applications and user consent and is not
covered by these fixtures.

## Solid launcher storage preview

The Solid build is pinned to [remoteStorage.js PR #1403](https://github.com/remotestorage/remotestorage.js/pull/1403).
The preview workflow builds the browser bundle from source and stages it in the
existing script slot. The published preview artifact is a static site, with the
Solid option alongside the other storage providers. The launcher library remains
a private remoteStorage-format JSON document. Solid apps can use native RDF
independently and should set `data-storage="solid"` on their catalog cards so
launch links do not carry a remoteStorage account hint.

## LWS discovery

Enter a storage or resource URL under **Find your LWS storage**. The launcher
follows the LWS storage Link relation, reads the storage description, and displays
the StorageRoot endpoint. For a protected resource it follows the challenge's
resource_metadata URL and displays the advertised authorization servers.
If the original resource is public, it also checks the root for a challenge.

This discovers server configuration. LWS authentication and launcher-library
synchronization require an LWS backend in remoteStorage.js. Existing account
connections and the local app library continue to work while discovery runs.

Discovery uses anonymous GET requests, rejects redirects, and validates that
storage, root and protected-resource metadata belong to the requested origin.
Authorization servers may have a separate origin. HTTPS is required except for
loopback development URLs. The server must allow CORS reads and expose Link and
WWW-Authenticate response headers. Requests time out after 15 seconds.

Protocol references are the [LWS storage description and discovery rules](https://www.w3.org/TR/lws10-core/#storage-description)
and [OAuth protected-resource metadata](https://www.rfc-editor.org/rfc/rfc9728).

Run the discovery tests with `node --test tests/lws-discovery.test.mjs`.
The launcher browser suite also covers discovery and a failed request.


## Hosted remoteStorage apps

All nine apps use the Solid-enabled PonderSource rs.js build
`2.0.0-beta.10-pondersource.6`. Dropbox, Google Drive and Solid are enabled.
The launcher uses the same source build. Each app accesses its remoteStorage
scope through an rs.js module; backend-specific storage requests belong in rs.js.
The shared scope adapters are in `packages/rs-apps`. All nine apps and the launcher use `remotestorage-widget@1.8.2-pondersource.1` for remoteStorage, Dropbox, Google Drive and Solid login. This continues [Yashar’s widget PR #136](https://github.com/remotestorage/remotestorage-widget/pull/136), with current widget fixes, pod selection and error recovery. Separate Solid controls are no longer mounted.

| App | Requested scope (read/write) | rs.js module API |
| --- | --- | --- |
| Webmarks | `bookmarks` | Bookmarks, with archive change events |
| Litewrite | `documents` | Documents |
| Inbox RS | `inbox`, `shares` | Inbox and Shares, with public file methods |
| Hyperdraft | `wikiavec` | Zero Data Wrap-generated rs.js modules for private/public wikiavec |
| Inspektor | `*` | Inspection module for all-scope browsing and editing |
| Savr | `savr` | Savr module, with public export methods |
| Marco | `places` | Places, with change events |
| Todonna | `todonna` | Todonna module, including todo and app-state schemas |
| Launcher | `launcher` | Launcher module |
| Sharesome | `shares` | Shares |

These are remoteStorage data scopes, not OAuth scopes. Google Drive uses the
Drive permission, Dropbox uses its registered PonderSource Apps folder, and
Solid uses the selected pod. Public share operations grant read access only to
files in a public scope. Hyperdraft can synchronize with Google Drive, but its
static-site publishing remains unavailable there because Drive is not a static
website host.

Run shared adapter tests with `node --test packages/rs-apps/test.cjs`; browser
controls are covered by `tests/rs-apps-browser.test.cjs` in the launcher workflow.

The launcher vendors widget commit `5ad6a05` from the updated upstream PR #136, including late pod discovery and route remount recovery.

## Migrated Solid app forks

Umai, Media Kraken and Solid Memo now use the same login widget and rs.js.
Their shared data modules live in
[pondersource/data-modules](https://github.com/pondersource/data-modules/tree/rs-app-data-modules/remotestorage).

| App | Requested scope (read/write) | Module |
| --- | --- | --- |
| Umai | `recipes` | Recipes |
| Media Kraken | `movies` | Movies |
| Solid Memo | `flashcards` | Flashcards |

These modules own all scoped storage, preserve the original RDF data, and import
existing Solid documents read-only. Google Drive and Dropbox callbacks must be
registered for each app origin. Their account tests are separate from the
Solid acceptance tests. The launcher passes remoteStorage account hints to these
apps; each app handles its own provider login. The rs.js source pin is
`92e1fc4dc0526d5c29bfef11dfc2bf9ad646347d`, including public-delete completion,
Solid write revalidation without ETags, path/hash restoration after renewal,
serialized cache mutations, and child-first cache freshness checks.

The Solid launcher browser test can also verify the published site. With the
disposable test server running on localhost:3000, set
`LAUNCHER_TEST_URL=https://pondersource.com` when running
`node --test tests/launcher-solid.test.cjs`. The test grants local network access
only to that app origin so it can reach the disposable Solid server.
