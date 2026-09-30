// Layer moderno: tema chiaro/scuro persistente, progress di lettura, count-up sulle statistiche
(() => {
  const root = document.documentElement;
  const salvato = localStorage.getItem("tema") || (matchMedia("(prefers-color-scheme: dark)").matches ? "scuro" : "chiaro");
  const applica = (t) => { root.dataset.tema = t; localStorage.setItem("tema", t); btn && (btn.textContent = t === "scuro" ? "☀️" : "🌙"); };
  root.dataset.tema = salvato;
  const btn = Object.assign(document.createElement("button"), { className: "tema-toggle", type: "button", title: "Cambia tema", ariaLabel: "Cambia tema" });
  btn.onclick = () => applica(root.dataset.tema === "scuro" ? "chiaro" : "scuro");
  const bar = Object.assign(document.createElement("div"), { className: "cx-progress" });
  document.body.appendChild(bar);
  (document.querySelector(".topbar-actions") || document.body).appendChild(btn);
  applica(salvato);
  const p = () => { const h = root.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
  addEventListener("scroll", p, { passive: true });
  // count-up dei numeri nelle statistiche quando compaiono
  const anima = (el) => {
    const fine = parseInt(el.textContent.replace(/\D/g, ""), 10);
    if (!Number.isFinite(fine) || fine < 2 || el.dataset.cx) return;
    el.dataset.cx = 1; const t0 = performance.now(), suffisso = el.textContent.replace(/[\d.,]/g, "");
    const passo = (t) => { const k = Math.min((t - t0) / 700, 1); el.textContent = Math.round(fine * (1 - Math.pow(1 - k, 3))) + suffisso; k < 1 && requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  };
  new MutationObserver(() => document.querySelectorAll(".statistica .numero").forEach(anima)).observe(document.body, { childList: true, subtree: true });
})();
