import { h } from "./common.js";
import { avatarStack, managerKey, managerKeyFromName } from "./avatar.js";
import { LEVELS, MODES, labelOf } from "./options.js";

const present = (list) => (list || []).filter((x) => x && String(x).trim());

export function needCard(card, { reveal = false, tilt = "tilt-a", after = null, event = null, size = 60 } = {}) {
  const own = card.company || null;
  const known = event && event.companies ? event.companies.find((c) => c.id === card.company_id) : null;
  const name = (own && own.name) || (known && known.name) || "The company";
  const manager = (own && own.manager) || (known && known.manager) || "";
  const sector = (own && own.sector) || (known && known.sector) || "";
  const markCompany = { id: card.company_id, slot: known ? known.slot : 0, mark: own && own.mark };
  const personKey = manager ? managerKeyFromName(manager) : managerKey(card.company_id);
  const R = (props = {}) => (reveal ? { "data-reveal": "", ...props } : props);

  const tasks = present(card.tasks);
  const skills = (card.skills || []).filter((s) => s && s.label);
  const support = present(card.support);
  const roleLine = [labelOf(LEVELS, card.level), labelOf(MODES, card.work_mode)].filter(Boolean).join(" · ");
  const where = [card.location, card.languages && card.languages.length ? `Languages: ${card.languages.join(", ")}` : ""].filter(Boolean).join(". ");

  const article = h("article", { class: `paper ${tilt}`, "aria-label": "Needs card" },
    h("div", R({ class: "person-head" }),
      avatarStack(personKey, markCompany, { size }),
      h("div", { class: "person-who" },
        h("p", { class: "who", text: name }),
        h("p", { class: "meta", text: [manager ? `${manager}, hiring manager` : "", sector].filter(Boolean).join(" · ") }))),
    h("h2", R({ class: "need-title", text: card.title })),
    roleLine ? h("p", R({ class: "meta role-line", text: roleLine })) : null,
    card.summary ? h("p", R({ text: card.summary })) : null,
    tasks.length ? h("div", R(), h("h3", { text: "What the person would do" }), h("ul", { class: "plain" }, tasks.map((t) => h("li", { text: t })))) : null,
    skills.length ? h("div", R(),
      h("h3", { text: "Skills" }),
      h("ul", { class: "chips", "aria-label": "Skills" }, skills.map((s) => h("li", { class: `chip${s.priority === "nice" ? " chip-nice" : ""}` }, s.label, s.priority === "nice" ? h("span", { class: "visually-hidden", text: " (nice to have)" }) : null))),
      skills.some((s) => s.priority === "nice") ? h("p", { class: "fine", text: "Outlined skills are nice to have." }) : null) : null,
    where ? h("p", R({ class: "meta", text: `Where: ${where}` })) : null,
    card.culture ? h("p", R({ class: "meta", text: `How we work: ${card.culture}` })) : null,
    Number.isInteger(card.capacity) ? h("p", R({ class: "meta", text: `Can take up to ${card.capacity} conversation${card.capacity === 1 ? "" : "s"} at the event.` })) : null,
    support.length ? h("div", R(), h("h3", { text: "Support for people moving to Finland" }), h("ul", { class: "plain" }, support.map((t) => h("li", { text: t })))) : null);
  if (after) {
    if (reveal) after.setAttribute("data-reveal", "");
    article.append(after);
  }
  return article;
}
