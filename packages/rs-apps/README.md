# PonderSource rs.js app support

Shared optional Solid connection controls and data-module adapters. The hosted
apps use the Solid-enabled rs.js build; Dropbox and Google Drive keep the existing
PonderSource OAuth registrations. No credentials are stored in this package.

`scopedModule` creates a named rs.js module with a limited set of bound client
methods and optional schemas. `inspectionModule` deliberately retains wildcard
inspection, with the root client kept private inside its builder. `withChanges`
and `withPublicLinks` extend existing modules without making callers open new
clients or send authenticated requests themselves.

All existing module paths and schemas remain compatible. Module boundaries do not
narrow a provider's OAuth grant: Google uses its Drive scope, Dropbox uses the
registered PonderSource app folder, and Solid uses the selected pod and its access
controls. A public link request for a public-scope file grants read-only access;
private links do not publish files. Google file links are not static website hosting.

Run the adapter tests with `node --test packages/rs-apps/test.cjs` from the site
repository. The Solid-enabled library is tested against Community Solid Server in
the launcher's publishing workflow.
