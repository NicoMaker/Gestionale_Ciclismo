import { apiGet } from "./api.js";

export const cache = {
  squadre: [],
  corridori: [],
  tappe: [],
  nazioni: [],
  sponsor: [],
};

function normalizzaNazioni(rows) {
  return (rows || []).map((n) => ({
    ...n,
    codice_iso2: (n.codice_iso2 || "").toString().trim().toUpperCase(),
  }));
}

export async function caricaSquadre() {
  cache.squadre = await apiGet("/api/squadre");
  return cache.squadre;
}
export async function caricaCorridori() {
  cache.corridori = await apiGet("/api/corridori");
  return cache.corridori;
}
export async function caricaTappe() {
  cache.tappe = await apiGet("/api/tappe");
  return cache.tappe;
}
export async function caricaNazioni() {
  cache.nazioni = normalizzaNazioni(await apiGet("/api/nazioni"));
  return cache.nazioni;
}
export async function caricaSponsor() {
  cache.sponsor = await apiGet("/api/sponsor");
  return cache.sponsor;
}

export async function garantisciSquadre() {
  if (!cache.squadre.length) await caricaSquadre();
  return cache.squadre;
}
export async function garantisciCorridori() {
  if (!cache.corridori.length) await caricaCorridori();
  return cache.corridori;
}
export async function garantisciTappe() {
  if (!cache.tappe.length) await caricaTappe();
  return cache.tappe;
}
export async function garantisciNazioni() {
  if (!cache.nazioni.length) await caricaNazioni();
  return cache.nazioni;
}
export async function garantisciSponsor() {
  if (!cache.sponsor.length) await caricaSponsor();
  return cache.sponsor;
}
