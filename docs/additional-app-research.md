# Additional app research

Checked 2026-11-20. These are candidates, not new deployed launcher entries.
Discovery sources: [unhosted.org](https://unhosted.org/apps/),
[Solid Project](https://solidproject.org/apps), [Zero Data App](https://0data.app/en/glance),
and the [Doorless App Ring](https://ring.0data.app/).

## Sources inspected locally

| Candidate | Upstream and inspected revision | Findings and next work |
| --- | --- | --- |
| ODI Solid File Manager | [solid-contrib/solid-file-manager](https://github.com/solid-contrib/solid-file-manager), `022222ab68730b3d714e053755cf405d49af6c29` | Solid catalog's `solid/solid-file-manager` link redirects here. MIT and Apache license files. Prioritize after a generic files/inspection module preserves metadata, permissions and container operations; a JSON-only file browser is insufficient. Not yet built or tested. |
| Grouptabs | [xMartin/grouptabs](https://github.com/xMartin/grouptabs), `e190265ea3694eebe324640433365e9a55a9353c` | GPL-3.0 source. Current branch uses React/Redux and PouchDB/CouchDB, despite the historical unhosted listing. A new expenses module would have to retain transactions, participants, amounts/currencies and revision/conflict behavior. It is not a drop-in rs.js/widget upgrade. Not yet built or tested. |
| Kommit | [rosano/kommit](https://github.com/rosano/kommit), `40f4f5daa2f9e5faaa0cc95070394d31ed0f098a` | Zero Data Wrap schemas; existing scope is `kommit`. Useful cross-format flashcards target. Source includes Hippocratic License 2.1 rather than MIT/Apache; retain its terms and decide whether it fits the catalog before redistribution. Do not relabel it or copy its schemas into an MIT module without a licensing basis. Not yet built or tested. |
| Joybox | [rosano/joybox](https://github.com/rosano/joybox), `f7da7be7e397e8bf65b268646f88aca1c195772c` | Audiovisual bookmarks with Zero Data Wrap schemas. Same Hippocratic License 2.1 consideration. Useful reader-compatibility target for media/bookmarks, with format fixtures still to extract. Not yet built or tested. |

## Further shortlist from the catalogs

| App | Discovery source | Data/module question |
| --- | --- | --- |
| Pétrolette | Zero Data App | Feed subscriptions, read state and OPML; verify browser CORS/proxy needs and source license. |
| Emoji Log | Zero Data App | Personal events and attachments; separate journal/event scope only if existing schemas do not fit. |
| Diffuse | Zero Data App | Music library, playlist metadata and media access; preserve its existing supported-provider behavior. |
| Litespread | Zero Data App | Preserve original SQLite/CSV files as binary/text; avoid silently converting databases into JSON tables. |
| Taskrs | Zero Data App | Existing remoteStorage task format and CalDAV goals; add task-reader fixtures before combining with SolidOS/Vtodo. |
| PodOS Browser | Solid Project | Generic RDF/resource browsing and graph identity; may share inspection primitives, but has distinct UI/runtime. |
| NotePod / RoloPod / FilePod | Solid Project | Flutter web builds and encrypted storage. Extract format and key-handling contracts before promising interoperation. |
| dokieli | Solid Project | HTML+RDFa articles, annotations, provenance and publication; do not reduce documents to notes JSON. |
| gAuth | unhosted.org | OTP secret/key storage requires a deliberately separate credential module and a proven security design. |

Retain upstream links and license/source notices in each eventual fork. Forking
does not establish Pages readiness. Add a launcher entry after a reproducible
static build and browser create/edit/readback test have passed on the deployed
origin. Backend-specific requirements and unavailable source are recorded as
evidence; untested apps are not described as broken.

The existing [Solid rollout inventory](solid-app-rollout.md) remains the wider
list of Solid candidates. [Focus](https://focus.pondersource.com/) now has its Tasks module integration,
complete guest archives, green full CI, and actual public-origin browser
acceptance. Its launcher entry follows that verification. Mashlib retains its
separate module-integration and deployment work.
