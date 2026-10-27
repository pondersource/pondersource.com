import { emptyState, readState, mergeStates, updateApp, openLocalStore } from './launcher-storage.mjs';
import { storageApiKeys } from './launcher-config.mjs';

const $ = id => document.getElementById(id);
const catalog = new Map();
document.querySelectorAll('#store-panel .app-card').forEach(card => {
  const button = card.querySelector('.install-app');
  const id = card.dataset.appId;
  catalog.set(id, {
    id, name: card.querySelector('h3').textContent,
    description: card.querySelector('p').textContent,
    url: button.dataset.baseHref,
    icon: card.querySelector('.app-icon').getAttribute('src'), button
  });
  button.addEventListener('click', () => changeApp(id, 'install'));
});

// Preserve the storage-first flow without handing the address fragment to the
// library, which would otherwise immediately redirect to authorization.
const params = new URLSearchParams(location.hash.slice(1));
let storageFirstAccount = (params.get('remotestorage') || '').trim();
if (storageFirstAccount) {
  params.delete('remotestorage');
  history.replaceState(null, '', location.pathname + location.search + (params.size ? '#' + params : ''));
  $('rs-user-address').value = storageFirstAccount;
}

let rs;
let launcher;
let localStore;
let localState = emptyState();
let state = emptyState();
let ready = false;
let busy = false;
let epoch = 0;
let mode = 'local';
let queue = Promise.resolve();
const localReady = openLocalStore().then(store => {
  localStore = store;
});

function showError(message) {
  $('library-error').textContent = message;
  $('library-error').hidden = !message;
  $('retry-library').hidden = !message;
}

function enqueue(task) {
  queue = queue.then(task).catch(error => {
    console.error('App library:', error);
    showError('Could not save or load your app library. ' + (error?.message || String(error)) + ' Please try again.');
  });
  return queue;
}

function currentAccount() {
  // Google/Dropbox email addresses are not remoteStorage discovery addresses.
  if (rs?.connected) return rs.backend === 'remotestorage' ? rs.remote.userAddress : '';
  return storageFirstAccount;
}

function appHref(url) {
  const account = currentAccount();
  return account ? url + '#remotestorage=' + encodeURIComponent(account) : url;
}

function providerName() {
  return { googledrive: 'Google Drive', dropbox: 'Dropbox', remotestorage: 'remoteStorage' }[rs?.backend] || 'remoteStorage';
}

function render() {
  const installed = state.apps.filter(entry => entry.installed && catalog.has(entry.id));
  $('installed-count').textContent = '(' + installed.length + ')';
  $('empty-library').hidden = !ready || installed.length > 0;
  $('installed-apps').replaceChildren();
  $('recent-list').replaceChildren();
  for (const app of catalog.values()) {
    const isInstalled = installed.some(entry => entry.id === app.id);
    app.button.textContent = isInstalled ? 'Installed' : 'Install app';
    app.button.disabled = !ready || busy || isInstalled;
  }
  for (const entry of installed) {
    const app = catalog.get(entry.id);
    const card = document.createElement('article');
    card.className = 'app-card';
    card.dataset.appId = app.id;
    const image = document.createElement('img');
    image.src = app.icon;
    image.alt = '';
    image.className = 'app-icon';
    const title = document.createElement('h3');
    title.textContent = app.name;
    const description = document.createElement('p');
    description.textContent = app.description;
    const actions = document.createElement('div');
    actions.className = 'app-links';
    const launch = launchLink(app, 'btn btn-primary');
    launch.textContent = 'Launch ' + app.name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-secondary';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + app.name + ' from your launcher');
    remove.disabled = !ready || busy;
    remove.addEventListener('click', () => changeApp(app.id, 'remove'));
    actions.append(launch, remove);
    card.append(image, title, description, actions);
    $('installed-apps').append(card);
  }
  const recent = installed.filter(entry => entry.lastOpened > 0)
    .sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 8);
  for (const entry of recent) {
    const app = catalog.get(entry.id);
    const li = document.createElement('li');
    const link = launchLink(app, 'recent-app');
    const image = document.createElement('img');
    image.src = app.icon;
    image.alt = '';
    const text = document.createElement('span');
    text.textContent = app.name;
    link.append(image, text);
    li.append(link);
    $('recent-list').append(li);
  }
  $('recent-apps').hidden = recent.length === 0;
  $('copy-device-apps').hidden = mode !== 'remote' || !localState.apps.some(entry => entry.installed && catalog.has(entry.id));
  $('copy-device-apps').disabled = !ready || busy;
}

