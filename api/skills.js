import { endpoint } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { localMatch, lookupSkill } from "../lib/esco.js";

const words = (text) => String(text).toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3);
const stem = (word) => (word.length <= 4 ? word : word.slice(0, word.length - 3));

function strongMatch(typed, found) {
  const target = String(found || "").toLowerCase();
  const wanted = words(typed);
  return wanted.length > 0 && wanted.every((w) => target.includes(stem(w)));
}

export default endpoint("POST", async (body) => {
  const label = v.text(body.label, 80, "label");
  const found = localMatch(label) || (await lookupSkill(label));
  const accepted = Boolean(found && found.esco_uri && strongMatch(label, found.label));
  return { skill: { label: accepted ? found.label : label, esco_uri: accepted ? found.esco_uri : null, matched: accepted } };
});
