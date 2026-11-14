import { test } from "node:test";
import assert from "node:assert/strict";
import needs from "../api/needs.js";
import questions from "../api/questions.js";
import evidence from "../api/evidence.js";
import suggest from "../api/suggest.js";
import eventApi from "../api/event.js";
import skillsApi from "../api/skills.js";
import { call } from "./helpers.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;

async function runNeedsFlow(replies) {
  const messages = [{ role: "user", content: replies[0] }];
  let turns = 0;
  for (;;) {
    turns += 1;
    const { status, body } = await call(needs, { body: { messages } });
    assert.equal(status, 200);
    assert.equal(body.mode, "scripted");
    if (body.done) return { turns, body };
    assert.ok(turns < 6, "flow did not finish");
    messages.push({ role: "assistant", content: body.reply });
    messages.push({ role: "user", content: replies[turns] || "no preference" });
  }
}

test("scripted needs flow for the cast ask finishes within 4 turns with a full card", async () => {
  const { turns, body } = await runNeedsFlow(["we need a cybersecurity person", "Look at our login system", "A list of fixes we can act on", "English, hybrid"]);
  assert.ok(turns <= 4);
  assert.equal(body.needs_card.tasks.length, 3);
  assert.equal(body.needs_card.company_id, "c-tuulia");
  assert.ok(body.needs_card.skills.some((s) => s.esco_uri));
});

test("scripted needs flow works for an unrelated ask", async () => {
  const { turns, body } = await runNeedsFlow(["we need someone to help with our deliveries", "Plan Friday routes and fix late runs", "No late runs for two weeks", "Finnish, on site"]);
  assert.ok(turns <= 4);
  assert.equal(body.needs_card.tasks.length, 3);
  assert.equal(body.needs_card.location, "Espoo, on site");
  assert.deepEqual(body.needs_card.languages, ["Finnish"]);
});

test("needs asks at most 3 questions then finishes even with odd input", async () => {
  const { turns } = await runNeedsFlow(["help", "idk", "idk", "idk"]);
  assert.ok(turns <= 4);
});

test("evidence quotes are verbatim substrings of the answers", async () => {
  const card = (await call(eventApi, { method: "GET" })).body.needs_cards["c-tuulia"];
  const answers = [
    { question_id: "q1", question: "Where first?", answer: "I would start with the password reset page. Reset links can be guessable. I tried a stolen session cookie in my uni lab." },
    { question_id: "q2", question: "What next?", answer: "I would tell the developers the same day and ask them to hold the release!" },
  ];
  const { status, body } = await call(evidence, { body: { needs_card: card, answers, candidate_id: "p-ahmed" } });
  assert.equal(status, 200);
  assert.equal(body.mode, "scripted");
  const quotes = body.evidence_card.in_their_words;
  assert.ok(quotes.length >= 2 && quotes.length <= 4);
  for (const q of quotes) assert.ok(answers.some((a) => a.answer.includes(q)), `not verbatim: ${q}`);
  assert.equal(body.evidence_card.note, "Not a score. A starting point for a conversation.");
  assert.doesNotMatch(JSON.stringify(body), /"(score|rank|rating)"/i);
});

test("questions returns two questions", async () => {
  const card = (await call(eventApi, { method: "GET" })).body.needs_cards["c-kuura"];
  const { body } = await call(questions, { body: { needs_card: card } });
  assert.equal(body.questions.length, 2);
  assert.ok(body.questions.every((q) => q.id && q.text));
});

test("skills matches a known skill and keeps an unknown one as typed", async () => {
  const known = await call(skillsApi, { body: { label: "web application security threats" } });
  assert.equal(known.status, 200);
  assert.match(known.body.skill.esco_uri, /^http:\/\/data\.europa\.eu\/esco\//);
  assert.equal(known.body.skill.matched, true);
  const empty = await call(skillsApi, { body: { label: "   " } });
  assert.equal(empty.status, 400);
  const wrong = await call(skillsApi, { method: "GET" });
  assert.equal(wrong.status, 405);
});

test("skills rejects a loose ESCO match and keeps the typed label", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ _embedded: { results: [{ uri: "http://data.europa.eu/esco/skill/x", preferredLabel: { en: "operational tactics for emergency responses" } }] } }) });
  try {
    const { body } = await call(skillsApi, { body: { label: "incident response xyz" } });
    assert.equal(body.skill.matched, false);
    assert.equal(body.skill.label, "incident response xyz");
    assert.equal(body.skill.esco_uri, null);
  } finally {
    globalThis.fetch = real;
  }
});

test("event shape and pool_stats add up", async () => {
  const { status, body } = await call(eventApi, { method: "GET" });
  assert.equal(status, 200);
  assert.equal(body.companies.length, 5);
  assert.equal(body.candidates.length, 24);
  assert.equal(body.pool_stats.total, 24);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(body.pool_stats.by_country), 24);
  assert.equal(sum(body.pool_stats.by_education), 24);
  assert.equal(sum(body.pool_stats.by_language), body.candidates.reduce((n, c) => n + c.languages.length, 0));
  assert.deepEqual(body.companies.map((c) => c.slot).sort(), [0, 1, 2, 3, 4]);
  for (const c of body.companies) assert.ok(body.needs_cards[c.id] && body.needs_cards[c.id].tasks.length === 3);
  assert.ok(body.evidence_cards["p-ahmed"]["c-tuulia"]);
  const ids = new Set(body.candidates.map((c) => c.id));
  for (const [cand, byCompany] of Object.entries(body.evidence_cards)) {
    assert.ok(ids.has(cand));
    for (const card of Object.values(byCompany)) assert.ok(card.in_their_words.length >= 2);
  }
});

test("suggestions are unranked and pending, with no scores", async () => {
  const { body } = await call(eventApi, { method: "GET" });
  assert.ok(body.suggestions.length > 0);
  for (const s of body.suggestions) {
    assert.equal(s.status, "pending");
    assert.deepEqual(Object.keys(s).sort(), ["candidate_id", "company_id", "id", "opening_question", "status", "why"]);
    assert.doesNotMatch(JSON.stringify(s), /score|rank|\d+\s*\/\s*\d+|\d+%/i);
  }
  const live = await call(suggest, { body: { needs_cards: Object.values(body.needs_cards), evidence_cards: Object.values(body.evidence_cards).flatMap((m) => Object.values(m)) } });
  assert.equal(live.status, 200);
  assert.ok(live.body.suggestions.every((s) => s.status === "pending"));
  assert.equal(live.body.suggestions.length, body.suggestions.length);
});

test("input validation and methods", async () => {
  assert.equal((await call(needs, { method: "GET" })).status, 405);
  assert.equal((await call(eventApi, { method: "POST", body: {} })).status, 405);
  assert.equal((await call(needs, { body: "not json" })).status, 400);
  assert.equal((await call(needs, { body: { messages: [{ role: "user", content: "x".repeat(2000) }] } })).status, 400);
  assert.equal((await call(needs, { body: { messages: Array.from({ length: 20 }, () => ({ role: "user", content: "a" })) } })).status, 400);
  assert.equal((await call(evidence, { body: { needs_card: {}, answers: [] } })).status, 400);
});
