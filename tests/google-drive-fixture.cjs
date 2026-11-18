// Provider responses only: the browser runs the production rs.js Google backend.
module.exports = async function googleDriveFixture(context) {
  const files = new Map();
  let serial = 0;
  let revision = 0;
  const fixture = { files, writes: 0, invalidReads: 0 };
  const folderType = 'application/vnd.google-apps.folder';
  const metadata = file => ({ ...file, etag: '"' + file.revision + '"', labels: { trashed: false },
    ...(file.mimeType === folderType ? {} : { fileSize: String(Buffer.byteLength(file.body || '')), downloadUrl: 'https://www.googleapis.com/test-media/' + file.id }) });
  await context.route('https://accounts.google.com/**', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: 302, headers: { location: url.searchParams.get('redirect_uri') + '#access_token=google-fixture-token&token_type=bearer' } });
  });
  await context.route('https://www.googleapis.com/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const verb = request.method();
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type,if-match,if-none-match',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Location,ETag' };
    const reply = (body, status = 200, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, json: body });
    if (verb === 'OPTIONS') return reply({});
    if (url.pathname === '/drive/v2/about') return reply({ user: { emailAddress: 'google-fixture@example.com' } });
    if (url.pathname === '/drive/v3/changes/startPageToken') return reply({ startPageToken: String(revision) });
    if (url.pathname === '/drive/v3/changes') return reply({ newStartPageToken: String(revision), changes: Number(url.searchParams.get('pageToken')) < revision ? [{ fileId: 'changed' }] : [] });
    if (url.pathname === '/drive/v2/files' && verb === 'GET') {
      const parent = /^'([^']+)' in parents/.exec(url.searchParams.get('q'))?.[1];
      return reply({ items: [...files.values()].filter(f => f.parents?.some(p => p.id === parent)).map(metadata) });
    }
    if (url.pathname === '/drive/v2/files' && verb === 'POST') {
      const file = { ...request.postDataJSON(), id: 'file-' + ++serial, revision: ++revision };
      files.set(file.id, file);
      return reply(metadata(file));
    }
    if (url.pathname.startsWith('/upload/drive/v2/files')) {
      const existing = url.pathname.split('/')[5];
      const data = request.postDataJSON();
      const file = existing ? { ...files.get(existing), ...data } : { ...data, id: 'file-' + ++serial };
      files.set(file.id, file);
      return reply({}, 200, { Location: 'https://www.googleapis.com/test-upload/' + file.id });
    }
    if (url.pathname.startsWith('/test-upload/')) {
      const file = files.get(url.pathname.split('/')[2]);
      file.body = request.postData(); file.revision = ++revision; fixture.writes++;
      return reply(metadata(file));
    }
    if (url.pathname.startsWith('/test-media/')) {
      const file = files.get(url.pathname.split('/')[2]);
      return route.fulfill({ status: 200, headers, contentType: file.mimeType, body: file.body });
    }
    if (url.pathname.startsWith('/drive/v2/files/')) {
      const file = files.get(url.pathname.split('/')[4]);
      if (!file) fixture.invalidReads++;
      return reply(file ? metadata(file) : { error: 'not found' }, file ? 200 : 404);
    }
    throw new Error('Unexpected Google request: ' + verb + ' ' + url.pathname);
  });
  return fixture;
};
