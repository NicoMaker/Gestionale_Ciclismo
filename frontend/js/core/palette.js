// Ricerca rapida (Ctrl/⌘ + K): salta a qualsiasi sezione cliccando la voce di menu corrispondente.
(() => {
  const voci = [...document.querySelectorAll(".nav-item[data-view]")].map(
    (b) => {
      let gruppo = "";
      for (let e = b.previousElementSibling; e; e = e.previousElementSibling)
        if (e.classList.contains("nav-title")) {
          gruppo = e.textContent.trim();
          break;
        }
      return {
        el: b,
        label: b.querySelector("span")?.textContent.trim() || b.dataset.view,
        gruppo,
      };
    },
  );
  const ov = document.createElement("div");
  ov.className = "cmdk-overlay";
  ov.hidden = true;
  ov.innerHTML = `<div class="cmdk" role="dialog" aria-label="Vai a…">
    <div class="cmdk-head"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input placeholder="Vai a una sezione…"/><kbd>Esc</kbd></div>
    <ul class="cmdk-list"></ul>
    <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> naviga</span><span><kbd>↵</kbd> apri</span></div></div>`;
  document.body.appendChild(ov);
  const input = ov.querySelector("input"),
    lista = ov.querySelector("ul");
  let mostrate = [],
    idx = 0;

  const disegna = () => {
    lista.innerHTML = mostrate.length
      ? mostrate
          .map(
            (v, n) =>
              `<li data-n="${n}" class="${n === idx ? "on" : ""}"><span>${v.label}</span><small>${v.gruppo}</small></li>`,
          )
          .join("")
      : '<li class="none">Nessun risultato</li>';
    lista.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  };
  const filtra = () => {
    const q = input.value.trim().toLowerCase();
    mostrate = voci
      .filter((v) => !q || (v.label + " " + v.gruppo).toLowerCase().includes(q))
      .slice(0, 12);
    idx = 0;
    disegna();
  };
  const apri = () => {
    ov.hidden = false;
    input.value = "";
    filtra();
    input.focus();
  };
  const chiudi = () => {
    ov.hidden = true;
  };
  const vai = (v) => {
    chiudi();
    v?.el.click();
  };

  input.addEventListener("input", filtra);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      idx =
        (idx + (e.key === "ArrowDown" ? 1 : -1) + mostrate.length) %
        (mostrate.length || 1);
      disegna();
    } else if (e.key === "Enter") vai(mostrate[idx]);
    else if (e.key === "Escape") chiudi();
  });
  lista.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-n]");
    if (li) vai(mostrate[li.dataset.n]);
  });
  ov.addEventListener("mousedown", (e) => e.target === ov && chiudi());
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      ov.hidden ? apri() : chiudi();
    }
  });

  const trigger = document.createElement("button");
  trigger.className = "cmdk-trigger";
  trigger.type = "button";
  trigger.ariaLabel = "Vai a…";
  trigger.innerHTML = "<span>Vai a…</span><kbd>Ctrl K</kbd>";
  trigger.onclick = apri;
  document.querySelector(".topbar-actions")?.prepend(trigger);
})();
