// Extra: accento colore, densità, scorciatoie, ordinamento/CSV tabelle, offline, torna su, routing via hash
(() => {
  const root = document.documentElement;
  const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
  const el = (tag, props = {}, html = "") => Object.assign(document.createElement(tag), props, html ? { innerHTML: html } : {});

  // --- preferenze persistenti ---
  root.dataset.accento = ls("accento") || "rosa";
  root.dataset.densita = ls("densita") || "comoda";

  // --- skip link ---
  document.querySelector(".content")?.setAttribute("id", "contenuto");
  document.body.prepend(el("a", { className: "skip-link", href: "#contenuto" }, "Vai al contenuto"));

  // --- pannello impostazioni + torna su ---
  const colori = { rosa: "#ec1f80", azzurro: "#0ea5e9", verde: "#10b981", viola: "#8b5cf6", oro: "#f59e0b" };
  const pannello = el("div", { className: "cx-pannello", role: "dialog", ariaLabel: "Personalizza" }, `
    <h4>Personalizza</h4>
    <label>Colore maglia</label>
    <div class="cx-swatches">${Object.entries(colori).map(([k, c]) => `<button class="cx-sw" data-a="${k}" style="background:${c}" title="${k}" aria-label="${k}"></button>`).join("")}</div>
    <label>Densità tabelle</label>
    <div class="cx-seg"><button data-d="comoda">Comoda</button><button data-d="compatta">Compatta</button></div>
    <label>Scorciatoie</label><div class="cx-seg"><button data-help>Mostra elenco (?)</button></div>`);
  const fab = el("div", { className: "cx-fab" });
  const top = el("button", { id: "cxTop", className: "cx-btn", title: "Torna su", ariaLabel: "Torna su" }, "↑");
  const imp = el("button", { className: "cx-btn", title: "Personalizza", ariaLabel: "Personalizza" }, "🎨");
  fab.append(top, imp);
  document.body.append(pannello, fab);
  const sync = () => {
    pannello.querySelectorAll("[data-a]").forEach((b) => b.classList.toggle("on", b.dataset.a === root.dataset.accento));
    pannello.querySelectorAll("[data-d]").forEach((b) => b.classList.toggle("on", b.dataset.d === root.dataset.densita));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colori[root.dataset.accento]);
  };
  imp.onclick = (e) => { e.stopPropagation(); pannello.classList.toggle("on"); };
  document.addEventListener("click", (e) => { if (!pannello.contains(e.target)) pannello.classList.remove("on"); });
  pannello.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]"), d = e.target.closest("[data-d]");
    if (a) { root.dataset.accento = a.dataset.a; ls("accento", a.dataset.a); }
    if (d) { root.dataset.densita = d.dataset.d; ls("densita", d.dataset.d); }
    if (e.target.closest("[data-help]")) aiuto.classList.add("on");
    sync();
  });
  sync();
  top.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
  addEventListener("scroll", () => top.classList.toggle("on", scrollY > 500), { passive: true });

  // --- aiuto scorciatoie ---
  const aiuto = el("div", { className: "cx-help" }, `<div><h3>Scorciatoie da tastiera</h3>
    <p><span>Cerca / vai a sezione</span><kbd>Ctrl/⌘ K</kbd></p><p><span>Dashboard</span><kbd>g</kbd> <kbd>d</kbd></p>
    <p><span>Tappe</span><kbd>g</kbd> <kbd>t</kbd></p><p><span>Corridori</span><kbd>g</kbd> <kbd>c</kbd></p>
    <p><span>Squadre</span><kbd>g</kbd> <kbd>s</kbd></p><p><span>Classifica generale</span><kbd>g</kbd> <kbd>k</kbd></p>
    <p><span>Cambia tema</span><kbd>t</kbd></p><p><span>Questo aiuto</span><kbd>?</kbd></p></div>`);
  aiuto.onclick = () => aiuto.classList.remove("on");
  document.body.append(aiuto);
  const mappa = { d: "dashboard", t: "tappe-elenco", c: "corridori-elenco", s: "squadre-elenco", k: "classifiche-tempo" };
  let g = 0;
  addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea,select,[contenteditable]") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") aiuto.classList.remove("on");
    else if (e.key === "?") aiuto.classList.toggle("on");
    else if (e.key === "t" && !g) document.querySelector(".tema-toggle")?.click();
    else if (e.key === "g") g = Date.now();
    else if (g && Date.now() - g < 1200 && mappa[e.key]) { document.querySelector(`.nav-item[data-view="${mappa[e.key]}"]`)?.click(); g = 0; }
  });

  // --- banner offline ---
  const off = el("div", { className: "cx-offline", role: "status" }, "Sei offline — i dati potrebbero non essere aggiornati");
  document.body.append(off);
  const stato = () => off.classList.toggle("on", !navigator.onLine);
  addEventListener("online", stato); addEventListener("offline", stato); stato();

  // --- routing via hash (#classifiche-tempo) ---
  const vaiHash = () => { const v = location.hash.slice(1); if (v) document.querySelector(`.nav-item[data-view="${v}"]`)?.click(); };
  document.querySelector(".nav")?.addEventListener("click", (e) => {
    const b = e.target.closest(".nav-item"); if (b) history.replaceState(null, "", "#" + b.dataset.view);
  });
  addEventListener("hashchange", vaiHash);
  setTimeout(vaiHash, 400);

  // --- tabelle: ordinamento e export CSV ---
  const valore = (td) => { const t = td.textContent.trim().replace(/\./g, "").replace(",", "."); const n = parseFloat(t); return /^[-+]?\d/.test(t) && !isNaN(n) ? n : td.textContent.trim().toLowerCase(); };
  const migliora = (tab) => {
    if (tab.dataset.cx) return; tab.dataset.cx = 1;
    tab.querySelectorAll("thead th:not(.th-azioni)").forEach((th, i) => {
      th.classList.add("cx-sort");
      th.addEventListener("click", () => {
        const dir = th.dataset.dir === "asc" ? "desc" : "asc";
        tab.querySelectorAll("th").forEach((x) => delete x.dataset.dir); th.dataset.dir = dir;
        const body = tab.tBodies[0], righe = [...body.rows];
        righe.sort((a, b) => { const x = valore(a.cells[i] || {textContent:""}), y = valore(b.cells[i] || {textContent:""}); return (x > y ? 1 : x < y ? -1 : 0) * (dir === "asc" ? 1 : -1); });
        righe.forEach((r) => body.append(r));
      });
    });
    const wrap = tab.closest(".tabella, .tabella-wrap, .table-wrap") || tab.parentElement;
    const bar = el("div", { className: "cx-tools" });
    const csv = el("button", { className: "cx-tool", type: "button" }, "⬇ Esporta CSV");
    const stampa = el("button", { className: "cx-tool", type: "button" }, "🖨 Stampa");
    csv.onclick = () => {
      const cols = [...tab.querySelectorAll("thead th")].map((t, i) => (t.classList.contains("th-azioni") ? -1 : i)).filter((i) => i >= 0);
      const q = (s) => `"${s.replace(/\s+/g, " ").trim().replace(/"/g, '""')}"`;
      const righe = [[...tab.tHead.rows[0].cells].filter((_, i) => cols.includes(i)).map((c) => q(c.textContent)).join(";")];
      [...tab.tBodies[0].rows].forEach((r) => righe.push(cols.map((i) => q(r.cells[i]?.textContent || "")).join(";")));
      const a = el("a", { download: `${(location.hash.slice(1) || "export")}.csv`, href: URL.createObjectURL(new Blob(["\ufeff" + righe.join("\n")], { type: "text/csv;charset=utf-8" })) });
      a.click(); URL.revokeObjectURL(a.href);
    };
    stampa.onclick = () => print();
    bar.append(csv, stampa); wrap.parentElement.insertBefore(bar, wrap);
  };
  let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => document.querySelectorAll(".content table").forEach(migliora), 120); })
    .observe(document.querySelector(".content") || document.body, { childList: true, subtree: true });

  // --- service worker (PWA) ---
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
