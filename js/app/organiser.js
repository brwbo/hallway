import { store, h, api, reducedMotion, timeLabel, download, MARIA_ASK, MARIA_ANSWERS, AHMED_ANSWERS } from "./common.js";
import { avatar, avatarStack, plainStack } from "./avatar.js";
import { mountFollowup } from "./followup.js";
import { normaliseCard } from "./company-form.js";
import { scheduleFor } from "./plan-data.js";
import { clock, buildIcs, buildCsv } from "/shared/schedule.js";

const ELINA = "Elina Virtanen";
const el = (id) => document.getElementById(id);
const sugList = el("sugs");

let event = null;
let floor = null;
let followup = null;
let suggestions = [];
let decisions = store.get("decisions", []);
let highlightId = null;
let fairness = null;
let blind = store.get("blind", false);

const localNeeds = () => { const n = store.get("needs"); return n && n.title ? n : null; };
const companyOf = (id) => event.companies.find((c) => c.id === id);
const candidateOf = (id) => event.candidates.find((c) => c.id === id);
const pName = (id) => (candidateOf(id) || {}).name || id;
const candNumber = (id) => event.candidates.findIndex((c) => c.id === id) + 1;
const revealed = (candidateId) => decisions.some((d) => d.candidate_id === candidateId && d.status === "accepted");
const hiddenNow = (candidateId) => blind && !revealed(candidateId);
const shownName = (id) => (hiddenNow(id) ? `Candidate ${candNumber(id)}` : pName(id));

function cName(id) {
  const c = companyOf(id);
  if (c) return c.name;
  const l = localNeeds();
  return l && l.company_id === id && l.company && l.company.name ? l.company.name : id;
}

function capacityOf(companyId) {
  const l = localNeeds();
  if (l && l.company_id === companyId && Number.isInteger(l.capacity)) return l.capacity;
  const c = companyOf(companyId);
  return (c && c.capacity) || 3;
}

function offersOf(companyId) {
  const l = localNeeds();
  if (l && l.company_id === companyId && Array.isArray(l.support)) return l.support;
  const c = companyOf(companyId);
  return (c && c.support) || [];
}

function wantsOf(candidateId) {
  if (candidateId === "p-ahmed") {
    const saved = store.get("wants");
    if (Array.isArray(saved)) return saved;
  }
  const c = candidateOf(candidateId);
  return (c && c.support_wanted) || [];
}

const acceptedCount = (companyId) => decisions.filter((d) => d.company_id === companyId && d.status === "accepted").length;

function mergeSuggestions() {
  const map = new Map();
  (event.suggestions || []).forEach((s) => map.set(s.id, s));
  store.get("suggestions", []).forEach((s) => map.set(s.id, s));
  suggestions = [...map.values()];
}

function decisionFor(id) {
  return decisions.find((d) => d.suggestion_id === id);
}

function renderLoad() {
  const ids = [...new Set(suggestions.map((s) => s.company_id))];
  const offeredMax = Math.max(0, ...ids.map((id) => suggestions.filter((s) => s.company_id === id).length));
  el("load").replaceChildren(
    h("p", { class: "label", text: "Conversations per company" }),
    ...ids.map((id) => {
      const used = acceptedCount(id);
      const cap = capacityOf(id);
      return h("div", { class: "load-row" },
        h("span", { class: "load-name", text: cName(id) }),
        h("span", { class: "track", role: "img", "aria-label": `${used} of ${cap} accepted` }, h("i", { class: "fill bar-acc", style: `transform:scaleX(${Math.min(1, used / cap)})` })),
        h("span", { class: "num fine", text: `${used} of ${cap}` }));
    }),
    h("p", { class: "fine", text: ids.length ? `Each company is offered at most ${offeredMax} people, not all ${event.candidates.length}, and takes only as many as it chose.` : "Suggestions appear here with each company’s limit." }));
}

