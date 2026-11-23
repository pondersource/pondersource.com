# OneDrive production SPA callbacks

Microsoft Entra application (client) ID:
`580dcb92-f05e-4ec9-ac33-48f005b8bd01`.
The registration supports personal Microsoft accounts. It is a public SPA;
no client secret is needed in the browser apps.

## Registration

Keep the existing confirmed test callback:

```text
http://localhost:8765/onedrive-test.html
```

Add these exact redirect URIs to the same application's **Single-page
application** platform in Entra → App registrations → Authentication. Keep the
trailing slash. The launcher and forks use the default rs.js OneDrive callback
`window.location.origin + '/'`, including from nested app routes.

```text
https://pondersource.com/
https://litewrite.pondersource.com/
https://inbox-rs.pondersource.com/
https://hyperdraft.pondersource.com/
https://sharesome.pondersource.com/
https://webmarks.pondersource.com/
https://todonna.pondersource.com/
https://inspektor.pondersource.com/
https://savr.pondersource.com/
https://marco.pondersource.com/
https://umai.pondersource.com/
https://media-kraken.pondersource.com/
https://solid-memo.pondersource.com/
https://focus.pondersource.com/
```

Focus is deployed at its listed origin. Todonna's production origin stays the
same when hosting moves from GitLab to GitHub Pages. Its interim GitHub project
preview is not a production OneDrive callback.

The same registration gives the apps the same OneDrive app folder;
remoteStorage modules retain their separate scope paths. Callback registration
does not prove consent, persistence or cross-app compatibility.

## Live acceptance still needed

After registering the callbacks, check Microsoft's actual personal-account
consent and Graph app-folder access with disposable records. Check JSON/MIME
and binary round trips, reload/reconnection, a fresh browser, independent
concurrent edits, deletion and disconnect. Retain an export before cleanup.

Check the launcher and one app first, then read an applicable shared module
record from another app using the same account. Import a complete local guest
archive explicitly when the app provides one; local import is not server
acknowledgment.

The localhost callback is owner-confirmed. Production registration and
signed-in Graph acceptance are unconfirmed. Do not store Microsoft tokens or
user data in this repository.
