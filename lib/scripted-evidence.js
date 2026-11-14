import { enrichSkills, skillsInText } from "./esco.js";

export const EVIDENCE_NOTE = "Not a score. A starting point for a conversation.";

const TOPICS = [
  [/reset/i, "password reset"],
  [/session|cookie|token/i, "session handling"],
  [/log.?in|sign.?in|authenticat|password/i, "the sign-in flow"],
  [/brute|rate.?limit|lock.?out|guess/i, "repeated guessing"],
  [/tell|inform|notify|escalat|warn|report (it|this)|ask (the|my|a)/i, "who they would tell"],
  [/route|dispatch|truck|deliver/i, "routes and deliveries"],
  [/patient|record|hl7|fhir|clinic/i, "patient records"],
  [/sensor|reading|solar|inverter/i, "site readings"],
  [/csv|spreadsheet|table|sql|dataset/i, "the data"],
  [/level|prop|engine|unity|unreal|designer/i, "the studio tools"],
  [/test/i, "testing before release"],
];

const QUESTIONS_BY_COMPANY = {
  "c-tuulia": [
    "You have a day with our sign-in and password-reset pages. Where would you look first, and what would you try?",
    "You find a weakness that could let someone into a customer account, and a release goes out tomorrow. What do you do, and who do you tell?",
  ],
  "c-nordhaul": [
    "You get a year of delivery routes in a spreadsheet. How do you find where trucks run empty?",
    "A dispatcher says your suggested change will not work on a Monday morning. What do you do next?",
  ],
  "c-kuura": [
    "You need to link our clinic app to a patient record system. What do you check before you touch any data?",
    "A test shows two patients' details mixed up. What do you do, and who do you tell?",
  ],
  "c-aurinkovirta": [
    "Readings from 12 solar sites arrive in different formats. How do you get them into one table?",
    "One site has lost output for three weeks. What do you look at first, and what would you tell the site manager?",
  ],
  "c-pikkupeli": [
    "Designers say placing props in a level takes too long. How would you find out what is slow?",
    "You build a tool and the designers do not use it. What do you do?",
  ],
};

export function scriptedQuestions(card) {
  const fixed = QUESTIONS_BY_COMPANY[card.company_id];
  if (fixed) return fixed.map((text, i) => ({ id: `q${i + 1}`, text }));
  const first = card.tasks[0] || card.title;
  const second = card.tasks[1] || card.tasks[0] || card.title;
  return [
    { id: "q1", text: `One of the first tasks is: "${first}". How would you start, step by step?` },
    { id: "q2", text: `Something goes wrong while you do this: "${second}". What do you do, and who do you ask for help?` },
  ];
}

function sentencesOf(answer) {
  const parts = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m;
  while ((m = re.exec(answer))) {
    const raw = m[0];
    const trimmed = raw.trim();
    if (trimmed) parts.push(trimmed);
  }
  return parts;
}

function scoreSentence(sentence) {
  let score = 0;
  if (/\b(I|my|we|our)\b/i.test(sentence)) score += 2;
  if (/\d/.test(sentence)) score += 1;
  score += skillsInText(sentence).length * 2;
  score += TOPICS.filter(([re]) => re.test(sentence)).length;
  return score;
}

export function extractQuotes(answerTexts) {
  const picked = [];
  answerTexts.forEach((answer, index) => {
    const usable = sentencesOf(answer).filter((s) => {
      const n = s.split(/\s+/).length;
      return n >= 6 && n <= 40 && s.length <= 240;
    });
    let ranked = usable.map((s, i) => ({ s, i, score: scoreSentence(s) })).sort((a, b) => b.score - a.score || a.i - b.i);
    if (!ranked.length) {
      const whole = answer.trim();
      if (whole.split(/\s+/).length >= 3) {
        const cut = whole.length > 240 ? whole.slice(0, 240).replace(/\s+\S*$/, "") : whole;
        ranked = [{ s: cut, i: 0, score: 0 }];
      }
    }
    ranked.slice(0, 2).forEach((r, rank) => picked.push({ ...r, answer: index, rank }));
  });
  const ordered = picked.sort((a, b) => a.rank - b.rank || a.answer - b.answer).slice(0, 4);
  return ordered.sort((a, b) => a.answer - b.answer || a.i - b.i).map((p) => p.s);
}

export function verifiedQuotes(quotes, answerTexts) {
  const seen = new Set();
  return (quotes || [])
    .filter((q) => typeof q === "string")
    .map((q) => q.trim())
    .filter((q) => q.length >= 8 && answerTexts.some((a) => a.includes(q)) && !seen.has(q) && seen.add(q))
    .slice(0, 4);
}

function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function scriptedHeadline(answerTexts) {
  const all = answerTexts.join(" ");
  const topics = TOPICS.filter(([re]) => re.test(all)).map(([, label]) => label).slice(0, 3);
  return topics.length ? `Writes about ${joinList(topics)}` : "Their own account of how they would start";
}

export async function scriptedEvidence(card, answers, candidateId) {
  const answerTexts = answers.map((a) => a.answer);
  const quotes = verifiedQuotes(extractQuotes(answerTexts), answerTexts);
  const cardLabels = card.skills.map((s) => s.label.toLowerCase());
  const mentioned = skillsInText(answerTexts.join(" "));
  const labels = [...new Set([...mentioned.filter((l) => cardLabels.includes(l.toLowerCase())), ...mentioned])].slice(0, 5);
  return {
    candidate_id: candidateId || "p-anonymous",
    company_id: card.company_id,
    headline: scriptedHeadline(answerTexts),
    in_their_words: quotes,
    skills: await enrichSkills(labels),
    note: EVIDENCE_NOTE,
  };
}

function clip(s, n) {
  return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "..." : s;
}

export function scriptedSuggestions(needsCards, evidenceCards) {
  const needsByCompany = new Map(needsCards.map((n) => [n.company_id, n]));
  return evidenceCards
    .filter((e) => e.in_their_words.length)
    .map((e) => {
      const need = needsByCompany.get(e.company_id);
      const quote = e.in_their_words[0].replace(/[.!?\s]+$/, "");
      const work = need ? need.title.charAt(0).toLowerCase() + need.title.slice(1) : "this role";
      return {
        id: `s-${e.candidate_id}-${e.company_id}`,
        company_id: e.company_id,
        candidate_id: e.candidate_id,
        why: `They wrote "${clip(quote, 110)}", which bears on this work: ${work}.`,
        opening_question: `You wrote "${clip(quote, 90)}". How would you use that in this work: ${work}?`,
        status: "pending",
      };
    })
    .sort((a, b) => a.company_id.localeCompare(b.company_id) || a.candidate_id.localeCompare(b.candidate_id));
}
