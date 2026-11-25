# Storage worker handoff — 25 November 2026

This is the current handoff for Michiel's unhosted app/storage work. It supersedes older dated status and priority notes where they conflict. Implementation below is pushed; completed fork PRs are merged. No npm release was published. Stop expanding scope during this handoff: Michiel is starting a fresh worker.

## Start here

1. Finish Solid Memo's deployment without bypassing its required checks. Its source is merged, but the public runtime is still old.
2. Enable Todonna Pages with repository administration access, verify the GitHub preview, then move the existing domain. Keep GitLab hosting until that verification passes.
3. Arrange real NextGraph and OneDrive acceptance with Michiel. Mock-wallet or mocked Graph tests do not establish live service behavior.
4. Continue native format interoperability and graph binding from the existing calendar contracts; do not claim the full original all-app/all-format goal is complete.

## Decisions and authorization

- New changes stay in Ponder Source forks. Michiel authorizes merging green PRs in those forks. Do not merge upstream PRs under that instruction.
- AtomicServer is an exception: do not create a Ponder Source fork. Its conditional-write change is a separate upstream draft.
- Eight chooser options: remoteStorage, Dropbox, Google Drive, Solid, LWS, OneDrive, AtomicServer, NextGraph. Atomic currently uses its remoteStorage plugin; NextGraph uses the native web SDK and our document adapter. These are not eight fully certified production integrations.
- Use each backend's native consent flow. NextGraph may open the app in a wallet-controlled iframe; explicit first export/import handles guest data in a different storage partition, then SDK synchronization handles later edits.
- Preserve complete documents first; semantic graph mapping is a subsequent step. Calendar schema work was explicitly requested and approved later than the old module-first notes.
- Preserve upstream pointers, licenses, existing formats and unknown fields. Never migrate data just by opening an app.

## Pushed repositories and exact source revisions

Source revisions below are the reviewed PR heads, not their merge commits. Local branches may remain at these heads after merge; that does not mean the work is unpushed.

