import { h, api } from "./common.js";
import { companyMark, MARK_COUNT, MARK_COLOR_NAMES, MARK_ICON_NAMES } from "./avatar.js";
import { LEVELS, MODES, LANGS, SUPPORT, MAX_TASKS, MAX_SKILLS, MAX_QUESTIONS } from "./options.js";

const STARTER_QUESTIONS = [
  "What would you look at first in your first week, and why?",
  "Tell us about something you built or fixed, and what you learned from it."
];

export function defaultCompany() {
  return { name: "Tuulia Software Oy", sector: "Payments software", manager: "Maria Lehtonen", mark: { color: 0, icon: 0 } };
}

function guessMode(location) {
  const text = String(location || "").toLowerCase();
  if (/remote/.test(text) && /(office|site|espoo|hybrid)/.test(text)) return "hybrid";
  if (/remote/.test(text)) return "remote";
  return "hybrid";
}

const asIndex = (n, fallback) => (Number.isInteger(n) ? ((n % MARK_COUNT) + MARK_COUNT) % MARK_COUNT : fallback);

export function normaliseCard(card) {
  const base = defaultCompany();
  const own = card.company || {};
  const mark = own.mark || {};
  const clean = (s) => String(s || "").trim();
  return {
    company_id: card.company_id || "c-custom",
    title: clean(card.title) || "Untitled role",
    summary: clean(card.summary),
    tasks: (Array.isArray(card.tasks) ? card.tasks : []).slice(0, MAX_TASKS).map(String),
    skills: (Array.isArray(card.skills) ? card.skills : []).slice(0, MAX_SKILLS)
      .map((s) => (typeof s === "string" ? { label: s } : s))
      .filter((s) => s && s.label)
      .map((s) => ({ label: String(s.label), esco_uri: s.esco_uri || null, priority: s.priority === "nice" ? "nice" : "must" })),
    languages: (Array.isArray(card.languages) ? card.languages : []).map(String),
    location: clean(card.location),
    work_mode: MODES.some(([v]) => v === card.work_mode) ? card.work_mode : guessMode(card.location),
    level: LEVELS.some(([v]) => v === card.level) ? card.level : "some",
    capacity: Number.isInteger(card.capacity) && card.capacity >= 1 && card.capacity <= 5 ? card.capacity : 3,
    culture: clean(card.culture).slice(0, 200),
    support: (Array.isArray(card.support) ? card.support : []).map(String),
    questions: (Array.isArray(card.questions) ? card.questions : [])
      .filter((q) => q && clean(q.text)).slice(0, MAX_QUESTIONS).map((q, i) => ({ id: `q${i + 1}`, text: clean(q.text) })),
    company: {
      name: clean(own.name) || base.name,
      sector: own.sector === undefined ? base.sector : clean(own.sector),
      manager: clean(own.manager) || base.manager,
      mark: { color: asIndex(mark.color, base.mark.color), icon: asIndex(mark.icon, base.mark.icon) }
    }
  };
}

export function blankCard() {
  return normaliseCard({
    company_id: "c-custom",
    title: "The role you are hiring for",
    summary: "",
    tasks: ["Describe the first thing this person would work on"],
    skills: [],
    languages: ["English"],
    location: "Espoo",
    work_mode: "hybrid",
    level: "some",
    questions: STARTER_QUESTIONS.map((text, i) => ({ id: `q${i + 1}`, text })),
    company: defaultCompany()
  });
}

export function forApi(card) {
  const filled = (list) => (list || []).map((x) => String(x).trim()).filter(Boolean);
  return {
    company_id: card.company_id,
    title: card.title,
    summary: card.summary,
    tasks: filled(card.tasks).slice(0, MAX_TASKS),
    skills: (card.skills || []).filter((s) => s.label).map((s) => ({ label: s.label, esco_uri: s.esco_uri || null })),
    languages: filled(card.languages),
    location: card.location
  };
}

let uid = 0;
const nid = (prefix) => `${prefix}-${++uid}`;