function renderSuggestions() {
  el("sug-empty").hidden = suggestions.length > 0;
  sugList.replaceChildren(...suggestions.map((s) => {
    const d = decisionFor(s.id);
    const name = shownName(s.candidate_id);
    const title = `${cName(s.company_id)} and ${name}`;
    const company = companyOf(s.company_id) || { id: s.company_id, slot: 0, mark: (localNeeds() || {}).company && (localNeeds() || {}).company.mark };
    const wants = wantsOf(s.candidate_id);
    const offers = offersOf(s.company_id);
    const match = wants.filter((w) => offers.includes(w));
    const cap = capacityOf(s.company_id);
    const atLimit = !d && acceptedCount(s.company_id) >= cap;
    return h("li", { class: `suggest${s.id === highlightId ? " is-focus" : ""}`, "data-id": s.id, "data-company": s.company_id, "data-candidate": s.candidate_id },
      h("div", { class: "person-head" },
        hiddenNow(s.candidate_id) ? plainStack(String(candNumber(s.candidate_id)), company, { size: 56 }) : avatarStack(s.candidate_id, company, { size: 56 }),
        h("div", { class: "person-who" },
          h("h3", { text: name }),
          h("p", { class: "meta", text: `with ${cName(s.company_id)}` }))),
      h("p", { class: "meta", text: s.why }),
      wants.length ? h("p", { class: "meta support-line", text: `Asked for: ${wants.join(", ")}. ${match.length ? `Offered here: ${match.join(", ")}.` : "None of it is offered here."}` }) : null,
      h("p", { class: "ask", text: `Ask: ${s.opening_question}` }),
      d ? h("p", { class: `state${d.status === "skipped" ? " state-skip" : ""}`, text: d.status === "accepted" ? `Accepted by ${d.by}` : `Skipped by ${d.by}` })
        : h("div", { class: "row" },
          h("button", { class: "btn btn-primary btn-small", type: "button", disabled: atLimit, "aria-label": `Accept ${title}, decided by Elina`, onclick: () => decide(s, "accepted") }, "Accept"),
          h("button", { class: "btn btn-small", type: "button", "aria-label": `Skip ${title}, decided by Elina`, onclick: () => decide(s, "skipped") }, "Skip"),
          h("span", { class: "fine", text: atLimit ? `${cName(s.company_id)} is at its limit of ${cap}. Skip this one, or raise the limit on the company page.` : "Decided by Elina" })));
  }));
  renderLoad();
  if (floor) { try { floor.setSuggestions(suggestions); } catch {} }
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

function renderSchedule() {
  const items = scheduleFor(event);
  const root = el("schedule");
  if (!items.length) {
    root.replaceChildren(h("p", { class: "msg", text: "Accepted conversations get a time and a booth here." }));
    return;
  }
  root.replaceChildren(h("table", { class: "pilot pilot-even", "aria-label": "Schedule for the day" },
    h("thead", {}, h("tr", {}, ["Time", "Booth", "Company", "Candidate", "Question to ask"].map((t) => h("th", { scope: "col", text: t })))),
    h("tbody", {}, items.map((i) => h("tr", {},
      h("th", { scope: "row", text: i.start === null ? "No slot left" : `${clock(i.start)} to ${clock(i.end)}` }),
      h("td", { "data-col": "Booth", text: `Booth ${i.booth}` }),
      h("td", { "data-col": "Company", text: cName(i.company_id) }),
      h("td", { "data-col": "Candidate", text: pName(i.candidate_id) }),
      h("td", { "data-col": "Question to ask", text: i.question }))))));
}

function exportCsv() {
  const slots = new Map(scheduleFor(event).map((i) => [i.id, i]));
  const follow = store.get("followups", {});
  const rows = decisions.map((d) => {
    const slot = slots.get(d.suggestion_id);
    const f = follow[d.suggestion_id] || {};
    return { company: cName(d.company_id), candidate: shownName(d.candidate_id), decision: d.status, decided_by: d.by, decided_at: d.at, time: slot && slot.start !== null ? clock(slot.start) : "", booth: slot ? slot.booth : "", talked: f.talked || "", outcome: f.outcome || "", note: f.note || "" };
  });
  download("hallway-decisions.csv", buildCsv(rows), "text/csv");
}

function afterDecision() {
  renderSuggestions();
  renderLog();
  renderSchedule();
  renderFairness();
  if (followup) followup.refresh();
}

function decide(s, status) {
  if (decisionFor(s.id)) return;
  if (status === "accepted" && acceptedCount(s.company_id) >= capacityOf(s.company_id)) return;
  decisions.push({ suggestion_id: s.id, status, company_id: s.company_id, candidate_id: s.candidate_id, by: ELINA, at: new Date().toISOString() });
  store.set("decisions", decisions);
  if (s.id === highlightId) markStep(4, true);
  afterDecision();
  if (status === "accepted") {
    if (blind) remountFloor();
    else if (floor) { try { floor.connect(s.company_id, s.candidate_id); } catch {} }
  }
}

const pct = (n) => `${Math.round((n || 0) * 100)}%`;

function bar(cls, label, value) {
  return h("div", { class: "bar-line" },
    h("span", { class: "track", role: "img", "aria-label": `${label} ${pct(value)}` }, h("i", { class: `fill ${cls}`, style: `transform:scaleX(${Math.min(1, value || 0)})` })),
    h("span", { class: "num", text: pct(value) }));
}

function rowsOf(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : (x.rows || []);
}

function renderFairness() {
  const root = el("fair");
  if (!fairness) {
    root.replaceChildren(h("p", { class: "msg", text: "The fairness figures could not load. The shared module is missing." }));
    return;
  }
  let stats;
  try {
    stats = fairness.suggestionStats(suggestions, event.candidates, decisions);
  } catch (e) {
    root.replaceChildren(h("p", { class: "msg msg-error", text: "The fairness figures could not be worked out." }));
    return;
  }
  const titles = { country: "Country", language: "Language", education: "Education route" };
  root.replaceChildren(...Object.keys(titles).map((key) => {
    const rows = rowsOf(stats[key]);
    const isFlagged = (r) => r.gap === true || (r.gap && r.gap.flag) || r.under === true;
    const groupEl = (r) => {
      const flagged = isFlagged(r);
      const share = Math.round((r.pool || 0) * 100);
      return h("div", { class: "group" },
        h("div", { class: "group-name" }, h("span", { text: r.value }), h("span", { class: "num fine", text: `${share}% of pool` })),
        h("div", { class: "bars" }, bar("bar-pool", "Whole pool", r.pool), bar("bar-sug", "Suggested", r.suggested), bar("bar-acc", "Accepted", r.accepted)),
        flagged && suggestions.length ? h("p", { class: "gap-note", text: `${r.value} is ${share}% of the pool but ${pct(r.suggested)} of suggestions. Worth a second look.` }) : null);
    };
    const shown = new Set(rows.slice(0, 4));
    rows.filter(isFlagged).slice(0, 3).forEach((r) => shown.add(r));
    const first = rows.filter((r) => shown.has(r));
    const rest = rows.filter((r) => !shown.has(r));
    return h("div", { class: "fair-col" },
      h("h3", { text: titles[key] }),
      rows.length ? first.map(groupEl) : h("p", { class: "msg", text: "No figures yet." }),
      rest.length ? h("details", { class: "more" }, h("summary", { text: `Show ${rest.length} more` }), h("div", { class: "more-list" }, rest.map(groupEl))) : null);
  }));
}

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
    store.set("decisions", decisions);
    mergeSuggestions();
    const target = fresh.find((s) => s.candidate_id === "p-ahmed") || fresh[0];
    highlightId = target.id;
    afterDecision();
    if (floor) { try { floor.focusCompany(target.company_id); floor.focusCandidate(target.candidate_id); } catch {} }
    markStep(4);
    storyMsg(`Ahmed’s suggestion is in the list. Press Accept as ${ELINA}.`);
    const node = sugList.querySelector(`[data-id="${CSS.escape(target.id)}"]`);
    if (node) node.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
  } catch (e) {
    storyMsg(`${e.message} The story needs the server endpoints to be running.`, true);
  }
  btn.disabled = false;
}

