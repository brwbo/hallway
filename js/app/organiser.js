import { store, h, api, reducedMotion, timeLabel, download, MARIA_ASK, MARIA_ANSWERS, AHMED_ANSWERS } from "./common.js";
import { avatar, avatarStack, plainStack } from "./avatar.js";
import { mountFollowup } from "./followup.js";
import { mountSeeker } from "./seeker.js";
import { renderFairness } from "./fairness-view.js";
import { normaliseCard } from "./company-form.js";
import { buildCsv } from "/shared/schedule.js";

const ELINA = "Elina Virtanen";
const HOME = "e-espoo-talent-day";
const el = (id) => document.getElementById(id);

let event = null;
let eventId = store.get("event", HOME);
let followup = null;
let seeker = null;
let fairness = null;
let suggestions = [];
let decisions = [];
let highlightId = null;
let blind = store.get("blind", false);
const filter = { status: "all", company: "all" };

const home = () => eventId === HOME;
const key = (base) => (home() ? base : `${base}:${eventId}`);
const localNeeds = () => { const n = home() ? store.get("needs") : null; return n && n.title ? n : null; };
const companyOf = (id) => event.companies.find((c) => c.id === id);
const candidateOf = (id) => event.candidates.find((c) => c.id === id);
const pName = (id) => (candidateOf(id) || {}).name || id;
const candNumber = (id) => event.candidates.findIndex((c) => c.id === id) + 1;
const revealed = (id) => decisions.some((d) => d.candidate_id === id && d.status === "accepted");
const hiddenNow = (id) => blind && !revealed(id);
const shownName = (id) => (hiddenNow(id) ? `Candidate ${candNumber(id)}` : pName(id));
const decisionFor = (id) => decisions.find((d) => d.suggestion_id === id);
const acceptedCount = (id) => decisions.filter((d) => d.company_id === id && d.status === "accepted").length;

function companyObj(id) {
  const known = companyOf(id);
  if (known) return known;
  const l = localNeeds();
  return { id, slot: 0, mark: l && l.company && l.company.mark };
}

function cName(id) {
  const c = companyOf(id);
  if (c) return c.name;
  const l = localNeeds();
  return l && l.company_id === id && l.company && l.company.name ? l.company.name : id;
}

function capacityOf(id) {
  const l = localNeeds();
  if (l && l.company_id === id && Number.isInteger(l.capacity)) return l.capacity;
  return (companyOf(id) || {}).capacity || 3;
}

function offersOf(id) {
  const l = localNeeds();
  if (l && l.company_id === id && Array.isArray(l.support)) return l.support;
  return (companyOf(id) || {}).support || [];
}

function wantsOf(id) {
  if (home() && id === "p-ahmed") {
    const saved = store.get("wants");
    if (Array.isArray(saved)) return saved;
  }
  return (candidateOf(id) || {}).support_wanted || [];
}

function evidenceFor(s) {
  const known = event.evidence_cards && event.evidence_cards[s.candidate_id] && event.evidence_cards[s.candidate_id][s.company_id];
  if (known) return known;
  const saved = home() ? store.get("evidence") : null;
  return saved && saved.candidate_id === s.candidate_id ? saved : null;
}

function needsFor(id) {
  const l = localNeeds();
  if (l && l.company_id === id) return l;
  return (event.needs_cards && event.needs_cards[id]) || null;
}

function mergeSuggestions() {
  const map = new Map();
  (event.suggestions || []).forEach((s) => map.set(s.id, s));
  if (home()) store.get("suggestions", []).forEach((s) => map.set(s.id, s));
  suggestions = [...map.values()];
}

const stateOf = (s) => (decisionFor(s.id) || {}).status || "waiting";
const STATE_TEXT = { waiting: "Waiting", accepted: "Accepted", skipped: "Skipped" };

