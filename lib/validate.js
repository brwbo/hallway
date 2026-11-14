export class ValidationError extends Error {}

export function text(value, max, name, { required = true } = {}) {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw new ValidationError(`${name} must be a string`);
  }
  const trimmed = value.replace(/\u0000/g, "").trim();
  if (required && !trimmed) throw new ValidationError(`${name} must not be empty`);
  if (trimmed.length > max) throw new ValidationError(`${name} is too long (max ${max} characters)`);
  return trimmed;
}

function list(value, maxItems, name, { min = 0 } = {}) {
  if (!Array.isArray(value)) throw new ValidationError(`${name} must be a list`);
  if (value.length < min) throw new ValidationError(`${name} needs at least ${min} item(s)`);
  if (value.length > maxItems) throw new ValidationError(`${name} has too many items (max ${maxItems})`);
  return value;
}

export function messages(value) {
  const items = list(value, 12, "messages", { min: 1 });
  const clean = items.map((m, i) => {
    if (!m || typeof m !== "object") throw new ValidationError(`messages[${i}] must be an object`);
    if (m.role !== "user" && m.role !== "assistant") throw new ValidationError(`messages[${i}].role must be user or assistant`);
    return { role: m.role, content: text(m.content, 1500, `messages[${i}].content`) };
  });
  if (clean[0].role !== "user") throw new ValidationError("first message must be from the user");
  if (clean[clean.length - 1].role !== "user") throw new ValidationError("last message must be from the user");
  return clean;
}

function skills(value, name) {
  return list(value ?? [], 10, name).map((s, i) => {
    const label = typeof s === "string" ? s : s && s.label;
    const uri = s && typeof s === "object" && typeof s.esco_uri === "string" && /^https?:\/\/data\.europa\.eu\/esco\//.test(s.esco_uri) ? s.esco_uri : null;
    return { label: text(label, 80, `${name}[${i}].label`), esco_uri: uri };
  });
}

function strings(value, maxItems, maxLen, name) {
  return list(value ?? [], maxItems, name).map((s, i) => text(s, maxLen, `${name}[${i}]`));
}

export function needsCard(value, name = "needs_card") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError(`${name} must be an object`);
  return {
    company_id: text(value.company_id, 60, `${name}.company_id`, { required: false }) || "c-custom",
    title: text(value.title, 160, `${name}.title`),
    summary: text(value.summary, 600, `${name}.summary`, { required: false }),
    tasks: strings(value.tasks, 5, 300, `${name}.tasks`),
    skills: skills(value.skills, `${name}.skills`),
    languages: strings(value.languages, 6, 40, `${name}.languages`),
    location: text(value.location, 120, `${name}.location`, { required: false }),
  };
}

export function evidenceCard(value, name = "evidence_card") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError(`${name} must be an object`);
  return {
    candidate_id: text(value.candidate_id, 60, `${name}.candidate_id`),
    company_id: text(value.company_id, 60, `${name}.company_id`),
    headline: text(value.headline, 240, `${name}.headline`, { required: false }),
    in_their_words: strings(value.in_their_words, 4, 400, `${name}.in_their_words`),
    skills: skills(value.skills, `${name}.skills`),
    note: text(value.note, 200, `${name}.note`, { required: false }),
  };
}

export function answers(value) {
  return list(value, 4, "answers", { min: 1 }).map((a, i) => {
    if (!a || typeof a !== "object") throw new ValidationError(`answers[${i}] must be an object`);
    return {
      question_id: text(a.question_id, 40, `answers[${i}].question_id`, { required: false }) || `q${i + 1}`,
      question: text(a.question, 400, `answers[${i}].question`, { required: false }),
      answer: text(a.answer, 2000, `answers[${i}].answer`),
    };
  });
}

export function needsCardList(value) {
  return list(value, 10, "needs_cards", { min: 1 }).map((c, i) => needsCard(c, `needs_cards[${i}]`));
}

export function evidenceCardList(value) {
  return list(value, 60, "evidence_cards", { min: 1 }).map((c, i) => evidenceCard(c, `evidence_cards[${i}]`));
}
