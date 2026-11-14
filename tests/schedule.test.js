import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, buildIcs, buildCsv, clock, DAY } from "../shared/schedule.js";

const companies = [{ id: "c-a", slot: 0 }, { id: "c-b", slot: 1 }];
const entry = (id, company, person, at) => ({ id, company_id: company, candidate_id: person, at, title: `${company} and ${person}`, description: "Ask, then agree a next step" });

test("nobody is booked twice at the same time", () => {
  const items = buildSchedule([
    entry("s1", "c-a", "p-1", "2026-12-04T09:00:00Z"),
    entry("s2", "c-a", "p-2", "2026-12-04T09:01:00Z"),
    entry("s3", "c-b", "p-1", "2026-12-04T09:02:00Z"),
    entry("s4", "c-b", "p-2", "2026-12-04T09:03:00Z")
  ], companies);
  for (const key of ["company_id", "candidate_id"]) {
    const seen = new Set();
    items.forEach((i) => { const tag = `${i[key]}@${i.start}`; assert.ok(!seen.has(tag), tag); seen.add(tag); });
  }
  assert.equal(items.every((i) => i.start !== null), true);
});

test("slots stay inside the day and skip lunch", () => {
  const many = Array.from({ length: 24 }, (_, n) => entry(`s${n}`, "c-a", `p-${n}`, `2026-12-04T09:${String(n).padStart(2, "0")}:00Z`));
  const items = buildSchedule(many, companies);
  const placed = items.filter((i) => i.start !== null);
  assert.ok(placed.every((i) => i.start >= DAY.start && i.end <= DAY.end));
  assert.ok(placed.every((i) => !(i.start < 13 * 60 && i.end > 12 * 60)));
  assert.equal(placed.length, 20);
  assert.equal(items.length - placed.length, 4);
});

test("booth follows the company's place on the floor", () => {
  const items = buildSchedule([entry("s1", "c-b", "p-1", "2026-12-04T09:00:00Z")], companies);
  assert.equal(items[0].booth, 2);
});

test("clock formats minutes as hours and minutes", () => {
  assert.equal(clock(10 * 60 + 5), "10:05");
  assert.equal(clock(13 * 60), "13:00");
});

test("calendar file has one event per placed conversation and escapes text", () => {
  const items = buildSchedule([entry("s1", "c-a", "p-1", "2026-12-04T09:00:00Z")], companies);
  items[0].description = "Line one; with, punctuation\nand a break";
  const text = buildIcs(items, { date: "2026-12-04" });
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(text, /DTSTART:20261204T100000/);
  assert.match(text, /DESCRIPTION:Line one\\; with\\, punctuation\\nand a break/);
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\n") && text.endsWith("END:VCALENDAR\r\n"));
});

test("csv quotes commas, quotes and new lines", () => {
  const text = buildCsv([{ company: "A, B", candidate: 'C "D"', decision: "accepted", note: "one\ntwo" }]);
  const lines = text.split("\n");
  assert.equal(lines[0], "company,candidate,decision,decided_by,decided_at,time,booth,talked,outcome,note");
  assert.match(text, /"A, B","C ""D""",accepted/);
  assert.match(text, /"one\ntwo"/);
});
