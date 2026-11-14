import { h } from "./common.js";

const pct = (n) => `${Math.round((n || 0) * 100)}%`;

function bar(cls, label, value) {
  return h("div", { class: "bar-line" },
    h("span", { class: "track", role: "img", "aria-label": `${label} ${pct(value)}` }, h("i", { class: `fill ${cls}`, style: `transform:scaleX(${Math.min(1, value || 0)})` })),
    h("span", { class: "num", text: pct(value) }));
}

const rowsOf = (x) => (!x ? [] : Array.isArray(x) ? x : (x.rows || []));

export function renderFairness(root, { fairness, suggestions, candidates, decisions }) {
  const MIN_GROUP = 3;
  if (!fairness) {
    root.replaceChildren(h("p", { class: "msg", text: "The fairness figures could not load. The shared module is missing." }));
    return;
  }
  let stats;
  try {
    stats = fairness.suggestionStats(suggestions, candidates, decisions);
  } catch {
    root.replaceChildren(h("p", { class: "msg msg-error", text: "The fairness figures could not be worked out." }));
    return;
  }
  const titles = { country: "Country", language: "Language", education: "Education route" };
  root.replaceChildren(...Object.keys(titles).map((key) => {
    const rows = rowsOf(stats[key]);
    const isFlagged = (r) => (r.gap === true || (r.gap && r.gap.flag) || r.under === true) && Math.round((r.pool || 0) * candidates.length) >= MIN_GROUP;
    const groupEl = (r) => {
      const share = Math.round((r.pool || 0) * 100);
      return h("div", { class: "group" },
        h("div", { class: "group-name" }, h("span", { text: r.value }), h("span", { class: "num fine", text: `${share}% of pool` })),
        h("div", { class: "bars" }, bar("bar-pool", "Whole pool", r.pool), bar("bar-sug", "Responded", r.suggested), bar("bar-acc", "Accepted", r.accepted)),
        isFlagged(r) && suggestions.length ? h("p", { class: "gap-note", text: `${r.value} is ${share}% of the pool but ${pct(r.suggested)} of responses so far. They may not have been asked yet.` }) : null);
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
