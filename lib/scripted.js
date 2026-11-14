import { detectDomain } from "./domains.js";
import { enrichSkills, skillsInText } from "./esco.js";
import dataNeeds from "../data/needs-cards.json" with { type: "json" };

const FOLLOW_UPS = [
  null,
  "What would good look like at the end of that month? Something you could point to.",
  "Any language or location needs, for example Finnish, English or working on site?",
];

const LANGUAGE_WORDS = [
  ["finnish", "Finnish"], ["suomi", "Finnish"], ["swedish", "Swedish"], ["english", "English"], ["german", "German"],
  ["estonian", "Estonian"], ["russian", "Russian"], ["arabic", "Arabic"], ["french", "French"],
];

const words = (s) => s.split(/\s+/).filter(Boolean);

function firstSentence(s, max = 140) {
  const sentence = s.split(/(?<=[.!?])\s+|\n+/)[0].trim().replace(/[.!?]+$/, "");
  const cut = sentence.length > max ? sentence.slice(0, max).replace(/\s+\S*$/, "") : sentence;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function pickLanguages(textValue) {
  const lower = textValue.toLowerCase();
  const found = LANGUAGE_WORDS.filter(([k]) => lower.includes(k)).map(([, v]) => v);
  return found.length ? [...new Set(found)] : ["English"];
}

function pickLocation(textValue) {
  const lower = textValue.toLowerCase();
  if (/hybrid/.test(lower)) return "Espoo, hybrid";
  if (/remote|from home/.test(lower)) return "Remote within Finland";
  if (/on.?site|office|in person|depot|studio/.test(lower)) return "Espoo, on site";
  return "Espoo, to be agreed";
}

function isCastSecurity(textValue) {
  return /cyber|secur|hack/i.test(textValue) && /login|log in|log-in|sign.?in|authenticat|password|session/i.test(textValue);
}

function domainFor(userTexts) {
  const first = detectDomain(userTexts[0] || "");
  return first.id === "general" ? detectDomain(userTexts.join(" ")) : first;
}

export async function buildNeedsCard(userTexts, companyId) {
  const all = userTexts.join(" ");
  if (isCastSecurity(all)) {
    const canned = dataNeeds["c-tuulia"];
    return { ...canned, company_id: companyId || canned.company_id };
  }
  const domain = domainFor(userTexts);
  const [ask, a1, a2, a3] = userTexts;
  const task1 = a1 && words(a1).length >= 3 ? firstSentence(a1) : domain.tasks[0];
  const task3 = a2 && words(a2).length >= 3 ? `Finish the month with this in hand: ${lowerFirst(firstSentence(a2))}` : domain.tasks[2];
  const extras = skillsInText(all).filter((l) => !domain.skills.includes(l));
  const skills = await enrichSkills([...domain.skills, ...extras].slice(0, 6));
  const title = domain.id === "general" ? `Help with: ${firstSentence(ask || "a defined piece of work", 70)}` : domain.title;
  return {
    company_id: companyId || "c-custom",
    title,
    summary: a1 && words(a1).length >= 3 ? `${domain.summary} First-month focus: ${lowerFirst(firstSentence(a1))}.` : domain.summary,
    tasks: [task1, domain.tasks[1], task3],
    skills,
    languages: pickLanguages(a3 || ""),
    location: pickLocation(a3 || ""),
  };
}

export async function scriptedNeeds(messages, companyId) {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content);
  const asked = messages.filter((m) => m.role === "assistant").length;
  const last = users[users.length - 1];
  const early = asked >= 1 && /^(that'?s (all|it)|nothing else|no more|skip|done|enough)\b/i.test(last);
  if (asked >= 3 || early) {
    const card = await buildNeedsCard(users, companyId);
    return {
      reply: `Here is the card: ${card.title}. Check the three tasks and change anything that is wrong.`,
      done: true,
      needs_card: card,
    };
  }
  const domain = domainFor(users);
  return { reply: asked === 0 ? domain.question : FOLLOW_UPS[asked], done: false, needs_card: null };
}
