# App preview checks

The initial `preview.4` rollout was checked on 2026-11-20 and merged after green
CI on 2026-11-23. Ten app Pages deployments and the launcher deployment passed.
Todonna's GitLab hosting stayed unchanged. Solid Memo retained its earlier
public deployment while an interrupted-upload failure was investigated.

The follow-up reviews add authenticated LWS discovery, consistent transport
readback, media-type comparison, durable cache commits and interrupted-write
recovery. The original app schemas, module paths and upstream pointers remain
recorded. No upstream npm release is included. Each preview archive records its
source revision, source digest and artifact hashes.

## App acceptance

| App | Validation | Limits |
| --- | --- | --- |
| Launcher | 26 staged browser checks and 14 discovery checks | The workflow builds pinned source, verifies vendored hashes and deploys those reviewed bytes. Deployment and public artifact verification are separate gates. |
| Litewrite | Production build, Standard lint, 6 browser journeys | Other providers still require live-account acceptance. |
| Inbox RS | Biome, production build, all 696 unit tests and 47 desktop/mobile/WebKit PWA checks | The storage bundle stays offline within the unchanged 2.25 MiB precache budget. Large unrelated optional chunks still fail the guard. |
| Hyperdraft | Rollup build and browser smoke checks | Existing accessibility warnings remain; full format acceptance is separate. |
| Sharesome | Production build, 8 QUnit tests | Public sharing depends on backend capabilities; OneDrive/NextGraph private records are not published. |
| Webmarks | Build, 15 QUnit tests | The optional cross-format domain bundle has not replaced its native JSON module. |
| Inspektor | Build, 24 QUnit tests | Wildcard inspection remains intentional. |
| Savr | TypeScript/build, 472 Jest tests | The precache asset limit retains the storage bundle offline. |
| Marco | 428 browser tests through `pnpm test` | No release-only `pnpm build` is used. |
| Todonna | Build, 3 browser journeys including fresh-device edits/deletion | The GitHub mirror retains GitLab history and attribution; GitLab hosting remains unchanged. |
| Umai | Vite build, 28 tests on Node 16 and private Pod journeys | Other providers require live-account acceptance. |
| Media Kraken | Build, 6 tests on Node 14 and native-import/fresh-browser Pod journeys | Uses Dart Sass in place of obsolete node-sass. |
| Solid Memo | All 36 task checks, repository/lint/REUSE checks, build and 113 web tests with full coverage | The explicit native composition passes 60 original journeys. Separately, two default-widget journeys cover real LWS login, private persistence, anonymous denial and a fresh browser. Disposable registrations do not configure production issuers. |

Nine apps consume versioned package archives with lockfile integrity; three
consume static bundles with source/license/hash records. Installed or extracted
core bytes must match the shared artifact. The OneDrive test ZIP uses those same
core/widget bytes and the user's registered localhost callback.

## Provider and recovery evidence

### Preview 7

