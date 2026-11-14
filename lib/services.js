import { askJson } from "./llm.js";
import { enrichSkills } from "./esco.js";
import { scriptedNeeds } from "./scripted.js";
import { EVIDENCE_NOTE, extractQuotes, scriptedEvidence, scriptedHeadline, scriptedQuestions, scriptedSuggestions, verifiedQuotes } from "./scripted-evidence.js";

const JUDGY = /\b(score|scored|rank|ranked|ranking|best|top candidate|excellent|impressive|outstanding|strong|weak|reject|unsuitable|perfect|ideal)\b|\d+\s*\/\s*\d+|\d+\s*%/i;

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v, n, max) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const clean = (v, max) => {
  const s = str(v, max);
  return s && !JUDGY.test(s) ? s : "";
};

export async function runNeeds(messages, companyId, options = {}) {
  const asked = messages.filter((m) => m.role === "assistant").length;
  const live = await askJson({
    ...options,
    maxTokens: 700,
    system:
      "Task: help a hiring manager turn a vague ask into a plain needs card by asking at most 3 short clarifying questions, one per turn " +
      "(first month work, what good looks like, language or location needs). Then finish. " +
      'Return JSON: {"reply": string (one short question, or one sentence when done), "done": boolean, ' +
      '"needs_card": null or {"title": string, "summary": string (one sentence), "tasks": [exactly 3 concrete first-month tasks], ' +
      '"skills": [up to 5 skill names in ESCO style], "languages": [string], "location": string}}. ' +
      "If questions_asked is 3 or more you must set done to true.",
    user: JSON.stringify({ questions_asked: asked, conversation: messages }),
  });
  if (live) {
    const d = live.data;
    const reply = str(d.reply, 300);
    if (d.done === true && d.needs_card && typeof d.needs_card === "object") {
      const c = d.needs_card;
      const tasks = strList(c.tasks, 3, 200);
      const title = str(c.title, 120);
      if (tasks.length === 3 && title) {
        return {
          reply: reply || `Here is the card: ${title}. Check the tasks and change anything that is wrong.`,
          done: true,
          needs_card: {
            company_id: companyId || "c-custom",
            title,
            summary: str(c.summary, 300),
            tasks,
            skills: await enrichSkills(strList(c.skills, 5, 60)),
            languages: strList(c.languages, 4, 30).length ? strList(c.languages, 4, 30) : ["English"],
            location: str(c.location, 80) || "Espoo, to be agreed",
          },
          mode: "live",
        };
      }
    } else if (d.done !== true && asked < 3 && reply) {
      return { reply, done: false, needs_card: null, mode: "live" };
    }
  }
  return { ...(await scriptedNeeds(messages, companyId)), mode: "scripted" };
}

export async function runQuestions(card, options = {}) {
  const live = await askJson({
    ...options,
    maxTokens: 400,
    system:
      "Task: write exactly two short, practical scenario questions for a candidate about this company's need. Each should be specific to the card, " +
      "ask what they would do (not what qualifications they hold), and be answerable in a few sentences. " +
      'Return JSON: {"questions": [string, string]}.',
    user: JSON.stringify({ needs_card: card }),
  });
  if (live) {
    const qs = strList(live.data.questions, 2, 300);
    if (qs.length === 2) return { questions: qs.map((text, i) => ({ id: `q${i + 1}`, text })), mode: "live" };
  }
  return { questions: scriptedQuestions(card), mode: "scripted" };
}

export async function runEvidence(card, answers, candidateId, options = {}) {
  const answerTexts = answers.map((a) => a.answer);
  const live = await askJson({
    ...options,
    maxTokens: 600,
    system:
      "Task: build an evidence card from the candidate's written answers only. " +
      'Return JSON: {"headline": string (max 15 words, neutral, describes what they wrote about, no praise), ' +
      '"quotes": [2 to 4 short VERBATIM excerpts copied exactly from the answers], "skills": [up to 5 skill names that the answers show, in ESCO style]}. ' +
      "Do not add anything that is not in the answers.",
    user: JSON.stringify({ needs_card: card, answers: answers.map((a) => ({ question: a.question, answer: a.answer })) }),
  });
  if (live) {
    const quotes = verifiedQuotes(strList(live.data.quotes, 6, 400), answerTexts);
    const headline = clean(live.data.headline, 160);
    if (quotes.length) {
      return {
        evidence_card: {
          candidate_id: candidateId || "p-anonymous",
          company_id: card.company_id,
          headline: headline || scriptedHeadline(answerTexts),
          in_their_words: quotes,
          skills: await enrichSkills(strList(live.data.skills, 5, 60)),
          note: EVIDENCE_NOTE,
        },
        mode: "live",
      };
    }
  }
  return { evidence_card: await scriptedEvidence(card, answers, candidateId), mode: "scripted" };
}

export async function runSuggest(needsCards, evidenceCards, options = {}) {
  const fallback = scriptedSuggestions(needsCards, evidenceCards);
  const live = await askJson({
    ...options,
    maxTokens: 900,
    system:
      "Task: for a human event organiser, suggest conversations between companies and candidates, one per evidence card. Do not rank, order by fit, or score. " +
      'Return JSON: {"suggestions": [{"company_id": string, "candidate_id": string, "why": one sentence that points at the candidate\'s own words, ' +
      '"opening_question": one question the organiser can ask in person}]}.',
    user: JSON.stringify({ needs_cards: needsCards, evidence_cards: evidenceCards }),
  });
  if (live && Array.isArray(live.data.suggestions)) {
    const byKey = new Map(evidenceCards.map((e) => [`${e.company_id}|${e.candidate_id}`, e]));
    const used = new Map();
    for (const s of live.data.suggestions) {
      const key = `${str(s && s.company_id, 60)}|${str(s && s.candidate_id, 60)}`;
      if (!byKey.has(key) || used.has(key)) continue;
      const why = clean(s.why, 300);
      const question = clean(s.opening_question, 300);
      if (!why || !question) continue;
      const e = byKey.get(key);
      used.set(key, { id: `s-${e.candidate_id}-${e.company_id}`, company_id: e.company_id, candidate_id: e.candidate_id, why, opening_question: question, status: "pending" });
    }
    if (used.size) {
      const merged = fallback.map((f) => used.get(`${f.company_id}|${f.candidate_id}`) || f);
      return { suggestions: merged, mode: "live" };
    }
  }
  return { suggestions: fallback, mode: "scripted" };
}

export { extractQuotes };
