import { endpoint } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { runNeeds } from "../lib/services.js";

export default endpoint("POST", async (body) => {
  const messages = v.messages(body.messages);
  const companyId = v.text(body.company_id, 60, "company_id", { required: false }) || null;
  return runNeeds(messages, companyId);
});