function renderLoad() {
  const ids = [...new Set(suggestions.map((s) => s.company_id))].sort((a, b) => ((companyOf(a) || {}).stall || 99) - ((companyOf(b) || {}).stall || 99));
  const offeredMax = Math.max(0, ...ids.map((id) => suggestions.filter((s) => s.company_id === id).length));
  el("load").replaceChildren(
    h("p", { class: "label", text: "Conversations per company" }),
    ...ids.map((id) => {
      const used = acceptedCount(id);
      const cap = capacityOf(id);
      return h("div", { class: "load-row" },
        h("span", { class: "load-name", text: `${cName(id)}${(companyOf(id) || {}).stall ? `, stall ${companyOf(id).stall}` : ""}` }),
        h("span", { class: "track", role: "img", "aria-label": `${used} of ${cap} accepted` }, h("i", { class: "fill bar-acc", style: `transform:scaleX(${Math.min(1, used / cap)})` })),
        h("span", { class: "num fine", text: `${used} of ${cap}` }));
    }),
    h("p", { class: "fine", text: ids.length ? `Each company is offered at most ${offeredMax} people, not all ${event.candidates.length}, and takes only as many as it chose.` : "" }));
}

function visible() {
  return suggestions.filter((s) => (filter.status === "all" || stateOf(s) === filter.status) && (filter.company === "all" || s.company_id === filter.company));
}

function renderGrid() {
  const shown = visible();
  const accepted = decisions.filter((d) => d.status === "accepted").length;
  el("count").textContent = `${shown.length} of ${suggestions.length} responses shown. ${accepted} accepted.`;
  el("grid-empty").hidden = shown.length > 0;
  el("grid").replaceChildren(...shown.map((s) => {
    const st = stateOf(s);
    const name = shownName(s.candidate_id);
    const company = companyObj(s.company_id);
    return h("li", { class: `rcard is-${st}${s.id === highlightId ? " is-focus" : ""}`, "data-id": s.id },
      h("button", { class: "rcard-open", type: "button", "aria-haspopup": "dialog", "aria-label": `Open ${name} and ${cName(s.company_id)}, ${STATE_TEXT[st].toLowerCase()}`, onclick: () => openDetail(s.id) },
        hiddenNow(s.candidate_id) ? plainStack(String(candNumber(s.candidate_id)), company, { size: 56 }) : avatarStack(s.candidate_id, company, { size: 56 }),
        h("span", { class: "rcard-text" },
          h("span", { class: "rcard-name", text: name }),
          h("span", { class: "meta", text: `${cName(s.company_id)}${company.stall ? `, stall ${company.stall}` : ""}` }),
          h("span", { class: `badge badge-${st}`, text: STATE_TEXT[st] }))));
  }));
}

function renderLog() {
  el("log-empty").hidden = decisions.length > 0;
  el("decisions").replaceChildren(...decisions.slice().reverse().map((d) => h("tr", {},
    h("td", { text: d.status === "accepted" ? "Accepted" : "Skipped" }),
    h("td", {}, h("span", { class: "log-who" },
      hiddenNow(d.candidate_id) ? h("span", { class: "avatar-plain avatar-plain-sm", "aria-hidden": "true", text: String(candNumber(d.candidate_id)) }) : avatar(d.candidate_id, { size: 28 }),
      `${cName(d.company_id)} and ${shownName(d.candidate_id)}`)),
    h("td", { text: d.by }),
    h("td", { class: "num", text: timeLabel(d.at) }))));
}

function exportCsv() {
  const follow = store.get(key("followups"), {});
  const rows = decisions.map((d) => {
    const f = follow[d.suggestion_id] || {};
    return { company: cName(d.company_id), candidate: shownName(d.candidate_id), decision: d.status, decided_by: d.by, decided_at: d.at, stall: (companyOf(d.company_id) || {}).stall || "", talked: f.talked || "", outcome: f.outcome || "", note: f.note || "" };
  });
  download(`hallway-decisions-${eventId}.csv`, buildCsv(rows), "text/csv");
}