function textField(label, value, onInput, { max = 80, multiline = false, hint = "" } = {}) {
  const id = nid("f");
  const input = multiline ? h("textarea", { id, rows: "3", maxlength: String(max) }) : h("input", { id, type: "text", maxlength: String(max) });
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  return h("div", { class: "field" }, h("label", { for: id, text: label }), input, hint ? h("p", { class: "fine", text: hint }) : null);
}

export function choiceGroup(legend, type, name, options, isOn, onPick) {
  const row = h("div", { class: "choice-row" });
  options.forEach(([value, text]) => {
    const id = nid("c");
    const input = h("input", { type, name, id, value });
    input.checked = isOn(value);
    input.addEventListener("change", () => onPick(value, input.checked));
    row.append(h("span", { class: "choice-item" }, input, h("label", { for: id, text })));
  });
  return h("fieldset", { class: "choice" }, h("legend", { text: legend }), row);
}

function listEditor({ legend, hint, getItems, setItems, max, min = 0, addLabel, itemLabel, multiline = false }) {
  const rows = h("div", { class: "edit-list" });
  const add = h("button", { class: "btn btn-small", type: "button" }, addLabel);
  const draw = (focusIndex = -1) => {
    const items = getItems();
    rows.replaceChildren(...items.map((value, i) => {
      const id = nid("e");
      const input = multiline ? h("textarea", { id, rows: "2", maxlength: "300" }) : h("input", { id, type: "text", maxlength: "300" });
      input.value = value;
      input.addEventListener("input", () => { const next = getItems().slice(); next[i] = input.value; setItems(next); });
      const remove = h("button", { class: "btn btn-small", type: "button", "aria-label": `Remove ${itemLabel} ${i + 1}`, onclick: () => { const next = getItems().slice(); next.splice(i, 1); setItems(next); draw(Math.max(0, i - 1)); } }, "Remove");
      remove.disabled = items.length <= min;
      return h("div", { class: "edit-row" }, h("label", { class: "visually-hidden", for: id, text: `${itemLabel} ${i + 1}` }), input, remove);
    }));
    add.disabled = items.length >= max;
    if (focusIndex >= 0) { const target = rows.querySelectorAll("input, textarea")[focusIndex]; if (target) target.focus(); }
  };
  add.addEventListener("click", () => { setItems([...getItems(), ""]); draw(getItems().length - 1); });
  draw();
  return { node: h("div", { class: "field" }, h("p", { class: "label", text: legend }), hint ? h("p", { class: "fine", text: hint }) : null, rows, h("div", { class: "row" }, add)), redraw: draw };
}

