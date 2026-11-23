# Atomic and Nextgraph connection and synchronization

Design decisions and implementation status, 2026-11-20. Live backend acceptance is still pending.

## Decisions confirmed by the user

- Atomic means Atomic Data / AtomicServer (`atomicdata.dev`).
- Apps remain usable at their own URLs, and connection is an explicit action.
  Nextgraph may then run the app in its wallet-controlled environment.
- The first implementation preserves complete native documents as versioned
  records. Semantic graph mapping comes later.
- Atomic uses its remoteStorage plugin and native consent; fix the host write race.
- Nextgraph uses explicit guest export/import first, then native SDK synchronization.

The implementation follows these choices; alternative credential and transfer
flows below are background, not selected work.

## Atomic connection options

There is already an [Atomic remoteStorage plugin](https://github.com/ontola/atomic-plugins/tree/main/integrations/remotestorage).
It discovers a per-installation account address with WebFinger, asks for scopes
through the host's consent screen and stores original bytes/MIME types as
Atomic Files. It requires a plugin-routes-enabled server, a routes origin and an
installation with a selected folder. This is not enabled on every AtomicServer.

The selected first connection flow uses this plugin:

1. The user selects Atomic and enters their installation's storage address.
2. rs.js discovers its endpoint and requests the modules' scopes.
3. AtomicServer shows the app origin and exact permissions in its consent UI.
4. The original app resumes and its existing rs.js cache performs synchronization.

This keeps Atomic agent secrets out of third-party apps and avoids introducing
a second client sync queue. The plugin's own README records unresolved host
limitations: `If-Match` is checked before the commit, so racing writers can both
pass it; duplicate creation gives an unsuitable error; denial is not returned
to the app; tokens have no expiry; PKCE is absent. Those are reported upstream
limitations. The published draft host patch validates the blob under the same subject
lock as ordinary signed writers. Conditional creates use the persistent localId
property and its DB identity lock; a losing create returns 412. An intent's
localId alone is not a persistent identity. Conditional multi-resource plans
are refused. Actual QuickJS/WASM route tests pass for competing edits and
creation, alongside DB lock tests. The fixture mirrors the real plugin's
persistent identity. The real plugin's browser consent suite still needs to
run on this patched host. Keep this option experimental until that passes.

The alternative is a direct Atomic SDK adapter. Its [Store](https://docs.atomicdata.dev/js-lib/store)
and [Agent](https://docs.atomicdata.dev/js-lib/agent) APIs provide signed writes.
Use a dedicated, permission-limited agent; never ask for a primary account's
secret. A local agent import would occur in a password input, remain outside
rs.js data modules and logs, and optionally persist a non-extractable CryptoKey
through the SDK's supported IndexedDB mechanism. There is no assumed generic
Atomic OAuth endpoint. Pin a compatible SDK/server pair: published SDK docs and
newer Atomic Sync implementations have different persistence behavior.

## Atomic synchronization

For the plugin route, rs.js IndexedDB remains the browser's durable pending-write
store. A logical record maps to an Atomic File, retaining original bytes and
content type. Atomic subjects are retained as identities rather than inferred
from path prefixes. Only a confirmed, conditional server write clears the
pending operation. If the response is lost, re-read its exact revision/body
before retrying. No local record is discarded on a failed connection or denial.

For the direct SDK route, decide which SDK version supplies a durable local
journal before implementing the adapter. The SDK should own replication if it
has that journal. The rs.js cache must then be a compatibility view rather than
an independent competing outbox. Local durability and server acknowledgement
must have separate status signals. Do not translate "saved locally" into the
widget's "synced" status.

## Nextgraph connection

The [documented third-party web SDK](https://docs.nextgraph.org/en/framework/getting-started/)
uses `@ng-org/web`; `init()` can redirect to wallet authentication. Initialize it
only after **Connect Nextgraph**, not during unrelated guest/app startup. The
framework is an alpha; pin the web/ORM/engine versions together.

After wallet authentication, select a private store and the app's existing
collection, or explicitly create one. Bind the rs.js account identity to the
wallet plus store, not to an e-mail, server URL or arbitrary broker address.
Wallet secrets and recovery phrases never enter the launcher or a data module.
Each app handles its own wallet session through the supported SDK; the launcher
does not send credentials through launch links.

Cross-site iframe storage partitioning can make the standalone app's guest
IndexedDB inaccessible inside the wallet-hosted app. Do not assume localStorage
or OPFS is shared. The user selected explicit export/import for the first version:

- Explicit versioned export/import: the standalone guest app exports only the
  chosen module's documents; after connection the user imports that snapshot.
  Keep the source copy until successful readback. This is the recommended first
  implementation and is now available in the shared widget for documents in
  the rs.js local cache. Apps with separate guest stores (for example Dexie,
  Soukai or OPFS) still need an app-specific snapshot adapter; those stores
  are not automatically included in this export.
- Deferred alternative, seamless transfer: keep a standalone source window and use a documented SDK
  bridge or a tested one-time MessageChannel with exact origin/window checks,
  a random nonce and expiry. Do not send a snapshot to the parent iframe based
  only on a query parameter, wildcard target origin or a public relay. A working
  cross-partition handshake must be proved before promising this flow.

## Nextgraph synchronization and conflicts

The first implementation uses one discoverable private JSON CRDT collection for
the rs.js document ledger, with client-side checks for each requested scope.
It does not claim separate wallet capability grants per scope. Keep documents keyed by
stable logical identifiers and retain a versioned envelope with path, media
type, original bytes or immutable blob reference, revision and deletion state.
The index must survive another browser's sign-in and must not depend solely on
the original browser's local lookup table. Large binary records should use
native immutable blobs once the SDK's upload/readback semantics are verified.

Actual pinned WASM/ORM tests exposed a durability gap: native commits can resolve
after encrypted outbox persistence fails, and pending sessionStorage events can
disappear when a tab closes. A wallet export does not recover those documents.
The engine still owns encrypted broker replication, but its completion cannot
serve as a durable local-save acknowledgement.

[rs.js fork PR 11](https://github.com/pondersource/remotestorage.js/pull/11) adds
an append-only IndexedDB recovery journal keyed by native private store and
collection. Writes await the actual transaction completion, retain revisions and
tombstones, and reject quota errors and aborts. Preconditions and revision
appends share one local transaction. Separate Web Locks coordinate first
collection selection. Unknown older cache candidates block silent assignment
and remain explicitly exportable. Missing immutable IDs replay through the SDK
when the native graph returns; no independent broker queue or peer-sequence
mutation is introduced.

Neither journal completion nor a CRDT update proves broker delivery. The widget
uses **Saved on this device** and **Needs attention**. An explicitly failed SDK
view needs a reload, while journal readback and recovery export remain available.
Only one adapter owns a mutable SDK collection in a page at a time.

Byte strings are not semantically mergeable just because their container is a
CRDT. Concurrent document edits must preserve both candidates plus their base
revision. Merge independent document keys; retain explicit conflicts for the
same opaque document, including edit/delete conflicts. Keep deletion tombstones
until their replication/retention policy is defined. Later per-domain semantic
mapping can merge selected fields while retaining unknown RDF and history.

Acceptance requires real wallet/broker use, two-device offline divergence,
restart before reconnect, a fresh device, duplicate first connection, deletion,
large blobs, revoked permission, interrupted import, account switching and
loss/recovery of local browser storage. A local JSON mock or a single-browser
CRDT change does not establish broker synchronization.

## Implemented interfaces

The rs.js all-backend bundle includes the pinned native web/ORM SDK adapter.
The widget offers native connection, guest export/import, retained conflict
versions and explicit resolution. Its status reports local acceptance only.
See the rs.js `docs/nextgraph-experimental.md` for snapshot shape and API.
Unit tests replace the SDK boundary; a browser protocol fixture uses the actual
pinned SDKs with a simulated wallet channel. Neither establishes real broker
synchronization. A separate actual-engine fixture passes adapter recovery tests
through reload, tab close and cold browser restart, transaction failures,
old-cache preservation, account fencing and concurrent local tabs. Its pinned
engine-only strict durability contract remains deliberately failing. Native
wallet consent and successful real-broker replication remain unverified.

The widget's [fork PR 3](https://github.com/pondersource/remotestorage-widget/pull/3)
is merged after green CI. It adds app-owned guest export/import hooks for data
outside the remoteStorage cache, plus a cancellable connection preflight.
Individual apps still need complete archive implementations; a deck-only export
must not be presented as a complete guest-data transfer.

The Atomic entry uses normal rs.js discovery and consent, with
no new Atomic agent-secret transport. No AtomicServer deployment or live Atomic/NextGraph certification is claimed.

## Atomic native SDK alternative under discussion

On 2026-11-23, the user proposed direct `@tomic/lib` use in an unhosted app:
agent-key authentication followed by native synchronization with their server.
The SDK supports `Agent.fromSecret`, authenticated Store connections, and a
native offline outbox. Durable local storage requires its client-DB worker and
WASM/OPFS initialization; constructing Store alone does not enable that layer.
This path bypasses the remoteStorage plugin, so the plugin HTTP precondition
race fix is not required for the native backend. The server fix is published separately as
[AtomicServer #2645](https://github.com/ontola/atomic-server/pull/2645),
without a merge or deployment, while this alternative is evaluated. The user explicitly exempted
AtomicServer from the Ponder Source forking policy.

The document-first model still needs immutable revisions and retained concurrent
heads: placing an entire document in one last-writer-wins property would not
preserve divergent edits. Connection UI must bind the chosen agent and server
to a separate local store, expose local-persistence and server-sync failures,
and handle explicit first import without deleting the source. App-scoped agent
grants can use the native SDK grant flow where available. No native Atomic
backend implementation or live two-device acceptance is claimed yet.