function launchLink(app, className) {
  const link = document.createElement('a');
  link.href = appHref(app.url);
  link.target = '_blank';
  link.rel = 'noopener';
  link.className = className;
  const record = event => {
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (!ready) { event.preventDefault(); return; }
    changeApp(app.id, 'launch');
  };
  link.addEventListener('click', record);
  link.addEventListener('auxclick', record);
  return link;
}

async function readCurrent() {
  if (mode === 'local') return localStore.read();
  // Default maxAge fetches the document when the initial sync is incomplete.
  // Never treat a missing cache entry as an empty remote library.
  return readState(await launcher.getObject('installed-apps'));
}

async function writeCurrent(next) {
  if (mode === 'local') {
    await localStore.write(next);
    localState = next;
  } else {
    await launcher.storeObject('installed-apps', 'installed-apps', structuredClone(next));
  }
}

function changeApp(id, action) {
  if (!ready || !catalog.has(id)) return;
  const generation = epoch;
  busy = true;
  render();
  enqueue(async () => {
    try {
      if (generation !== epoch) return;
      const save = async () => {
        const saved = await readCurrent();
        if (generation !== epoch) return;
        const next = updateApp(mergeStates(state, saved), id, action);
        await writeCurrent(next);
        if (generation !== epoch) return;
        state = next;
        showError('');
        $('library-message').textContent = action === 'install' ? catalog.get(id).name + ' installed. Find it in My apps.' :
          action === 'remove' ? catalog.get(id).name + ' removed from your launcher.' : '';
      };
      // Serialize local read/modify/write across tabs as well as this window.
      if (mode === 'local' && navigator.locks) await navigator.locks.request('pondersource-launcher', save);
      else await save();
    } finally {
      busy = false;
      render();
    }
  });
}

function switchLibrary(remote) {
  const generation = ++epoch;
  ready = false;
  busy = false;
  state = emptyState();
  mode = remote ? 'remote' : 'local';
  $('library-message').textContent = '';
  $('storage-status').textContent = 'Opening your app library…';
  render();
  enqueue(async () => {
    if (!remote) {
      await localReady;
      localState = await localStore.read();
    }
    if (generation !== epoch) return;
    const loaded = await readCurrent();
    if (generation !== epoch) return;
    state = loaded;
    if (!remote) localState = loaded;
    ready = true;
    showError('');
    $('storage-status').textContent = remote ? 'Your app library is connected to ' + providerName() + '. Changes sync when online.' :
      'Your apps are saved on this device. Connect your storage to use a library across devices.';
    render();
  });
}

function selectTab(store, focus = false) {
  for (const [id, selected] of [['library', !store], ['store', store]]) {
    const tab = $(id + '-tab');
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(id + '-panel').hidden = !selected;
    if (selected && focus) tab.focus();
  }
}
$('library-tab').addEventListener('click', () => selectTab(false));
$('store-tab').addEventListener('click', () => selectTab(true));
$('browse-apps').addEventListener('click', () => selectTab(true, true));
document.querySelector('.launcher-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  selectTab(event.key === 'Home' ? false : event.key === 'End' ? true : $('library-tab').getAttribute('aria-selected') === 'true', true);
});
$('retry-library').addEventListener('click', () => switchLibrary(mode === 'remote'));
window.addEventListener('focus', () => {
  if (mode === 'local' && ready && !busy) switchLibrary(false);
});
$('copy-device-apps').addEventListener('click', () => {
  const generation = epoch;
  busy = true;
  render();
  enqueue(async () => {
    try {
      await localReady;
      localState = await localStore.read();
      const saved = await readCurrent();
      if (generation !== epoch || mode !== 'remote') return;
      let next = mergeStates(state, saved);
      for (const entry of localState.apps.filter(app => app.installed)) next = updateApp(next, entry.id, 'install');
      await writeCurrent(next);
      if (generation !== epoch) return;
      state = next;
      showError('');
      $('library-message').textContent = 'Your device’s apps were copied to this account.';
    } finally {
      busy = false;
      render();
    }
  });
});

