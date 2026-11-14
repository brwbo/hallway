import { store, h, api, chipList, reveal, AHMED_ANSWERS } from "./common.js";
import { avatarStack } from "./avatar.js";
import { needCard } from "./needcard.js";
import { forApi, normaliseCard, choiceGroup } from "./company-form.js";
import { SUPPORT, GUIDE_LINKS } from "./options.js";

const pick = document.getElementById("company-pick");
const need = document.getElementById("need");
const status = document.getElementById("status");
const qform = document.getElementById("qform");
const qs = document.getElementById("qs");
const evidence = document.getElementById("evidence");
const useAhmed = document.getElementById("use-ahmed");
const submit = document.getElementById("submit");

let event = null;
let questions = [];
let current = null;

function say(text, error = false) {
  status.textContent = text || "";
  status.hidden = !text;
  status.classList.toggle("msg-error", error);
}

function needFor(value) {
  const local = store.get("needs");
  if (value === "local" && local && local.title) return { card: normaliseCard(local), own: true };
  const card = event && event.needs_cards ? event.needs_cards[value] : null;
  return { card, own: false };
}

function companyName(id) {
  const c = event && event.companies.find((x) => x.id === id);
  return c ? c.name : id;
}

function renderNeed(card, own) {
  if (!card) {
    need.replaceChildren(h("p", { class: "msg", text: "This company has not written a needs card yet." }));
    return;
  }
  need.replaceChildren(needCard(card, { event, size: 52 }));
}

async function loadQuestions(card) {
  current = card;
  qform.hidden = true;
  evidence.replaceChildren();
  if (!card) { say(""); return; }
  say("Getting the questions...");
  try {
    const own = (card.questions || []).filter((q) => q && q.text);
    if (own.length) questions = own;
    else questions = (await api("/api/questions", { needs_card: forApi(card) })).questions || [];
    qs.replaceChildren(...questions.map((q, i) => h("div", { class: "field" },
      h("label", { for: `q${i}`, text: q.text }),
      h("textarea", { id: `q${i}`, rows: "4", "data-qid": q.id }))));
    say("");
    qform.hidden = false;
    const savedEv = store.get("evidence");
    if (savedEv && savedEv.company_id === card.company_id && savedEv.candidate_id === "p-ahmed") renderEvidence(savedEv, false);
  } catch (e) {
    say(`${e.message} The questions come from the server, so they cannot load yet.`, true);
  }
}

function renderEvidence(ev, fresh) {
  const wrap = h("article", { class: "paper tilt-b", "aria-label": "Evidence card" },
    h("div", { class: "person-head", "data-reveal": "" },
      avatarStack(ev.candidate_id || "p-ahmed", null, { size: 64 }),
      h("div", { class: "person-who" },
        h("p", { class: "who", text: "Ahmed Rahimi" }),
        h("p", { class: "meta", text: "Security graduate, moving to Finland" }),
        wantsNow().length ? h("p", { class: "meta", text: `Support asked for: ${wantsNow().join(", ")}` }) : null)),
    h("h3", { class: "need-title", "data-reveal": "", text: ev.headline }),
    h("ul", { class: "quotes", "data-reveal": "", "aria-label": "In his own words" },
      (ev.in_their_words || []).map((q) => h("li", {}, h("blockquote", { text: q })))),
    h("div", { "data-reveal": "" }, h("h3", { text: "Skills that came up" }), chipList(ev.skills, "Skills")),
    h("p", { class: "fine", "data-reveal": "", text: ev.note || "Not a score. A starting point for a conversation." }),
    h("div", { class: "after", "data-reveal": "" },
      h("p", { class: "fine", text: "Saved in this browser. A person will ask a follow-up in person." }),
      h("a", { class: "btn btn-primary", href: "organiser.html", text: "See it on the event page" })));
  evidence.replaceChildren(wrap);
  if (fresh) reveal(wrap);
  else wrap.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
}

const DEFAULT_WANTS = ["Relocation help", "Work permit guidance"];
const wantsNow = () => { const saved = store.get("wants"); return Array.isArray(saved) ? saved : DEFAULT_WANTS; };

function renderMoving() {
  const wantsEl = document.getElementById("wants");
  wantsEl.replaceChildren(choiceGroup("Support you would like", "checkbox", "wants", SUPPORT.map((x) => [x, x]), (v) => wantsNow().includes(v),
    (v, on) => { const next = on ? [...wantsNow().filter((x) => x !== v), v] : wantsNow().filter((x) => x !== v); store.set("wants", next); }));
  document.getElementById("guide").replaceChildren(...GUIDE_LINKS.map((g) => h("li", {},
    h("a", { href: g.href, target: "_blank", rel: "noopener" }, g.label),
    h("span", { class: "meta", text: g.note }))));
}

useAhmed.addEventListener("click", () => {
  questions.forEach((q, i) => {
    const ta = document.getElementById(`q${i}`);
    if (ta) ta.value = AHMED_ANSWERS[i % AHMED_ANSWERS.length];
  });
  submit.focus();
});

qform.addEventListener("submit", async (e) => {
  e.preventDefault();
  const answers = questions.map((q, i) => ({ question_id: q.id, question: q.text, answer: document.getElementById(`q${i}`).value.trim() }));
  if (answers.some((a) => !a.answer)) { say("Please answer every question, or use Ahmed’s example answers.", true); return; }
  say("Reading your answers...");
  submit.disabled = true;
  try {
    const data = await api("/api/evidence", { needs_card: forApi(current), answers, candidate_id: "p-ahmed" });
    const ev = data.evidence_card;
    ev.candidate_id = ev.candidate_id || "p-ahmed";
    ev.support_wanted = wantsNow();
    store.set("wants", wantsNow());
    store.set("evidence", ev);
    say("");
    renderEvidence(ev, true);
    evidence.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (er) {
    say(er.message, true);
  }
  submit.disabled = false;
});

pick.addEventListener("change", () => {
  const { card, own } = needFor(pick.value);
  renderNeed(card, own);
  loadQuestions(card);
});

(async function init() {
  renderMoving();
  say("Loading the event...");
  try {
    event = await api("/api/event");
  } catch (e) {
    const local = store.get("needs");
    if (local) {
      event = { companies: [{ id: local.company_id, name: "Tuulia Software Oy" }], needs_cards: {} };
    } else {
      say(`${e.message} The event data comes from the server, so this page cannot show a company yet.`, true);
      return;
    }
  }
  const local = store.get("needs");
  const hasLocal = Boolean(local && local.title);
  const options = event.companies.map((c) => h("option", { value: c.id, text: c.name }));
  if (hasLocal) options.unshift(h("option", { value: "local", text: `${(local.company && local.company.name) || "Your company"} (the card you made)` }));
  pick.replaceChildren(...options);
  pick.value = hasLocal ? "local" : (event.companies.some((c) => c.id === "c-tuulia") ? "c-tuulia" : event.companies[0].id);
  const { card, own } = needFor(pick.value);
  renderNeed(card, own);
  loadQuestions(card);
})();
