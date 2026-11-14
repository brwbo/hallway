import { endpoint } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { runSuggest } from "../lib/services.js";

export default endpoint("POST", async (body) => runSuggest(v.needsCardList(body.needs_cards), v.evidenceCardList(body.evidence_cards)));