function getAccepted() {
  return decisions.filter((d) => d.status === "accepted").map((d) => {
    const s = suggestions.find((x) => x.id === d.suggestion_id);
    const name = pName(d.candidate_id);
    return { id: d.suggestion_id, candidateName: name, first: name.split(" ")[0], companyName: cName(d.company_id), eventName: event.event.name, question: s ? s.opening_question : "", organiser: ELINA };
  });
}

function invitationsFor(candidateId) {
  return decisions.filter((d) => d.status === "accepted" && d.candidate_id === candidateId).map((d) => {
    const s = suggestions.find((x) => x.id === d.suggestion_id) || { candidate_id: candidateId, company_id: d.company_id };
    return { company: companyObj(d.company_id), companyName: cName(d.company_id), needs: needsFor(d.company_id), evidence: evidenceFor(s), question: s.opening_question || "" };
  });
}

function refresh() {
  renderGrid();
  renderLoad();
  renderLog();
  renderFairness(el("fair"), { fairness, suggestions, candidates: event.candidates, decisions });
  if (followup) followup.refresh();
  if (seeker) seeker.refresh();
}

const detail = el("detail");

function section(title, ...kids) {
  return h("div", { class: "sheet-part" }, h("h3", { text: title }), ...kids);
}

function openDetail(id) {
  const s = suggestions.find((x) => x.id === id);
  if (!s) return;
  const d = decisionFor(s.id);
  const name = shownName(s.candidate_id);
  const company = companyObj(s.company_id);
  const title = `${cName(s.company_id)} and ${name}`;
  const wants = wantsOf(s.candidate_id);
  const match = wants.filter((w) => offersOf(s.company_id).includes(w));
  const cap = capacityOf(s.company_id);
  const atLimit = !d && acceptedCount(s.company_id) >= cap;
  const ev = hiddenNow(s.candidate_id) ? null : evidenceFor(s);
  const quotes = ev && (ev.in_their_words || []).slice(0, 2);
  const need = needsFor(s.company_id);
  const tasks = need && (need.tasks || []).filter(Boolean).slice(0, 3);
  detail.replaceChildren(
    h("div", { class: "sheet-head" },
      h("div", { class: "person-head" },
        hiddenNow(s.candidate_id) ? plainStack(String(candNumber(s.candidate_id)), company, { size: 72 }) : avatarStack(s.candidate_id, company, { size: 72 }),
        h("div", { class: "person-who" },
          h("h2", { id: "detail-h", text: name }),
          h("p", { class: "meta", text: `Responded to ${cName(s.company_id)}${company.stall ? `, stall ${company.stall}` : ""}` }))),
      h("button", { class: "btn btn-small", type: "button", onclick: () => detail.close() }, "Close")),
    section("Why this conversation", h("p", { text: s.why })),
    wants.length ? section("Support they asked for", h("p", { text: `${wants.join(", ")}. ${match.length ? `Offered here: ${match.join(", ")}.` : "None of it is offered here."}` })) : null,
    quotes && quotes.length ? section("In their own words", h("ul", { class: "quotes" }, quotes.map((q) => h("li", {}, h("blockquote", { text: q }))))) : null,
    need && need.title ? section(`What ${cName(s.company_id)} is looking for`, h("p", { class: "meta", text: need.title }), tasks && tasks.length ? h("ul", { class: "plain" }, tasks.map((t) => h("li", { text: t }))) : null) : null,
    section("A question to open with", h("p", { class: "ask", text: s.opening_question })),
    d ? h("p", { class: `state${d.status === "skipped" ? " state-skip" : ""}`, text: d.status === "accepted" ? `Accepted by ${d.by}. ${shownName(s.candidate_id)} can now see the invitation on the job seeker tab.` : `Skipped by ${d.by}. The job seeker is not told.` })
      : h("div", { class: "row" },
        h("button", { class: "btn btn-primary", type: "button", disabled: atLimit, "aria-label": `Accept ${title}, decided by Elina`, onclick: () => decide(s, "accepted") }, "Accept"),
        h("button", { class: "btn", type: "button", "aria-label": `Skip ${title}, decided by Elina`, onclick: () => decide(s, "skipped") }, "Skip"),
        h("span", { class: "fine", text: atLimit ? `${cName(s.company_id)} is at its limit of ${cap}. Skip this one, or raise the limit on the company page.` : "Decided by Elina" })));
  detail.showModal();
}

