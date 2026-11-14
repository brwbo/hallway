import { store } from "./common.js";
import { buildSchedule } from "/shared/schedule.js";

const localNeeds = () => { const n = store.get("needs"); return n && n.title ? n : null; };

export function loadSuggestions(event) {
  const map = new Map();
  (event.suggestions || []).forEach((s) => map.set(s.id, s));
  store.get("suggestions", []).forEach((s) => map.set(s.id, s));
  return [...map.values()];
}

export function companyName(event, id) {
  const known = event.companies.find((c) => c.id === id);
  if (known) return known.name;
  const local = localNeeds();
  return local && local.company_id === id && local.company && local.company.name ? local.company.name : id;
}

export function candidateName(event, id) {
  const known = event.candidates.find((c) => c.id === id);
  return known ? known.name : id;
}

export function acceptedConversations(event) {
  const suggestions = loadSuggestions(event);
  return store.get("decisions", [])
    .filter((d) => d.status === "accepted")
    .map((d) => {
      const s = suggestions.find((x) => x.id === d.suggestion_id) || {};
      return { id: d.suggestion_id, company_id: d.company_id, candidate_id: d.candidate_id, at: d.at, by: d.by, question: s.opening_question || "", why: s.why || "" };
    });
}

export function scheduleFor(event) {
  const items = acceptedConversations(event).map((a) => ({
    ...a,
    title: `${companyName(event, a.company_id)}: conversation with ${candidateName(event, a.candidate_id)}`,
    description: `${a.question ? `Question to ask: ${a.question}\n` : ""}End by agreeing a next step: the best way to continue, and who to contact.`
  }));
  return buildSchedule(items, event.companies);
}
