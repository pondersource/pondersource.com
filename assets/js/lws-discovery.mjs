// LWS discovery follows the storage Link relation and OAuth protected-resource metadata.
const STORAGE_REL = 'https://www.w3.org/ns/lws#storage';
const NS = 'https://www.w3.org/ns/lws#';
const MAX_DOCUMENT = 262144;

function webURL(value, base) {
  const url = new URL(value, base);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Use an HTTPS LWS URL, or HTTP on localhost for development.');
  }
  if (url.username || url.password) throw new Error('Use a URL without a username or password.');
  url.hash = '';
  return url;
}

function storageLink(header, base) {
  const found = [];
  // A URI reference can contain commas. Only commas outside <...> and quoted parameters delimit links.
  for (const match of (header || '').matchAll(/<([^>]*)>((?:[^"<,]|"(?:[^"\\]|\\.)*")*)/g)) {
    const rel = /;\s*rel\s*=\s*(?:"([^"]*)"|([^;\s,]+))/i.exec(match[2]);
    if ((rel?.[1] || rel?.[2] || '').split(/\s+/).includes(STORAGE_REL)) {
      found.push(webURL(match[1], base).href);
    }
  }
  const unique = [...new Set(found)];
  if (unique.length > 1) throw new Error('The server advertises conflicting LWS storages.');
  return unique[0];
}

function metadataLink(response) {
  const challenge = response.headers.get('www-authenticate') || '';
  const match = /\bresource_metadata\s*=\s*"([^"]+)"/i.exec(challenge);
  return match && match[1];
}

function sameOrigin(url, expected) {
  if (url.origin !== expected.origin) throw new Error('LWS discovery returned a URL on an unexpected storage origin.');
}

function hasType(value, name) {
  return (Array.isArray(value) ? value : [value]).some(type => type === name || type === NS + name);
}

export async function discoverLWS(address, { fetch: request = globalThis.fetch, signal } = {}) {
  const requested = webURL(address);
  const options = {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: signal || AbortSignal.timeout(15000)
  };
  async function get(url, accept) {
    return request(url.href, { ...options, headers: { Accept: accept } });
  }
  async function json(response) {
    if (!response.ok) throw new Error('The server refused the discovery document (HTTP ' + response.status + ').');
    const text = await response.text();
    if (text.length > MAX_DOCUMENT) throw new Error('The discovery document is too large.');
    return JSON.parse(text);
  }
  const first = await get(requested, 'application/lws+cid, application/json;q=0.9');
  if (!first.ok && first.status !== 401) {
    throw new Error('Could not discover LWS storage (HTTP ' + first.status + ').');
  }
  const linked = storageLink(first.headers.get('link'), requested);
  let description;
  let storage;
  if (linked) {
    storage = webURL(linked);
    sameOrigin(storage, requested);
    description = await json(await get(storage, 'application/lws+cid'));
  } else {
    if (!first.ok) throw new Error('The server did not expose its LWS storage Link header.');
    description = await json(first);
    storage = webURL(description.id);
    sameOrigin(storage, requested);
    if (storage.href !== requested.href) throw new Error('The storage description does not identify the requested URL.');
  }
  if (!hasType(description.type, 'Storage') || description.id !== storage.href) {
    throw new Error('The server returned an invalid LWS storage description.');
  }
  const services = Array.isArray(description.service) ? description.service : [description.service];
  const roots = services.filter(service => service && hasType(service.type, 'StorageRoot'));
  if (roots.length !== 1) throw new Error('The storage must advertise one StorageRoot service.');
  const root = webURL(roots[0].serviceEndpoint);
  sameOrigin(root, requested);

  // Public resources may omit an authentication challenge. Check the storage root as well.
  let challenge = first;
  let resource = requested;
  if (!metadataLink(challenge) && root.href !== requested.href) {
    challenge = await get(root, 'application/lws+json');
    resource = root;
  }
  const metadata = metadataLink(challenge);
  let authorizationServers = [];
  if (metadata) {
    const metadataURL = webURL(metadata);
    sameOrigin(metadataURL, requested);
    const document = await json(await get(metadataURL, 'application/json'));
    if (document.resource !== resource.href) throw new Error('Authorization metadata identifies a different resource.');
    if (!Array.isArray(document.authorization_servers) || !document.authorization_servers.length) {
      throw new Error('Authorization metadata has no authorization server.');
    }
    authorizationServers = [...new Set(document.authorization_servers.map(value => webURL(value).href))];
  } else if (challenge.status === 401) {
    throw new Error('The server did not expose its LWS authorization discovery header.');
  }
  return { storage: storage.href, root: root.href, authorizationServers };
}
