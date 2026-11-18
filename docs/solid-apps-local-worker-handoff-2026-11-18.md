# Solid apps — local worker handoff

Snapshot: 18 November 2026. Continue the existing rollout; do not restart discovery or redo passing changes.

## Goal and standing authorisation

Michiel has authorised forking, fixing, testing, merging and deploying the functional Solid apps in the Solid Project catalog, then listing working deployments on pondersource.com. Add Playwright coverage for real authentication and meaningful Pod data persistence, and use appropriate Solid Data Modules / remoteStorage modules and the rs.js Solid backend where they preserve the application's model.

Broken, disappeared or tool-only projects may be postponed after a concrete attempt; record the reason. Untested is not broken. **Ask Michiel to approve names/scopes before introducing new modules.** Existing module improvements are authorised. Do not ask again for approval to publish the already authorised apps.

Solid Memo / LWS work belongs to a separate worker. Coordinate rather than duplicating its changes. Another worker handles remoteStorage apps and may be editing the launcher. Preserve unrelated work.

## First priority: enable Pages and finish publication

The cloud worker could edit repositories and run Actions, but could not reach GitHub through its shell or use browser control. Its explicit Pages-enablement attempt with the built-in Actions token failed:
- GET /repos/pondersource/umai/pages: HTTP 404.
- POST /repos/pondersource/umai/pages, build_type=workflow: HTTP 403, "Resource not accessible by integration", despite pages:write.
- Evidence: https://github.com/pondersource/umai/actions/runs/44314251722
- Diagnostic PR (open draft): https://github.com/pondersource/umai/pull/2
- Its branch is pages-readiness, head 46389dc35ad463d53bdbc11009c4d268e909473d.

This is an access limitation, not a request for renewed authorisation. Use the local authenticated GitHub CLI or browser with repository administration access. Never copy tokens into the handoff or commit credentials.

Check current settings first; somebody may have fixed them since this snapshot:

```sh
gh auth status
gh api repos/pondersource/umai/pages
gh api repos/pondersource/media-kraken/pages
```

For a genuinely absent Pages site, create it with an appropriately authorised account:

```sh
gh api --method POST repos/pondersource/umai/pages -f build_type=workflow
gh api --method POST repos/pondersource/media-kraken/pages -f build_type=workflow
```

For an existing site using branch publishing, use PUT instead:

```sh
gh api --method PUT repos/pondersource/umai/pages -f build_type=workflow
gh api --method PUT repos/pondersource/media-kraken/pages -f build_type=workflow
```

Equivalent UI:
- https://github.com/pondersource/umai/settings/pages
- https://github.com/pondersource/media-kraken/settings/pages
- Select Source → GitHub Actions.

Check and configure DNS/custom domains through the normal Ponder Source setup. Targets are umai.pondersource.com and media-kraken.pondersource.com; do not assume DNS already exists. The build artifacts contain those CNAME values and are built for the custom-domain root, so a default /umai/ project URL is not an equivalent production deployment.

After confirming domain ownership/DNS, Pages custom-domain settings can be applied using the UI or authorised API:

```sh
gh api --method PUT repos/pondersource/umai/pages -f cname=umai.pondersource.com
gh api --method PUT repos/pondersource/media-kraken/pages -f cname=media-kraken.pondersource.com
```

Both merged workflows support manual dispatch:

```sh
gh workflow run solid-acceptance.yml --repo pondersource/umai --ref main
gh workflow run solid-acceptance.yml --repo pondersource/media-kraken --ref main
gh run list --repo pondersource/umai --workflow solid-acceptance.yml --limit 5
gh run list --repo pondersource/media-kraken --workflow solid-acceptance.yml --limit 5
# Watch each returned run:
gh run watch RUN_ID --repo pondersource/umai --exit-status
```

Verify the deploy job, HTTPS, root assets, deep links and Solid login at the real hostnames. Umai's /clientid.jsonld must name the production origin and redirect URI. Check service-worker scope and attribution. Extend/run deployed-origin Playwright where practical; local production tests alone do not prove live OAuth/DNS configuration.

Only then add the apps to the launcher. Use the current Solid-native app conventions in index.html; inspect the current launcher code before editing. Do not pass a remoteStorage discovery hint to a native Solid login flow. Once the administrative blocker is resolved, close the temporary diagnostic PR or remove it rather than merging automatic settings mutation into routine PR checks.

## Merged application work — keep these changes

| Repository | Merged PR / commit | Validation |
| --- | --- | --- |
| pondersource/umai | PR 1; merge 4d6674ec92da70c253c3ca0eb9196121fe6f2809 | Development and production Playwright, existing upstream CI and distribution build passed |
| pondersource/media-kraken | PR 1; merge 7cac12414372444a44e6ac1bc740fbb4024ae055 | Production Playwright, existing Cypress, shared-reader compilation/data assertions and distribution build passed |

