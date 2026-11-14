import event from "../data/event.json" with { type: "json" };
import events from "../data/events.json" with { type: "json" };
import needsCards from "../data/needs-cards.json" with { type: "json" };
import evidenceCards from "../data/evidence-cards.json" with { type: "json" };
import suggestions from "../data/suggestions.json" with { type: "json" };

export const DEFAULT_EVENT = event.event.id;

function tally(candidates, pick) {
  const counts = {};
  for (const c of candidates) for (const value of pick(c)) counts[value] = (counts[value] || 0) + 1;
  return counts;
}

export function poolStats(candidates) {
  return {
    total: candidates.length,
    by_country: tally(candidates, (c) => [c.country]),
    by_language: tally(candidates, (c) => c.languages),
    by_education: tally(candidates, (c) => [c.education]),
  };
}

export function eventList() {
  return events.map(({ id, name, date, format, venue }) => ({ id, name, date, format, venue }));
}

export function hasEvent(id) {
  return events.some((e) => e.id === id);
}

export function eventPayload(id = DEFAULT_EVENT) {
  const meta = events.find((e) => e.id === id);
  const inEvent = new Set(meta.company_ids);
  const companies = event.companies
    .filter((c) => inEvent.has(c.id))
    .map((c, index) => ({ ...c, slot: index, stall: index + 1 }));
  const companyIds = new Set(companies.map((c) => c.id));
  const picked = suggestions.filter((s) => companyIds.has(s.company_id));
  const candidateIds = new Set(picked.map((s) => s.candidate_id));
  const candidates = id === DEFAULT_EVENT ? event.candidates : event.candidates.filter((c) => candidateIds.has(c.id));
  const known = new Set(candidates.map((c) => c.id));
  const needs = {};
  for (const c of companies) if (needsCards[c.id]) needs[c.id] = needsCards[c.id];
  const evidence = {};
  for (const [cand, byCompany] of Object.entries(evidenceCards)) {
    if (!known.has(cand)) continue;
    const kept = Object.fromEntries(Object.entries(byCompany).filter(([cid]) => companyIds.has(cid)));
    if (Object.keys(kept).length) evidence[cand] = kept;
  }
  return {
    event: { id: meta.id, name: meta.name, date: meta.date, format: meta.format, venue: meta.venue },
    events: eventList(),
    organiser: event.organiser,
    companies,
    candidates,
    needs_cards: needs,
    evidence_cards: evidence,
    suggestions: picked,
    pool_stats: poolStats(candidates),
  };
}
