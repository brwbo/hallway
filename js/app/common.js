document.documentElement.classList.add("js");

const PREFIX = "hallway:";

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
  },
  del(key) {
    try { localStorage.removeItem(PREFIX + key); } catch {}
  }
};

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export async function api(path, body) {
  const opts = body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  let res;
  try { res = await fetch(path, opts); } catch { throw new Error("Could not reach the server."); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || !data) throw new Error(data && data.error ? data.error : `The server answered ${res.status} for ${path}.`);
  noteMode(data.mode);
  return data;
}

export function noteMode(mode) {
  if (mode !== "scripted") return;
  const note = document.getElementById("demo-note");
  if (note) note.hidden = false;
}

export function chips(skills, className = "chip") {
  return (skills || []).map((s) => h("li", { class: className, text: s.label || s }));
}

export function chipList(skills, label) {
  return h("ul", { class: "chips", "aria-label": label }, chips(skills));
}

export function reveal(container) {
  const items = container.querySelectorAll("[data-reveal]");
  items.forEach((el, i) => {
    el.style.setProperty("--i", String(i));
    el.classList.remove("is-in");
  });
  requestAnimationFrame(() => requestAnimationFrame(() => items.forEach((el) => el.classList.add("is-in"))));
}

export function reducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export const MARIA_ASK = "we need a cybersecurity person";

export const MARIA_ANSWERS = [
  "Mostly card payment checks and the customer dashboard. We have never had someone own that.",
  "Someone who can review how we handle customer data and talk it through with our developers. A first year in the role is fine.",
  "Espoo office one day a week, the rest remote. English is fine, Finnish is not required."
];

export const AHMED_ANSWERS = [
  "In my final year I built a small web shop with weak spots on purpose, then attacked it myself and wrote down every way in. Fixing each one taught me more than the lectures did.",
  "I would ask how card data moves through the system and who can touch it, then read last month’s logs. I am new to Finland, so I would also ask who can teach me the local rules."
];