function resetStory() {
  ["needs", "evidence", "suggestions", "decisions", "followups"].forEach((k) => store.del(k));
  decisions = [];
  highlightId = null;
  mergeSuggestions();
  markStep(0);
  storyMsg("");
  afterDecision();
  if (floor) { try { floor.clearConnections(); } catch {} }
}

function showFallback(reason) {
  el("floor-canvas").hidden = true;
  const fb = el("floor-fallback");
  fb.hidden = false;
  fb.replaceChildren(
    h("h3", { text: "The 3D floor is not available" }),
    h("p", { class: "meta", text: reason }),
    h("p", { class: "meta", text: "Companies" }),
    h("ul", {}, event.companies.map((c) => h("li", { text: `${c.name}, ${c.sector || ""}`.replace(/, $/, "") }))),
    h("p", { class: "meta", text: "Candidates" }),
    h("ul", {}, event.candidates.map((c) => h("li", { text: `${shownName(c.id)}, ${hiddenNow(c.id) ? "" : c.country || ""}`.replace(/, $/, "") }))));
}

async function mountFloor() {
  try {
    const mod = await import("/js/scene/floor.js");
    const people = event.candidates.map((c) => ({ ...c, name: shownName(c.id) }));
    floor = await mod.mountFloor(el("floor-canvas"), { companies: event.companies, candidates: people, reduced: reducedMotion() });
    floor.on("select", ({ type, id }) => {
      sugList.querySelectorAll(".suggest").forEach((li) => {
        li.classList.toggle("is-focus", li.dataset[type] === id);
      });
    });
    window.addEventListener("resize", () => { try { floor.resize(); } catch {} });
    decisions.filter((d) => d.status === "accepted").forEach((d) => floor.connect(d.company_id, d.candidate_id));
    floor.setSuggestions(suggestions);
    document.documentElement.dataset.floor = "ready";
  } catch (e) {
    floor = null;
    showFallback("The list beside it has everything you need.");
  }
}

