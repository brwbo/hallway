import { endpoint } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { runEvidence } from "../lib/services.js";

export default endpoint("POST", async (body) => {
  const card = v.needsCard(body.needs_card);
  const answers = v.answers(body.answers);
  const candidateId = v.text(body.candidate_id, 60, "candidate_id", { required: false }) || null;
  return runEvidence(card, answers, candidateId);
});