The next fork preview uses rs.js source `2517fe04` (merged in
[PR 11](https://github.com/pondersource/remotestorage.js/pull/11)) and widget
source `18a22cf7` (merged in
[PR 3](https://github.com/pondersource/remotestorage-widget/pull/3)). The core's
nine CI jobs passed, including actual NextGraph engine/journal recovery. Local
producer archives are byte-identical across two fresh output directories, and
all three core entry aliases contain the same reviewed all-backend bytes.
The previous preview archives remain unchanged.

The launcher now exports its actual local app-library document through the
widget's app-owned hooks. It requires a current export before Nextgraph can
redirect away from a guest library, validates imported documents, and merges
them using the existing per-app timestamp/removal rules. Local persistence
finishes before import succeeds; the message does not claim broker delivery.
The exact runtime passes 27 staged browser checks and 20 state/discovery checks.
The launcher is deployed; all six runtime artifacts and the launcher script
match the reviewed source. App publication is tracked separately.

An actual pinned Atomic plugin host passed native installation review, app
consent, exact scoped JSON/MIME and binary storage, anonymous/scope denial,
provider-outage/reload recovery, fresh-browser readback, and concurrent writes
yielding one success and one 412. Its disposable account was bootstrapped with
the native Rust API; browser new-account genesis onboarding remains broken at
that host revision. The recorded run used the prior core preview bytes; see
[the acceptance fixture](https://github.com/pondersource/remotestorage.js/pull/12)
for precise source/runtime bindings. No server deployment is certified.


### Consumer rollout after preview 7

All twelve existing app fork PRs merged after green CI. Eight package consumers
and Marco use immutable archives with lockfile integrity; Umai, Media Kraken
and SolidMemo use equivalent vendored browser artifacts.

| App | Source update |
| --- | --- |
| Litewrite | [PR 9](https://github.com/pondersource/litewrite/pull/9) |
| Inbox RS | [PR 8](https://github.com/pondersource/inbox-rs/pull/8) |
| Hyperdraft | [PR 14](https://github.com/pondersource/hyperdraft/pull/14) |
| Sharesome | [PR 3](https://github.com/pondersource/sharesome/pull/3) |
| Webmarks | [PR 4](https://github.com/pondersource/webmarks/pull/4) |
| Inspektor | [PR 3](https://github.com/pondersource/inspektor/pull/3) |
| Savr | [PR 3](https://github.com/pondersource/savr/pull/3) |
| Marco | [PR 3](https://github.com/pondersource/marco/pull/3) |
| Todonna | [PR 4](https://github.com/pondersource/todonna/pull/4) |
| Umai | [PR 7](https://github.com/pondersource/umai/pull/7) |
| Media Kraken | [PR 7](https://github.com/pondersource/media-kraken/pull/7) |
| SolidMemo | [PR 9](https://github.com/pondersource/solid-memo/pull/9) |

Published runtime markers are verified for Litewrite, Inbox, Hyperdraft,
Sharesome, Webmarks, Inspektor, Savr and Marco. Umai and Media Kraken passed
publication and live Pod journeys; their public core/widget files match the
producer hashes. Todonna needs Pages enabled by its owner before its GitHub
preview can be tested and its existing domain moved. SolidMemo's deployment
workflow skips untagged pushes; its supported manual fork deployment is running.
A green workflow whose deployment job was skipped is not publication evidence.

The Pages handoff fixes are [Sharesome 4](https://github.com/pondersource/sharesome/pull/4),
[Hyperdraft 15](https://github.com/pondersource/hyperdraft/pull/15),
[Umai 8](https://github.com/pondersource/umai/pull/8) and
[Media Kraken 8](https://github.com/pondersource/media-kraken/pull/8).
They complete upload before a separate deployment job and pass the exact
attempt-specific artifact name, avoiding ambiguous artifacts on reruns.

Production Microsoft callbacks are listed in
[OneDrive SPA callbacks](onedrive-production-callbacks.md). Registration and
signed-in Graph acceptance remain pending. The updated localhost test archive
uses the same preview 7 core/widget bytes and retains the confirmed callback.

### Native formats and hosting follow-up

[Data modules PR 10](https://github.com/pondersource/data-modules/pull/10) merged
after green CI. Native-aware apps can keep original Solid document URLs while
also discovering retained remoteStorage adapter records. Native mode is an
internal integration option; other consumers retain their previous behavior.
The module owns the SolidFocus schemas and Soukai operations, including task
history, lists and workspaces. SolidMemo's exact candidate passed actual CSS
native-format and widget/fresh-browser/publishing journeys; SolidFocus's exact
candidate passed guest persistence and native task edit/fresh-browser journeys.
Focus [PR 2](https://github.com/pondersource/solid-focus/pull/2) is merged and
deployed at [focus.pondersource.com](https://focus.pondersource.com/). All three
journeys also pass on that public origin, including native Solid edits and a
fresh signed-in browser. Public core, widget and domains hashes match the
reviewed artifacts exactly. Its full CI includes 42 Cypress tests and six
unit/native-format tests. SolidMemo's native integration is merged; its fork
manual publication is still running and must be checked separately.

[Todonna PR 3](https://github.com/pondersource/todonna/pull/3) merged after its
build and browser checks passed, including the `/todonna/` project path. The
repository is now public. Pages is still disabled: the integration receives
HTTP 403 when enabling it. Settings → Pages must select GitHub Actions before
the prepared workflow can deploy. Verify the GitHub project preview before
moving the custom domain; its existing GitLab DNS remains unchanged.

The merged [rs.js #9](https://github.com/pondersource/remotestorage.js/pull/9)
fixes canonical protected-resource metadata discovery for public LWS roots,
index discovery when container listings report generic MIME, and JSON text
readback through LWS, OneDrive, NextGraph, Dropbox and Google Drive. The module
object API still parses JSON. Semantic media-type comparison accepts legal
normalization without equating different bytes or meaningful parameter values.

The explicitly patched Java LWS fixture passes 714 Maven tests, including 17
provider regressions, plus actual SDK CRUD/concurrent-write and browser checks.
Its source patch and licensing are retained in the Ponder Source SDK fork.
Unmodified upstream and raw LWSD concurrency failures are not certified by those
results. See the [concurrency audit](backend-concurrency-audit.md).

Solid Memo's upload/reload failure was reproduced on CSS 7.3.0's default file
accessor: an incomplete replacement could truncate the original document. Its
reference fixture now uses CSS's supported `AtomicFileDataAccessor`, which
receives the body in a temporary file before rename. Controlled tests preserve
body, metadata and ETag after an aborted request. This proves incomplete-upload
safety for that fixture, not a body-and-metadata transaction across every crash.
The default file accessor is not certified safe.

The frozen recovery source also passes 738 Mocha tests, legacy suites,
source/spec lint, all production builds, 11 actual recovery browser scenarios,
five native IndexedDB durability/lock cases, SDK/CSP/startup checks and the
patched Java provider's CRUD/concurrency and all 11 browser cases. The app's
original and controlled upload/reload journeys keep their original assertions.
CI and the exact committed source remain the merge gates.

The `preview.6` source is
`27fda517eceda07c3a2df085a129ddd531272993` in
[rs.js #10](https://github.com/pondersource/remotestorage.js/pull/10), with core
SHA-256 `9e3d17d894765cb9eca44264ee700b8182f06f50a80139f19ca0599e178762db`.
The widget source remains `045c78cd752593e58fffed7386ddcbb4ba74dd2e`, with SHA-256
`7a070705f828684e16de500610ed8874c1c8943e8416e87babb7b6a810340bb6`.
Final archives are handed off only after all required producer CI passes.
Individual review links track consumer merges and deployment outcomes.

## Remaining acceptance limits

- Signed-in OneDrive, including final-commit concurrency, is pending. Production
  app callbacks must be added to the same personal-account registration.
- Production LWS issuers, clients and callbacks need their own configuration
  and acceptance; the CSS test registrations are disposable local fixtures.
- AtomicServer's conditional-write improvement remains a separate draft. The
  actual pinned host/plugin passed native consent and storage acceptance with
  a disposable Rust-bootstrapped account; new-account browser genesis and
  production deployment remain unverified. Native SDK use is a separate option.
- NextGraph SDK/CSP/startup tests include a simulated wallet channel and actual
  native-engine/journal recovery. Real wallet consent and two-device broker
  divergence and delivery remain pending.
- Complete cross-app format interoperability and consumer adoption of the new
  optional domains bundle remain unfinished. The native document-URL view is
  explicit; it does not silently migrate existing JSON-adapter records.

## Initial preview review links

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

## App dependency follow-ups

- [Launcher #28](https://github.com/pondersource/pondersource.com/pull/28)
- [Inbox RS #7](https://github.com/pondersource/inbox-rs/pull/7)
- [Solid Memo #6](https://github.com/pondersource/solid-memo/pull/6)
- [Litewrite #8](https://github.com/pondersource/litewrite/pull/8)
- [Hyperdraft #13](https://github.com/pondersource/hyperdraft/pull/13)
- [Sharesome #2](https://github.com/pondersource/sharesome/pull/2)
- [Webmarks #3](https://github.com/pondersource/webmarks/pull/3)
- [Inspektor #2](https://github.com/pondersource/inspektor/pull/2)
- [Savr #2](https://github.com/pondersource/savr/pull/2)
- [Marco #2](https://github.com/pondersource/marco/pull/2)
- [Todonna #2](https://github.com/pondersource/todonna/pull/2)
- [Umai #6](https://github.com/pondersource/umai/pull/6)
- [Media Kraken #5](https://github.com/pondersource/media-kraken/pull/5)

## Fork and upstream boundaries

Core and widget changes live on the Ponder Source `distribution` branches.
Their upstream-review `master` branches retain the narrower Solid changes.
The copied OneDrive implementation merged into a separate review baseline with
Node 22/24/26 CI; it does not replace the incompatible MSAL/app-folder prototype.

Fork module builds and docs checks run, while npm publication and documentation
Pages deployment require the canonical upstream repository. Upstream Solid
#1403, widget #136 and AtomicServer #2645 remain open. Conflicting older
bookmark/widget reviews and the failing older LWS core review remain unmerged.


The launcher deploys the verified vendored preview bytes and public
`storage-preview.json`, rather than substituting a fresh bundle during staging.
Webpack module IDs differed between a symlinked development dependency directory
and a clean CI installation, so rebuilding the same source did not preserve the
archive hash. Source builds remain checked; artifact hashes and source pins are
verified before the launcher browser tests and deployment.
