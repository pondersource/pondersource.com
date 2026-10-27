import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, readState, mergeStates, updateApp, openLocalStore } from '../assets/js/launcher-storage.mjs';

test('independent installs survive a merge and removal cannot be resurrected by launch history', () => {
  const laptop = updateApp(emptyState(), 'litewrite', 'install', 100);
  const phone = updateApp(emptyState(), 'hyperdraft', 'install', 200);
  let merged = mergeStates(laptop, phone);
  assert.equal(merged.apps.filter(app => app.installed).length, 2);
  const opened = updateApp(laptop, 'litewrite', 'launch', 500);
  const removed = updateApp(merged, 'litewrite', 'remove', 300);
  merged = mergeStates(removed, opened);
  assert.equal(merged.apps.find(app => app.id === 'litewrite').installed, false);
  assert.deepEqual(mergeStates(opened, removed), merged);
  assert.deepEqual(mergeStates(merged, merged), merged);
});

test('equal timestamps consistently favor removal; rapid actions are ordered', () => {
  const installed = updateApp(emptyState(), 'litewrite', 'install', 100);
  const removed = updateApp(emptyState(), 'litewrite', 'remove', 100);
  assert.equal(mergeStates(installed, removed).apps[0].installed, false);
  assert.equal(mergeStates(removed, installed).apps[0].installed, false);
  const reinstalled = updateApp(updateApp(installed, 'litewrite', 'remove', 100), 'litewrite', 'install', 100);
  assert.equal(reinstalled.apps[0].installed, true);
  assert.equal(reinstalled.apps[0].updatedAt, 102);
  assert.throws(() => updateApp(emptyState(), 'litewrite', 'launch'), /Install/);
});

test('invalid, duplicate or future-format data is rejected without mutation', () => {
  const saved = updateApp(emptyState(), 'litewrite', 'install', 100);
  const original = JSON.stringify(saved);
  updateApp(saved, 'litewrite', 'remove', 200);
  assert.equal(JSON.stringify(saved), original);
  assert.throws(() => readState({ version: 2, apps: [] }), /format/);
  assert.throws(() => readState({ version: 1, apps: [saved.apps[0], saved.apps[0]] }), /could not be read/);
  assert.throws(() => readState({ version: 1, apps: [{ id: 'x', installed: true, updatedAt: NaN, lastOpened: 0 }] }));
});

function browserStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('browser fallback persists across store instances when OPFS is absent or denied', async () => {
  const memory = browserStorage();
  const state = updateApp(emptyState(), 'litewrite', 'install', 100);
  const store = await openLocalStore({}, () => memory);
  await store.write(state);
  const restored = await openLocalStore({ getDirectory: async () => { throw new Error('Denied'); } }, () => memory);
  assert.deepEqual(await restored.read(), state);
  memory.setItem('pondersource:launcher:v1', 'broken json');
  await assert.rejects(restored.read());
  assert.equal(memory.getItem('pondersource:launcher:v1'), 'broken json');
});

test('storage quota errors surface instead of pretending an app was installed', async () => {
  const store = await openLocalStore({}, () => ({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } }));
  await assert.rejects(store.write(updateApp(emptyState(), 'litewrite', 'install')), /Quota/);
});

test('OPFS migrates a previous browser-storage library and preserves corrupt data', async () => {
  const memory = browserStorage();
  const state = updateApp(emptyState(), 'litewrite', 'install', 100);
  memory.setItem('pondersource:launcher:v1', JSON.stringify(state));
  let contents;
  const directory = { async getFileHandle(name, options) {
    assert.equal(name, 'pondersource-launcher-v1.json');
    if (contents === undefined && !options?.create) throw Object.assign(new Error('Missing'), { name: 'NotFoundError' });
    return {
      getFile: async () => ({ text: async () => contents }),
      createWritable: async () => ({ write: async value => { contents = value; }, close: async () => {}, abort: async () => {} })
    };
  } };
  const store = await openLocalStore({ getDirectory: async () => directory }, () => memory);
  assert.equal(store.name, 'OPFS');
  assert.deepEqual(await store.read(), state);
  await store.write(state);
  assert.deepEqual(JSON.parse(contents), state);
  contents = '{corrupt';
  await assert.rejects(store.read());
  assert.equal(contents, '{corrupt');
});
