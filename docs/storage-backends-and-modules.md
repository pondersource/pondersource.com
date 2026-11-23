# Storage unification work

Implementation verified on 2026-11-20; fork PRs published and then merged
after green CI on 2026-11-23. No upstream npm release was made. The launcher workflow
now pins Ponder Source source `9ba1311a2631e2053919bd4b1dac45ef60ad4d75`
for the authenticated LWS, JSON readback and interrupted-write recovery follow-up. The initial fork
rollout used `c97481060a30d7adcd6136525572cfeeb63927b0`.
See [the app review inventory](storage-app-preview-checks.md).

## Implemented foundation

The fork retains the newer cache, OAuth and Solid fixes while porting the LWS
transport from `pondersource/remotestorage.js:feat/lws-backend`. It does not
replace those fixes with that branch's older baseline.

`npm run build:all` produces one browser bundle with remoteStorage, Dropbox,
Google Drive, Solid, experimental LWS, experimental OneDrive and an experimental
native Nextgraph adapter. The standard and Solid-only entry points remain
available. Atomic uses its existing remoteStorage plugin through the normal
protocol transport; its new chooser entry asks for an installation address.

The updated shared widget uses its provider chooser for LWS, OneDrive,
AtomicServer and Nextgraph. LWS accepts a storage URL and optional `lwsOpenID` configuration;
OneDrive opens Microsoft's account chooser. Older rs.js builds hide unavailable
providers. The launcher filters its OneDrive configuration for older builds so
the current production CI pin can still configure Google Drive and Dropbox.

OneDrive uses MSAL's code flow with PKCE and `Files.ReadWrite.AppFolder`.
Its current registration is for **personal Microsoft accounts**. Tokens are
managed in MSAL's memory cache; reconnecting is explicit after reload. The
default callback is the app origin followed by `/`, including when opened from
an editor route. `onedrive.setClientId(clientId, redirectUri)` can select an
explicit callback on that same origin.

App-folder records are a provisional version-1 JSON envelope: content type and
base64url bytes share one Graph item revision. Reversible encoded names retain
rs.js names that OneDrive would reject. Updates and deletion use `If-Match`;
new-file writes use Graph's fail-on-name-collision option. Live tests must
establish that option's atomic behavior for the target account. Metadata is
rechecked after a capability download, so concurrent bytes are not given an
older validator. Graph tokens never accompany download-capability requests.
Foreign files remain untouched. Public rs.js paths remain private on OneDrive;
publishing and uploads larger than 180 MiB are not implemented.

## Microsoft registration and live test

Public client ID: `580dcb92-f05e-4ec9-ac33-48f005b8bd01`.
The user confirmed the only currently registered SPA callback is
`http://localhost:8765/onedrive-test.html`.

The rs.js `examples/onedrive` page uses that exact callback. It creates random
test records and checks Unicode/MIME readback, create-only conflicts, two
concurrent conditional updates, stale deletion and cleanup. Reaching Microsoft
sign-in with the correct ID/callback has been checked in Chromium. Signed-in
Graph behavior is still pending; mock responses do not establish live support.
The shared desktop tool failed to start, so a standalone test ZIP was provided
for the user's local browser.

Before production OneDrive sign-in, add these **SPA** callbacks to the same registration (no
client secret). Sharing one registration is necessary to share one app folder.

```text
https://pondersource.com/
https://litewrite.pondersource.com/
https://inbox-rs.pondersource.com/
https://hyperdraft.pondersource.com/
https://sharesome.pondersource.com/
https://webmarks.pondersource.com/
https://todonna.pondersource.com/
https://inspektor.pondersource.com/
https://savr.pondersource.com/
https://marco.pondersource.com/
https://umai.pondersource.com/
https://media-kraken.pondersource.com/
https://solid-memo.pondersource.com/
```

Confirm these against each app's deployed URL and callback behavior before
registration. The localhost callback does not authorize any production origin.

## Solid data-module reuse

`data-modules/remotestorage` now builds an optional `domains` entry alongside
the existing recipes/movies/flashcards bundle. It reuses the actual sibling
Solid implementation files. Domain I/O receives the fetch interface owned by
the remoteStorage scope.

| Module | Scope | Reused functionality |
| --- | --- | --- |
| Contacts | `contacts` | Solid address books and type-index discovery, people, groups, rename, membership, email and phone add/update/remove |
| Chats | `chats` | rdflib/LDO LongChat metadata, messages, history, deletion and subscriptions |
| Tasks | `tasks` | SolidOS tracker read/write and comments; schema Action/iCalendar Vtodo reading |
| Bookmarks | `bookmarks` | Webmarks JSON archive, Solid discovery/CRUD, rdflib document/container API and Soukai container discovery |
| Profile | `profile` | FOAF name with VCARD fallback |
| Recipes | `recipes` | Existing recipe RDF, ordered ingredients/instructions and binary assets |
| Movies | `movies` | Existing movies/watch-action interpretation and RDF resources |
| Flashcards | `flashcards` | Existing Solid Memo RDF resource interface and legacy remoteStorage flashcard API |

Supporting fixes include awaited creation of rdflib module files, LDP member
discovery for task containers, a scoped bookmark profile fetch and resolved
default bookmark-document URLs. Container representations include child types;
the adapter supports expanded JSON-LD and ground N3 InsertDeletePatch operations.
Conditional/variable N3 patches are rejected, not silently applied.

