import { mergeStates, readState } from './launcher-storage.mjs';

const databaseName = 'pondersource-atomic';
const connectionKey = 'launcher';
const schema = 'https://atomicdata.dev/properties/';
const genesisProperty = schema + 'genesis';
const createdByProperty = schema + 'createdBy';
const libraryName = 'Ponder Source launcher state v1';
const pageSize = 100;
const publicAgent = 'https://atomicdata.dev/agents/publicAgent';

export function driveId(input) {
  const source = input.trim();
  let subject = source;
  if (!/^(atomic:|did:ad:)[A-Za-z0-9_+/=-]+$/.test(source)) {
    try {
      const link = new URL(source);
      const tail = decodeURIComponent(link.pathname.split('/').at(-1));
      subject = link.searchParams.get('subject') || link.searchParams.get('drive') || tail;
    } catch {
      throw new Error('Enter the DID of an Atomic drive or a link to it.');
    }
  }
  const match = /^(?:atomic:|did:ad:)([A-Za-z0-9_-]{86})$/.exec(subject);
  if (!match) throw new Error('Enter the DID of an Atomic drive or a link to it.');
  return 'atomic:' + match[1];
}

function httpsOrigin(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Use an HTTPS address without credentials.');
  }
  return url.origin;
}

function withConnection(mode, operation, database = indexedDB) {
  return new Promise((resolve, reject) => {
    const opening = database.open(databaseName, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('connections');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      try {
        const transaction = db.transaction('connections', mode);
        const request = operation(transaction.objectStore('connections'));
        transaction.oncomplete = () => { db.close(); resolve(request.result); };
        transaction.onabort = () => { db.close(); reject(transaction.error || request.error); };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

export function loadAtomicConnection() {
  return withConnection('readonly', records => records.get(connectionKey));
}

export function saveAtomicConnection(connection) {
  return withConnection('readwrite', records => records.put(connection, connectionKey));
}

export function forgetAtomicConnection() {
  return withConnection('readwrite', records => records.delete(connectionKey));
}

let sdkRequest;
function loadSDK() {
  sdkRequest ||= import('./atomic-sdk/index.mjs').catch(error => {
    sdkRequest = undefined;
    throw error;
  });
  return sdkRequest;
}

export async function discoverAtomicNodes(drive, sdk = loadSDK()) {
  return (await sdk).resolveDriveOrigins(drive);
}

export async function prepareAtomicConnection({ drive, node, approvalSite }, sdk = loadSDK(), subtle = crypto.subtle) {
  const api = await sdk;
  const keyPair = await subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  const key = await api.Agent.fromCryptoKeyPair(keyPair).getPublicKey();
  const agent = api.agentSubjectFromPublicKey(key).subject;
  const connection = { drive: driveId(drive), node: httpsOrigin(node), agent, keyPair };
  return {
    connection,
    grantUrl: api.connectAgentUrl(httpsOrigin(approvalSite), {
      publicKey: key,
      name: 'Ponder Source launcher',
      write: true,
      targets: [connection.drive]
    })
  };
}

export async function openAtomicLibrary(connection, sdk = loadSDK(), transport = fetch) {
  const api = await sdk;
  const { collections, core } = api;
  const drive = driveId(connection.drive);
  const origin = httpsOrigin(connection.node);
  if (globalThis.location?.origin === origin) throw new Error('Use an Atomic node on its own origin.');
  const agent = api.Agent.fromCryptoKeyPair(connection.keyPair, connection.agent);
  if (api.agentSubjectFromPublicKey(await agent.getPublicKey()).subject !== agent.subject) {
    throw new Error('The saved Atomic app key is invalid. Disconnect it and connect again.');
  }
  await api.LoroLoader.initializeLoro();
  const fetchNode = async (input, options = {}) => {
    const url = new URL(input);
    if (url.origin !== origin) throw new Error('An Atomic request left the selected node.');
    const method = options.method ?? 'GET';
    // Atomic's resource and query handlers verify URL-bound read signatures.
    // Commit bodies have their own signature.
    const headers = method === 'GET'
      ? await api.signRequest(url.href, agent, options.headers)
      : options.headers;
    const deadline = AbortSignal.timeout(20_000);
    const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
    return transport(url.href, { ...options, headers, signal, credentials: 'omit', redirect: 'error' });
  };
  const client = new api.Client(fetchNode);
  const endpoint = new URL('/commit', origin).href;
  const get = async subject => {
    const { resource } = await client.fetchResourceHTTP(subject, { serverURL: origin });
    if (resource.error) throw resource.error;
    return resource;
  };

  async function ensureGrant() {
    const resource = await get(drive);
    const encoded = resource.get(genesisProperty);
    if (resource.subject !== drive || !resource.hasClasses(api.server.classes.drive) || typeof encoded !== 'string') {
      throw new Error('The selected node could not verify the Atomic drive.');
    }
    const cert = api.decodeGenesisCert(api.decodeB64(encoded));
    if (!(await api.verifyGenesisCert(cert, drive.slice('atomic:'.length))) ||
        resource.get(createdByProperty) !== api.genesisSignerDid(cert)) {
      throw new Error('The selected node returned an invalid Atomic drive certificate.');
    }
    const readers = resource.getSubjects(core.properties.read);
    const writers = resource.getSubjects(core.properties.write);
    if (resource.get(core.properties.parent) || readers.includes(publicAgent) || writers.includes(publicAgent)) {
      throw new Error('Choose a private Atomic drive for your app library.');
    }
    if (!readers.includes(agent.subject) || !writers.includes(agent.subject)) {
      throw new Error('In Atomic, select the same drive and approve Read and edit for this app key.');
    }
    return resource;
  }

  const root = await ensureGrant();
  // The Store signs and builds commits only. The Client above sends them
  // and reads from the selected node, without an Atomic session cookie.
  const store = new api.Store({
    agent, serverUrl: origin, noServer: true, requireOnlineWrites: true,
    commitTransport: commit => client.postCommit(commit, endpoint)
  });
  store.addResource(root);
  return {
    async read() {
      await ensureGrant();
      let state = readState();
      let expectedTotal;
      const seen = new Set();
      for (let page = 0; ; page++) {
        const query = new URL('/query', origin);
        query.search = new URLSearchParams({
          drive, property: core.properties.parent, value: drive,
          filters: JSON.stringify([{ property: core.properties.name, value: libraryName }]),
          page_size: String(pageSize), current_page: String(page)
        });
        const result = await get(query.href);
        const subjects = result.getSubjects(collections.properties.members);
        const total = result.get(collections.properties.totalMembers);
        if (!Number.isSafeInteger(total) || total < 0 || subjects.length !== Math.min(pageSize, Math.max(0, total - page * pageSize))) {
          throw new Error('Atomic returned an incomplete library page. Try loading it again.');
        }
        expectedTotal ??= total;
        if (total !== expectedTotal) throw new Error('The Atomic library changed while loading. Try loading it again.');
        for (const subject of subjects) {
          if (driveId(subject) !== subject) throw new Error('Atomic returned an invalid library record ID.');
          if (seen.has(subject)) throw new Error('The Atomic library changed while loading. Try loading it again.');
          seen.add(subject);
        }
        const resources = await Promise.all(subjects.map(subject => get(subject)));
        for (const resource of resources) {
          if (resource.get(core.properties.parent) !== drive || resource.get(core.properties.name) !== libraryName) {
            throw new Error('Atomic returned a record outside this app library.');
          }
          state = mergeStates(state, readState(JSON.parse(resource.get(core.properties.description))));
        }
        if ((page + 1) * pageSize >= total) return state;
      }
    },
    async write(next) {
      await ensureGrant();
      // Each acknowledged launcher's snapshot adds a resource. Independent
      // devices can write at once without replacing one shared JSON property.
      const record = await store.newResource({ parent: drive, propVals: {
        [core.properties.name]: libraryName,
        [core.properties.description]: JSON.stringify(readState(next))
      } });
      const result = await record.save();
      if (result !== 'persisted') throw new Error('Atomic did not confirm the app library write.');
    }
  };
}
