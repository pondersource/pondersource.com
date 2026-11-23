# App preview checks

Implementation verified on 2026-11-20; review branches and PRs published
on 2026-11-23, then merged after green CI with the user's authorization.
Configured Pages deployments followed those merges; Todonna's existing GitLab
hosting is unchanged. No upstream npm release is included. The previews preserve each app's existing upstream
pointer, module paths and native JSON schemas. Backend libraries are packaged
with source and artifact provenance.

| App | Local validation | Limits |
| --- | --- | --- |
| Launcher | 26 staged browser checks | Merged workflow pins the reviewed Ponder Source core/widget revisions; deployment passed and the public core hash was verified. |
| Litewrite | Production build, Standard lint, 6 browser journeys | Used an isolated test port and the installed Chromium. |
| Inbox RS | Biome check, full production build and all 696 tests pass | Real pinned transcription assets downloaded and verified; Node fetch needed `NODE_USE_ENV_PROXY=1`. |
| Hyperdraft | Rollup build | Existing accessibility warnings remain. Browser/format acceptance still needed. |
| Sharesome | Production build, 8 QUnit tests | Provider-specific public sharing remains subject to backend capabilities. OneDrive/Nextgraph do not publish private records. |
| Webmarks | Build, 15 QUnit tests | New optional cross-format domain bundle has not yet replaced its native JSON module. |
| Inspektor | Build, 24 QUnit tests | Wildcard inspection remains intentional. |
| Savr | Build including TypeScript, 472 Jest tests | Skipped unrelated GPU-runtime install scripts after a failed binary download; the browser build succeeds. Raised the precache asset limit to retain the storage bundle offline. |
| Marco | 428 browser tests through `pnpm test` | No release-only `pnpm build` was run. |
| Todonna | Build, 3 browser journeys including fresh-device remote changes/deletion | GitHub mirror now retains the GitLab history and upstream attribution; hosting remains unchanged. |
| Umai | Vite build, 28 tests on its Node 16 runtime | Real Pod/application acceptance still needed for the changed shared artifacts. |
| Media Kraken | Build, 6 tests on its Node 14 runtime | Native install scripts skipped; it uses configured Dart Sass, not the obsolete node-sass binary. |
| Solid Memo | All 36 task checks, all repository checks; lint passed | Initial parallel execution exhausted memory. The successful task run used concurrency 2. REUSE lint also passes. After the final artifact refresh, the web typecheck, 110 web tests with 100% coverage, production build and REUSE lint pass. |

The backend library's tests verify its new behavior separately from app UI
checks. No signed-in OneDrive, authenticated LWS issuer, real Atomic consent or
Nextgraph broker certification follows from the table. The latest storage
artifact revision was staged and passed all 26 launcher checks. Live-provider acceptance remains separate from merging and deploying these
fork previews.

The pending Solid data migration choice affects the three former Solid-only
apps. Their current connection adapter remains compatible with existing fork
records until that choice is implemented. A new optional module-native view can
read and edit original document URLs; it is not silently substituted for an
existing user's JSON-adapter data.

The final preview uses `preview.4` archives with matching lockfile integrity and
identical installed core bundle hashes across all nine package consumers. The
three static consumers include artifact hashes. The OneDrive test ZIP contains
the same verified core/widget builds. These previews are merged. The rs.js and widget distribution branches retain
the experimental backends without adding them to their upstream PR heads.

Final artifact verification: all nine dependency installs completed; package
archive integrity matches every npm lockfile. Litewrite, Hyperdraft, Inbox RS
web, Savr, Umai, Media Kraken and Solid Memo builds pass. The refreshed browser
suites pass for Litewrite (6), Todonna (3), Sharesome (8), Webmarks (15),
Inspektor (24) and Marco (428). Inspektor initially shared a test-server port
with another suite; its sequential retry passes. Solid Memo adds 110 web tests
with full coverage after the artifact refresh. Earlier broader checks remain
listed above. The Inbox model-asset download is now resolved, and the full suite passes.

## Review links

- [litewrite](https://github.com/pondersource/litewrite/pull/7)
- [hyperdraft](https://github.com/pondersource/hyperdraft/pull/12)
- [sharesome](https://github.com/pondersource/sharesome/pull/1)
- [webmarks](https://github.com/pondersource/webmarks/pull/2)
- [inspektor](https://github.com/pondersource/inspektor/pull/1)
- [savr](https://github.com/pondersource/savr/pull/1)
- [marco](https://github.com/pondersource/marco/pull/1)
- [todonna](https://github.com/pondersource/todonna/pull/1)
- [umai](https://github.com/pondersource/umai/pull/5)
- [media-kraken](https://github.com/pondersource/media-kraken/pull/4)
- [inbox-rs](https://github.com/pondersource/inbox-rs/pull/6)
- [solid-memo](https://github.com/pondersource/solid-memo/pull/4)

Shared source reviews: [all-backend distribution](https://github.com/pondersource/remotestorage.js/pull/8),
[widget](https://github.com/pondersource/remotestorage-widget/pull/2),
[data modules](https://github.com/pondersource/data-modules/pull/8), and
[the preserved OneDrive draft](https://github.com/pondersource/remotestorage.js/pull/7).

The Atomic plugin race fix is separately reviewable in
[AtomicServer #2645](https://github.com/ontola/atomic-server/pull/2645) while
the direct native SDK connection and synchronization flow is evaluated. It is
not a prerequisite for a native Atomic SDK backend. No AtomicServer fork was
created; the user exempted it from the fork policy.

## Concurrency and startup follow-up

The distribution also includes the upstream Solid review fixes, server-enforced
Dropbox mutation conditions, the shared unknown-body/lost-acknowledgement fix,
and LWS HTTP cache isolation. The pinned NextGraph SDK now builds under strict
CSP without dynamic evaluation. OneDrive authentication initializes only after
explicit connection, so optional configuration cannot break guest startup on
insecure HTTP test origins.

These changes do not establish atomic writes on an arbitrary server. The
[concurrency audit](backend-concurrency-audit.md) distinguishes client bugs,
provider primitives and CRDT conflict retention. The pinned Java LWS reference
server exposed a separate blob-lifetime read race (HTTP 500 during concurrent
index replacement); required interoperability checks retain that evidence.

The final preview also defers NextGraph SDK evaluation until explicit connection,
so missing modern SDK features do not break guest use or other backends. The
Node 20 import and browser guest regression cover a missing `Set.union` without
adding global polyfills. Inbox retains its storage bundle offline with a bounded
2.25 MiB precache budget; unrelated large optional chunks still fail the guard.

## Merge outcome

All twelve listed app PRs and the launcher/core/widget/module rollout PRs are
merged after green checks. Sharesome, Inspektor, Marco and Todonna received
read-only CI workflows that run their existing browser suites before merging.
The standalone recipes and flashcard-schema PRs also merged. Conflicting older
bookmark-topic and LWS-widget PRs, and the failing older LWS core PR, remain
unmerged.

Core and widget changes live on their fork's `distribution` branches; their
`master` branches remain unchanged where they feed upstream review. The copied
OneDrive implementation merged into its separate review baseline after real
Node 22/24/26 CI, without replacing the MSAL/app-folder prototype.

The module fork's npm publication and documentation Pages deployment jobs now
require the canonical upstream repository. Fork builds and documentation checks
still run. Upstream Solid/widget PRs and AtomicServer #2645 remain open for review.
