import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsv } from "../shared/schedule.js";

test("csv quotes commas, quotes and new lines", () => {
  const text = buildCsv([{ company: "A, B", candidate: 'C "D"', decision: "accepted", note: "one\ntwo" }]);
  const lines = text.split("\n");
  assert.equal(lines[0], "company,candidate,decision,decided_by,decided_at,talked,outcome,note");
  assert.match(text, /"A, B","C ""D""",accepted/);
  assert.match(text, /"one\ntwo"/);
});
