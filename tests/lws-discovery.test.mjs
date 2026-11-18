import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverLWS } from '../assets/js/lws-discovery.mjs';

const storage = 'https://pods.example/alice';
const root = 'https://pods.example/alice/data/';
const file = root + 'notes';
const metadata = 'https://pods.example/.well-known/oauth-protected-resource/alice';
const server = 'https://login.example/tenant/';
const relation = 'https://www.w3.org/ns/lws#storage';
const description = { id: storage, type: ['Storage'], service: [{ type: 'StorageRoot', serviceEndpoint: root }] };
function response(body, status = 200, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}
function fixture(overrides = {}) {
  const calls = [];
  const routes = {
    [file]: () => response('', 401, {
      Link: '<https://irrelevant.example/a,b>; rel="other", <' + storage + '>; rel="alternate ' + relation + '"',
      'WWW-Authenticate': 'Bearer resource_metadata="' + metadata + '"'
    }),
    [storage]: () => response(description),
    [root]: () => response('', 401, { 'WWW-Authenticate': 'Bearer resource_metadata="' + metadata + '"' }),
    [metadata]: () => response({ resource: file, authorization_servers: [server] }),
    ...overrides
  };
  return { calls, fetch: async (url, options) => {
    calls.push({ url, options });
    assert.ok(routes[url], 'unexpected discovery request ' + url);
    return routes[url]();
  } };
}

test('discovers storage, root and a separate authorization server from a protected resource', async () => {
  const f = fixture();
  assert.deepEqual(await discoverLWS(file + '#card', f), {
    storage, root, authorizationServers: [server]
  });
  assert.equal(f.calls.length, 3);
  for (const { options } of f.calls) {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.headers.Authorization, undefined);
  }
});

test('accepts a directly supplied storage description and discovers auth from the root', async () => {
  const f = fixture({ [metadata]: () => response({ resource: root, authorization_servers: [server] }) });
  assert.equal((await discoverLWS(storage, f)).root, root);
});

test('reports public storage with no advertised authorization server', async () => {
  const f = fixture({ [root]: () => response({ items: [] }) });
  assert.deepEqual((await discoverLWS(storage, f)).authorizationServers, []);
});

test('rejects insecure remote URLs and credential-bearing URLs before fetching', async () => {
  const f = fixture();
  await assert.rejects(discoverLWS('http://pods.example/', f), /HTTPS/);
  await assert.rejects(discoverLWS('https://user:password@pods.example/', f), /username/);
  assert.equal(f.calls.length, 0);
});

test('rejects cross-origin storage links without following them', async () => {
  const f = fixture({ [file]: () => response('', 401, { Link: '<https://other.example/>; rel="' + relation + '"' }) });
  await assert.rejects(discoverLWS(file, f), /origin/);
  assert.equal(f.calls.length, 1);
});

test('rejects cross-origin roots and metadata endpoints', async () => {
  let f = fixture({ [storage]: () => response({ ...description, service: [{ type: 'StorageRoot', serviceEndpoint: 'https://other.example/' }] }) });
  await assert.rejects(discoverLWS(file, f), /origin/);
  f = fixture({ [file]: () => response('', 401, { Link: '<' + storage + '>; rel="' + relation + '"', 'WWW-Authenticate': 'Bearer resource_metadata="https://other.example/meta"' }) });
  await assert.rejects(discoverLWS(file, f), /origin/);
  assert.equal(f.calls.length, 2);
});

test('rejects metadata for a different resource', async () => {
  const f = fixture({ [metadata]: () => response({ resource: root, authorization_servers: [server] }) });
  await assert.rejects(discoverLWS(file, f), /different resource/);
});

test('rejects malformed descriptions, conflicting links and missing authorization metadata', async () => {
  let f = fixture({ [storage]: () => response({ ...description, id: root }) });
  await assert.rejects(discoverLWS(file, f), /invalid/);
  f = fixture({ [file]: () => response('', 401, { Link: '<' + storage + '>; rel="' + relation + '", <' + root + '>; rel="' + relation + '"' }) });
  await assert.rejects(discoverLWS(file, f), /conflicting/);
  f = fixture({ [metadata]: () => response({ resource: file, authorization_servers: [] }) });
  await assert.rejects(discoverLWS(file, f), /no authorization server/);
  f = fixture({ [file]: () => response('', 401) });
  await assert.rejects(discoverLWS(file, f), /Link header/);
});

test('supports localhost development and fails closed on refused documents', async () => {
  const local = 'http://127.0.0.1:3126/lws/';
  const fetch = async () => response({ id: local, type: 'Storage', service: [{ type: ['StorageRoot'], serviceEndpoint: local }] });
  assert.equal((await discoverLWS(local, { fetch })).root, local);
  const f = fixture({ [storage]: () => response('', 403) });
  await assert.rejects(discoverLWS(file, f), /403/);
});

test('propagates cancellation and network errors', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(discoverLWS(storage, { signal: controller.signal, fetch: async (_, options) => {
    options.signal.throwIfAborted();
  } }), /abort/i);
});
