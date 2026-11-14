import table from "../data/esco-skills.json" with { type: "json" };

const SEARCH_URL = "https://ec.europa.eu/esco/api/search";
const TIMEOUT_MS = 4000;
const cache = new Map();

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

export function localMatch(label) {
  const wanted = norm(label);
  if (!wanted) return null;
  const exact = table.find((e) => norm(e.label) === wanted || e.keywords.some((k) => norm(k) === wanted));
  return exact ? { label: exact.label, esco_uri: exact.uri } : null;
}

export function skillsInText(textValue) {
  const haystack = ` ${norm(textValue)} `;
  return table.filter((e) => e.keywords.some((k) => haystack.includes(` ${norm(k)}`) || haystack.includes(norm(k)))).map((e) => e.label);
}

function overlaps(query, found) {
  const words = (s) => norm(s).split(/[^a-z0-9+#]+/).filter((w) => w.length >= 4);
  const f = norm(found);
  return words(query).some((w) => f.includes(w)) || f.includes(norm(query));
}

async function remoteLookup(label, fetchImpl) {
  const url = `${SEARCH_URL}?text=${encodeURIComponent(label)}&language=en&type=skill&limit=3`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = await response.json();
  const first = data && data._embedded && data._embedded.results && data._embedded.results[0];
  if (!first || typeof first.uri !== "string") return null;
  const preferred = (first.preferredLabel && (first.preferredLabel.en || Object.values(first.preferredLabel)[0])) || first.title;
  if (!overlaps(label, preferred)) return null;
  return { label: preferred, esco_uri: first.uri };
}

export async function lookupSkill(label, { fetchImpl = globalThis.fetch } = {}) {
  const clean = String(label || "").trim();
  if (!clean) return { label: "", esco_uri: null };
  const local = localMatch(clean);
  if (local) return local;
  const key = norm(clean);
  if (cache.has(key)) return cache.get(key);
  let result = { label: clean, esco_uri: null };
  try {
    const remote = await remoteLookup(clean, fetchImpl);
    if (remote) result = remote;
    cache.set(key, result);
  } catch {
    result = { label: clean, esco_uri: null };
  }
  return result;
}

export async function enrichSkills(skills, options) {
  const seen = new Set();
  const labels = (skills || []).map((s) => (typeof s === "string" ? s : s && s.label)).filter(Boolean).slice(0, 8);
  const resolved = await Promise.all(labels.map((l) => lookupSkill(l, options)));
  return resolved.filter((s) => {
    const k = norm(s.label);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function clearEscoCache() {
  cache.clear();
}