function connectionBusy(value) {
  $('rs-connect-btn').disabled = value;
  $('rs-connect-btn').textContent = value ? 'Connecting…' : 'Sign in';
  document.querySelectorAll('[data-storage-provider]').forEach(button => { button.disabled = value; });
}
function connectionError(message) {
  $('rs-login-error').textContent = message;
  $('rs-login-error').hidden = !message;
}
function signedOut() {
  connectionBusy(false);
  $('rs-login-form').hidden = false;
  $('rs-session').hidden = true;
  switchLibrary(false);
}

// Initialize local storage even if remoteStorage.js fails to load.
switchLibrary(false);
try {
  rs = new RemoteStorage();
  rs.access.claim('launcher', 'rw');
  rs.caching.enable('/launcher/');
  rs.setApiKeys(storageApiKeys);
  launcher = rs.scope('/launcher/');
  launcher.declareType('installed-apps', {
    type: 'object', properties: {
      version: { type: 'number', enum: [1] },
      apps: { type: 'array', items: {
        type: 'object', properties: {
          id: { type: 'string' }, installed: { type: 'boolean' },
          updatedAt: { type: 'number' }, lastOpened: { type: 'number' }
        }, required: ['id', 'installed', 'updatedAt', 'lastOpened']
      } }
    }, required: ['version', 'apps']
  });
  for (const provider of ['googledrive', 'dropbox']) {
    const button = document.querySelector('[data-storage-provider="' + provider + '"]');
    button.hidden = !storageApiKeys[provider];
    button.addEventListener('click', async () => {
      connectionError('');
      connectionBusy(true);
      try { await rs[provider].connect(); }
      catch { connectionBusy(false); connectionError('Could not connect to this provider. Please try again.'); }
    });
  }
  $('rs-login-form').addEventListener('submit', event => {
    event.preventDefault();
    const address = $('rs-user-address').value.trim();
    if (!address.includes('@') && !/^https?:\/\//.test(address)) {
      connectionError('Enter your full remoteStorage address, like user@provider.example.');
      return;
    }
    connectionError('');
    connectionBusy(true);
    rs.setBackend('remotestorage');
    try { rs.connect(address); }
    catch { connectionBusy(false); connectionError('Could not connect. Please check the address and try again.'); }
  });
  $('rs-disconnect-btn').addEventListener('click', async () => {
    storageFirstAccount = '';
    $('rs-user-address').value = '';
    // Invalidate outstanding account work immediately, before async cleanup.
    ++epoch;
    ready = false;
    render();
    try { await rs.disconnect(); }
    catch { connectionError('Could not sign out. Please try again.'); }
  });
  rs.on('connecting', () => connectionBusy(true));
  rs.on('connected', () => {
    connectionBusy(false);
    connectionError('');
    $('rs-login-form').hidden = true;
    $('rs-session').hidden = false;
    $('rs-session-address').textContent = rs.remote.userAddress || providerName();
    switchLibrary(true);
  });
  rs.on('not-connected', signedOut);
  rs.on('disconnected', signedOut);
  rs.on('error', error => {
    connectionBusy(false);
    connectionError(error.name === 'DiscoveryError' ? 'Could not find storage for that address. Please check it and try again.' :
      'Storage is unavailable. Your saved apps are kept; please reconnect or try again.');
  });
  launcher.on('change', event => {
    if (event.relativePath !== 'installed-apps' || event.origin === 'window' || mode !== 'remote' || !ready) return;
    const generation = epoch;
    enqueue(async () => {
      if (generation !== epoch) return;
      const remote = readState(event.newValue);
      const merged = mergeStates(state, remote);
      if (JSON.stringify(merged) !== JSON.stringify(remote)) await writeCurrent(merged);
      if (generation !== epoch) return;
      state = merged;
      render();
    });
  });
} catch (error) {
  console.error('Storage connection:', error);
  $('rs-connect-btn').disabled = true;
  connectionError('Storage connections are unavailable. You can still use apps saved on this device.');
}