async function remountFloor() {
  if (floor) { try { floor.destroy(); } catch {} floor = null; }
  const old = el("floor-canvas");
  const fresh = old.cloneNode(false);
  fresh.hidden = false;
  old.replaceWith(fresh);
  await mountFloor();
}

function getAccepted() {
  return decisions.filter((d) => d.status === "accepted").map((d) => {
    const s = suggestions.find((x) => x.id === d.suggestion_id);
    const name = pName(d.candidate_id);
    return { id: d.suggestion_id, candidateName: name, first: name.split(" ")[0], companyName: cName(d.company_id), question: s ? s.opening_question : "", organiser: ELINA };
  });
}

(async function init() {
  try {
    event = await api("/api/event");
  } catch (e) {
    el("floor-canvas").hidden = true;
    const fb = el("floor-fallback");
    fb.hidden = false;
    fb.replaceChildren(h("p", { class: "msg msg-error", text: `${e.message} The event data comes from the server, so the floor cannot show yet.` }));
    return;
  }
  try { fairness = await import("/shared/fairness.js"); } catch { fairness = null; }
  const blindBox = el("blind");
  blindBox.checked = blind;
  blindBox.addEventListener("change", () => {
    blind = blindBox.checked;
    store.set("blind", blind);
    afterDecision();
    remountFloor();
  });
  mergeSuggestions();
  followup = mountFollowup(el("followup"), { getAccepted });
  afterDecision();
  el("ics-all").addEventListener("click", () => download("hallway-schedule.ics", buildIcs(scheduleFor(event), { date: event.event.date }), "text/calendar"));
  el("csv").addEventListener("click", exportCsv);
  el("run").addEventListener("click", runStory);
  el("reset").addEventListener("click", resetStory);
  await mountFloor();
})();
