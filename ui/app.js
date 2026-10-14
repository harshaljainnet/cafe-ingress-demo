"use strict";

// Symbols are written as unicode escapes so the file is safe in any editor/encoding.
const RUPEE = "\u20B9";
const STAR = "\u2605";

const $ = (sel) => document.querySelector(sel);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// .NET sends 120.0 as 120 in JSON, so always format numbers ourselves.
const money = (n) => RUPEE + Number(n).toFixed(2);

// Small inline icons, one per category.
const ICONS = {
  coffee:
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18h28v10a12 12 0 0 1-12 12h-4A12 12 0 0 1 8 28V18z"/><path d="M36 21h3a5 5 0 0 1 0 10h-4"/><path d="M16 6c-2 3 2 4 0 8M24 6c-2 3 2 4 0 8"/></svg>',
  snacks:
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20c0-8 8-12 18-12s18 4 18 12z"/><path d="M6 27h36"/><path d="M8 34h32"/><path d="M8 34c0 5 4 7 8 7h16c4 0 8-2 8-7"/></svg>',
  desserts:
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 36V24h36v12z"/><path d="M6 24c0-6 8-10 18-10s18 4 18 10"/><path d="M24 14V8"/><circle cx="24" cy="6" r="2"/></svg>'
};

const state = {
  menu: null,
  offers: null,
  category: "All",
  log: [],
  tally: { "/menu": {}, "/offers": {} }
};

// ---------- API calls (always same origin, through the ingress) ----------

async function callApi(path) {
  const start = performance.now();
  let status = "ERR";
  let pod = "-";
  let data = null;
  try {
    const res = await fetch(path, { cache: "no-store" });
    status = res.status;
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();
    pod = data.pod || "-";
    state.tally[path][pod] = (state.tally[path][pod] || 0) + 1;
  } finally {
    const ms = Math.round(performance.now() - start);
    state.log.unshift({ path, status, ms, pod });
    state.log = state.log.slice(0, 14);
    renderPanel();
  }
  return data;
}

async function loadMenu() {
  try {
    state.menu = await callApi("/menu");
    renderMenu();
  } catch (e) {
    $("#menu-grid").innerHTML =
      '<p class="state error">Could not reach the menu service. Check that the cafe-menu pods are Ready.</p>';
  }
}

async function loadOffers() {
  try {
    state.offers = await callApi("/offers");
    renderOffers();
  } catch (e) {
    $("#offers").innerHTML =
      '<p class="state error">Could not reach the offers service. Check that the cafe-offers pods are Ready.</p>';
  }
}

async function sendBurst() {
  const btn = $("#refresh");
  btn.disabled = true;
  const jobs = [];
  for (let i = 0; i < 6; i++) {
    jobs.push(callApi("/menu").then((d) => { state.menu = d; }).catch(() => {}));
    jobs.push(callApi("/offers").then((d) => { state.offers = d; }).catch(() => {}));
  }
  await Promise.all(jobs);
  if (state.menu) renderMenu();
  if (state.offers) renderOffers();
  btn.disabled = false;
}

// ---------- rendering ----------

function renderOffers() {
  $("#offers-pod").textContent = "served by " + state.offers.pod;
  $("#offers").innerHTML = state.offers.offers
    .map(
      (o) => `
      <div class="offer">
        <div class="tag">${STAR} Deal</div>
        <div class="pct">${Number(o.discountPercent).toFixed(0)}%<small>OFF</small></div>
        <h3>${esc(o.title)}</h3>
        <p>${esc(o.description)}</p>
      </div>`
    )
    .join("");
}

function renderMenu() {
  const items = state.menu.items;
  $("#menu-pod").textContent = "served by " + state.menu.pod;

  const cats = ["All"].concat([...new Set(items.map((i) => i.category))]);
  $("#tabs").innerHTML = cats
    .map((c) => `<button type="button" data-cat="${esc(c)}" class="${c === state.category ? "on" : ""}">${esc(c)}</button>`)
    .join("");

  const shown = state.category === "All" ? items : items.filter((i) => i.category === state.category);
  $("#menu-grid").innerHTML = shown
    .map((i) => {
      const key = i.category.toLowerCase();
      return `
      <article class="card">
        <div class="art ${esc(key)}">${ICONS[key] || ""}</div>
        <div class="body">
          <div class="row"><h3>${esc(i.name)}</h3><span class="price">${money(i.price)}</span></div>
          <p>${esc(i.description)}</p>
          <span class="cat">${esc(i.category)}</span>
        </div>
      </article>`;
    })
    .join("");
}

// Same pod name always gets the same colour, so load balancing is easy to see.
function podColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return "hsl(" + h + " 70% 60%)";
}

function dot(name) {
  return '<span class="dot" style="background:' + podColor(name) + '"></span>';
}

function renderPanel() {
  const rows = [];
  Object.keys(state.tally).forEach((path) => {
    Object.keys(state.tally[path]).forEach((pod) => {
      rows.push(
        `<div class="t">${dot(pod)}<span>${esc(path)} &rarr; ${esc(pod)}</span><span class="n">${state.tally[path][pod]}</span></div>`
      );
    });
  });
  $("#tally").innerHTML = rows.join("");

  $("#log").innerHTML = state.log.length
    ? state.log
        .map((e) => {
          const ok = e.status === 200;
          return `<li>
            <div class="l1"><span>GET</span><span class="path">${esc(e.path)}</span>
              <span class="st ${ok ? "ok" : "bad"}">${esc(e.status)}</span><span class="ms">${e.ms} ms</span></div>
            <div class="l2">${e.pod === "-" ? "" : dot(e.pod)}<span>${esc(e.pod)}</span></div>
          </li>`;
        })
        .join("")
    : '<li class="empty">No calls yet.</li>';
}

// ---------- wire up ----------

document.addEventListener("DOMContentLoaded", () => {
  $("#tabs").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-cat]");
    if (!btn) return;
    state.category = btn.dataset.cat;
    if (state.menu) renderMenu();
  });
  $("#refresh").addEventListener("click", sendBurst);

  // Network calls drawer: hidden by default. Button or "N" toggles, X or Esc closes.
  const panel = $("#net-panel");
  const setPanel = (open) => {
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", String(!open));
    $("#net-toggle").setAttribute("aria-expanded", String(open));
  };
  const togglePanel = () => setPanel(!panel.classList.contains("open"));
  $("#net-toggle").addEventListener("click", togglePanel);
  $("#net-close").addEventListener("click", () => setPanel(false));
  document.addEventListener("keydown", (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === "Escape") setPanel(false);
    if (ev.key === "n" || ev.key === "N") togglePanel();
  });

  renderPanel();
  loadOffers();
  loadMenu();
});