function decide(s, status) {
  if (decisionFor(s.id)) return;
  if (status === "accepted" && acceptedCount(s.company_id) >= capacityOf(s.company_id)) return;
  decisions.push({ suggestion_id: s.id, status, company_id: s.company_id, candidate_id: s.candidate_id, by: ELINA, at: new Date().toISOString() });
  store.set(key("decisions"), decisions);
  if (s.id === highlightId) markStep(4, true);
  const said = `${status === "accepted" ? "Accepted" : "Skipped"} ${cName(s.company_id)} and ${pName(s.candidate_id)}.`;
  detail.close();
  refresh();
  el("count").textContent = `${said} ${el("count").textContent}`;
  if (status === "accepted" && seeker) seeker.show(s.candidate_id);
}

detail.addEventListener("click", (e) => { if (e.target === detail) detail.close(); });

function markStep(n, finished) {
  el("steps").querySelectorAll("li").forEach((li) => {
    const i = Number(li.dataset.step);
    li.classList.toggle("is-done", i < n || (finished && i === n));
    li.classList.toggle("is-now", i === n && !finished);
  });
}

function storyMsg(text, error = false) {
  const m = el("story-msg");
  m.textContent = text || "";
  m.hidden = !text;
  m.classList.toggle("msg-error", error);
}

async function runStory() {
  const btn = el("run");
  btn.disabled = true;
  storyMsg("");
  try {
    markStep(1);
    storyMsg("Maria is describing the role...");
    let messages = [{ role: "user", content: MARIA_ASK }];
    let data = null;
    for (let i = 0; i < 6; i += 1) {
      data = await api("/api/needs", { messages });
      if (data.done && data.needs_card) break;
      messages = [...messages, { role: "assistant", content: data.reply }, { role: "user", content: MARIA_ANSWERS[i % MARIA_ANSWERS.length] }];
    }
    if (!data || !data.needs_card) throw new Error("The needs card was not finished.");
    const needs = data.needs_card;
    store.set("needs", normaliseCard(needs));
    markStep(2);
    storyMsg("Ahmed is answering the questions...");
    const q = await api("/api/questions", { needs_card: needs });
    const answers = q.questions.map((x, i) => ({ question_id: x.id, question: x.text, answer: AHMED_ANSWERS[i % AHMED_ANSWERS.length] }));
    const ev = (await api("/api/evidence", { needs_card: needs, answers })).evidence_card;
    ev.candidate_id = ev.candidate_id || "p-ahmed";
    store.set("evidence", ev);
    markStep(3);
    storyMsg("Looking for a conversation worth starting...");
    const sug = await api("/api/suggest", { needs_cards: [needs], evidence_cards: [ev] });
    const fresh = sug.suggestions || [];
    if (!fresh.length) throw new Error("No suggestion came back.");
    const saved = store.get("suggestions", []).filter((s) => !fresh.some((f) => f.id === s.id));
    store.set("suggestions", [...saved, ...fresh]);
    decisions = decisions.filter((d) => !fresh.some((f) => f.id === d.suggestion_id));
    store.set(key("decisions"), decisions);
    mergeSuggestions();
    const target = fresh.find((s) => s.candidate_id === "p-ahmed") || fresh[0];
    highlightId = target.id;
    filter.status = "all";
    filter.company = "all";
    el("f-status").value = "all";
    el("f-company").value = "all";
    refresh();
    markStep(4);
    storyMsg(`Ahmed’s response is in the grid. Open it and press Accept as ${ELINA}.`);
    const node = el("grid").querySelector(`[data-id="${CSS.escape(target.id)}"]`);
    if (node) node.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
  } catch (e) {
    storyMsg(`${e.message} This needs the server endpoints to be running.`, true);
  }
  btn.disabled = false;
}

