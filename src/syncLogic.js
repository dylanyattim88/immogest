// Logique pure de synchronisation (sans React ni Supabase) : testable isolement.

// Applique un evenement temps reel Supabase (INSERT / UPDATE / DELETE) a UNE table locale.
// Une ligne marquee "deletedAt" (suppression douce) est retiree de l'affichage ;
// si elle est restauree (deletedAt = null), elle reapparait.
export function applyChange(arr, payload) {
  if (payload.eventType === "DELETE") {
    return arr.filter(r => r.id !== payload.old.id);
  }
  const row = payload.new;
  if (row.deletedAt) return arr.filter(r => r.id !== row.id);
  return arr.some(r => r.id === row.id)
    ? arr.map(r => (r.id === row.id ? row : r))
    : [...arr, row];
}

// Ne garde que les lignes non supprimees (suppression douce).
export const visibleRows = (rows) => (rows || []).filter(r => !r.deletedAt);

// Identifiant unique : horodatage (ms) * 1000 + aleatoire, puis garantie d'etre
// strictement croissant dans un meme onglet (jamais deux fois le meme id, meme en rafale).
let lastId = 0;
export function newId() {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (id <= lastId) id = lastId + 1;
  lastId = id;
  return id;
}
