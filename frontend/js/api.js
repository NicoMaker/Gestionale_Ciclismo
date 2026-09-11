// Helper centralizzati per le chiamate REST verso il backend.
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function apiGet(percorso) {
  const res = await fetch(percorso);
  return res.json();
}

export async function apiPost(percorso, corpo) {
  return fetch(percorso, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(corpo) });
}

export async function apiPut(percorso, corpo) {
  return fetch(percorso, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(corpo) });
}

export async function apiDelete(percorso) {
  return fetch(percorso, { method: 'DELETE' });
}