Umai:
- https://github.com/pondersource/umai/pull/1
- Passing run: https://github.com/pondersource/umai/actions/runs/44308019952
- Workflow: .github/workflows/solid-acceptance.yml
- Tests: acceptance/recipe.spec.cjs and acceptance/playwright.config.cjs
- Same test runs against dev and production bundles. Registers a disposable CSS account; signs in through UI; imports a recipe; observes a successful Pod write; verifies anonymous denial; signs in from a clean browser context and reads the recipe, also through the shared recipes parser.
- Shared recipes source is pinned to data-modules commit 63d6ccaa822305573327552c0fb8e9d1ed2d14a3.
- Build uses VITE_APP_DOMAIN=https://umai.pondersource.com. Test production build uses localhost:5001.
- Runtime is still Soukai Solid, NOT a completed shared-module/rs.js migration.

Media Kraken:
- https://github.com/pondersource/media-kraken/pull/1
- Passing run: https://github.com/pondersource/media-kraken/actions/runs/44312525055
- Passing PR head: 2dc94c92b3cf70272c6b295e990a67fc217a11cc.
- Old application stack needs Node 14.15 (see .nvmrc). Playwright and shared module compile run under Node 22; the CSS subprocess retains the Node 14 path. Do not collapse these versions without testing a dependency upgrade.
- Tests: acceptance/movies.spec.cjs, acceptance/playwright.config.cjs, acceptance/css.json, acceptance/serve.cjs.
- Imports the upstream collection fixture through production UI; checks private writes and anonymous denial; recovers Symbol as watched and Jaws as watch-later in a fresh browser context.
- Independent RDF checks read the disposable CSS server's stored resources and use the pinned movies module to verify identities and WatchAction links. Chromium response-body captures were empty for successful cross-origin reads, so the test does not rely on those bodies.
- CSS config is upstream v4 default with ONLY the storage backend changed to files. Standard file.json requires setup and broke login; do not revert to it. Test data is under acceptance/.pod.
- CSS ExtensionBasedMapper stores extensionless Turtle resources with an internal $.ttl suffix. The test accounts for that.
- Shared movies reader is pinned to data-modules commit 49bbc7fb230936ec198a6cd19ca30566ed755809.
- Module compilation must isolate ambient types: --typeRoots ./node_modules/@types. Otherwise legacy app types leak into the nested module build.
- Production configuration supports VUE_APP_PUBLIC_PATH=/ and VUE_APP_BASE_URL=https://media-kraken.pondersource.com.
- Runtime remains Soukai Solid. No live deployment has yet been verified.

## Shared data modules

Repository: https://github.com/pondersource/data-modules
Upstream: https://github.com/solid-contrib/data-modules (cloud integration could not write upstream).

Merged:
1. PR 4, movies reader — merge 49bbc7fb230936ec198a6cd19ca30566ed755809.
   - Explicit ldp:contains traversal, deduplicated document fetches, optional fields, HTTP/shape errors, retained movie/action IDs and listingId declaration fix.
   - parseMovies accepts expanded JSON-LD arrays or @graph wrappers, NOT arbitrary compact JSON-LD or Turtle.
   - Accepts corrected IRIs and known legacy literal-valued links.
   - Five reader regressions + TypeScript passed.
   - https://github.com/pondersource/data-modules/pull/4
2. PR 5, SolidFocus task reader — merge a92c18610ad87a9f2f52732b7b45d95550e0060e.
   - Existing tasks module now reads Action/Vtodo dual typing, names/summary aliases, description, priority, due/completed dates and status.
   - Pure parseSchemaTasks reader; fetchContainer uses the mapping.
   - Removed static Node crypto import in favour of Web Crypto UUID generation.
   - Five regressions + TypeScript passed.
   - https://github.com/pondersource/data-modules/pull/5
3. PR 6, existing SolidOS task writers — merge 793054e300c93c566ac778b91cb80a70498240ae.
   - Escapes quoted/multiline text as RDF literals, validates interpolated IRIs, rejects failed HTTP writes.
   - Nine task tests passed: five readers plus four writer/RDF round-trip regressions.
   - https://github.com/pondersource/data-modules/pull/6

Earlier work still pending at the start of this handoff; inspect fresh PR state:
- PR 1 bookmark-topic-round-trip: multiple topics, including IRI/literal compatibility. Previous head 75c476f49d5f6bf578bc14a5a68792118e114951.
- PR 2 recipes-data-module: approved recipes scope, private/read-only initial parser; previous head 63d6ccaa822305573327552c0fb8e9d1ed2d14a3.
- PR 3 flashcards RDF schemas belongs to the separate Solid Memo worker.

Merged source changes are NOT an npm release. No package publishing was performed here. Inspect current package/registry versions and coordinate a release before consumers rely on new exports.

Runtime migration remains significant work:
- Movies module lacks writes, type-index discovery and migration.
- Recipes parser does not cover full discovery, writes, images, lists or Soukai history.
- SolidFocus task reader does not cover lists, workspaces, history or writes. Existing SolidOS issue writers are not SolidFocus Action writers.
- Preserve unknown triples, IDs, relations, term kinds, document boundaries and conflict/history behaviour. Prove round trips in both directions before replacing storage.

