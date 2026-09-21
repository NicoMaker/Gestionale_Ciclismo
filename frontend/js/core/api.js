const JSON_HEADERS = { "Content-Type": "application/json" };

// Errore applicativo per risposte non-OK o non-JSON: espone un messaggio
// leggibile invece di far esplodere il parsing con "Unexpected token '<'"
// (tipico quando /api/... risponde con una pagina HTML di errore 404/500
// perché il backend Node non è avviato o è su una porta diversa).
export class ApiError extends Error {
  constructor(messaggio, status) {
    super(messaggio);
    this.name = "ApiError";
    this.status = status;
  }
}

async function leggiJsonSicuro(res) {
  const contentType = res.headers.get("content-type") || "";
  const testo = await res.text();

  if (!res.ok) {
    // prova comunque a estrarre { errore: "..." } da una risposta JSON di errore
    if (contentType.includes("application/json")) {
      try {
        const corpo = JSON.parse(testo);
        throw new ApiError(corpo?.errore || `Errore ${res.status}`, res.status);
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
    throw new ApiError(
      res.status === 404
        ? "Endpoint non trovato (404). Il server backend (node server.js) è avviato sulla porta corretta?"
        : `Errore del server (${res.status})`,
      res.status,
    );
  }

  if (!contentType.includes("application/json")) {
    throw new ApiError(
      "Risposta inattesa dal server (non è JSON). Controlla che il backend Node sia avviato e raggiungibile.",
      res.status,
    );
  }

  try {
    return testo ? JSON.parse(testo) : null;
  } catch {
    throw new ApiError(
      "Impossibile leggere la risposta del server.",
      res.status,
    );
  }
}

export async function apiGet(percorso) {
  const res = await fetch(percorso);
  return leggiJsonSicuro(res);
}

export async function apiPost(percorso, corpo) {
  return fetch(percorso, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(corpo),
  });
}

export async function apiPut(percorso, corpo) {
  return fetch(percorso, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(corpo),
  });
}

export async function apiDelete(percorso) {
  return fetch(percorso, { method: "DELETE" });
}
