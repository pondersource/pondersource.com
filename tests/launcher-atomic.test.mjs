import assert from 'node:assert/strict';
import { test } from 'node:test';
import { driveId, openAtomicLibrary, prepareAtomicConnection } from '../assets/js/launcher-atomic.mjs';

const drive = 'atomic:' + 'A'.repeat(86);
const itemA = 'atomic:' + 'B'.repeat(86);
const itemB = 'atomic:' + 'C'.repeat(86);
const agent = 'atomic:agent:key';
const node = 'https://node.example';
const property = name => 'https://atomicdata.dev/properties/' + name;
const core = { properties: Object.fromEntries(['parent', 'description', 'name', 'read', 'write'].map(key => [key, property(key)])) };
const collections = { properties: { members: property('members'), totalMembers: property('totalMembers') } };
const libName = 'Ponder Source launcher state v1';

function app(id, installed, time) {
  return { id, installed, updatedAt: time, lastOpened: 0 };
}

function record(subject, props) {
  return { subject, get: key => props[key], getSubjects: key => props[key] || [], hasClasses: () => true };
}

function fixture({ write = true, badCertificate = false, failedWrite = false, wrongResult = false } = {}) {
  const calls = [];
  const pending = [];
  const commits = [];
  const states = new Map([
    [itemA, { version: 1, apps: [app('litewrite', true, 2), app('marco', true, 1)] }],
    [itemB, { version: 1, apps: [app('litewrite', false, 2), app('webmarks', true, 3)] }]
  ]);
  const keyPair = {};
  const api = {
    core, collections,
    Agent: { fromCryptoKeyPair: (_keys, subject) => ({ subject, getPublicKey: async () => 'key' }) },
    agentSubjectFromPublicKey: () => ({ subject: agent }),
    connectAgentUrl: (site, params) => ({ site, params }),
    decodeB64: token => token,
    decodeGenesisCert: token => token,
    verifyGenesisCert: async (cert, signature) => !badCertificate && cert === 'certificate' && signature === drive.slice(7),
    genesisSignerDid: () => 'atomic:agent:owner',
    server: { classes: { drive: 'drive' } },
    LoroLoader: { initializeLoro: async () => undefined },
    Client: class {
      constructor(transport) { this.transport = transport; }
      async fetchResourceHTTP(subject, { signInfo }) {
        assert.equal(signInfo.agent.subject, agent);
        assert.equal(signInfo.serverURL, node);
        calls.push(subject);
        if (subject === drive) return { resource: record(drive, {
          [property('genesis')]: 'certificate', [property('createdBy')]: 'atomic:agent:owner',
          [property('read')]: [agent], [property('write')]: write ? [agent] : []
        }) };
        if (states.has(subject)) return { resource: record(subject, {
          [property('parent')]: wrongResult ? itemA : drive,
          [property('name')]: libName,
          [property('description')]: JSON.stringify(states.get(subject))
        }) };
        const url = new URL(subject);
        assert.equal(url.origin, node);
        assert.equal(url.pathname, '/query');
        assert.equal(url.searchParams.get('drive'), drive);
        assert.deepEqual(JSON.parse(url.searchParams.get('filters')), [{ property: property('name'), value: libName }]);
        return { resource: record(subject, {
          [collections.properties.members]: [...states.keys()], [collections.properties.totalMembers]: states.size
        }) };
      }
      postCommit(commit, endpoint) {
        commits.push({ commit, endpoint });
        return this.transport(endpoint, { method: 'POST', credentials: 'include', redirect: 'follow' });
      }
    },
    Store: class {
      constructor(options) { this.options = options; }
      async newResource(options) {
        assert.equal(options.parent, drive);
        assert.equal(this.options.requireOnlineWrites, true);
        pending.push(options);
        return {
          save: async () => {
            await this.options.commitTransport('signed commit');
            return failedWrite ? 'offline' : 'persisted';
          }
        };
      }
    }
  };
  const transport = (url, options) => {
    assert.equal(url, node + '/commit');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    return Promise.resolve();
  };
  return { api, connection: { drive, node, agent, keyPair }, calls, pending, commits, transport };
}

test('parses modern and legacy drive links and rejects an agent or a bad link', () => {
  assert.equal(driveId(drive), drive);
  assert.equal(driveId('did:ad:' + drive.slice(7)), drive);
  assert.equal(driveId('https://app.atomic.place/app/open?subject=' + encodeURIComponent(drive)), drive);
  assert.throws(() => driveId(agent), /Atomic drive/);
  assert.throws(() => driveId('javascript:alert(1)'), /Atomic drive/);
});

test('creates a non-extractable key and asks Atomic for the selected drive', async () => {
  const fixtureData = fixture();
  const { grantUrl, connection } = await prepareAtomicConnection({
    drive, node, approvalSite: 'https://app.atomic.place'
  }, fixtureData.api, { generateKey: async (...args) => {
    assert.deepEqual(args, ['Ed25519', false, ['sign', 'verify']]);
    return fixtureData.connection.keyPair;
  } });
  assert.equal(grantUrl.site, 'https://app.atomic.place');
  assert.deepEqual(grantUrl.params, {
    name: 'Ponder Source launcher', write: true, publicKey: 'key', targets: [drive]
  });
  assert.equal(connection.agent, agent);
  assert.equal(connection.keyPair, fixtureData.connection.keyPair);
});

test('merges independent browser writes and posts only to the selected Atomic node', async () => {
  const { api, connection, pending, commits, transport } = fixture();
  const library = await openAtomicLibrary(connection, api, transport);
  const result = await library.read();
  assert.deepEqual(result.apps, [app('litewrite', false, 2), app('marco', true, 1), app('webmarks', true, 3)]);
  await library.write(result);
  assert.equal(pending[0].propVals[property('description')], JSON.stringify(result));
  assert.deepEqual(commits, [{ commit: 'signed commit', endpoint: node + '/commit' }]);
});

test('rejects read-only grants, invalid certificates, foreign records and unacknowledged saves', async () => {
  const open = options => {
    const { api, connection, transport } = fixture(options);
    return openAtomicLibrary(connection, api, transport);
  };
  await assert.rejects(open({ write: false }), /Read and edit/);
  await assert.rejects(open({ badCertificate: true }), /invalid Atomic drive certificate/);
  await assert.rejects((await open({ wrongResult: true })).read(), /outside this app library/);
  await assert.rejects((await open({ failedWrite: true })).write({ version: 1, apps: [] }), /did not confirm/);
});
