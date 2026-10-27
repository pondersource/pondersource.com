// The same versioned document is used locally and in /launcher/installed-apps.
export function emptyState() {
  return { version: 1, apps: [] };
}

export function readState(value) {
  if (value === undefined || value === null) return emptyState();
  if (value.version !== 1 || !Array.isArray(value.apps)) {
    throw new Error('Unrecognized app library format. Your saved data has been left unchanged.');
  }
  const ids = new Set();
  const apps = value.apps.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
        typeof entry.installed !== 'boolean' || !Number.isFinite(entry.updatedAt) ||
        entry.updatedAt < 0 || !Number.isFinite(entry.lastOpened) || entry.lastOpened < 0) {
      throw new Error('The saved app library could not be read. Your saved data has been left unchanged.');
    }
    ids.add(entry.id);
    return { id: entry.id, installed: entry.installed, updatedAt: entry.updatedAt, lastOpened: entry.lastOpened };
  });
  return { version: 1, apps: apps.sort((a, b) => a.id.localeCompare(b.id)) };
}

export function mergeStates(...states) {
  const entries = new Map();
  for (const state of states) {
    for (const entry of readState(state).apps) {
      const previous = entries.get(entry.id);
      // Removal wins equal timestamps; launch history never resurrects an app.
      const winner = !previous || entry.updatedAt > previous.updatedAt ||
        (entry.updatedAt === previous.updatedAt && !entry.installed) ? entry : previous;
      entries.set(entry.id, { ...winner, lastOpened: Math.max(entry.lastOpened, previous?.lastOpened || 0) });
    }
  }
  return readState({ version: 1, apps: [...entries.values()] });
}

export function updateApp(state, id, action, now = Date.now()) {
  const next = readState(state);
  let entry = next.apps.find(app => app.id === id);
  if (!entry) {
    entry = { id, installed: false, updatedAt: 0, lastOpened: 0 };
    next.apps.push(entry);
  }
  if (action === 'launch') {
    if (!entry.installed) throw new Error('Install this app before launching it.');
    entry.lastOpened = Math.max(now, entry.lastOpened);
  } else if (action === 'install' || action === 'remove') {
    entry.installed = action === 'install';
    entry.updatedAt = Math.max(now, entry.updatedAt + 1);
    if (action === 'remove') entry.lastOpened = 0;
  } else {
    throw new Error('Unknown app action.');
  }
  return readState(next);
}

const LOCAL_KEY = 'pondersource:launcher:v1';

export async function openLocalStore(storage = navigator.storage, fallback = () => localStorage) {
  let directory;
  try {
    if (storage?.getDirectory) directory = await storage.getDirectory();
  } catch {
    // Browsers may expose OPFS but deny access (for example in private mode).
  }
  if (directory) {
    return {
      name: 'OPFS',
      async read() {
        try {
          const file = await directory.getFileHandle('pondersource-launcher-v1.json');
          return readState(JSON.parse(await (await file.getFile()).text()));
        } catch (error) {
          if (error.name !== 'NotFoundError') throw error;
          // Retain apps saved by a browser that previously lacked OPFS.
          let saved;
          try { saved = fallback().getItem(LOCAL_KEY); } catch { /* OPFS still works. */ }
          return saved ? readState(JSON.parse(saved)) : emptyState();
        }
      },
      async write(state) {
        const file = await directory.getFileHandle('pondersource-launcher-v1.json', { create: true });
        const writable = await file.createWritable();
        try {
          await writable.write(JSON.stringify(readState(state)));
          await writable.close();
        } catch (error) {
          await writable.abort().catch(() => {});
          throw error;
        }
      }
    };
  }
  const browserStorage = fallback();
  return {
    name: 'browser storage',
    async read() {
      const saved = browserStorage.getItem(LOCAL_KEY);
      return saved ? readState(JSON.parse(saved)) : emptyState();
    },
    async write(state) {
      browserStorage.setItem(LOCAL_KEY, JSON.stringify(readState(state)));
    }
  };
}
