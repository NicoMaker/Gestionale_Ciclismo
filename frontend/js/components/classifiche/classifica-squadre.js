export function templateClassificaSquadre() {
  return `
    <section class="classification-panel classification-teams">
      <div class="classification-hero">
        <div>
          <span class="eyebrow">TEAM GC · STAGIONE 2025</span>
          <h2>Classifica a squadre</h2>
          <p>La gara vista dal punto di forza del gruppo: tempo cumulativo, corridori e distacchi.</p>
        </div>
        <div class="classification-mark" aria-hidden="true">TEAM</div>
      </div>
      <div class="team-summary" id="summaryClassificaSquadre"></div>
      <div class="subtab-head">${searchTemplate()}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Posizione</th><th>Squadra</th><th>Atleti</th><th>Tempo squadra</th><th>Distacco</th></tr></thead>
          <tbody id="tabellaClassificaSquadre"></tbody>
        </table>
      </div>
    </section>
  `;
}

function searchTemplate() {
  return '<label class="team-search"><span aria-hidden="true">⌕</span><input id="ricercaClassificaSquadre" type="search" placeholder="Cerca una squadra..." autocomplete="off" /></label>';
}

export function renderTeamSummary(container, leader, total) {
  if (!container) return;
  container.innerHTML = `
    <div class="team-leader-card">
      <span class="team-leader-rank">1</span>
      <div class="team-avatar" style="--team-color:${leader?.squadra_colore ?? '#e91e78'}">${leader ? leader.squadra_nome.slice(0, 2).toUpperCase() : '—'}</div>
      <div><span class="eyebrow">IN TESTA ALLA CORSA</span><strong>${leader?.squadra_nome ?? 'Nessun leader'}</strong><small>${leader ? `${leader.corridori_contati ?? 0} corridori classificati` : 'Aggiungi i risultati per aggiornare la classifica'}</small></div>
    </div>
    <div class="team-summary-stat"><span>Squadre classificate</span><strong>${total}</strong></div>
    <div class="team-summary-stat"><span>Leader provvisorio</span><strong>${leader?.tempo_totale ?? '—'}</strong></div>
  `;
}
