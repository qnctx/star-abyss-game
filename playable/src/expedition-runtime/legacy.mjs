export const LEGACY_KEY = 'star-abyss-silent-echo-v1';
export const BACKUP_KEY = LEGACY_KEY + ':before-expedition-v1';
export function validLink(link) {
  return link?.version === 1 && typeof link.worldId === 'string' && link.worldId.startsWith('original:') &&
    typeof link.playerId === 'string' && link.playerId.startsWith('explorer:');
}
/** Bind before initializing IndexedDB. Preserve the exact previous save for reversible migration. */
export function bindLegacy(storage, data, makeId, { fresh = false } = {}) {
  if (!fresh && validLink(data.expedition)) return structuredClone(data.expedition);
  const raw = storage.getItem(LEGACY_KEY);
  if (raw && storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, raw);
  const id = makeId();
  const link = { version: 1, worldId: 'original:' + id, playerId: 'explorer:' + id, rescueRevision: 0, initialized: false };
  storage.setItem(LEGACY_KEY, JSON.stringify({ ...data, expedition: link }));
  return link;
}