export function mountCustomiser(root, card, { onChange, requestQuestions }) {
  const state = card;
  let timer = 0;
  const checklist = h("ul", { class: "check", "aria-label": "Card checklist" });
  const checklistTitle = h("p", { class: "label" });
  const drawChecklist = () => {
    const filled = (list) => (list || []).filter((x) => String(x).trim());
    const checks = [
      ["A clear job title", Boolean(state.title) && !/^(Untitled role|The role you are hiring for)$/.test(state.title)],
      ["Three real tasks", filled(state.tasks).length >= 3],
      ["At least three skills", state.skills.length >= 3],
      ["Languages and a place", state.languages.length > 0 && Boolean(state.location)],
      ["Questions for candidates", state.questions.length > 0],
      ["Support for people moving to Finland", state.support.length > 0]
    ];
    checklistTitle.textContent = `Card checklist: ${checks.filter(([, ok]) => ok).length} of ${checks.length} done`;
    checklist.replaceChildren(...checks.map(([label, ok]) => h("li", { class: ok ? "is-done" : "" },
      h("span", { class: "check-mark", "aria-hidden": "true" }),
      h("span", { text: label }),
      h("span", { class: "visually-hidden", text: ok ? " (done)" : " (to do)" }))));
  };
  const commit = () => { drawChecklist(); clearTimeout(timer); timer = setTimeout(() => onChange(state), 120); };

  const company = h("div", { class: "group" }, h("h3", { text: "Your company" }));
  company.append(
    textField("Company name", state.company.name, (v) => { state.company.name = v; commit(); }, { max: 60 }),
    textField("What the company does", state.company.sector, (v) => { state.company.sector = v; commit(); }, { max: 60, hint: "A few words, for example payments software." }),
    textField("Hiring manager", state.company.manager, (v) => { state.company.manager = v; commit(); }, { max: 60 }));

  const marks = h("div", { class: "mark-pickers" });
  const drawMarks = (focusKind = "", focusValue = -1) => {
    const group = (kind, legend, names) => {
      const row = h("div", { class: "choice-row" });
      names.forEach((label, i) => {
        const id = nid("m");
        const input = h("input", { type: "radio", name: `mark-${kind}`, id, value: String(i) });
        input.checked = state.company.mark[kind] === i;
        input.addEventListener("change", () => { state.company.mark[kind] = i; drawMarks(kind, i); commit(); });
        const preview = companyMark({ mark: { color: kind === "color" ? i : state.company.mark.color, icon: kind === "icon" ? i : state.company.mark.icon } }, { size: 36 });
        row.append(h("span", { class: "choice-item choice-mark" }, input, h("label", { for: id, "aria-label": label }, preview)));
      });
      return h("fieldset", { class: "choice" }, h("legend", { text: legend }), row);
    };
    marks.replaceChildren(group("color", "Badge colour", MARK_COLOR_NAMES), group("icon", "Badge shape", MARK_ICON_NAMES));
    if (focusKind) { const target = marks.querySelector(`input[name="mark-${focusKind}"][value="${focusValue}"]`); if (target) target.focus(); }
  };
  drawMarks();
  company.append(marks);

  const role = h("div", { class: "group" }, h("h3", { text: "The role" }));
  const tasks = listEditor({ legend: "What the person would do", hint: "Up to five. Plain sentences work best.", getItems: () => state.tasks, setItems: (items) => { state.tasks = items; commit(); }, max: MAX_TASKS, min: 1, addLabel: "Add a task", itemLabel: "Task" });
  role.append(
    textField("Job title", state.title, (v) => { state.title = v; commit(); }, { max: 160 }),
    textField("In a sentence or two", state.summary, (v) => { state.summary = v; commit(); }, { max: 600, multiline: true }),
    choiceGroup("Experience wanted", "radio", "level", LEVELS, (v) => state.level === v, (v) => { state.level = v; commit(); }),
    tasks.node);

  const skillsGroup = h("div", { class: "group" }, h("h3", { text: "Skills" }));
  const skillList = h("ul", { class: "skill-edit", "aria-label": "Skills" });
  const skillStatus = h("p", { class: "fine", role: "status" });
  const skillId = nid("s");
  const skillInput = h("input", { id: skillId, type: "text", maxlength: "80", placeholder: "For example: network security" });
  const skillAdd = h("button", { class: "btn btn-small", type: "button" }, "Add skill");
  const drawSkills = () => {
    skillList.replaceChildren(...state.skills.map((s, i) => h("li", { class: "skill-row" },
      h("span", { class: "skill-name", text: s.label }),
      h("button", { class: "btn btn-small btn-toggle", type: "button", "aria-pressed": s.priority === "must" ? "true" : "false", onclick: () => { s.priority = s.priority === "must" ? "nice" : "must"; drawSkills(); commit(); } }, s.priority === "must" ? "Must have" : "Nice to have"),
      h("button", { class: "btn btn-small", type: "button", "aria-label": `Remove ${s.label}`, onclick: () => { state.skills.splice(i, 1); drawSkills(); commit(); } }, "Remove"))));
    skillAdd.disabled = state.skills.length >= MAX_SKILLS;
  };
  const addSkill = async () => {
    const label = skillInput.value.trim();
    if (!label || state.skills.length >= MAX_SKILLS) return;
    skillAdd.disabled = true;
    skillStatus.textContent = "Looking it up...";
    let skill = { label, esco_uri: null, matched: false };
    try { skill = (await api("/api/skills", { label })).skill; } catch { skill = { label, esco_uri: null, matched: false }; }
    if (!state.skills.some((s) => s.label.toLowerCase() === skill.label.toLowerCase())) state.skills.push({ label: skill.label, esco_uri: skill.esco_uri || null, priority: "must" });
    skillStatus.textContent = skill.matched ? `Matched to the EU skills list as “${skill.label}”.` : "Added as you typed it. No match on the EU skills list.";
    skillInput.value = "";
    drawSkills();
    commit();
    skillInput.focus();
  };
  skillAdd.addEventListener("click", addSkill);
  skillInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } });
  drawSkills();
  skillsGroup.append(
    h("p", { class: "fine", text: "Mark each one as a must have or nice to have. Typed skills are matched to the EU skills list (ESCO)." }),
    skillList,
    h("div", { class: "field" }, h("label", { for: skillId, text: "Add a skill" }), h("div", { class: "edit-row" }, skillInput, skillAdd)),
    skillStatus);

  const where = h("div", { class: "group" }, h("h3", { text: "Where and how" }));
  const otherLangs = () => state.languages.filter((l) => !LANGS.includes(l)).join(", ");
  const setLangs = (known, other) => { state.languages = [...known, ...other.split(",").map((s) => s.trim()).filter(Boolean)]; commit(); };
  const knownLangs = () => state.languages.filter((l) => LANGS.includes(l));
  where.append(
    choiceGroup("Work pattern", "radio", "mode", MODES, (v) => state.work_mode === v, (v) => { state.work_mode = v; commit(); }),
    textField("Location", state.location, (v) => { state.location = v; commit(); }, { max: 120 }),
    choiceGroup("Languages you work in", "checkbox", "langs", LANGS.map((l) => [l, l]), (v) => state.languages.includes(v),
      (v, on) => { const known = knownLangs().filter((l) => l !== v); if (on) known.push(v); setLangs(known, otherLangs()); }),
    textField("Other languages", otherLangs(), (v) => setLangs(knownLangs(), v), { max: 80, hint: "Separate with commas." }),
    choiceGroup("Support you can offer people moving to Finland", "checkbox", "support", SUPPORT.map((s) => [s, s]), (v) => state.support.includes(v),
      (v, on) => { state.support = on ? [...state.support.filter((s) => s !== v), v] : state.support.filter((s) => s !== v); commit(); }));

  where.append(
    textField("How the team works", state.culture, (v) => { state.culture = v; commit(); }, { max: 200, multiline: true, hint: "One or two sentences about how people work together." }),
    choiceGroup("Conversations your team can take at the event", "radio", "capacity", [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]), (v) => String(state.capacity) === v, (v) => { state.capacity = Number(v); commit(); }));

  const qGroup = h("div", { class: "group" }, h("h3", { text: "Questions for candidates" }));
  const qStatus = h("p", { class: "fine", role: "status" });
  const qs = listEditor({
    legend: "What candidates will be asked",
    hint: "One to three. Candidates answer in their own words, and a person follows up in person.",
    getItems: () => state.questions.map((q) => q.text),
    setItems: (items) => { state.questions = items.map((text, i) => ({ id: `q${i + 1}`, text })); commit(); },
    max: MAX_QUESTIONS, min: 1, addLabel: "Add a question", itemLabel: "Question", multiline: true
  });
  const suggest = h("button", { class: "btn btn-small", type: "button" }, "Suggest new questions");
  const suggestQuestions = async (quiet) => {
    suggest.disabled = true;
    qStatus.textContent = "Writing questions from your card...";
    try {
      const items = (await requestQuestions(state)).filter(Boolean).slice(0, MAX_QUESTIONS);
      if (items.length) { state.questions = items.map((text, i) => ({ id: `q${i + 1}`, text })); qs.redraw(); commit(); qStatus.textContent = quiet ? "Suggested from your card. Change them as you like." : "New questions suggested."; }
    } catch { qStatus.textContent = "Could not suggest questions right now. Write your own above."; }
    suggest.disabled = false;
  };
  suggest.addEventListener("click", () => suggestQuestions(false));
  qGroup.append(qs.node, h("div", { class: "row" }, suggest), qStatus);

  root.replaceChildren(
    h("p", { class: "fine", text: "Every part of the card is yours to change. The card beside this updates as you type, and candidates see exactly that." }),
    h("div", { class: "field" }, checklistTitle, checklist),
    company, role, skillsGroup, where, qGroup);

  if (!state.questions.length) suggestQuestions(true);
  commit();
  return { state };
}
