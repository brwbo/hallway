import { store, h, api, download } from "./common.js";
import { avatar } from "./avatar.js";
import { choiceGroup } from "./company-form.js";
import { scheduleFor, companyName, candidateName } from "./plan-data.js";
import { clock, buildIcs } from "/shared/schedule.js";

const el = (id) => document.getElementById(id);
let event = null;
let role = store.get("plan-role", "company");
let who = store.get("plan-who", "");

const mine = (all) => all.filter((i) => (role === "company" ? i.company_id : i.candidate_id) === who);

function evidenceFor(i) {
  const known = (event.evidence_cards && event.evidence_cards[i.candidate_id] && event.evidence_cards[i.candidate_id][i.company_id]) || null;
  if (known) return known;
  const saved = store.get("evidence");
  return saved && saved.candidate_id === i.candidate_id ? saved : null;
}

function needsFor(i) {
  const local = store.get("needs");
  if (local && local.title && local.company_id === i.company_id) return local;
  return (event.needs_cards && event.needs_cards[i.company_id]) || null;
}

function prep(i) {
  if (role === "company") {
    const ev = evidenceFor(i);
    const quotes = ev && (ev.in_their_words || []).slice(0, 2);
    return [
      quotes && quotes.length ? h("div", {}, h("h3", { text: "In their own words" }), h("ul", { class: "quotes" }, quotes.map((q) => h("li", {}, h("blockquote", { text: q }))))) : null,
      i.question ? h("div", {}, h("h3", { text: "A question to start with" }), h("p", { class: "ask", text: i.question })) : null
    ];
  }
  const need = needsFor(i);
  const tasks = need && (need.tasks || []).filter(Boolean).slice(0, 3);
  return [
    need ? h("div", {}, h("h3", { text: `What ${companyName(event, i.company_id)} is looking for` }), h("p", { class: "meta", text: need.title }), tasks && tasks.length ? h("ul", { class: "plain" }, tasks.map((t) => h("li", { text: t }))) : null) : null,
    i.question ? h("div", {}, h("h3", { text: "They may start by asking" }), h("p", { class: "ask", text: i.question })) : null
  ];
}

function card(i) {
  const partner = role === "company" ? candidateName(event, i.candidate_id) : companyName(event, i.company_id);
  const key = `${role}:${i.id}`;
  const notes = store.get("plan-notes", {});
  const area = h("textarea", { rows: "3", maxlength: "500", "aria-label": `Notes for ${partner}` });
  area.value = notes[key] || "";
  area.addEventListener("input", () => { const all = store.get("plan-notes", {}); all[key] = area.value; store.set("plan-notes", all); });
  return h("li", { class: "plan-card" },
    h("div", { class: "person-head" },
      role === "company" ? avatar(i.candidate_id, { size: 52 }) : null,
      h("div", { class: "person-who" },
        h("p", { class: "plan-time", text: i.start === null ? "No slot left" : `${clock(i.start)} to ${clock(i.end)}` }),
        h("p", { class: "meta", text: `${partner}, booth ${i.booth}` }))),
    ...prep(i),
    h("div", {}, h("h3", { text: "End with a next step" }), h("p", { class: "meta", text: "Before you part, agree the best way to continue and who to contact." })),
    h("div", { class: "field" }, h("p", { class: "label", text: "Your notes" }), area));
}

function draw() {
  const all = scheduleFor(event);
  const ids = [...new Set(all.map((i) => (role === "company" ? i.company_id : i.candidate_id)))];
  const select = el("who");
  if (!ids.includes(who)) who = ids[0] || "";
  select.replaceChildren(...ids.map((id) => h("option", { value: id, text: role === "company" ? companyName(event, id) : candidateName(event, id) })));
  select.value = who;
  select.disabled = ids.length === 0;
  const items = mine(all);
  el("plan").replaceChildren(...items.map(card));
  el("empty").hidden = all.length > 0;
  el("ics").hidden = items.length === 0;
  el("count").textContent = items.length ? `${items.length} conversation${items.length === 1 ? "" : "s"}, 15 minutes each, with lunch left free.` : "";
  store.set("plan-role", role);
  store.set("plan-who", who);
}

function drawRole() {
  el("role").replaceChildren(choiceGroup("I am", "radio", "role", [["company", "A company"], ["candidate", "A candidate"]], (v) => role === v, (v) => { role = v; who = ""; draw(); }));
}

el("who").addEventListener("change", (e) => { who = e.target.value; draw(); });
el("ics").addEventListener("click", () => {
  const items = mine(scheduleFor(event)).map((i) => ({
    ...i,
    title: role === "company" ? `Conversation with ${candidateName(event, i.candidate_id)}` : `Conversation with ${companyName(event, i.company_id)}`
  }));
  download("hallway-my-plan.ics", buildIcs(items, { date: event.event.date }), "text/calendar");
});

(async function init() {
  try { event = await api("/api/event"); } catch (e) {
    el("empty").hidden = false;
    el("empty").textContent = `${e.message} The event data comes from the server, so the plan cannot show yet.`;
    return;
  }
  drawRole();
  draw();
})();
