import { endpoint } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { runQuestions } from "../lib/services.js";

export default endpoint("POST", async (body) => runQuestions(v.needsCard(body.needs_card)));
