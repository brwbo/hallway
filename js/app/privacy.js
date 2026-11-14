import { h } from "./common.js";

const PREFIX = "hallway:";
const stored = document.getElementById("stored");
const wipe = document.getElementById("wipe");
const note = document.getElementById("wipe-msg");
let armed = false;

function keep() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        const value = localStorage.getItem(key) || "";
        out.push({ key, name: key.slice(PREFIX.length), size: value.length, preview: value.slice(0, 140) });
      }
    }
  } catch { return null; }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function render() {
  const items = keep();
  if (items === null) {
    stored.replaceChildren(h("p", { class: "msg", text: "This browser does not let the page read its storage, so nothing can be shown or deleted here." }));
    wipe.disabled = true;
    return;
  }
  wipe.disabled = items.length === 0;
  if (!items.length) {
    stored.replaceChildren(h("p", { class: "msg", text: "Nothing is stored in this browser." }));
    return;
  }
  stored.replaceChildren(h("table", { class: "pilot pilot-even", "aria-label": "Stored items" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Item" }), h("th", { scope: "col", text: "Size" }), h("th", { scope: "col", text: "Starts with" }))),
    h("tbody", {}, items.map((i) => h("tr", {},
      h("th", { scope: "row", text: i.name }),
      h("td", { "data-col": "Size", text: `${i.size.toLocaleString("en-GB")} characters` }),
      h("td", { "data-col": "Starts with", class: "stored-preview", text: i.preview + (i.size > 140 ? "…" : "") }))))));
}

wipe.addEventListener("click", () => {
  const items = keep() || [];
  if (!armed) {
    armed = true;
    wipe.textContent = `Yes, delete ${items.length} item${items.length === 1 ? "" : "s"}`;
    note.hidden = false;
    note.textContent = "This cannot be undone. Press the button again to confirm.";
    return;
  }
  items.forEach((i) => { try { localStorage.removeItem(i.key); } catch {} });
  armed = false;
  wipe.textContent = "Delete everything in this browser";
  note.hidden = false;
  note.textContent = `Deleted ${items.length} item${items.length === 1 ? "" : "s"}. This prototype keeps nothing on a server.`;
  render();
});

render();
