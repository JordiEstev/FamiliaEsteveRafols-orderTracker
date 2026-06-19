// Cua offline a nivell d'aplicació per a les mutacions de comandes.
//
// No ens refiem de la Background Sync API de Workbox perquè és poc fiable entre
// navegadors (i a iOS/Safari no està suportada). En lloc d'això persistim les
// mutacions fallides a localStorage i les reenviem nosaltres mateixos quan torna
// la connexió, de manera que cap comanda es perdi.

import { v4 as uuid } from "uuid";

const KEY = "offline-order-queue";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* emmagatzematge ple o no disponible: no hi podem fer res */
  }
}

export function queueCount() {
  return read().length;
}

// Avisa la UI que el nombre de peticions pendents ha canviat.
function notifyChanged() {
  window.dispatchEvent(new CustomEvent("orders-queue-changed", { detail: { count: queueCount() } }));
}

// item: { method, url, body }  — body és un objecte pla o null (DELETE).
export function enqueue(item) {
  const items = read();
  items.push({ id: uuid(), ...item });
  write(items);
  notifyChanged();
}

let flushing = false;

// Reenvia les peticions encuades. Retorna quantes s'han enviat correctament.
export async function flushQueue() {
  if (flushing) return 0;
  flushing = true;
  try {
    const items = read();
    if (!items.length) return 0;
    const remaining = [];
    let flushed = 0;
    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.body ? { "Content-Type": "application/json" } : undefined,
          body: item.body ? JSON.stringify(item.body) : undefined,
        });
        // 2xx: enviada. 4xx: no s'enviarà mai (dades invàlides) -> la descartem
        // igualment per no encallar la cua. 5xx: error temporal del servidor ->
        // la mantenim per reintentar-ho.
        if (res.status >= 500) {
          remaining.push(item);
        } else {
          flushed++;
        }
      } catch {
        // Error de xarxa: seguim sense connexió, la mantenim per al pròxim intent.
        remaining.push(item);
      }
    }
    write(remaining);
    if (flushed > 0) notifyChanged();
    return flushed;
  } finally {
    flushing = false;
  }
}

// S'ha de cridar un cop a l'arrencada de l'app.
export function initOfflineQueue() {
  const tryFlush = async () => {
    const n = await flushQueue();
    if (n > 0) {
      window.dispatchEvent(new CustomEvent("orders-queue-flushed", { detail: { count: n } }));
    }
  };
  window.addEventListener("online", tryFlush);
  // També ho intentem a l'arrencada per si hem carregat ja amb connexió.
  if (navigator.onLine) tryFlush();
}
