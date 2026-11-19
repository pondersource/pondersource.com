const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scopedModule, inspectionModule, withChanges, withPublicLinks } = require('./index.cjs');
test('scope modules bind their clients and keep raw storage private', async () => {
  const calls = [];
  const client = { getFile(path) { assert.equal(this, client); calls.push(path); return 'contents'; }, declareType(name, schema) { calls.push([name, schema]); } };
  const module = scopedModule('savr', ['getFile'], { article: { type: 'object' } });
  const api = module.builder(client).exports;
  assert.equal(await api.getFile('saves/a/article.json'), 'contents');
  assert.deepEqual(Object.keys(api), ['getFile']);
  assert.deepEqual(calls, [['article', { type: 'object' }], 'saves/a/article.json']);
});
test('inspection retains root scope behind its own module API', () => {
  const methods = ['getListing','getFile','getObject','storeFile','storeObject','remove','getItemURL'];
  const client = Object.fromEntries(methods.map(name => [name, path => name + ':' + path]));
  const module = inspectionModule({ scope(path) { assert.equal(path, '/'); return client; } });
  const api = module.builder().exports;
  assert.equal(api.getFile('documents/note'), 'getFile:documents/note');
  assert.equal(api.scope, undefined);
});
test('module extensions preserve exports and use the correct private/public client', () => {
  const events = [];
  const original = { name: 'shares', builder() { return { exports: { put: () => 'saved' } }; } };
  const privateClient = { scope(path) { assert.equal(path, 'archive/'); return { on(name, callback) { events.push(name); callback('changed'); } }; } };
  const publicClient = { getItemURL(path) { return 'public/' + path; } };
  const api = withChanges(withPublicLinks(original), 'onChange', 'archive/').builder(privateClient, publicClient).exports;
  assert.equal(api.put(), 'saved'); assert.equal(api.getItemURL('a'), 'public/a');
  api.onChange(value => assert.equal(value, 'changed')); assert.deepEqual(events, ['change']);
});