**This is not complete cross-app format interoperability.** These adapters
currently keep RDF resources inside versioned JSON resource records under
`<scope>/_rs/resources/`. Parsing retained RDF through a virtual Pod proves
semantic compatibility, not native upstream-app readback from its original Pod
paths. Native write-through, existing-history handling, additional discovered formats still need fixtures and consumer-app acceptance
checks. Bookmarks now composes the exact Webmarks JSON archive module; Contacts
reads vCard 3/4 and Tasks reads iCalendar VTODO while retaining source and unknown
properties. These readers do not yet edit native vCard/iCalendar files. Existing apps have not yet adopted the new optional domains bundle. No claim of all-format coverage is made.

The acceptance matrix must use upstream fixtures and perform this round trip:
upstream creates data → module reads → module edits → upstream reads, checking
unknown predicates, sibling subjects, blank nodes, term kinds, language tags,
ordering, history and binary bytes. Run it on each backend the upstream app
supports. Additional formats can have read-only import adapters until safe
native writing is demonstrated. Do not rewrite old data just by opening it.

## Local launcher preview

After building rs.js and the widget, run from the launcher checkout:

```sh
python3 scripts/stage-storage-preview.py --rs ../remotestorage.js \
  --widget ../remotestorage-widget --output /tmp/pondersource-storage-preview
python3 -m http.server 8766 --directory /tmp/pondersource-storage-preview
```

The output must be a new directory. Its manifest records base commits, source
hashes (including uncommitted files) and bundle hashes. It does not alter app
forks or deploy the preview. Production source pins and vendored app packages
can be changed only after the corresponding sources are published and tested.

## Verified locally

- Latest rs.js source: 738 Mocha tests; existing legacy suites; source/spec lint; release, Solid and all-backend builds.
- LWS: 25 Node tests and browser offline/reconnect journey (open-mode fixture).
- OneDrive: 22 mocked Graph/MSAL tests; real sign-in navigation only, no signed-in result yet.
- Nextgraph: 9 adapter tests; actual pinned SDK browser channel check uses a simulated wallet.
- Widget: 11 browser checks, including native chooser, import, local status and mobile width.
- Launcher preview: 26 browser checks on the staged all-backend bundle and 14 discovery checks.
- Data modules: 29 Node checks and one real Chromium module journey.
- Atomic host: 2 DB lock tests and 24 actual plugin-runtime blob/write-route checks.

These numbers describe local checks, not all-app rollout or live service certification.

## Remaining rollout

1. Complete the signed-in OneDrive checks, including two devices, interrupted
   writes, token renewal, account switching and offline recovery. Add the SPA
   callbacks. Implement or clearly restrict public-sharing app features.
2. Configure the chosen production LWS issuer, public client and callback.
   Real authentication/private persistence/fresh-browser tests now pass against
   two configured CSS-LWS fixtures; their disposable registrations do not
   configure the public app deployments or certify every issuer.
3. Complete the upstream format round trips and connect each app to its domain
   module, keeping its upstream pointer and source licenses.
4. Track each follow-up merge and deployment in the app review inventory. Source
   and archive checks do not replace deployed-artifact verification. Todonna has
   a GitHub mirror retaining its GitLab history; GitLab hosting stays unchanged.
5. Complete real Atomic plugin consent and Nextgraph wallet/broker acceptance
   for the implementations described in [the design discussion](atomic-nextgraph-design.md).

The [additional app research](additional-app-research.md) is a candidate list,
not an assertion that those apps have been forked, tested or deployed.

## App dependency previews

Versioned preview archives (with source and artifact provenance) are prepared for
Litewrite, Inbox RS, Hyperdraft, Sharesome, Webmarks, Inspektor, Savr, Marco and
Todonna. Their manifests and lockfiles record the supplied archives and the public
OneDrive configuration. Umai, Media Kraken and Solid Memo receive the equivalent browser bundles.
These are versioned dependency previews; per-app
builds and browser acceptance are tracked separately in
[the review inventory](storage-app-preview-checks.md). No deployment or all-app certification follows from
resolving lockfiles. The launcher workflow pins the published Ponder Source core/widget
commits and builds the all-backend bundle. The initial deployment and public
artifact hashes were verified; follow-up review links track the latest rollout.
Live-account and full format acceptance remain in progress.

The optional module-native Solid view reads and edits original upstream document
URLs through the Solid backend's authenticated fetch, with root write fences and
unauthenticated foreign reads. Consumers still use their existing copy-based
adapter while the user chooses how to keep/import legacy JSON-adapter data.
These native-view tests use protocol fixtures, not certified real-Pod sessions.

New internal resource-record filenames use bounded SHA-256 keys; complete original
identities remain in the same atomic records. Existing URL-encoded names remain
readable/writable. Opening a record does not migrate its representation.

The Nextgraph guest snapshot includes only the rs.js local cache. Separate app
guest stores need per-app export adapters before complete first-import coverage
can be claimed. No snapshot source is deleted by the import.

On 2026-11-23, upstream OneDrive draft
[#1435](https://github.com/remotestorage/remotestorage.js/pull/1435) was closed
in favor of test-driving the preserved implementation in
[fork PR #7](https://github.com/pondersource/remotestorage.js/pull/7). A new
upstream PR will be proposed when live acceptance is ready. This implementation
and the MSAL/app-folder prototype are distinct; neither is silently substituted
for the other.
