# Solid app rollout

Last checked: 2026-11-18. Source catalog: https://solidproject.org/apps (37 entries). This tracks the listed apps, not every historical Solid project. The chess app [pheyvaer/solid-chess](https://github.com/pheyvaer/solid-chess) is an additional candidate outside this catalog.

## Completion criteria

For each app:
1. Verify source availability, licence and a useful user-visible operation backed by a Pod.
2. Fork into Ponder Source and deploy an identifiable revision.
3. Add Playwright for real Solid login, a useful create/update/read operation, remote-write verification and recovery in a clean browser context. Check unauthorised access where the data should be private. Mocked login and local-only persistence are insufficient.
4. Use an existing suitable Solid Data Module or remoteStorage module, preserving fields, RDF term kinds, relations, document boundaries and discovery. Record partial coverage honestly.
5. Evaluate the pinned rs.js Solid backend. Its presence alone does not translate a native RDF model into remoteStorage JSON. Keep native RDF where the current backend cannot preserve it.
6. List in the launcher only after the deployment and meaningful behaviour have been verified.

An app may be postponed for an evidenced blocker: unavailable source, unsuitable licence, abandoned dependencies, a broken auth/data path, no useful Pod behaviour, or being a tool rather than an end-user app. Record what was attempted and the error; “not yet tested” is not “broken”.

New module **names and scopes require Michiel's sign-off**. No new module is authorised by this inventory. Solid Memo and lws-fuse remain with their separate worker.

## Inventory

| App | Fork | Deployment / test evidence | Module status |
| --- | --- | --- | --- |
| ODI Solid File Manager | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Media Kraken | [fork](https://github.com/pondersource/media-kraken) | [Live HTTPS](https://media-kraken.pondersource.com); [deployment](https://github.com/pondersource/media-kraken/actions/runs/44319324812) at `7cac12414372444a44e6ac1bc740fbb4024ae055`. Deployed-origin Playwright passed: real login, private movie writes, anonymous denial, fresh-browser watched/watch-later recovery, direct route, assets and service-worker scope. [PR 2](https://github.com/pondersource/media-kraken/pull/2) adds continuing live checks and custom-domain caching | Soukai runtime; movies reader fixes merged [PR 4](https://github.com/pondersource/data-modules/pull/4), test-only interpretation |
| Penny | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Umai | [fork](https://github.com/pondersource/umai) | [Live HTTPS](https://umai.pondersource.com); [deployment](https://github.com/pondersource/umai/actions/runs/44319318256) at `4d6674ec92da70c253c3ca0eb9196121fe6f2809`. Deployed-origin Playwright passed: real login, private recipe write, anonymous denial, fresh-browser recovery, recipe reload, assets and production client ID/redirect URI. [PR 3](https://github.com/pondersource/umai/pull/3) adds continuing live checks | Soukai runtime; shared recipes parser checked in acceptance, not a runtime migration |
| 0data Hello with Solid | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Booklice | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Mnera.io | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| dokieli | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Pod Pro | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| PodOS Browser | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Solid File Manager (Otto AA) | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Solidflix | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| NotePod (ANU) | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| HealthPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| MovieStar | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| SolidFocus | [fork](https://github.com/pondersource/solid-focus) | Fork created 2026-11-18; not yet deployed or browser-tested; next candidate | Task Action/Vtodo reader merged [PR 5](https://github.com/pondersource/data-modules/pull/5); lists/workspaces/history/writes pending. Existing SolidOS writer fixes merged [PR 6](https://github.com/pondersource/data-modules/pull/6) |
| Portable LibreChat | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Proxion | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Tired Bike | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| PodCal | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| SolidOS Databrowser / Mashlib | [fork](https://github.com/pondersource/mashlib) | Fork created 2026-11-18; standalone `dist/browse.html` remains an app candidate; not yet deployed or browser-tested | Pane conventions corrections [PR 1](https://github.com/pondersource/conventions/pull/1); [upstream PR 34](https://github.com/pdsinterop/conventions/pull/34) submitted |
| Synara AI | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Pod Drive | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Pod Resume | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| HomeVault | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| VitalStats | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| InnerPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| MSFatigue | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| FilePod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| KeyPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| GeoPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| SecureDialog | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| TodoPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| RoloPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| KonaPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| BilliPod | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Solid Memo | [fork](https://github.com/pondersource/solid-memo) | [Live deployment](https://solid-memo.pondersource.com); separate worker owns validation | Separate worker owns flashcards module integration |

## Publication and remaining work

The local GitHub account resolved the former Pages/fork access limitation on 2026-11-18. Both app repositories now use GitHub Actions Pages publishing with their own custom domains and enforced HTTPS. Existing DNS CNAMEs point to `pondersource.github.io`. The obsolete [Umai diagnostic PR 2](https://github.com/pondersource/umai/pull/2) is closed.

Live checks ran against the public HTTPS origins and disposable localhost Pods. Chromium's local-network permission is granted only to each tested origin; no personal account is involved. Browser checks cover private remote writes, shared-reader interpretation and recovery in fresh contexts. App source attribution is retained. Native Solid launcher entries use `data-storage-handoff="none"` so remoteStorage discovery hints are not sent to their login flows.

This does not complete the rollout. SolidFocus and Mashlib now have forks but still need meaningful browser coverage and deployments. The remaining catalog is untested, not classified as broken. Recipes and bookmark-topic PRs remain pending; the recipes parser is private/read-only, and the bookmark API still needs a term-kind-preserving round-trip review before using it for runtime migrations. No npm packages were published. Solid Memo and LWS remain with their separate worker.

## Initial source findings

- SolidFocus 0.3.3 uses Vue, Aerogel and Soukai; it already has task UI Cypress scenarios. Its modern dependency stack differs from our older Umai and Media Kraken forks.
- Mashlib 3.1.0 delegates app-specific work to solid-panes and separate pane packages. Its root test script only echoes a message, so it needs meaningful browser coverage.
- Umai's accepted recipe schema and Media Kraken's movie/watch-action schema should be tested through shared module readers before attempting write-path replacements.