| Repository | Source branch / SHA | Published result |
| --- | --- | --- |
| [rs.js](https://github.com/pondersource/remotestorage.js) | `feat/nextgraph-wallet-server` / `47cf02b312902298efcbfc8c7c6cd1bfb637e11c` | [PR 13](https://github.com/pondersource/remotestorage.js/pull/13), merged into `distribution`; merge `3e640317fdddea77220b6e4269e2c3f9ddeeea14` |
| [Widget](https://github.com/pondersource/remotestorage-widget) | `fix/nextgraph-wallet-visibility` / `14acf28d44851a5984dbfa91ba71e35a5b3a0b79` | PRs [4](https://github.com/pondersource/remotestorage-widget/pull/4), [5](https://github.com/pondersource/remotestorage-widget/pull/5), [6](https://github.com/pondersource/remotestorage-widget/pull/6), merged into `distribution`; latest merge `b776f3e95d849c0878839b4c4f5464997ed39321` |
| [Data modules](https://github.com/pondersource/data-modules) | `fix/calendar-atomic-meta-schema` / `05a75a99e1dbc805c88cda623d66a39351837b70` | PRs [11](https://github.com/pondersource/data-modules/pull/11), [12](https://github.com/pondersource/data-modules/pull/12), [13](https://github.com/pondersource/data-modules/pull/13), merged into `main`; latest merge `0082c42127c42a63872592bb0056fab639e1468d` |
| [Launcher](https://github.com/pondersource/pondersource.com) | `fix/pages-build-artifact` / `480324ee2f50cb9912961679fe0e50dcbef8a312` | PRs 34–36 merged; functional baseline on `main`: `d6df916d18943fab8507c1bb218e10def51889e0` |

This handoff itself is on launcher branch `docs/storage-worker-handoff-2026-11-25`; its commit/PR are reported in the worker's final message.

### Wallet-server implementation

The widget has a dedicated NextGraph wallet-server form, defaulting to `https://nextgraph.net`, preserving a typed address while returning to export guest data. Core validates HTTPS origins (HTTP only for loopback), uses that same origin for SDK redirect and RPC, and carries a public `rs-nextgraph-wallet` URL hint across iframe storage partitions. A hint alone does not authorize connection. First entry into a partition requires confirmation; changing wallet origin after SDK initialization requires reload. Mobile focus/animation handling keeps the form visible.

The exact pinned SDK is patched by a hash-checked build loader, retaining the strict-CSP workaround. Inspect `src/nextgraph-wallet.ts`, `src/nextgraph.ts` and `scripts/nextgraph-csp-loader.cjs` in rs.js; do not replace this with an unreviewed upstream SDK upgrade.

### Calendar implementation and limits

See [calendar/vanilla/README.md](https://github.com/pondersource/data-modules/blob/main/calendar/vanilla/README.md) and its generated `schemas/` contracts. Package is `@pondersource/calendar` 0.1.1. The rs module exports the `calendar` scope with JSON CRUD and explicit JSON/RDF/Atomic/iCalendar codecs, plus native scoped Solid RDF CRUD. LWS can supply its backend-owned RDF fetch.

JSON Schema draft 7, open ShEx for iCalendar RDF/schema.org Event, native Atomic Classes/Properties, and an explicit mapping describe the model. Tests cover actual Atomic meta-schema requirements, not just self-consistency. Unknown fields, language variants, blank nodes, named graphs, sibling events, recurrence, alarms and timezone definitions survive supported edits. Unsupported structured replacements fail. Native RDF updates/deletes require ETags; deletion refuses shared documents. Freshly fetched source provenance wins over stale caller metadata.

NextGraph still stores complete versioned documents in a private Automerge document with a durable IndexedDB recovery journal. The calendar shapes are not yet a native NextGraph graph binding. Pinned `@ng-org/shex-orm` 0.1.2-alpha.12 rejects `xsd:string OR rdf:langString` because both map to TypeScript strings. Resolve that compiler issue and lexical date preservation rather than narrowing the shape and losing data. Atomic vocabulary definitions are proposed, not installed on a live server.

## Consumer rollout

All following runtime-update PRs were merged after green checks. They pin core preview 9 plus widget preview 10, retaining existing module bundles. Updating the runtime is not completion of every domain's interoperability migration.

| App | Merged PR |
| --- | --- |
| Sharesome | [5](https://github.com/pondersource/sharesome/pull/5) |
| Webmarks | [5](https://github.com/pondersource/webmarks/pull/5) |
| Inspektor | [4](https://github.com/pondersource/inspektor/pull/4) |
| Savr | [4](https://github.com/pondersource/savr/pull/4) |
| Marco | [4](https://github.com/pondersource/marco/pull/4), deployment follow-up [5](https://github.com/pondersource/marco/pull/5) |
| Litewrite | [10](https://github.com/pondersource/litewrite/pull/10) |
| Inbox RS | [9](https://github.com/pondersource/inbox-rs/pull/9) |
| Umai | [9](https://github.com/pondersource/umai/pull/9) |
| Media Kraken | [9](https://github.com/pondersource/media-kraken/pull/9) |
| Focus | [3](https://github.com/pondersource/solid-focus/pull/3) |
| Todonna | [5](https://github.com/pondersource/todonna/pull/5) |
| Hyperdraft | [16](https://github.com/pondersource/hyperdraft/pull/16) |
| Solid Memo | [10](https://github.com/pondersource/solid-memo/pull/10) |

Launcher and eleven public apps were checked against the final runtime. Hyperdraft's runtime is under `/en/write/`, not its marketing landing page. Public Focus additionally passed real CSS/private-write/fresh-browser acceptance. Todonna and Solid Memo are the two deployment exceptions below.

### Solid Memo: deployment incomplete

Source PR 10 merged as `05c8277d8bf79b79d1b8fec16a5122d47bf58028`; local branch `chore/storage-wallet-preview9` at `fcc97506943bcb57ed33946b8a61ed5bd5d9edd9` is pushed. Full local `npm run check` and source CI passed.

Manual [deployment 45440624444](https://github.com/pondersource/solid-memo/actions/runs/45440624444) became **cancelled** at 17:31 UTC on 24 November while the cold `npm run check` step was active. Job 138610563421 had a 42-minute timeout; decoded logs were unavailable through the connector. The later [successful run 45441683223](https://github.com/pondersource/solid-memo/actions/runs/45441683223) **skipped build, deploy and journeys**, so its green overall conclusion is not publication evidence. Public `storage/rs.js` and `storage/widget.js` still fail the final hashes (rechecked 25 November).

Inspect the cold-check failure before retrying. Do not bypass checks, reuse unverified artifacts or weaken the attestation chain. Manual production builds set `SOLID_CLIENT=solid-memo-client` and `VITE_REPO_URL=https://github.com/pondersource/solid-memo`; an ordinary CI site artifact may not have those flags. The workflow's automatic route verifies attested artifacts. Preserve both paths' guarantees. Read `AGENTS.md` and installed Turbo docs before changing tasks/configuration. Standalone local `npm run library:check` also completed successfully for 260 versions of 115 decks.

### Todonna: Pages administrative blocker

GitHub repo is public and contains its GitLab history/upstream attribution. Source branch `chore/storage-wallet-preview9` at `a96fd01fee1d26206d3a01ab1e52f31399a86e15` is pushed; PR 5 merged as `4c583a34da7aa8abdeb076072b15f4117fb76349`.

GET Pages still returns 404 (25 November). The integration's enablement request previously returned 403. At [Settings → Pages](https://github.com/pondersource/todonna/settings/pages), select Source **GitHub Actions** using an owner/admin account. Making the repository public did not enable Pages. `actions/configure-pages` enablement needs administration permission beyond the ordinary workflow token; don't add repeated automatic settings mutation as a workaround. After enablement, rerun the workflow, verify the GitHub preview, then change the existing domain. Keep current GitLab DNS/hosting until then.

## Tests actually completed

These are the final implementation checks from 24 November, not a claim of a fresh full-suite rerun on 25 November. Current PR merge states and the two deployment blockers were rechecked during handoff.

| Check | Result |
| --- | --- |
| rs.js Mocha | 754 passing; legacy suites, lint/types and all three builds also passed |
| Widget Chromium | 16 passing; production build and producer CI passed |
| Calendar independent validators/codecs/CRUD | 15 passing |
| rs module suite | 39 passing |
| Actual Chromium module contract | 1 passing |
| Launcher/app-directory browser cases | 30 passing |
| Pinned SDK strict-CSP default/custom simulated-wallet and drift checks | 3 passing |
| Actual native-engine recovery checks | 3 passing |
| Latest public Focus acceptance | 3 passing |

Calendar tests include independent AJV/ShEx validation and native Atomic meta-schema facts. Producer checks and app CI must stay distinct from live wallet/provider acceptance.

## Tests requiring Michiel / real services

- NextGraph: actual native wallet consent with default and custom server; explicit first guest export/import; two devices via broker; concurrent offline edits, reconnection, reload and conflict recovery. Current automated wallet channel tests use a simulated wallet.
- OneDrive: real personal Microsoft login, create/read/update/delete, competing writes and native concurrent edits, interrupted writes, reconnect/account switching and offline recovery. Confirm production callbacks before app sign-in.
- Atomic: real vocabulary installation and calendar round trips; browser account creation/production-host acceptance is still incomplete. The passing plugin fixture is not certification of unpatched hosts.
- Continue upstream-app create → module read/edit → upstream-app read acceptance, preserving unknown data/history. The optional domain bundle is not universally adopted.

Public Microsoft SPA client ID: `580dcb92-f05e-4ec9-ac33-48f005b8bd01`. Only confirmed registered redirect: `http://localhost:8765/onedrive-test.html`; no secret needed. See [production callback list](onedrive-production-callbacks.md). The current localhost ZIP preserves this exact URL.

## Upstream review status

- [rs.js Solid PR 1403](https://github.com/remotestorage/remotestorage.js/pull/1403): open; fixes pushed at `f2e11650ade5832374b6dc3cdbf0dec03fb28dd9` (`review/solid-silverbucket` locally). Silverbucket's requested changes have replies/fixes but await reviewer confirmation. [Raucao was told more time is fine](https://github.com/remotestorage/remotestorage.js/pull/1403#issuecomment-7098709707); [Doug was thanked after the fixes](https://github.com/remotestorage/remotestorage.js/pull/1403#issuecomment-7098817048). Keep the narrower upstream stack separate from fork distribution features.
- [Upstream widget PR 136](https://github.com/remotestorage/remotestorage-widget/pull/136): open at `ec454a941bd48993eebec4e250ca1c7d4690e875`; review required. [Readiness comment](https://github.com/remotestorage/remotestorage-widget/pull/136#issuecomment-7099035826) explicitly says merge is blocked on rs.js 1403 approval/merge.
- [Upstream OneDrive PR 1435](https://github.com/remotestorage/remotestorage.js/pull/1435): closed with a link to the preserved [fork PR 7](https://github.com/pondersource/remotestorage.js/pull/7), merged into `review/onedrive-upstream-base`. The copied draft uses native bytes/deferred commit; the deployed app-folder prototype uses a JSON envelope. Do not mechanically combine these incompatible layouts. Test-drive in fork before a new upstream PR.
- [AtomicServer PR 2645](https://github.com/ontola/atomic-server/pull/2645): open **draft**, pushed at `eac358358d2e565867c5bc8a416e4a5840551e08`, branch `fix/remotestorage-conditional-writes`. Conditional check and write are serialized under the host DB lock; rs.js cannot enforce this across clients against a server without atomic preconditions. Keep separate from the native-SDK design discussion. Actual plugin route/DB tests and staged-snapshot Clippy passed; see [concurrency audit](backend-concurrency-audit.md).
- Older fork rs.js PRs 5/6 remain open on their older baselines. Review/reconcile with the integrated distribution before any merge; don't merge duplicate stacks blindly.

## Workspace preservation and portable recovery

Canonical local checkouts: `/workspace/remotestorage-wallet-server`, `/workspace/widget-wallet-server`, `/workspace/data-modules`, `/workspace/pondersource.com`. Clone the GitHub sources/revisions above if the workspace is replaced; required source work is not only local.

Generated core `release/` files and widget `build/` outputs are intentionally dirty/uncommitted in producer worktrees. Do not stage them as new source. The reviewed consumer repos commit their preview tarballs/vendor files and lockfiles; those are intentional. Other old worktrees also contain generated outputs and browser test results. An untracked JSON helper and Atomic fixture/config/test in old scratch worktrees were byte-compared with tracked canonical files and are duplicates, not missing source commits.

`/workspace/atomic-server` has two local runtime-file changes (`browser/data-browser/src/chunks/Website/runtime/search-view.html` and `website-runtime.min.js`) outside the conditional-write commit. Their ownership is not established; preserved untouched, not included in this handoff commit. Do not discard or stage them automatically. Preserve private local Atomic fixture state; never commit agent keys, account state or tokens.

Local final artifacts: `/workspace/storage-preview-packages-v10/` contains `handoff.json`, `verification-summary.json`, public verification reports, immutable tarballs and the good mobile screenshot. `/workspace/onedrive-test-preview10.zip` is the local Microsoft test package. These files are not all uploaded as standalone releases; reconstruct from pinned source/consumer archives if a fresh worker has a different filesystem. Retain older version directories unchanged.

| Artifact | SHA-256 |
| --- | --- |
| Core `remotestoragejs-2.0.0-beta.10-pondersource.9-preview.9.tgz` | `60ae5c01cf5bedf51651f5e0743cc5399b3ea32fdbbdd52a228b3532833902a8` |
| Widget `remotestorage-widget-1.8.2-pondersource.5-preview.10.tgz` | `653c25a10b79190b936649f07f6b6c71c1f44cddf1ba9441c66e3eec215ab0f6` |
| Calendar `pondersource-calendar-0.1.1.tgz` | `bb323cf66274cb5e4622091237b8660015dd35c682d876d0d8500cc1bbe614a1` |
| `onedrive-test-preview10.zip` | `32de7166b09e75cb111a624b06fd0917f9f73bfbfa5cfbe318e6625a18d3504c` |

Expected live runtime hashes: core `88de6672376fc2d5a38cdd2ba0320c095e0d7987e35ad5d7e6fbb996a68b3065`; widget `75eff3c1342f85ca178d3ff34bcd55c1b10d93826f32ed6f1c2d81fc34726c45`.

Local logs remain under `/tmp`: `rs-wallet-mocha.log`, `widget-wallet-tests.log`, `calendar-tests.log`, `calendar-rsmodules.log`, `calendar-rsbrowser.log`, `launcher-wallet-tests.log`, `rs-wallet-native.log`, `focus-wallet-public-acceptance.log`, `memo-wallet-check.log`. These are convenience evidence, not durable release storage. The source PRs and workflows are the portable review trail.

Further existing docs: [storage architecture](storage-backends-and-modules.md), [connection/sync design](atomic-nextgraph-design.md), [app checks](storage-app-preview-checks.md), [concurrency audit](backend-concurrency-audit.md), [additional app research](additional-app-research.md).
