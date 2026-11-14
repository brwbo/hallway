import event from "../data/event.json" with { type: "json" };
import needsCards from "../data/needs-cards.json" with { type: "json" };
import evidenceCards from "../data/evidence-cards.json" with { type: "json" };
import suggestions from "../data/suggestions.json" with { type: "json" };

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

export function eventPayload() {
  return {
    event: event.event,
    organiser: event.organiser,
    companies: event.companies,
    candidates: event.candidates,
    needs_cards: needsCards,
    evidence_cards: evidenceCards,
    suggestions,
    pool_stats: poolStats(event.candidates),
  };
}