function resetStory() {
  if (!home()) return;
  ["needs", "evidence", "suggestions", "decisions", "followups"].forEach((k) => store.del(k));
  decisions = [];
  highlightId = null;
  mergeSuggestions();
  markStep(0);
  storyMsg("");
  followup = mountFollowup(el("followup"), { getAccepted, storeKey: key("followups") });
  refresh();
}

function drawFilters() {
  const select = el("f-company");
  select.replaceChildren(h("option", { value: "all", text: "All companies" }), ...event.companies.map((c) => h("option", { value: c.id, text: `${c.name}, stall ${c.stall}` })));
  select.value = filter.company;
}

function drawEventMeta() {
  const when = new Date(`${event.event.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  el("event-meta").textContent = `${when}, ${event.event.venue}, ${event.event.format}. ${event.companies.length} stalls and ${event.candidates.length} people.`;
  const canStory = home();
  el("run").disabled = !canStory;
  el("reset").disabled = !canStory;
  if (!canStory) storyMsg("The live response is only available on Espoo Tech Talent Day.");
  else storyMsg("");
}

async function loadEvent(id) {
  event = await api(`/api/event?event=${encodeURIComponent(id)}`);
  eventId = event.event.id;
  store.set("event", eventId);
  decisions = store.get(key("decisions"), []);
  highlightId = null;
  filter.status = "all";
  filter.company = "all";
  el("f-status").value = "all";
  el("event-pick").replaceChildren(...event.events.map((e) => h("option", { value: e.id, text: e.name })));
  el("event-pick").value = eventId;
  mergeSuggestions();
  drawFilters();
  drawEventMeta();
  followup = mountFollowup(el("followup"), { getAccepted, storeKey: key("followups") });
  seeker = mountSeeker({ pick: el("seeker-pick"), list: el("invites"), empty: el("invites-empty") }, { event: event.event, organiser: ELINA, candidates: event.candidates, invitationsFor });
  markStep(0);
  refresh();
}

function setupTabs() {
  const tabs = [el("tab-org"), el("tab-seeker")];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      el(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
    store.set("tab", tab.id);
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); select(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true); }
      if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); }
      if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });
  const saved = tabs.find((t) => t.id === store.get("tab"));
  if (saved) select(saved);
}

(async function init() {
  setupTabs();
  try {
    await loadEventWithFallback();
  } catch (e) {
    el("grid").replaceChildren(h("li", { class: "msg msg-error", text: `${e.message} The event data comes from the server, so the grid cannot show yet.` }));
    return;
  }
  try { fairness = await import("/shared/fairness.js"); } catch { fairness = null; }
  refresh();
  const blindBox = el("blind");
  blindBox.checked = blind;
  blindBox.addEventListener("change", () => { blind = blindBox.checked; store.set("blind", blind); refresh(); });
  el("f-status").addEventListener("change", (e) => { filter.status = e.target.value; renderGrid(); });
  el("f-company").addEventListener("change", (e) => { filter.company = e.target.value; renderGrid(); });
  el("event-pick").addEventListener("change", (e) => loadEvent(e.target.value).catch((err) => storyMsg(err.message, true)));
  el("csv").addEventListener("click", exportCsv);
  el("run").addEventListener("click", runStory);
  el("reset").addEventListener("click", resetStory);
})();

async function loadEventWithFallback() {
  try { await loadEvent(eventId); } catch (e) { if (eventId !== HOME) await loadEvent(HOME); else throw e; }
}
