# Backend concurrency audit

Read-only source audit on 2026-11-23. Inspected distribution source:
HEAD `340f6392c71b686da20f0c3c24ee80ca0949640f` plus its integration changes. The separately copied OneDrive
draft is at `37e547df64aff768181c9f9c95cb7e28dc8bbf7d`.
No source edits, commits, provider-account writes, or new tests were made for this audit.
Line numbers refer to the inspected files; subsequent edits may move them.

## Answer

rs.js can repair adapter bugs, propagate conditions consistently, retain conflict
candidates, and run one conformance suite across backends. It cannot make a
server-side read/check/write sequence atomic from JavaScript. A mutex or queue
in one tab cannot exclude another device, another app, or a native client.
Atomic HTTP compare-and-swap and CRDT conflict retention are different contracts:
a CRDT backend can accept both offline writers and retain both versions, rather
than immediately returning one success and one 412.

The shared sync engine already supplies `ifMatch: common.revision` for updates
and deletes, and `ifNoneMatch: '*'` for initial writes (`src/sync.ts:500–543`).
It re-reads an acknowledged body lacking a validator before the next mutation
and adopts the fetched validator only if the body still matches (`603–612`).
Those are useful shared defenses, but the adapter/server must enforce the
condition at the final mutation.

## Conditional-header semantics

RFC 9110 sections 13.1.1 and 13.2.1 describe lost-update prevention and checking
preconditions just before processing request content or performing the action.
They do not explicitly define transaction isolation between concurrent requests.
Two successes against the same earlier version therefore demonstrate a
lost-update gap, but are not presented here as conclusive proof of a strict
RFC violation. To provide compare-and-swap, the condition and mutation need
one atomic operation relative to competing writes. Checking only when a request
starts cannot provide that guarantee.

AtomicServer #2645 hardens existing header handling on the plugin-host branch.
It does not add conditional HTTP writes to the native Atomic commit API, and
does not target current develop, which lacks those route modules.

## Findings

