import { h } from "./common.js";
import { companyMark } from "./avatar.js";

const dayLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function invitation(inv, ctx) {
  const stall = inv.company.stall ? `Stall ${inv.company.stall}` : "their stall";
  const tasks = ((inv.needs && inv.needs.tasks) || []).filter(Boolean).slice(0, 3);
  const quotes = ((inv.evidence && inv.evidence.in_their_words) || []).slice(0, 2);
  return h("li", { class: "invite" },
    h("div", { class: "person-head" },
      companyMark(inv.company, { size: 56 }),
      h("div", { class: "person-who" },
        h("h3", { text: `${inv.companyName} wants to speak to you` }),
        h("p", { class: "invite-where", text: `${stall} at ${ctx.event.name}, ${dayLabel(ctx.event.date)}` }))),
    inv.needs && inv.needs.title ? h("div", {}, h("h4", { text: "What they are looking for" }), h("p", { class: "meta", text: inv.needs.title }), tasks.length ? h("ul", { class: "plain" }, tasks.map((t) => h("li", { text: t }))) : null) : null,
    quotes.length ? h("div", {}, h("h4", { text: "What caught their eye, in your words" }), h("ul", { class: "quotes" }, quotes.map((q) => h("li", {}, h("blockquote", { text: q }))))) : null,
    inv.question ? h("div", {}, h("h4", { text: "They may start by asking" }), h("p", { class: "ask", text: inv.question })) : null,
    h("p", { class: "fine", text: `${ctx.organiser} chose this conversation. You can say no, and nothing is recorded about you if you do.` }));
}

export function mountSeeker({ pick, list, empty }, ctx) {
  const draw = () => {
    const id = pick.value;
    const mine = ctx.invitationsFor(id);
    empty.hidden = mine.length > 0;
    if (!mine.length) empty.textContent = "No invitations yet. When the organiser accepts a conversation, the company and its stall show up here.";
    list.replaceChildren(...mine.map((inv) => invitation(inv, ctx)));
  };
  pick.addEventListener("change", draw);
  return {
    refresh() {
      const keep = pick.value;
      const withInvites = ctx.candidates.filter((c) => ctx.invitationsFor(c.id).length);
      const order = [...withInvites, ...ctx.candidates.filter((c) => !withInvites.includes(c))];
      pick.replaceChildren(...order.map((c) => h("option", { value: c.id, text: withInvites.includes(c) ? `${c.name}, ${ctx.invitationsFor(c.id).length} invitation${ctx.invitationsFor(c.id).length === 1 ? "" : "s"}` : c.name })));
      pick.value = order.some((c) => c.id === keep) ? keep : (order[0] && order[0].id) || "";
      draw();
    },
    show(id) {
      if ([...pick.options].some((o) => o.value === id)) { pick.value = id; draw(); }
    },
  };
}
