const DIMENSIONS = ["country", "language", "education"];

function valuesOf(candidate, dimension) {
  if (!candidate) return [];
  if (dimension === "language") return Array.isArray(candidate.languages) ? candidate.languages : [];
  const v = candidate[dimension];
  return v ? [v] : [];
}

function byShareThenName(a, b) {
  return b.share - a.share || String(a.value).localeCompare(String(b.value));
}

export function poolShare(poolStats) {
  const total = poolStats && poolStats.total ? poolStats.total : 0;
  const result = {};
  for (const dimension of DIMENSIONS) {
    const counts = (poolStats && poolStats["by_" + dimension]) || {};
    result[dimension] = Object.entries(counts)
      .map(([value, count]) => ({ value, share: total ? count / total : 0 }))
      .sort(byShareThenName);
  }
  return result;
}

function latestDecisions(decisions) {
  const latest = new Map();
  for (const d of decisions || []) {
    if (!d || !d.suggestion_id) continue;
    const raw = d.decision || d.status;
    const kind = raw === "accept" || raw === "accepted" ? "accept" : raw === "skip" || raw === "skipped" ? "skip" : null;
    if (kind) latest.set(d.suggestion_id, kind);
  }
  return latest;
}

function share(count, total) {
  return total ? count / total : 0;
}

export function suggestionStats(suggestions, candidates, decisions) {
  const list = suggestions || [];
  const pool = candidates || [];
  const byId = new Map(pool.map((c) => [c.id, c]));
  const latest = latestDecisions(decisions);
  const acceptedList = list.filter((s) => latest.get(s.id) === "accept");
  const result = {};
  for (const dimension of DIMENSIONS) {
    const poolCounts = new Map();
    for (const c of pool) for (const v of new Set(valuesOf(c, dimension))) poolCounts.set(v, (poolCounts.get(v) || 0) + 1);
    const countIn = (items) => {
      const counts = new Map();
      for (const s of items) {
        for (const v of new Set(valuesOf(byId.get(s.candidate_id), dimension))) counts.set(v, (counts.get(v) || 0) + 1);
      }
      return counts;
    };
    const suggestedCounts = countIn(list);
    const acceptedCounts = countIn(acceptedList);
    result[dimension] = [...poolCounts.entries()]
      .map(([value, n]) => {
        const poolFraction = share(n, pool.length);
        const suggested = share(suggestedCounts.get(value) || 0, list.length);
        return {
          value,
          pool: poolFraction,
          suggested,
          accepted: share(acceptedCounts.get(value) || 0, acceptedList.length),
          gap: list.length > 0 && suggested < poolFraction / 2,
        };
      })
      .sort((a, b) => b.pool - a.pool || String(a.value).localeCompare(String(b.value)));
  }
  return result;
}
