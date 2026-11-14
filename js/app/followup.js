import { store, h } from "./common.js";

const TALKED = [["", "Not recorded yet"], ["yes", "They talked"], ["no", "They did not meet"]];
const OUTCOMES = [["", "Not recorded yet"], ["next", "A next step was agreed"], ["more", "Needs more time"], ["fit", "Not the right fit"]];

const LINES = {
  next: "You agreed a next step, and I would be glad to help with it.",
  more: "It sounds like you both need a little more time, and I am happy to help you stay in touch.",
  fit: "It did not look like the right fit this time, and I hope the day was still useful.",
  "": "I hope the conversation was useful."
};

function draftFor(item, rec) {
  const note = (rec.note || "").trim();
  return `Hello ${item.first}, thank you for talking with ${item.companyName} at ${item.eventName}.${LINES[rec.outcome || ""]}${note ? ` ${note}` : ""}\n\nBest wishes,\n${item.organiser}`;
}

function select(label, options, value, onPick) {
  const id = `fu-${Math.random().toString(36).slice(2, 8)}`;
  const el = h("select", { id }, options.map(([v, text]) => h("option", { value: v, text })));
  el.value = value || "";
  el.addEventListener("change", () => onPick(el.value));
  return h("div", { class: "field" }, h("label", { for: id, text: label }), el);
}

export function mountFollowup(root, { getAccepted, storeKey = "followups" }) {
  const records = store.get(storeKey, {});
  const save = () => store.set(storeKey, records);

  function card(item) {
    const rec = records[item.id] || (records[item.id] = { talked: "", outcome: "", note: "", draft: "", edited: false });
    const draftEl = h("textarea", { rows: "6", maxlength: "900", "aria-label": `Follow-up note to ${item.candidateName}` });
    const status = h("p", { class: "fine", role: "status" });
    const syncDraft = () => {
      if (!rec.edited) rec.draft = draftFor(item, rec);
      draftEl.value = rec.draft;
      save();
    };
    draftEl.addEventListener("input", () => { rec.draft = draftEl.value; rec.edited = true; save(); });
    const noteId = `fu-${Math.random().toString(36).slice(2, 8)}`;
    const note = h("input", { id: noteId, type: "text", maxlength: "200" });
    note.value = rec.note || "";
    note.addEventListener("input", () => { rec.note = note.value; syncDraft(); });
    const copy = h("button", { class: "btn btn-small", type: "button" }, "Copy the note");
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(draftEl.value); status.textContent = "Copied. Nothing is sent from here, so you send it yourself."; }
      catch { draftEl.select(); status.textContent = "Select and copy the note above. Nothing is sent from here."; }
    });
    const reset = h("button", { class: "btn btn-small", type: "button" }, "Write it again");
    reset.addEventListener("click", () => { rec.edited = false; syncDraft(); status.textContent = "Rewritten from what you recorded."; });
    syncDraft();
    return h("li", { class: "followup-card" },
      h("h3", { text: `${item.candidateName} and ${item.companyName}` }),
      h("p", { class: "meta", text: item.question ? `Question to ask: ${item.question}` : "" }),
      h("div", { class: "followup-grid" },
        select("Did they talk?", TALKED, rec.talked, (v) => { rec.talked = v; save(); summary(); }),
        select("What happened next", OUTCOMES, rec.outcome, (v) => { rec.outcome = v; syncDraft(); summary(); }),
        h("div", { class: "field" }, h("label", { for: noteId, text: "A short note" }), note)),
      h("div", { class: "field" }, h("p", { class: "label", text: "Follow-up note, to edit and send yourself" }), draftEl),
      h("p", { class: "fine", text: "Send it within one to two days, while the conversation is still fresh." }),
      h("div", { class: "row" }, copy, reset),
      status);
  }

  const summaryEl = h("p", { class: "meta", role: "status" });
  const list = h("ul", { class: "list" });
  const empty = h("p", { class: "msg", text: "Accepted conversations appear here, so a person can record what happened and write the follow-up." });
  root.replaceChildren(summaryEl, list, empty, h("p", { class: "fine", text: "Hallway never sends a message. A person records the outcome and writes every follow-up." }));

  function summary() {
    const items = getAccepted();
    const recs = items.map((i) => records[i.id] || {});
    const talked = recs.filter((r) => r.talked === "yes").length;
    const next = recs.filter((r) => r.outcome === "next").length;
    summaryEl.textContent = items.length ? `${items.length} accepted. ${talked} talked. ${next} led to a next step.` : "";
  }

  function refresh() {
    const items = getAccepted();
    empty.hidden = items.length > 0;
    list.replaceChildren(...items.map(card));
    summary();
  }

  refresh();
  return { refresh };
}