| Backend | Source evidence and present contract | Evidence limits / action |
| --- | --- | --- |
| remoteStorage HTTP | `src/wireclient.ts:544–576` sends If-Match and If-None-Match on the mutation when `supportsRevs` is true. `configure():445–448` derives that from the advertised protocol version. | Modern compatible servers can enforce CAS; rs.js cannot prove the implementation atomic merely from discovery. Legacy `supportsRevs=false` silently drops supplied conditions. Add an explicit safe-mutation capability / fail-closed mode rather than promising uniform safety for those old servers. Existing `test/unit/wireclient.test.mjs:511–518,635` checks forwarding, not competing real-server writers. |
| Dropbox | **Concrete client bug:** `src/dropbox.ts:503–507` constructs uploadParams without ifMatch/ifNoneMatch; `526` calls `_uploadSimple`; `933–942` defaults to overwrite, despite an unused update-mode branch. Metadata prechecks at `509–524` therefore race with the actual unconditional overwrite. Conditional deletion prechecks metadata (`555–563`), then sends path alone (`565,993–996`). | Fix without changing file bytes/names: forward conditions; update mode with the exact rev; create-only add mode; autorename=false and strict_conflict=true; conditional file deletion using documented parent_rev. Normalize provider conflicts to412. Keep missing-file and same-bytes cases strict. Current success tests (`test/unit/dropbox.test.mjs:1084–1107,1136–1157,1233–1257`) do not assert a conditional final upload and explicitly expect path-only deletion; they miss the race. Provider live acceptance remains required after correcting requests. |
| Google Drive | Updates send If-Match both when opening the resumable session and on the final content PUT (`src/googledrive.ts:479–491,530–545`). Deletes send If-Match to the file-ID mutation (`414–421`). **Create-only gap:** logical-name lookup (`341–350`) is followed by a new file POST (`505–525`); Drive names are not unique. Two devices can both see absence and create two files. Local mutationQueue (`375–388`) only serializes one adapter instance. | Existing final-request tests (`test/unit/googledrive.test.mjs:590–593,640–645`) establish header propagation, not Google service CAS at final resumable commit. Signed-in two-client acceptance must cover a write between session creation and final upload. No client-only lookup fix can make a name unique without a shared server primitive. Retain duplicate candidates and report ambiguity; do not pick/delete an arbitrary file. `_getFile():565–619` additionally pairs pre-download metadata ETag with a separate download response without checking after transfer: audit/version-bind that read before using its revision as a write base. |
| Solid | `src/solid.ts:235–243,329–354` sends HTTP conditions on PUT/DELETE directly through authenticated fetch. No GET-before-write emulation. Successful PUT with no ETag deliberately does not attach a later HEAD validator (`342–344`); shared sync handles revalidation. | Real CSS browser tests exercise stale PUT/DELETE rejection (`examples/solid/tests/sync.spec.mjs:155–164`), in addition to request fixtures. This certifies those tested CSS paths, not every Solid provider or all concurrent schedules. Add barrier-based two-writer same-revision and simultaneous-create cases to shared acceptance. |
| LWS | Existing resources PUT/DELETE carry conditions (`src/lws.ts:303–331`). New files are POSTed to independent opaque URLs, then one logical-name mapping is published by index PUT If-Match (`src/lws-path-map.ts:115–147`); a losing definite index CAS attempts conditional cleanup of its own orphan. Ambiguous first-created indexes stop operations (`86–111`). | Correctness depends on the server atomically applying resource and index conditions. HEAD at `lws.ts:310` is only an existence branch, not the update guard. Two-client same-name/create and independent-path tests cover the index protocol (`test/lws-path-map.test.mjs:31–49`); current real-server suite tests stale conditional operations and independent paths (`test/lws-interop.test.mjs:9–35`). Open-mode ebremer tests are positive evidence. The known raw LWSD non-atomic behavior cannot be repaired by this client index. Initial-index bootstrap, delete/recreate mapping races, and live authenticated providers need explicit acceptance. |
| OneDrive local appfolder prototype | `src/onedrive.ts:249–268` sends If-Match on content PUT/delete and create-only conflictBehavior=fail, mapping409 to412. Unlike Google, reads re-fetch metadata after download before returning the revision (`209–215`). | Those Graph operations are intended CAS, not verified CAS. Unit tests (`test/unit/onedrive.test.mjs:100–108,131–136`) mock the service. The simple-content endpoint reference does not itself document the full conditional contract; general driveItem annotations are not proof that this exact URL honors them. Keep experimental until real two-client/race tests pass; use a documented final-commit conditional flow if simple PUT cannot establish it. |
| Copied OneDrive draft | Separate `src/onedrive.ts:340–379` opens deferCommit upload, streams chunks, requires202 for deferred content, then explicitly commits to destination parent with If-Match/conflictBehavior and the upload URL. Conditional delete is sent directly (`387–395`). It uses native bytes/shared directory instead of the local appfolder JSON envelope. | More explicit concurrency design, still draft pending real Microsoft acceptance. A mocked successful conditional commit is not service certification, and it must not be mechanically merged into the incompatible appfolder layout. Test final commit against a native edit during chunk upload and competing creation. |
| NextGraph | `src/nextgraph.ts:173–224` serializes local SDK transactions, checks known heads, and writes a new immutable UUID revision record (`182–188`), with tombstones for deletion. Concurrent remote histories retain multiple heads and GET409 (`163–169`); explicit resolution parents all reviewed heads (`240–248`). | This is **retention/eventual convergence**, not global online CAS: offline devices can both return success, then expose a conflict after sync. Tests inject merged concurrent records (`test/unit/nextgraph.test.mjs:52–71`); actual pinned SDK browser test uses a simulated wallet channel. Real two-device wallet/broker offline divergence remains pending. Do not require immediate one-winner/one412 as the CRDT contract. |
| Atomic remoteStorage plugin | Current host patch in `/workspace/atomic-server` moves the current-blob check under the ordinary DB subject lock and uses the existing parent/localId identity lock for create. | All26 targeted DB/runtime routes pass and exact staged-snapshot Clippy passes. Published subsequently as draft AtomicServer #2645 on the plugin-host feature branch; current develop lacks these HTTP plugin routes. Native @tomic/lib+OPFS/Loro could bypass that HTTP path, but requires a separate rs.js adapter and immutable document-version design; storing a whole opaque document in one LWW property is insufficient conflict retention. |

## Primary API references checked

