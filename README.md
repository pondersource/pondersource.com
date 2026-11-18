# pondersource.com
The https://pondersource.com/ website

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
use GitHub Pages. Installing adds a shortcut to **My apps**; launching opens the
app's website. Removing a shortcut
also removes it from Recently used, without deleting any data in the app itself.
The catalog and its source links live in `index.html`.

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