## rs.js Solid backend and launcher

The launcher already builds the Solid bundle from:
- Upstream PR: https://github.com/remotestorage/remotestorage.js/pull/1403
- Pinned commit: dab59c8a55b4542d359af64d4d130c3ade28e204
- Branch: feature/1309-solid_optional_bundle
- Main deployment workflow: .github/workflows/solid-launcher-preview.yml in pondersource/pondersource.com.

It stores the launcher's private remoteStorage-format JSON library on the selected Pod. This does not automatically translate an application's native RDF into a remoteStorage module. Do not replace Soukai with a JSON blob backend and claim RDF interoperability. Evaluate adapters and suitable existing modules case by case.

Coordinate launcher/LWS changes with the other worker. Read current main before editing; this handoff is not a lock on the repository.

## Remaining catalog and next forks

Authoritative rollout inventory (37 listed apps, 3 existing forks at the snapshot):
https://github.com/pondersource/pondersource.com/blob/main/docs/solid-app-rollout.md

Catalog source: https://solidproject.org/apps

Already forked: Umai, Media Kraken, Solid Memo. No new candidate forks were created in this cloud session because fork creation was unavailable.

Next:
- SolidFocus: https://github.com/NoelDeMartin/solid-focus
  - Inspected release 0.3.3, commit 53e6fddb0fec1e8cc9373b0106b138c99ae444a0.
  - Vue/Aerogel/Soukai; upstream CI uses pnpm 10 and .nvmrc. Existing Cypress task scenarios are useful starting points.
  - Current model is Schema.org Action + iCalendar Vtodo, not the old lifecycle:Task model.
- Mashlib / SolidOS Databrowser: https://github.com/SolidOS/mashlib
  - Inspected package 3.1.0. Standalone browser is dist/browse.html.
  - Delegates models to solid-panes and separate pane packages; root test script merely echoes a message.
  - Fork, build and add genuine pane editing/auth/persistence Playwright coverage; do not classify it as library-only merely because it is also distributed as a library.
- Chess outside the current catalog: https://github.com/pheyvaer/solid-chess
  - Pieter Heyvaert's app, MIT; correspondence via LDN inboxes and real-time WebRTC.
  - Inspect current authentication support before deciding whether to modernise or postpone.

Local CLI for new forks, after checking for existing repositories:
```sh
gh repo fork NoelDeMartin/solid-focus --org pondersource --clone=false
gh repo fork SolidOS/mashlib --org pondersource --clone=false
```

Other catalog candidates:
- Browsers/files: ODI Solid File Manager, Otto AA Solid File Manager, Penny, Pod Pro, PodOS Browser, Pod Drive, FilePod.
- Notes/tasks/publishing: NotePod (ANU), TodoPod, dokieli, 0data Hello.
- Bookmarks: Booklice, Mnera.io.
- Movies: Solidflix, MovieStar.
- Communication/scheduling: Portable LibreChat, Proxion, PodCal.
- Health: HealthPod, MSFatigue, SecureDialog, VitalStats, InnerPod.
- Other: Tired Bike, Synara AI, Pod Resume, HomeVault, KeyPod, GeoPod, RoloPod, KonaPod, BilliPod.

Resolve each upstream source and licence from primary sources; not every catalog entry necessarily exposes forkable source. Do not confuse ANU NotePod with Vincent Tunru's older Notepod. Mark a project postponed only with an evidenced reason.

## PDS Interop conventions

Our fork: https://github.com/pondersource/conventions
PR 1 merged at 6804bf87d1a2a6232c24cac86980fce93ddf8bee.
https://github.com/pondersource/conventions/pull/1

Corrected overview prefixes/Turtle, ShortChat type and message links, ordered meeting tool collections, notepad namespace/content/circular line ordering; expanded movies docs and replaced outdated SolidFocus observations. Added pinned source evidence and explicit coverage gaps.

Eleven reviewed RDF examples plus structural checks pass:
https://github.com/pondersource/conventions/actions/runs/44311262405

The changes are NOT yet submitted/merged upstream into pdsinterop/conventions; connector PR creation returned 403. The local worker should open the upstream PR from our fork. Preserve warnings that older unreviewed examples and many panes remain unaudited.

## Definition of done per app

- Fork in Ponder Source and identify the exact deployed revision.
- Verify useful Pod-backed behaviour through real authentication.
- Playwright covers a meaningful operation, successful remote writes, expected data shape, fresh-browser recovery and relevant anonymous-access denial.
- Verify live production origin, routing, client-ID/redirect configuration and service-worker scope.
- Record actual shared-module/backend usage; distinguish test-only interpretation from runtime integration.
- Add to pondersource.com only after live verification.
- Update the rollout inventory with evidence or a concrete postponement reason.

Do not claim that this whole rollout is complete. The immediate administrative blocker is Pages setup; the broader remaining work is new forks, verified deployments and runtime data-layer migrations.
