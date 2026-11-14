import { endpoint } from "../lib/http.js";
import { ValidationError } from "../lib/validate.js";
import { eventPayload, hasEvent, DEFAULT_EVENT } from "../lib/dataset.js";

export default endpoint("GET", async (_body, req) => {
  const raw = req && req.query && req.query.event;
  const id = typeof raw === "string" && raw ? raw : DEFAULT_EVENT;
  if (!hasEvent(id)) throw new ValidationError("Unknown event");
  return eventPayload(id);
});
