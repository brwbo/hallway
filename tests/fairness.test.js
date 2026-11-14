import { test } from "node:test";
import assert from "node:assert/strict";
import { poolShare, suggestionStats } from "../shared/fairness.js";

const candidates = [
  { id: "a", country: "X", languages: ["L1", "L2"], education: "university" },
  { id: "b", country: "X", languages: ["L1"], education: "university" },
  { id: "c", country: "Y", languages: ["L2"], education: "bootcamp" },
  { id: "d", country: "Z", languages: ["L1"], education: "bootcamp" },
];

test("poolShare turns counts into fractions", () => {
  const share = poolShare({ total: 4, by_country: { X: 2, Y: 1, Z: 1 }, by_language: { L1: 3, L2: 2 }, by_education: { university: 2, bootcamp: 2 } });
  assert.deepEqual(share.country[0], { value: "X", share: 0.5 });
  assert.equal(share.language[0].share, 0.75);
});

test("gap is true when suggested share is under half the pool share or absent", () => {
  const suggestions = [
    { id: "s1", candidate_id: "a" },
    { id: "s2", candidate_id: "b" },
    { id: "s3", candidate_id: "a" },
    { id: "s4", candidate_id: "b" },
  ];
  const stats = suggestionStats(suggestions, candidates, []);
  const row = (dim, v) => stats[dim].find((r) => r.value === v);
  assert.equal(row("country", "X").gap, false);
  assert.equal(row("country", "Y").gap, true);
  assert.equal(row("country", "Z").suggested, 0);
  assert.equal(row("country", "Z").gap, true);
  assert.equal(row("education", "bootcamp").gap, true);
  assert.equal(row("language", "L1").pool, 0.75);
});

test("exactly half the pool share is not a gap", () => {
  const stats = suggestionStats([{ id: "s1", candidate_id: "a" }, { id: "s2", candidate_id: "c" }], candidates, []);
  assert.equal(stats.country.find((r) => r.value === "Z").gap, true);
  assert.equal(stats.country.find((r) => r.value === "Y").gap, false);
});

test("accepted share follows the latest decision, in either decision format", () => {
  const suggestions = [{ id: "s1", candidate_id: "a" }, { id: "s2", candidate_id: "c" }];
  const decisions = [
    { suggestion_id: "s1", decision: "accept", by: "o-elina", at: "t1" },
    { suggestion_id: "s2", status: "accepted" },
    { suggestion_id: "s2", status: "skipped" },
  ];
  const stats = suggestionStats(suggestions, candidates, decisions);
  assert.equal(stats.country.find((r) => r.value === "X").accepted, 1);
  assert.equal(stats.country.find((r) => r.value === "Y").accepted, 0);
});

test("no suggestions means no gaps are flagged", () => {
  const stats = suggestionStats([], candidates, []);
  assert.ok(stats.country.every((r) => r.gap === false));
});
