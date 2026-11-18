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
| Media Kraken | [fork](https://github.com/pondersource/media-kraken) | Production Playwright under validation; existing Cypress passes; publication gated on both | Soukai runtime; movies reader fixes merged [PR 4](https://github.com/pondersource/data-modules/pull/4) |
| Penny | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Umai | [fork](https://github.com/pondersource/umai) | Development + production Playwright passed; [PR 1](https://github.com/pondersource/umai/pull/1) merged; Pages configuration returns HTTP 404 ([probe](https://github.com/pondersource/umai/pull/2)) | Soukai runtime; shared recipes parser checked in acceptance |
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
| SolidFocus | Not yet forked | [Upstream source](https://github.com/NoelDeMartin/solid-focus) inspected; next candidate | Task Action/Vtodo reader merged [PR 5](https://github.com/pondersource/data-modules/pull/5); lists/workspaces/history/writes pending |
| Portable LibreChat | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Proxion | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| Tired Bike | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| PodCal | Not yet forked | Not yet tested; not classified broken | Not yet audited |
| SolidOS Databrowser / Mashlib | Not yet forked | [Upstream source](https://github.com/SolidOS/mashlib) inspected; next candidate | Pane conventions corrections [PR 1](https://github.com/pondersource/conventions/pull/1) |
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

## Current access blockers

The connected GitHub API can update existing repositories and run PR checks, but exposes no repository-fork operation. Shell requests to api.github.com fail to connect in the current environment. No browser-control tool is currently available. This blocks creation of the remaining forks, not source inspection or work on existing forks. Do not mark those apps postponed as broken merely because repository creation is blocked.

Umai's Pages API returned HTTP 404 under an Actions token granted pages:read; its production artifact and both browser modes have passed. Repository Pages setup is therefore a concrete publication blocker. The available connector cannot configure Pages. Other new Pages sites and custom-domain DNS may also need configuration beyond the available connector. A successful artifact build is not a verified deployment. Keep unverified URLs out of the launcher.

## Initial source findings

- SolidFocus 0.3.3 uses Vue, Aerogel and Soukai; it already has task UI Cypress scenarios. Its modern dependency stack differs from our older Umai and Media Kraken forks.
- Mashlib 3.1.0 delegates app-specific work to solid-panes and separate pane packages. Its root test script only echoes a message, so it needs meaningful browser coverage.
- Umai's accepted recipe schema and Media Kraken's movie/watch-action schema should be tested through shared module readers before attempting write-path replacements.
