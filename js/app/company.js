import { store, h, api, reveal, MARIA_ASK, MARIA_ANSWERS } from "./common.js";
import { needCard } from "./needcard.js";
import { mountCustomiser, normaliseCard, blankCard, forApi } from "./company-form.js";

const log = document.getElementById("log");
const form = document.getElementById("form");
const msg = document.getElementById("msg");
const send = document.getElementById("send");
const err = document.getElementById("err");
const cardEl = document.getElementById("card");
const customEl = document.getElementById("custom");
const customBody = document.getElementById("custom-body");
const useExample = document.getElementById("use-example");
const useAnswer = document.getElementById("use-answer");
const useBlank = document.getElementById("use-blank");

let messages = [];
let busy = false;
let done = false;
let answerIdx = 0;

function bubble(role, text, extra = "") {
  const el = h("p", { class: `bubble bubble-${role} ${extra}`.trim(), text });
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function showError(text) {
  err.textContent = text || "";
  err.hidden = !text;
}

function emptyCard() {
  cardEl.replaceChildren(h("div", { class: "paper paper-empty" },
    h("h2", { text: "The needs card will appear here" }),
    h("p", { class: "meta", text: "It fills in when the questions are answered, or start from a blank card." })));
}

function paintCard(card, fresh) {
  const after = h("div", { class: "after" },
    h("p", { class: "fine", text: "Saved in this browser. The next step is the candidate’s side." }),
    h("a", { class: "btn btn-primary", href: "candidate.html", text: "Now answer it as a candidate" }));
  const wrap = needCard(card, { reveal: true, tilt: "tilt-a", after });
  cardEl.replaceChildren(wrap);
  if (fresh) reveal(wrap);
  else wrap.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
}

function finish(raw, fresh) {
  const card = normaliseCard(raw);
  done = true;
  store.set("needs", card);
  paintCard(card, fresh);
  customEl.hidden = false;
  mountCustomiser(customBody, card, {
    onChange: (c) => { store.set("needs", c); paintCard(c, false); },
    requestQuestions: async (c) => ((await api("/api/questions", { needs_card: forApi(c) })).questions || []).map((q) => q.text)
  });
  form.hidden = true;
  useExample.textContent = "Start again";
  updateHelpers();
}

function setBusy(on) {
  busy = on;
  [send, useExample, useAnswer, useBlank, msg].forEach((el) => { el.disabled = on; });
}

function updateHelpers() {
  const asked = messages.length > 0;
  useExample.hidden = asked && !done;
  useAnswer.hidden = !asked || done;
  useBlank.hidden = asked || done;
  form.hidden = done;
}

async function turn(text) {
  if (busy || done || !text.trim()) return;
  showError("");
  messages.push({ role: "user", content: text.trim() });
  bubble("user", text.trim());
  msg.value = "";
  setBusy(true);
  const wait = bubble("assistant", "Thinking...", "bubble-wait");
  try {
    const data = await api("/api/needs", { messages, company_id: "c-tuulia" });
    wait.remove();
    messages.push({ role: "assistant", content: data.reply });
    bubble("assistant", data.reply);
    if (data.done && data.needs_card) finish(data.needs_card, true);
  } catch (e) {
    wait.remove();
    messages.pop();
    showError(`${e.message} Try again, or use Maria’s example once the server is running.`);
  }
  setBusy(false);
  updateHelpers();
  if (!done) msg.focus({ preventScroll: true });
}

form.addEventListener("submit", (e) => { e.preventDefault(); turn(msg.value); });
msg.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); turn(msg.value); } });
useExample.addEventListener("click", () => {
  if (done) { store.del("needs"); location.reload(); return; }
  msg.value = MARIA_ASK;
  turn(MARIA_ASK);
});
useAnswer.addEventListener("click", () => {
  const text = MARIA_ANSWERS[answerIdx % MARIA_ANSWERS.length];
  answerIdx += 1;
  msg.value = text;
  turn(text);
});
useBlank.addEventListener("click", () => {
  bubble("assistant", "Here is a blank card. Change any part of it, in the form below or beside it.");
  finish(blankCard(), true);
});

const saved = store.get("needs");
if (saved && saved.title) {
  bubble("assistant", "Your card from earlier is on the right. Start again to make a new one.");
  finish(saved, false);
} else {
  bubble("assistant", "Hello Maria. Tell me in your own words who you are looking for, or start from a blank card.");
  emptyCard();
}
updateHelpers();