- [HTTP conditional request semantics, RFC9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1): a failed condition must prevent the mutation. Sending the header alone cannot fix a server implementation that violates this contract.
- [Dropbox upload API](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload) and [official SDK write-mode / strict-conflict definitions](https://dropbox.github.io/dropbox-sdk-js/global.html#FilesCommitInfo): use provider-side revision checks, strict conflicts and no renaming.
- [Dropbox delete_v2 API](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/delete-v-2): parent_rev conditions a file deletion; it does not support conditional folder deletion.
- [Google's File model](https://developers.google.com/resources/api-libraries/documentation/drive/v3/csharp/latest/classGoogle_1_1Apis_1_1Drive_1_1v3_1_1Data_1_1File.html): names need not be unique within a folder. [Drive v2 files.insert](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/insert) creates a new ID rather than reserving a logical filename.
- [Solid protocol](https://solidproject.org/TR/protocol): uses HTTP preconditions to prevent accidental existing-resource replacement.
- [Microsoft simple content PUT](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0) versus [upload sessions and explicit commit](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0): separate endpoint contracts; do not infer all final-commit behavior from a successful session start.

## Shared conformance suite and minimal next steps

1. Fix Dropbox's dropped conditions first. This is a concrete, small rs.js change preserving native formats. Cover the final mutation arguments, not just the metadata precheck.
2. Define backend capability evidence separately for conditional update, exclusive creation, conditional deletion, and conflict retention. Distinguish documented/fixture-tested/live-verified/unsupported. Preserve current APIs; safe-sync mode must refuse an unsupported destructive operation instead of silently making it unconditional.
3. Reuse one parameterized fixture harness and one opt-in live harness with **two independent clients**, no shared queue/cache. Synchronize a barrier after both reads or after upload-session initiation, immediately before the final mutation. Assert: same-revision update gives one winner and one conflict; same-name creation does not silently overwrite; stale delete preserves newer bytes; delete/recreate does not accept the old validator; returned revision matches returned bytes; uncertain responses never trigger a destructive blind retry. Verify winner bytes/revision, not only status codes.
4. Give CRDT backends a separate convergence contract: offline edits and edit/delete retain both immutable candidates after merging; reload/fresh-device recovery retains them; explicit resolution checks reviewed heads. Local acceptance is not server delivery.
5. Add an intentionally non-atomic fixture as a negative control. A client GET-check-unconditional-PUT must fail the harness. Do not add a per-tab mutex and call the problem solved.
6. For backends lacking CAS, an opt-in append-only version journal can improve retention for cooperating clients. It is not a transparent replacement for native upstream files and does not give mutual exclusion. Keep native document bytes and paths; do not introduce a universal envelope or silently materialize a winner over foreign edits. A journal/index also needs its own collision/commit/GC/recovery design.

No generic client wrapper can honestly advertise server-atomic compare-and-swap
for every arbitrary storage implementation. The realistic common guarantee is:
use a verified atomic primitive when available, retain explicit concurrent
versions where the backend supports that model, and fail clearly when neither
can safely support the requested operation.

## Inspected source digests

- `src/sync.ts`: `5d72538e7814321aaf4ac99128facc99dc54a415d9cde65338dfc45a58111585`
- `src/wireclient.ts`: `8c1ad933d9540f754beca3484d09c55f5dd162545bdccebd7fbf95bed01e31de`
- `src/dropbox.ts`: `5310973a7e4312c191b34d20f6a688ec1f059ca5a36b6a7e875952cd0ee95748`
- `src/googledrive.ts`: `cc637b4696fd7cbec711935cabe37b609a7e6c340a8fa23ad70ce3e60c3af8df`
- `src/solid.ts`: `74f4b3f172b4e778ae75c2b46b23ea2d0bf8f76c7aeb68634f88c50a19523bb1`
- `src/lws.ts`: `c29539aaa98cd50a5003875d44e757631199197dc189870ae054458b5d9144e4`
- `src/lws-path-map.ts`: `577c67b8c2786ad1b12fb8b55ac17f462e56e852785a3399b871b53ef77f2fb7`
- `src/onedrive.ts`: `7bb148b826a8bbcf51500fc70f2c74f7952a4e2d239ac179fac248846a191929`
- `src/nextgraph.ts`: `104b0babc78e6405dfbeb8664e29dfe72ff26cd8ca60bb29a9212ba754836fb6`

## Implemented after the audit

Fork PR #8 now forwards Dropbox revision/create-only conditions to its final
provider mutations and uses native conditional deletion, with reusable two-client
contract regressions. The shared sync engine no longer treats two unknown bodies
as equal after a lost write acknowledgement: it fetches the remote candidate,
exposes both conflict versions and permits an explicit conditional keep-local
write. LWS bypasses browser HTTP caching so only rs.js supplies its validators.
These changes preserve native document bytes and paths.

The separate Atomic host fix is published in
[AtomicServer #2645](https://github.com/ontola/atomic-server/pull/2645) under the
user's existing-repository exception. No server is deployed. The Java LWS
reference server also exhibited a separate obsolete-blob read race; its test
failure is retained as compatibility evidence. Native SDK use bypasses a plugin
HTTP path but does not repair that path for other clients.


## Authenticated LWS follow-up

The next fork revision, [rs.js #9](https://github.com/pondersource/remotestorage.js/pull/9),
also fixes public-root OAuth metadata discovery and index rediscovery when the
server's container projection reports generic MIME. Exact resource/issuer
binding, duplicate-index refusal and conditional updates are retained.

Real private-persistence tests then exposed a client representation bug: LWS
parsed JSON downloads before sync compared them with acknowledged JSON text.
Without a write ETag, this produced a false conflict and discarded a queued
local update. JSON text readback now matches the cache contract. Focused actual
adapter-to-cache regressions reproduced the same pending-edit loss in OneDrive,
NextGraph, Dropbox and Google Drive and went red-to-green with bounded raw-text
fixes. Object module APIs still parse JSON; native file formats are unchanged.
These client changes do not prove any new provider-side CAS guarantee.

Both configured CSS-LWS widget journeys now pass real login, private study
writes, anonymous denial and entirely fresh-browser recovery on the final
artifact. The transactional Java host's separate blob-lifetime race remains
documented, and its required check is not relaxed or relabeled as certification.
