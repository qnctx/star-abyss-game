import { copy, canonical, validateRoot, validateSceneConfig } from './index.mjs';

/** Real IndexedDB; one root record contains all child snapshots, events and receipts. */
export async function openIndexedDB({ name, indexedDB = globalThis.indexedDB, fault = () => null, sceneConfig } = {}) {
  if (!name || !indexedDB) throw new Error('indexedDBRequired');
  if(sceneConfig !== undefined) validateSceneConfig(sceneConfig);
  const fixedConfig=sceneConfig === undefined ? undefined : copy(sceneConfig);
  function assertSceneConfig(sessionConfig) {
    if(sessionConfig !== undefined) validateSceneConfig(sessionConfig);
    // R2 adapters had no scene config; preserve that pairing only for the original two-field config.
    if(fixedConfig === undefined && (sessionConfig === undefined || !Object.hasOwn(sessionConfig,'poseBounds'))) return;
    if(fixedConfig === undefined || sessionConfig === undefined || canonical(fixedConfig)!==canonical(sessionConfig)) throw Error('sceneConfigurationMismatch');
  }
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('roots', { keyPath: 'worldId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('databaseBlocked'));
  });
  db.onversionchange = () => db.close();
  const load = worldId => new Promise((resolve, reject) => {
    const tx = db.transaction('roots', 'readonly');
    const req = tx.objectStore('roots').get(worldId);
    let result;
    req.onsuccess = () => { result = req.result ?? null; };
    tx.oncomplete = () => {
      try { if(result) validateRoot(result,fixedConfig); resolve(result); } catch(error) { reject(error); }
    };
    tx.onabort = () => reject(tx.error ?? new Error('readAborted'));
    tx.onerror = () => {}; // onabort is the authoritative failure boundary.
  });
  async function write({ worldId, expectedRevision, nextState, signal }, initialize) {
    const next = copy(nextState); validateRoot(next,fixedConfig);
    if (next.worldId !== worldId || (initialize ? next.revision !== 0 : next.revision !== expectedRevision + 1)) throw new Error('invalidRootRevision');
    if (signal?.aborted) throw new Error('cancelled');
    return new Promise((resolve, reject) => {
      const tx = db.transaction('roots', 'readwrite');
      let accepted = false, reason = null;
      const abort = () => { reason = new Error('cancelled'); try { tx.abort(); } catch {} };
      signal?.addEventListener('abort', abort, { once: true });
      const cleanup = () => signal?.removeEventListener('abort', abort);
      tx.oncomplete = () => {
        cleanup();
        try { if (accepted && fault('afterCommit') === 'loseResponse') throw new Error('responseLost'); resolve(accepted); }
        catch (error) { reject(error); }
      };
      tx.onabort = () => { cleanup(); reject(reason ?? tx.error ?? new Error('transactionAborted')); };
      tx.onerror = () => {};
      const store = tx.objectStore('roots');
      const get = store.get(worldId);
      get.onsuccess = () => {
        try {
          const current = get.result;
          if(current) validateRoot(current,fixedConfig);
          if (initialize ? !!current : !current || current.revision !== expectedRevision) return;
          const put = store.put(next);
          put.onsuccess = () => {
            try {
              if (fault('afterPut') === 'abort') { reason = new Error('injectedAbort'); tx.abort(); return; }
              accepted = true;
            } catch (error) { reason = error; tx.abort(); }
          };
        } catch (error) { reason = error; tx.abort(); }
      };
    });
  }
  return { load, assertSceneConfig, compareAndSwap: args => write(args, false),
    initialize: nextState => write({ worldId: nextState.worldId, nextState }, true), close: () => db.close() };
}
