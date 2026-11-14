import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupSkill, enrichSkills, clearEscoCache } from "../lib/esco.js";
import { askJson, extractJson, currentMode } from "../lib/llm.js";
import { runEvidence, runNeeds } from "../lib/services.js";

const failing = async () => { throw new Error("network down"); };

test("ESCO table hits need no network", async () => {
  const hit = await lookupSkill("SQL", { fetchImpl: failing });
  assert.match(hit.esco_uri, /^http:\/\/data\.europa\.eu\/esco\/skill\//);
});

test("ESCO lookup falls back to null uri when the network fails", async () => {
  clearEscoCache();
  const result = await lookupSkill("underwater basket weaving", { fetchImpl: failing });
  assert.deepEqual(result, { label: "underwater basket weaving", esco_uri: null });
  const list = await enrichSkills(["Python (computer programming)", "obscure thing"], { fetchImpl: failing });
  assert.equal(list.length, 2);
  assert.equal(list[1].esco_uri, null);
});

test("ESCO remote result is used when it is related, ignored when not", async () => {
  clearEscoCache();
  const make = (title, uri) => async () => ({ ok: true, json: async () => ({ _embedded: { results: [{ uri, title, preferredLabel: { en: title } }] } }) });
  const good = await lookupSkill("fault diagnosis", { fetchImpl: make("fault diagnosis in machines", "http://data.europa.eu/esco/skill/x") });
  assert.equal(good.esco_uri, "http://data.europa.eu/esco/skill/x");
  clearEscoCache();
  const unrelated = await lookupSkill("fault diagnosis", { fetchImpl: make("Taleo", "http://data.europa.eu/esco/skill/y") });
  assert.equal(unrelated.esco_uri, null);
});

test("mode follows env vars", () => {
  assert.equal(currentMode({}), "scripted");
  assert.equal(currentMode({ GEMINI_API_KEY: "k" }), "gemini");
  assert.equal(currentMode({ ANTHROPIC_API_KEY: "k", GEMINI_API_KEY: "k" }), "anthropic");
});

test("extractJson repairs fences and trailing commas", () => {
  assert.deepEqual(extractJson('```json\n{"a": 1,}\n```'), { a: 1 });
  assert.equal(extractJson("no json"), null);
});

test("a failing live call falls back to scripted output", async () => {
  const env = { ANTHROPIC_API_KEY: "test-key" };
  assert.equal(await askJson({ system: "s", user: "u", fetchImpl: failing, env }), null);
  const result = await runNeeds([{ role: "user", content: "we need a cybersecurity person" }], null, { fetchImpl: failing, env });
  assert.equal(result.mode, "scripted");
  assert.equal(result.done, false);
});

test("live evidence drops quotes that are not in the answers", async () => {
  const env = { GEMINI_API_KEY: "test-key" };
  const reply = { headline: "Writes about resets", quotes: ["I would check the reset page first.", "I am the best hacker alive."], skills: ["use access control software"] };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) });
  const card = { company_id: "c-x", title: "t", summary: "", tasks: ["a"], skills: [], languages: [], location: "" };
  const answers = [{ question_id: "q1", question: "?", answer: "I would check the reset page first. Then I ask." }];
  const { evidence_card, mode } = await runEvidence(card, answers, "p-x", { fetchImpl, env });
  assert.equal(mode, "live");
  assert.deepEqual(evidence_card.in_their_words, ["I would check the reset page first."]);
});
