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

The **App store** contains the apps distributed by Ponder Source. Installing adds
a shortcut to **My apps**; launching opens the app's website. Removing a shortcut
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

The bundled library supports remoteStorage, Google Drive, and Dropbox. It does
not include Solid Pod or Atomic adapters; those require a separate integration.

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
